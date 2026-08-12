// ============================================================
// FindShow — app.js
// v1.4.0 — 12/08/26
// ------------------------------------------------------------
// CHANGELOG (últimas 3):
// v1.4.0 (12/08/26) — Eliminado "Minutos escuchados" y las tabs; queda
//                      un único panel de conciertos, siempre visible
// v1.3.0 (12/08/26) — Fuera el panel de configuración con campos de API keys;
//                      ahora se editan como constantes al principio de este archivo
// v1.2.0 (12/08/26) — Búsqueda directa por artista/ciudad sin Spotify;
//                      caché de resultados (20 min); Spotify pasa a opcional
// ============================================================
// Utilidades de almacenamiento: usa window.storage si existe
// (entorno artifact de Claude), y cae a sessionStorage si no
// (cuando el archivo se aloja fuera, ej. GitHub Pages / local).
// ============================================================
var store = {
  set: async function(key, val) {
    if (window.storage) {
      try { await window.storage.set(key, val); return; } catch (e) {}
    }
    sessionStorage.setItem(key, val);
  },
  get: async function(key) {
    if (window.storage) {
      try {
        var r = await window.storage.get(key);
        return r ? r.value : null;
      } catch (e) { return null; }
    }
    return sessionStorage.getItem(key);
  }
};

// ============================================================
// CONTROL DE ACCESO (Google Sign-In)
// ⚠️ IMPORTANTE: esto es un filtro blando, no seguridad real.
// Como no hay servidor, el email se lee del JWT que devuelve Google
// SIN verificar su firma (verificarla requiere un backend). Cualquiera
// con DevTools podría, en teoría, saltárselo. Vale como disuasorio
// para uso personal/familiar, no como barrera de seguridad.
// Edita estas dos constantes para configurar tu acceso — ver README,
// sección "Restringir acceso (Google Sign-In)".
// ============================================================
var GOOGLE_CLIENT_ID = 'TU_CLIENT_ID.apps.googleusercontent.com';
var EMAILS_PERMITIDOS = [
  // 'tu-email@gmail.com',
];

// ============================================================
// CLAVES DE API — edítalas aquí, no se piden por pantalla.
// Son las tuyas propias (developer.spotify.com, developer.ticketmaster.com,
// api.setlist.fm) — ver README para cómo conseguirlas.
// ============================================================
var SPOTIFY_CLIENT_ID = 'TU_SPOTIFY_CLIENT_ID';
var TICKETMASTER_API_KEY = 'TU_TICKETMASTER_API_KEY';
var SETLISTFM_API_KEY = 'TU_SETLISTFM_API_KEY'; // opcional, solo para "conciertos pasados"
var CORS_PROXY_URL = ''; // opcional, solo si setlist.fm da error de CORS — ver README

function spotifyRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function decodeJwtPayload(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(
    atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join('')
  );
  return JSON.parse(jsonPayload);
}

function handleGoogleCredential(response) {
  var payload;
  try { payload = decodeJwtPayload(response.credential); }
  catch (e) { showToast('No se pudo leer la respuesta de Google', 'error'); return; }

  var email = (payload.email || '').toLowerCase();

  if (payload.email_verified && EMAILS_PERMITIDOS.indexOf(email) !== -1) {
    store.set('gate_email', email);
    ocultarGate();
    showToast('Acceso concedido — hola, ' + (payload.given_name || email), 'success');
  } else {
    showToast('Este email no tiene acceso a FindShow', 'error');
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  }
}

function mostrarGate() {
  document.getElementById('accessGate').style.display = 'flex';
  document.getElementById('appContent').style.display = 'none';

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'rectangular' }
  );
}

function ocultarGate() {
  document.getElementById('accessGate').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
}

function esperarGoogleSDK(intento) {
  intento = intento || 0;
  if (window.google && google.accounts && google.accounts.id) {
    inicializarGate();
  } else if (intento < 40) {
    setTimeout(function() { esperarGoogleSDK(intento + 1); }, 100);
  } else {
    document.getElementById('accessGate').innerHTML =
      '<div class="access-gate-card"><p class="access-gate-msg">No se pudo cargar el inicio de sesión de Google. ' +
      'Comprueba tu conexión a internet y recarga la página.</p></div>';
    document.getElementById('accessGate').style.display = 'flex';
  }
}

async function inicializarGate() {
  if (EMAILS_PERMITIDOS.length === 0) {
    // sin lista configurada: no restringe nada, deja pasar directamente
    ocultarGate();
    return;
  }
  var emailGuardado = await store.get('gate_email');
  if (emailGuardado && EMAILS_PERMITIDOS.indexOf(emailGuardado) !== -1) {
    ocultarGate();
    return;
  }
  mostrarGate();
}

