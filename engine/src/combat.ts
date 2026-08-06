// Combat resolution machinery: the 3-step order (Weather -> Predator ->
// Chicken abilities), return-attack damage, loot drop on kill, Grub
// combat, the death consequence, and predator level-up at season end.
//
// Scope boundary (decided before this phase): this module builds the
// combat *pipeline* only. The Weather/Predator/Chicken-ability *content*
// — the free-text roll-table effects themselves (e.g. Hens Gruber's
// "Lose 1 food", Ursula Bone's "Return attack +1") — stays stubbed as
// no-op hooks. That's phase 6 ("ability effect engine"). The one
// cross-cutting behavior phase 4 needs structurally is `dodged`:
// "Dodging a return attack also dodges the Predator effect"
// (core_rules.md).
import {
  GameState,
  PlayerState,
  PredatorState,
  Stage,
  DifficultyLevel,
  HeldGrubCard,
  CombatContext,
  CombatStageResult,
  RNG,
  rollDie,
} from './types.js';
import { findPredator, loadGrubCards, parseIntField, parseHealthMultiplier } from './data.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { dealFaceUp } from './grubs.js';
import { bossHealthBonus } from './setup.js';
import { activeWeatherEffect } from './abilities/weather.js';
import { getActiveChickenAbilities } from './abilities/chickens.js';
import { PREDATOR_EFFECTS, PREDATOR_LOOT } from './abilities/predators.js';
import { GRUB_DEFEND_EFFECTS } from './abilities/grubCards.js';

function mergeCombatResults(a: CombatStageResult, b: CombatStageResult): CombatStageResult {
  return {
    dodged: a.dodged || b.dodged,
    returnAttackDelta: (a.returnAttackDelta ?? 0) + (b.returnAttackDelta ?? 0),
    returnAttackOverride: b.returnAttackOverride ?? a.returnAttackOverride,
    predatorDodges: a.predatorDodges || b.predatorDodges,
    predatorHealthDelta: (a.predatorHealthDelta ?? 0) + (b.predatorHealthDelta ?? 0),
    attackerFoodDelta: (a.attackerFoodDelta ?? 0) + (b.attackerFoodDelta ?? 0),
    attackerStatusEffects: [...(a.attackerStatusEffects ?? []), ...(b.attackerStatusEffects ?? [])],
    discardAfterCombat: [...(a.discardAfterCombat ?? []), ...(b.discardAfterCombat ?? [])],
  };
}

// Default weatherEffect hook: the active weather card's own combat effect
// (currently just Fog's miss roll).
function defaultWeatherEffect(ctx: CombatContext, rng: RNG): CombatStageResult {
  return activeWeatherEffect(ctx.state)?.onAttack?.(ctx, rng) ?? {};
}

