/**
 * Hub pub/sub en memoria para chat en tiempo real vía SSE.
 * Válido para el MVP (un solo proceso Node). Para multi-instancia,
 * sustituir por Redis/Turso CDC/EventBridge.
 */
export type StreamMessage = {
  seq: number;
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
};

type Listener = (msg: StreamMessage) => void;

const g = globalThis as unknown as { __voxcordHub?: Map<string, Set<Listener>> };

function hub(): Map<string, Set<Listener>> {
  if (!g.__voxcordHub) g.__voxcordHub = new Map();
  return g.__voxcordHub;
}

export function broadcastMessage(channelId: string, msg: StreamMessage): void {
  const listeners = hub().get(channelId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(msg);
    } catch {
      // listener roto: se limpia en la desconexión del stream
    }
  }
}

export function subscribeToChannel(channelId: string, listener: Listener): () => void {
  const map = hub();
  let listeners = map.get(channelId);
  if (!listeners) {
    listeners = new Set();
    map.set(channelId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) map.delete(channelId);
  };
}
