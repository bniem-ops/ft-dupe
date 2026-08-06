// The 32 "executable now" chicken abilities (docs/rules-audit.md).
// Cumulative: a stage-3 chicken has its Chick + S2 + S3 abilities all
// active at once (matches ui/'s phase-5 player panel, which already
// renders every unlocked-stage's ability as "current").
import { Stage, rollDie } from '../types.js';
import { ChickenAbility } from './types.js';

export const CHICKEN_ABILITIES: Record<string, Partial<Record<Stage, ChickenAbility>>> = {
  'Shellock Holmes': {
    1: { weatherImmunity: ['Pollen'], startingBonusCards: 1 }, // Naturalist
  },
  Beowing: {
    1: { weatherImmunity: ['Nighttime'], startingBonusCards: 1 }, // Stargazer
    3: {
      // Berseker
      onDamageTaken: (_ctx, rng) => {
        const roll = rollDie(rng);
        if (roll === 6) return 2;
        if (roll >= 3) return 1;
        return 0;
      },
    },
  },
  'Wyatt Chirp': {
    1: { startingFood: 1 }, // Hardtack
    2: { onProductionMiss: () => ({ meals: 1 }) }, // Payback
    3: { returnAttackReduction: 1 }, // Thick Feathers
  },
  'Madam Chickovsky': {
    1: { weatherImmunity: ['Freezing', 'Hail'] }, // Cold-Hardy
    2: { freeGiftFood: { cost: 1, healSelf: 1 } }, // Ladies' Aid
  },
  'Cluckleberry Finn': {
    1: { startingEggs: 1 }, // Endowment
    3: { eggExchangeRate: 2 }, // Superior Product
  },
  'Eggatha Christie': {
    // Warm-Hardy — "Drough" is a confirmed typo for Drought
    // (docs/rules-audit.md); "Extreme Heat" is the only heat-named card
    // (Heat Wave).
    1: { startingEggs: 1, weatherImmunity: ['Drought', 'Heat Wave'] },
    2: { forageRoll: { threshold: 3, bonusFood: 2 } }, // The Forager
  },
  'Cumberbill Rockefeather': {
    1: { startingEggs: 1, weatherImmunity: ['Pouring Rain'] }, // Long Legs
    3: { weatherImmunity: 'all-negative' }, // Dandy
  },
  'Annie Yolkley': {
    1: { startingEggs: 1 }, // Endowment
    3: { extraProductionRolls: 1 }, // High Producer
  },
  'General Tso': {
    1: { mayChooseStartingLocation: true, startingEggs: 1 }, // Traveler
    2: { drawTwoKeepOne: true }, // Foresight
  },
  'Wingston Coophill': {
    1: {
      // Misdirection: discard exactly 2 Bonus Cards to halve incoming damage.
      damageMitigation: { resource: 'bonusCards', compute: (damage, spent) => (spent >= 2 ? Math.floor(damage / 2) : 0) },
    },
    3: { onAttack: (_ctx, rng) => (rollDie(rng) >= 3 ? { dodged: true } : {}) }, // Evasion
  },
  'Atilla the Hen': {
    1: { weatherImmunity: ['Tornado'], startingFood: 2 }, // Big-Boned
    // Just Reward — inert until Tank (H) exists to trigger it.
    3: { onProtectedTeammate: () => ({ eggs: 2 }) },
  },
  'Princess Layer': {
    2: { layEggRoll: { threshold: 3, bonusEggs: 1 } }, // Well-Laid Plans: roll 3-6 -> 2 eggs total (1 base + 1 bonus)
    3: { damageMitigation: { resource: 'eggs', compute: (damage, spent) => Math.min(damage, spent) } }, // Eggpire Strikes Back: 1 egg = 1 heart
  },
  Chickira: {
    1: { startingEggs: 1 }, // Endowment
    3: { onProductionMiss: () => ({ heal: 1 }) }, // Shake it Off
  },
  'Broods Lee': {
    1: { onPredatorDefeated: () => ({ drawBonusCard: true }) }, // Revenge
    2: { maxAttackBonusIfDamaged: 1 }, // Adrenaline
  },
  'J.R.R. Yolkien': {
    // Bookworm — immuneToGrubDamage is currently inert: no mechanic deals
    // the attacking player damage from a Grub yet (phase 4 scope).
    1: { bonusCardHandLimitOverride: 3, immuneToGrubDamage: true },
  },
  'Cluck Norris': {
    2: { freeDamageForEggs: { damage: 1, eggsGained: 2 } }, // Always on Purpose
    3: { freeEggForCard: true }, // Quick Claws
  },
  'Aracorn, Heir of Condor': {
    2: { freeOutsideMove: true }, // Long Shanks
  },
};

export function getActiveChickenAbilities(chickenName: string, stage: Stage): ChickenAbility[] {
  const byStage = CHICKEN_ABILITIES[chickenName];
  if (!byStage) return [];
  const result: ChickenAbility[] = [];
  for (let s = 1; s <= stage; s++) {
    const ability = byStage[s as Stage];
    if (ability) result.push(ability);
  }
  return result;
}

// Immunity only blocks *negative* weather effects — it never suppresses a
// beneficial one (Fair/Sunny/Snow), so callers pass whether the active
// card is positive. `weatherImmunity: 'all-negative'` (Dandy) matches any
// non-positive card; a string array matches only those named cards.
export function isImmuneToWeather(chickenName: string, stage: Stage, cardName: string, cardIsPositive: boolean): boolean {
  if (cardIsPositive) return false;
  for (const ability of getActiveChickenAbilities(chickenName, stage)) {
    if (!ability.weatherImmunity) continue;
    if (ability.weatherImmunity === 'all-negative') return true;
    if (ability.weatherImmunity.includes(cardName)) return true;
  }
  return false;
}
