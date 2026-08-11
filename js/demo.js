// ============================================================
// FindShow — demo con datos de prueba (sin llamadas reales a APIs)
// ============================================================

// ---- Tabs (con transición de entrada) ----
function activarPanel(tabName) {
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.remove('active', 'show');
  });
  var target = document.getElementById('panel-' + tabName);
  target.classList.add('active');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { target.classList.add('show'); });
  });
}

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activarPanel(btn.dataset.tab);
  });
});
activarPanel('conciertos');

// ---- Datos de prueba: artistas seguidos ----
var artistasSeguidos = ['Sôber', 'Boikot', 'Reincidentes', 'Ska-P', 'Extremoduro', 'Def Con Dos'];
var artistasSeleccionados = new Set();

(function renderArtistList() {
  var container = document.getElementById('artistList');
  artistasSeguidos.forEach(function(name) {
    var chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = name;
    chip.addEventListener('click', function() {
      if (artistasSeleccionados.has(name)) {
        artistasSeleccionados.delete(name);
        chip.classList.remove('active');
      } else {
        artistasSeleccionados.add(name);
        chip.classList.add('active');
      }
      refrescarConciertos();
    });
    container.appendChild(chip);
  });
})();

// ---- Datos de prueba: conciertos (mismo shape que devolvería Ticketmaster, con lat/lon del recinto) ----
var conciertosDemo = [
  { artista: 'Sôber',        nombre: 'Sôber en Barcelona',                          fecha: '2026-10-10', hora: '21:00', venue: 'Sala Razzmatazz',       direccion: 'Carrer dels Almogàvers, 122', ciudad: 'Barcelona', lat: 41.3996, lon: 2.1901,  url: '#' },
  { artista: 'Sôber',        nombre: 'Concierto Sôber — Sala Paris 15',             fecha: '2026-10-17', hora: '22:00', venue: 'Sala Paris 15',         direccion: 'Calle Denis Belgrano, 19',    ciudad: 'Málaga',    lat: 36.7213, lon: -4.4213, url: '#' },
  { artista: 'Sôber',        nombre: 'Sôber + Sweet Rage en Bizkaia',               fecha: '2026-11-07', hora: '20:30', venue: 'Sala Santana 27',       direccion: 'Santana, 27',                 ciudad: 'Bilbao',    lat: 43.2627, lon: -2.9253, url: '#' },
  { artista: 'Boikot',       nombre: 'Boikot — Gira 30 aniversario',                fecha: '2026-11-14', hora: '21:30', venue: 'La Riviera',            direccion: 'Paseo Bajo de la Virgen del Puerto, 3', ciudad: 'Madrid',    lat: 40.4093, lon: -3.7241, url: '#' },
  { artista: 'Reincidentes', nombre: 'Reincidentes en concierto',                   fecha: '2026-11-21', hora: '21:00', venue: 'Custom Sevilla',        direccion: 'Calle Torneo, 43',            ciudad: 'Sevilla',   lat: 37.3891, lon: -5.9845, url: '#' },
  { artista: 'Ska-P',        nombre: 'Ska-P — Tour 2026',                           fecha: '2026-12-05', hora: '20:00', venue: 'WiZink Center',         direccion: 'Avenida Felipe II',           ciudad: 'Madrid',    lat: 40.4362, lon: -3.6683, url: '#' },
  { artista: 'Extremoduro',  nombre: 'Tributo a Extremoduro — Rock de Cantabria',   fecha: '2026-12-12', hora: '22:00', venue: 'Escenario Santander',   direccion: 'Avenida del Deporte',         ciudad: 'Santander', lat: 43.4623, lon: -3.8099, url: '#' },
  { artista: 'Def Con Dos',  nombre: 'Def Con Dos en Oviedo',                       fecha: '2026-12-19', hora: '21:00', venue: 'Sala Prestosound',      direccion: 'Calle Ramiro I, 6',           ciudad: 'Oviedo',    lat: 43.3603, lon: -5.8448, url: '#' },
  { artista: 'Marea',        nombre: 'Marea — Gira 2026',                          fecha: '2027-01-16', hora: '21:30', venue: 'Sala Rockstar',         direccion: 'Calle Ceballos, 4',           ciudad: 'Torrelavega', lat: 43.3499, lon: -4.0454, url: '#' }
];

var meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// Centro de referencia: Santander, Cantabria
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

function getFecha(item) { return new Date(item.ev.fecha + 'T00:00:00'); }
function getArtista(item) { return item.ev.artista; }
function getDist(item) { return item.dist; }

function ordenar(items, sortBy) {
  var copia = items.slice();
  copia.sort(function(a, b) {
    if (sortBy === 'artista') return getArtista(a).localeCompare(getArtista(b));
    if (sortBy === 'distancia') return getDist(a) - getDist(b);
    return getFecha(a) - getFecha(b);
  });
  return copia;
}

