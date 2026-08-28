'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  Flame,
  LoaderCircle,
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

const BOARD_FRAME_CLASS = cn(
  'game-board-frame aspect-square'
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

function getComboCopy(streak: number) {
  if (streak >= 8) return '筆勢正盛';
  if (streak >= 5) return '手感穩定';
  if (streak >= 3) return '連答成勢';
  if (streak > 0) return '正在暖手';
  return '從容作答';
}

function getPerformanceGrade(stats: { mistakes: number; hintsUsed: number; streak: number }) {
  const performanceScore = Math.max(0, 100 - stats.mistakes * 12 - stats.hintsUsed * 9 + Math.min(stats.streak, 8) * 3);

  if (performanceScore >= 92) {
    return { letter: 'S', title: '出口成章', description: '幾乎一氣呵成', className: 'text-secondary bg-amber-50 border-amber-200' };
  }

  if (performanceScore >= 78) {
    return { letter: 'A', title: '文思穩健', description: '節奏很好', className: 'text-primary bg-sky-50 border-sky-200' };
  }

  if (performanceScore >= 62) {
    return { letter: 'B', title: '漸入佳境', description: '穩穩完成', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }

  return { letter: 'C', title: '再接再厲', description: '下一關再試手感', className: 'text-accent bg-rose-50 border-rose-200' };
}

function ComboMeter({ streak, compact = false }: { streak: number; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const clampedStreak = Math.min(streak, 5);
  const progress = (clampedStreak / 5) * 100;
  const isActive = streak >= 3;

  return (
    <div
      className={cn(
        'rounded-[1rem] border border-white/45 bg-white/45 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]',
        compact && 'p-2.5'
      )}
      aria-label={`目前連擊 ${streak} 次`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/75">
          <Flame size={16} className={cn(isActive ? 'text-secondary' : 'text-foreground/45')} />
          連擊火候
        </span>
        <span className={cn('text-base font-black', isActive ? 'text-secondary' : 'text-foreground/55')}>
          {streak}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/65">
        <motion.div
          className={cn(
            'h-full rounded-full',
            isActive ? 'bg-gradient-to-r from-secondary via-amber-500 to-accent' : 'bg-foreground/25'
          )}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: 'easeOut' }}
        />
      </div>
      <p className={cn('mt-2 font-semibold text-foreground/60', compact ? 'text-xs' : 'text-sm')}>
        {getComboCopy(streak)}
      </p>
    </div>
  );
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

function playErrorTone(context: AudioContext) {
  const start = context.currentTime;
  const masterGain = context.createGain();

  masterGain.gain.setValueAtTime(0.0001, start);
  masterGain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
  masterGain.gain.exponentialRampToValueAtTime(0.09, start + 0.11);
  masterGain.gain.exponentialRampToValueAtTime(0.18, start + 0.16);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
  masterGain.connect(context.destination);

  const upperOscillator = context.createOscillator();
  upperOscillator.type = 'sawtooth';
  upperOscillator.frequency.setValueAtTime(980, start);
  upperOscillator.frequency.exponentialRampToValueAtTime(540, start + 0.14);
  upperOscillator.frequency.exponentialRampToValueAtTime(760, start + 0.24);
  upperOscillator.frequency.exponentialRampToValueAtTime(420, start + 0.34);
  upperOscillator.connect(masterGain);
  upperOscillator.start(start);
  upperOscillator.stop(start + 0.34);

  const lowerOscillator = context.createOscillator();
  lowerOscillator.type = 'square';
  lowerOscillator.frequency.setValueAtTime(220, start);
  lowerOscillator.frequency.exponentialRampToValueAtTime(160, start + 0.14);
  lowerOscillator.frequency.exponentialRampToValueAtTime(210, start + 0.24);
  lowerOscillator.frequency.exponentialRampToValueAtTime(140, start + 0.34);
  lowerOscillator.connect(masterGain);
  lowerOscillator.start(start);
  lowerOscillator.stop(start + 0.34);
}

function playCorrectTone(context: AudioContext, streak: number) {
  if (streak >= 8) {
    playToneSequence(
      context,
      [
        { frequency: 659.25, duration: 0.08, gain: 0.03 },
        { frequency: 783.99, duration: 0.09, gain: 0.035 },
        { frequency: 987.77, duration: 0.12, gain: 0.04 },
        { frequency: 1318.51, duration: 0.18, gain: 0.045 },
      ],
      'triangle'
    );
    return;
  }

  if (streak >= 5) {
    playToneSequence(
      context,
      [
        { frequency: 587.33, duration: 0.08, gain: 0.03 },
        { frequency: 739.99, duration: 0.1, gain: 0.035 },
        { frequency: 987.77, duration: 0.16, gain: 0.04 },
      ],
      'sine'
    );
    return;
  }

  if (streak >= 3) {
    playToneSequence(
      context,
      [
        { frequency: 523.25, duration: 0.08, gain: 0.03 },
        { frequency: 659.25, duration: 0.1, gain: 0.035 },
        { frequency: 783.99, duration: 0.14, gain: 0.04 },
      ],
      'sine'
    );
    return;
  }

  playToneSequence(
    context,
    [
      { frequency: 523.25, duration: 0.09, gain: 0.028 },
      { frequency: 659.25, duration: 0.12, gain: 0.032 },
    ],
    'sine'
  );
}

function GameSoundEffects() {
  const { answerEffect, toast, isComplete } = useGame();
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const lastToastIdRef = React.useRef<number | null>(null);
  const lastAnswerEffectIdRef = React.useRef<number | null>(null);
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
    if (!answerEffect || answerEffect.id === lastAnswerEffectIdRef.current) return;
    lastAnswerEffectIdRef.current = answerEffect.id;

    void ensureAudioContext().then((context) => {
      if (!context) return;

      if (answerEffect.kind === 'wrong') {
        playErrorTone(context);
        return;
      }

      playCorrectTone(context, answerEffect.streak);
    });
  }, [answerEffect, ensureAudioContext]);

  React.useEffect(() => {
    if (!toast || toast.id === lastToastIdRef.current) return;
    lastToastIdRef.current = toast.id;

    void ensureAudioContext().then((context) => {
      if (!context) return;

      if (toast.tone === 'success' && !isComplete && !answerEffect) playCorrectTone(context, 1);
    });
  }, [answerEffect, ensureAudioContext, isComplete, toast]);

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

function GameTileFlight() {
  const { answerEffect } = useGame();
  const reduceMotion = useReducedMotion();
  const flight = answerEffect?.flight;

  if (reduceMotion || !answerEffect || !flight) return null;

  const tileSize = Math.max(40, Math.min(flight.to.size, 88));
  const startScale = Math.max(0.65, Math.min(flight.from.size / tileSize, 1.15));
  const startX = flight.from.x - tileSize / 2;
  const startY = flight.from.y - tileSize / 2;
  const targetX = flight.to.x - tileSize / 2;
  const targetY = flight.to.y - tileSize / 2;

  return (
    <AnimatePresence>
      <motion.div
        key={answerEffect.id}
        aria-hidden="true"
        initial={{ x: startX, y: startY, scale: startScale, opacity: 0.94 }}
        animate={{
          x: targetX,
          y: targetY,
          scale: 1,
          opacity: [0.94, 1, 1, 0],
          rotate: answerEffect.kind === 'correct' ? [0, -2, 0] : [0, 2, -2, 0],
        }}
        transition={{
          duration: 0.52,
          ease: [0.22, 1, 0.36, 1],
          opacity: { times: [0, 0.55, 0.82, 1] },
        }}
        className={cn(
          'pointer-events-none fixed left-0 top-0 z-[60] flex items-center justify-center rounded-[1rem] border-2 text-[clamp(1.5rem,3vw,2.6rem)] font-black shadow-[0_14px_30px_rgba(101,123,131,0.28)]',
          answerEffect.kind === 'correct'
            ? 'border-white/75 bg-primary text-white'
            : 'border-rose-200 bg-rose-500 text-white'
        )}
        style={{ width: tileSize, height: tileSize }}
      >
        {answerEffect.char}
      </motion.div>
    </AnimatePresence>
  );
}

function GameIdiomCompletion() {
  const { idiomEffect } = useGame();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {idiomEffect ? (
        <div className="pointer-events-none fixed inset-x-3 top-[38%] z-40 flex justify-center sm:top-8">
          <motion.div
            key={idiomEffect.id}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.96 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="w-full max-w-[34rem] overflow-hidden rounded-[1.5rem] border border-secondary/25 bg-[#fff8e6]/95 px-5 py-4 text-center shadow-[0_18px_40px_rgba(101,123,131,0.22)] backdrop-blur-md sm:px-7 sm:py-5"
          >
            <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-secondary via-primary to-accent" />
            <p className="text-sm font-bold text-foreground/55 sm:text-base">成語完成</p>
            <p className="mt-1 text-[2rem] font-black leading-tight tracking-[0.16em] text-foreground sm:text-[2.5rem]">
              {idiomEffect.word}
            </p>
            <p className="mx-auto mt-2 max-w-[28rem] text-base leading-relaxed text-foreground/75 sm:text-lg">
              {idiomEffect.definition}
            </p>
            {idiomEffect.streak >= 3 ? (
              <p className="mt-3 inline-flex rounded-full bg-secondary/12 px-4 py-1.5 text-sm font-bold text-secondary">
                連擊 {idiomEffect.streak} 次
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function GameRoot({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children);
  const [header, board, dock, overlay] = childArray;

  return (
    <div className="game-root relative flex h-full w-full flex-col overflow-hidden">
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
        <GameTileFlight />
        <GameIdiomCompletion />
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
    isResetting,
    syncStatus,
    nextLevelStatus,
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
    <div className="relative space-y-2 text-center xl:space-y-5">
      <div className="hidden items-start justify-between gap-3 xl:flex">
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

      <div className="flex items-center justify-between gap-3 xl:hidden">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">成語填填看</p>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="title-gradient truncate text-xl font-black">第 {level} 關</h1>
            <span
              aria-label={syncCopy.label}
              title={syncCopy.label}
              className={cn(
                'inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.45)]',
                syncCopy.className
              )}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={useHint}
            className="glass flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full p-2.5 transition-colors hover:bg-white/40"
            aria-label="使用提示"
          >
            <Lightbulb size={20} />
          </button>
          <button
            type="button"
            onClick={() => setShowResetConfirm((prev) => !prev)}
            className="glass flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full p-2.5 transition-colors hover:bg-white/40"
            aria-label="重新開始本關"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      <div className="glass rounded-[1.25rem] p-2.5 text-left sm:p-3 xl:hidden">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px] font-bold sm:text-sm">
          <span className="text-primary">分數 {stats.score}</span>
          <span className="text-secondary">連擊 {stats.streak}</span>
          <span className="text-foreground/65">進度 {progressPercent}%</span>
        </div>
        <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/60 sm:h-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
          />
        </div>
        <div>
          <p className="text-[1rem] leading-snug text-foreground/80">
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
                  if (isResetting) return;
                  setShowResetConfirm(false);
                  resetLevel();
                }}
                disabled={isResetting}
                className={cn(
                  'rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition',
                  !isResetting && 'hover:bg-primary/90',
                  isResetting && 'cursor-wait opacity-80'
                )}
              >
                {isResetting ? '重開中...' : '確認重開'}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="hidden glass text-left xl:block xl:rounded-[1.75rem] xl:p-5">
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

        <div className="mt-5 lg:mt-4">
          <ComboMeter streak={stats.streak} />
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

      <div className="hidden glass min-h-[180px] rounded-[1.75rem] p-6 xl:block">
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

      <div className="hidden items-center justify-between rounded-[1rem] bg-white/45 px-4 py-3 text-sm font-semibold text-foreground/70 xl:flex">
        <span>下一關</span>
        <span className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold',
          nextLevelStatus === 'ready' && 'bg-emerald-100 text-emerald-700',
          nextLevelStatus === 'loading' && 'bg-amber-100 text-amber-700',
          nextLevelStatus === 'error' && 'bg-rose-100 text-rose-700',
          nextLevelStatus === 'idle' && 'bg-slate-100 text-slate-600'
        )}>
          {nextLevelStatus === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {nextLevelStatus === 'ready' ? '已預載完成' : null}
          {nextLevelStatus === 'loading' ? '背景生成中' : null}
          {nextLevelStatus === 'error' ? '預載失敗' : null}
          {nextLevelStatus === 'idle' ? '尚未開始' : null}
        </span>
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

function GameBrushPath({ cells }: { cells: [number, number][] }) {
  const reduceMotion = useReducedMotion();
  const firstCell = cells[0];
  const lastCell = cells[cells.length - 1];

  if (!firstCell || !lastCell) return null;

  const x1 = (firstCell[1] + 0.5) * 12.5;
  const y1 = (firstCell[0] + 0.5) * 12.5;
  const x2 = (lastCell[1] + 0.5) * 12.5;
  const y2 = (lastCell[0] + 0.5) * 12.5;
  const duration = reduceMotion ? 0 : 0.58;

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible mix-blend-multiply"
    >
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        pathLength={1}
        initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 0.34, 0.24] }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        stroke="rgba(88, 77, 54, 0.88)"
        strokeWidth="10"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        pathLength={1}
        initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 0.72, 0.48] }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        stroke="rgba(181, 137, 0, 0.92)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <motion.circle
        cx={x2}
        cy={y2}
        r="1.4"
        initial={{ scale: reduceMotion ? 1 : 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.7 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : 0.78 }}
        fill="rgba(181, 137, 0, 0.92)"
      />
    </motion.svg>
  );
}

