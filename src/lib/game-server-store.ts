import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSharedLevelState, isValidSharedState, type SharedGameState } from '@/lib/game-shared';

interface ServerSnapshot {
  state: SharedGameState;
  version: number;
  updatedAt: number;
}

type Listener = (version: number) => void;

const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'game-state.json');

const globalStore = globalThis as typeof globalThis & {
  __idiomStore?: {
    snapshot: ServerSnapshot;
    listeners: Set<Listener>;
    initPromise: Promise<void> | null;
  };
};

if (!globalStore.__idiomStore) {
  globalStore.__idiomStore = {
    snapshot: {
      state: createSharedLevelState(1),
      version: 1,
      updatedAt: Date.now(),
    },
    listeners: new Set<Listener>(),
    initPromise: null,
  };
}

const store = globalStore.__idiomStore;

async function persistSnapshot(snapshot: ServerSnapshot) {
  await mkdir(path.dirname(STATE_FILE_PATH), { recursive: true });
  await writeFile(STATE_FILE_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
}

async function loadSnapshotFromDisk() {
  try {
    const raw = await readFile(STATE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerSnapshot>;

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.version === 'number' &&
      typeof parsed.updatedAt === 'number' &&
      isValidSharedState(parsed.state)
    ) {
      store.snapshot = {
        state: parsed.state,
        version: parsed.version,
        updatedAt: parsed.updatedAt,
      };
      return;
    }
  } catch {
    // Fall through to initial snapshot persistence.
  }

  await persistSnapshot(store.snapshot);
}

export async function ensureServerStoreReady() {
  if (!store.initPromise) {
    store.initPromise = loadSnapshotFromDisk();
  }

  await store.initPromise;
}

export async function getServerSnapshot() {
  await ensureServerStoreReady();
  return store.snapshot;
}

export async function setServerState(state: SharedGameState) {
  await ensureServerStoreReady();

  store.snapshot = {
    state,
    version: store.snapshot.version + 1,
    updatedAt: Date.now(),
  };

  await persistSnapshot(store.snapshot);

  for (const listener of store.listeners) listener(store.snapshot.version);
  return store.snapshot;
}

export async function resetServerState(level = 1, previousScore = 0) {
  await ensureServerStoreReady();

  store.snapshot = {
    state: createSharedLevelState(level, previousScore),
    version: store.snapshot.version + 1,
    updatedAt: Date.now(),
  };

  await persistSnapshot(store.snapshot);

  for (const listener of store.listeners) listener(store.snapshot.version);
  return store.snapshot;
}

export function subscribeToServerState(listener: Listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}
