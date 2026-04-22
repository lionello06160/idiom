import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSharedLevelState } from '@/lib/game-level-factory';
import { isValidSharedState, type SharedGameState } from '@/lib/game-shared';

interface ServerSnapshot {
  state: SharedGameState;
  version: number;
  updatedAt: number;
}

type Listener = (version: number) => void;

const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'game-state.json');
const STATE_FILE_TMP_PATH = `${STATE_FILE_PATH}.tmp`;
const STATE_FILE_BACKUP_PATH = `${STATE_FILE_PATH}.bak`;

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
  const payload = JSON.stringify(snapshot, null, 2);

  await writeFile(STATE_FILE_TMP_PATH, payload, 'utf8');
  await rename(STATE_FILE_TMP_PATH, STATE_FILE_PATH);
  await copyFile(STATE_FILE_PATH, STATE_FILE_BACKUP_PATH);
}

function parseSnapshot(raw: string): ServerSnapshot | null {
  const parsed = JSON.parse(raw) as Partial<ServerSnapshot>;

  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof parsed.version === 'number' &&
    typeof parsed.updatedAt === 'number' &&
    isValidSharedState(parsed.state)
  ) {
    return {
      state: parsed.state,
      version: parsed.version,
      updatedAt: parsed.updatedAt,
    };
  }

  return null;
}

async function readSnapshotFile(filePath: string) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return parseSnapshot(raw);
  } catch {
    return null;
  }
}

async function loadSnapshotFromDisk() {
  const snapshot =
    (await readSnapshotFile(STATE_FILE_PATH)) ??
    (await readSnapshotFile(STATE_FILE_BACKUP_PATH));

  if (snapshot) {
    store.snapshot = snapshot;

    // Repair the primary file if only the backup survived a bad restart.
    await persistSnapshot(store.snapshot);
    return;
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

export async function generateServerState(level = 1, previousScore = 0) {
  await ensureServerStoreReady();

  return {
    state: createSharedLevelState(level, previousScore),
    version: store.snapshot.version,
    updatedAt: Date.now(),
  };
}

export function subscribeToServerState(listener: Listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}
