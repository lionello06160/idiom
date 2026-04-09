import type { GridCell, PlacedIdiom } from '@/lib/generator';

export type SelectedCell = [number, number] | null;
export type FeedbackTone = 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  text: string;
  tone: FeedbackTone;
}

export interface GameStats {
  score: number;
  streak: number;
  mistakes: number;
  hintsUsed: number;
  solvedCells: number;
  totalCells: number;
}

export interface SharedGameState {
  grid: (GridCell | null)[][];
  userGrid: string[][];
  revealed: boolean[][];
  placedIdioms: PlacedIdiom[];
  activeIdiomKey: string | null;
  selectedCell: SelectedCell;
  candidates: string[];
  isComplete: boolean;
  level: number;
  stats: GameStats;
}

export const GRID_SIZE = 8;

export function cloneGrid<T>(grid: T[][]) {
  return grid.map((row) => [...row]);
}

export function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

export function getTotalCells(grid: (GridCell | null)[][]) {
  return grid.flat().filter(Boolean).length;
}

export function countSolvedCells(
  grid: (GridCell | null)[][],
  userGrid: string[][],
  revealed: boolean[][]
) {
  let solved = 0;

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      if (revealed[y][x] || userGrid[y][x] === cell.char) solved += 1;
    });
  });

  return solved;
}

export function getIdiomForCell(
  placedIdioms: PlacedIdiom[],
  grid: (GridCell | null)[][],
  cell: SelectedCell,
  activeIdiomKey?: string | null
) {
  if (!cell) return null;

  const [row, col] = cell;
  const target = grid[row]?.[col];
  if (!target) return null;

  const matches = placedIdioms.filter(({ idiom, x, y, direction }) => {
    for (let offset = 0; offset < idiom.word.length; offset += 1) {
      const idiomRow = direction === 'V' ? y + offset : y;
      const idiomCol = direction === 'H' ? x + offset : x;
      if (idiomRow === row && idiomCol === col) return true;
    }
    return false;
  });

  if (!matches.length) return null;
  if (!activeIdiomKey) return matches[0];

  return matches.find((placed) => getPlacedIdiomKey(placed) === activeIdiomKey) ?? matches[0];
}

export function getIdiomCells(placed: PlacedIdiom): [number, number][] {
  return Array.from({ length: placed.idiom.word.length }, (_, offset) => [
    placed.direction === 'V' ? placed.y + offset : placed.y,
    placed.direction === 'H' ? placed.x + offset : placed.x,
  ]);
}

export function getPlacedIdiomKey(placed: PlacedIdiom) {
  return `${placed.idiom.word}:${placed.direction}:${placed.x}:${placed.y}`;
}

export function findNextEditableCell(
  grid: (GridCell | null)[][],
  revealed: boolean[][],
  userGrid: string[][],
  start?: SelectedCell
): SelectedCell {
  const coordinates = getEditableCoordinates(grid, revealed, userGrid);
  if (!coordinates.length) return null;
  if (!start) return coordinates[0];

  const index = coordinates.findIndex(([row, col]) => row === start[0] && col === start[1]);
  return coordinates[(index + 1 + coordinates.length) % coordinates.length];
}

export function findNextEditableCellInIdiom(
  placedIdioms: PlacedIdiom[],
  grid: (GridCell | null)[][],
  revealed: boolean[][],
  userGrid: string[][],
  start: SelectedCell,
  activeIdiomKey?: string | null
): SelectedCell {
  const currentIdiom = getIdiomForCell(placedIdioms, grid, start, activeIdiomKey);
  if (!currentIdiom || !start) return null;

  const cells = getIdiomCells(currentIdiom).filter(([row, col]) => {
    const cell = grid[row]?.[col];
    return cell && !revealed[row][col] && userGrid[row][col] !== cell.char;
  });

  if (!cells.length) return null;

  const index = cells.findIndex(([row, col]) => row === start[0] && col === start[1]);
  if (index === -1) return cells[0];
  return cells[(index + 1) % cells.length];
}

function getEditableCoordinates(
  grid: (GridCell | null)[][],
  revealed: boolean[][],
  userGrid: string[][]
) {
  const coordinates: [number, number][] = [];

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && !revealed[y][x] && userGrid[y][x] !== cell.char) coordinates.push([y, x]);
    });
  });

  return coordinates;
}

function getIntersectionCells(placedIdioms: PlacedIdiom[]) {
  const counts = new Map<string, number>();

  placedIdioms.forEach((placed) => {
    getIdiomCells(placed).forEach(([row, col]) => {
      const key = `${row},${col}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key.split(',').map(Number) as [number, number]);
}

function countVisibleCells(revealed: boolean[][]) {
  return revealed.flat().filter(Boolean).length;
}

export function createEmptySharedLevelState(level = 1, previousScore = 0): SharedGameState {
  const grid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
  const userGrid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => ''));
  const revealed = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => false));
  return {
    grid,
    userGrid,
    revealed,
    placedIdioms: [],
    activeIdiomKey: null,
    selectedCell: null,
    candidates: [],
    isComplete: false,
    level,
    stats: {
      score: previousScore,
      streak: 0,
      mistakes: 0,
      hintsUsed: 0,
      solvedCells: 0,
      totalCells: 0,
    },
  };
}

export function isValidSharedState(value: unknown): value is SharedGameState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SharedGameState>;
  return (
    Array.isArray(candidate.grid) &&
    Array.isArray(candidate.userGrid) &&
    Array.isArray(candidate.revealed) &&
    Array.isArray(candidate.placedIdioms) &&
    Array.isArray(candidate.candidates) &&
    typeof candidate.level === 'number' &&
    typeof candidate.isComplete === 'boolean' &&
    typeof candidate.stats === 'object' &&
    candidate.stats !== null
  );
}