var btnCerrarSesionGate = document.getElementById('btnCerrarSesionGate');
if (btnCerrarSesionGate) {
  btnCerrarSesionGate.addEventListener('click', async function() {
    await store.set('gate_email', '');
    window.location.reload();
  });
}

esperarGoogleSDK();

// (el Redirect URI ya no vive en un campo — se calcula con spotifyRedirectUri())

// ============================================================
// SPOTIFY OAuth (PKCE, sin backend)
// ============================================================
var spotifyToken = null;

function generateRandomString(length) {
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var text = '';
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  var data = new TextEncoder().encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  var str = '';
  var bytes = new Uint8Array(buffer);
  for (var i = 0; i < bytes.byteLength; i++) { str += String.fromCharCode(bytes[i]); }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

document.getElementById('btnSpotifyLogin').addEventListener('click', async function() {
  var clientId = SPOTIFY_CLIENT_ID;
  var redirectUri = spotifyRedirectUri();
  if (!clientId || clientId === 'TU_SPOTIFY_CLIENT_ID') {
    showToast('Falta configurar SPOTIFY_CLIENT_ID en js/app.js', 'error');
    return;
  }

  setBtnLoading(this, true);

  var verifier = generateRandomString(64);
  await store.set('pkce_verifier', verifier);
  await store.set('spotify_client_id', clientId);
  await store.set('spotify_redirect_uri', redirectUri);

  var challenge = base64urlencode(await sha256(verifier));

  var params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'user-follow-read',
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
});

async function handleSpotifyCallback() {
  var urlParams = new URLSearchParams(window.location.search);
  var code = urlParams.get('code');
  if (!code) return;

  var verifier = await store.get('pkce_verifier');
  var clientId = await store.get('spotify_client_id');
  var redirectUri = await store.get('spotify_redirect_uri');
  if (!verifier || !clientId) return;

  setStatus('conectando con spotify...', true);

  var body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier
  });

  var resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!resp.ok) { setStatus('error autenticando con spotify'); showToast('No se pudo autenticar con Spotify. Revisa el Client ID y el Redirect URI.', 'error'); return; }
  var data = await resp.json();
  spotifyToken = data.access_token;

  // limpia el ?code= de la url
  window.history.replaceState({}, document.title, window.location.pathname);

  document.getElementById('btnBuscarConciertos').style.display = 'inline-block';
  setStatus('conectado. cargando artistas seguidos...', true);
  await cargarArtistasSeguidos();
}

function setStatus(msg, loading) {
  var el = document.getElementById('statusConciertos');
  el.innerHTML = (loading ? '<span class="spinner"></span>' : '') + (msg ? '&gt; ' + msg : '');
}

function setBtnLoading(btn, isLoading) {
  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;
}

function mostrarProgreso(pct) {
  var bar = document.getElementById('progressBar');
  var fill = document.getElementById('progressBarFill');
  if (pct === null) { bar.classList.remove('active'); fill.style.width = '0%'; return; }
  bar.classList.add('active');
  fill.style.width = Math.round(pct * 100) + '%';
}

function mostrarSkeletons(n) {
  var container = document.getElementById('ticketResults');
  container.innerHTML = '';
  for (var i = 0; i < n; i++) {
    var sk = document.createElement('div');
    sk.className = 'skeleton-ticket';
    container.appendChild(sk);
  }
}

// Ejecuta fn(item) sobre items con un máximo de `concurrencia` peticiones en vuelo a la vez.
// Mucho más rápido que secuencial, y evita saturar el rate limit de la API.
async function enParalelo(items, concurrencia, fn) {
  var indice = 0;
  var completados = 0;

  async function trabajador() {
    while (indice < items.length) {
      var i = indice++;
      await fn(items[i], i);
      completados++;
      mostrarProgreso(completados / items.length);
    }
  }

  var trabajadores = [];
  for (var w = 0; w < Math.min(concurrencia, items.length); w++) trabajadores.push(trabajador());
  await Promise.all(trabajadores);
}

// ---- Artistas seguidos ----
var artistasSeguidos = [];

async function cargarArtistasSeguidos() {
  artistasSeguidos = [];
  setStatus('cargando artistas seguidos...', true);
  var url = 'https://api.spotify.com/v1/me/following?type=artist&limit=50';

  while (url) {
    var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + spotifyToken } });
    if (!resp.ok) { setStatus('error leyendo artistas seguidos'); showToast('No se pudieron leer tus artistas seguidos de Spotify.', 'error'); return; }
    var data = await resp.json();
    data.artists.items.forEach(function(a) { artistasSeguidos.push(a.name); });
    url = data.artists.next;
  }

  setStatus(artistasSeguidos.length + ' artistas seguidos cargados');
  showToast('Conectado con Spotify · ' + artistasSeguidos.length + ' artistas seguidos', 'success');
  renderArtistList();
}

