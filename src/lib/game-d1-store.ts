import { env } from 'cloudflare:workers';
import initialSnapshotJson from '../../db/initial-game-state.json';
import { createSharedLevelState } from '@/lib/game-level-factory';
import { isValidSharedState, type SharedGameState } from '@/lib/game-shared';

interface ServerSnapshot {
  state: SharedGameState;
  version: number;
  updatedAt: number;
}

interface StoredSnapshotRow {
  state: string;
  version: number;
  updatedAt: number;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY,
    state TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

const initialSnapshot = parseSnapshot(initialSnapshotJson);
let readyPromise: Promise<void> | null = null;

function parseSnapshot(value: unknown): ServerSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid initial game snapshot');
  }

  const candidate = value as Partial<ServerSnapshot>;
  if (
    typeof candidate.version !== 'number' ||
    typeof candidate.updatedAt !== 'number' ||
    !isValidSharedState(candidate.state)
  ) {
    throw new Error('Invalid initial game snapshot');
  }

  return {
    state: candidate.state,
    version: candidate.version,
    updatedAt: candidate.updatedAt,
  };
}

function parseStoredRow(row: StoredSnapshotRow | null): ServerSnapshot {
  if (!row) throw new Error('Shared game state is unavailable');

  return parseSnapshot({
    state: JSON.parse(row.state),
    version: row.version,
    updatedAt: row.updatedAt,
  });
}

async function initializeDatabase() {
  await env.DB.prepare(CREATE_TABLE_SQL).run();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO game_state (id, state, version, updated_at) VALUES (1, ?, ?, ?)',
  )
    .bind(
      JSON.stringify(initialSnapshot.state),
      initialSnapshot.version,
      initialSnapshot.updatedAt,
    )
    .run();
}

async function ensureDatabaseReady() {
  readyPromise ??= initializeDatabase();
  await readyPromise;
}

export async function getServerSnapshot() {
  await ensureDatabaseReady();
  const row = await env.DB.prepare(
    'SELECT state, version, updated_at AS updatedAt FROM game_state WHERE id = 1',
  ).first<StoredSnapshotRow>();
  return parseStoredRow(row);
}

export async function setServerState(state: SharedGameState) {
  await ensureDatabaseReady();
  const updatedAt = Date.now();

  await env.DB.prepare(
    'UPDATE game_state SET state = ?, version = version + 1, updated_at = ? WHERE id = 1',
  )
    .bind(JSON.stringify(state), updatedAt)
    .run();

  return getServerSnapshot();
}

export async function resetServerState(level = 1, previousScore = 0) {
  return setServerState(createSharedLevelState(level, previousScore));
}

export async function generateServerState(level = 1, previousScore = 0) {
  const snapshot = await getServerSnapshot();
  return {
    state: createSharedLevelState(level, previousScore),
    version: snapshot.version,
    updatedAt: Date.now(),
  };
}
