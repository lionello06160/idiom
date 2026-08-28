declare module 'idiom-game-store' {
  import type { SharedGameState } from '@/lib/game-shared';

  interface ServerSnapshot {
    state: SharedGameState;
    version: number;
    updatedAt: number;
  }

  export function getServerSnapshot(): Promise<ServerSnapshot>;
  export function setServerState(state: SharedGameState): Promise<ServerSnapshot>;
  export function resetServerState(level?: number, previousScore?: number): Promise<ServerSnapshot>;
  export function generateServerState(level?: number, previousScore?: number): Promise<ServerSnapshot>;
}
