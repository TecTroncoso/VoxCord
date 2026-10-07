# VoxCord

MVP estilo Discord con foco en dos cosas:

1. **Voz de baja latencia** (tipo TeamSpeak) — WebRTC con codec **Opus** a través de un SFU (**LiveKit**), con DTX + RED activados, cancelación de eco, supresión de ruido y un modo **Música (estéreo)** sin filtros.
2. **Pantalla compartida de máxima calidad** — hasta **4K/60 fps** con **VP9 (SVC)**, `maintain-resolution` (nitidez de texto) y bitrates configurables por preset.

Persistencia en **Turso** (libSQL): usuarios, servidores, canales y mensajes. El chat de texto es en tiempo real vía **SSE** y queda persistido en Turso.

## Stack

| Pieza | Tecnología | Por qué |
|---|---|---|
| Voz / pantalla / cámara | LiveKit (SFU WebRTC) | Opus low-latency, SVC VP9, simulcast, TURN incluido en Cloud |
| Base de datos | Turso (`@libsql/client`, driver `/web` automático en serverless) | SQLite distribuido edge, gratis y rápido |
| App | Next.js 15 + React 19 + Tailwind v4 | SSR/API routes en un solo proceso |
| Chat tiempo real | **LiveKit data channels** (principal) + fallback SSE | Servidor 100% stateless → Vercel/Render sin consumir memoria; chat a latencia de voz |

## Estructura

```
src/
├── app/
│   ├── page.tsx                    # Hub de servidores (redirige a /login sin sesión)
│   ├── login/page.tsx              # Iniciar sesión
│   ├── register/page.tsx           # Crear cuenta
│   ├── s/[serverId]/page.tsx       # Redirige al primer canal de texto
│   ├── s/[serverId]/[channelId]/   # Shell de 3 columnas (texto o voz)
│   └── api/
│       ├── auth/register|login|logout|me/route.ts
│       ├── servers/route.ts        # listar/crear servidores (+ canales default)
│       ├── servers/[serverId]/channels/route.ts
│       ├── channels/[channelId]/messages/route.ts   # historial + envío
│       ├── channels/[channelId]/stream/route.ts     # SSE
│       └── livekit/token/route.ts  # JWT de acceso a salas
├── components/
│   ├── AuthShell.tsx               # Hero + card + campos (login/register)
│   ├── ServerRail.tsx / ChannelSidebar.tsx / ChatArea.tsx / Avatar.tsx
│   ├── ServerShell.tsx             # layout de 3 columnas
│   └── VoiceChannel.tsx            # sala de voz + pantalla compartida
└── lib/
    ├── db.ts                       # cliente Turso + esquema idempotente
    ├── hub.ts                      # pub/sub en memoria para SSE
    ├── client.ts                   # fetch helpers + sesión local
    └── types.ts
```

## Puesta en marcha

### 1. Turso (base de datos)

```powershell
# Instalar CLI (Windows)
winget install tursodatabase.turso-cli   # o: scoop install turso

turso auth signup            # o: turso auth login
turso db create voxcord
turso db show voxcord --url # -> TURSO_DATABASE_URL (libsql://...)
turso db tokens create voxcord   # -> TURSO_AUTH_TOKEN
```

> Sin credenciales, la app funciona en modo local con `file:./dev.db` (SQLite local) para que puedas probar la UI. El esquema se crea solo al arrancar (idempotente).

### 2. LiveKit (voz + pantalla)

Opción A — **LiveKit Cloud** (recomendada, incluye TURN y multi-región):
- Crea un proyecto gratis en <https://cloud.livekit.io> y copia `URL`, `API Key` y `API Secret` desde *Settings → Keys*.

Opción B — **Self-hosted**:
```powershell
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp `
  -e LIVEKIT_KEYS="devkey: secretdevsecretdevsecretdevsecretdev" `
  livekit/livekit-server --dev
# LIVEKIT_URL=ws://localhost:7880  (ojo: ws://, no wss://)
```

