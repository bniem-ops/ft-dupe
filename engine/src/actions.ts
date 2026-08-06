// The 8 base actions from core_rules.md. Each validates location/cost/
// stage requirements and consumes 1 of the turn's remaining actions.
import { GameState, PlayerState, Location, OUTSIDE_LOCATIONS, Stage, rollDie } from './types.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { addMeals } from './leveling.js';
import { resolveCombat, applyDamageAndMaybeDeath } from './combat.js';
import { activeWeatherEffect, activeWeatherName } from './abilities/weather.js';
import { getActiveChickenAbilities, isImmuneToWeather } from './abilities/chickens.js';
import { loadBonusCards, loadGrubCards, loadChickens } from './data.js';
import { BONUS_CARD_EFFECTS } from './abilities/bonusCards.js';
import { GRUB_REWARDS } from './abilities/grubCards.js';
import { CardEffect, Resource } from './abilities/types.js';
import { baseChickStats } from './setup.js';
import { shuffle } from './random.js';

function assertCanAct(state: GameState, playerId: string): PlayerState {
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) {
    throw new Error(`It is not ${playerId}'s turn`);
  }
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  if (state.actionsRemainingThisTurn <= 0) throw new Error(`${playerId} has no actions remaining this turn`);
  return player;
}

function withPlayer(state: GameState, updated: PlayerState): GameState {
  return {
    ...state,
    players: replacePlayer(state.players, updated),
    actionsRemainingThisTurn: state.actionsRemainingThisTurn - 1,
  };
}

function isOutside(location: Location): boolean {
  return (OUTSIDE_LOCATIONS as Location[]).includes(location);
}

// "Free action" chicken abilities (Ladies' Aid, Always on Purpose, Quick
// Claws, Long Shanks) don't consume actionsRemainingThisTurn, so they use
// this instead of assertCanAct — same turn/alive checks, no action-count
// check, plus the once-per-turn gate.
function assertFreeAbilityAvailable(state: GameState, playerId: string): PlayerState {
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) {
    throw new Error(`It is not ${playerId}'s turn`);
  }
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  if (player.freeAbilityUsedThisTurn) throw new Error(`${playerId} has already used their free ability this turn`);
  return player;
}

// Chick: 1 food/1 heart. Pullet/Cockerel: up to 2. Hen/Rooster: up to 3.
function healCap(stage: Stage): number {
  return stage === 1 ? 1 : stage === 2 ? 2 : 3;
}

// Chick: 1 food/1 meal-track space. Pullet/Cockerel: up to 2. Hen/Rooster:
// core_rules.md's action table doesn't give a value — consistent with
// there being no further stage to level into (mealsToNext is null at
// stage 3). Treated as no meal-counter benefit; flagged in the phase 3
// plan as a minor open item to confirm once it matters in play.
function eatCap(stage: Stage): number {
  return stage === 1 ? 1 : stage === 2 ? 2 : 0;
}

export function layEgg(state: GameState, playerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (player.location !== 'Coop') throw new Error('Lay Egg requires being Inside (the Coop)');
  if (player.stage < 2) throw new Error('Chicks cannot Lay Egg');

  let eggsGained = 1;
  let rerollConsumed = false;
  for (const ability of getActiveChickenAbilities(player.chickenName, player.stage)) {
    if (ability.layEggRoll) {
      let roll = rollDie(state.config.rng);
      if (player.pendingRerollNextRoll && !rerollConsumed) {
        roll = Math.max(roll, rollDie(state.config.rng));
        rerollConsumed = true;
      }
      if (roll >= ability.layEggRoll.threshold) eggsGained = Math.max(eggsGained, 1 + ability.layEggRoll.bonusEggs); // Well-Laid Plans
    }
  }
  return withPlayer(state, {
    ...player,
    eggs: player.eggs + eggsGained,
    pendingRerollNextRoll: rerollConsumed ? false : player.pendingRerollNextRoll,
  });
}

