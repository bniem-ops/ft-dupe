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
  Location,
  Season,
  RNG,
  rollDie,
} from './types.js';
import { findPredator, loadGrubCards, parseIntField, parseHealthMultiplier } from './data.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { dealFaceUp } from './grubs.js';
import { bossHealthBonus } from './setup.js';
import { activeWeatherEffect, redrawWeatherCard } from './abilities/weather.js';
import { getActiveChickenAbilities, nearbyAuraPredatorRollPenalty, applyRollIntercept } from './abilities/chickens.js';
import { PREDATOR_EFFECTS, PREDATOR_LOOT } from './abilities/predators.js';
import { GRUB_DEFEND_EFFECTS } from './abilities/grubCards.js';

// Coopella's "redraw on Fair/Sunny/Snow" clause — the guaranteed-positive
// card per season, same mapping setup.ts's setupWeather uses.
const SEASON_POSITIVE_CARD: Record<Season, string> = { Spring: 'Fair', Summer: 'Sunny', Fall: 'Snow' };

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
    splashDamage: (a.splashDamage ?? 0) + (b.splashDamage ?? 0),
    forcedRelocation: b.forcedRelocation ?? a.forcedRelocation,
    reflectReturnAttackToPredator: a.reflectReturnAttackToPredator || b.reflectReturnAttackToPredator,
    forcesExtraActionTokenUnavailable: a.forcesExtraActionTokenUnavailable || b.forcesExtraActionTokenUnavailable,
    forcesWeatherRedraw: a.forcesWeatherRedraw || b.forcesWeatherRedraw,
    takesEggsFromEveryone: (a.takesEggsFromEveryone ?? 0) + (b.takesEggsFromEveryone ?? 0),
    attackerEggDelta: (a.attackerEggDelta ?? 0) + (b.attackerEggDelta ?? 0),
  };
}

// Default weatherEffect hook: the active weather card's own combat effect
// (currently just Fog's miss roll).
function defaultWeatherEffect(ctx: CombatContext, rng: RNG): CombatStageResult {
  return activeWeatherEffect(ctx.state, ctx.attackerId)?.onAttack?.(ctx, rng) ?? {};
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
    const attackerLocation = getPlayer(ctx.state.players, ctx.attackerId).location;
    const roll = Math.max(1, rollDie(rng) - nearbyAuraPredatorRollPenalty(ctx.state, attackerLocation)); // Battle Cry
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
      const battleCryPenalty = nearbyAuraPredatorRollPenalty(ctx.state, predator.location); // Battle Cry
      const rollOnce = () => Math.max(1, rollDie(rng) - attacker.pendingPredatorRollReduction - battleCryPenalty);
      let roll = rollOnce();
      // Fox's Staff (Chicksune's Loot): "Roll for Predator effect twice,
      // pick the best one for you" — every roll table here escalates
      // toward worse outcomes at higher numbers, so the lower of the two
      // rolls is the milder (best-for-you) one.
      if (attacker.lootDrops.some((name) => PREDATOR_LOOT[name]?.rerollPredatorEffectKeepBest)) {
        roll = Math.min(roll, rollOnce());
      }
      // Strategem / Deus Eggs Machina / "Reroll a teammate's/any die" /
      // Spotted Lanternfly — actual clearing of the flag happens uniformly
      // in attack()'s post-combat cleanup, same as the other pending-*
      // combat flags; this hook can only influence the roll value, not
      // return player-state changes.
      if (attacker.pendingRollIntercept) {
        roll = applyRollIntercept(attacker, roll, rng).roll;
      }
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
  if (attacker.pendingReflectReturnAttack) {
    result.dodged = true;
    result.reflectReturnAttackToPredator = true;
  }
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
  if (damaged.health > 0) return damaged;
  // Gravekeeper's Light (Loot Drop): "If you die, come back to life with 1
  // health (single-use)" — bypasses the normal Brood-required revival flow
  // entirely. Checked here since every death in the game routes through
  // this one function (combat return attacks, weather/Bird Flu damage,
  // splash damage, card/reward health costs).
  if (damaged.lootDrops.includes('Gravekeeper Fowl') && (damaged.lootCharges['Gravekeeper Fowl'] ?? 0) > 0) {
    return { ...damaged, health: 1, lootCharges: { ...damaged.lootCharges, 'Gravekeeper Fowl': 0 } };
  }
  return applyDeath(damaged);
}