function renderArtistList() {
  var container = document.getElementById('artistList');
  container.innerHTML = '';
  artistasSeguidos.forEach(function(name) {
    var chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = name;
    chip.addEventListener('click', function() {
      document.querySelectorAll('#artistList .chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      document.getElementById('artistaQuery').value = name;

      if (typeof modoPasados !== 'undefined' && modoPasados) {
        buscarSetlists();
      } else {
        buscarLibre(name, document.getElementById('ciudadQuery').value.trim());
      }
    });
    container.appendChild(chip);
  });
}

// ---- Ticketmaster: búsqueda bulk de todos los artistas seguidos (opcional, requiere Spotify) ----
document.getElementById('btnBuscarConciertos').addEventListener('click', buscarTodosLosSeguidos);

var ultimosResultados = [];
var currentView = 'list';

// Centro de referencia para el filtro geográfico: Santander, Cantabria
var CENTRO_LAT = 43.4623;
var CENTRO_LON = -3.8099;

function distanciaKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---- Caché de búsquedas (evita repetir llamadas idénticas a Ticketmaster) ----
var CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutos

async function leerCache(key) {
  try {
    var raw = await store.get(key);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (e) { return null; }
}

async function guardarCache(key, data) {
  try { await store.set(key, JSON.stringify({ ts: Date.now(), data: data })); }
  catch (e) { /* si falla el guardado, no pasa nada, simplemente no cachea esta vez */ }
}

async function buscarTodosLosSeguidos() {
  var apiKey = TICKETMASTER_API_KEY;
  var radio = parseInt(document.getElementById('radioKm').value, 10) || 150;
  if (!apiKey || apiKey === 'TU_TICKETMASTER_API_KEY') { showToast('Falta configurar TICKETMASTER_API_KEY en js/app.js', 'error'); return; }
  if (artistasSeguidos.length === 0) { setStatus('no hay artistas cargados'); return; }

  var btn = document.getElementById('btnBuscarConciertos');
  setBtnLoading(btn, true);
  mostrarSkeletons(Math.min(4, artistasSeguidos.length));
  mostrarProgreso(0);
  setStatus('buscando conciertos... (0/' + artistasSeguidos.length + ')', true);

  var todosLosEventos = [];
  var completados = 0;

  await enParalelo(artistasSeguidos, 5, async function(artista) {
    var url = 'https://app.ticketmaster.com/discovery/v2/events.json'
      + '?keyword=' + encodeURIComponent(artista)
      + '&countryCode=ES&classificationName=music&sort=date,asc&size=10&apikey=' + apiKey;

    try {
      var resp = await fetch(url);
      if (resp.ok) {
        var data = await resp.json();
        if (data._embedded && data._embedded.events) {
          data._embedded.events.forEach(function(ev) {
            var venue = ev._embedded && ev._embedded.venues && ev._embedded.venues[0];
            var loc = venue && venue.location;
            if (!loc || !loc.latitude || !loc.longitude) return;
            var dist = distanciaKm(CENTRO_LAT, CENTRO_LON, parseFloat(loc.latitude), parseFloat(loc.longitude));
            if (dist <= radio) {
              todosLosEventos.push({ artista: artista, ev: ev, venue: venue, dist: dist });
            }
          });
        }
      }
    } catch (e) { /* seguimos con el siguiente artista, un fallo no bloquea el resto */ }

    completados++;
    setStatus('buscando conciertos... (' + completados + '/' + artistasSeguidos.length + ')', true);
  });

  mostrarProgreso(null);
  setBtnLoading(btn, false);
  ultimosResultados = todosLosEventos;
  renderResultados();

  if (todosLosEventos.length > 0) {
    showToast(todosLosEventos.length + (todosLosEventos.length === 1 ? ' concierto encontrado' : ' conciertos encontrados') + ' dentro de ' + radio + ' km de Cantabria', 'success');
  } else {
    showToast('Ningún concierto encontrado en ese radio. Prueba a ampliarlo.', 'info');
  }
}

// ---- Búsqueda directa por artista y/o ciudad (NO requiere Spotify) ----
document.getElementById('btnBuscarLibre').addEventListener('click', function() {
  ejecutarBusquedaPrincipal();
});
['artistaQuery', 'ciudadQuery'].forEach(function(id) {
  document.getElementById(id).addEventListener('keydown', function(e) {
    if (e.key === 'Enter') ejecutarBusquedaPrincipal();
  });
});

function ejecutarBusquedaPrincipal() {
  if (typeof modoPasados !== 'undefined' && modoPasados) {
    buscarSetlists();
  } else {
    var artista = document.getElementById('artistaQuery').value.trim();
    var ciudad = document.getElementById('ciudadQuery').value.trim();
    buscarLibre(artista, ciudad);
  }
}

async function buscarLibre(artista, ciudad) {
  var apiKey = TICKETMASTER_API_KEY;
  var radio = parseInt(document.getElementById('radioKm').value, 10) || 150;
  if (!apiKey || apiKey === 'TU_TICKETMASTER_API_KEY') { showToast('Falta configurar TICKETMASTER_API_KEY en js/app.js', 'error'); return; }
  if (!artista && !ciudad) { showToast('Escribe un artista, una ciudad, o ambos', 'info'); return; }

  var cacheKey = 'tm_' + artista.toLowerCase() + '|' + ciudad.toLowerCase() + '|' + (ciudad ? 'sin-radio' : radio);
  var enCache = await leerCache(cacheKey);
  if (enCache) {
    ultimosResultados = enCache;
    renderResultados();
    showToast(enCache.length + (enCache.length === 1 ? ' concierto' : ' conciertos') + ' (desde caché)', 'info');
    return;
  }

  setBtnLoading(document.getElementById('btnBuscarLibre'), true);
  mostrarSkeletons(3);
  setStatus('buscando en Ticketmaster...', true);

  var url = 'https://app.ticketmaster.com/discovery/v2/events.json'
    + '?countryCode=ES&classificationName=music&sort=date,asc&size=30&apikey=' + apiKey;
  if (artista) url += '&keyword=' + encodeURIComponent(artista);
  if (ciudad) url += '&city=' + encodeURIComponent(ciudad);

  var eventos = [];

  try {
    var resp = await fetch(url);
    if (resp.ok) {
      var data = await resp.json();
      if (data._embedded && data._embedded.events) {
        data._embedded.events.forEach(function(ev) {
          var venue = ev._embedded && ev._embedded.venues && ev._embedded.venues[0];
          var loc = venue && venue.location;
          var dist = null;
          if (loc && loc.latitude && loc.longitude) {
            dist = distanciaKm(CENTRO_LAT, CENTRO_LON, parseFloat(loc.latitude), parseFloat(loc.longitude));
          }
          // Sin ciudad especificada: filtra por radio (solo si hay coordenadas para comprobarlo).
          // Con ciudad especificada: no se filtra por distancia, la ciudad ya acota la búsqueda.
          if (!ciudad) {
            if (dist === null || dist > radio) return;
          }
          var nombreArtista = (ev._embedded && ev._embedded.attractions && ev._embedded.attractions[0])
            ? ev._embedded.attractions[0].name
            : (artista || ev.name);
          eventos.push({ artista: nombreArtista, ev: ev, venue: venue, dist: dist });
        });
      }
    } else {
      showToast('Ticketmaster devolvió un error (' + resp.status + '). Revisa la API key.', 'error');
    }
  } catch (e) {
    showToast('No se pudo contactar con Ticketmaster', 'error');
  }

  setBtnLoading(document.getElementById('btnBuscarLibre'), false);
  ultimosResultados = eventos;
  guardarCache(cacheKey, eventos);
  renderResultados();

  if (eventos.length > 0) {
    showToast(eventos.length + (eventos.length === 1 ? ' concierto encontrado' : ' conciertos encontrados'), 'success');
  } else {
    showToast('Sin resultados. Prueba con otro artista, otra ciudad, o amplía el radio.', 'info');
  }
}

function getFecha(item) {
  var f = item.ev.dates && item.ev.dates.start ? item.ev.dates.start.localDate : null;
  return f ? new Date(f + 'T00:00:00') : new Date(0);
}
function getArtista(item) { return item.artista; }
function getDist(item) { return item.dist; }
function getVenueTxt(item) {
  return item.venue ? item.venue.name + (item.venue.city ? ' · ' + item.venue.city.name : '') : '';
}

function ordenar(items, sortBy) {
  var copia = items.slice();
  copia.sort(function(a, b) {
    if (sortBy === 'artista') return getArtista(a).localeCompare(getArtista(b));
    if (sortBy === 'distancia') {
      var da = getDist(a) === null ? Infinity : getDist(a);
      var db = getDist(b) === null ? Infinity : getDist(b);
      return da - db;
    }
    return getFecha(a) - getFecha(b);
  });
  return copia;
}

function renderTicket(item) {
  var d = getFecha(item);
  var day = String(d.getDate()).padStart(2, '0');
  var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  var month = meses[d.getMonth()];

  var card = document.createElement('div');
  card.className = 'ticket';
  card.innerHTML =
    '<div class="ticket-date"><span class="day">' + day + '</span><span class="month">' + month + '</span></div>' +
    '<div class="ticket-body">' +
      '<div class="ticket-artist">' + item.artista + '</div>' +
      '<p class="ticket-name">' + item.ev.name + '</p>' +
      '<p class="ticket-venue">' + getVenueTxt(item) +
        (item.dist !== null ? '<span class="ticket-dist">' + Math.round(item.dist) + ' km</span>' : '') + '</p>' +
      '<a class="ticket-link" href="' + item.ev.url + '" target="_blank">ver entradas &rarr;</a>' +
    '</div>';

  card.addEventListener('click', function(e) {
    if (e.target.closest('.ticket-link')) return; // el link de compra funciona como siempre
    mostrarDetalleConcierto(item);
  });

  document.getElementById('ticketResults').appendChild(card);
}

function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function mostrarDetalleConcierto(item) {
  var d = getFecha(item);
  var fechaLarga = capitalizar(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  var hora = item.ev.dates && item.ev.dates.start && item.ev.dates.start.localTime
    ? item.ev.dates.start.localTime.slice(0, 5)
    : null;

  var venue = item.venue;
  var direccion = venue && venue.address && venue.address.line1 ? venue.address.line1 : null;
  var lugarTxt = venue ? venue.name : 'Recinto no especificado';
  var ciudadTxt = venue && venue.city ? venue.city.name : '';

  var precioTxt = null;
  if (item.ev.priceRanges && item.ev.priceRanges[0]) {
    var pr = item.ev.priceRanges[0];
    precioTxt = 'Desde ' + pr.min + ' ' + (pr.currency || 'EUR');
  }

  var html =
    '<div class="modal-header">' +
      '<span class="modal-artist">' + item.artista + '</span>' +
      '<span class="modal-title">' + item.ev.name + '</span>' +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="modal-row"><span class="label">Fecha</span><span class="value">' + fechaLarga + (hora ? ' · ' + hora : '') + '</span></div>' +
      '<div class="modal-row"><span class="label">Lugar</span><span class="value">' + lugarTxt +
        (direccion ? '<br>' + direccion : '') + (ciudadTxt ? '<br>' + ciudadTxt : '') + '</span></div>' +
      (item.dist !== null ? '<div class="modal-row"><span class="label">Distancia</span><span class="value">' + Math.round(item.dist) + ' km desde Santander</span></div>' : '') +
      (precioTxt ? '<div class="modal-row"><span class="label">Precio</span><span class="value">' + precioTxt + '</span></div>' : '') +
      '<div class="modal-actions">' +
        '<a class="btn" href="' + item.ev.url + '" target="_blank">Ver entradas</a>' +
        '<button class="btn secondary" id="modalCopyLink">Copiar enlace</button>' +
      '</div>' +
    '</div>';

  openModal(html);

  document.getElementById('modalCopyLink').addEventListener('click', function() {
    navigator.clipboard.writeText(item.ev.url).then(function() {
      showToast('Enlace copiado al portapapeles', 'success');
    }).catch(function() {
      showToast('No se pudo copiar el enlace', 'error');
    });
  });
}

function renderListView(items, sortBy, groupBy) {
  var container = document.getElementById('ticketResults');
  container.innerHTML = '';
  if (items.length === 0) { container.innerHTML = '<div class="empty">Sin resultados con estos filtros.</div>'; return; }

  if (groupBy === 'ninguno') {
    ordenar(items, sortBy).forEach(renderTicket);
    return;
  }

  if (groupBy === 'artista') {
    var porArtista = {};
    items.forEach(function(item) {
      var key = getArtista(item);
      if (!porArtista[key]) porArtista[key] = [];
      porArtista[key].push(item);
    });
    Object.keys(porArtista).sort(function(a, b) { return a.localeCompare(b); }).forEach(function(key) {
      var header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = key + ' (' + porArtista[key].length + ')';
      container.appendChild(header);
      ordenar(porArtista[key], sortBy === 'artista' ? 'fecha' : sortBy).forEach(renderTicket);
    });
    return;
  }

  if (groupBy === 'mes') {
    var porMes = {};
    items.forEach(function(item) {
      var d = getFecha(item);
      var key = d.getFullYear() + '-' + d.getMonth();
      if (!porMes[key]) porMes[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
      porMes[key].items.push(item);
    });
    Object.keys(porMes).sort(function(a, b) {
      var ma = porMes[a], mb = porMes[b];
      return (ma.year - mb.year) || (ma.month - mb.month);
    }).forEach(function(key) {
      var m = porMes[key];
      var header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = MESES_NOMBRE[m.month] + ' ' + m.year + ' (' + m.items.length + ')';
      container.appendChild(header);
      ordenar(m.items, sortBy).forEach(renderTicket);
    });
    return;
  }
}

var MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function renderCalendarView(items) {
  var container = document.getElementById('ticketResults');
  container.innerHTML = '';
  if (items.length === 0) { container.innerHTML = '<div class="empty">Sin resultados con estos filtros.</div>'; return; }

  var porMes = {};
  items.forEach(function(item) {
    var d = getFecha(item);
    var key = d.getFullYear() + '-' + d.getMonth();
    if (!porMes[key]) porMes[key] = { year: d.getFullYear(), month: d.getMonth(), dias: {} };
    var day = d.getDate();
    if (!porMes[key].dias[day]) porMes[key].dias[day] = [];
    porMes[key].dias[day].push(item);
  });

  Object.keys(porMes).sort(function(a, b) {
    var ma = porMes[a], mb = porMes[b];
    return (ma.year - mb.year) || (ma.month - mb.month);
  }).forEach(function(key) {
    var m = porMes[key];
    var block = document.createElement('div');
    block.className = 'calendar-month';

    var h3 = document.createElement('h3');
    h3.textContent = MESES_NOMBRE[m.month] + ' ' + m.year;
    block.appendChild(h3);

    var grid = document.createElement('div');
    grid.className = 'calendar-grid';
    DOW.forEach(function(d) {
      var el = document.createElement('div');
      el.className = 'calendar-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    var firstDow = new Date(m.year, m.month, 1).getDay();
    var leading = (firstDow + 6) % 7;
    for (var i = 0; i < leading; i++) {
      var empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
    }

    var totalDias = new Date(m.year, m.month + 1, 0).getDate();
    for (var day = 1; day <= totalDias; day++) {
      var cell = document.createElement('div');
      cell.className = 'calendar-day' + (m.dias[day] ? ' has-event' : '');

      var num = document.createElement('div');
      num.className = 'daynum';
      num.textContent = day;
      cell.appendChild(num);

      if (m.dias[day]) {
        m.dias[day].forEach(function(item) {
          var tag = document.createElement('a');
          tag.className = 'ev-tag';
          tag.href = item.ev.url;
          tag.target = '_blank';
          tag.textContent = item.artista;
          tag.title = item.ev.name + ' · ' + getVenueTxt(item);
          cell.appendChild(tag);
        });
      }
      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  });
}

function renderResultados() {
  var searchTerm = document.getElementById('buscarArtista').value.toLowerCase();
  var radio = parseInt(document.getElementById('radioKm').value, 10) || 150;
  var sortBy = document.getElementById('ordenarPor').value;
  var groupBy = document.getElementById('agruparPor').value;

  var filtrados = ultimosResultados
    .filter(function(item) { return !searchTerm || item.artista.toLowerCase().indexOf(searchTerm) !== -1; });

  if (currentView === 'list') {
    renderListView(filtrados, sortBy, groupBy);
  } else {
    filtrados.sort(function(a, b) { return getFecha(a) - getFecha(b); });
    renderCalendarView(filtrados);
  }

  setStatus(filtrados.length + ' eventos' + (searchTerm ? ' que coinciden con "' + searchTerm + '"' : '') + ' · radio ' + radio + ' km');
}

document.getElementById('buscarArtista').addEventListener('input', function() {
  refrescarConciertos();
});
document.getElementById('ordenarPor').addEventListener('change', renderResultados);
document.getElementById('agruparPor').addEventListener('change', renderResultados);

document.querySelectorAll('.view-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentView = btn.dataset.view;
    var esCalendario = currentView === 'calendar';
    document.getElementById('ordenarPor').disabled = esCalendario;
    document.getElementById('agruparPor').disabled = esCalendario;
    renderResultados();
  });
});

function refrescarConciertos() {
  if (typeof modoPasados !== 'undefined' && modoPasados) {
    renderSetlists();
  } else {
    renderResultados();
  }
}

// ============================================================
// CONCIERTOS PASADOS (setlist.fm)
// IMPORTANTE: la API de setlist.fm no admite peticiones CORS directas
// desde el navegador. Se intenta igualmente (por si algún día lo habilitan
// o si estás detrás de una extensión que lo permite), y si falla se explica
// el problema con claridad en vez de fallar en silencio. La solución real
// es un proxy propio — ver README, sección "Conciertos pasados".
// ============================================================
var modoPasados = false;
var ultimosSetlists = [];

document.getElementById('btnTogglePasados').addEventListener('click', function() {
  modoPasados = !modoPasados;
  actualizarModoPasados();
});

function actualizarModoPasados() {
  var btn = document.getElementById('btnTogglePasados');
  btn.textContent = modoPasados ? 'Ver próximos conciertos' : 'Ver conciertos pasados';
  document.getElementById('filtroAnio').style.display = modoPasados ? 'inline-block' : 'none';
  document.getElementById('ordenarPor').style.display = modoPasados ? 'none' : '';
  document.getElementById('agruparPor').style.display = modoPasados ? 'none' : '';
  document.getElementById('viewToggleRow').style.display = modoPasados ? 'none' : 'flex';
  document.getElementById('corsNote').style.display = 'none';

  if (modoPasados) {
    buscarSetlists();
  } else {
    renderResultados();
  }
}

document.getElementById('filtroAnio').addEventListener('change', renderSetlists);

function anioDeSetlist(fechaDDMMYYYY) { return fechaDDMMYYYY.slice(6, 10); }

function parseFechaSetlist(fechaDDMMYYYY) {
  var p = fechaDDMMYYYY.split('-');
  return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10)).getTime();
}

async function buscarSetlists() {
  var apiKey = SETLISTFM_API_KEY;
  var artista = document.getElementById('artistaQuery').value.trim();
  if (!apiKey || apiKey === 'TU_SETLISTFM_API_KEY') { showToast('Falta configurar SETLISTFM_API_KEY en js/app.js', 'error'); return; }
  if (!artista) {
    showToast('Escribe un artista arriba (o pulsa un chip) para ver su historial', 'info');
    document.getElementById('ticketResults').innerHTML = '<div class="empty">Escribe el nombre de un artista en el buscador de arriba para ver su historial de conciertos.</div>';
    setStatus('');
    return;
  }

  var proxyUrl = CORS_PROXY_URL;
  var cacheKey = 'sfm_' + artista.toLowerCase();

  var enCache = await leerCache(cacheKey);
  if (enCache) {
    ultimosSetlists = enCache;
    poblarFiltroAnios(enCache);
    renderSetlists();
    showToast(enCache.length + (enCache.length === 1 ? ' concierto pasado' : ' conciertos pasados') + ' (desde caché)', 'info');
    return;
  }

  mostrarSkeletons(3);
  setStatus('buscando conciertos pasados...', true);

  var base = 'https://api.setlist.fm/rest/1.0/search/setlists?artistName=' + encodeURIComponent(artista) + '&p=1';
  var url = proxyUrl ? proxyUrl + encodeURIComponent(base) : base;

  var todos = [];
  var falloCors = false;

  try {
    var resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'x-api-key': apiKey }
    });
    if (resp.ok) {
      var data = await resp.json();
      (data.setlist || []).forEach(function(sl) {
        todos.push({ artista: artista, sl: sl });
      });
    }
  } catch (e) {
    falloCors = true; // fetch rechazado por CORS u otro error de red
  }

  ultimosSetlists = todos;

  if (falloCors && todos.length === 0) {
    document.getElementById('corsNote').style.display = 'block';
    showToast('setlist.fm bloqueó la petición (CORS). Necesitas un proxy — ver README.', 'error', 6000);
    setStatus('sin datos: setlist.fm bloqueó la petición desde el navegador (CORS)');
    document.getElementById('ticketResults').innerHTML = '<div class="empty">No se pudo contactar con setlist.fm directamente desde el navegador. Consulta la sección "Conciertos pasados" del README para configurar un proxy.</div>';
    return;
  }

  guardarCache(cacheKey, todos);
  poblarFiltroAnios(todos);
  renderSetlists();

  if (todos.length > 0) {
    showToast(todos.length + (todos.length === 1 ? ' concierto pasado encontrado' : ' conciertos pasados encontrados'), 'success');
  } else {
    showToast('Sin conciertos pasados encontrados para "' + artista + '"', 'info');
  }
}

