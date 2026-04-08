'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lightbulb,
  RotateCcw,
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

function playToneSequence(
  context: AudioContext,
  tones: Array<{ frequency: number; duration: number; gain: number }>,
  type: OscillatorType = 'sine'
) {
  let offset = context.currentTime;

  tones.forEach(({ frequency, duration, gain }) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, offset);

    gainNode.gain.setValueAtTime(0.0001, offset);
    gainNode.gain.exponentialRampToValueAtTime(gain, offset + 0.02);
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

  const getAudioContext = React.useCallback(() => {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  React.useEffect(() => {
    if (!toast || toast.id === lastToastIdRef.current) return;
    lastToastIdRef.current = toast.id;

    const context = getAudioContext();
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
    }
  }, [getAudioContext, toast]);

  React.useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      const context = getAudioContext();
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
    }

    if (!isComplete) {
      completedRef.current = false;
    }
  }, [getAudioContext, isComplete]);

  return null;
}

export function GameRoot({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children);
  const [header, board, dock, overlay] = childArray;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[1680px] flex-col justify-center overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      <div className="animate-float absolute left-[-10%] top-[-10%] hidden h-64 w-64 rounded-full bg-secondary/10 blur-3xl lg:block" />
      <div
        className="absolute bottom-[-10%] right-[-10%] hidden h-64 w-64 rounded-full bg-accent/10 blur-3xl lg:block"
        style={{ animationDelay: '1.5s' }}
      />

      <div className="relative z-10 grid min-h-[calc(100vh-1.5rem)] w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[340px_minmax(980px,1fr)] lg:grid-rows-1 lg:gap-8">
        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:justify-start lg:gap-5">
          <div className="order-1">{header}</div>
          <div className="order-3">{dock}</div>
        </div>
        <div className="order-2 flex min-h-0 items-center justify-center lg:items-start lg:pt-2">
          {board}
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
    toast,
    useHint,
    resetLevel,
    isReady,
  } = useGame();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

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
    <div className="relative space-y-3 text-center sm:space-y-4 lg:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/50 sm:text-sm sm:tracking-[0.3em]">Idiom Grid</p>
          <h1 className="title-gradient text-2xl font-black sm:text-3xl">Level {level}</h1>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={useHint}
            className="glass min-h-11 min-w-11 rounded-full p-2.5 transition-colors hover:bg-white/40"
            aria-label="使用提示"
          >
            <Lightbulb size={20} />
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirm((prev) => !prev)}
            className="glass min-h-11 min-w-11 rounded-full p-2.5 transition-colors hover:bg-white/40"
            aria-label="重新開始本關"
          >
            <RotateCcw size={20} />
          </button>
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

      <div className="grid grid-cols-4 gap-2 text-left text-xs sm:grid-cols-2 sm:gap-3 sm:text-sm">
        <div className="glass rounded-2xl p-3">
          <p className="text-foreground/55">分數</p>
          <p className="mt-1 text-base font-black text-primary sm:text-xl">{stats.score}</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-foreground/55">連擊</p>
          <p className="mt-1 text-base font-black text-secondary sm:text-xl">{stats.streak}</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-foreground/55">錯誤</p>
          <p className="mt-1 text-base font-black text-accent sm:text-xl">{stats.mistakes}</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <p className="text-foreground/55">提示</p>
          <p className="mt-1 text-base font-black text-foreground sm:text-xl">{stats.hintsUsed}</p>
        </div>
      </div>

      <div className="glass rounded-[1.5rem] p-4 text-left sm:rounded-[1.75rem] sm:p-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground/70 sm:mb-3 sm:text-sm">
          <span>進度 {progressPercent}%</span>
          <span>
            {stats.solvedCells}/{stats.totalCells}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/50">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="glass min-h-[116px] rounded-[1.5rem] p-4 sm:min-h-[180px] sm:rounded-[1.75rem] sm:p-6">
        <AnimatePresence mode="wait">
          {currentIdiom ? (
            <motion.div
              key={currentIdiom.idiom.word}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <p className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground/60 sm:text-sm">
                <Target size={14} />
                選取中的成語
              </p>
              <p className="text-sm leading-relaxed text-foreground sm:text-base">{currentIdiom.idiom.definition}</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <p className="flex items-center justify-center gap-2 text-xs font-semibold text-foreground/60 sm:text-sm">
                <Sparkles size={14} />
                玩法提示
              </p>
              <p className="text-sm leading-relaxed text-foreground/70 sm:text-base">
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
    return <div className="glass min-h-[360px] w-full max-w-[1080px] rounded-[1.75rem] sm:min-h-[940px] sm:rounded-[2.5rem]" />;
  }

  return (
    <div className="w-full max-w-[1080px] rounded-[1.8rem] border border-white/50 bg-grid-bg/55 p-3 shadow-xl backdrop-blur-sm sm:rounded-[2.5rem] sm:p-8">
      <div className="grid grid-cols-8 gap-1.5 sm:gap-4">
        {grid.map((row, y) =>
          row.map((cell, x) => {
            if (!cell) {
              return (
                <div
                  key={`${y}-${x}`}
                  className="h-[clamp(2.5rem,10vw,6rem)] w-[clamp(2.5rem,10vw,6rem)] sm:h-24 sm:w-24"
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
                  'cell-shadow relative flex h-[clamp(2.5rem,10vw,6rem)] w-[clamp(2.5rem,10vw,6rem)] items-center justify-center rounded-[0.95rem] text-[clamp(1.35rem,5.2vw,2.8rem)] font-bold transition-all duration-200 sm:h-24 sm:w-24 sm:rounded-[1.35rem] sm:text-[2.8rem]',
                  isSelected && 'z-10 ring-2 ring-primary/90 ring-offset-2 ring-offset-[#f5eed1] shadow-[0_0_0_5px_rgba(38,139,210,0.18),0_10px_18px_rgba(38,139,210,0.18)] sm:ring-4 sm:ring-offset-4 sm:shadow-[0_0_0_6px_rgba(38,139,210,0.18),0_18px_30px_rgba(38,139,210,0.18)]',
                  isHighlightedPath && !isSelected && 'bg-sky-100 text-primary shadow-[0_6px_16px_rgba(38,139,210,0.12)] sm:shadow-[0_10px_24px_rgba(38,139,210,0.12)]',
                  isSolved && 'bg-primary text-white',
                  !isSolved && !isHighlightedPath && 'cursor-pointer bg-white text-primary',
                  !isSolved && !guess && 'bg-secondary/20',
                  isWrong && 'bg-rose-500 text-white'
                )}
              >
                {isSelected && !isSolved ? (
                  <span className="pointer-events-none absolute inset-0.5 rounded-[0.8rem] border-2 border-primary/35 bg-sky-100/85 sm:inset-1 sm:rounded-[1.05rem]" />
                ) : null}
                {isSelected && !isSolved ? (
                  <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-md sm:-right-1.5 sm:-top-1.5 sm:h-4.5 sm:w-4.5" />
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
    <div className="w-full space-y-3 overflow-hidden sm:space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground/70 sm:text-sm">
        <span>選字池</span>
        <span className="text-[11px] text-foreground/55 sm:text-xs">點錯字可直接點格子清空</span>
      </div>

      <div className="glass rounded-[1.5rem] p-3 sm:rounded-[1.75rem] sm:p-5">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-4 sm:gap-3">
          {candidates.map((char, index) => (
            <motion.button
              key={`${char}-${index}`}
              type="button"
              whileHover={{ y: -4, scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fillCell(char)}
              disabled={!selectedCell}
              className={cn(
                'min-h-11 w-full rounded-[1rem] border-b-4 border-primary/20 bg-white px-1 text-[1.7rem] font-bold text-primary shadow-md transition-all hover:shadow-lg sm:h-16 sm:rounded-2xl sm:text-3xl',
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
