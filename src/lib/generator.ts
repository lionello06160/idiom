import { IDIOMS, Idiom } from './idioms';

export interface GridCell {
  char: string;
  isSolution: boolean;
  idiomId: string | null;
  hintId: number | null;
}

export interface PlacedIdiom {
  idiom: Idiom;
  x: number;
  y: number;
  direction: 'H' | 'V';
}

interface CandidatePlacement {
  idiom: Idiom;
  x: number;
  y: number;
  direction: 'H' | 'V';
}

export class GameGenerator {
  private grid: (GridCell | null)[][] = [];
  private size: number;
  private placedIdioms: PlacedIdiom[] = [];

  constructor(size: number = 8) {
    this.size = size;
    this.resetGrid();
  }

  private resetGrid() {
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    this.placedIdioms = [];
  }

  public generate(targetCount: number = 6): { grid: (GridCell | null)[][], idioms: PlacedIdiom[] } {
    let attempts = 0;
    while (attempts < 50) {
      this.resetGrid();
      if (this.recursivePlace(targetCount)) {
        return { grid: this.grid, idioms: this.placedIdioms };
      }
      attempts++;
    }
    throw new Error('Could not generate a valid grid after 50 attempts.');
  }

  private recursivePlace(remaining: number): boolean {
    if (remaining === 0) return true;

    if (this.placedIdioms.length === 0) {
      // Place first idiom randomly
      const idiom = IDIOMS[Math.floor(Math.random() * IDIOMS.length)];
      const direction = Math.random() > 0.5 ? 'H' : 'V';
      const x = Math.floor(Math.random() * (this.size - (direction === 'H' ? 4 : 0)));
      const y = Math.floor(Math.random() * (this.size - (direction === 'V' ? 4 : 0)));
      
      if (this.canPlace(idiom, x, y, direction)) {
        this.place(idiom, x, y, direction);
        if (this.recursivePlace(remaining - 1)) return true;
        this.unplace();
      }
      return false;
    }

    // Find all possible intersection points
    const candidates = this.findCandidates();
    // Shuffle candidates for variety
    candidates.sort(() => Math.random() - 0.5);

    for (const cand of candidates) {
      if (this.canPlace(cand.idiom, cand.x, cand.y, cand.direction)) {
        this.place(cand.idiom, cand.x, cand.y, cand.direction);
        if (this.recursivePlace(remaining - 1)) return true;
        this.unplace();
      }
    }

    return false;
  }

  private findCandidates(): CandidatePlacement[] {
    const candidates: CandidatePlacement[] = [];
    const usedWords = new Set(this.placedIdioms.map(p => p.idiom.word));

    for (const placed of this.placedIdioms) {
      for (let i = 0; i < 4; i++) {
        const char = placed.idiom.word[i];
        const cx = placed.direction === 'H' ? placed.x + i : placed.x;
        const cy = placed.direction === 'V' ? placed.y + i : placed.y;

        // Find idioms containing this char
        for (const idiom of IDIOMS) {
          if (usedWords.has(idiom.word)) continue;

          for (let j = 0; j < 4; j++) {
            if (idiom.word[j] === char) {
              const dir = placed.direction === 'H' ? 'V' : 'H';
              const x = dir === 'H' ? cx - j : cx;
              const y = dir === 'V' ? cy - j : cy;
              candidates.push({ idiom, x, y, direction: dir });
            }
          }
        }
      }
    }
    return candidates;
  }

  private canPlace(idiom: Idiom, x: number, y: number, direction: 'H' | 'V'): boolean {
    if (x < 0 || y < 0) return false;
    if (direction === 'H' && x + 4 > this.size) return false;
    if (direction === 'V' && y + 4 > this.size) return false;

    let intersections = 0;

    for (let i = 0; i < 4; i++) {
        const cx = direction === 'H' ? x + i : x;
        const cy = direction === 'V' ? y + i : y;
        const existing = this.grid[cy][cx];

        if (existing) {
            if (existing.char !== idiom.word[i]) return false;
            intersections++;
        } else {
            // Check neighbors to avoid accidental words
            if (!this.checkIsolation(cx, cy, direction)) return false;
        }
    }

    return this.placedIdioms.length === 0 || intersections > 0;
  }

  private checkIsolation(x: number, y: number, direction: 'H' | 'V'): boolean {
    // Check perpendicular neighbors only
    const neighbors = direction === 'H' 
        ? [[0, 1], [0, -1]] // Check up and down
        : [[1, 0], [-1, 0]]; // Check left and right

    for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
            if (this.grid[ny][nx]) return false;
        }
    }
    return true;
  }

  private place(idiom: Idiom, x: number, y: number, direction: 'H' | 'V') {
    const hintId = this.placedIdioms.length + 1;
    for (let i = 0; i < 4; i++) {
      const cx = direction === 'H' ? x + i : x;
      const cy = direction === 'V' ? y + i : y;
      
      const existing = this.grid[cy][cx];
      this.grid[cy][cx] = {
        char: idiom.word[i],
        isSolution: true,
        idiomId: idiom.word,
        hintId: existing ? existing.hintId : hintId // Keep first hint ID for intersection
      };
    }
    this.placedIdioms.push({ idiom, x, y, direction });
  }

  private unplace() {
    // This is a bit tricky with intersections. 
    // For simplicity in this game, we'll recreate the grid from placedIdioms minus the last one.
    this.placedIdioms.pop();
    const currentPlaced = [...this.placedIdioms];
    this.resetGrid();
    for (const p of currentPlaced) {
      this.place(p.idiom, p.x, p.y, p.direction);
    }
  }
}
