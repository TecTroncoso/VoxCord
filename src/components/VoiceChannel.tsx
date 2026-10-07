'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  useIsSpeaking,
  isTrackReference,
  type TrackReference,
} from '@livekit/components-react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import {
  AudioPresets,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type AudioCaptureOptions,
  type RemoteTrack,
  type RoomOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from 'livekit-client';
import { api, avatarHue } from '@/lib/client';
import { Avatar } from '@/components/Avatar';
import type { Channel, User } from '@/lib/types';
import type { CallState } from '@/lib/callState';

/* ------------------------------------------------------------------ */
/* Presets de calidad                                                  */
/* ------------------------------------------------------------------ */

type ScreenPreset = {
  label: string;
  capture: ScreenShareCaptureOptions;
  publish: TrackPublishOptions;
};

const SCREEN_PRESETS: Record<string, ScreenPreset> = {
  p720_30: {
    label: '720p · 30 fps (fluido)',
    capture: { resolution: VideoPresets.h720.resolution, contentHint: 'detail' },
    publish: { screenShareEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 } },
  },
  p1080_30: {
    label: '1080p · 30 fps (nitidez alta)',
    capture: { resolution: VideoPresets.h1080.resolution, contentHint: 'detail' },
    publish: { screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 30 } },
  },
  p1080_60: {
    label: '1080p · 60 fps (juegos)',
    capture: { resolution: VideoPresets.h1080.resolution, contentHint: 'motion' },
    publish: { screenShareEncoding: { maxBitrate: 8_500_000, maxFramerate: 60 } },
  },
  p2k_60: {
    label: '2K · 60 fps',
    capture: { resolution: VideoPresets.h1440.resolution, contentHint: 'motion' },
    publish: { screenShareEncoding: { maxBitrate: 12_000_000, maxFramerate: 60 } },
  },
  p4k_60: {
    label: '4K · 60 fps (máxima calidad)',
    capture: { resolution: VideoPresets.h2160.resolution, contentHint: 'detail' },
    publish: { screenShareEncoding: { maxBitrate: 20_000_000, maxFramerate: 60 } },
  },
};

type MicPreset = {
  label: string;
  capture: AudioCaptureOptions;
  publish: TrackPublishOptions;
};

const MIC_PRESETS: Record<string, MicPreset> = {
  voice: {
    label: 'Voz (baja latencia)',
    // NS integrado corre dentro del frame de 10 ms del APM: latencia ~0 ms.
    // Lo que suma +10-20 ms son los filtros IA (Krisp/RNNoise), por eso solo en HD.
    capture: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      latency: 0,
    },
    publish: { audioPreset: AudioPresets.speech, dtx: true, red: true },
  },
  hd: {
    label: 'Voz HD (+ filtro IA de ruido)',
    // Base WebRTC (gratis); si la cuenta de LiveKit Cloud habilita Krisp, se
    // puede activar el filtro IA adicional desde la barra de controles (solo HD).
    capture: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      latency: 0,
    },
    publish: { audioPreset: AudioPresets.music, dtx: true, red: true },
  },
  music: {
    label: 'Música (estéreo, sin filtros)',
    capture: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
      sampleRate: 48000,
      latency: 0,
    },
    publish: { audioPreset: AudioPresets.musicHighQualityStereo, forceStereo: true, dtx: false, red: true },
  },
};

/* ------------------------------------------------------------------ */
/* Baja latencia: jitter buffer del navegador                          */
/* ------------------------------------------------------------------ */

/**
 * Objetivo del jitter buffer (NetEQ) para audio en ms.
 * Por defecto el navegador adapta entre ~60-160 ms; TeamSpeak ronda ~40-80 ms.
 * RED/FEC ya está activado en la publicación, así que podemos bajar robusto.
 * 20 ms solo en redes LAN/fibra estables (riesgo de cortes con ráfagas).
 */
const DEFAULT_JITTER_TARGET_MS = 40;