// Default targetEffect hook: the target Predator's own roll-table effect
// (docs/rules-audit.md's "executable now" predator items) plus any
// passive Loot Drop modifiers the attacker holds.
function defaultTargetEffect(ctx: CombatContext, rng: RNG): CombatStageResult {
  if (ctx.targetType === 'grub') {
    const side = ctx.targetId as 'inside' | 'outside';
    const faceUp = ctx.state.grubDecks[side].faceUp;
    const grubName = faceUp ? loadGrubCards()[faceUp.cardId]?.name : null;
    const effect = grubName ? GRUB_DEFEND_EFFECTS[grubName] : undefined;
    if (!effect?.rollOutcomes) return {};
    const roll = rollDie(rng);
    const outcome = effect.rollOutcomes.find((o) => roll >= o.min && roll <= o.max);
    if (!outcome) return {};
    const result: CombatStageResult = {};
    if (outcome.selfHeal) result.predatorHealthDelta = outcome.selfHeal;
    if (outcome.returnAttackOverride != null) result.returnAttackOverride = outcome.returnAttackOverride;
    if (outcome.predatorDodges) result.predatorDodges = true;
    return result;
  }
  if (ctx.targetType !== 'predator') return {};
  const predator = ctx.state.predators.find((p) => p.name === ctx.targetId);
  if (!predator) return {};
  const attacker = getPlayer(ctx.state.players, ctx.attackerId);
  const effect = PREDATOR_EFFECTS[predator.name]?.[predator.stage];

  let result: CombatStageResult = {};
  if (effect?.custom) {
    result = effect.custom(ctx, rng);
  } else if (effect) {
    if (effect.alwaysStatus) result.attackerStatusEffects = [...effect.alwaysStatus];
    if (effect.returnAttackIfAttackerHasNoBonusCard != null && attacker.bonusCardHand.length === 0) {
      result.returnAttackDelta = (result.returnAttackDelta ?? 0) + effect.returnAttackIfAttackerHasNoBonusCard;
    }
    // Scorpion's Grub Reward: "for one attack, ignore all Predator roll
    // effects" — skips only the roll-table branch below, not the
    // unconditional alwaysStatus/returnAttackIfAttackerHasNoBonusCard ones.
    if (effect.rollOutcomes && !attacker.pendingIgnorePredatorRoll) {
      const roll = Math.max(1, rollDie(rng) - attacker.pendingPredatorRollReduction);
      const outcome = effect.rollOutcomes.find((o) => roll >= o.min && roll <= o.max);
      if (outcome) {
        if (outcome.selfHeal && !predator.defeated) result.predatorHealthDelta = outcome.selfHeal;
        if (outcome.attackerStatus) result.attackerStatusEffects = [...(result.attackerStatusEffects ?? []), ...outcome.attackerStatus];
        if (outcome.attackerFoodLoss) result.attackerFoodDelta = -outcome.attackerFoodLoss;
        if (outcome.returnAttackBonus) result.returnAttackDelta = (result.returnAttackDelta ?? 0) + outcome.returnAttackBonus;
        if (outcome.discardCard) result.discardAfterCombat = [outcome.discardCard];
        if (outcome.cannotLeaveLocation) result.attackerStatusEffects = [...(result.attackerStatusEffects ?? []), 'cannotLeaveLocation'];
        if (outcome.attackerTakesFixedDamage != null) result.returnAttackOverride = outcome.attackerTakesFixedDamage;
        if (outcome.predatorDodges) result.predatorDodges = true;
        if (outcome.returnAttackOverride != null) result.returnAttackOverride = outcome.returnAttackOverride;
      }
    }
  }

  for (const lootName of attacker.lootDrops) {
    const reduction = PREDATOR_LOOT[lootName]?.returnAttackReduction;
    if (reduction) result.returnAttackDelta = (result.returnAttackDelta ?? 0) - reduction;
  }

  return result;
}

// Default chickenAbilities hook: the attacker's cumulative unlocked-stage
// abilities that act on their own attack (Evasion's dodge roll) plus any
// passive return-attack reduction (Thick Feathers).
function defaultChickenAbilities(ctx: CombatContext, rng: RNG): CombatStageResult {
  const attacker = getPlayer(ctx.state.players, ctx.attackerId);
  const abilities = getActiveChickenAbilities(attacker.chickenName, attacker.stage);
  let result: CombatStageResult = {};
  for (const ability of abilities) {
    if (ability.onAttack) result = mergeCombatResults(result, ability.onAttack(ctx, rng));
  }
  const reduction = abilities.reduce((sum, a) => sum + (a.returnAttackReduction ?? 0), 0);
  if (reduction) result.returnAttackDelta = (result.returnAttackDelta ?? 0) - reduction;

  // Phase 7 Bonus Card / Grub Reward attack-time effects.
  if (attacker.pendingDodgeNextAttack) result.dodged = true;
  if (ctx.targetType === 'predator' && attacker.permanentReturnAttackReductionRoll) {
    const { threshold, amount } = attacker.permanentReturnAttackReductionRoll;
    if (rollDie(rng) >= threshold) result.returnAttackDelta = (result.returnAttackDelta ?? 0) - amount;
  }
  return result;
}