### 3. Configurar y arrancar

```powershell
cp .env.example .env.local   # rellena las variables
npm install
npm run dev
```

Abre <http://localhost:3000>. Sirve por **HTTPS** (p. ej. `cloudflared tunnel` / `ngrok`) para usar micrófono y pantalla fuera de localhost: los navegadores exigen contexto seguro.

## Calidad y latencia (qué hace cada cosa)

- **Opus + DTX + RED**: silencio sin paquetes y redundancia FEC ante pérdida → audio estable con poco jitter. En modo *Voz*: 1 canal con EC/NS/AGC; en modo *Música*: estéreo 48 kHz sin procesado.
- **VP9 SVC** en pantalla compartida: capas temporales/espaciales, mejor compresión que VP8 a igual bitrate; `backupCodec` automático (VP8) si algún cliente no soporta VP9.
- **Presets de pantalla**: 720p30 / 1080p30 / 1080p60 / 2K60 / 4K60 con bitrates de 2.5 a 20 Mbps y `degradationPreference: maintain-resolution` (prioriza nitidez sobre fps, ideal para leer texto/código). `contentHint: 'detail'` mejora texto; `'motion'` en los presets de juego.
- **`adaptiveStream` + `dynacast`**: los vídeos no visibles se pausan → más ancho de banda para la pantalla compartida y la voz.
- **Región del servidor** visible en la cabecera de la sala (LiveKit Cloud elige la más cercana; menor RTT = menos delay).

### Para exprimir la latencia a nivel TeamSpeak

**Aplicado en el cliente (ya en código):**

1. **`jitterBufferTarget` en los receivers de audio** (W3C WebRTC REC 2025): el jitter buffer adaptativo del navegador (NetEQ) es la partida más grande del retraso (~60–160 ms por defecto). VoxCord lo controla por canal de voz con un selector: **Máximo 0 ms** / Ultra 20 ms / Bajo 40 ms / Equilibrado 80 ms / **Auto** (ver punto 5). Con RED/FEC activo, la pérdida ocasional se recupera sin cortes. Constante en `src/components/VoiceChannel.tsx`; fallback automático a `playoutDelayHint` (segundos) en navegadores antiguos. El nivel 0 ms solo para líneas impecable (jitter <3 ms medido): si oyes chasquidos con ráfagas, vuelve a `Auto`.
2. **`room.prepareConnection()` + token prefetch**: al visitar el canal de voz se pre-negocia ICE/DTLS, así que "Unirse" conecta casi al instante.
3. **Auto-join de un clic**: los canales de voz del sidebar enlazan con `?join=1`, así que un solo clic ya entra a la sala (pre-token + pre-ICE); no hay botón intermedio.
4. **Auto-mic** (checkbox, por defecto activo): el micrófono se publica en cuanto la conexión está lista, sin esperar un clic extra → la primera palabra no tiene retardo de "|".
5. **Jitter adaptativo ("Auto", por defecto)**: el badge de red ya mide el jitter real (`inbound-rtp`); con línea limpia (≤4 ms) el objetivo baja solo a 20 ms y con ráfagas sube a 40–80 ms. La cabecera muestra el valor activo (`buffer X ms`).
6. **Latencia de captura**: los presets de micrófono piden `latency: 0` (`MediaTrackConstraints.latency`, MDN) para que el navegador elija el modo de captura de menor latencia. Los navegadores que no lo soportan lo ignoran sin error.
7. **Medidor en vivo**: la cabecera de la sala muestra **RTT real (getStats → candidate-pair) y jitter del audio entrante** cada 2 s — puedes verificar la mejora en lugar de creerla. Referencias: <80 ms verde, 80–150 amarillo, >150 rojo. Ojo: el RTT es tu tramo hasta **tu** SFU; si los participantes caen en regiones distintas (p. ej. Brazil y Eu-West), el audio cruza el enlace inter-región y eso no aparece en el número.
8. Preset *Voz*: mono + **DTX** (no envía paquetes en silencio) + **RED** (tolerancia a pérdida sin retransmisión) + EC/NS/AGC. Aclaración de coste medido: el NS integrado de WebRTC corre dentro del frame de 10 ms del pipeline de audio (APM) y **no suma latencia (~0 ms)**; lo que sí suma +10–20 ms son los filtros IA con ventana de análisis (Krisp). Por eso el NS integrado sí está ON también en el preset de baja latencia.
9. Preset *Voz HD*: además del NS integrado de WebRTC, activa desde la barra de controles el **filtro IA de ruido (Krisp)**, que se aplica en un Web Worker antes de publicar (+10–20 ms de captura). Solo disponible con LiveKit Cloud (requiere que el proyecto tenga habilitado Krisp) y solo en el preset HD; el preset de baja latencia nunca lo ofrece. Si el navegador no soporta el SDK de Krisp (Safari < 17.4), el botón queda deshabilitado.

