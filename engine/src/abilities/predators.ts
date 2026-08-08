// The 29 "executable now" predator stage effects + 3 passive/permanent
// Loot Drops (docs/rules-audit.md). Gas Mask (Professor Moltiarty's Loot)
// is the one single-use, player-activated Loot Drop among these — its
// grant already works (phase 4's lootDrops tracking); activating it is
// deferred to phase 7's held-effect-playing mechanism.
import { Stage, rollDie, CombatContext, RNG, CombatStageResult } from '../types.js';
import { loadGrubCards, parseIntField } from '../data.js';
import { activeWeatherName } from './weather.js';
import { peekRollIntercept } from './chickens.js';
import { PredatorEffect, PredatorLoot } from './types.js';

// Sheriff of Rottingham's 3 stage effects all key off a face-up Grub's
// *printed* max health (the card's own `health` field), not its current
// battle-worn health — "an empty deck adds 1" per its confirmed S3 text.
function grubMaxHealth(faceUp: { cardId: number } | null): number {
  if (!faceUp) return 1;
  return parseIntField(loadGrubCards()[faceUp.cardId]?.health ?? null, 0);
}

function coopellaRoll(ctx: CombatContext, rng: RNG): CombatStageResult {
  const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
  if (roll === 4) return { forcesExtraActionTokenUnavailable: true };
  if (roll >= 5) return { forcesWeatherRedraw: true };
  return {};
}