function runCombatEffects(state: GameState, attackerId: string, targetType: 'predator' | 'grub', targetId: string, rng: RNG): CombatStageResult {
  const hooks = state.config.hooks ?? {};
  const ctx: CombatContext = { state, attackerId, targetType, targetId };
  const weatherResult = hooks.weatherEffect ? hooks.weatherEffect(ctx, rng) : defaultWeatherEffect(ctx, rng);
  const targetResult = hooks.targetEffect ? hooks.targetEffect(ctx, rng) : defaultTargetEffect(ctx, rng);
  const chickenResult = hooks.chickenAbilities ? hooks.chickenAbilities(ctx, rng) : defaultChickenAbilities(ctx, rng);
  return mergeCombatResults(mergeCombatResults(weatherResult, targetResult), chickenResult);
}

// core_rules.md "Death": discard all food, eggs, Bonus Cards, Grub Cards,
// and Meal Counter token. Loot Drops are kept. The Brood-triggered
// revival flow is phase 9 — this is just the immediate consequence.
export function applyDeath(player: PlayerState): PlayerState {
  return {
    ...player,
    alive: false,
    food: 0,
    eggs: 0,
    mealCounter: 0,
    bonusCardHand: [],
    grubHand: [],
  };
}

export function applyDamageAndMaybeDeath(player: PlayerState, damage: number): PlayerState {
  const damaged = { ...player, health: Math.max(0, player.health - damage) };
  return damaged.health <= 0 ? applyDeath(damaged) : damaged;
}