function renderTicket(item) {
  var d = getFecha(item);
  var day = String(d.getDate()).padStart(2, '0');
  var month = meses[d.getMonth()];

  var card = document.createElement('div');
  card.className = 'ticket';
  card.innerHTML =
    '<div class="ticket-date"><span class="day">' + day + '</span><span class="month">' + month + '</span></div>' +
    '<div class="ticket-body">' +
      '<div class="ticket-artist">' + item.ev.artista + '</div>' +
      '<p class="ticket-name">' + item.ev.nombre + '</p>' +
      '<p class="ticket-venue">' + item.ev.venue + ' · ' + item.ev.ciudad +
        '<span class="ticket-dist">' + Math.round(item.dist) + ' km</span></p>' +
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

  var html =
    '<div class="modal-header">' +
      '<span class="modal-artist">' + item.ev.artista + '</span>' +
      '<span class="modal-title">' + item.ev.nombre + '</span>' +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="modal-row"><span class="label">Fecha</span><span class="value">' + fechaLarga + (item.ev.hora ? ' · ' + item.ev.hora : '') + '</span></div>' +
      '<div class="modal-row"><span class="label">Lugar</span><span class="value">' + item.ev.venue +
        (item.ev.direccion ? '<br>' + item.ev.direccion : '') + '<br>' + item.ev.ciudad + '</span></div>' +
      '<div class="modal-row"><span class="label">Distancia</span><span class="value">' + Math.round(item.dist) + ' km desde Santander</span></div>' +
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
    var d = new Date(item.ev.fecha + 'T00:00:00');
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
    var leading = (firstDow + 6) % 7; // semana empieza en lunes
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
          tag.textContent = item.ev.artista;
          tag.title = item.ev.nombre + ' · ' + item.ev.venue + ' · ' + item.ev.ciudad;
          cell.appendChild(tag);
        });
      }
      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  });
}

var currentView = 'list';
var searchTerm = '';

document.getElementById('buscarArtista').addEventListener('input', function(e) {
  searchTerm = e.target.value.toLowerCase();
  refrescarConciertos();
});

document.getElementById('ordenarPor').addEventListener('change', renderConciertosFiltrados);
document.getElementById('agruparPor').addEventListener('change', renderConciertosFiltrados);

document.querySelectorAll('.view-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentView = btn.dataset.view;
    var esCalendario = currentView === 'calendar';
    document.getElementById('ordenarPor').disabled = esCalendario;
    document.getElementById('agruparPor').disabled = esCalendario;
    renderConciertosFiltrados();
  });
});

// Decide qué vista repintar según el modo activo (próximos / pasados).
// Definida aquí arriba pero solo se invoca tras interacción del usuario,
// para entonces modoPasados y renderSetlistsDemo ya existen (hoisting + orden de ejecución).
function refrescarConciertos() {
  if (typeof modoPasados !== 'undefined' && modoPasados) {
    renderSetlistsDemo();
  } else {
    renderConciertosFiltrados();
  }
}

function renderConciertosFiltrados() {
  var radio = parseInt(document.getElementById('radioKm').value, 10);
  document.getElementById('radioKmVal').textContent = radio + ' km';
  var sortBy = document.getElementById('ordenarPor').value;
  var groupBy = document.getElementById('agruparPor').value;

  var conResultados = conciertosDemo
    .map(function(ev) {
      var dist = distanciaKm(CENTRO_LAT, CENTRO_LON, ev.lat, ev.lon);
      return { ev: ev, dist: dist };
    })
    .filter(function(item) { return item.dist <= radio; })
    .filter(function(item) { return !searchTerm || item.ev.artista.toLowerCase().indexOf(searchTerm) !== -1; })
    .filter(function(item) { return artistasSeleccionados.size === 0 || artistasSeleccionados.has(item.ev.artista); });

  if (currentView === 'list') {
    renderListView(conResultados, sortBy, groupBy);
  } else {
    conResultados.sort(function(a, b) { return getFecha(a) - getFecha(b); });
    renderCalendarView(conResultados);
  }

  var filtroChips = artistasSeleccionados.size > 0 ? ' · filtrado a ' + artistasSeleccionados.size + ' artista(s)' : '';
  document.getElementById('statusConciertos').textContent =
    '> ' + conResultados.length + ' de ' + conciertosDemo.length + ' conciertos' +
    (searchTerm ? ' que coinciden con "' + searchTerm + '"' : '') +
    filtroChips +
    ' dentro de ' + radio + ' km de Santander (datos de prueba)';
}