const JITTER_OPTIONS: Record<string, { label: string; ms: number; auto?: boolean }> = {
  auto: { label: 'Auto (ajusta según el jitter medido)', ms: DEFAULT_JITTER_TARGET_MS, auto: true },
  max: { label: 'Máximo (0 ms · línea impecable, riesgo de cortes)', ms: 0 },
  ultra: { label: 'Ultra (20 ms · LAN/fibra estable)', ms: 20 },
  low: { label: 'Bajo (40 ms · recomendado)', ms: 40 },
  safe: { label: 'Equilibrado (80 ms · Wi-Fi/móvil)', ms: 80 },
};

/**
 * Objetivo adaptativo a partir del jitter real medido (getStats inbound-rtp).
 * Con línea limpia (jitter ~2 ms) es seguro bajar a 20 ms; con ráfagas,
 * widen up para no cortar audio.
 */
function adaptiveJitterTarget(jitterMs: number | undefined, current: number): number {
  if (jitterMs === undefined) return current;
  if (jitterMs <= 4) return 20; // línea impecable
  if (jitterMs <= 12) return 40;
  if (jitterMs <= 25) return 60;
  return 80; // ráfagas: prioriza estabilidad
}

function tuneAudioReceiver(receiver: RTCRtpReceiver, targetMs: number) {
  try {
    // W3C REC 2025 (Chrome/Edge/Firefox): milisegundos
    if ('jitterBufferTarget' in receiver) {
      receiver.jitterBufferTarget = targetMs;
      return;
    }
    // Nombre heredado (Chrome antiguo / Safari): la pista estaba en segundos
    const legacy = receiver as unknown as Record<string, unknown>;
    if ('playoutDelayHint' in legacy && typeof legacy.playoutDelayHint !== 'function') {
      legacy.playoutDelayHint = targetMs / 1000;
    }
  } catch {
    // navegador sin soporte: se queda con el buffer por defecto
  }
}

