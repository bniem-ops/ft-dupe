// The 32 "executable now" chicken abilities (docs/rules-audit.md).
// Cumulative: a stage-3 chicken has its Chick + S2 + S3 abilities all
// active at once (matches ui/'s phase-5 player panel, which already
// renders every unlocked-stage's ability as "current").
import { Stage, rollDie, GameState, Location, PlayerState, RNG } from '../types.js';
import { ChickenAbility } from './types.js';

export const CHICKEN_ABILITIES: Record<string, Partial<Record<Stage, ChickenAbility>>> = {
  'Shellock Holmes': {
    1: { weatherImmunity: ['Pollen'], startingBonusCards: 1 }, // Naturalist
    2: { mayAttackGrubsFromAnyLocation: true }, // Informant Network
    3: { canShieldWithGrubHealth: true }, // Plots & Ploys
  },
  Beowing: {
    1: { weatherImmunity: ['Nighttime'], startingBonusCards: 1 }, // Stargazer
    2: { auraTeammateRollBonus: 1, auraPredatorRollPenalty: 1 }, // Battle Cry
    3: {
      // Berseker
      onDamageTaken: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.playerId, rollDie(rng), rng);
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
    3: { mayPerformInsideActionsOutside: true }, // Fur Coat
  },
  'Cluckleberry Finn': {
    1: { startingEggs: 1 }, // Endowment
    2: { joinsAttackAsSecond: true }, // Quite Friendly
    3: { eggExchangeRate: 2 }, // Superior Product
  },
  'Eggatha Christie': {
    // Warm-Hardy — "Drough" is a confirmed typo for Drought
    // (docs/rules-audit.md); "Extreme Heat" is the only heat-named card
    // (Heat Wave).
    1: { startingEggs: 1, weatherImmunity: ['Drought', 'Heat Wave'] },
    2: { forageRoll: { threshold: 3, bonusFood: 2 } }, // The Forager
    3: { canAttackDiscardedGrubs: true }, // Tomb Raider
  },
  'Cumberbill Rockefeather': {
    1: { startingEggs: 1, weatherImmunity: ['Pouring Rain'] }, // Long Legs
    2: { freeMoveIntoCoop: true }, // Landlord
    3: { weatherImmunity: 'all-negative' }, // Dandy
  },
  'Annie Yolkley': {
    1: { startingEggs: 1 }, // Endowment
    2: { layEggOnDamageTaken: true }, // Bacaw!
    3: { extraProductionRolls: 1 }, // High Producer
  },
  'General Tso': {
    1: { mayChooseStartingLocation: true, startingEggs: 1 }, // Traveler
    2: { drawTwoKeepOne: true }, // Foresight
    3: { canAdjustAnyRollForEggs: true }, // Strategem
  },
  'Wingston Coophill': {
    1: {
      // Misdirection: discard exactly 2 Bonus Cards to halve incoming damage.
      damageMitigation: { resource: 'bonusCards', compute: (damage, spent) => (spent >= 2 ? Math.floor(damage / 2) : 0) },
    },
    2: { tagAlongUnlocked: true }, // Smallest Chicken
    3: { onAttack: (ctx, rng) => (peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng) >= 3 ? { dodged: true } : {}) }, // Evasion
  },
  'Atilla the Hen': {
    1: { weatherImmunity: ['Tornado'], startingFood: 2 }, // Big-Boned
    2: { canRedirectDamage: true }, // Tank
    3: { onProtectedTeammate: () => ({ eggs: 2 }) }, // Just Reward — now live, see attack()'s damageRedirect handling
  },
  'Princess Layer': {
    1: { startingEggs: 1, refreshExtraActionTokenCost: 1 }, // Nobility
    2: { layEggRoll: { threshold: 3, bonusEggs: 1 } }, // Well-Laid Plans: roll 3-6 -> 2 eggs total (1 base + 1 bonus)
    3: { damageMitigation: { resource: 'eggs', compute: (damage, spent) => Math.min(damage, spent) } }, // Eggpire Strikes Back: 1 egg = 1 heart
  },
  Chickira: {
    1: { startingEggs: 1 }, // Endowment
    2: { freeWeatherRedrawRoll: true }, // Wherever, any Weather
    3: { onProductionMiss: () => ({ heal: 1 }) }, // Shake it Off
  },
  'Broods Lee': {
    1: { onPredatorDefeated: () => ({ drawBonusCard: true }) }, // Revenge
    2: { maxAttackBonusIfDamaged: 1 }, // Adrenaline
    3: { auraMaxAttackBonusIfDamaged: 1 }, // Bolsterer
  },
  'J.R.R. Yolkien': {
    // Bookworm — immuneToGrubDamage is currently inert: no mechanic deals
    // the attacking player damage from a Grub yet (phase 4 scope).
    1: { bonusCardHandLimitOverride: 3, immuneToGrubDamage: true },
    2: { layEggOnRepeatedAction: true }, // Dedication
    3: { weatherImmunity: ['Fog'], canRerollAnyRollForEgg: true }, // Deus Eggs Machina
  },
  'Cluck Norris': {
    1: { missDrawsBonusCard: true, nearbyTeammateMissGrantsFood: 1 }, // Not really a miss
    2: { freeDamageForEggs: { damage: 1, eggsGained: 2 } }, // Always on Purpose
    3: { freeEggForCard: true }, // Quick Claws
  },
  'Aracorn, Heir of Condor': {
    1: { mayChooseStartingLocation: true, grantsNearbyImmunity: ['Bird Flu'] }, // Free Range
    2: { freeOutsideMove: true }, // Long Shanks
    3: { weatherImmunity: ['Severe Wind'], freeMoveAnotherPlayerForEgg: true }, // Wilderness Guide
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

// Phase 11d: cross-actor aura helpers — sum a named ability field across
// every OTHER alive player at a given location (Battle Cry, Bolsterer).
// "Nearby" throughout core_rules.md means "same location."
function sumNearbyAura(state: GameState, location: Location, excludePlayerId: string | null, field: keyof ChickenAbility): number {
  let total = 0;
  for (const p of state.players) {
    if (!p.alive || p.location !== location || p.id === excludePlayerId) continue;
    for (const ability of getActiveChickenAbilities(p.chickenName, p.stage)) {
      const value = ability[field];
      if (typeof value === 'number') total += value;
    }
  }
  return total;
}

// Battle Cry: "+1 to a nearby teammate's own action roll" — a bonus to
// `playerId`'s own production/forage/lay-egg roll from any OTHER player at
// their location who carries the aura (excludes the roller themselves,
// since the card says "teammate," not "yourself").
export function nearbyAuraTeammateRollBonus(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  return sumNearbyAura(state, player.location, playerId, 'auraTeammateRollBonus');
}

// Battle Cry: "-1 to a Predator die rolled nearby" — checked against
// whichever location the roll is happening at (the predator's own
// location, or the attacker's for a Grub roll, which has none of its own).
export function nearbyAuraPredatorRollPenalty(state: GameState, location: Location): number {
  return sumNearbyAura(state, location, null, 'auraPredatorRollPenalty');
}

// Bolsterer: "+1 max attack strength to a nearby player, if not at full
// health" — checked against the attacker's own location, excluding
// themselves (an aura granted by someone ELSE nearby, not a self-buff).
export function nearbyAuraMaxAttackBonus(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.health >= player.maxHealth) return 0;
  return sumNearbyAura(state, player.location, playerId, 'auraMaxAttackBonusIfDamaged');
}

