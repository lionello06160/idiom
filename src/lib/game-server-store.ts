import { createSharedLevelState, type SharedGameState } from '@/lib/game-shared';

interface ServerSnapshot {
  state: SharedGameState;
  version: number;
  updatedAt: number;
}

type Listener = (version: number) => void;

const globalStore = globalThis as typeof globalThis & {
  __idiomStore?: {
    snapshot: ServerSnapshot;
    listeners: Set<Listener>;
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
  };
}

const store = globalStore.__idiomStore;

export function getServerSnapshot() {
  return store.snapshot;
}

export function setServerState(state: SharedGameState) {
  store.snapshot = {
    state,
    version: store.snapshot.version + 1,
    updatedAt: Date.now(),
  };

  for (const listener of store.listeners) listener(store.snapshot.version);
  return store.snapshot;
}

export function subscribeToServerState(listener: Listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}