/** Aplica el objetivo de jitter a todos los audios remotos suscritos. */
function tuneAllAudioReceivers(room: Room, targetMs: number) {
  for (const p of room.remoteParticipants.values()) {
    for (const pub of p.audioTrackPublications.values()) {
      const receiver = (pub.track as RemoteTrack | null | undefined)?.receiver;
      if (receiver) tuneAudioReceiver(receiver, targetMs);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Iconos                                                              */
/* ------------------------------------------------------------------ */

function Svg({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const MicIcon = ({ off, className }: { off?: boolean; className?: string }) => (
  <Svg className={className}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21.5" />
    {off && <line x1="3" y1="3" x2="21" y2="21" className="text-danger" stroke="currentColor" />}
  </Svg>
);

const CamIcon = ({ off, className }: { off?: boolean; className?: string }) => (
  <Svg className={className}>
    <rect x="2" y="6" width="13" height="12" rx="2" />
    <path d="M15 10.5 21 7v10l-6-3.5" />
    {off && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" />}
  </Svg>
);

const ScreenIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <path d="M12 13V7.5" />
    <path d="M8.8 10 12 6.8 15.2 10" />
  </Svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path
      d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
      transform="rotate(135 12 12)"
    />
  </Svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m6 14 6-6 6 6" />
  </Svg>
);

const FullscreenIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);

const WaveIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3 12h1.5M7.5 8v8M12 5v14M16.5 9v6M20 12h1" />
  </Svg>
);

/* ------------------------------------------------------------------ */
/* Selector desplegable                                                */
/* ------------------------------------------------------------------ */

function PresetMenu({
  value,
  options,
  onChange,
  title,
}: {
  value: string;
  options: Record<string, { label: string }>;
  onChange: (id: string) => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative" title={title}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-12 w-12 rounded-full bg-hover hover:bg-active flex items-center justify-center text-text transition-colors"
        aria-label={title}
      >
        <ChevronIcon className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 rounded-lg bg-rail border border-hover shadow-2xl py-1.5 z-50">
          <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</p>
          {Object.entries(options).map(([id, opt]) => (
            <button
              key={id}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-hover ${
                id === value ? 'text-accent font-semibold' : 'text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Medición en vivo: RTT + jitter del audio entrante                    */
/* ------------------------------------------------------------------ */

type AudioStats = { rttMs?: number; jitterMs?: number };

function useAudioNetworkStats(room: Room): AudioStats | null {
  const [stats, setStats] = useState<AudioStats | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        let receiver: RTCRtpReceiver | undefined;
        for (const p of room.remoteParticipants.values()) {
          for (const pub of p.audioTrackPublications.values()) {
            const r = (pub.track as RemoteTrack | null | undefined)?.receiver;
            if (pub.isSubscribed && r) {
              receiver = r;
              break;
            }
          }
          if (receiver) break;
        }
        if (!receiver) return;
        const report = await receiver.getStats();
        let rttMs: number | undefined;
        let jitterMs: number | undefined;
        report.forEach((s: { type?: string; kind?: string; state?: string; currentRoundTripTime?: number; jitter?: number }) => {
          if (s.type === 'candidate-pair' && s.state === 'succeeded' && typeof s.currentRoundTripTime === 'number') {
            rttMs = Math.round(s.currentRoundTripTime * 1000);
          }
          if (s.type === 'inbound-rtp' && s.kind === 'audio' && typeof s.jitter === 'number') {
            jitterMs = Math.round(s.jitter * 1000);
          }
        });
        if (alive && (rttMs !== undefined || jitterMs !== undefined)) setStats({ rttMs, jitterMs });
      } catch {
        // stats no disponibles todavía
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [room]);

  return stats;
}

function NetworkBadge({ stats }: { stats: AudioStats | null }) {
  if (!stats) return null;
  const rtt = stats.rttMs;
  const quality = rtt === undefined ? '' : rtt < 80 ? 'text-online' : rtt < 150 ? 'text-yellow-500' : 'text-danger';
  return (
    <span className="text-xs text-muted tabular-nums" title="RTT del enlace de voz · jitter del audio entrante">
      {rtt !== undefined && <span className={quality}>~{rtt} ms</span>}
      {stats.jitterMs !== undefined && <span> · jitter {stats.jitterMs} ms</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

function SpeakingAvatar({ participant }: { participant: ReturnType<typeof useParticipants>[number] }) {
  const speaking = useIsSpeaking(participant);
  return <Avatar name={participant.name || participant.identity} size={64} speaking={speaking} />;
}

function ScreenTile({ trackRef }: { trackRef: TrackReference }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef} className="relative bg-black rounded-lg overflow-hidden group min-h-0">
      <VideoTrack trackRef={trackRef} className="w-full h-full object-contain" />
      <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-header">
        Pantalla de {trackRef.participant.name || trackRef.participant.identity}
      </div>
      <button
        onClick={() => wrapRef.current?.requestFullscreen?.().catch(() => undefined)}
        className="absolute right-2 top-2 rounded bg-black/70 hover:bg-black p-1.5 text-header opacity-0 group-hover:opacity-100 transition-opacity"
        title="Pantalla completa"
      >
        <FullscreenIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controles                                                           */
/* ------------------------------------------------------------------ */

function ControlsBar({
  screenPreset,
  micPreset,
  onScreenPreset,
  onMicPreset,
  onLeave,
}: {
  screenPreset: string;
  micPreset: string;
  onScreenPreset: (id: string) => void;
  onMicPreset: (id: string) => void;
  onLeave: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const krisp = useKrispNoiseFilter();
  const mic = localParticipant.isMicrophoneEnabled;
  const cam = localParticipant.isCameraEnabled;
  const sharing = localParticipant.isScreenShareEnabled;
  const [busy, setBusy] = useState(false);
  const krispAvailable = micPreset === 'hd';

  const guard = useCallback(async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      // usuario canceló el selector de pantalla o el navegador denegó permisos
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const toggleMic = () => guard(async () => {
    const preset = MIC_PRESETS[micPreset];
    await localParticipant.setMicrophoneEnabled(!mic, preset.capture, preset.publish);
  });

  const toggleCam = () => guard(async () => {
    await localParticipant.setCameraEnabled(!cam, {
      resolution: VideoPresets.h720.resolution,
    });
  });

  const toggleShare = () => guard(async () => {
    if (sharing) {
      await localParticipant.setScreenShareEnabled(false);
      return;
    }
    const preset = SCREEN_PRESETS[screenPreset];
    await localParticipant.setScreenShareEnabled(
      true,
      {
        // restricOwnAudio: excluye el audio de esta pestaña del stream compartido
        audio: { restrictOwnAudio: true },
        // y el navegador no reproduce localmente el audio de esa pestaña
        suppressLocalAudioPlayback: true,
        systemAudio: 'include',
        selfBrowserSurface: 'include',
        surfaceSwitching: 'include',
        ...preset.capture,
      },
      {
        videoCodec: 'vp9',
        degradationPreference: 'maintain-resolution',
        ...preset.publish,
      },
    );
  });

  // Reiniciar compartir con la nueva calidad si está activo
  const changeScreenPreset = (id: string) => {
    onScreenPreset(id);
    if (sharing) {
      guard(async () => {
        await localParticipant.setScreenShareEnabled(false);
        const preset = SCREEN_PRESETS[id];
        await localParticipant.setScreenShareEnabled(
          true,
          {
            audio: { restrictOwnAudio: true },
            suppressLocalAudioPlayback: true,
            systemAudio: 'include',
            ...preset.capture,
          },
          { videoCodec: 'vp9', degradationPreference: 'maintain-resolution', ...preset.publish },
        );
      });
    }
  };

  // Cambiar modo de micrófono en caliente
  const changeMicPreset = (id: string) => {
    onMicPreset(id);
    if (id !== 'hd' && krisp.isNoiseFilterEnabled) {
      void krisp.setNoiseFilterEnabled(false).catch(() => undefined);
    }
    if (mic) {
      guard(async () => {
        await localParticipant.setMicrophoneEnabled(false);
        const preset = MIC_PRESETS[id];
        await localParticipant.setMicrophoneEnabled(true, preset.capture, preset.publish);
      });
    }
  };

  const toggleKrisp = () => {
    if (!krispAvailable) return;
    void krisp.setNoiseFilterEnabled(!krisp.isNoiseFilterEnabled).catch(() => undefined);
  };

  const btn = 'h-12 w-12 rounded-full flex items-center justify-center transition-colors';
  const on = `${btn} bg-hover hover:bg-active text-text`;
  const off = `${btn} bg-danger hover:bg-danger-hover text-white`;

  return (
    <div className="flex items-end justify-center gap-3 pb-7 pt-2">
      <div className="flex items-center gap-1">
        <button onClick={toggleMic} disabled={busy} className={mic ? on : off} title={mic ? 'Silenciar micrófono' : 'Activar micrófono'}>
          <MicIcon off={!mic} className="w-6 h-6" />
        </button>
        <PresetMenu value={micPreset} options={MIC_PRESETS} onChange={changeMicPreset} title="Calidad de micrófono" />
      </div>

      <button
        onClick={toggleKrisp}
        disabled={!krispAvailable || krisp.isNoiseFilterPending}
        className={
          !krispAvailable
            ? `${btn} bg-hover text-muted cursor-not-allowed opacity-50`
            : krisp.isNoiseFilterEnabled
              ? `${btn} bg-online text-white`
              : on
        }
        title={
          !krispAvailable
            ? 'Filtro IA de ruido: solo en preset Voz HD'
            : krisp.isNoiseFilterEnabled
              ? 'Desactivar filtro IA de ruido'
              : 'Activar filtro IA de ruido (Krisp)'
        }
      >
        <WaveIcon className="w-6 h-6" />
      </button>

      <button onClick={toggleCam} disabled={busy} className={cam ? on : `${btn} bg-hover hover:bg-active text-text`} title={cam ? 'Apagar cámara' : 'Encender cámara'}>
        <CamIcon off={!cam} className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-1">
        <button onClick={toggleShare} disabled={busy} className={sharing ? `${btn} bg-online text-white` : on} title={sharing ? 'Dejar de compartir' : 'Compartir pantalla'}>
          <ScreenIcon className="w-6 h-6" />
        </button>
        <PresetMenu value={screenPreset} options={SCREEN_PRESETS} onChange={changeScreenPreset} title="Calidad de pantalla" />
      </div>

      <button onClick={onLeave} className={`${btn} w-16 bg-danger hover:bg-danger-hover text-white`} title="Desconectar">
        <PhoneIcon className="w-6 h-6" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sala conectada                                                      */
/* ------------------------------------------------------------------ */

function RoomUI({ channel, screenPreset, micPreset, onScreenPreset, onMicPreset, onLeave, jitterMs, jitterAuto, autoMic, onCallState }: {
  channel: Channel;
  screenPreset: string;
  micPreset: string;
  onScreenPreset: (id: string) => void;
  onMicPreset: (id: string) => void;
  onLeave: () => void;
  jitterMs: number;
  jitterAuto: boolean;
  autoMic: boolean;
  onCallState?: (state: CallState | null) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const stats = useAudioNetworkStats(room);

  // Jitter adaptativo: parte del objetivo manual y se ajusta al jitter real medido.
  const [adaptiveMs, setAdaptiveMs] = useState(jitterMs);
  const cleanStreak = useRef(0);
  useEffect(() => {
    if (!jitterAuto) {
      setAdaptiveMs(jitterMs);
      return;
    }
    const j = stats?.jitterMs;
    if (j === undefined) return;
    if (j <= 4) {
      cleanStreak.current += 1;
      if (cleanStreak.current >= 2) setAdaptiveMs(20);
    } else {
      cleanStreak.current = 0;
      setAdaptiveMs((prev) => adaptiveJitterTarget(j, prev));
    }
  }, [stats, jitterAuto, jitterMs]);
  const effectiveJitterMs = jitterAuto ? adaptiveMs : jitterMs;

  const jitterRef = useRef(effectiveJitterMs);
  jitterRef.current = effectiveJitterMs;

  // Baja latencia: jitter buffer controlado en cada audio suscrito
  useEffect(() => {
    const onSubscribed = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const receiver = track.receiver;
      if (receiver) tuneAudioReceiver(receiver, jitterRef.current);
    };
    const sweep = () => tuneAllAudioReceivers(room, jitterRef.current);
    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.Connected, sweep);
    sweep();
    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.Connected, sweep);
    };
  }, [room]);

  // Aplicar en caliente si el objetivo cambia (manual o adaptativo)
  useEffect(() => {
    if (connectionState === 'connected') tuneAllAudioReceivers(room, effectiveJitterMs);
  }, [room, effectiveJitterMs, connectionState]);

  // Auto-mic: publicar el micrófono en cuanto conecta (primera palabra sin esperas)
  const micArmed = useRef(false);
  useEffect(() => {
    if (!autoMic || micArmed.current) return;
    if (connectionState !== 'connected') return;
    micArmed.current = true;
    const preset = MIC_PRESETS[micPreset];
    localParticipant.setMicrophoneEnabled(true, preset.capture, preset.publish).catch(() => undefined);
  }, [autoMic, connectionState, localParticipant, micPreset]);

  // Reportar el estado real de la llamada al shell (sidebar + rail derecho)
  const connected = connectionState === 'connected';
  useEffect(() => {
    if (!onCallState) return;
    if (!connected) {
      onCallState(null);
      return;
    }
    onCallState({
      channelId: channel.id,
      channelName: channel.name,
      participants: participants.map((p) => ({ identity: p.identity, name: p.name || p.identity })),
    });
  }, [onCallState, connected, channel.id, channel.name, participants]);
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], {
    onlySubscribed: false,
  }).filter(isTrackReference);
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: false,
  }).filter(isTrackReference);

  const cameraByIdentity = useMemo(() => {
    const map = new Map<string, TrackReference>();
    for (const tr of cameraTracks) map.set(tr.participant.identity, tr);
    return map;
  }, [cameraTracks]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-rail">
        <Svg className="w-5 h-5 text-muted">
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" />
        </Svg>
        <h1 className="font-bold text-header truncate">{channel.name}</h1>
        <span className="ml-auto text-xs text-muted">
          {connectionState === 'connected' ? (
            <>
              <span className="text-online">●</span> {participants.length} en el canal
              {room.serverInfo?.region ? ` · ${room.serverInfo.region}` : ''}
              {' · '}
              <NetworkBadge stats={stats} />
              <span className="text-muted"> · buffer {effectiveJitterMs} ms</span>
            </>
          ) : (
            <span className="text-yellow-500">● Conectando…</span>
          )}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-y-auto">
        {screenTracks.length > 0 && (
          <div
            className={`grid gap-3 shrink-0 ${
              screenTracks.length === 1 ? 'grid-cols-1 h-[55%] min-h-[240px]' : 'grid-cols-2 h-[45%] min-h-[220px]'
            }`}
          >
            {screenTracks.map((tr) => (
              <ScreenTile key={`${tr.participant.identity}-${tr.publication?.trackSid ?? 'screen'}`} trackRef={tr} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap content-start justify-center gap-4 py-2">
          {participants.map((p) => {
            const camera = cameraByIdentity.get(p.identity);
            return (
              <div key={p.identity} className="flex flex-col items-center gap-2 w-36">
                <div className="relative w-36 h-24 rounded-lg bg-panel flex items-center justify-center overflow-hidden">
                  {camera ? (
                    <VideoTrack trackRef={camera} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <SpeakingAvatar participant={p} />
                  )}
                </div>
                <p className="flex items-center justify-center gap-1.5 text-sm text-text w-full min-w-0">
                  <span className="truncate">{p.name || p.identity}</span>
                  {!p.isMicrophoneEnabled && <MicIcon off className="w-3.5 h-3.5 shrink-0 text-danger" />}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <ControlsBar
        screenPreset={screenPreset}
        micPreset={micPreset}
        onScreenPreset={onScreenPreset}
        onMicPreset={onMicPreset}
        onLeave={onLeave}
      />
      <RoomAudioRenderer />
      <StartAudio
        label="Pulsa para activar el audio"
        className="absolute top-14 left-1/2 -translate-x-1/2 z-50 rounded bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-semibold text-white"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entrada al canal                                                    */
/* ------------------------------------------------------------------ */

export function VoiceChannel({
  channel,
  user,
  onCallState,
}: {
  channel: Channel;
  user: User;
  onCallState?: (state: CallState | null) => void;
}) {
  const [token, setToken] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenPreset, setScreenPreset] = useState('p1080_30');
  const [micPreset, setMicPreset] = useState('voice');
  const [jitterPreset, setJitterPreset] = useState('auto');
  const [autoMic, setAutoMic] = useState(true);
  const [prefetchReady, setPrefetchReady] = useState(false);
  const jitterMs = JITTER_OPTIONS[jitterPreset]?.ms ?? DEFAULT_JITTER_TARGET_MS;
  const jitterAuto = Boolean(JITTER_OPTIONS[jitterPreset]?.auto);

  const roomOptions = useMemo<RoomOptions>(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
      audioCaptureDefaults: MIC_PRESETS.voice.capture,
      publishDefaults: {
        dtx: true,
        red: true,
        audioPreset: AudioPresets.music,
        videoCodec: 'vp9',
        screenShareEncoding: SCREEN_PRESETS.p1080_30.publish.screenShareEncoding,
      },
      screenShareCaptureDefaults: {
        // restrictOwnAudio: no capturar el audio de ESTA pestaña en el stream (anti-eco)
        audio: { restrictOwnAudio: true },
        // y no reproducir localmente el audio compartido
        suppressLocalAudioPlayback: true,
        systemAudio: 'include',
        contentHint: 'detail',
        resolution: VideoPresets.h1080.resolution,
      },
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    }),
    [],
  );

  // Instancia propia para poder pre-calentar la conexión antes de entrar
  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  // Pre-fetch del token + warm-up de ICE/DTLS al visitar el canal:
  // cuando el usuario pulse "Unirse" la negociación ya está en marcha
  const prefetchedToken = useRef<{ token: string; url: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    prefetchedToken.current = null;
    (async () => {
      try {
        const t = await api<{ token: string; url: string }>('/api/livekit/token', {
          method: 'POST',
          body: JSON.stringify({ roomName: `voice-${channel.id}`, identity: user.id, name: user.username }),
        });
        if (cancelled) return;
        prefetchedToken.current = t;
        if (!cancelled) setPrefetchReady(true);
        room.prepareConnection(t.url, t.token).catch(() => undefined);
      } catch {
        // el error real se muestra al intentar unirse
        if (!cancelled) setPrefetchReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.id, user.id, user.username, room]);

  async function join() {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const t =
        prefetchedToken.current ??
        (await api<{ token: string; url: string }>('/api/livekit/token', {
          method: 'POST',
          body: JSON.stringify({ roomName: `voice-${channel.id}`, identity: user.id, name: user.username }),
        }));
      setToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener el token');
      setConnecting(false);
    }
  }

  // Auto-join: al llegar desde el sidebar (?join=1) conectamos en cuanto el token está listo
  useEffect(() => {
    if (!prefetchReady || token || connecting) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('join') === '1') void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchReady, token, connecting]);

  function leave() {
    setToken(null);
    setConnecting(false);
  }

  if (!token) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <header className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-rail">
          <Svg className="w-5 h-5 text-muted">
            <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" />
          </Svg>
          <h1 className="font-bold text-header truncate">{channel.name}</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl bg-sidebar p-8 text-center shadow-2xl space-y-5">
            <div
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: `hsl(${avatarHue(channel.name)} 55% 40%)` }}
            >
              <Svg className="w-10 h-10 text-white">
                <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" />
              </Svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-header">{channel.name}</h2>
              <p className="text-sm text-muted mt-1">Voz Opus de baja latencia · Pantalla hasta 4K/60 (VP9)</p>
            </div>

            <div className="space-y-3 text-left">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Micrófono</span>
                <select
                  value={micPreset}
                  onChange={(e) => setMicPreset(e.target.value)}
                  className="mt-1 w-full rounded bg-input px-3 py-2.5 text-header outline-none focus:ring-2 ring-accent"
                >
                  {Object.entries(MIC_PRESETS).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Calidad de pantalla</span>
                <select
                  value={screenPreset}
                  onChange={(e) => setScreenPreset(e.target.value)}
                  className="mt-1 w-full rounded bg-input px-3 py-2.5 text-header outline-none focus:ring-2 ring-accent"
                >
                  {Object.entries(SCREEN_PRESETS).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Buffer de audio (latencia)</span>
                <select
                  value={jitterPreset}
                  onChange={(e) => setJitterPreset(e.target.value)}
                  className="mt-1 w-full rounded bg-input px-3 py-2.5 text-header outline-none focus:ring-2 ring-accent"
                >
                  {Object.entries(JITTER_OPTIONS).map(([id, o]) => (
                    <option key={id} value={id}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoMic}
                  onChange={(e) => setAutoMic(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Entrar con el micrófono abierto (sin esperas)
              </label>
            </div>

            <button
              onClick={join}
              disabled={connecting}
              className="w-full rounded-lg bg-online hover:bg-online/85 disabled:opacity-50 px-4 py-3 font-bold text-white transition-colors"
            >
              {connecting ? 'Conectando…' : 'Unirse al canal de voz'}
            </button>
            {error && <p className="text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <LiveKitRoom
        room={room}
        token={token.token}
        serverUrl={token.url}
        connect
        audio={false}
        video={false}
        onDisconnected={leave}
        onError={(e) => setError(e.message)}
        className="h-full"
      >
        <RoomUI
          channel={channel}
          screenPreset={screenPreset}
          micPreset={micPreset}
          onScreenPreset={setScreenPreset}
          onMicPreset={setMicPreset}
          onLeave={leave}
          jitterMs={jitterMs}
          jitterAuto={jitterAuto}
          autoMic={autoMic}
          onCallState={onCallState}
        />
      </LiveKitRoom>
      {error && (
        <p className="absolute bottom-24 left-1/2 -translate-x-1/2 text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</p>
      )}
    </div>
  );
}
