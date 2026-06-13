'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PlacedIdiom } from '@/lib/generator';
import {
  cloneGrid,
  countSolvedCells,
  createEmptySharedLevelState,
  findNextEditableCell,
  findNextEditableCellInIdiom,
  getIdiomCells,
  getIdiomForCell,
  getPlacedIdiomKey,
  type SelectedCell,
  type SharedGameState,
  type ToastMessage,
} from '@/lib/game-shared';

interface GameState extends SharedGameState {
  toast: ToastMessage | null;
  isReady: boolean;
  isAdvancing: boolean;
  isResetting: boolean;
  answerEffect: {
    id: number;
    row: number;
    col: number;
    kind: 'correct' | 'wrong';
    streak: number;
  } | null;
  idiomEffect: {
    id: number;
    word: string;
    definition: string;
    streak: number;
  } | null;
  nextLevelStatus: 'idle' | 'loading' | 'ready' | 'error';
  syncVersion: number;
  syncStatus: 'connecting' | 'synced' | 'syncing' | 'offline';
}

interface ServerSnapshot {
  state: SharedGameState;
  version: number;
}

interface PrefetchedSnapshot {
  state: SharedGameState;
}

interface GameContextType extends GameState {
  progressPercent: number;
  currentIdiom: PlacedIdiom | null;
  highlightedCells: [number, number][];
  isNextLevelReady: boolean;
  selectCell: (row: number, col: number) => void;
  clearCell: (row: number, col: number) => void;
  fillCell: (char: string) => void;
  useHint: () => void;
  nextLevel: () => void;
  resetLevel: () => void;
}

const EMPTY_STATE: GameState = {
  ...createEmptySharedLevelState(1),
  isReady: false,
  isAdvancing: false,
  isResetting: false,
  answerEffect: null,
  idiomEffect: null,
  nextLevelStatus: 'idle',
  toast: null,
  syncVersion: 0,
  syncStatus: 'connecting',
};

const GameContext = createContext<GameContextType | undefined>(undefined);

async function fetchServerSnapshot(): Promise<ServerSnapshot> {
  const response = await fetch('/api/game-state', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load shared game state');
  return response.json();
}

async function requestGeneratedSnapshot(
  action: 'nextLevel' | 'resetLevel',
  level: number,
  previousScore: number
): Promise<ServerSnapshot> {
  const response = await fetch('/api/game-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, level, previousScore }),
  });

  if (!response.ok) throw new Error('Failed to generate next shared game state');
  return response.json();
}

async function requestPrefetchedSnapshot(level: number, previousScore: number): Promise<PrefetchedSnapshot> {
  const response = await fetch('/api/game-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'prefetchLevel', level, previousScore }),
  });

  if (!response.ok) throw new Error('Failed to prefetch shared game state');
  return response.json();
}

