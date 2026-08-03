// Shared Grub face-up dealing helpers — used by turn.ts (daily discard)
// and combat.ts (Grub defeat → redeal a new face-up card).
import { GrubDeckSide, GrubDecksState, RNG } from './types.js';
import { loadGrubCards, parseIntField } from './data.js';
import { shuffle } from './random.js';

export function dealFaceUp(side: GrubDeckSide): GrubDeckSide {
  const remaining = [...side.drawPile];
  const cardId = remaining.shift();
  if (cardId == null) return { ...side, drawPile: remaining, faceUp: null };
  const health = parseIntField(loadGrubCards()[cardId]?.health ?? null, 0);
  return { ...side, drawPile: remaining, faceUp: { cardId, currentHealth: health, rewardUsed: false } };
}

export function discardFaceUp(side: GrubDeckSide): GrubDeckSide {
  if (!side.faceUp) return side;
  return { ...side, faceUp: null, discard: [...side.discard, side.faceUp.cardId] };
}

// "When both decks are empty, reshuffle the combined discard and redeal
// into two new decks" (core_rules.md).
export function maybeReshuffleGrubDecks(decks: GrubDecksState, rng: RNG): GrubDecksState {
  if (decks.inside.drawPile.length > 0 || decks.outside.drawPile.length > 0) return decks;
  const combined = shuffle([...decks.inside.discard, ...decks.outside.discard], rng);
  const half = Math.ceil(combined.length / 2);
  return {
    inside: { ...decks.inside, drawPile: combined.slice(0, half), discard: [] },
    outside: { ...decks.outside, drawPile: combined.slice(half), discard: [] },
  };
}