// Phase 11f: consumes `player.pendingRollIntercept` (Strategem, Deus Eggs
// Machina, "Reroll a teammate's/any die," Spotted Lanternfly) against an
// already-rolled value — see the field's doc comment in types.ts for the
// full list of covered roll sites (every attributable die roll, not just
// a handful).
export function applyRollIntercept(player: PlayerState, roll: number, rng: RNG): { roll: number; player: PlayerState } {
  const intercept = player.pendingRollIntercept;
  if (!intercept) return { roll, player };
  let result = roll;
  if (intercept.mode === 'reroll') result = rollDie(rng);
  else if (intercept.mode === 'adjustBy') result = Math.min(6, Math.max(1, roll + (intercept.value ?? 0)));
  else if (intercept.mode === 'forceValue' && intercept.value != null) result = intercept.value;
  return { roll: result, player: { ...player, pendingRollIntercept: null } };
}

// "Peek" variant for combat-stage hooks (custom Predator effects, Grub
// defend rolls, chicken on-attack/on-damage rolls, weather on-attack
// rolls) that receive a GameState + playerId and return a
// CombatStageResult, with no way to thread an updated player back out
// through their own return type. Doesn't clear the flag itself — every
// one of these hooks only ever runs from inside resolveCombat, and
// actions.ts's attack() unconditionally clears pendingRollIntercept in
// its own post-combat cleanup once the attack resolves, regardless of
// which specific hook actually consumed it (same as it already did for
// the original predator-effect roll site this generalizes from).
export function peekRollIntercept(state: GameState, playerId: string, roll: number, rng: RNG): number {
  const player = state.players.find((p) => p.id === playerId);
  return player ? applyRollIntercept(player, roll, rng).roll : roll;
}

// Phase 11i: "For 1 Turn, borrow an unlocked ability from a teammate" — a
// single stage's ability object from whichever chicken/stage the player
// currently has pending, looked up fresh (not stored directly, since
// ChickenAbility can hold functions that wouldn't survive Firestore sync).
export function borrowedAbility(player: PlayerState): ChickenAbility | null {
  if (!player.pendingBorrowedAbility) return null;
  const { chickenName, stage } = player.pendingBorrowedAbility;
  return CHICKEN_ABILITIES[chickenName]?.[stage] ?? null;
}

// Own unlocked abilities plus the borrowed one, if any — see the "free
// action" gate checks in actions.ts for where this is actually consulted
// (the scope note on PlayerState.pendingBorrowedAbility explains why this
// isn't wired into every ability-consuming call site in the engine).
export function getOwnAndBorrowedAbilities(player: PlayerState): ChickenAbility[] {
  const own = getActiveChickenAbilities(player.chickenName, player.stage);
  const borrowed = borrowedAbility(player);
  return borrowed ? [...own, borrowed] : own;
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
