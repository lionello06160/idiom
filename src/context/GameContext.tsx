'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GameGenerator, type GridCell, type PlacedIdiom } from '@/lib/generator';
import { IDIOMS } from '@/lib/idioms';

type SelectedCell = [number, number] | null;
type FeedbackTone = 'success' | 'warning' | 'error';

interface ToastMessage {
  id: number;
  text: string;
  tone: FeedbackTone;
}

interface GameStats {
  score: number;
  streak: number;
  mistakes: number;
  hintsUsed: number;
  solvedCells: number;
  totalCells: number;
}

interface GameState {
  grid: (GridCell | null)[][];
  userGrid: string[][];
  revealed: boolean[][];
  placedIdioms: PlacedIdiom[];
  selectedCell: SelectedCell;
  candidates: string[];
  isComplete: boolean;
  level: number;
  stats: GameStats;
  toast: ToastMessage | null;
  isReady: boolean;
}

interface PersistedGameState {
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

interface GameContextType extends GameState {
  progressPercent: number;
  currentIdiom: PlacedIdiom | null;
  selectCell: (row: number, col: number) => void;
  clearCell: (row: number, col: number) => void;
  fillCell: (char: string) => void;
  clearSelectedCell: () => void;
  useHint: () => void;
  nextLevel: () => void;
  resetLevel: () => void;
}

const GRID_SIZE = 8;
const BASE_HINT_REVEAL_RATE = 0.18;
const EXTRA_CANDIDATES = 6;
const STORAGE_KEY = 'idiom-game-progress-v1';
const ALL_IDIOM_CHARS = Array.from(new Set(IDIOMS.flatMap((idiom) => Array.from(idiom.word))));

const EMPTY_STATS: GameStats = {
  score: 0,
  streak: 0,
  mistakes: 0,
  hintsUsed: 0,
  solvedCells: 0,
  totalCells: 0,
};

const EMPTY_STATE: GameState = {
  grid: [],
  userGrid: [],
  revealed: [],
  placedIdioms: [],
  selectedCell: null,
  candidates: [],
  isComplete: false,
  level: 1,
  stats: EMPTY_STATS,
  toast: null,
  isReady: false,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

function cloneGrid<T>(grid: T[][]) {
  return grid.map((row) => [...row]);
}

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

function getTotalCells(grid: (GridCell | null)[][]) {
  return grid.flat().filter(Boolean).length;
}

function countSolvedCells(
  grid: (GridCell | null)[][],
  userGrid: string[][],
  revealed: boolean[][]
) {
  let solved = 0;

  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      if (revealed[y][x] || userGrid[y][x] === cell.char) {
        solved += 1;
      }
    });
  });

  return solved;
}

function findNextEditableCell(
  grid: (GridCell | null)[][],
  revealed: boolean[][],
  userGrid: string[][],
  start?: SelectedCell
): SelectedCell {
  if (!grid.length) return null;

  const coordinates: [number, number][] = [];
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && !revealed[y][x] && userGrid[y][x] !== cell.char) {
        coordinates.push([y, x]);
      }
    });
  });

  if (!coordinates.length) return null;
  if (!start) return coordinates[0];

  const index = coordinates.findIndex(([row, col]) => row === start[0] && col === start[1]);
  return coordinates[(index + 1 + coordinates.length) % coordinates.length];
}

function getIdiomForCell(placedIdioms: PlacedIdiom[], grid: (GridCell | null)[][], cell: SelectedCell) {
  if (!cell) return null;

  const [row, col] = cell;
  const target = grid[row]?.[col];
  if (!target) return null;

  return (
    placedIdioms.find(({ idiom, x, y, direction }) => {
      for (let offset = 0; offset < idiom.word.length; offset += 1) {
        const idiomRow = direction === 'V' ? y + offset : y;
        const idiomCol = direction === 'H' ? x + offset : x;
        if (idiomRow === row && idiomCol === col) {
          return true;
        }
      }
      return false;
    }) ?? null
  );
}

function createLevelState(level: number, previousScore = 0): GameState {
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
    toast: {
      id: Date.now(),
      text: `第 ${level} 關開始，找出所有成語。`,
      tone: 'warning',
    },
    isReady: true,
  };
}

function toPersistedState(state: GameState): PersistedGameState {
  return {
    grid: state.grid,
    userGrid: state.userGrid,
    revealed: state.revealed,
    placedIdioms: state.placedIdioms,
    selectedCell: state.selectedCell,
    candidates: state.candidates,
    isComplete: state.isComplete,
    level: state.level,
    stats: state.stats,
  };
}

function isValidPersistedState(value: unknown): value is PersistedGameState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PersistedGameState>;
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

function fromPersistedState(saved: PersistedGameState): GameState {
  return {
    ...saved,
    toast: {
      id: Date.now(),
      text: `已恢復到第 ${saved.level} 關`,
      tone: 'warning',
    },
    isReady: true,
  };
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(EMPTY_STATE);

  const initLevel = useCallback((level: number, previousScore = 0) => {
    setState(createLevelState(level, previousScore));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setState(createLevelState(1));
          return;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!isValidPersistedState(parsed)) {
          setState(createLevelState(1));
          return;
        }

        setState(fromPersistedState(parsed));
      } catch {
        setState(createLevelState(1));
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!state.isReady) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedState(state)));
  }, [state]);

  useEffect(() => {
    if (!state.toast) return undefined;

    const timer = window.setTimeout(() => {
      setState((prev) => (prev.toast?.id === state.toast?.id ? { ...prev, toast: null } : prev));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [state.toast]);

  const currentIdiom = useMemo(
    () => getIdiomForCell(state.placedIdioms, state.grid, state.selectedCell),
    [state.placedIdioms, state.grid, state.selectedCell]
  );

  const progressPercent = useMemo(() => {
    if (!state.stats.totalCells) return 0;
    return Math.round((state.stats.solvedCells / state.stats.totalCells) * 100);
  }, [state.stats.solvedCells, state.stats.totalCells]);

  const selectCell = useCallback((row: number, col: number) => {
    setState((prev) => {
      if (!prev.grid[row]?.[col] || prev.revealed[row][col]) return prev;
      return { ...prev, selectedCell: [row, col] };
    });
  }, []);

  const clearSelectedCell = useCallback(() => {
    setState((prev) => {
      if (!prev.selectedCell) return prev;

      const [row, col] = prev.selectedCell;
      if (prev.revealed[row][col]) return prev;

      const userGrid = cloneGrid(prev.userGrid);
      userGrid[row][col] = '';

      return { ...prev, userGrid };
    });
  }, []);

  const clearCell = useCallback((row: number, col: number) => {
    setState((prev) => {
      if (!prev.grid[row]?.[col] || prev.revealed[row][col]) return prev;
      if (!prev.userGrid[row][col]) return { ...prev, selectedCell: [row, col] };

      const userGrid = cloneGrid(prev.userGrid);
      userGrid[row][col] = '';

      return {
        ...prev,
        userGrid,
        selectedCell: [row, col],
        toast: {
          id: Date.now(),
          text: '已清空這一格',
          tone: 'warning',
        },
      };
    });
  }, []);

  const fillCell = useCallback((char: string) => {
    setState((prev) => {
      if (!prev.selectedCell || prev.isComplete) return prev;

      const [row, col] = prev.selectedCell;
      const targetCell = prev.grid[row][col];
      if (!targetCell || prev.revealed[row][col]) return prev;

      const userGrid = cloneGrid(prev.userGrid);
      userGrid[row][col] = char;

      const isCorrect = targetCell.char === char;
      const nextRevealed = cloneGrid(prev.revealed);
      const nextCandidates = [...prev.candidates];
      let nextSelectedCell: SelectedCell = prev.selectedCell;
      let nextScore = prev.stats.score;
      let nextStreak = prev.stats.streak;
      let nextMistakes = prev.stats.mistakes;
      let toast: ToastMessage | null = null;

      if (isCorrect) {
        nextRevealed[row][col] = true;
        userGrid[row][col] = '';

        const consumedIndex = nextCandidates.indexOf(char);
        if (consumedIndex >= 0) nextCandidates.splice(consumedIndex, 1);

        nextStreak += 1;
        nextScore += 10 + Math.min(nextStreak, 5) * 2;
        toast = {
          id: Date.now(),
          text: nextStreak >= 3 ? `連擊 ${nextStreak} 次` : '答對了',
          tone: 'success',
        };
      } else {
        nextStreak = 0;
        nextMistakes += 1;
        nextScore = Math.max(0, nextScore - 3);
        toast = {
          id: Date.now(),
          text: '這個字不對，再想想',
          tone: 'error',
        };
      }

      const solvedCells = countSolvedCells(prev.grid, userGrid, nextRevealed);
      const isComplete = solvedCells === prev.stats.totalCells;
      nextSelectedCell = isComplete
        ? null
        : findNextEditableCell(prev.grid, nextRevealed, userGrid, prev.selectedCell);

      return {
        ...prev,
        userGrid,
        revealed: nextRevealed,
        candidates: nextCandidates,
        selectedCell: nextSelectedCell,
        isComplete,
        stats: {
          ...prev.stats,
          score: isComplete ? nextScore + Math.max(20 - prev.stats.hintsUsed * 2, 6) : nextScore,
          streak: nextStreak,
          mistakes: nextMistakes,
          solvedCells,
        },
        toast: isComplete
          ? {
              id: Date.now(),
              text: `第 ${prev.level} 關完成`,
              tone: 'success',
            }
          : toast,
      };
    });
  }, []);

  const useHint = useCallback(() => {
    setState((prev) => {
      if (prev.isComplete) return prev;

      const targetCell =
        prev.selectedCell && !prev.revealed[prev.selectedCell[0]][prev.selectedCell[1]]
          ? prev.selectedCell
          : findNextEditableCell(prev.grid, prev.revealed, prev.userGrid);

      if (!targetCell) return prev;

      const [row, col] = targetCell;
      const cell = prev.grid[row][col];
      if (!cell) return prev;

      const revealed = cloneGrid(prev.revealed);
      const userGrid = cloneGrid(prev.userGrid);
      revealed[row][col] = true;
      userGrid[row][col] = '';

      const consumedIndex = prev.candidates.indexOf(cell.char);
      const candidates = [...prev.candidates];
      if (consumedIndex >= 0) candidates.splice(consumedIndex, 1);

      const solvedCells = countSolvedCells(prev.grid, userGrid, revealed);
      const isComplete = solvedCells === prev.stats.totalCells;
      const selectedCell = isComplete ? null : findNextEditableCell(prev.grid, revealed, userGrid, targetCell);

      return {
        ...prev,
        revealed,
        userGrid,
        candidates,
        selectedCell,
        isComplete,
        stats: {
          ...prev.stats,
          score: Math.max(0, prev.stats.score - 5),
          streak: 0,
          hintsUsed: prev.stats.hintsUsed + 1,
          solvedCells,
        },
        toast: {
          id: Date.now(),
          text: `提示：${cell.char}`,
          tone: 'warning',
        },
      };
    });
  }, []);

  const nextLevel = useCallback(() => {
    initLevel(state.level + 1, state.stats.score);
  }, [initLevel, state.level, state.stats.score]);

  const resetLevel = useCallback(() => {
    initLevel(state.level, Math.max(0, state.stats.score - 10));
  }, [initLevel, state.level, state.stats.score]);

  return (
    <GameContext.Provider
      value={{
        ...state,
        currentIdiom,
        progressPercent,
        selectCell,
        clearCell,
        fillCell,
        clearSelectedCell,
        useHint,
        nextLevel,
        resetLevel,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
}
