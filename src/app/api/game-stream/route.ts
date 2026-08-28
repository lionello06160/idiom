import { getServerSnapshot } from 'idiom-game-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let polling = false;
  let lastVersion = 0;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;

    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = null;
    }

    if (controllerRef) {
      try {
        controllerRef.close();
      } catch {
        // Ignore double-close attempts from disconnected clients.
      }
      controllerRef = null;
    }
  };

  const enqueue = (payload: string) => {
    if (closed || !controllerRef) return false;

    try {
      controllerRef.enqueue(encoder.encode(payload));
      return true;
    } catch {
      cleanup();
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      enqueue('retry: 1000\n\n');

      keepAlive = setInterval(() => {
        if (polling) return;
        polling = true;

        void getServerSnapshot()
          .then((snapshot) => {
            if (snapshot.version > lastVersion) {
              lastVersion = snapshot.version;
              enqueue(`event: update\ndata: ${JSON.stringify({ version: snapshot.version })}\n\n`);
              return;
            }

            enqueue(': keepalive\n\n');
          })
          .catch(cleanup)
          .finally(() => {
            polling = false;
          });
      }, 2500);
    },
    cancel() {
      cleanup();
    },
  });

  request.signal.addEventListener('abort', cleanup);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
