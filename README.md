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
│   ├── page.tsx                    # Landing: usuario + lista/crear servidores
│   ├── s/[serverId]/page.tsx       # Redirige al primer canal de texto
│   ├── s/[serverId]/[channelId]/   # Shell de 3 columnas (texto o voz)
│   └── api/
│       ├── users/route.ts          # find-or-create usuario
│       ├── servers/route.ts        # listar/crear servidores (+ canales default)
│       ├── servers/[serverId]/channels/route.ts
│       ├── channels/[channelId]/messages/route.ts   # historial + envío
│       ├── channels/[channelId]/stream/route.ts     # SSE
│       └── livekit/token/route.ts  # JWT de acceso a salas
├── components/
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

1. **`jitterBufferTarget` en los receivers de audio** (W3C WebRTC REC 2025): el jitter buffer adaptativo del navegador (NetEQ) es la partida más grande del retraso (~60–160 ms por defecto). VoxCord lo fija a **40 ms** en cada audio suscrito — el rango en el que opera TeamSpeak. Con RED/FEC activo, la pérdida ocasional se recupera sin cortes. Cambiable en `src/components/VoiceChannel.tsx` → `AUDIO_JITTER_TARGET_MS` (0–20 ms solo en LAN/fibra estable). Fallback automático a `playoutDelayHint` (segundos) en navegadores antiguos.
2. **`room.prepareConnection()` + token prefetch**: al visitar el canal de voz se pre-negocia ICE/DTLS, así que "Unirse" conecta casi al instante.
3. **Medidor en vivo**: la cabecera de la sala muestra **RTT real (getStats → candidate-pair) y jitter del audio entrante** cada 2 s — puedes verificar la mejora en lugar de creerla. Referencias: <80 ms verde, 80–150 amarillo, >150 rojo.
4. Preset *Voz*: mono + **DTX** (no envía paquetes en silencio) + **RED** (paquetes duplicados = tolerancia a pérdida sin retransmisión) + EC/NS/AGC.

**Aplicado en el servidor self-host** (`deploy/livekit.low-latency.yaml`, claves del `config-sample.yaml` oficial):

- `rtc.udp_port: 7882-7892` (UDP mux abierto en firewall: evita el salto TURN/TCP).
- `rtc.packet_buffer_size_audio: 100` (default 200 → menos cola en el SFU).
- `rtc.batch_io` con `max_flush_interval: 1ms` (flush de paquetes casi inmediato).
- `audio.active_red_encoding: true` (RED/FEC downtrack hacia los oyentes).
- `room.playout_delay min 60 / max 500` (default 100/2000: techo de buffer más bajo para salas de voz).
- TURN integrado solo como fallback.

Tanto en Cloud como self-host: **elige la región más cercana** (visible en la cabecera de la sala), cable > Wi-Fi, y sin VPN.

**Investigado y descartado a propósito:**

- *Rutar el audio remoto por WebAudio con `latencyHint: 'interactive'`*: `latencyHint` solo aplica a grafos WebAudio; el path nativo `<audio>` + NetEQ ya es el más corto en Chrome. Meter WebAudio en medio **añade** un quantum de render (~3–10 ms) → contraproducente.
- *`ptime: 10` (frames Opus de 10 ms)*: requiere SDP munging (modificar el SDP a mano), API no estándar y frágil; ahorra ~10 ms de packetización. No implementado: si quieres experimentar, es el siguiente paso con mejor ratio riesgo/beneficio.
- *Media over QUIC (WebTransport/MoQ)*: es el futuro para latencia sub-RTT a escala (Twitch/Meta lo prueban), pero en 2026 no hay stack de voz completo estable en navegadores. Vigilar: la ficha es "cuando madure MoQ, LiveKit ya está en ese WG".

**Latencia esperada con todo aplicado** (misma región, fibra): **~35–70 ms boca-a-oreja** ≈ TeamSpeak.

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

## Autenticación

- **Registro / login** con usuario + contraseña. La contraseña se guarda como **scrypt + salt** (`node:crypto`, sin dependencias), nunca en claro.
- **Sesión**: JWT HS256 en cookie **httpOnly** (`voxcord_session`, 7 días, `SameSite=Lax`, `Secure` en producción). Firmada con `AUTH_SECRET` (o derivado de `TURSO_AUTH_TOKEN` como fallback estable; pon `AUTH_SECRET` explícito en producción).
- Las rutas que escriben (`POST /api/servers`, `channels`, `messages`, `livekit/token`) exigen sesión; el autor de los mensajes se toma del JWT, no del cliente.
- Cuentas creadas antes de esta versión (sin contraseña): registrarse con el mismo nombre "reclama" la cuenta poniéndole contraseña.

## Limitaciones conocidas del MVP

- **Auth**: usuario + contraseña con sesión JWT (7 días). Siguiente paso natural: OAuth, verificación de email, 2FA y membresías por servidor con roles.
- **Chat SSE**: solo se usa como fallback sin LiveKit; con más de una instancia web el fallback necesitaría Redis/Turso CDC (el path principal, LiveKit data channels, ya es multi-instancia).
- Sin E2EE (LiveKit soporta cifrado extremo a extremo con `e2ee`, fuera del MVP).
- Sin listado de participantes de voz en el sidebar (requeriría webhooks de LiveKit para presencia global).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server (Webpack; Turbopack no soporta aún `@libsql/client`) |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción |
