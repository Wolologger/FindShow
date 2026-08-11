# FindShow

Cruza tus artistas seguidos en Spotify con conciertos reales en España (Ticketmaster),
filtrados por distancia geográfica desde Cantabria. Incluye cálculo de minutos
escuchados a partir del historial extendido de Spotify. 100% cliente, sin backend.

## Funcionalidades

- Login con Spotify (OAuth 2.0 Authorization Code + PKCE, sin client secret)
- Lectura de artistas seguidos (`GET /me/following?type=artist`)
- Búsqueda de conciertos vía Ticketmaster Discovery API (`countryCode=ES`)
- Filtro geográfico por radio (fórmula de Haversine) desde Santander
- Buscador por nombre de artista
- Vistas Lista / Calendario
- Ordenar por Fecha / Artista / Distancia
- Agrupar por Artista / Mes
- Conciertos pasados con setlist completo, filtrable por año (setlist.fm)
- Cálculo de minutos escuchados desde el historial extendido de Spotify
  (procesado 100% en el navegador, nada se sube a ningún sitio)

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
│   ├── app.js        # lógica de index.html (OAuth, fetch, render)
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

1. Crea una app en [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
   Desde febrero de 2026 hace falta cuenta Spotify **Premium** para registrar apps.
   Activa el scope `user-follow-read` y marca solo **Web API**.
2. Consigue una API key gratuita en [developer.ticketmaster.com](https://developer.ticketmaster.com).
3. Sirve el proyecto por HTTP — no funciona con `file://`:
   ```bash
   python3 -m http.server 8080
   ```
4. Registra en el dashboard de Spotify, como Redirect URI, la misma URL exacta
   donde sirvas `index.html`. Desde 2025 Spotify exige loopback explícito:
   `http://127.0.0.1:8080/index.html` — `localhost` ya no está permitido.
5. Abre esa URL, pega tus credenciales en el panel de configuración desplegable
   y pulsa "Conectar con Spotify".

## Conciertos pasados (setlist.fm)

Por defecto solo se ven conciertos futuros. El botón **"Ver conciertos pasados"** cambia a un modo
que busca el historial de los artistas que tengas seleccionados (chips activos) en
[setlist.fm](https://www.setlist.fm/), con filtro por año y setlist completo expandible por concierto.

**Requiere una API key gratuita** de [api.setlist.fm](https://api.setlist.fm/docs/1.0/index.html)
(solicitud manual, uso no comercial).

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

   Despliega esto, pega la URL (`https://tu-function.azurewebsites.net/api/proxy?url=`) en el campo
   "Proxy CORS" del panel de configuración, y la app lo usará automáticamente.

2. **Proxy CORS público** (`corsproxy.io` y similares) — funciona para probar rápido, pero
   **no lo uses más allá de una prueba personal**: no controlas ese servidor, tu API key pasa por
   él, y pueden caerse o cambiar de comportamiento sin aviso.

3. **No configurar nada** — la app sigue funcionando perfectamente para conciertos futuros
   (Ticketmaster), solo el botón de "conciertos pasados" no traerá datos y te lo dirá con claridad.

### Atribución

Los datos de setlists son de [setlist.fm](https://www.setlist.fm/), enlazados desde cada ficha de
detalle ("Ver en setlist.fm"). Sujeto también a sus términos de uso, no comercial.

## Minutos escuchados

Spotify no expone esto por API pública. Pide tu historial de streaming extendido
desde [spotify.com/account/privacy](https://www.spotify.com/es/account/privacy/)
(tarda hasta 30 días) y sube los `.json` resultantes en la pestaña correspondiente.

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

### v1.0.0
- Login Spotify (PKCE), artistas seguidos, búsqueda en Ticketmaster
- Filtro geográfico por radio (Haversine) desde Cantabria
- Vistas lista/calendario, orden y agrupación (fecha/artista/distancia)
- Cálculo de minutos escuchados desde historial extendido (local, sin subir datos)
- Separación en archivos css/js, estructura de proyecto
- Chips de artista clicables como filtro rápido (multi-selección, combinable con el buscador)
- Diseño responsive completo (móvil), transiciones de página/pestaña, llamadas paralelas y spinners
- Footer con atribución a Ticketmaster Discovery API / Spotify Web API y aviso de privacidad
- Toasts para feedback (conexión, resultados de búsqueda, errores, copiar enlace)
- Modal de detalle al pinchar en un concierto (fecha completa, dirección, distancia, precio si está disponible)
- Conciertos pasados con setlist completo y filtro por año (setlist.fm), con aviso claro de la limitación de CORS de esa API

### v1.1.0
- Rename del proyecto: GIRA → **FindShow**
- PWA completa: `manifest.json`, iconos en todos los tamaños (incluida variante maskable),
  favicon, capturas de pantalla, y service worker con caché de app shell (sin cachear nunca las APIs)
- Lista para empaquetar como APK/AAB vía PWABuilder — ver sección "Convertir en APK"

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