function resolvePredatorAttack(
  state: GameState,
  playerId: string,
  predatorName: string,
  attackStrength: number,
  effects: CombatStageResult,
  mitigation?: { resource: 'bonusCards' | 'eggs'; amount: number },
): GameState {
  const predator = state.predators.find((p) => p.name === predatorName);
  if (!predator) throw new Error(`Unknown predator: ${predatorName}`);
  const predatorData = findPredator(predatorName);
  const stageData = predatorData.stages.find((s) => s.stage === predator.stage);
  const baseReturnAttack = parseIntField(stageData?.returnAttack ?? null, 0);
  const attackerBeforeCombat = getPlayer(state.players, playerId);
  let returnAttack = effects.dodged
    ? 0
    : (effects.returnAttackOverride ?? Math.max(0, baseReturnAttack + (effects.returnAttackDelta ?? 0)));
  returnAttack = Math.max(0, returnAttack - attackerBeforeCombat.pendingIncomingDamageReduction);

  const damageToPredator = effects.predatorDodges ? 0 : attackStrength;
  const newHealth = Math.max(0, predator.health - damageToPredator + (effects.predatorHealthDelta ?? 0));
  const cappedHealth = Math.min(predator.maxHealth, newHealth);
  const justDefeated = cappedHealth <= 0 && !predator.defeated;

  let predators: PredatorState[] = state.predators.map((p) =>
    p.name === predatorName ? { ...p, health: cappedHealth, defeated: p.defeated || cappedHealth <= 0 } : p,
  );

  const player = getPlayer(state.players, playerId);
  let updatedPlayer = player;

  // Misdirection / Eggpire Strikes Back: pre-committed resource spend to
  // reduce the return attack about to land.
  if (mitigation && returnAttack > 0) {
    const ability = getActiveChickenAbilities(player.chickenName, player.stage).find(
      (a) => a.damageMitigation?.resource === mitigation.resource,
    );
    if (ability?.damageMitigation) {
      const available = mitigation.resource === 'bonusCards' ? player.bonusCardHand.length : player.eggs;
      const spent = Math.min(mitigation.amount, available);
      const reduction = Math.max(0, ability.damageMitigation.compute(returnAttack, spent));
      returnAttack = Math.max(0, returnAttack - reduction);
      if (mitigation.resource === 'bonusCards') {
        updatedPlayer = { ...updatedPlayer, bonusCardHand: updatedPlayer.bonusCardHand.slice(spent) };
      } else {
        updatedPlayer = { ...updatedPlayer, eggs: updatedPlayer.eggs - spent };
      }
    }
  }

  const tookDamage = returnAttack > 0;
  updatedPlayer = applyDamageAndMaybeDeath(updatedPlayer, returnAttack);
  if (tookDamage && updatedPlayer.alive) {
    // Berserker: heal on taking damage (only meaningful if it survived).
    for (const ability of getActiveChickenAbilities(updatedPlayer.chickenName, updatedPlayer.stage)) {
      if (!ability.onDamageTaken) continue;
      const heal = ability.onDamageTaken({ state, playerId }, state.config.rng);
      if (heal) updatedPlayer = { ...updatedPlayer, health: Math.min(updatedPlayer.maxHealth, updatedPlayer.health + heal) };
    }
  }
  if (effects.attackerFoodDelta) {
    updatedPlayer = { ...updatedPlayer, food: Math.max(0, updatedPlayer.food + effects.attackerFoodDelta) };
  }
  if (effects.attackerStatusEffects?.length) {
    updatedPlayer = {
      ...updatedPlayer,
      statusEffectsUntilNextEggExchange: [
        ...new Set([...updatedPlayer.statusEffectsUntilNextEggExchange, ...effects.attackerStatusEffects]),
      ],
    };
  }
  for (const kind of effects.discardAfterCombat ?? []) {
    if (kind === 'bonus' && updatedPlayer.bonusCardHand.length > 0) {
      updatedPlayer = { ...updatedPlayer, bonusCardHand: updatedPlayer.bonusCardHand.slice(1) };
    } else if (kind === 'grub' && updatedPlayer.grubHand.length > 0) {
      updatedPlayer = { ...updatedPlayer, grubHand: updatedPlayer.grubHand.slice(1) };
    }
  }

  let bonusDeck = state.bonusDeck;
  let players = replacePlayer(state.players, updatedPlayer);

  if (justDefeated) {
    updatedPlayer = { ...updatedPlayer, lootDrops: [...updatedPlayer.lootDrops, predatorName] };
    // Permanent passive stat-boost Loot Drops (Signature Cloak, Brass
    // Knuckles) apply once, at the moment of grant — same treatment as a
    // level-up, not a dynamic per-attack check.
    const loot = PREDATOR_LOOT[predatorName];
    if (loot?.permanentAttackBonus) {
      updatedPlayer = { ...updatedPlayer, attackStrength: updatedPlayer.attackStrength + loot.permanentAttackBonus };
    }
    if (loot?.permanentMaxHealthBonus) {
      updatedPlayer = {
        ...updatedPlayer,
        maxHealth: updatedPlayer.maxHealth + loot.permanentMaxHealthBonus,
        health: updatedPlayer.health + loot.permanentMaxHealthBonus,
      };
    }
    // Revenge: "present" means at the Predator's location when it falls —
    // not just the attacker, so this checks every player there (each
    // resolves their own trigger independently, which is why phase 2
    // classified it as executable-now rather than a true cross-actor aura).
    players = replacePlayer(state.players, updatedPlayer);
    for (const present of players) {
      if (present.location !== predator.location || !present.alive) continue;
      const wantsBonusCard = getActiveChickenAbilities(present.chickenName, present.stage).some(
        (a) => a.onPredatorDefeated?.({ state, playerId: present.id }).drawBonusCard,
      );
      if (!wantsBonusCard || present.bonusCardHand.length >= present.bonusCardHandLimit) continue;
      let { drawPile, discard } = bonusDeck;
      if (drawPile.length === 0) {
        drawPile = [...discard];
        discard = [];
      }
      const [cardId, ...rest] = drawPile;
      if (cardId == null) continue;
      bonusDeck = { drawPile: rest, discard };
      const grantedPlayer = { ...present, bonusCardHand: [...present.bonusCardHand, cardId] };
      players = players.map((p) => (p.id === present.id ? grantedPlayer : p));
      if (present.id === playerId) updatedPlayer = grantedPlayer;
    }
    // Boss stays face-down until the last regular predator dies (core_rules.md).
    const anyRegularSurviving = predators.some((p) => !p.isBoss && !p.defeated);
    if (!anyRegularSurviving) {
      predators = predators.map((p) => (p.isBoss ? { ...p, revealed: true } : p));
    }
  }

  return { ...state, predators, bonusDeck, players };
}

