import { GameConfig, RNG } from '../src/types.js';

// Deterministic PRNG (mulberry32) so tests are reproducible.
export function seededRng(seed: number): RNG {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function constantRng(value: number): RNG {
  return () => value;
}

export function baseConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    players: [
      { id: 'p1', chickenName: 'Shellock Holmes' },
      { id: 'p2', chickenName: 'Wingston Coophill' },
    ],
    difficulty: 4,
    eggspansion: false,
    rng: seededRng(42),
    predators: {
      regular: ['Eggsmeralda', 'Sal Moe Nella', 'Professor Moltiarty'],
      boss: 'Ursula Bone',
    },
    ...overrides,
  };
}