export function GameBoard() {
  const reduceMotion = useReducedMotion();
  const {
    answerEffect,
    idiomEffect,
    grid,
    userGrid,
    revealed,
    selectedCell,
    selectCell,
    clearCell,
    highlightedCells,
    isComplete,
    isReady,
  } = useGame();

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
      <div className="relative h-full w-full">
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
              const isEffectCell = answerEffect?.row === y && answerEffect.col === x;
              const completeDelay = ((Math.abs(y - 3.5) + Math.abs(x - 3.5)) * 0.045);
              const animateState =
                isComplete && isSolved
                  ? {
                      scale: [1, 1.13, 1],
                      boxShadow: [
                        '0 8px 18px rgba(38,139,210,0.18)',
                        '0 0 0 8px rgba(76,175,80,0.22), 0 14px 28px rgba(38,139,210,0.24)',
                        '0 8px 18px rgba(38,139,210,0.18)',
                      ],
                    }
                  : isEffectCell && answerEffect.kind === 'correct'
                    ? {
                        scale: [1, 1.18, 1],
                        boxShadow: [
                          '0 8px 18px rgba(38,139,210,0.18)',
                          '0 0 0 9px rgba(16,185,129,0.30), 0 16px 32px rgba(16,185,129,0.30)',
                          '0 8px 18px rgba(38,139,210,0.18)',
                        ],
                      }
                    : isEffectCell && answerEffect.kind === 'wrong'
                      ? {
                          x: [0, -8, 7, -5, 4, 0],
                          boxShadow: [
                            '0 8px 18px rgba(244,63,94,0.20)',
                            '0 0 0 7px rgba(244,63,94,0.28), 0 14px 28px rgba(244,63,94,0.28)',
                            '0 8px 18px rgba(244,63,94,0.20)',
                          ],
                        }
                      : undefined;
              const animateTransition =
                isComplete && isSolved
                  ? { delay: completeDelay, duration: 0.55, ease: 'easeOut' as const }
                  : isEffectCell && answerEffect?.kind === 'correct'
                    ? { duration: 0.32, ease: 'easeOut' as const }
                    : isEffectCell && answerEffect?.kind === 'wrong'
                      ? { duration: 0.34, ease: 'easeOut' as const }
                      : undefined;
              const delayCellContent = Boolean(isEffectCell && answerEffect?.flight && !reduceMotion);

              return (
                <motion.button
                  key={`${y}-${x}`}
                  type="button"
                  data-game-cell={`${y}-${x}`}
                  whileHover={reduceMotion ? undefined : { scale: !isSolved ? 1.05 : 1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                  animate={reduceMotion ? undefined : animateState}
                  transition={reduceMotion ? undefined : animateTransition}
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
                  {isEffectCell && answerEffect.kind === 'correct' && answerEffect.isIntersection && !reduceMotion ? (
                    <span className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
                      {[0, 1].map((ring) => (
                        <motion.span
                          key={`${answerEffect.id}-${ring}`}
                          className="absolute inset-1 rounded-full border-2 border-secondary/70"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: [0.5, 1.2, 1.9], opacity: [0, 0.66, 0] }}
                          transition={{
                            duration: 0.72,
                            delay: 0.2 + ring * 0.12,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      ))}
                    </span>
                  ) : null}
                  {isSelected && !isSolved ? (
                    <span className="pointer-events-none absolute inset-0.5 rounded-[0.62rem] border border-primary/35 bg-sky-100/85 sm:inset-1 sm:rounded-[1.05rem] sm:border-2" />
                  ) : null}
                  {isSelected && !isSolved ? (
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-white bg-primary shadow-md sm:-right-1.5 sm:-top-1.5 sm:h-4.5 sm:w-4.5 sm:border-2" />
                  ) : null}
                  <motion.span
                    key={isEffectCell ? answerEffect.id : `${y}-${x}-${isSolved ? 'solved' : guess}`}
                    className="relative z-10"
                    initial={delayCellContent ? { opacity: 0, scale: 0.72 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.2,
                      delay: delayCellContent ? 0.34 : 0,
                      ease: 'easeOut',
                    }}
                  >
                    {isSolved ? cell.char : guess}
                  </motion.span>
                </motion.button>
              );
            })
          )}
        </div>
        <AnimatePresence>
          {idiomEffect ? <GameBrushPath key={idiomEffect.id} cells={idiomEffect.cells} /> : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function GameDock() {
  const { candidates, fillCell, selectedCell, isReady } = useGame();
  const reduceMotion = useReducedMotion();

  if (!isReady) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden xl:gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3 text-sm font-semibold text-foreground/70">
        <span className="shrink-0">選字池</span>
        <span className="truncate text-right text-xs text-foreground/60">
          上下滑動查看全部 {candidates.length} 個字
        </span>
      </div>

      <div className="game-candidate-panel glass min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[1.25rem] p-2 xl:rounded-[1.75rem] xl:p-4">
        <div className="game-candidate-grid grid content-start gap-1.5 xl:gap-3">
          {candidates.map((char, index) => (
            <motion.button
              key={`${char}-${index}`}
              type="button"
              whileHover={reduceMotion ? undefined : { y: -4, scale: 1.08 }}
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              onClick={(event) => {
                if (!selectedCell || reduceMotion) {
                  fillCell(char);
                  return;
                }

                const [row, col] = selectedCell;
                const target = document.querySelector<HTMLElement>(`[data-game-cell="${row}-${col}"]`);
                if (!target) {
                  fillCell(char);
                  return;
                }

                const sourceRect = event.currentTarget.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                fillCell(char, {
                  from: {
                    x: sourceRect.left + sourceRect.width / 2,
                    y: sourceRect.top + sourceRect.height / 2,
                    size: Math.min(sourceRect.width, sourceRect.height),
                  },
                  to: {
                    x: targetRect.left + targetRect.width / 2,
                    y: targetRect.top + targetRect.height / 2,
                    size: Math.min(targetRect.width, targetRect.height),
                  },
                });
              }}
              disabled={!selectedCell}
              className={cn(
                'min-h-12 w-full touch-manipulation rounded-[0.85rem] border-b-3 border-primary/20 bg-white px-1 text-[1.5rem] font-bold text-primary shadow-md transition-all hover:shadow-lg xl:h-16 xl:rounded-2xl xl:border-b-4 xl:text-3xl',
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
  const { isAdvancing, isComplete, isNextLevelReady, nextLevel, nextLevelStatus, level, stats, isReady } = useGame();
  const reduceMotion = useReducedMotion();
  const grade = getPerformanceGrade(stats);

  if (!isReady) return null;

  return (
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3 backdrop-blur-md sm:p-6"
        >
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { scale: 0.92, y: 34, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.5rem] bg-white p-4 text-center sm:block sm:max-h-[calc(100dvh-3rem)] sm:overflow-y-auto sm:rounded-[2rem] sm:p-10"
          >
            <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-primary via-accent to-secondary" />

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 sm:contents">
              <div className="mb-2 inline-flex rounded-full bg-primary/10 p-2.5 text-primary sm:mb-4 sm:p-4">
                <Trophy className="h-9 w-9 sm:h-12 sm:w-12" />
              </div>

              <h2 className="title-gradient text-3xl font-black sm:text-4xl">過關了</h2>
              <p className="mt-1 text-sm leading-snug text-foreground/70 sm:mt-3 sm:text-lg sm:leading-normal">
                第 {level} 關已完成，下一關會更少提示、更高密度。
              </p>

              <div className={cn('mt-3 rounded-[1.25rem] border px-3 py-2.5 sm:mt-6 sm:rounded-[1.5rem] sm:px-5 sm:py-4', grade.className)}>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <Award className="h-5 w-5 sm:h-[26px] sm:w-[26px]" />
                  <span className="text-xs font-black text-foreground/60 sm:text-sm">本關評級</span>
                </div>
                <p className="mt-1 text-4xl font-black leading-none sm:mt-2 sm:text-6xl">{grade.letter}</p>
                <p className="mt-1 text-base font-black text-foreground sm:mt-2 sm:text-xl">{grade.title}</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground/60 sm:mt-1 sm:text-sm">{grade.description}</p>
              </div>

              <div className="my-3 grid grid-cols-3 gap-2 text-xs sm:my-6 sm:text-sm">
                <div className="rounded-xl bg-slate-100 p-2 sm:rounded-2xl sm:p-3">
                  <p className="text-foreground/55">分數</p>
                  <p className="mt-0.5 text-lg font-black text-primary sm:mt-1 sm:text-xl">{stats.score}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 sm:rounded-2xl sm:p-3">
                  <p className="text-foreground/55">錯誤</p>
                  <p className="mt-0.5 text-lg font-black text-accent sm:mt-1 sm:text-xl">{stats.mistakes}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 sm:rounded-2xl sm:p-3">
                  <p className="text-foreground/55">提示</p>
                  <p className="mt-0.5 text-lg font-black text-secondary sm:mt-1 sm:text-xl">{stats.hintsUsed}</p>
                </div>
              </div>

              <div className="mb-6 hidden items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 sm:flex">
                <TriangleAlert size={16} />
                重開本關會扣 10 分，提示每次扣 5 分
              </div>
            </div>

            <div className={cn(
              'mb-3 mt-3 flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold sm:mb-4 sm:mt-0 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm',
              isNextLevelReady && 'bg-emerald-50 text-emerald-700',
              !isNextLevelReady && nextLevelStatus !== 'error' && 'bg-sky-50 text-sky-700',
              nextLevelStatus === 'error' && 'bg-rose-50 text-rose-700'
            )}>
              {isAdvancing || nextLevelStatus === 'loading' ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {isNextLevelReady ? '下一關已準備好，按下會直接切換' : null}
              {!isNextLevelReady && nextLevelStatus === 'loading' ? '下一關仍在背景生成，首次切換可能稍等幾秒' : null}
              {nextLevelStatus === 'error' ? '下一關預載失敗，按下後會重新嘗試生成' : null}
            </div>

            <button
              type="button"
              onClick={nextLevel}
              disabled={isAdvancing}
              className={cn(
                'group flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-lg font-bold text-white shadow-lg shadow-primary/30 transition-all sm:rounded-2xl sm:py-4 sm:text-xl',
                !isAdvancing && 'hover:gap-4',
                isAdvancing && 'cursor-wait opacity-80'
              )}
            >
              {isAdvancing ? (
                <>
                  <LoaderCircle size={20} className="animate-spin" />
                  載入下一關...
                </>
              ) : (
                <>
                  下一關 <ChevronRight />
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
