import { subscribeToServerState } from '@/lib/game-server-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = null;
    }

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 1000\n\n'));

      unsubscribe = subscribeToServerState((version) => {
        try {
          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify({ version })}\n\n`));
        } catch {
          cleanup();
        }
      });

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