function resolveGrubAttack(
  state: GameState,
  playerId: string,
  side: 'inside' | 'outside',
  attackStrength: number,
  effects: CombatStageResult,
): GameState {
  const deckSide = state.grubDecks[side];
  const faceUp = deckSide.faceUp;
  if (!faceUp) throw new Error(`No face-up Grub ${side} to attack`);

  // `predatorDodges` is reused here to mean "the attack itself misses" (the
  // Grub's own defend roll, e.g. "1: Miss your attack") — same field, same
  // "suppress damage to the target" meaning as the predator combat path.
  const damageToGrub = effects.predatorDodges ? 0 : attackStrength;
  const newHealth = Math.max(0, faceUp.currentHealth - damageToGrub + (effects.predatorHealthDelta ?? 0));

  // core_rules.md: dodging (the attacker's own dodge) also dodges the
  // target's effect, so `effects.dodged` suppresses the Grub's retaliation
  // the same way it suppresses a Predator's return attack.
  let player = getPlayer(state.players, playerId);
  const attackerDamage = effects.dodged ? 0 : Math.max(0, (effects.returnAttackOverride ?? 0) - player.pendingIncomingDamageReduction);
  if (attackerDamage > 0) player = applyDamageAndMaybeDeath(player, attackerDamage);

  if (newHealth > 0) {
    return {
      ...state,
      players: replacePlayer(state.players, player),
      grubDecks: { ...state.grubDecks, [side]: { ...deckSide, faceUp: { ...faceUp, currentHealth: newHealth } } },
    };
  }

  // Defeated: the card becomes the killer's own held card at full health —
  // a fresh personal resource, separate from the "wild" combat health it
  // just lost (see docs/rules-audit.md's confirmed Grub lifecycle note).
  const fullHealth = parseIntField(loadGrubCards()[faceUp.cardId]?.health ?? null, 0);
  const heldCard: HeldGrubCard = { cardId: faceUp.cardId, currentHealth: fullHealth, rewardUsed: false };
  const updatedPlayer = { ...player, grubHand: [...player.grubHand, heldCard] };
  const redealt = dealFaceUp({ ...deckSide, faceUp: null });

  return {
    ...state,
    players: replacePlayer(state.players, updatedPlayer),
    grubDecks: { ...state.grubDecks, [side]: redealt },
  };
}

// Entry point actions.ts's `attack` calls after deducting cost.
export function resolveCombat(
  state: GameState,
  playerId: string,
  targetType: 'predator' | 'grub',
  targetId: string,
  attackStrength: number,
  mitigation?: { resource: 'bonusCards' | 'eggs'; amount: number },
): GameState {
  const effects = runCombatEffects(state, playerId, targetType, targetId, state.config.rng);
  return targetType === 'predator'
    ? resolvePredatorAttack(state, playerId, targetId, attackStrength, effects, mitigation)
    : resolveGrubAttack(state, playerId, targetId as 'inside' | 'outside', attackStrength, effects);
}

// End-of-Spring/Summer recalculation (core_rules.md): surviving predators
// advance one stage; health recalculates from the new stage's multiplier
// (+ Boss bonus if applicable) x player count, with damage sustained so
// far carried over. Defeated predators and the Boss (already stage 3, per
// createPredator in setup.ts) are no-ops.
export function levelUpPredators(predators: PredatorState[], playerCount: number, difficulty: DifficultyLevel): PredatorState[] {
  return predators.map((predator) => {
    if (predator.defeated || predator.stage >= 3) return predator;
    const nextStage = (predator.stage + 1) as Stage;
    const data = findPredator(predator.name);
    const stageData = data.stages.find((s) => s.stage === nextStage);
    if (!stageData) return predator;
    const bonus = predator.isBoss ? bossHealthBonus(difficulty) : 0;
    const newMaxHealth = (parseHealthMultiplier(stageData.healthMultiplier) + bonus) * playerCount;
    const damageTaken = predator.maxHealth - predator.health;
    return {
      ...predator,
      stage: nextStage,
      maxHealth: newMaxHealth,
      health: Math.max(0, newMaxHealth - damageTaken),
    };
  });
}