function poblarFiltroAnios(items) {
  var anios = {};
  items.forEach(function(item) { anios[anioDeSetlist(item.sl.eventDate)] = true; });
  var lista = Object.keys(anios).sort().reverse();
  var select = document.getElementById('filtroAnio');
  select.innerHTML = '<option value="">Todos los años</option>' +
    lista.map(function(a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
}

function renderSetlists() {
  var container = document.getElementById('ticketResults');
  container.innerHTML = '';

  var searchTerm = document.getElementById('buscarArtista').value.toLowerCase();
  var anio = document.getElementById('filtroAnio').value;

  var filtrados = ultimosSetlists
    .filter(function(item) { return !searchTerm || item.artista.toLowerCase().indexOf(searchTerm) !== -1; })
    .filter(function(item) { return !anio || anioDeSetlist(item.sl.eventDate) === anio; })
    .sort(function(a, b) { return parseFechaSetlist(b.sl.eventDate) - parseFechaSetlist(a.sl.eventDate); });

  if (filtrados.length === 0) {
    container.innerHTML = '<div class="empty">No hay conciertos pasados con estos filtros.</div>';
  } else {
    filtrados.forEach(renderSetlistCard);
  }

  setStatus(filtrados.length + ' conciertos pasados' + (anio ? ' en ' + anio : '') + (searchTerm ? ' · "' + searchTerm + '"' : ''));
}

function extraerCanciones(sl) {
  var canciones = [];
  ((sl.sets && sl.sets.set) || []).forEach(function(set) {
    (set.song || []).forEach(function(song) {
      canciones.push({
        nombre: song.name,
        bis: !!set.encore,
        cover: song.cover ? song.cover.name : null
      });
    });
  });
  return canciones;
}

function renderSetlistCard(item) {
  var sl = item.sl;
  var p = sl.eventDate.split('-');
  var d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
  var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  var day = p[0];
  var month = meses[d.getMonth()] + ' ' + d.getFullYear();

  var venueTxt = sl.venue ? sl.venue.name + (sl.venue.city ? ' · ' + sl.venue.city.name : '') : '';
  var tourTxt = sl.tour ? sl.tour.name : (sl.venue ? sl.venue.name : 'Concierto');
  var canciones = extraerCanciones(sl);

  var card = document.createElement('div');
  card.className = 'ticket past';
  card.innerHTML =
    '<div class="ticket-date"><span class="day">' + day + '</span><span class="month">' + month + '</span></div>' +
    '<div class="ticket-body">' +
      '<div class="ticket-artist">' + item.artista + '</div>' +
      '<p class="ticket-name">' + tourTxt + '</p>' +
      '<p class="ticket-venue">' + venueTxt + '</p>' +
      (canciones.length > 0
        ? '<button class="setlist-toggle">ver setlist (' + canciones.length + ' canciones) &darr;</button>'
        : '<span class="setlist-empty">setlist no disponible</span>') +
      '<ul class="setlist-songs" style="display:none;"></ul>' +
    '</div>';

  if (canciones.length > 0) {
    var toggle = card.querySelector('.setlist-toggle');
    var ul = card.querySelector('.setlist-songs');
    canciones.forEach(function(c) {
      var li = document.createElement('li');
      li.textContent = c.nombre + (c.cover ? ' (cover de ' + c.cover + ')' : '') + (c.bis ? ' (bis)' : '');
      ul.appendChild(li);
    });
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var abierto = ul.style.display !== 'none';
      ul.style.display = abierto ? 'none' : 'block';
      toggle.innerHTML = abierto ? 'ver setlist (' + canciones.length + ' canciones) &darr;' : 'ocultar setlist &uarr;';
    });
  }

  card.addEventListener('click', function(e) {
    if (e.target.closest('.setlist-toggle')) return;
    mostrarDetalleSetlist(item, canciones);
  });

  document.getElementById('ticketResults').appendChild(card);
}

