# FindShow

Busca conciertos reales en España (Ticketmaster) por artista, por ciudad, o ambos —
sin necesidad de cuenta ni login. Conectar con Spotify es **opcional**: si lo haces,
tus artistas seguidos aparecen como accesos rápidos de búsqueda. Incluye conciertos
pasados con setlist completo (setlist.fm). 100% cliente, sin backend.

## Funcionalidades

- **Búsqueda directa por artista y/o ciudad, sin login** — la función principal.
  Sin ciudad, filtra por radio desde Cantabria; con ciudad, busca ahí sin límite de distancia.
- **Caché client-side** de las búsquedas (20 minutos): repetir una búsqueda no repite
  la llamada a Ticketmaster, más rápido y ahorra cuota de API.
- Login con Spotify **opcional** (OAuth 2.0 Authorization Code + PKCE, sin client secret) —
  añade tus artistas seguidos como chips de acceso rápido y una búsqueda bulk de todos ellos
- Filtro geográfico por radio (fórmula de Haversine) desde Santander
- Vistas Lista / Calendario
- Ordenar por Fecha / Artista / Distancia
- Agrupar por Artista / Mes
- Conciertos pasados con setlist completo, filtrable por año (setlist.fm)
- Control de acceso opcional vía Google Sign-In (filtro blando, ver sección correspondiente)

## Estructura

```
findshow/
├── index.html      # versión real (requiere credenciales)
├── demo.html        # versión con datos de prueba, sin credenciales
├── manifest.json     # manifest PWA (nombre, iconos, capturas, shortcuts)
├── sw.js              # service worker (app shell offline, nunca cachea las APIs)
├── favicon.ico
├── css/
│   └── styles.css   # compartido por ambas páginas
├── js/
│   ├── ui.js          # toasts + modal de detalle, compartido
│   ├── app.js        # lógica de index.html (OAuth, fetch, render, caché)
│   └── demo.js         # lógica de demo.html (datos mock, render)
├── icons/            # icono en todos los tamaños PWA + variante maskable
├── screenshots/       # capturas para el listado de instalación
├── README.md
├── LICENSE
└── .gitignore
```

## Demo

Abre `demo.html` directamente en el navegador (doble clic) — datos de prueba,
sin necesidad de credenciales ni servidor.

## Uso real

Las claves ya no se piden por pantalla — se editan directamente en `js/app.js` (al principio
del archivo), igual que el resto de constantes de configuración. Más simple de desplegar
(no hay que volver a pegarlas cada vez que entras) y más simple de compartir con quien quieras
que la use.

**Lo mínimo para buscar conciertos** (sin Spotify):