export function heal(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  if (player.location !== 'Coop') throw new Error('Heal requires being Inside (the Coop)');
  if (player.statusEffectsUntilNextEggExchange.includes('cannotHeal')) {
    throw new Error(`${playerId} cannot Heal until the next Egg Exchange`);
  }
  const cap = healCap(player.stage);
  if (amount < 1 || amount > cap) throw new Error(`Heal amount must be between 1 and ${cap} for stage ${player.stage}`);
  if (player.food < amount) throw new Error(`${playerId} does not have ${amount} food to Heal`);
  const healedHealth = Math.min(player.maxHealth, player.health + amount);
  return withPlayer(state, { ...player, food: player.food - amount, health: healedHealth });
}

// Pay 1 egg, skip your (the brooder's) next turn. Doesn't revive the
// target outright — draws 2 Chicken Book candidates (core_rules.md) for
// them to choose from via completeRevival; the target stays `alive: false`
// until they do, so a "half-revived" player with no locked-in stats can
// never get startTurn'd.
export function brood(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (player.location !== 'Coop') throw new Error('Brood requires being Inside (the Coop)');
  if (player.eggs < 1) throw new Error(`${playerId} does not have an egg to Brood`);
  const target = getPlayer(state.players, targetPlayerId);
  if (target.alive) throw new Error(`${targetPlayerId} is not dead and cannot be Brooded`);
  if (target.pendingRevivalChoices) throw new Error(`${targetPlayerId} already has a revival choice pending`);

  // Each Chicken Book is a single physical card — the only sensible draw
  // pool is names not currently in use by a living player, filtered by
  // eggspansion the same way predator selection is in setup.ts.
  const inUse = new Set(state.players.filter((p) => p.alive).map((p) => p.chickenName));
  const pool = loadChickens()
    .filter((c) => c.name && (state.config.eggspansion || c.expansion === 'Base') && !inUse.has(c.name))
    .map((c) => c.name as string);
  const choices = shuffle(pool, state.config.rng).slice(0, 2);

  const brooder = { ...player, eggs: player.eggs - 1, skipNextTurn: true };
  const revived = { ...target, pendingRevivalChoices: choices };
  const players = replacePlayer(replacePlayer(state.players, brooder), revived);
  return { ...state, players, actionsRemainingThisTurn: state.actionsRemainingThisTurn - 1 };
}

// Resolves a brood()-drawn revival choice: rejoin as a Chick with the
// chosen chicken's stage-1 stats and starting grants (same as a fresh
// createPlayer). Not turn-gated or action-costing — playable any time,
// same reasoning as a Bonus Card, since the player needs their stats
// locked in before their own turn starts.
export function completeRevival(state: GameState, playerId: string, chickenName: string): GameState {
  const player = getPlayer(state.players, playerId);
  if (player.alive) throw new Error(`${playerId} is not dead`);
  if (!player.pendingRevivalChoices?.includes(chickenName)) {
    throw new Error(`${chickenName} is not one of ${playerId}'s revival choices`);
  }

  const { health, attackStrength, ability } = baseChickStats(chickenName);
  const revived: PlayerState = {
    ...player,
    chickenName,
    stage: 1,
    health,
    maxHealth: health,
    attackStrength,
    food: player.food + (ability?.startingFood ?? 0),
    eggs: player.eggs + (ability?.startingEggs ?? 0),
    location: 'Coop',
    alive: true,
    bonusCardHandLimit: ability?.bonusCardHandLimitOverride ?? 2,
    pendingRevivalChoices: null,
    justRevivedPendingFirstTurn: true,
  };
  let players = replacePlayer(state.players, revived);
  let bonusDeck = state.bonusDeck;

  const startingBonusCards = ability?.startingBonusCards ?? 0;
  if (startingBonusCards > 0 && bonusDeck.drawPile.length > 0) {
    const drawn = bonusDeck.drawPile.slice(0, startingBonusCards);
    bonusDeck = { ...bonusDeck, drawPile: bonusDeck.drawPile.slice(startingBonusCards) };
    players = replacePlayer(players, { ...revived, bonusCardHand: [...revived.bonusCardHand, ...drawn] });
  }

  return { ...state, players, bonusDeck };
}

export function move(state: GameState, playerId: string, destination: Location): GameState {
  const player = assertCanAct(state, playerId);
  if (destination !== player.location && player.statusEffectsUntilNextEggExchange.includes('cannotLeaveLocation')) {
    throw new Error(`${playerId} cannot leave ${player.location} until the next Egg Exchange`);
  }
  const weather = activeWeatherEffect(state);
  if (weather?.blocksMoveToLocation === destination) {
    const immune =
      isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard;
    if (!immune) throw new Error(`${destination} cannot be entered right now (${activeWeatherName(state)})`);
  }
  return withPlayer(state, { ...player, location: destination });
}

export function drawCard(state: GameState, playerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (!player.permanentNoBonusCardHandLimit && player.bonusCardHand.length >= player.bonusCardHandLimit) {
    throw new Error(`${playerId} is at their Bonus Card hand limit (${player.bonusCardHandLimit})`);
  }
  let { drawPile, discard } = state.bonusDeck;
  if (drawPile.length === 0) {
    // Not explicitly stated for Bonus Cards in core_rules.md (only Grubs
    // spell out the reshuffle rule) — assumed as the standard card-game
    // default: reshuffle the discard back into the draw pile when empty.
    drawPile = [...discard];
    discard = [];
  }
  const [cardId, ...rest] = drawPile;
  const updatedPlayer = { ...player, bonusCardHand: [...player.bonusCardHand, cardId] };
  const updatedState = withPlayer(state, updatedPlayer);
  return { ...updatedState, bonusDeck: { drawPile: rest, discard } };
}

// Costs 1 food per point of attack strength (core_rules.md). Validates
// "must be nearby the target" — same location for a Predator, or matching
// Inside/Outside for a Grub — then resolves combat via combat.ts.
export function attack(
  state: GameState,
  playerId: string,
  targetType: 'predator' | 'grub',
  targetId: string,
  attackStrength: number,
  // Pre-committed choice to spend Bonus Cards/eggs to reduce the return
  // attack (Misdirection, Eggpire Strikes Back) — a synchronous reducer
  // can't prompt mid-resolution, so the caller commits up front; unused
  // resource isn't spent if the ability's mitigation ends up needing less.
  mitigation?: { resource: 'bonusCards' | 'eggs'; amount: number },
): GameState {
  const player = assertCanAct(state, playerId);
  if (attackStrength < 1) throw new Error('Attack strength must be at least 1');

  const weather = activeWeatherEffect(state);
  const weatherImmune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;

  // Max attack strength = the chicken's stat, adjusted by weather (Dust
  // Storm: -1) and abilities (Adrenaline: +1 if damaged). This cap wasn't
  // enforced pre-phase-6 since nothing needed to modify it yet.
  const abilities = getActiveChickenAbilities(player.chickenName, player.stage);
  const abilityBonus = abilities.reduce(
    (sum, a) => sum + (a.maxAttackBonusIfDamaged && player.health < player.maxHealth ? a.maxAttackBonusIfDamaged : 0),
    0,
  );
  const weatherDelta = !weatherImmune ? (weather?.maxAttackStrengthDelta ?? 0) : 0;
  // "+1 to attack strength, no extra food cost" (Bonus Card) raises the
  // cap by 1; the food discount below only applies if that extra point is
  // actually used, not just because the card is pending.
  const cardBonus = player.pendingFreeAttackPoint ? 1 : 0;
  const baseCap = Math.max(0, player.attackStrength + weatherDelta + abilityBonus);
  const maxAttackStrength = baseCap + cardBonus;
  if (attackStrength > maxAttackStrength) {
    throw new Error(`${playerId}'s attack strength cannot exceed ${maxAttackStrength} right now`);
  }

  const cost = attackStrength > baseCap ? attackStrength - 1 : attackStrength;
  if (player.food < cost) throw new Error(`${playerId} does not have ${cost} food to Attack with strength ${attackStrength}`);

  if (targetType === 'predator') {
    const predator = state.predators.find((p) => p.name === targetId);
    if (!predator) throw new Error(`Unknown predator: ${targetId}`);
    if (!predator.revealed) throw new Error(`${targetId} is not revealed yet`);
    if (predator.location !== player.location) throw new Error(`${playerId} must be nearby ${targetId} to Attack`);
  } else {
    if (weather?.blocksGrubAttacks && !weatherImmune) throw new Error(`Cannot Fight Grubs right now (${activeWeatherName(state)})`);
    const side = targetId === 'inside' ? 'inside' : targetId === 'outside' ? 'outside' : null;
    if (!side) throw new Error(`Grub target must be 'inside' or 'outside'`);
    const playerSide = player.location === 'Coop' ? 'inside' : 'outside';
    if (playerSide !== side) throw new Error(`${playerId} must be nearby the ${side} Grub to Attack it`);
    if (!state.grubDecks[side].faceUp) throw new Error(`No face-up Grub ${side} to Attack`);
  }

  const afterCost = withPlayer(state, { ...player, food: player.food - cost });
  const result = resolveCombat(afterCost, playerId, targetType, targetId, attackStrength, mitigation);

  // Bonus/Grub-Reward attack modifiers are single-use, spent on the next
  // Attack action regardless of target type (simplest, most explainable
  // reading of "for one attack" / "for 1 turn").
  const attacker = getPlayer(result.players, playerId);
  const cleared: PlayerState = {
    ...attacker,
    pendingFreeAttackPoint: false,
    pendingPredatorRollReduction: 0,
    pendingIncomingDamageReduction: 0,
    pendingDodgeNextAttack: false,
    pendingIgnorePredatorRoll: false,
  };
  return { ...result, players: replacePlayer(result.players, cleared) };
}

export function eat(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  if (!isOutside(player.location)) throw new Error('Eat requires being Outside');
  if (player.statusEffectsUntilNextEggExchange.includes('cannotEat')) {
    throw new Error(`${playerId} cannot Eat until the next Egg Exchange`);
  }
  const cap = eatCap(player.stage);
  if (amount < 0 || (cap === 0 && amount > 0) || amount > cap) {
    throw new Error(`Eat amount must be between 0 and ${cap} for stage ${player.stage}`);
  }
  if (player.food < amount) throw new Error(`${playerId} does not have ${amount} food to Eat`);
  const fed = { ...player, food: player.food - amount };
  return withPlayer(state, addMeals(fed, amount));
}

export function forage(state: GameState, playerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (!isOutside(player.location)) throw new Error('Forage requires being Outside');

  const weather = activeWeatherEffect(state);
  const weatherImmune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;
  const cost = !weatherImmune && weather?.onForageCost ? weather.onForageCost : 1; // Drought: 2 actions instead of 1
  if (state.actionsRemainingThisTurn < cost) {
    throw new Error(`${playerId} needs ${cost} action(s) to Forage right now (has ${state.actionsRemainingThisTurn})`);
  }

  const abilities = getActiveChickenAbilities(player.chickenName, player.stage);
  let food = 1;
  let rerollConsumed = false;
  for (const ability of abilities) {
    if (ability.forageRoll) {
      let roll = rollDie(state.config.rng);
      if (player.pendingRerollNextRoll && !rerollConsumed) {
        roll = Math.max(roll, rollDie(state.config.rng));
        rerollConsumed = true;
      }
      if (roll >= ability.forageRoll.threshold) food = Math.max(food, ability.forageRoll.bonusFood); // The Forager
    }
  }
  if (!player.foragedThisTurn && weather?.onFirstForageThisTurn) {
    food += weather.onFirstForageThisTurn.bonusFood; // Fair
  }
  food += player.permanentForageBonusUntilNextWeather; // Lizard Grub Reward

  return {
    ...state,
    players: replacePlayer(state.players, {
      ...player,
      food: player.food + food,
      foragedThisTurn: true,
      pendingRerollNextRoll: rerollConsumed ? false : player.pendingRerollNextRoll,
    }),
    actionsRemainingThisTurn: state.actionsRemainingThisTurn - cost,
  };
}

