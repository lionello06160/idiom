import 'server-only';

import { GameGenerator } from '@/lib/generator';
import { IDIOMS } from '@/lib/idioms';
import {
  GRID_SIZE,
  countSolvedCells,
  findNextEditableCell,
  getTotalCells,
  shuffle,
  type SharedGameState,
} from '@/lib/game-shared';

const BASE_HINT_REVEAL_RATE = 0.22;
const EXTRA_CANDIDATES = 1;
const MIN_VISIBLE_CELLS = 5;
const MIN_INTERSECTION_HINTS = 3;
const EXTRA_INITIAL_REVEALS = 3;
const MAX_GENERATION_MS = 700;
const MIN_IDIOM_COUNT = 7;
const ALL_IDIOM_CHARS = Array.from(new Set(IDIOMS.flatMap((idiom) => Array.from(idiom.word))));

function getIdiomCells(placed: { direction: 'H' | 'V'; x: number; y: number; idiom: { word: string } }) {
  return Array.from({ length: placed.idiom.word.length }, (_, offset) => [
    placed.direction === 'V' ? placed.y + offset : placed.y,
    placed.direction === 'H' ? placed.x + offset : placed.x,
  ] as [number, number]);
}

function getIntersectionCells(
  placedIdioms: { direction: 'H' | 'V'; x: number; y: number; idiom: { word: string } }[]
) {
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

export function createSharedLevelState(level: number, previousScore = 0): SharedGameState {
  const generator = new GameGenerator(GRID_SIZE);
  const idiomCount = Math.min(5 + Math.floor(level / 2), 10);
  let generated: ReturnType<GameGenerator['generate']> | null = null;

  for (let targetCount = idiomCount; targetCount >= MIN_IDIOM_COUNT; targetCount--) {
    try {
      generated = generator.generate(targetCount, { timeoutMs: MAX_GENERATION_MS, maxAttempts: 8 });
      break;
    } catch {
      // High-density boards can be expensive; degrade density before blocking the server.
    }
  }

  if (!generated) {
    generated = generator.generate(MIN_IDIOM_COUNT - 1, { timeoutMs: MAX_GENERATION_MS, maxAttempts: 8 });
  }

  const { grid, idioms } = generated;

  const userGrid = grid.map((row) => row.map(() => ''));
  const revealed = grid.map((row) =>
    row.map((cell) => {
      if (!cell) return false;
      return Math.random() < Math.max(0.12, BASE_HINT_REVEAL_RATE - level * 0.01);
    })
  );

  const intersectionCells = shuffle(getIntersectionCells(idioms));

  intersectionCells.slice(0, MIN_INTERSECTION_HINTS).forEach(([row, col]) => {
    revealed[row][col] = true;
  });

  if (countVisibleCells(revealed) < MIN_VISIBLE_CELLS) {
    const fallbackCells = shuffle(
      grid.flatMap((row, y) =>
        row.flatMap((cell, x) => (cell ? [[y, x] as [number, number]] : []))
      )
    );

    for (const [row, col] of fallbackCells) {
      if (countVisibleCells(revealed) >= MIN_VISIBLE_CELLS) break;
      revealed[row][col] = true;
    }
  }

  const additionalRevealCells = shuffle(
    grid.flatMap((row, y) =>
      row.flatMap((cell, x) => (cell && !revealed[y][x] ? [[y, x] as [number, number]] : []))
    )
  );

  additionalRevealCells.slice(0, EXTRA_INITIAL_REVEALS).forEach(([row, col]) => {
    revealed[row][col] = true;
  });

  const hiddenChars = grid.flatMap((row, y) =>
    row.flatMap((cell, x) => (cell && !revealed[y][x] ? [cell.char] : []))
  );

  const distractors = shuffle(
    ALL_IDIOM_CHARS.filter((char) => !hiddenChars.includes(char))
  ).slice(0, Math.min(EXTRA_CANDIDATES + Math.floor(level / 2), 7));

  const candidates = shuffle([...hiddenChars, ...distractors]);
  const totalCells = getTotalCells(grid);
  const solvedCells = countSolvedCells(grid, userGrid, revealed);

  return {
    grid,
    userGrid,
    revealed,
    placedIdioms: idioms,
    activeIdiomKey: null,
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
