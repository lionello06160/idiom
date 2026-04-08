import { getServerSnapshot, setServerState } from '@/lib/game-server-store';
import { isValidSharedState } from '@/lib/game-shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getServerSnapshot());
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const candidate = body?.state;

  if (!isValidSharedState(candidate)) {
    return Response.json({ error: 'Invalid state payload' }, { status: 400 });
  }

  const snapshot = await setServerState(candidate);
  return Response.json(snapshot);
}