// --- "Free action" chicken abilities (phase 6) ----------------------------
// Don't consume actionsRemainingThisTurn; gated to once per turn via
// freeAbilityUsedThisTurn. Each throws "no such ability" until the
// chickens pass populates CHICKEN_ABILITIES with the ability that grants it.

export function giftFood(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const ability = getActiveChickenAbilities(player.chickenName, player.stage).find((a) => a.freeGiftFood);
  if (!ability?.freeGiftFood) throw new Error(`${playerId}'s chicken has no gift-food ability`);
  const { cost, healSelf } = ability.freeGiftFood;
  if (player.food < cost) throw new Error(`${playerId} does not have ${cost} food to gift`);
  const target = getPlayer(state.players, targetPlayerId);
  if (target.location !== player.location) throw new Error(`${targetPlayerId} must be nearby to receive the gift`);

  const giver = {
    ...player,
    food: player.food - cost,
    health: Math.min(player.maxHealth, player.health + healSelf),
    freeAbilityUsedThisTurn: true,
  };
  const receiver = { ...target, food: target.food + cost };
  return { ...state, players: replacePlayer(replacePlayer(state.players, giver), receiver) };
}

export function sacrificeHealthForEggs(state: GameState, playerId: string): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const ability = getActiveChickenAbilities(player.chickenName, player.stage).find((a) => a.freeDamageForEggs);
  if (!ability?.freeDamageForEggs) throw new Error(`${playerId}'s chicken has no such ability`);
  const { damage, eggsGained } = ability.freeDamageForEggs;
  const damaged = applyDamageAndMaybeDeath(player, damage);
  const updated = { ...damaged, eggs: damaged.eggs + eggsGained, freeAbilityUsedThisTurn: true };
  return { ...state, players: replacePlayer(state.players, updated) };
}

export function payEggForCard(state: GameState, playerId: string): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const hasAbility = getActiveChickenAbilities(player.chickenName, player.stage).some((a) => a.freeEggForCard);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (player.eggs < 1) throw new Error(`${playerId} has no egg to pay`);
  if (!player.permanentNoBonusCardHandLimit && player.bonusCardHand.length >= player.bonusCardHandLimit) {
    throw new Error(`${playerId} is at their Bonus Card hand limit (${player.bonusCardHandLimit})`);
  }
  let { drawPile, discard } = state.bonusDeck;
  if (drawPile.length === 0) {
    drawPile = [...discard];
    discard = [];
  }
  const [cardId, ...rest] = drawPile;
  const updated = {
    ...player,
    eggs: player.eggs - 1,
    bonusCardHand: [...player.bonusCardHand, cardId],
    freeAbilityUsedThisTurn: true,
  };
  return { ...state, players: replacePlayer(state.players, updated), bonusDeck: { drawPile: rest, discard } };
}

export function freeOutsideMove(state: GameState, playerId: string, destination: Location): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const hasAbility = getActiveChickenAbilities(player.chickenName, player.stage).some((a) => a.freeOutsideMove);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (!isOutside(player.location) || !isOutside(destination)) {
    throw new Error('Long Shanks only moves between Outside locations');
  }
  const updated = { ...player, location: destination, freeAbilityUsedThisTurn: true };
  return { ...state, players: replacePlayer(state.players, updated) };
}

// Foresight modifies the Draw Card action (draw 2, keep 1) rather than
// granting a free action — still costs a normal action.
export function drawTwoKeepOne(state: GameState, playerId: string, keep: 0 | 1): GameState {
  const player = assertCanAct(state, playerId);
  const hasAbility = getActiveChickenAbilities(player.chickenName, player.stage).some((a) => a.drawTwoKeepOne);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (!player.permanentNoBonusCardHandLimit && player.bonusCardHand.length >= player.bonusCardHandLimit) {
    throw new Error(`${playerId} is at their Bonus Card hand limit (${player.bonusCardHandLimit})`);
  }
  let { drawPile, discard } = state.bonusDeck;
  const drawn: number[] = [];
  for (let i = 0; i < 2; i++) {
    if (drawPile.length === 0) {
      drawPile = [...discard];
      discard = [];
    }
    const [cardId, ...rest] = drawPile;
    if (cardId == null) break;
    drawn.push(cardId);
    drawPile = rest;
  }
  const kept = drawn[keep];
  const discardedNow = drawn.filter((_, i) => i !== keep);
  const updatedPlayer = kept != null ? { ...player, bonusCardHand: [...player.bonusCardHand, kept] } : player;

  return {
    ...withPlayer(state, updatedPlayer),
    bonusDeck: { drawPile, discard: [...discard, ...discardedNow] },
  };
}

// --- Bonus Card / Grub Reward play (phase 7) ------------------------------
// Free per core_rules.md ("cost no action, can be played any time") — no
// actionsRemainingThisTurn check, no turn-order check (the acting player
// just needs to be alive and hold the card). Both playBonusCard and
// useGrubReward remove/discard the card up front, then resolve the same
// CardEffect shape via resolveCardEffect.

export interface CardPlayParams {
  option?: 1 | 2;
  targetPlayerId?: string;
  targetType?: 'predator' | 'grub';
  targetId?: string;
  amount?: number;
  discardExtraCardIndex?: number;
}

function applyResourceDelta(player: PlayerState, delta: Partial<Record<Resource, number>>): PlayerState {
  let updated = player;
  if (delta.food) updated = { ...updated, food: Math.max(0, updated.food + delta.food) };
  if (delta.egg) updated = { ...updated, eggs: Math.max(0, updated.eggs + delta.egg) };
  if (delta.meal) {
    updated = delta.meal > 0 ? addMeals(updated, delta.meal) : { ...updated, mealCounter: Math.max(0, updated.mealCounter + delta.meal) };
  }
  if (delta.health) {
    updated = delta.health > 0
      ? { ...updated, health: Math.min(updated.maxHealth, updated.health + delta.health) }
      : applyDamageAndMaybeDeath(updated, -delta.health);
  }
  return updated;
}

function drawBonusCardsInto(
  bonusDeck: GameState['bonusDeck'],
  count: number,
): { drawn: number[]; bonusDeck: GameState['bonusDeck'] } {
  let { drawPile, discard } = bonusDeck;
  const drawn: number[] = [];
  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      drawPile = [...discard];
      discard = [];
    }
    const [cardId, ...rest] = drawPile;
    if (cardId == null) break;
    drawn.push(cardId);
    drawPile = rest;
  }
  return { drawn, bonusDeck: { drawPile, discard } };
}

function giveBonusCards(player: PlayerState, cardIds: number[]): { player: PlayerState; leftover: number[] } {
  const room = player.permanentNoBonusCardHandLimit ? cardIds.length : Math.max(0, player.bonusCardHandLimit - player.bonusCardHand.length);
  const accepted = cardIds.slice(0, room);
  const leftover = cardIds.slice(accepted.length);
  return { player: { ...player, bonusCardHand: [...player.bonusCardHand, ...accepted] }, leftover };
}

function resolveCardEffect(state: GameState, playerId: string, effect: CardEffect, params: CardPlayParams): GameState {
  let player = getPlayer(state.players, playerId);
  let players = state.players;
  let predators = state.predators;
  let grubDecks = state.grubDecks;
  let bonusDeck = state.bonusDeck;
  let actionsDelta = 0;

  if (effect.selfDelta) player = applyResourceDelta(player, effect.selfDelta);

  if (effect.choiceGain) {
    player = applyResourceDelta(player, effect.choiceGain[(params.option ?? 1) - 1]);
  }

  if (effect.teammateGain) {
    if (!params.targetPlayerId) throw new Error('This card requires a teammate target');
    const target = getPlayer(players, params.targetPlayerId);
    const amount = Math.max(0, Math.min(params.amount ?? effect.teammateGain.maxAmount, effect.teammateGain.maxAmount));
    players = replacePlayer(players, applyResourceDelta(target, { [effect.teammateGain.resource]: amount }));
  }

  if (effect.teammateChoiceGain) {
    if (!params.targetPlayerId) throw new Error('This card requires a teammate target');
    const choice = effect.teammateChoiceGain[(params.option ?? 1) - 1];
    const target = getPlayer(players, params.targetPlayerId);
    players = replacePlayer(players, applyResourceDelta(target, { [choice.resource]: choice.amount }));
  }

  if (effect.enemyDamage) {
    if (!params.targetType || !params.targetId) throw new Error('This card requires an enemy target');
    if (params.targetType === 'predator') {
      predators = predators.map((p) => (p.name === params.targetId ? { ...p, health: Math.max(0, p.health - effect.enemyDamage!) } : p));
    } else {
      const side = params.targetId === 'inside' ? 'inside' : 'outside';
      const deckSide = grubDecks[side];
      if (deckSide.faceUp) {
        grubDecks = {
          ...grubDecks,
          [side]: { ...deckSide, faceUp: { ...deckSide.faceUp, currentHealth: Math.max(0, deckSide.faceUp.currentHealth - effect.enemyDamage!) } },
        };
      }
    }
  }

  if (effect.discardExtraForBonus) {
    if (params.option === 2) {
      const idx = params.discardExtraCardIndex;
      if (idx == null || player.bonusCardHand[idx] == null) throw new Error('Choose a held Bonus Card to discard for the bonus');
      const discardedId = player.bonusCardHand[idx];
      player = { ...player, bonusCardHand: player.bonusCardHand.filter((_, i) => i !== idx), eggs: player.eggs + effect.discardExtraForBonus.eggsGained };
      bonusDeck = { ...bonusDeck, discard: [...bonusDeck.discard, discardedId] };
    } else {
      player = { ...player, eggs: player.eggs + effect.discardExtraForBonus.baseEggGain };
    }
  }

  if (effect.eggOrWeatherImmune) {
    player = params.option === 2 ? { ...player, pendingWeatherImmuneUntilNextTurn: true } : { ...player, eggs: player.eggs + 1 };
  }

  if (effect.drawBonusCards) {
    const { draw, keep, giveTeammate } = effect.drawBonusCards;
    const { drawn, bonusDeck: afterDraw } = drawBonusCardsInto(bonusDeck, draw);
    bonusDeck = afterDraw;
    const kept = drawn.slice(0, keep);
    const given = drawn.slice(keep, keep + giveTeammate);
    const overflow = drawn.slice(keep + giveTeammate);
    const { player: withKept, leftover: keptLeftover } = giveBonusCards(player, kept);
    player = withKept;
    let toDiscard = [...overflow, ...keptLeftover];
    if (given.length > 0) {
      if (!params.targetPlayerId) throw new Error('This card requires a teammate to give a card to');
      const target = getPlayer(players, params.targetPlayerId);
      const { player: withGiven, leftover: givenLeftover } = giveBonusCards(target, given);
      players = replacePlayer(players, withGiven);
      toDiscard = [...toDiscard, ...givenLeftover];
    }
    if (toDiscard.length > 0) bonusDeck = { ...bonusDeck, discard: [...bonusDeck.discard, ...toDiscard] };
  }

  if (effect.dodgeNextAttack) player = { ...player, pendingDodgeNextAttack: true };
  if (effect.grantsFreeAttackPoint) player = { ...player, pendingFreeAttackPoint: true };
  if (effect.reducesPredatorRoll) player = { ...player, pendingPredatorRollReduction: player.pendingPredatorRollReduction + effect.reducesPredatorRoll };
  if (effect.reducesIncomingDamage) player = { ...player, pendingIncomingDamageReduction: player.pendingIncomingDamageReduction + effect.reducesIncomingDamage };
  if (effect.rerollNextOwnRoll) player = { ...player, pendingRerollNextRoll: true };
  if (effect.ignoresPredatorRollEffectsNextAttack) player = { ...player, pendingIgnorePredatorRoll: true };

  if (effect.permanentEggProductionBonus) {
    player = { ...player, permanentEggProductionBonus: player.permanentEggProductionBonus + effect.permanentEggProductionBonus };
  }
  if (effect.permanentReturnAttackReductionRoll) player = { ...player, permanentReturnAttackReductionRoll: effect.permanentReturnAttackReductionRoll };
  if (effect.permanentNoBonusCardHandLimit) player = { ...player, permanentNoBonusCardHandLimit: true };
  if (effect.permanentForageBonusUntilNextWeather) {
    player = { ...player, permanentForageBonusUntilNextWeather: player.permanentForageBonusUntilNextWeather + effect.permanentForageBonusUntilNextWeather };
  }
  if (effect.immuneToWeatherUntilNextCard) player = { ...player, permanentWeatherImmuneUntilNextCard: true };

  if (effect.ladybugRoll) {
    const eggRoll = rollDie(state.config.rng);
    const foodRoll = rollDie(state.config.rng);
    const healthRoll = rollDie(state.config.rng);
    player = applyResourceDelta(player, { egg: eggRoll, food: foodRoll, health: -healthRoll });
  }

  if (effect.extraActions) actionsDelta += effect.extraActions;

  players = replacePlayer(players, player);
  return { ...state, players, predators, grubDecks, bonusDeck, actionsRemainingThisTurn: state.actionsRemainingThisTurn + actionsDelta };
}

