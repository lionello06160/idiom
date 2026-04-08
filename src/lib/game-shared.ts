import { GameGenerator, type GridCell, type PlacedIdiom } from '@/lib/generator';
import { IDIOMS } from '@/lib/idioms';

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
  selectedCell: SelectedCell;
  candidates: string[];
  isComplete: boolean;
  level: number;
  stats: GameStats;
}

export const GRID_SIZE = 8;
const BASE_HINT_REVEAL_RATE = 0.18;
const EXTRA_CANDIDATES = 6;
const ALL_IDIOM_CHARS = Array.from(new Set(IDIOMS.flatMap((idiom) => Array.from(idiom.word))));

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
  cell: SelectedCell
) {
  if (!cell) return null;

  const [row, col] = cell;
  const target = grid[row]?.[col];
  if (!target) return null;

  return (
    placedIdioms.find(({ idiom, x, y, direction }) => {
      for (let offset = 0; offset < idiom.word.length; offset += 1) {
        const idiomRow = direction === 'V' ? y + offset : y;
        const idiomCol = direction === 'H' ? x + offset : x;
        if (idiomRow === row && idiomCol === col) return true;
      }
      return false;
    }) ?? null
  );
}

export function getIdiomCells(placed: PlacedIdiom): [number, number][] {
  return Array.from({ length: placed.idiom.word.length }, (_, offset) => [
    placed.direction === 'V' ? placed.y + offset : placed.y,
    placed.direction === 'H' ? placed.x + offset : placed.x,
  ]);
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
  start: SelectedCell
): SelectedCell {
  const currentIdiom = getIdiomForCell(placedIdioms, grid, start);
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

export function createSharedLevelState(level: number, previousScore = 0): SharedGameState {
  const generator = new GameGenerator(GRID_SIZE);
  const idiomCount = Math.min(5 + Math.floor(level / 2), 10);
  const { grid, idioms } = generator.generate(idiomCount);

  const userGrid = grid.map((row) => row.map(() => ''));
  const revealed = grid.map((row) =>
    row.map((cell) => {
      if (!cell) return false;
      return Math.random() < Math.max(0.08, BASE_HINT_REVEAL_RATE - level * 0.01);
    })
  );

  const hiddenChars = grid.flatMap((row, y) =>
    row.flatMap((cell, x) => (cell && !revealed[y][x] ? [cell.char] : []))
  );

  const distractors = shuffle(
    ALL_IDIOM_CHARS.filter((char) => !hiddenChars.includes(char))
  ).slice(0, Math.min(EXTRA_CANDIDATES + Math.floor(level / 2), 12));

  const candidates = shuffle([...hiddenChars, ...distractors]);
  const totalCells = getTotalCells(grid);
  const solvedCells = countSolvedCells(grid, userGrid, revealed);

  return {
    grid,
    userGrid,
    revealed,
    placedIdioms: idioms,
    selectedCell: findNextEditableCell(grid, revealed, userGrid),
    candidates,
    isComplete: false,
    level,
    stats: {
      score: previousScore,
      streak: 0,
      mistakes: 0,
      hintsUsed: 0,
      solvedCells,
      totalCells,
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