10. **Pantalla**: `suppressLocalAudioPlayback` al compartir pestaña evita el eco del audio de la pestaña compartida, y `restrictOwnAudio` (Chromium) excluye del stream el audio que emite la propia app.

11. **Playout delay por sala** (docs LiveKit *Robotics/Performance*): cada token de canal de voz lleva `roomConfig: { minPlayoutDelay: 0, maxPlayoutDelay: 500 }`. Es un hint room-wide que se aplica cuando se **crea** la sala y que controla cuánto buffer mantienen los suscriptores antes de pintar el **vídeo** — la pantalla compartida se ve casi en tiempo real para quien la mira. Solo vídeo (el audio se controla con `jitterBufferTarget` por receiver) y caveat oficial: puede romper el lip-sync en mala red, deliberadamente.

**Aplicado en el servidor self-host** (`deploy/livekit.low-latency.yaml`, claves del `config-sample.yaml` oficial):

- `rtc.udp_port: 7882-7892` (UDP mux abierto en firewall: evita el salto TURN/TCP).
- `rtc.packet_buffer_size_audio: 100` (default 200 → menos cola en el SFU).
- `rtc.batch_io` con `max_flush_interval: 1ms` (flush de paquetes casi inmediato).
- `audio.active_red_encoding: true` (RED/FEC downtrack hacia los oyentes).
- `room.playout_delay min 60 / max 500` (default 100/2000: techo de buffer más bajo para salas de voz).
- TURN integrado solo como fallback.

Tanto en Cloud como self-host: **elige la región más cercana** (visible en la cabecera de la sala), cable > Wi-Fi, y sin VPN. Con jugadores en continentes distintos, LiveKit Cloud reparte al PoP más cercano de cada uno y puentea entre regiones; si eso te penaliza, fija una región única en *Settings → Region* del proyecto (en self-host: `node_selector kind: regionaware` + `regions` en el YAML).

**Investigado y descartado a propósito:**

