import { RNG } from './types.js';

export function pick<T>(arr: T[], rng: RNG): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(arr: T[], rng: RNG): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