export function playBonusCard(state: GameState, playerId: string, cardHandIndex: number, params: CardPlayParams = {}): GameState {
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  const cardId = player.bonusCardHand[cardHandIndex];
  if (cardId == null) throw new Error(`${playerId} has no Bonus Card at hand index ${cardHandIndex}`);
  const shorthand = loadBonusCards()[cardId]?.shorthand;
  const effect = shorthand ? BONUS_CARD_EFFECTS[shorthand] : undefined;
  if (!effect) throw new Error(`Bonus Card "${shorthand}" is not yet implemented`);

  const remainingHand = player.bonusCardHand.filter((_, i) => i !== cardHandIndex);
  const withCardPlayed: GameState = {
    ...state,
    players: replacePlayer(state.players, { ...player, bonusCardHand: remainingHand }),
    bonusDeck: { ...state.bonusDeck, discard: [...state.bonusDeck.discard, cardId] },
  };
  return resolveCardEffect(withCardPlayed, playerId, effect, params);
}

export function useGrubReward(state: GameState, playerId: string, grubHandIndex: number, params: CardPlayParams = {}): GameState {
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  const held = player.grubHand[grubHandIndex];
  if (!held) throw new Error(`${playerId} has no Grub Card at hand index ${grubHandIndex}`);
  if (held.rewardUsed) throw new Error(`${playerId}'s Grub Card at index ${grubHandIndex} has already had its Reward used`);
  const grubName = loadGrubCards()[held.cardId]?.name;
  const effect = grubName ? GRUB_REWARDS[grubName] : undefined;
  if (!effect) throw new Error(`${grubName ?? 'This Grub'}'s Reward is not yet implemented`);

  // Permanent Upgrades stay in hand (marked used, a standing badge of the
  // passive bonus); every other Reward is single-use and discarded, same
  // as a Bonus Card.
  const isPermanent = !!(
    effect.permanentEggProductionBonus ||
    effect.permanentReturnAttackReductionRoll ||
    effect.permanentNoBonusCardHandLimit ||
    effect.permanentForageBonusUntilNextWeather
  );
  const updatedHand = isPermanent
    ? player.grubHand.map((h, i) => (i === grubHandIndex ? { ...h, rewardUsed: true } : h))
    : player.grubHand.filter((_, i) => i !== grubHandIndex);
  const withCardHandled: GameState = { ...state, players: replacePlayer(state.players, { ...player, grubHand: updatedHand }) };
  return resolveCardEffect(withCardHandled, playerId, effect, params);
}