async function commitGeneratedState(state: SharedGameState): Promise<ServerSnapshot> {
  const response = await fetch('/api/game-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) throw new Error('Failed to activate shared game state');
  return response.json();
}

function withToast(state: SharedGameState, version: number, toast: ToastMessage | null): GameState {
  return {
    ...state,
    toast,
    isReady: true,
    isAdvancing: false,
    isResetting: false,
    answerEffect: null,
    idiomEffect: null,
    nextLevelStatus: 'loading',
    syncVersion: version,
    syncStatus: 'synced',
  };
}

function isPlacedIdiomSolved(
  placed: PlacedIdiom,
  grid: SharedGameState['grid'],
  userGrid: SharedGameState['userGrid'],
  revealed: SharedGameState['revealed']
) {
  return getIdiomCells(placed).every(([row, col]) => {
    const cell = grid[row]?.[col];
    return Boolean(cell && (revealed[row][col] || userGrid[row][col] === cell.char));
  });
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(EMPTY_STATE);
  const syncVersionRef = useRef(0);
  const syncingRef = useRef(false);
  const pendingSyncRef = useRef<SharedGameState | null>(null);
  const syncStatusTimeoutRef = useRef<number | null>(null);
  const prefetchedLevelRef = useRef<SharedGameState | null>(null);
  const prefetchingLevelRef = useRef<number | null>(null);

  const scheduleSyncedState = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (syncStatusTimeoutRef.current) {
      window.clearTimeout(syncStatusTimeoutRef.current);
    }

    syncStatusTimeoutRef.current = window.setTimeout(() => {
      setState((prev) => ({ ...prev, syncStatus: 'synced' }));
      syncStatusTimeoutRef.current = null;
    }, 600);
  }, []);

  const pushStateToServer = useCallback(async (nextState: SharedGameState, toast: ToastMessage | null) => {
    pendingSyncRef.current = nextState;
    if (syncingRef.current) return;

    syncingRef.current = true;
    setState((prev) => ({ ...prev, syncStatus: 'syncing' }));

    while (pendingSyncRef.current) {
      const payload = pendingSyncRef.current;
      pendingSyncRef.current = null;

      const response = await fetch('/api/game-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: payload }),
      });

      if (!response.ok) {
        syncingRef.current = false;
        setState((prev) => ({ ...prev, syncStatus: 'offline' }));
        throw new Error('Failed to sync shared game state');
      }

      const snapshot = (await response.json()) as ServerSnapshot;
      syncVersionRef.current = snapshot.version;
      setState((prev) => ({
        ...withToast(snapshot.state, snapshot.version, toast),
        answerEffect: prev.answerEffect,
        idiomEffect: prev.idiomEffect,
        syncStatus: 'syncing',
      }));
    }

    syncingRef.current = false;
    scheduleSyncedState();
  }, [scheduleSyncedState]);

  const applyLocalUpdate = useCallback(
    (
      updater: (
        prev: SharedGameState
      ) => {
        next: SharedGameState;
        toast: ToastMessage | null;
        answerEffect?: GameState['answerEffect'];
        idiomEffect?: GameState['idiomEffect'];
      } | null
    ) => {
      setState((prev) => {
        const result = updater(prev);
        if (!result) return prev;

        const nextState = {
          ...result.next,
          isReady: true,
          isAdvancing: prev.isAdvancing,
          isResetting: prev.isResetting,
          answerEffect: result.answerEffect ?? prev.answerEffect,
          idiomEffect: result.idiomEffect ?? prev.idiomEffect,
          nextLevelStatus: prev.nextLevelStatus,
          syncVersion: prev.syncVersion,
          toast: result.toast,
          syncStatus: 'syncing' as const,
        };

        void pushStateToServer(result.next, result.toast);
        return nextState;
      });
    },
    [pushStateToServer]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const snapshot = await fetchServerSnapshot();
        if (!active) return;

        syncVersionRef.current = snapshot.version;
        setState(
          {
            ...withToast(snapshot.state, snapshot.version, {
              id: Date.now(),
              text: `已連線到共享棋盤`,
              tone: 'warning',
            }),
            syncStatus: 'synced',
          }
        );
      } catch {
        if (!active) return;
        const fallback = createEmptySharedLevelState(1);
        setState({ ...withToast(fallback, 0, { id: Date.now(), text: '離線模式', tone: 'warning' }), syncStatus: 'offline' });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.isReady) return undefined;

    const stream = new EventSource('/api/game-stream');

    stream.onopen = () => {
      setState((prev) => ({ ...prev, syncStatus: syncingRef.current ? 'syncing' : 'synced' }));
    };

    stream.onerror = () => {
      setState((prev) => ({ ...prev, syncStatus: 'offline' }));
    };

    stream.addEventListener('update', async (event) => {
      const { version } = JSON.parse((event as MessageEvent).data) as { version: number };
      if (version <= syncVersionRef.current) return;

      const snapshot = await fetchServerSnapshot().catch(() => null);
      if (!snapshot) return;
      if (snapshot.version <= syncVersionRef.current) return;

      syncVersionRef.current = snapshot.version;
      setState((prev) =>
        ({
          ...withToast(
            snapshot.state,
            snapshot.version,
            prev.toast ?? { id: Date.now(), text: '其他裝置已更新棋盤', tone: 'warning' }
          ),
          syncStatus: 'synced',
        })
      );
    });

    return () => stream.close();
  }, [state.isReady]);

  useEffect(() => {
    return () => {
      if (syncStatusTimeoutRef.current) {
        window.clearTimeout(syncStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state.toast) return undefined;

    const timer = window.setTimeout(() => {
      setState((prev) => (prev.toast?.id === state.toast?.id ? { ...prev, toast: null } : prev));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [state.toast]);

  useEffect(() => {
    if (!state.idiomEffect) return undefined;

    const timer = window.setTimeout(() => {
      setState((prev) => (prev.idiomEffect?.id === state.idiomEffect?.id ? { ...prev, idiomEffect: null } : prev));
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [state.idiomEffect]);

  useEffect(() => {
    if (!state.isReady) return;

    const targetLevel = state.level + 1;
    if (prefetchedLevelRef.current?.level === targetLevel) return;
    if (prefetchingLevelRef.current === targetLevel) return;

    setState((prev) =>
      prev.nextLevelStatus === 'ready' && prefetchedLevelRef.current?.level === targetLevel
        ? prev
        : { ...prev, nextLevelStatus: 'loading' }
    );
    prefetchingLevelRef.current = targetLevel;

    void requestPrefetchedSnapshot(targetLevel, 0)
      .then((snapshot) => {
        if (prefetchingLevelRef.current !== targetLevel) return;
        prefetchedLevelRef.current = snapshot.state;
        setState((prev) => ({ ...prev, nextLevelStatus: 'ready' }));
      })
      .catch(() => {
        if (prefetchingLevelRef.current === targetLevel) {
          prefetchedLevelRef.current = null;
          setState((prev) => ({ ...prev, nextLevelStatus: 'error' }));
        }
      })
      .finally(() => {
        if (prefetchingLevelRef.current === targetLevel) {
          prefetchingLevelRef.current = null;
        }
      });
  }, [state.isReady, state.level]);

  const currentIdiom = useMemo(
    () => getIdiomForCell(state.placedIdioms, state.grid, state.selectedCell, state.activeIdiomKey),
    [state.activeIdiomKey, state.placedIdioms, state.grid, state.selectedCell]
  );

  const highlightedCells = useMemo(
    () => (currentIdiom ? getIdiomCells(currentIdiom) : []),
    [currentIdiom]
  );

  const progressPercent = useMemo(() => {
    if (!state.stats.totalCells) return 0;
    return Math.round((state.stats.solvedCells / state.stats.totalCells) * 100);
  }, [state.stats.solvedCells, state.stats.totalCells]);

  const selectCell = useCallback(
    (row: number, col: number) => {
      applyLocalUpdate((prev) => {
        if (!prev.grid[row]?.[col] || prev.revealed[row][col]) return null;
        const idiom = getIdiomForCell(prev.placedIdioms, prev.grid, [row, col], prev.activeIdiomKey);
        return {
          next: {
            ...prev,
            selectedCell: [row, col],
            activeIdiomKey: idiom ? getPlacedIdiomKey(idiom) : prev.activeIdiomKey,
          },
          toast: null,
        };
      });
    },
    [applyLocalUpdate]
  );

  const clearCell = useCallback(
    (row: number, col: number) => {
      applyLocalUpdate((prev) => {
        if (!prev.grid[row]?.[col] || prev.revealed[row][col]) return null;
        if (!prev.userGrid[row][col]) {
          const idiom = getIdiomForCell(prev.placedIdioms, prev.grid, [row, col], prev.activeIdiomKey);
          return {
            next: {
              ...prev,
              selectedCell: [row, col],
              activeIdiomKey: idiom ? getPlacedIdiomKey(idiom) : prev.activeIdiomKey,
            },
            toast: null,
          };
        }

        const userGrid = cloneGrid(prev.userGrid);
        userGrid[row][col] = '';
        const idiom = getIdiomForCell(prev.placedIdioms, prev.grid, [row, col], prev.activeIdiomKey);

        return {
          next: {
            ...prev,
            userGrid,
            selectedCell: [row, col],
            activeIdiomKey: idiom ? getPlacedIdiomKey(idiom) : prev.activeIdiomKey,
          },
          toast: { id: Date.now(), text: '已清空這一格', tone: 'warning' },
        };
      });
    },
    [applyLocalUpdate]
  );

  const fillCell = useCallback(
    (char: string) => {
      applyLocalUpdate((prev) => {
        if (!prev.selectedCell || prev.isComplete) return null;

        const [row, col] = prev.selectedCell;
        const targetCell = prev.grid[row][col];
        if (!targetCell || prev.revealed[row][col]) return null;

        const userGrid = cloneGrid(prev.userGrid);
        userGrid[row][col] = char;

        const isCorrect = targetCell.char === char;
        const revealed = cloneGrid(prev.revealed);
        const candidates = [...prev.candidates];
        let selectedCell: SelectedCell = prev.selectedCell;
        let activeIdiomKey = prev.activeIdiomKey;
        let score = prev.stats.score;
        let streak = prev.stats.streak;
        let mistakes = prev.stats.mistakes;
        let toast: ToastMessage | null = null;
        let answerEffect: GameState['answerEffect'] = null;
        let idiomEffect: GameState['idiomEffect'] = null;
        const currentIdiomBefore =
          getIdiomForCell(prev.placedIdioms, prev.grid, prev.selectedCell, prev.activeIdiomKey) ??
          getIdiomForCell(prev.placedIdioms, prev.grid, [row, col], prev.activeIdiomKey);
        const wasCurrentIdiomSolved = currentIdiomBefore
          ? isPlacedIdiomSolved(currentIdiomBefore, prev.grid, prev.userGrid, prev.revealed)
          : false;

        if (isCorrect) {
          revealed[row][col] = true;
          userGrid[row][col] = '';

          const consumedIndex = candidates.indexOf(char);
          if (consumedIndex >= 0) candidates.splice(consumedIndex, 1);

          streak += 1;
          score += 10 + Math.min(streak, 5) * 2;
          toast = {
            id: Date.now(),
            text: streak >= 3 ? `連擊 ${streak} 次` : '答對了',
            tone: 'success',
          };
          answerEffect = { id: Date.now(), row, col, kind: 'correct', streak };
          if (
            currentIdiomBefore &&
            !wasCurrentIdiomSolved &&
            isPlacedIdiomSolved(currentIdiomBefore, prev.grid, userGrid, revealed)
          ) {
            idiomEffect = {
              id: Date.now() + 1,
              word: currentIdiomBefore.idiom.word,
              definition: currentIdiomBefore.idiom.definition,
              streak,
            };
          }
        } else {
          streak = 0;
          mistakes += 1;
          score = Math.max(0, score - 3);
          toast = {
            id: Date.now(),
            text: '這個字不對，再想想',
            tone: 'error',
          };
          answerEffect = { id: Date.now(), row, col, kind: 'wrong', streak };
        }

        const solvedCells = countSolvedCells(prev.grid, userGrid, revealed);
        const isComplete = solvedCells === prev.stats.totalCells;

        if (isComplete) {
          selectedCell = null;
          activeIdiomKey = null;
          score += Math.max(20 - prev.stats.hintsUsed * 2, 6);
          toast = { id: Date.now(), text: `第 ${prev.level} 關完成`, tone: 'success' };
        } else {
          const currentIdiom = currentIdiomBefore;
          activeIdiomKey = currentIdiom ? getPlacedIdiomKey(currentIdiom) : prev.activeIdiomKey;
          selectedCell =
            findNextEditableCellInIdiom(
              prev.placedIdioms,
              prev.grid,
              revealed,
              userGrid,
              prev.selectedCell,
              activeIdiomKey
            ) ??
            findNextEditableCell(prev.grid, revealed, userGrid, prev.selectedCell);
        }

        return {
          next: {
            ...prev,
            userGrid,
            revealed,
            candidates,
            selectedCell,
            activeIdiomKey,
            isComplete,
            stats: {
              ...prev.stats,
              score,
              streak,
              mistakes,
              solvedCells,
            },
          },
          answerEffect,
          idiomEffect,
          toast,
        };
      });
    },
    [applyLocalUpdate]
  );

  const useHint = useCallback(
    () => {
      applyLocalUpdate((prev) => {
        if (prev.isComplete) return null;

        const targetCell =
          prev.selectedCell && !prev.revealed[prev.selectedCell[0]][prev.selectedCell[1]]
            ? prev.selectedCell
            : findNextEditableCell(prev.grid, prev.revealed, prev.userGrid);

        if (!targetCell) return null;

        const [row, col] = targetCell;
        const cell = prev.grid[row][col];
        if (!cell) return null;

        const revealed = cloneGrid(prev.revealed);
        const userGrid = cloneGrid(prev.userGrid);
        revealed[row][col] = true;
        userGrid[row][col] = '';

        const candidates = [...prev.candidates];
        const consumedIndex = candidates.indexOf(cell.char);
        if (consumedIndex >= 0) candidates.splice(consumedIndex, 1);

        const solvedCells = countSolvedCells(prev.grid, userGrid, revealed);
        const isComplete = solvedCells === prev.stats.totalCells;
        const currentIdiom = getIdiomForCell(prev.placedIdioms, prev.grid, targetCell, prev.activeIdiomKey);
        const activeIdiomKey = currentIdiom ? getPlacedIdiomKey(currentIdiom) : prev.activeIdiomKey;
        const selectedCell = isComplete
          ? null
          : findNextEditableCellInIdiom(
              prev.placedIdioms,
              prev.grid,
              revealed,
              userGrid,
              targetCell,
              activeIdiomKey
            ) ??
            findNextEditableCell(prev.grid, revealed, userGrid, targetCell);

        return {
          next: {
            ...prev,
            revealed,
            userGrid,
            candidates,
            selectedCell,
            activeIdiomKey: isComplete ? null : activeIdiomKey,
            isComplete,
            stats: {
              ...prev.stats,
              score: Math.max(0, prev.stats.score - 5),
              streak: 0,
              hintsUsed: prev.stats.hintsUsed + 1,
              solvedCells,
            },
          },
          toast: { id: Date.now(), text: `提示：${cell.char}`, tone: 'warning' },
        };
      });
    },
    [applyLocalUpdate]
  );

  const nextLevel = useCallback(() => {
    if (state.isAdvancing) return;

    const toast = { id: Date.now(), text: `第 ${state.level + 1} 關開始`, tone: 'warning' } as const;
    const prefetched = prefetchedLevelRef.current;

    if (prefetched?.level === state.level + 1) {
      const nextState: SharedGameState = {
        ...prefetched,
        stats: {
          ...prefetched.stats,
          score: state.stats.score,
        },
      };

      prefetchedLevelRef.current = null;
      setState((prev) => ({
        ...withToast(nextState, prev.syncVersion, toast),
        isAdvancing: true,
        nextLevelStatus: 'loading',
        syncStatus: 'syncing',
      }));

      void commitGeneratedState(nextState)
        .then((snapshot) => {
          syncVersionRef.current = snapshot.version;
          setState({ ...withToast(snapshot.state, snapshot.version, toast), syncStatus: 'syncing' });
          scheduleSyncedState();
        })
        .catch(() => {
          prefetchedLevelRef.current = nextState;
          setState((prev) => ({
            ...prev,
            isAdvancing: false,
            nextLevelStatus: 'ready',
            syncStatus: 'offline',
            toast: { id: Date.now(), text: '下一關同步失敗', tone: 'error' },
          }));
        });
      return;
    }

    setState((prev) => ({ ...prev, isAdvancing: true, nextLevelStatus: 'loading', syncStatus: 'syncing' }));

    void requestGeneratedSnapshot('nextLevel', state.level + 1, state.stats.score)
      .then((snapshot) => {
        syncVersionRef.current = snapshot.version;
        prefetchedLevelRef.current = null;
        setState({ ...withToast(snapshot.state, snapshot.version, toast), syncStatus: 'syncing' });
        scheduleSyncedState();
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          isAdvancing: false,
          nextLevelStatus: 'error',
          syncStatus: 'offline',
          toast: { id: Date.now(), text: '下一關載入失敗', tone: 'error' },
        }));
      });
  }, [scheduleSyncedState, state.isAdvancing, state.level, state.stats.score]);

  const resetLevel = useCallback(() => {
    if (state.isResetting) return;

    const toast = { id: Date.now(), text: `第 ${state.level} 關重新開始`, tone: 'warning' } as const;
    setState((prev) => ({ ...prev, isResetting: true, nextLevelStatus: 'loading', syncStatus: 'syncing' }));
    prefetchedLevelRef.current = null;

    void requestGeneratedSnapshot('resetLevel', state.level, Math.max(0, state.stats.score - 10))
      .then((snapshot) => {
        syncVersionRef.current = snapshot.version;
        setState({ ...withToast(snapshot.state, snapshot.version, toast), syncStatus: 'syncing' });
        scheduleSyncedState();
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          isResetting: false,
          syncStatus: 'offline',
          toast: { id: Date.now(), text: '重新開始失敗', tone: 'error' },
        }));
      });
  }, [scheduleSyncedState, state.isResetting, state.level, state.stats.score]);

  return (
    <GameContext.Provider
      value={{
        ...state,
        currentIdiom,
        highlightedCells,
        progressPercent,
        isNextLevelReady: state.nextLevelStatus === 'ready',
        selectCell,
        clearCell,
        fillCell,
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
