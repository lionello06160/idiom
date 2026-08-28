import { generateServerState, getServerSnapshot, resetServerState, setServerState } from 'idiom-game-store';
import { isValidSharedState } from '@/lib/game-shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getServerSnapshot());
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { state?: unknown } | null;
  const candidate = body?.state;

  if (!isValidSharedState(candidate)) {
    return Response.json({ error: 'Invalid state payload' }, { status: 400 });
  }

  const snapshot = await setServerState(candidate);
  return Response.json(snapshot);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    level?: unknown;
    previousScore?: unknown;
  } | null;
  const action = body?.action;
  const level = typeof body?.level === 'number' ? body.level : 1;
  const previousScore = typeof body?.previousScore === 'number' ? body.previousScore : 0;

  if (action !== 'nextLevel' && action !== 'resetLevel' && action !== 'prefetchLevel') {
    return Response.json({ error: 'Invalid game-state action' }, { status: 400 });
  }

  if (action === 'prefetchLevel') {
    const snapshot = await generateServerState(level, previousScore);
    return Response.json({ state: snapshot.state });
  }

  const snapshot = await resetServerState(level, previousScore);
  return Response.json(snapshot);
}
