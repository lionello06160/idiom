import { subscribeToServerState } from '@/lib/game-server-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 1000\n\n'));

      const unsubscribe = subscribeToServerState((version) => {
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify({ version })}\n\n`));
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15000);

      return () => {
        clearInterval(keepAlive);
        unsubscribe();
      };
    },
    cancel() {
      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
