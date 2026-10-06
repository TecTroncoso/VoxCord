import { subscribeToChannel } from '@/lib/hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ channelId: string }> };

// GET /api/channels/[channelId]/stream -> SSE de mensajes nuevos
export async function GET(req: Request, ctx: Ctx) {
  const { channelId } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const unsubscribe = subscribeToChannel(channelId, send);
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // stream cerrado
        }
      }, 25_000);

      send({ type: 'ready', channelId });

      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