function resolvePredatorAttack(
  state: GameState,
  playerId: string,
  predatorName: string,
  attackStrength: number,
  effects: CombatStageResult,
  mitigation?: { resource: 'bonusCards' | 'eggs'; amount: number },
  damageRedirect?: { toPlayerId: string; amount: number },
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
  // Gas Mask (Loot Drop): -1 to this predator's return attack for the rest
  // of the day it was used on — reset daily in turn.ts's advanceDay.
  returnAttack = Math.max(0, returnAttack - attackerBeforeCombat.pendingIncomingDamageReduction - predator.returnAttackReductionToday);

  // Wasp Swarm (Grub Reward): "Dodge Predator attack, then base Predator
  // return attack is dealt to the Predator" — reflected damage stacks on
  // top of (or in place of, if also dodged) the normal attack damage.
  const reflectedDamage = effects.reflectReturnAttackToPredator ? baseReturnAttack : 0;
  const damageToPredator = (effects.predatorDodges ? 0 : attackStrength) + reflectedDamage;
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

  // Tank: pre-committed redirect of some/all of the primary attacker's
  // incoming return attack onto a nearby ability-holder — same "commit up
  // front" reasoning as Misdirection/Eggpire Strikes Back's mitigation
  // param, since a synchronous reducer can't prompt mid-resolution.
  // Triggers Just Reward (Atilla the Hen S3) on the redirect target.
  let tankHolder: PlayerState | null = null;
  if (damageRedirect && returnAttack > 0 && damageRedirect.toPlayerId !== playerId) {
    const candidate = getPlayer(state.players, damageRedirect.toPlayerId);
    const hasTank = getActiveChickenAbilities(candidate.chickenName, candidate.stage).some((a) => a.canRedirectDamage);
    if (hasTank && candidate.alive && candidate.location === player.location) {
      const redirected = Math.max(0, Math.min(damageRedirect.amount, returnAttack));
      returnAttack -= redirected;
      let updatedTank = applyDamageAndMaybeDeath(candidate, redirected);
      if (redirected > 0) {
        for (const ability of getActiveChickenAbilities(updatedTank.chickenName, updatedTank.stage)) {
          if (!ability.onProtectedTeammate) continue;
          const reward = ability.onProtectedTeammate({ state, playerId: updatedTank.id });
          if (reward.eggs) updatedTank = { ...updatedTank, eggs: updatedTank.eggs + reward.eggs };
        }
      }
      tankHolder = updatedTank;
    }
  }

  const tookDamage = returnAttack > 0;
  updatedPlayer = applyDamageAndMaybeDeath(updatedPlayer, returnAttack);
  let boardEggs = state.boardEggs;
  if (tookDamage && updatedPlayer.alive) {
    // Berserker: heal on taking damage (only meaningful if it survived).
    for (const ability of getActiveChickenAbilities(updatedPlayer.chickenName, updatedPlayer.stage)) {
      if (!ability.onDamageTaken) continue;
      const heal = ability.onDamageTaken({ state, playerId }, state.config.rng);
      if (heal) updatedPlayer = { ...updatedPlayer, health: Math.min(updatedPlayer.maxHealth, updatedPlayer.health + heal) };
    }
    // Bacaw!: "Lay an egg on the game board wherever you take damage."
    if (getActiveChickenAbilities(updatedPlayer.chickenName, updatedPlayer.stage).some((a) => a.layEggOnDamageTaken)) {
      boardEggs = { ...boardEggs, [updatedPlayer.location]: (boardEggs[updatedPlayer.location] ?? 0) + 1 };
    }
  }
  if (effects.attackerFoodDelta) {
    updatedPlayer = { ...updatedPlayer, food: Math.max(0, updatedPlayer.food + effects.attackerFoodDelta) };
  }
  if (effects.attackerEggDelta) {
    updatedPlayer = { ...updatedPlayer, eggs: Math.max(0, updatedPlayer.eggs + effects.attackerEggDelta) };
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

  let players = replacePlayer(state.players, updatedPlayer);
  if (tankHolder) players = replacePlayer(players, tankHolder);

  // Shere Corn: "All nearby players take N splash damage" — everyone alive
  // at the Predator's location, the attacker included (already reflected
  // in `players` above, so this just layers more damage on).
  if (effects.splashDamage) {
    players = players.map((p) => (p.alive && p.location === predator.location ? applyDamageAndMaybeDeath(p, effects.splashDamage!) : p));
  }

  // Eggsmeralda S2/S3: "Take N eggs from every player" — no location
  // qualifier, unlike Shere Corn's splash, so this hits everyone alive.
  if (effects.takesEggsFromEveryone) {
    players = players.map((p) => (p.alive ? { ...p, eggs: Math.max(0, p.eggs - effects.takesEggsFromEveryone!) } : p));
  }

  // Weasma and Clawnk: combat was voided (dodged/predatorDodges already
  // suppress all damage above) — the mover is flagged as forced out;
  // "pick your destination" is their own choice, resolved separately via
  // completeForcedRelocation (actions.ts), not decided here.
  if (effects.forcedRelocation) {
    const mover = getPlayer(players, effects.forcedRelocation.playerId);
    players = replacePlayer(players, { ...mover, pendingForcedRelocation: true });
  }

  // Coopella: "4: Exhaust Extra Action Token."
  if (effects.forcesExtraActionTokenUnavailable) {
    const attackerNow = getPlayer(players, playerId);
    if (attackerNow.extraActionTokenAvailable) players = replacePlayer(players, { ...attackerNow, extraActionTokenAvailable: false });
  }

  let weather = state.weather;
  // Coopella: "5-6: Draw new Weather Card (redraw on Fair/Sunny/Snow)" —
  // takes the full redraw result (not just `.weather`) since a newly-drawn
  // Freezing card also snaps players to the Coop.
  if (effects.forcesWeatherRedraw) {
    const avoidCardName = SEASON_POSITIVE_CARD[state.season];
    const redrawn = redrawWeatherCard({ ...state, players }, avoidCardName);
    players = redrawn.players;
    weather = redrawn.weather;
  }

  if (!justDefeated) {
    return { ...state, predators, bonusDeck: state.bonusDeck, players, weather, boardEggs };
  }
  return grantPredatorDefeatConsequences({ ...state, predators, players, weather, boardEggs }, predator.location, predatorName, playerId);
}

// The "a Predator just hit 0 health" consequences — Loot Drop grant (+ its
// charge count for stash/charge-based Loot Drops, phase 11a), permanent
// passive stat-boost Loot Drops (Signature Cloak, Brass Knuckles), Revenge
// (every present player independently rolls, not just the killer), and
// revealing the Boss once the last regular Predator is down. Split out from
// resolvePredatorAttack so a killing blow landed *without* the normal
// return-attack combat pipeline (Arrow Pack's ranged shot, a Bonus/Grub
// card's direct enemy damage) still gets the same consequences — those
// sources previously left a 0-health, still-`defeated: false` Predator
// behind, which silently blocked the win check and withheld its Loot Drop.
function grantPredatorDefeatConsequences(
  state: GameState,
  predatorLocation: Location,
  predatorName: string,
  killerId: string,
): GameState {
  let killer = getPlayer(state.players, killerId);
  killer = { ...killer, lootDrops: [...killer.lootDrops, predatorName] };
  const loot = PREDATOR_LOOT[predatorName];
  if (loot?.permanentAttackBonus) {
    killer = { ...killer, attackStrength: killer.attackStrength + loot.permanentAttackBonus };
  }
  if (loot?.permanentMaxHealthBonus) {
    killer = { ...killer, maxHealth: killer.maxHealth + loot.permanentMaxHealthBonus, health: killer.health + loot.permanentMaxHealthBonus };
  }
  if (loot?.stash) killer = { ...killer, lootCharges: { ...killer.lootCharges, [predatorName]: loot.stash.startingAmount } };
  if (loot?.chargedRangedAttack) killer = { ...killer, lootCharges: { ...killer.lootCharges, [predatorName]: loot.chargedRangedAttack.charges } };
  if (loot?.activatableAttackReduction) killer = { ...killer, lootCharges: { ...killer.lootCharges, [predatorName]: 1 } };
  if (loot?.dungeonKeys) killer = { ...killer, lootCharges: { ...killer.lootCharges, [predatorName]: 1 } };
  if (loot?.selfRevive) killer = { ...killer, lootCharges: { ...killer.lootCharges, [predatorName]: 1 } };

  let bonusDeck = state.bonusDeck;
  // Revenge: "present" means at the Predator's location when it falls —
  // not just the attacker, so this checks every player there (each
  // resolves their own trigger independently, which is why phase 2
  // classified it as executable-now rather than a true cross-actor aura).
  let players = replacePlayer(state.players, killer);
  for (const present of players) {
    if (present.location !== predatorLocation || !present.alive) continue;
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
    players = players.map((p) => (p.id === present.id ? { ...present, bonusCardHand: [...present.bonusCardHand, cardId] } : p));
  }

  // Gravekeeper Fowl: "When defeated, roll. If 5-6: revives with N health"
  // — undoes the defeat for every purpose below (Boss reveal, win check),
  // so it's resolved before the "any regular surviving" computation.
  const defeatedPredator = state.predators.find((p) => p.name === predatorName)!;
  const reviveRule = PREDATOR_EFFECTS[predatorName]?.[defeatedPredator.stage]?.onDefeatRevive;
  const revives = !!reviveRule && rollDie(state.config.rng) >= reviveRule.threshold;
  const afterRevive = revives
    ? state.predators.map((p) => (p.name === predatorName ? { ...p, defeated: false, health: reviveRule!.health } : p))
    : state.predators;

  // Boss stays face-down until the last regular predator dies (core_rules.md).
  const anyRegularSurviving = afterRevive.some((p) => !p.isBoss && !p.defeated);
  const predators = anyRegularSurviving ? afterRevive : afterRevive.map((p) => (p.isBoss ? { ...p, revealed: true } : p));

  return { ...state, predators, bonusDeck, players };
}

// Direct damage to a Predator with no return attack and no Predator-roll
// effect triggered — used by sources that bypass the normal Attack action's
// combat resolution entirely (Arrow Pack's ranged shot, a Bonus/Grub card's
// enemy-damage effect). Still routes through grantPredatorDefeatConsequences
// on a killing blow so `defeated`/Loot Drops/Boss-reveal stay correct.
export function applyDirectPredatorDamage(state: GameState, predatorName: string, damage: number, killerId: string): GameState {
  const predator = state.predators.find((p) => p.name === predatorName);
  if (!predator) throw new Error(`Unknown predator: ${predatorName}`);
  const cappedHealth = Math.max(0, predator.health - damage);
  const justDefeated = cappedHealth <= 0 && !predator.defeated;
  const predators = state.predators.map((p) =>
    p.name === predatorName ? { ...p, health: cappedHealth, defeated: p.defeated || cappedHealth <= 0 } : p,
  );
  if (!justDefeated) return { ...state, predators };
  return grantPredatorDefeatConsequences({ ...state, predators }, predator.location, predatorName, killerId);
}

// Direct damage to a face-up Grub, same "bypasses the normal combat
// pipeline" reasoning as applyDirectPredatorDamage above — no defend-roll
// retaliation. Still transfers the card to the killer's hand (and redeals a
// new face-up card) on a killing blow, same as a normal Grub Attack would.
export function applyDirectGrubDamage(state: GameState, side: 'inside' | 'outside', damage: number, killerId: string): GameState {
  const deckSide = state.grubDecks[side];
  const faceUp = deckSide.faceUp;
  if (!faceUp) throw new Error(`No face-up Grub ${side} to damage`);
  const newHealth = Math.max(0, faceUp.currentHealth - damage);
  if (newHealth > 0) {
    return { ...state, grubDecks: { ...state.grubDecks, [side]: { ...deckSide, faceUp: { ...faceUp, currentHealth: newHealth } } } };
  }
  const fullHealth = parseIntField(loadGrubCards()[faceUp.cardId]?.health ?? null, 0);
  const heldCard: HeldGrubCard = { cardId: faceUp.cardId, currentHealth: fullHealth, rewardUsed: false };
  const killer = getPlayer(state.players, killerId);
  const updatedPlayer = { ...killer, grubHand: [...killer.grubHand, heldCard] };
  const redealt = dealFaceUp({ ...deckSide, faceUp: null });
  return {
    ...state,
    players: replacePlayer(state.players, updatedPlayer),
    grubDecks: { ...state.grubDecks, [side]: redealt },
  };
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
  damageRedirect?: { toPlayerId: string; amount: number },
): GameState {
  const effects = runCombatEffects(state, playerId, targetType, targetId, state.config.rng);
  // Monocle (Owl Coopone's Loot Drop): "Never miss any attacks" — the
  // holder's own attacks are never dodged/whiffed by the target's roll
  // (a Predator's own dodge outcome, or a Grub's "Miss your attack" defend
  // roll), applied centrally so it holds regardless of hook customization.
  const attacker = getPlayer(state.players, playerId);
  const finalEffects = attacker.lootDrops.some((name) => PREDATOR_LOOT[name]?.neverMissesAttacks)
    ? { ...effects, predatorDodges: false }
    : effects;
  const resolved =
    targetType === 'predator'
      ? resolvePredatorAttack(state, playerId, targetId, attackStrength, finalEffects, mitigation, damageRedirect)
      : resolveGrubAttack(state, playerId, targetId as 'inside' | 'outside', attackStrength, finalEffects);
  // "Not really a miss" (Cluck Norris): only meaningful once the attack
  // actually missed — `predatorDodges` on the *final* (post-Monocle) effects
  // is exactly that signal, for either target type.
  return finalEffects.predatorDodges ? applyNotReallyAMiss(resolved, playerId) : resolved;
}

// Cluck Norris' "Not really a miss": self clause draws a Bonus Card, the
// nearby-teammate clause grants food to anyone else at the misser's
// location who also carries the ability (each resolves their own trigger
// independently, same reasoning as Revenge above).
function applyNotReallyAMiss(state: GameState, attackerId: string): GameState {
  const attacker = getPlayer(state.players, attackerId);
  let players = state.players;
  let bonusDeck = state.bonusDeck;

  if (getActiveChickenAbilities(attacker.chickenName, attacker.stage).some((a) => a.missDrawsBonusCard)) {
    const current = getPlayer(players, attackerId);
    if (current.permanentNoBonusCardHandLimit || current.bonusCardHand.length < current.bonusCardHandLimit) {
      let { drawPile, discard } = bonusDeck;
      if (drawPile.length === 0) {
        drawPile = [...discard];
        discard = [];
      }
      const [cardId, ...rest] = drawPile;
      if (cardId != null) {
        players = replacePlayer(players, { ...current, bonusCardHand: [...current.bonusCardHand, cardId] });
        bonusDeck = { drawPile: rest, discard };
      }
    }
  }

  for (const p of state.players) {
    if (p.id === attackerId || !p.alive || p.location !== attacker.location) continue;
    const bonus = getActiveChickenAbilities(p.chickenName, p.stage).reduce((sum, a) => sum + (a.nearbyTeammateMissGrantsFood ?? 0), 0);
    if (!bonus) continue;
    const current = getPlayer(players, p.id);
    players = replacePlayer(players, { ...current, food: current.food + bonus });
  }

  return { ...state, players, bonusDeck };
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
