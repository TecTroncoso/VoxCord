# Hoja de ruta: cliente nativo (escritorio / Android)

Documento de transición. Recoge **qué se mejora de verdad** al salir del navegador,
qué herramientas existen y el presupuesto de latencia esperado. Escrito tras
agotar las optimizaciones posibles de la versión web (octubre 2026).

Estado de la web (para referencia): VoxCord en navegador, ~95–140 ms
boca-a-oreja (misma región / inter-continente). Backend vigente:
Next.js + Turso + LiveKit Cloud. **El cliente nativo reutiliza este backend
sin tocar nada** (mismos tokens, mismas salas, mismo usuario).

---

## 1. Por qué el navegador tiene un suelo (~50 ms irreducibles)

| Etapa | Coste en navegador | Controlable desde JS |
|---|---|---|
| Captura + AEC (Chrome) | ~10–15 ms | No |
| Frame Opus 20 ms + lookahead del codificador | ~24 ms | Solo con SDP munging (frágil) |
| NetEQ / jitter buffer | ~60–160 ms | Sí → ya controlado (0–40 ms) |
| Render de salida (pila de audio del SO vía navegador) | ~15–25 ms | No |
| **Suma irreducible** | **~50 ms** | — |

## 2. Qué desbloquea el cliente nativo y cuánto gana

| Mejora | Ahorro típico | Herramienta |
|---|---|---|
| **Zero jitter buffer mode**: frames se reproducen nada más decodificar | ~20–40 ms | LiveKit **Rust SDK**: `livekit::webrtc::enable_zero_playout_delay()` |
| **Ruta de audio nativa** (WASAPI exclusivo / AMMixer en macOS / AAudio en Android) | ~15–25 ms | SDK nativo por plataforma |
| **Opus ptime 10 ms** (frames de 10 ms) nativo, sin SDP munging | ~10–15 ms | SDK Rust / opciones de pista |
| **Codec completo de control** (`cbr`, `minptime`, `useinbandfec`) | 2–5 ms | SDP nativo libre |
| **Hotkeys globales (push-to-talk)**, incluso sin foco | 0 de latencia, gran UX | API del SO |
| **Overlay en juegos**, bandeja del sistema, notificaciones | UX | API del SO |
| **Hardware encode** de pantalla, captura DXGI nativa (Windows) | ~5–10 ms + menos CPU | SDK Rust |
| **DSCP tagging** de paquetes de voz (prioridad en routers) | previene degradación | sockets nativos |
| **Sin puertas de autoplay** del navegador | join instantáneo | — |

**Presupuesto esperado con todo aplicado (misma región, fibra):**
**~60–90 ms boca-a-oreja** — clase TeamSpeak. Con tu pareja LATAM↔España,
el suelo queda en ~80–110 ms (la mayor parte es la física transatlántica, que sí es física).

## 3. Mito a evitar: Electron ≠ ganancia de latencia

Electron corre WebRTC **sobre Chromium por dentro**: hereda la pila de audio
del navegador, su NetEQ y sus puertas. Con Electron ganas **integración
de SO** (hotkeys, bandeja, auto-arranque, instalador, auto-update) **pero
no tiempo de voz**. La ganancia de latencia exige salir de la pila de
audio del navegador.

## 4. Caminos recomendados (orden de valor)

### Opción A — Tauri / Rust nativo (recomendada para escritorio)
- UI en webview ligera + **LiveKit Rust SDK** para los media:
  voz con zero jitter + ptime 10 ms + audio nativo.
- Es el único camino documentado que permite los dos primeros ítems de arriba.
- Coste: mantener capa Rust para conexión y render de audio; el resto
  (auth, chat por data channels, Turso) puede reutilizarse igual.
- Punto de partida: `https://github.com/livekit/rust-sdks` + docs Robotics/Performance.

### Opción B — Android (LiveKit Android SDK)
- AAudio/Oboe por debajo: mejor pila de audio que cualquier navegador en móvil,
  eco de hardware (AEC de los fabricantes) y gestión de auditools nativa.
- Ideal si el equipo juega desde el móvil; no sustituye al escritorio.

### Opción C — Electron (si la prioridad es UX, no latencia)
- Instalación, perfil persistente, push-to-talk global, overlay, auto-login.
- Voz: igual que la web. Útil si dolores son de integración, no de delay.

## 5. Checklist de verificación cuando lo implementes

1. Medir **glass-to-glass** / boca-a-oreja de verdad: captura de sonido con otro
   dispositivo grabando clics o loop-back, o stats del SDK (roundTripTime,
   playout stats expuestas por Rust SDK).
2. Confirmar zero jitter: la cabecera/stats deben mostrar playout ~0–10 ms.
3. Confirmar ptime 10 ms: paquetes/s de audio ≈ 100 (vs ~50 con 20 ms).
4. Comparar idle CPU: nativo debería bajarlo bastante frente a navegador.
5. Probar eco al compartir pestaña con y sin `restrictOwnAudio` (hoy solo Chromium).

## 6. Riesgo y alcance

- El backend actual no cambia; el nativo es **un cliente más**.
- El mayor coste no es la voz: es mantener idéntica la experiencia UI
  (canales, chat, screenshare, presets) en una app nativa. Estrategia sana:
  cliente nativo mínimo = "voz siempre abierta + overlay", y la web sigue
  siendo la ventana de gestión/chat.

## Fuentes

- LiveKit Robotics / low-latency & zero jitter buffer:
  https://docs.livekit.io/robotics/media/performance/low-latency/
- Playout delay hints (room-level):
  https://docs.livekit.io/robotics/media/performance/low-latency/playout-delay/
- `MediaTrackConstraints.latency` / `restrictOwnAudio` (MDN)
- IETF MoQ WG (borrador -22, oct 2026): futuro para latencia sub-RTT a escala.
