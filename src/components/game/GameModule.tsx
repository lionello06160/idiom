'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lightbulb,
  RotateCcw,
  Smartphone,
  Sparkles,
  Target,
  Trophy,
  TriangleAlert,
  ChevronRight,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BOARD_FRAME_CLASS = cn(
  'aspect-square max-h-full w-[min(100%,calc(100dvh-19rem))]',
  'sm:w-[min(100%,calc(100dvh-24rem))]',
  'lg:w-[min(100%,calc(100dvh-2rem))]',
  'xl:w-[min(100%,calc(100dvh-2.5rem))]'
);

function toneClassName(tone: 'success' | 'warning' | 'error') {
  switch (tone) {
    case 'success':
      return 'bg-emerald-500/90 text-white';
    case 'error':
      return 'bg-rose-500/90 text-white';
    default:
      return 'bg-slate-800/80 text-white';
  }
}

function syncStatusCopy(status: 'connecting' | 'synced' | 'syncing' | 'offline') {
  switch (status) {
    case 'connecting':
      return {
        label: '連線中',
        className: 'bg-slate-500',
      };
    case 'syncing':
      return {
        label: '同步中',
        className: 'bg-amber-500',
      };
    case 'offline':
      return {
        label: '離線',
        className: 'bg-rose-500',
      };
    default:
      return {
        label: '已同步',
        className: 'bg-emerald-500',
      };
  }
}

function playToneSequence(
  context: AudioContext,
  tones: Array<{ frequency: number; duration: number; gain: number }>,
  type: OscillatorType = 'sine'
) {
  const gainBoost = 1.7;
  let offset = context.currentTime;

  tones.forEach(({ frequency, duration, gain }) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, offset);

    gainNode.gain.setValueAtTime(0.0001, offset);
    gainNode.gain.exponentialRampToValueAtTime(Math.min(gain * gainBoost, 0.12), offset + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, offset + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(offset);
    oscillator.stop(offset + duration);

    offset += duration * 0.92;
  });
}

function GameSoundEffects() {
  const { toast, isComplete } = useGame();
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const lastToastIdRef = React.useRef<number | null>(null);
  const completedRef = React.useRef(false);

  const ensureAudioContext = React.useCallback(async () => {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => null);
    }

    return audioContextRef.current;
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const unlockAudio = () => {
      void ensureAudioContext();
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [ensureAudioContext]);

  React.useEffect(() => {
    if (!toast || toast.id === lastToastIdRef.current) return;
    lastToastIdRef.current = toast.id;

    void ensureAudioContext().then((context) => {
      if (!context) return;

      if (toast.tone === 'error') {
        playToneSequence(
          context,
          [
            { frequency: 280, duration: 0.12, gain: 0.045 },
            { frequency: 220, duration: 0.16, gain: 0.04 },
          ],
          'triangle'
        );
        return;
      }

      if (toast.tone === 'success' && !isComplete) {
        playToneSequence(
          context,
          [
            { frequency: 523.25, duration: 0.09, gain: 0.028 },
            { frequency: 659.25, duration: 0.12, gain: 0.032 },
          ],
          'sine'
        );
      }
    });
  }, [ensureAudioContext, isComplete, toast]);

  React.useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      void ensureAudioContext().then((context) => {
        if (!context) return;

        playToneSequence(
          context,
          [
            { frequency: 523.25, duration: 0.16, gain: 0.03 },
            { frequency: 659.25, duration: 0.16, gain: 0.035 },
            { frequency: 783.99, duration: 0.2, gain: 0.04 },
            { frequency: 1046.5, duration: 0.34, gain: 0.05 },
          ],
          'sine'
        );
      });
    }

    if (!isComplete) {
      completedRef.current = false;
    }
  }, [ensureAudioContext, isComplete]);

  return null;
}

function MobileLandscapePrompt() {
  const [isPortraitMobile, setIsPortraitMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOrientationState = () => {
      const isMobileViewport = window.innerWidth < 1024;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobileViewport && isPortrait);
    };

    updateOrientationState();

    const orientationApi = (window.screen as Screen & {
      orientation?: {
        lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
      };
    }).orientation;

    if (window.innerWidth < 1024 && orientationApi?.lock) {
      void orientationApi.lock('landscape').catch(() => {
        // Mobile browsers often require fullscreen/PWA context for orientation lock.
      });
    }

    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', updateOrientationState);

    return () => {
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', updateOrientationState);
    };
  }, []);

  if (!isPortraitMobile) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#f5eed8] px-6 text-center lg:hidden">
      <div className="max-w-sm rounded-[2rem] border border-white/60 bg-white/70 px-6 py-8 shadow-[0_18px_40px_rgba(114,98,57,0.12)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Smartphone size={30} />
        </div>
        <p className="mt-5 text-xl font-black text-foreground">請將手機橫向使用</p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          這個遊戲在手機上已改成橫向版面。旋轉裝置後，棋盤與選字池會完整顯示。
        </p>
      </div>
    </div>
  );
}