export const PREDATOR_EFFECTS: Record<string, Partial<Record<Stage, PredatorEffect>>> = {
  Eggsmeralda: {
    1: { rollOutcomes: [{ min: 4, max: 6, selfHeal: 1 }] },
    // S2/S3's "take from every player" branch reaches beyond the
    // attacker, so these use `custom` rather than the single-target
    // rollOutcomes shape (same reasoning as Shere Corn's splash damage).
    2: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        if (roll <= 2) return {};
        if (roll <= 4) return { attackerEggDelta: -1 };
        return { takesEggsFromEveryone: 1 };
      },
    },
    3: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        if (roll <= 2) return {};
        if (roll <= 4) return { attackerEggDelta: -2 };
        return { takesEggsFromEveryone: 2 };
      },
    },
  },
  'Sal Moe Nella': {
    1: { rollOutcomes: [{ min: 4, max: 6, attackerStatus: ['cannotEat'] }] },
    2: {
      rollOutcomes: [
        { min: 3, max: 4, attackerStatus: ['cannotEat'] },
        { min: 5, max: 6, attackerStatus: ['cannotHeal'] },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 3, attackerStatus: ['cannotEat'] },
        { min: 4, max: 6, attackerStatus: ['cannotHeal'] },
      ],
    },
  },
  'Professor Moltiarty': {
    1: { alwaysStatus: ['skipProduction'] },
    2: { rollOutcomes: [{ min: 4, max: 6, attackerStatus: ['cannotParticipateInEggExchange'] }] },
    3: { alwaysStatus: ['cannotParticipateInEggExchange'] },
  },
  'Hens Gruber': {
    1: {
      rollOutcomes: [
        { min: 3, max: 4, attackerFoodLoss: 1 },
        { min: 5, max: 6, attackerFoodLoss: 2 },
      ],
    },
    2: {
      rollOutcomes: [
        { min: 1, max: 2, attackerFoodLoss: 1 },
        { min: 3, max: 4, attackerFoodLoss: 2 },
        { min: 5, max: 6, attackerFoodLoss: 3 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 1, attackerFoodLoss: 1 },
        { min: 2, max: 4, attackerFoodLoss: 2 },
        { min: 5, max: 6, attackerFoodLoss: 3 },
      ],
    },
  },
  Chicksune: {
    1: { immuneToBonusCardEffects: true },
    2: {
      rollOutcomes: [
        { min: 5, max: 5, selfHeal: 1 },
        { min: 6, max: 6, selfHeal: 2 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 4, max: 4, selfHeal: 1 },
        { min: 5, max: 5, selfHeal: 2 },
        { min: 6, max: 6, selfHeal: 3 },
      ],
    },
  },
  'Shere Corn': {
    // "All nearby players take N splash damage" — hits everyone at the
    // Predator's location (the attacker included), on top of the normal
    // return attack, so it uses the `custom` escape hatch rather than the
    // single-target rollOutcomes shape.
    1: { custom: (ctx, rng) => (peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng) >= 4 ? { splashDamage: 1 } : {}) },
    2: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        if (roll <= 2) return { splashDamage: 1 };
        if (roll <= 5) return { splashDamage: 2 };
        return { splashDamage: 3 };
      },
    },
    3: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        if (roll === 1) return { splashDamage: 1 };
        if (roll <= 4) return { splashDamage: 2 };
        return { splashDamage: 3 };
      },
    },
  },
  'Weasma and Clawnk': {
    // "Roll before attack... Move out of this location (deal and take no
    // DMG, keep food, pick your destination)" — voids the combat instance
    // entirely (dodged + predatorDodges) and flags whoever's forced out
    // (PlayerState.pendingForcedRelocation), leaving their location
    // unchanged. "Pick your destination" is their own choice — a
    // synchronous resolver can't pause mid-combat to ask, so it's resolved
    // afterward via actions.ts's completeForcedRelocation.
    1: {
      custom: (ctx, rng) =>
        peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng) >= 4
          ? { dodged: true, predatorDodges: true, forcedRelocation: { playerId: ctx.attackerId } }
          : {},
    },
    2: {
      custom: (ctx, rng) =>
        peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng) >= 3
          ? { dodged: true, predatorDodges: true, forcedRelocation: { playerId: ctx.attackerId } }
          : {},
    },
    3: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        if (roll > 3) return { dodged: true, predatorDodges: true, forcedRelocation: { playerId: ctx.attackerId } };
        // "A teammate moves out" — a random other alive player at this
        // location, if any; falls back to the attacker if they're alone.
        const attacker = ctx.state.players.find((p) => p.id === ctx.attackerId)!;
        const teammates = ctx.state.players.filter((p) => p.alive && p.id !== attacker.id && p.location === attacker.location);
        const mover = teammates.length > 0 ? teammates[Math.floor(rng() * teammates.length)] : attacker;
        return { dodged: true, predatorDodges: true, forcedRelocation: { playerId: mover.id } };
      },
    },
  },
  Cleopoultra: {
    1: { rollOutcomes: [{ min: 5, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
    2: { rollOutcomes: [{ min: 5, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
    3: { rollOutcomes: [{ min: 4, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
  },
  'Ursula Bone': {
    1: { rollOutcomes: [{ min: 4, max: 6, returnAttackBonus: 1 }] },
    2: {
      rollOutcomes: [
        { min: 2, max: 5, returnAttackBonus: 1 },
        { min: 6, max: 6, returnAttackBonus: 2 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 2, returnAttackBonus: 1 },
        { min: 3, max: 5, returnAttackBonus: 2 },
        { min: 6, max: 6, returnAttackBonus: 3 },
      ],
    },
  },
  "Hendel's Mother": {
    1: { returnAttackIfAttackerHasNoBonusCard: 1 },
    2: { rollOutcomes: [{ min: 4, max: 6, discardCard: 'bonus' }] },
    3: {
      rollOutcomes: [
        { min: 3, max: 4, discardCard: 'bonus' },
        { min: 5, max: 6, discardCard: 'grub' },
      ],
    },
  },
  // "+N health during [weather]" — modeled as a self-heal (up to
  // maxHealth) applied every combat instance while that card is active,
  // not a permanent maxHealth change, since the base model doesn't track
  // a predator's maxHealth fluctuating with the weather elsewhere. "Can't
  // use Bonus/Grub Cards to dodge" is deliberately out of scope — see
  // docs/engine-plan.md's phase 11j writeup for why.
  'Owl Coopone': {
    // Resolved from the attacker's own weather (matters under Mudslide,
    // where different players can be experiencing different personal
    // cards at once — see abilities/weather.ts's activeWeatherName).
    1: {
      custom: (ctx) => (activeWeatherName(ctx.state, ctx.attackerId) === 'Nighttime' ? { predatorHealthDelta: 2, returnAttackDelta: 1 } : {}),
    },
    2: { custom: (ctx) => (activeWeatherName(ctx.state, ctx.attackerId) === 'Sunny' ? { predatorHealthDelta: 3 } : {}) },
    3: { custom: (ctx) => (activeWeatherName(ctx.state, ctx.attackerId) === 'Snow' ? { predatorHealthDelta: 4 } : {}) },
  },
  'Chew Bawka': {
    // Dynamic return-attack scaling — each stage counts a different live
    // player population, so these use the `custom` escape hatch rather
    // than a fixed roll table.
    1: { custom: (ctx) => ({ returnAttackDelta: ctx.state.players.filter((p) => p.alive && p.location === 'Coop').length }) }, // +1 per chicken in the Coop
    2: {
      custom: (ctx) => {
        const attacker = ctx.state.players.find((p) => p.id === ctx.attackerId)!;
        const teammatesHere = ctx.state.players.filter((p) => p.alive && p.id !== attacker.id && p.location === attacker.location).length;
        return { returnAttackDelta: teammatesHere }; // +1 per teammate in this location
      },
    },
    3: {
      custom: (ctx) => {
        const predator = ctx.state.predators.find((p) => p.name === 'Chew Bawka')!;
        const elsewhere = ctx.state.players.filter((p) => p.alive && p.location !== 'Coop' && p.location !== predator.location).length;
        return { returnAttackDelta: elsewhere }; // +1 per chicken in every other Outside location
      },
    },
  },
  // "4: Exhaust Extra Action Token. 5-6: Draw new Weather Card (redraw on
  // Fair/Sunny/Snow)" — identical shape at every stage; which positive
  // card to avoid on redraw depends on the current season, not the stage,
  // so that's resolved centrally by whoever consumes forcesWeatherRedraw
  // (combat.ts), not duplicated per stage here.
  Coopella: {
    1: { custom: coopellaRoll },
    2: { custom: coopellaRoll },
    3: { custom: coopellaRoll },
  },
  'Sheriff of Rottingham': {
    1: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        return { returnAttackOverride: grubMaxHealth(ctx.state.grubDecks[roll <= 3 ? 'inside' : 'outside'].faceUp) };
      },
    },
    2: {
      custom: (ctx, rng) => {
        const roll = peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng);
        return { returnAttackDelta: grubMaxHealth(ctx.state.grubDecks[roll <= 3 ? 'inside' : 'outside'].faceUp) };
      },
    },
    3: {
      custom: (ctx) => ({
        returnAttackOverride: grubMaxHealth(ctx.state.grubDecks.inside.faceUp) + grubMaxHealth(ctx.state.grubDecks.outside.faceUp),
      }),
    },
  },
  'Gravekeeper Fowl': {
    1: { preventsAttackOnMoveIn: true, onDefeatRevive: { threshold: 5, health: 1 } },
    2: { preventsAttackOnMoveIn: true, onDefeatRevive: { threshold: 5, health: 2 } },
    3: { onDefeatRevive: { threshold: 5, health: 3 } },
  },
  Layonardo: {
    1: {
      rollOutcomes: [
        { min: 1, max: 3, cannotLeaveLocation: true },
        { min: 4, max: 6, attackerTakesFixedDamage: 1 },
      ],
    },
    2: { rollOutcomes: [{ min: 3, max: 6, cannotLeaveLocation: true }] },
    3: { rollOutcomes: [{ min: 3, max: 6, cannotLeaveLocation: true }] },
  },
};

export const PREDATOR_LOOT: Record<string, PredatorLoot> = {
  'Hens Gruber': { returnAttackReduction: 1 }, // Bandit Mask (multi-use, passive)
  'Shere Corn': { permanentMaxHealthBonus: 1 }, // Signature Cloak
  'Ursula Bone': { permanentAttackBonus: 1 }, // Brass Knuckles
  Eggsmeralda: { stash: { resource: 'egg', startingAmount: 3 } }, // Egg Stash
  'Sal Moe Nella': { stash: { resource: 'food', startingAmount: 3 } }, // Food Stash
  Cleopoultra: { chargedRangedAttack: { charges: 3, damagePerCharge: 1 } }, // Arrow Pack
  'Professor Moltiarty': { activatableAttackReduction: { amount: 1 } }, // Gas Mask
  'Owl Coopone': { neverMissesAttacks: true }, // Monocle
  Chicksune: { rerollPredatorEffectKeepBest: true }, // Fox's Staff
  Coopella: { everyoneAtLocationRefreshExtraAction: true }, // Chamberstick
  "Hendel's Mother": { freeDrawBonusCardForSelfOrTeammate: true }, // Cave Hoard
  'Chew Bawka': { healEveryoneAtLocation: 1 }, // Healing Poultice
  'Weasma and Clawnk': { freeMoveForSelfOrNearby: true }, // Secret Tunnels
  'Sheriff of Rottingham': { dungeonKeys: true }, // Dungeon Keys
  'Gravekeeper Fowl': { selfRevive: true }, // Gravekeeper's Light
  Layonardo: { grantsWeatherImmunityForTurn: true }, // Portable House
};