1. Consigue una API key gratuita en [developer.ticketmaster.com](https://developer.ticketmaster.com).
2. Edita `js/app.js` y pon tu key en:
   ```javascript
   var TICKETMASTER_API_KEY = 'tu-key-aquí';
   ```
3. Sirve el proyecto por HTTP — no funciona con `file://`:
   ```bash
   python3 -m http.server 8080
   ```
   (o publícalo en GitHub Pages / cualquier hosting HTTPS, como ya tienes con
   `wolologger.github.io/FindShow`)
4. Escribe un artista, una ciudad, o ambos, y pulsa **Buscar**.

**Para añadir accesos rápidos a tus artistas seguidos** (opcional):

5. Crea una app en [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
   Desde febrero de 2026 hace falta cuenta Spotify **Premium** para registrar apps.
   Activa el scope `user-follow-read` y marca solo **Web API**.
6. Registra en el dashboard de Spotify, como Redirect URI, la misma URL exacta
   donde sirvas `index.html`. Desde 2025 Spotify exige loopback explícito en local
   (`http://127.0.0.1:8080/index.html`, `localhost` ya no vale) o HTTPS en producción.
7. Edita `js/app.js`:
   ```javascript
   var SPOTIFY_CLIENT_ID = 'tu-client-id-aquí';
   ```
8. Pulsa "Conectar con Spotify" en la app.


## Conciertos pasados (setlist.fm)

Por defecto solo se ven conciertos futuros. El botón **"Ver conciertos pasados"** cambia a un modo
que busca el historial del artista que tengas escrito en el buscador (o el que pulses como chip),
con filtro por año y setlist completo expandible por concierto.

**Requiere una API key gratuita** de [api.setlist.fm](https://api.setlist.fm/docs/1.0/index.html)
(solicitud manual, uso no comercial). Ponla en `js/app.js`:
```javascript
var SETLISTFM_API_KEY = 'tu-key-aquí';
```

### ⚠️ Limitación real: CORS

La API de setlist.fm **no admite peticiones directas desde el navegador** — a diferencia de
Ticketmaster, no manda las cabeceras `Access-Control-Allow-Origin` necesarias. Si lo intentas tal
cual, verás un error de CORS en la consola y la app te avisará con un toast y una nota explicándolo,
en vez de fallar en silencio.

**Opciones para que funcione de verdad:**

1. **Proxy propio (recomendado)** — dado que ya trabajas con Azure Functions, un proxy mínimo es
   poca cosa. Ejemplo en C#:

   ```csharp
   [Function("SetlistProxy")]
   public async Task<HttpResponseData> Run(
       [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "proxy")] HttpRequestData req)
   {
       var target = System.Web.HttpUtility.ParseQueryString(req.Url.Query).Get("url");
       var client = _httpClientFactory.CreateClient();
       client.DefaultRequestHeaders.Add("x-api-key", Environment.GetEnvironmentVariable("SETLISTFM_KEY"));
       client.DefaultRequestHeaders.Add("Accept", "application/json");

       var upstream = await client.GetAsync(target);
       var body = await upstream.Content.ReadAsStringAsync();

       var res = req.CreateResponse(System.Net.HttpStatusCode.OK);
       res.Headers.Add("Access-Control-Allow-Origin", "*");
       res.Headers.Add("Content-Type", "application/json");
       await res.WriteStringAsync(body);
       return res;
   }
   ```

   Despliega esto y pon la URL (`https://tu-function.azurewebsites.net/api/proxy?url=`) en
   `js/app.js`:
   ```javascript
   var CORS_PROXY_URL = 'https://tu-function.azurewebsites.net/api/proxy?url=';
   ```

2. **Proxy CORS público** (`corsproxy.io` y similares) — funciona para probar rápido, pero
   **no lo uses más allá de una prueba personal**: no controlas ese servidor, tu API key pasa por
   él, y pueden caerse o cambiar de comportamiento sin aviso.

3. **No configurar nada** — la app sigue funcionando perfectamente para conciertos futuros
   (Ticketmaster), solo el botón de "conciertos pasados" no traerá datos y te lo dirá con claridad.

### Atribución

Los datos de setlists son de [setlist.fm](https://www.setlist.fm/), enlazados desde cada ficha de
detalle ("Ver en setlist.fm"). Sujeto también a sus términos de uso, no comercial.

## Restringir acceso (Google Sign-In)

`index.html` incluye una pantalla de acceso opcional con "Iniciar sesión con Google" que
solo deja pasar a los emails que tú decidas. **Por defecto está desactivada** (deja pasar
a cualquiera) hasta que configures la lista de emails.

⚠️ **Es un filtro blando, no seguridad real.** Como no hay servidor, el email se lee del
token de Google sin verificar su firma — eso requeriría un backend. Sirve como disuasorio
para uso personal/familiar, no como barrera de seguridad de verdad. Si alguna vez necesitas
seguridad real, la solución sería verificar el JWT server-side (una Azure Function, por
ejemplo), igual que con el proxy de setlist.fm.

### Configuración

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto
   (o usa uno existente) → **APIs & Services → OAuth consent screen** (tipo "External",
   modo "Testing" es suficiente para uso personal, no hace falta publicarla).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → tipo
   **Web application**.
3. En **Authorized JavaScript origins**, añade el dominio donde publiques la app, por ejemplo:
   ```
   https://wolologger.github.io
   http://127.0.0.1:8080
   ```
   (para pruebas en local). No hace falta configurar Redirect URIs — el botón de Google
   usa un flujo distinto al de Spotify (postMessage/FedCM, no redirect de página completa).
4. Copia el **Client ID** y pégalo en `js/app.js`, al principio del archivo:
   ```javascript
   var GOOGLE_CLIENT_ID = 'TU_CLIENT_ID.apps.googleusercontent.com';
   ```
5. Añade los emails permitidos, justo debajo:
   ```javascript
   var EMAILS_PERMITIDOS = [
     'tu-email@gmail.com',
     'otra-persona@gmail.com'
   ];
   ```
6. Sube los cambios. La próxima vez que alguien entre en `index.html`, verá la pantalla
   de acceso hasta iniciar sesión con un email de esa lista.

`demo.html` no lleva esta pantalla — no tiene coste ni datos reales, así que se deja abierta.

## Convertir en APK (PWABuilder)

El proyecto ya lleva todo lo necesario para ser una PWA instalable: `manifest.json`, iconos en
todos los tamaños estándar (48 a 512px, incluida la variante `maskable` para Android),
`favicon.ico`, capturas de pantalla para el listado de instalación, y un `sw.js` mínimo que
cachea el app shell (HTML/CSS/JS/iconos) pero **nunca** las respuestas de Spotify/Ticketmaster/
setlist.fm — esas siempre van a red, porque son datos que cambian constantemente.

### Pasos

1. **Sube el proyecto tal cual a GitHub Pages** (o cualquier hosting HTTPS — PWABuilder exige
   HTTPS, no vale `http://`). Con GitHub Pages: Settings → Pages → Deploy from branch → `main` → `/ (root)`.
2. Verifica manualmente que estas URLs cargan sin 404 antes de continuar (GitHub Pages distingue
   mayúsculas/minúsculas en las rutas, a diferencia de Windows en local — es la causa más típica
   de que PWABuilder no valide el manifest):
   - `https://tu-usuario.github.io/findshow/manifest.json`
   - `https://tu-usuario.github.io/findshow/icons/icon-512.png`
   - `https://tu-usuario.github.io/findshow/sw.js`
3. Ve a [pwabuilder.com](https://www.pwabuilder.com), pega la URL de `index.html` publicada.
4. PWABuilder analiza el manifest y el service worker automáticamente — con lo que ya incluye este
   proyecto debería dar el check verde directamente en "Manifest" y "Service Worker" sin tener
   que tocar nada más.
5. Pestaña **Android** → genera el paquete (APK o AAB). Puedes firmarlo con una key propia o dejar
   que PWABuilder genere una de prueba.

### Notas

- El `short_name` ("FindShow") es el que aparece bajo el icono en el launcher de Android — ya está
  dentro del límite de 12 caracteres que recomienda Android para que no se corte.
- Los iconos `maskable` llevan más margen interior a propósito: Android recorta el icono en círculo,
  cuadrado redondeado, etc. según el launcher del fabricante, y si el diseño llega hasta el borde
  se corta feo. Ya están generados con la zona segura correcta.
- Si cambias el dominio o la ruta donde publiques el proyecto, no hace falta tocar nada del
  manifest — todos los `src` de iconos y `start_url` son relativos.

## Stack

Vanilla JS (sin frameworks, sin build step), CSS con variables nativas,
Google Fonts (Oswald / JetBrains Mono / Inter).

## Changelog

### v1.5.0 — fix importante
- **Bug real corregido**: `sw.js` tenía una condición de carrera al clonar la `Response`
  (`cache.put(..., networkResponse.clone())`) que podía lanzar
  `"Failed to execute 'clone' on 'Response': Response body is already used"` y dejaba
  la caché sin actualizar nunca. Resultado: el navegador seguía sirviendo un `app.js`
  viejo (con código de las tabs ya eliminadas) que casaba al arrancar — y como el error
  no estaba controlado, todo el código posterior en ese archivo, incluida la conexión
  del botón "Conectar con Spotify", nunca llegaba a ejecutarse.
- Estrategia del service worker cambiada a **network-first** (más simple, sin la
  condición de carrera del bug anterior).
- Las páginas detectan una versión nueva del service worker con el evento estándar
  `controllerchange` y se recargan solas una vez (con aviso por toast).
- **Toasts para cualquier error de JS no controlado** (`window.onerror` +
  `unhandledrejection`), en vez de fallar en silencio y solo verse en consola.
- ⚠️ **Nota operativa**: a partir de ahora, cada vez que cambies HTML/CSS/JS del app
  shell, sube el número de `CACHE_NAME` en `sw.js` — si no, el navegador puede seguir
  sirviendo versiones cacheadas viejas indefinidamente, como pasó aquí.

### v1.4.0
- Eliminado "Minutos escuchados" (subida de historial extendido) — no aportaba al
  propósito principal de la app
- Quitadas las tabs: al quedar un único panel (Conciertos), el contenido va directo,
  sin selector de pestañas

### v1.3.0
- Eliminado el panel de configuración con campos de API keys visibles en pantalla
- Las claves (Spotify, Ticketmaster, setlist.fm, proxy CORS) se editan ahora como
  constantes al principio de `js/app.js`, igual que `GOOGLE_CLIENT_ID`/`EMAILS_PERMITIDOS`
- El login de Spotify queda reducido a un único botón, sin campos técnicos visibles

### v1.2.0
- **Cambio de arquitectura**: la búsqueda directa por artista y/o ciudad pasa a ser la
  acción principal, sin necesitar Spotify. Spotify pasa a ser un extra opcional
  (accesos rápidos + búsqueda bulk de artistas seguidos)
- Caché client-side de búsquedas en Ticketmaster (20 min) — evita repetir llamadas idénticas
- Pantalla de acceso opcional con Google Sign-In (filtro blando por lista de emails)
- El nombre del artista en cada resultado ahora viene del propio evento de Ticketmaster
  (`_embedded.attractions`), no de la lista de seguidos — más preciso en búsquedas por ciudad

### v1.1.0
- Rename del proyecto: GIRA → **FindShow**
- PWA completa: `manifest.json`, iconos en todos los tamaños (incluida variante maskable),
  favicon, capturas de pantalla, y service worker con caché de app shell (sin cachear nunca las APIs)
- Lista para empaquetar como APK/AAB vía PWABuilder — ver sección "Convertir en APK"

### v1.0.0
- Login Spotify (PKCE), artistas seguidos, búsqueda en Ticketmaster
- Filtro geográfico por radio (Haversine) desde Cantabria
- Vistas lista/calendario, orden y agrupación (fecha/artista/distancia)
- Separación en archivos css/js, estructura de proyecto
- Chips de artista clicables como filtro rápido (multi-selección, combinable con el buscador)
- Diseño responsive completo (móvil), transiciones de página/pestaña, llamadas paralelas y spinners
- Footer con atribución a Ticketmaster Discovery API / Spotify Web API y aviso de privacidad
- Toasts para feedback (conexión, resultados de búsqueda, errores, copiar enlace)
- Modal de detalle al pinchar en un concierto (fecha completa, dirección, distancia, precio si está disponible)
- Conciertos pasados con setlist completo y filtro por año (setlist.fm), con aviso claro de la limitación de CORS de esa API

## Licencias y atribución de datos

- **Ticketmaster**: los datos de conciertos vienen de la [Ticketmaster Discovery API](https://developer.ticketmaster.com). El uso está sujeto a los [Términos de Uso de Ticketmaster](https://developer.ticketmaster.com/support/terms-of-use/). Puntos relevantes que este proyecto cumple:
  - No se cachea ni almacena el contenido de eventos más allá de la sesión del navegador (nada se persiste en servidor ni en disco); los resultados se piden de nuevo cada vez que se pulsa "Buscar conciertos".
  - Si el titular de un evento pide la retirada de su contenido, hay que quitarlo en 24h — como esto es una app 100% cliente sin backend ni caché propia, basta con dejar de mostrar ese evento (no requiere borrar nada en servidor, porque no existe).
  - Se declara aquí y en el footer de la app cómo se usan los datos (obligación de transparencia de los términos).
  - FindShow no vende, redistribuye ni deriva ingresos de los datos de Ticketmaster — es un proyecto personal sin ánimo de lucro.
- **Spotify**: los artistas seguidos vienen de la [Spotify Web API](https://developer.spotify.com/documentation/web-api), sujeta a las [Developer Policy](https://developer.spotify.com/policy) de Spotify.
- Ninguna marca (Ticketmaster, Live Nation, Spotify) patrocina, avala ni está afiliada a este proyecto.
- Ver el footer de `index.html` / `demo.html` para el aviso de atribución visible al usuario.

## Licencia

MIT — ver [LICENSE](LICENSE)