export function GameRoot({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children);
  const [header, board, dock, overlay] = childArray;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-2 py-2 sm:px-4 sm:py-4 lg:px-5 lg:py-5 xl:px-6">
      <MobileLandscapePrompt />
      <div className="animate-float absolute left-[-10%] top-[-10%] hidden h-64 w-64 rounded-full bg-secondary/10 blur-3xl lg:block" />
      <div
        className="absolute bottom-[-10%] right-[-10%] hidden h-64 w-64 rounded-full bg-accent/10 blur-3xl lg:block"
        style={{ animationDelay: '1.5s' }}
      />

      <div className="game-shell relative z-10 h-full min-h-0 w-full">
        <div className="game-header-slot">
          {header}
        </div>
        <div className="game-board-slot">
          {board}
        </div>
        <div className="game-dock-slot">
          <div className="game-dock-inner">{dock}</div>
        </div>
        <GameSoundEffects />
        {overlay}
      </div>
    </div>
  );
}

export function GameHeader() {
  const {
    level,
    stats,
    progressPercent,
    currentIdiom,
    syncStatus,
    toast,
    useHint,
    resetLevel,
    isReady,
  } = useGame();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const syncCopy = syncStatusCopy(syncStatus);

  if (!isReady) {
    return (
      <div className="glass flex min-h-[240px] w-full items-center justify-center rounded-[1.75rem] p-6 sm:min-h-[320px] sm:rounded-[2rem] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/50">Idiom Grid</p>
          <p className="title-gradient text-2xl font-black sm:text-3xl">載入進度中</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-2 text-center sm:space-y-4 lg:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-left">
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/50 sm:text-sm sm:tracking-[0.3em] lg:block">Idiom Grid</p>
          <div className="mt-0.5 flex items-center gap-2 sm:mt-1 sm:gap-3">
            <h1 className="title-gradient text-xl font-black sm:text-3xl">Level {level}</h1>
            <span
              aria-label={syncCopy.label}
              title={syncCopy.label}
              className={cn(
                'inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.45)] sm:h-3 sm:w-3',
                syncCopy.className
              )}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={useHint}
            className="glass min-h-10 min-w-10 rounded-full p-2 transition-colors hover:bg-white/40 sm:min-h-11 sm:min-w-11 sm:p-2.5"
            aria-label="使用提示"
          >
            <Lightbulb size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirm((prev) => !prev)}
            className="glass min-h-10 min-w-10 rounded-full p-2 transition-colors hover:bg-white/40 sm:min-h-11 sm:min-w-11 sm:p-2.5"
            aria-label="重新開始本關"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div className="glass rounded-[1.25rem] p-3 text-left sm:hidden">
        <div className="grid grid-cols-4 gap-1.5 text-[11px]">
          <div>
            <p className="text-foreground/55">分數</p>
            <p className="mt-0.5 text-lg font-black leading-none text-primary">{stats.score}</p>
          </div>
          <div>
            <p className="text-foreground/55">連擊</p>
            <p className="mt-0.5 text-lg font-black leading-none text-secondary">{stats.streak}</p>
          </div>
          <div>
            <p className="text-foreground/55">錯誤</p>
            <p className="mt-0.5 text-lg font-black leading-none text-accent">{stats.mistakes}</p>
          </div>
          <div>
            <p className="text-foreground/55">提示</p>
            <p className="mt-0.5 text-[1.25rem] font-black leading-none text-foreground">{stats.hintsUsed}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-foreground/70">
            <span>進度 {progressPercent}%</span>
            <span>
              {stats.solvedCells}/{stats.totalCells}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-3 border-t border-white/40 pt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/60">
            {currentIdiom ? <Target size={13} /> : <Sparkles size={13} />}
            {currentIdiom ? '選取中的成語' : '玩法提示'}
          </p>
          <p className="mt-1 text-[1rem] leading-snug text-foreground/80">
            {currentIdiom
              ? currentIdiom.idiom.definition
              : '點格子後從下方選字。答對會自動推進，答錯會扣分，卡關時可以使用提示。'}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showResetConfirm ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="glass absolute right-0 top-14 z-30 w-[260px] rounded-[1.5rem] p-4 text-left shadow-xl sm:w-[280px]"
          >
            <p className="text-sm font-semibold text-foreground">重新開始本關？</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              目前進度會清空，並扣除 10 分。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-foreground/70 transition hover:bg-white/50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  resetLevel();
                }}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-primary/90"
              >
                確認重開
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="hidden glass text-left sm:block sm:rounded-[1.75rem] sm:p-5 lg:p-5">
        <div className="space-y-3 lg:space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-medium text-foreground/60 lg:text-[15px]">分數</p>
            <p className="text-right text-[2.2rem] font-black leading-none text-primary lg:text-[2.45rem]">{stats.score}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-medium text-foreground/60 lg:text-[15px]">連擊</p>
            <p className="text-right text-[2.2rem] font-black leading-none text-secondary lg:text-[2.45rem]">{stats.streak}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-medium text-foreground/60 lg:text-[15px]">錯誤</p>
            <p className="text-right text-[2.2rem] font-black leading-none text-accent lg:text-[2.45rem]">{stats.mistakes}</p>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[17px] font-medium text-foreground/60 lg:text-[17px]">提示</p>
            <p className="text-right text-[2.325rem] font-black leading-none text-foreground lg:text-[2.575rem]">{stats.hintsUsed}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-white/35 pt-4 lg:mt-4 lg:pt-3.5">
          <div className="mb-2.5 flex items-center justify-between text-[14px] font-semibold text-foreground/75 lg:mb-2 lg:text-[15px]">
            <span>進度 {progressPercent}%</span>
            <span>
              {stats.solvedCells}/{stats.totalCells}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/50 lg:h-2.5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="hidden glass min-h-[82px] rounded-[1.25rem] p-3 sm:block sm:min-h-[170px] sm:rounded-[1.75rem] sm:p-6 lg:min-h-[180px] lg:p-6">
        <AnimatePresence mode="wait">
          {currentIdiom ? (
            <motion.div
              key={currentIdiom.idiom.word}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex min-h-full flex-col items-center justify-center space-y-2"
            >
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-foreground/60 sm:gap-2 sm:text-sm lg:text-sm">
                <Target size={14} />
                選取中的成語
              </p>
              <p className="text-center text-[1rem] leading-snug text-foreground sm:text-[1.125rem] sm:leading-relaxed lg:text-[1.125rem] lg:leading-relaxed">{currentIdiom.idiom.definition}</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex min-h-full flex-col items-center justify-center space-y-2"
            >
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-foreground/60 sm:gap-2 sm:text-sm lg:text-sm">
                <Sparkles size={14} />
                玩法提示
              </p>
              <p className="text-center text-[1rem] leading-snug text-foreground/70 sm:text-[1.125rem] sm:leading-relaxed lg:text-[1.125rem] lg:leading-relaxed">
                點格子後從下方選字。答對會自動推進，答錯會扣分，卡關時可以使用提示。
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn('absolute -bottom-3 left-1/2 z-20 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-bold shadow-lg sm:-bottom-4 sm:text-sm', toneClassName(toast.tone))}
          >
            {toast.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function GameBoard() {
  const { grid, userGrid, revealed, selectedCell, selectCell, clearCell, highlightedCells, isReady } = useGame();

  if (!isReady) {
    return <div className={cn(BOARD_FRAME_CLASS, 'glass rounded-[1.5rem] sm:rounded-[2.5rem]')} />;
  }

  return (
    <div
      className={cn(
        BOARD_FRAME_CLASS,
        'rounded-[1.5rem] border border-white/50 bg-grid-bg/55 p-[clamp(0.5rem,1.2vw,2rem)] shadow-xl backdrop-blur-sm sm:rounded-[2.5rem]'
      )}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8 gap-[clamp(0.18rem,0.55vw,1rem)]">
        {grid.map((row, y) =>
          row.map((cell, x) => {
            if (!cell) {
              return (
                <div
                  key={`${y}-${x}`}
                  className="h-full w-full"
                />
              );
            }

            const isSelected = selectedCell?.[0] === y && selectedCell?.[1] === x;
            const isSolved = revealed[y][x];
            const guess = userGrid[y][x];
            const isWrong = Boolean(guess) && !isSolved && guess !== cell.char;
            const isHighlightedPath = highlightedCells.some(([row, col]) => row === y && col === x);

            return (
              <motion.button
                key={`${y}-${x}`}
                type="button"
                whileHover={{ scale: !isSolved ? 1.05 : 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (isWrong) {
                    clearCell(y, x);
                    return;
                  }

                  selectCell(y, x);
                }}
                className={cn(
                  'cell-shadow relative flex h-full w-full items-center justify-center rounded-[clamp(0.8rem,1.5vw,1.35rem)] text-[clamp(1rem,4.2vw,2.7rem)] font-bold transition-all duration-200',
                  isSelected && 'z-10 ring-2 ring-primary/90 ring-offset-2 ring-offset-[#f5eed1] shadow-[0_0_0_5px_rgba(38,139,210,0.18),0_10px_18px_rgba(38,139,210,0.18)] sm:ring-4 sm:ring-offset-4 sm:shadow-[0_0_0_6px_rgba(38,139,210,0.18),0_18px_30px_rgba(38,139,210,0.18)]',
                  isHighlightedPath && !isSelected && 'bg-sky-100 text-primary shadow-[0_6px_16px_rgba(38,139,210,0.12)] sm:shadow-[0_10px_24px_rgba(38,139,210,0.12)]',
                  isSolved && 'bg-primary text-white',
                  !isSolved && !isHighlightedPath && 'cursor-pointer bg-white text-primary',
                  !isSolved && !guess && 'bg-secondary/20',
                  isWrong && 'bg-rose-500 text-white'
                )}
              >
                {isSelected && !isSolved ? (
                  <span className="pointer-events-none absolute inset-0.5 rounded-[0.62rem] border border-primary/35 bg-sky-100/85 sm:inset-1 sm:rounded-[1.05rem] sm:border-2" />
                ) : null}
                {isSelected && !isSolved ? (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-white bg-primary shadow-md sm:-right-1.5 sm:-top-1.5 sm:h-4.5 sm:w-4.5 sm:border-2" />
                ) : null}
                {isSolved ? cell.char : guess}
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function GameDock() {
  const { candidates, fillCell, selectedCell, isReady } = useGame();

  if (!isReady) return null;

  return (
    <div className="w-full space-y-2 overflow-hidden sm:space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex items-center justify-between text-[11px] font-semibold text-foreground/70 sm:text-sm">
        <span>選字池</span>
        <span className="text-[10px] text-foreground/55 sm:text-xs">點錯字可直接點格子清空</span>
      </div>

      <div className="glass rounded-[1.25rem] p-2 sm:rounded-[1.75rem] sm:p-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:p-4">
        <div className="grid grid-cols-6 content-start gap-1.5 sm:grid-cols-4 sm:gap-3">
          {candidates.map((char, index) => (
            <motion.button
              key={`${char}-${index}`}
              type="button"
              whileHover={{ y: -4, scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fillCell(char)}
              disabled={!selectedCell}
              className={cn(
                'min-h-10 w-full rounded-[0.85rem] border-b-3 border-primary/20 bg-white px-1 text-[1.5rem] font-bold text-primary shadow-md transition-all hover:shadow-lg sm:h-16 sm:rounded-2xl sm:border-b-4 sm:text-3xl',
                !selectedCell && 'cursor-not-allowed grayscale opacity-50'
              )}
            >
              {char}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GameOverlay() {
  const { isComplete, nextLevel, level, stats, isReady } = useGame();

  if (!isReady) return null;

  return (
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.5, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-10 text-center"
          >
            <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-primary via-accent to-secondary" />

            <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4 text-primary">
              <Trophy size={48} />
            </div>

            <h2 className="title-gradient text-4xl font-black">過關了</h2>
            <p className="mt-3 text-lg text-foreground/70">第 {level} 關已完成，下一關會更少提示、更高密度。</p>

            <div className="my-6 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-100 p-3">
                <p className="text-foreground/55">分數</p>
                <p className="mt-1 text-xl font-black text-primary">{stats.score}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3">
                <p className="text-foreground/55">錯誤</p>
                <p className="mt-1 text-xl font-black text-accent">{stats.mistakes}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3">
                <p className="text-foreground/55">提示</p>
                <p className="mt-1 text-xl font-black text-secondary">{stats.hintsUsed}</p>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              <TriangleAlert size={16} />
              重開本關會扣 10 分，提示每次扣 5 分
            </div>

            <button
              type="button"
              onClick={nextLevel}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-xl font-bold text-white shadow-lg shadow-primary/30 transition-all hover:gap-4"
            >
              下一關 <ChevronRight />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