- *Rutar el audio remoto por WebAudio con `latencyHint: 'interactive'`*: `latencyHint` solo aplica a grafos WebAudio; el path nativo `<audio>` + NetEQ ya es el más corto en Chrome. Meter WebAudio en medio **añade** un quantum de render (~3–10 ms) → contraproducente.
- *`ptime: 10` (frames Opus de 10 ms)*: requiere SDP munging (modificar el SDP a mano), no hay API estándar para ello y renegociar (al publicar mic/cámara) puede devolverlo a 20 ms. Ahorra ~10 ms de packetización. **No implementado a propósito**; si quieres experimentarlo: parchea `RTCPeerConnection.prototype.createOffer` solo durante `room.connect()` añadiendo `a=ptime:10` y `minptime=10` al fmtp de Opus, y **verifícalo en `getStats`**: `outbound-rtp.framesPerSecond ≈ 100` = ptime 10 ms activo (con 20 ms verás ~50).
- *`RTCRtpScriptTransform` (Baseline 2025)*: es la vía estándar para E2EE y para procesar audio codificado en un worker (fuera del hilo principal). No reduce el buffer, pero es el camino para cifrado extremo a extremo y para filtros de voz sin casts en main thread.
- *Media over QUIC (WebTransport/MoQ)*: el WG de IETF sigue activo con `draft-ietf-moq-transport` en versión 22 (oct 2026) y muchos drafts acompañantes, pero **sigue en estado Internet-Draft**: no hay stack de voz completo y estable en navegadores. Es la vía esperada para latencia sub-RTT a escala; vigilar, no construir todavía.
- **Zero jitter buffer mode** (`enable_zero_playout_delay()`): existe oficialmente en LiveKit pero **solo en el SDK de Rust** (diseñado para teleoperación de robots). No hay equivalente en el navegador — ahí el suelo legal es el que ya aplicamos (`jitterBufferTarget` ≈ 0–40 ms). Esta es una razón de peso para que el futuro cliente nativo (escritorio/Android) sí pueda acercarse de verdad a TeamSpeak: ahí sí existe la API.

**Latencia esperada con todo aplicado** (misma región, fibra): **~95–140 ms boca-a-oreja** (el suelo del navegador: captura AEC ~12 ms + frame Opus ~22 ms + render del OS ~18 ms son flooring fijo). TeamSpeak nativo (~60–100 ms) gana por no pasar por la pila de audio del navegador.

## Deploy gratis

Coste total **$0**: Turso free + LiveKit Cloud free + host Node free.

> **Dato clave:** la latencia de las llamadas **no depende de dónde hostees el Next.js** — la voz/pantalla (y el chat en tiempo real, por data channels) viajan directo entre el navegador y el edge de LiveKit Cloud. El servidor web solo firma tokens y persiste en Turso: **totalmente stateless**, sirve Vercel (serverless), Render, Koyeb o tu PC sin diferencia funcional.

### Opción A — Render (recomendada, la más sencilla)

1. Sube este repo a GitHub.
2. En <https://dashboard.render.com>: **New → Blueprint** → elige el repo (detecta `render.yaml`).
3. Rellena las 5 variables de entorno (las de `.env.example`).
4. Deploy. Render te da HTTPS automático (`https://voxcord-xxxx.onrender.com`).

Aviso: el tier free **duerme tras 15 min sin uso**; la primera visita tarda ~30 s en despertar. Alternativa equivalente: **Koyeb** (nano instance free, sin sleep, regiones FRA/WAS) usando el mismo `Dockerfile`.

### Opción B — VM gratis con control total (mínima latencia absoluta)

**Oracle Cloud Always Free** (VM ARM, gratis para siempre): Docker + Caddy (HTTPS automático). Es el único sitio gratis donde además puedes **auto-alojar el propio LiveKit Server** con UDP abierto (`deploy/livekit.low-latency.yaml`), controlando la región del SFU:

```bash
docker build -t voxcord . && docker run -d -p 3000:3000 --env-file .env voxcord
# LiveKit (si quieres SFU propio):
docker run -d -v $PWD/deploy/livekit.low-latency.yaml:/etc/livekit.yaml \
  -p 7880:7880 -p 7881:7881 -p 7882-7892:7882-7892/udp \
  -e LIVEKIT_KEYS="devkey: secretdevsecretdevsecretdevsecretdev" \
  livekit/livekit-server --config /etc/livekit.yaml
```

### ¿Y Vercel?

**Sí, funciona completo.** La clave es dónde vive cada pieza del chat:

| Pieza del chat | Dónde vive | Notas |
|---|---|---|
| Historial de mensajes | **Turso** (persistencia) | driver `@libsql/client/web` (HTTP puro) automático cuando hay `TURSO_DATABASE_URL` |
| Entrega en tiempo real | **LiveKit data channels** (sala `chat-<id>` por canal, sin A/V) | el navegador conecta directo al edge; la función serverless no mantiene conexiones |
| API routes (login, historial, token) | Vercel serverless | sin estado, duración corta → perfecto |

Es decir: **Vercel no toca ni memoria ni sockets de chat**; solo firma tokens y lee/escribe en Turso. El envío es idempotente por `id` de cliente. Si LiveKit no estuviera configurado, el cliente cae a SSE automáticamente (modo un solo proceso, p. ej. Render/local).

Deploy en Vercel: Import Project → añade las 5 variables de entorno → listo. Aviso: en el tier Hobby las funciones tienen límites de duración/instancias; el diseño stateless lo hace irrelevante para el chat.

### HTTPS obligatorio

Micrófono y compartir pantalla exigen contexto seguro: todas las opciones anteriores dan TLS gratis. En local vale `localhost`.

## Flujo de entrada

1. Sin sesión → `/login` o `/register`.
2. Al autenticar, `/` **entra directamente a la interfaz del servidor**: redirige al último servidor visitado (guardado en `localStorage`) o al primero disponible, y dentro de él al primer canal de texto.
3. Si la cuenta no tiene servidores, `/` muestra el onboarding para crear el primero (con canal de texto y sala de voz ya listos).
4. Dentro de un servidor: rail de servidores con creación rápida, sidebar con buscador y categorías, chat o voz, y rail derecho de **miembros** alimentado por la tabla `server_members` (el creador queda como `owner`; entrar a un servidor te une de forma idempotente).

> La presencia real (quién está conectado a qué canal, no solo quién se ha unido) requiere el data channel de presencia por servidor; los estados "en línea" del rail derecho se añadirán con esa función.tados "en línea" del rail derecho seosingirán con esa función.

## Autenticación

- **Páginas separadas**: `/login` (iniciar sesión) y `/register` (crear cuenta), con el mismo hero y pestañas que saltan entre ambas. Al autenticar se entra directo a la interfaz del servidor (ver *Flujo de entrada*).
- **Registro**: nombre de usuario (2–32), **correo electrónico** (único, con índice parcial en Turso) y contraseña (**mínimo 8 caracteres**), con contador de caracteres y confirmación de contraseña en línea.
- **Login por correo o usuario**: la API acepta cualquiera de los dos como identificador.
- **Contraseñas**: hash **scrypt + salt** (`node:crypto`, sin dependencias), nunca en claro.
- **Sesión**: JWT HS256 en cookie **httpOnly** (`voxcord_session`, `SameSite=Lax`, `Secure` solo bajo HTTPS real). «Mantener sesión iniciada» = cookie persistente de 7 días (`Max-Age=604800`); desmarcado = cookie de sesión, que se cierra al cerrar el navegador. Firmada con `AUTH_SECRET` (o derivado de `TURSO_AUTH_TOKEN`).
- Las rutas que escriben (`POST /api/servers`, `channels`, `messages`, `livekit/token`) exigen sesión; el autor de los mensajes se toma del JWT, no del cliente.
- Cuentas creadas antes de esta versión (sin contraseña ni email): registrarse con el mismo usuario "reclama" la cuenta.

### Pendiente de implementar

- **Login social** (Google / Discord / Steam): los botones están maquetados en el diseño pero **desactivados**; falta OAuth con credenciales de proveedor y Callback API.
- **Recuperación de contraseña** y **verificación de correo**: requieren servicio de envío de emails.
- **Términos de Servicio / Política de Privacidad**: los enlaces del registro son marcadores; faltan los documentos.

## Solución de problemas

### `could not establish signal connection: invalid token` al entrar a un canal de voz

El backend acuña el JWT con `nbf` retrocedido 10 min (tolerante a desfases de reloj), así que este error hoy casi siempre es credenciales. Diagnostica en 5 segundos:

```powershell
npm run check:livekit            # firma un token real y prueba la señalización contra tu servidor LiveKit
npm run check:livekit -- --backdate   # si SOLO este modo pasa: reloj desfasado -> w32tm /resync
```

Causas en orden de probabilidad:

1. **`.env` editado con el servidor arrancado** — Next solo lee `.env` al iniciar: guarda el archivo y reinicia (`Ctrl+C` → `npm run dev`).
2. **API key y secret de proyectos distintos** (o clave revocada/regenerada): copia AMBOS del mismo proyecto en <https://cloud.livekit.io> → *Settings → API Keys*.
3. **Reloj del sistema desfasado** (>10 min): sincroniza Windows (`w32tm /resync` como administrador, o Configuración → Hora e idioma → Sincronizar ahora). El backend tolera hasta 10 min, pero sincronizar es gratis.

## Estado actual y próximos pasos (web)

Lo que ya funciona de punta a punta: registro/login con contraseña, servidores y canales, chat en tiempo real (data channels de LiveKit con fallback SSE), voz con presets de micrófono y métricas de red en vivo, pantalla compartida hasta 4K/60 en VP9, cámara, diagnóstico de latencia (`npm run check:livekit`) y despliegue gratis configurado (Dockerfile/`render.yaml`, Vercel compatible).

Para **terminar la versión web** (en este orden, de mayor valor por esfuerzo):

1. **Membresías e invitaciones por servidor**: tabla de roles (`owner/admin/member`) + enlaces de invitación. Hoy cualquier usuario autenticado puede entrar a cualquier servidor.
2. **Presencia real**: quién está en línea/en qué canal. LiveKit expone presencia de las salas a las que estás conectado; para presencia global hace falta un webhook de LiveKit o presencia en el data channel de un "lobby" por usuario.
3. **Indicador de "escribiendo…"** y reacciones: gratis con los data channels que ya usamos (payload en el topic `chat`).
4. **Búsqueda de mensajes** e historial paginado: `GET /api/channels/[id]/messages` ya acepta `after`/`limit`; falta cursor hacia atrás (`before`) e índice FTS5 en Turso.
5. **Notificaciones**: web push (Service Worker) para mensajes y llamadas entrantes.
6. **E2EE** en voz y chat: `RTCRtpScriptTransform` (Baseline 2025) + la API `e2ee` de LiveKit.
7. **PWA / responsive**: instalable en móvil y con layout adaptado; es lo que marca la diferencia antes de cualquier cliente nativo.
8. **Archivos y reacciones en voz**: subida de archivos (Turso o S3) y reacciones rápidas durante la llamada.

Cliente nativo (escritorio/Android) queda **fuera de alcance hasta cerrar la web**; el objetivo de la web es que cubra el caso de uso completo en el navegador. La hoja de ruta de lo que se puede mejorar ahí (zero jitter buffer, ptime nativo, ruta de audio nativa, y el mito de que Electron no gana latencia) está en **[docs/native-client-roadmap.md](docs/native-client-roadmap.md)**.

## Limitaciones conocidas del MVP

- **Auth**: usuario + contraseña con sesión JWT (7 días). Siguiente paso natural: OAuth, verificación de email y 2FA.
- **Permisos**: sin membresías todavía (ver próximos pasos); cualquier usuario autenticado ve todos los servidores.
- **Chat SSE**: solo se usa como fallback sin LiveKit; con más de una instancia web el fallback necesitaría Redis/Turso CDC (el path principal, LiveKit data channels, ya es multi-instancia).
- Sin E2EE (LiveKit lo soporta con `e2ee`, fuera del MVP).
- Sin listado de participantes de voz en el sidebar (requeriría presencia/webhooks de LiveKit).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server (Webpack; Turbopack no soporta aún `@libsql/client`) |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción |
