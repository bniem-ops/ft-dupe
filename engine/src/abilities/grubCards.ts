// The 24 Grub defend effects (docs/rules-audit.md: all E, "executable
// now") — the roll-table retaliation/miss text on each Grub card,
// resolved when a player attacks the shared face-up Grub. Reuses
// PredatorEffect/PredatorRollOutcome as-is (predatorDodges -> "Miss your
// attack", returnAttackOverride -> "Lose N health", selfHeal -> "+N
// health") rather than inventing a parallel type, since the shapes are
// identical to predator roll-table effects; unconditional "no roll"
// entries (Ladybug, Wasp Swarm) are expressed as a 1-6 range so every
// roll matches. Grub Rewards (17 E, granted on defeat and played later
// from a player's grubHand) are a separate, later part of phase 7 — see
// engine/src/combat.ts's defaultTargetEffect for how this is consumed.
import { PredatorEffect, CardEffect } from './types.js';

export const GRUB_DEFEND_EFFECTS: Record<string, PredatorEffect> = {
  Scorpion: { rollOutcomes: [{ min: 1, max: 2, returnAttackOverride: 1 }] },
  'Lunar Moth': { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Slug: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Cocoon: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  'Dung Beetle': {
    rollOutcomes: [
      { min: 1, max: 1, predatorDodges: true },
      { min: 2, max: 2, returnAttackOverride: 1 },
    ],
  },
  Dragonfly: { rollOutcomes: [{ min: 1, max: 1, returnAttackOverride: 1 }] },
  'Four Leaf Clover': { rollOutcomes: [{ min: 6, max: 6, selfHeal: 1 }] },
  'Praying Mantis': { rollOutcomes: [{ min: 1, max: 2, predatorDodges: true }] },
  Caterpillar: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  'Roly Poly': { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  'Garden Snail': { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  'Lucky Cricket': { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Earthworm: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Beehive: { rollOutcomes: [{ min: 1, max: 2, returnAttackOverride: 1 }] },
  // "Lose 1 health" — no roll printed, so it's unconditional; a 1-6 range
  // matches every roll rather than adding a separate "guaranteed" field.
  Ladybug: { rollOutcomes: [{ min: 1, max: 6, returnAttackOverride: 1 }] },
  'Spotted Lanternfly': { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Mosquitoes: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  // Wild Grain: effect is null ("none") — deliberately no entry.
  Centipede: { rollOutcomes: [{ min: 1, max: 2, predatorDodges: true }] },
  'Wasp Swarm': { rollOutcomes: [{ min: 1, max: 6, returnAttackOverride: 1 }] },
  'Ant Pile': { rollOutcomes: [{ min: 1, max: 3, returnAttackOverride: 1 }] },
  Firefly: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  Lizard: { rollOutcomes: [{ min: 1, max: 1, predatorDodges: true }] },
  'Large Spider': { rollOutcomes: [{ min: 1, max: 1, returnAttackOverride: 1 }] },
};

// The 17 "executable now" Grub Rewards (docs/rules-audit.md), keyed by
// Grub name — granted on defeat (held in grubHand), played on demand via
// useGrubReward. The 7 needs-hook rewards (Dung Beetle, Four Leaf Clover,
// Garden Snail, Lucky Cricket, Spotted Lanternfly, Wasp Swarm, Firefly)
// are deliberately absent, same convention as everywhere else in phase 6/7.
export const GRUB_REWARDS: Record<string, CardEffect> = {
  Scorpion: { ignoresPredatorRollEffectsNextAttack: true },
  'Lunar Moth': { immuneToWeatherUntilNextCard: true },
  Slug: { selfDelta: { health: 1 } },
  Cocoon: { teammateGain: { resource: 'food', maxAmount: 3 } },
  Dragonfly: { drawBonusCards: { draw: 3, keep: 2, giveTeammate: 1 } },
  'Praying Mantis': { dodgeNextAttack: true },
  Caterpillar: { permanentEggProductionBonus: 1 },
  'Roly Poly': { permanentReturnAttackReductionRoll: { threshold: 4, amount: 1 } },
  Earthworm: { teammateGain: { resource: 'health', maxAmount: 3 } },
  Beehive: { choiceGain: [{ meal: 2 }, { food: 3 }] },
  Ladybug: { ladybugRoll: true },
  Mosquitoes: { drawBonusCards: { draw: 2, keep: 2, giveTeammate: 0 } },
  'Wild Grain': { selfDelta: { food: 2 } },
  Centipede: { choiceGain: [{ meal: 2 }, { food: 3 }] },
  'Ant Pile': { enemyDamage: 2 },
  Lizard: { permanentForageBonusUntilNextWeather: 1 },
  'Large Spider': { permanentNoBonusCardHandLimit: true },
};