document.getElementById('radioKm').addEventListener('input', renderConciertosFiltrados);
renderConciertosFiltrados();

// ============================================================
// CONCIERTOS PASADOS + SETLISTS (datos de prueba)
// ============================================================
var setlistsDemo = [
  { artista: 'Sôber', fecha: '2025-05-14', venue: 'Sala Copérnico', ciudad: 'Madrid', tour: 'Salvavidas Tour',
    canciones: ['Corazones de metal', 'Salvavidas', 'Sombras', 'Recuérdame', 'Voy a por ti'],
    bis: ['Ni un paso atrás'] },
  { artista: 'Sôber', fecha: '2024-11-02', venue: 'Razzmatazz', ciudad: 'Barcelona', tour: 'Directo al hueso',
    canciones: ['Directo al hueso', 'Fuego', 'Sin frenos', 'La última vez'],
    bis: [] },
  { artista: 'Sôber', fecha: '2023-09-20', venue: 'Custom', ciudad: 'Valencia', tour: 'Gira 2023',
    canciones: ['Origen', 'Rendirme no', 'Al filo'],
    bis: ['Corazones de metal'] },
  { artista: 'Boikot', fecha: '2024-06-08', venue: 'La Riviera', ciudad: 'Madrid', tour: 'Combatiendo',
    canciones: ['Combatiendo', 'Alerta', 'Sin fronteras', 'A contracorriente', 'Resistir'],
    bis: ['Himno del pueblo'] },
  { artista: 'Boikot', fecha: '2022-03-15', venue: 'Sala Custom', ciudad: 'Sevilla', tour: 'Gira 2022',
    canciones: ['Levanta', 'Sin miedo'],
    bis: [] },
  { artista: 'Extremoduro', fecha: '2018-08-11', venue: 'Recinto Ferial', ciudad: 'Santander', tour: 'Gira 2018',
    canciones: ['So Payaso', 'Jesucristo García', 'Sin Ley', 'Papasfritas', 'La Cagaste... Burt Lancaster'],
    bis: ['Standby'] },
  { artista: 'Ska-P', fecha: '2023-07-01', venue: 'WiZink Center', ciudad: 'Madrid', tour: 'Gira 2023',
    canciones: ['Eurosis', 'Estampida', 'El Vals del Obrero', 'Como un Rayo'],
    bis: ['Cannabis'] }
];

var modoPasados = false;

function anioDe(fechaISO) { return fechaISO.slice(0, 4); }

document.getElementById('btnTogglePasados').addEventListener('click', function() {
  modoPasados = !modoPasados;
  actualizarModoPasados();
});

function actualizarModoPasados() {
  var btn = document.getElementById('btnTogglePasados');
  btn.textContent = modoPasados ? 'Ver próximos conciertos' : 'Ver conciertos pasados';
  document.getElementById('filtroAnio').style.display = modoPasados ? 'inline-block' : 'none';
  document.getElementById('radioFilterRow').style.display = modoPasados ? 'none' : 'flex';
  document.getElementById('ordenarPor').style.display = modoPasados ? 'none' : '';
  document.getElementById('agruparPor').style.display = modoPasados ? 'none' : '';
  document.getElementById('viewToggleRow').style.display = modoPasados ? 'none' : 'flex';

  if (modoPasados) {
    poblarFiltroAnios();
    renderSetlistsDemo();
  } else {
    renderConciertosFiltrados();
  }
}