function mostrarDetalleSetlist(item, canciones) {
  var sl = item.sl;
  var p = sl.eventDate.split('-');
  var d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
  var fechaLarga = capitalizar(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  var venueTxt = sl.venue ? sl.venue.name : '';
  var ciudadTxt = sl.venue && sl.venue.city ? sl.venue.city.name : '';
  var tourTxt = sl.tour ? sl.tour.name : venueTxt;

  var songsHtml = '';
  if (canciones.length > 0) {
    songsHtml = '<ul class="modal-songs">';
    var enBis = false;
    canciones.forEach(function(c) {
      if (c.bis && !enBis) { songsHtml += '<li class="encore-divider">Bis</li>'; enBis = true; }
      songsHtml += '<li>' + c.nombre + (c.cover ? ' (cover de ' + c.cover + ')' : '') + '</li>';
    });
    songsHtml += '</ul>';
  }

  var html =
    '<div class="modal-header">' +
      '<span class="modal-artist">' + item.artista + '</span>' +
      '<span class="modal-title">' + tourTxt + '</span>' +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="modal-row"><span class="label">Fecha</span><span class="value">' + fechaLarga + '</span></div>' +
      '<div class="modal-row"><span class="label">Lugar</span><span class="value">' + venueTxt + (ciudadTxt ? '<br>' + ciudadTxt : '') + '</span></div>' +
      (canciones.length > 0 ? '<div class="modal-row"><span class="label">Setlist</span><span class="value">' + songsHtml + '</span></div>' : '') +
      '<div class="modal-actions">' +
        '<a class="btn secondary" href="' + sl.url + '" target="_blank">Ver en setlist.fm</a>' +
      '</div>' +
    '</div>';

  openModal(html);
}

// Al cargar la página, comprueba si venimos de vuelta del login de Spotify
handleSpotifyCallback();