function poblarFiltroAnios() {
  var anios = {};
  setlistsDemo.forEach(function(item) { anios[anioDe(item.fecha)] = true; });
  var lista = Object.keys(anios).sort().reverse();
  var select = document.getElementById('filtroAnio');
  select.innerHTML = '<option value="">Todos los años</option>' +
    lista.map(function(a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
}

document.getElementById('filtroAnio').addEventListener('change', renderSetlistsDemo);

function renderSetlistsDemo() {
  var container = document.getElementById('ticketResults');
  container.innerHTML = '';

  var anio = document.getElementById('filtroAnio').value;

  var filtrados = setlistsDemo
    .filter(function(item) { return artistasSeleccionados.size === 0 || artistasSeleccionados.has(item.artista); })
    .filter(function(item) { return !searchTerm || item.artista.toLowerCase().indexOf(searchTerm) !== -1; })
    .filter(function(item) { return !anio || anioDe(item.fecha) === anio; })
    .sort(function(a, b) { return new Date(b.fecha) - new Date(a.fecha); });

  if (filtrados.length === 0) {
    container.innerHTML = '<div class="empty">No hay conciertos pasados (de prueba) con estos filtros. Prueba a quitar el filtro de artista o año.</div>';
  } else {
    filtrados.forEach(renderSetlistCardDemo);
  }

  document.getElementById('statusConciertos').textContent =
    '> ' + filtrados.length + ' conciertos pasados' + (anio ? ' en ' + anio : '') + ' (datos de prueba)';
}

function renderSetlistCardDemo(item) {
  var d = new Date(item.fecha + 'T00:00:00');
  var day = String(d.getDate()).padStart(2, '0');
  var month = meses[d.getMonth()];
  var totalCanciones = item.canciones.length + item.bis.length;

  var card = document.createElement('div');
  card.className = 'ticket past';
  card.innerHTML =
    '<div class="ticket-date"><span class="day">' + day + '</span><span class="month">' + month + ' ' + d.getFullYear() + '</span></div>' +
    '<div class="ticket-body">' +
      '<div class="ticket-artist">' + item.artista + '</div>' +
      '<p class="ticket-name">' + item.tour + '</p>' +
      '<p class="ticket-venue">' + item.venue + ' · ' + item.ciudad + '</p>' +
      (totalCanciones > 0
        ? '<button class="setlist-toggle">ver setlist (' + totalCanciones + ' canciones) &darr;</button>'
        : '<span class="setlist-empty">setlist no disponible</span>') +
      '<ul class="setlist-songs" style="display:none;"></ul>' +
    '</div>';

  if (totalCanciones > 0) {
    var toggle = card.querySelector('.setlist-toggle');
    var ul = card.querySelector('.setlist-songs');
    item.canciones.forEach(function(c) {
      var li = document.createElement('li');
      li.textContent = c;
      ul.appendChild(li);
    });
    item.bis.forEach(function(c) {
      var li = document.createElement('li');
      li.textContent = c + ' (bis)';
      ul.appendChild(li);
    });
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var abierto = ul.style.display !== 'none';
      ul.style.display = abierto ? 'none' : 'block';
      toggle.innerHTML = abierto ? 'ver setlist (' + totalCanciones + ' canciones) &darr;' : 'ocultar setlist &uarr;';
    });
  }

  card.addEventListener('click', function(e) {
    if (e.target.closest('.setlist-toggle')) return;
    mostrarDetalleSetlistDemo(item);
  });

  document.getElementById('ticketResults').appendChild(card);
}

function mostrarDetalleSetlistDemo(item) {
  var d = new Date(item.fecha + 'T00:00:00');
  var fechaLarga = capitalizar(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  var songsHtml = '<ul class="modal-songs">';
  item.canciones.forEach(function(c) { songsHtml += '<li>' + c + '</li>'; });
  if (item.bis.length > 0) {
    songsHtml += '<li class="encore-divider">Bis</li>';
    item.bis.forEach(function(c) { songsHtml += '<li>' + c + '</li>'; });
  }
  songsHtml += '</ul>';

  var html =
    '<div class="modal-header">' +
      '<span class="modal-artist">' + item.artista + '</span>' +
      '<span class="modal-title">' + item.tour + '</span>' +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="modal-row"><span class="label">Fecha</span><span class="value">' + fechaLarga + '</span></div>' +
      '<div class="modal-row"><span class="label">Lugar</span><span class="value">' + item.venue + '<br>' + item.ciudad + '</span></div>' +
      (item.canciones.length > 0 ? '<div class="modal-row"><span class="label">Setlist</span><span class="value">' + songsHtml + '</span></div>' : '') +
    '</div>';

  openModal(html);
}

// ---- Datos de prueba: minutos escuchados ----
var statsDemo = {
  totalHoras: 842.3,
  totalDias: 35.1,
  ranking: [
    { nombre: 'Sôber',        horas: 96.4 },
    { nombre: 'Extremoduro',  horas: 88.1 },
    { nombre: 'Boikot',       horas: 71.9 },
    { nombre: 'Ska-P',        horas: 64.2 },
    { nombre: 'Reincidentes', horas: 52.7 },
    { nombre: 'Def Con Dos',  horas: 41.5 },
    { nombre: 'Marea',        horas: 38.0 },
    { nombre: 'Rise Against', horas: 29.6 }
  ]
};

(function renderStatsDemo() {
  var maxHoras = statsDemo.ranking[0].horas;
  var html = '<div class="big-number">' + statsDemo.totalHoras +
    '<small>horas totales escuchadas &middot; ' + statsDemo.totalDias + ' días</small></div>';
  html += '<div style="margin-top:32px;">';
  statsDemo.ranking.forEach(function(r) {
    var pct = Math.max(4, (r.horas / maxHoras) * 100);
    html += '<div class="bar-row">' +
      '<div class="bar-name">' + r.nombre + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="bar-val">' + r.horas + 'h</div>' +
      '</div>';
  });
  html += '</div>';
  document.getElementById('statsResults').innerHTML = html;
})();
