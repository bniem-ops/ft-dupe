// The 8 base actions from core_rules.md. Each validates location/cost/
// stage requirements and consumes 1 of the turn's remaining actions.
import { GameState, PlayerState, Location, OUTSIDE_LOCATIONS, Stage, rollDie, HeldGrubCard, GrubDecksState } from './types.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { addMeals } from './leveling.js';
import { resolveCombat, applyDamageAndMaybeDeath, applyDirectPredatorDamage, applyDirectGrubDamage } from './combat.js';
import { activeWeatherEffect, activeWeatherName, redrawWeatherCard } from './abilities/weather.js';
import { applyEggExchange } from './turn.js';
import {
  getOwnAndBorrowedAbilities,
  isImmuneToWeather,
  nearbyAuraTeammateRollBonus,
  nearbyAuraMaxAttackBonus,
  applyRollIntercept,
} from './abilities/chickens.js';
import { PREDATOR_LOOT, PREDATOR_EFFECTS } from './abilities/predators.js';
import { loadBonusCards, loadGrubCards, loadChickens, parseIntField } from './data.js';
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

// Lay Egg/Heal/Brood are Inside-only by default (core_rules.md), except for
// a chicken carrying Fur Coat (Madam Chickovsky S3), which lifts that
// restriction entirely.
function mayActAsInside(player: PlayerState): boolean {
  return (
    player.location === 'Coop' ||
    player.pendingMayActAsInsideThisTurn || // Four Leaf Clover — "for 1 turn," cleared at this player's own endTurn
    getOwnAndBorrowedAbilities(player).some((a) => a.mayPerformInsideActionsOutside)
  );
}

export function layEgg(state: GameState, playerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (!mayActAsInside(player)) throw new Error('Lay Egg requires being Inside (the Coop)');
  if (player.stage < 2) throw new Error('Chicks cannot Lay Egg');

  let eggsGained = 1;
  let rerollConsumed = false;
  let interceptedPlayer: PlayerState | null = null;
  const battleCryBonus = nearbyAuraTeammateRollBonus(state, player.id); // Battle Cry
  for (const ability of getOwnAndBorrowedAbilities(player)) {
    if (ability.layEggRoll) {
      let baseRoll = rollDie(state.config.rng);
      if (player.pendingRerollNextRoll && !rerollConsumed) {
        baseRoll = Math.max(baseRoll, rollDie(state.config.rng));
        rerollConsumed = true;
      }
      if (player.pendingRollIntercept && !interceptedPlayer) {
        const applied = applyRollIntercept(player, baseRoll, state.config.rng);
        baseRoll = applied.roll;
        interceptedPlayer = applied.player;
      }
      const roll = baseRoll + battleCryBonus;
      if (roll >= ability.layEggRoll.threshold) eggsGained = Math.max(eggsGained, 1 + ability.layEggRoll.bonusEggs); // Well-Laid Plans
    }
  }
  return withPlayer(state, {
    ...player,
    eggs: player.eggs + eggsGained,
    pendingRerollNextRoll: rerollConsumed ? false : player.pendingRerollNextRoll,
    pendingRollIntercept: interceptedPlayer ? null : player.pendingRollIntercept,
  });
}

export function heal(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  if (!mayActAsInside(player)) throw new Error('Heal requires being Inside (the Coop)');
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
  if (!mayActAsInside(player)) throw new Error('Brood requires being Inside (the Coop)');
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
  const weather = activeWeatherEffect(state, playerId);
  const weatherImmune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state, playerId) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;
  if (weather?.blocksMoveToLocation === destination && !weatherImmune) {
    throw new Error(`${destination} cannot be entered right now (${activeWeatherName(state, playerId)})`);
  }
  if (weather?.forcesCoopLockdown && destination !== 'Coop' && !weatherImmune) {
    throw new Error(`Cannot leave the Coop right now (${activeWeatherName(state, playerId)})`);
  }
  const afterMove = withPlayer(state, { ...player, location: destination });

  // Gravekeeper Fowl S1/S2: "Cannot be attacked on the day a player moves
  // into his area" — arms for the rest of today, reset in advanceDay.
  if (destination !== player.location) {
    const movedInto = afterMove.predators.find((p) => p.location === destination && !p.defeated);
    if (movedInto && PREDATOR_EFFECTS[movedInto.name]?.[movedInto.stage]?.preventsAttackOnMoveIn) {
      return {
        ...afterMove,
        predators: afterMove.predators.map((p) => (p.name === movedInto.name ? { ...p, cannotBeAttackedToday: true } : p)),
      };
    }
  }
  return afterMove;
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
  // Tank: pre-committed redirect of some/all of the incoming return attack
  // onto a nearby ability-holder — same "commit up front" shape as mitigation.
  damageRedirect?: { toPlayerId: string; amount: number },
  // Plots & Ploys: a held Grub card's own health absorbs this attack's
  // return-attack damage instead of the player's — index into grubHand.
  grubShieldIndex?: number,
): GameState {
  const player = assertCanAct(state, playerId);

  const weather = activeWeatherEffect(state, playerId);
  const weatherImmune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state, playerId) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;

  // Target validation first: a Grub already at 0 health (Slug, Wild Grain,
  // Four Leaf Clover all deal at 0) needs no attack strength to claim —
  // the floor below only applies to a target that actually has health left.
  let targetCurrentHealth = 1;
  if (targetType === 'predator') {
    const predator = state.predators.find((p) => p.name === targetId);
    if (!predator) throw new Error(`Unknown predator: ${targetId}`);
    if (!predator.revealed) throw new Error(`${targetId} is not revealed yet`);
    if (predator.location !== player.location) throw new Error(`${playerId} must be nearby ${targetId} to Attack`);
    if (predator.cannotBeAttackedToday) throw new Error(`${targetId} cannot be attacked today (a player just moved into its area)`);
    targetCurrentHealth = predator.health;
  } else {
    if (weather?.blocksGrubAttacks && !weatherImmune) throw new Error(`Cannot Fight Grubs right now (${activeWeatherName(state, playerId)})`);
    const side = targetId === 'inside' ? 'inside' : targetId === 'outside' ? 'outside' : null;
    if (!side) throw new Error(`Grub target must be 'inside' or 'outside'`);
    const playerSide = player.location === 'Coop' ? 'inside' : 'outside';
    const mayAttackAnyLocation = getOwnAndBorrowedAbilities(player).some((a) => a.mayAttackGrubsFromAnyLocation); // Informant Network
    if (playerSide !== side && !mayAttackAnyLocation) throw new Error(`${playerId} must be nearby the ${side} Grub to Attack it`);
    const faceUp = state.grubDecks[side].faceUp;
    if (!faceUp) throw new Error(`No face-up Grub ${side} to Attack`);
    targetCurrentHealth = faceUp.currentHealth;
  }

  const minAttackStrength = targetCurrentHealth <= 0 ? 0 : 1;
  if (attackStrength < minAttackStrength) throw new Error(`Attack strength must be at least ${minAttackStrength}`);

  // Max attack strength = the chicken's stat, adjusted by weather (Dust
  // Storm: -1) and abilities (Adrenaline: +1 if damaged). This cap wasn't
  // enforced pre-phase-6 since nothing needed to modify it yet.
  const abilities = getOwnAndBorrowedAbilities(player);
  const abilityBonus =
    abilities.reduce((sum, a) => sum + (a.maxAttackBonusIfDamaged && player.health < player.maxHealth ? a.maxAttackBonusIfDamaged : 0), 0) +
    nearbyAuraMaxAttackBonus(state, playerId); // Bolsterer
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

  const afterCost = withPlayer(state, { ...player, food: player.food - cost });
  let result = resolveCombat(afterCost, playerId, targetType, targetId, attackStrength, mitigation, damageRedirect);

  // Plots & Ploys (Shellock Holmes S3): a held Grub card's own health
  // absorbs the return-attack damage this attack just dealt, instead of
  // the player's — discarded once fully damaged, marked "injured"
  // (rewardUsed) once it's taken any damage at all, per its confirmed text.
  if (grubShieldIndex != null) {
    const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.canShieldWithGrubHealth);
    const held = player.grubHand[grubShieldIndex];
    if (hasAbility && held && held.currentHealth > 0) {
      const afterCombatPlayer = getPlayer(result.players, playerId);
      const damageTaken = Math.max(0, player.health - afterCombatPlayer.health);
      if (damageTaken > 0) {
        const absorbed = Math.min(damageTaken, held.currentHealth);
        const restoredHealth = Math.min(afterCombatPlayer.maxHealth, afterCombatPlayer.health + absorbed);
        const newGrubHealth = held.currentHealth - absorbed;
        const updatedHand =
          newGrubHealth <= 0
            ? player.grubHand.filter((_, i) => i !== grubShieldIndex)
            : player.grubHand.map((h, i) => (i === grubShieldIndex ? { ...h, currentHealth: newGrubHealth, rewardUsed: true } : h));
        result = {
          ...result,
          players: replacePlayer(result.players, { ...afterCombatPlayer, health: restoredHealth, grubHand: updatedHand }),
        };
      }
    }
  }

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
    pendingReflectReturnAttack: false,
    pendingRollIntercept: null,
  };
  return { ...result, players: replacePlayer(result.players, cleared) };
}

// --- Activatable stash/charge Loot Drops (phase 11a) ----------------------
// Free, "playable any time" like a held card — no turn-order/action-cost
// check — except useArrowPack, which is a real (ranged) Attack.

function requireAlive(state: GameState, playerId: string): PlayerState {
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  return player;
}

// Egg Stash / Food Stash: "Place 3 [eggs/food] on this card. You may take
// or distribute to nearby players as desired." — a shared pool the holder
// draws down, either into their own hand or a nearby player's.
export function collectFromStash(
  state: GameState,
  playerId: string,
  predatorName: string,
  amount: number,
  targetPlayerId?: string,
): GameState {
  const player = requireAlive(state, playerId);
  const stash = PREDATOR_LOOT[predatorName]?.stash;
  if (!stash) throw new Error(`${predatorName}'s Loot Drop is not a stash`);
  if (!player.lootDrops.includes(predatorName)) throw new Error(`${playerId} does not hold ${predatorName}'s Loot Drop`);
  const available = player.lootCharges[predatorName] ?? 0;
  if (amount < 1 || amount > available) throw new Error(`${predatorName}'s stash only has ${available} ${stash.resource} available`);

  const recipientId = targetPlayerId ?? playerId;
  const resourceKey = stash.resource === 'egg' ? 'eggs' : 'food';
  const holder = { ...player, lootCharges: { ...player.lootCharges, [predatorName]: available - amount } };

  if (recipientId === playerId) {
    return { ...state, players: replacePlayer(state.players, { ...holder, [resourceKey]: holder[resourceKey] + amount }) };
  }
  const recipient = getPlayer(state.players, recipientId);
  if (recipient.location !== player.location) throw new Error(`${recipientId} must be nearby ${playerId} to receive from the stash`);
  const updatedRecipient = { ...recipient, [resourceKey]: recipient[resourceKey] + amount };
  return { ...state, players: replacePlayer(replacePlayer(state.players, holder), updatedRecipient) };
}

// Gas Mask: "A predator's attack is -1 for an entire day. Can be used at
// any time on a nearby Predator. (Single Use)"
export function useGasMask(state: GameState, playerId: string, targetId: string): GameState {
  const player = requireAlive(state, playerId);
  const reduction = PREDATOR_LOOT['Professor Moltiarty']?.activatableAttackReduction;
  if (!reduction) throw new Error('Gas Mask effect not configured');
  if (!player.lootDrops.includes('Professor Moltiarty')) throw new Error(`${playerId} does not hold Professor Moltiarty's Gas Mask`);
  if ((player.lootCharges['Professor Moltiarty'] ?? 0) < 1) throw new Error('Gas Mask has already been used');
  const predator = state.predators.find((p) => p.name === targetId);
  if (!predator) throw new Error(`Unknown predator: ${targetId}`);
  if (predator.location !== player.location) throw new Error(`${targetId} must be nearby to use Gas Mask on it`);

  const updatedPlayer = { ...player, lootCharges: { ...player.lootCharges, 'Professor Moltiarty': 0 } };
  const predators = state.predators.map((p) =>
    p.name === targetId ? { ...p, returnAttackReductionToday: p.returnAttackReductionToday + reduction.amount } : p,
  );
  return { ...state, players: replacePlayer(state.players, updatedPlayer), predators };
}

// Arrow Pack: "Distance Attack. -1 health to any revealed enemy for 1
// action and 1 food per arrow (multi-use)." Ranged — no "must be nearby"
// requirement, and no return attack/Predator-roll-effect (that's the whole
// point of shooting from a distance), unlike a normal Attack action.
export function useArrowPack(state: GameState, playerId: string, targetType: 'predator' | 'grub', targetId: string): GameState {
  const player = assertCanAct(state, playerId); // costs 1 action, same as any other Attack
  const charged = PREDATOR_LOOT['Cleopoultra']?.chargedRangedAttack;
  if (!charged) throw new Error('Arrow Pack effect not configured');
  if (!player.lootDrops.includes('Cleopoultra')) throw new Error(`${playerId} does not hold Cleopoultra's Arrow Pack`);
  const charges = player.lootCharges['Cleopoultra'] ?? 0;
  if (charges < 1) throw new Error('Arrow Pack has no arrows remaining');
  if (player.food < 1) throw new Error(`${playerId} does not have 1 food for an arrow`);

  if (targetType === 'predator') {
    const predator = state.predators.find((p) => p.name === targetId);
    if (!predator) throw new Error(`Unknown predator: ${targetId}`);
    if (!predator.revealed) throw new Error(`${targetId} is not revealed yet`);
  } else {
    const side = targetId === 'inside' ? 'inside' : targetId === 'outside' ? 'outside' : null;
    if (!side) throw new Error(`Grub target must be 'inside' or 'outside'`);
    if (!state.grubDecks[side].faceUp) throw new Error(`No face-up Grub ${side} to Attack`);
  }

  const spentPlayer = { ...player, food: player.food - 1, lootCharges: { ...player.lootCharges, 'Cleopoultra': charges - 1 } };
  const afterCost: GameState = {
    ...state,
    players: replacePlayer(state.players, spentPlayer),
    actionsRemainingThisTurn: state.actionsRemainingThisTurn - 1,
  };
  return targetType === 'predator'
    ? applyDirectPredatorDamage(afterCost, targetId, charged.damagePerCharge, playerId)
    : applyDirectGrubDamage(afterCost, targetId as 'inside' | 'outside', charged.damagePerCharge, playerId);
}

// --- Action-economy exceptions (phase 11c) ---------------------------------

// Nobility: "Can pay eggs to refresh your Extra Action Token." Unlike the
// once-per-turn free abilities above, this is gated purely by egg supply —
// repeatable within a turn, same as useExtraActionToken itself has no
// turn-order check (it only matters that it's spent during your own turn's
// action economy, which the caller — dispatch from your own ActionBar —
// already ensures).
export function refreshExtraActionToken(state: GameState, playerId: string): GameState {
  const player = requireAlive(state, playerId);
  const cost = getOwnAndBorrowedAbilities(player).reduce(
    (found, a) => found ?? a.refreshExtraActionTokenCost,
    undefined as number | undefined,
  );
  if (cost == null) throw new Error(`${playerId}'s chicken has no such ability`);
  if (player.extraActionTokenAvailable) throw new Error(`${playerId}'s Extra Action Token is already available`);
  if (player.eggs < cost) throw new Error(`${playerId} does not have ${cost} egg(s) to refresh the Extra Action Token`);
  const updated = { ...player, eggs: player.eggs - cost, extraActionTokenAvailable: true };
  return { ...state, players: replacePlayer(state.players, updated) };
}

// Landlord: "Can move Inside for free" — confirmed unlimited (not gated by
// freeAbilityUsedThisTurn like the other free-action abilities), so this
// checks turn-order/alive directly rather than via assertFreeAbilityAvailable.
export function freeMoveToCoop(state: GameState, playerId: string): GameState {
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) throw new Error(`It is not ${playerId}'s turn`);
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.freeMoveIntoCoop);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  return { ...state, players: replacePlayer(state.players, { ...player, location: 'Coop' }) };
}

// Chamberstick (Coopella's Loot): "Every player in your location may
// refresh their Extra Action Tokens (multi-use)."
export function useChamberstick(state: GameState, playerId: string): GameState {
  const player = requireAlive(state, playerId);
  if (!PREDATOR_LOOT['Coopella']?.everyoneAtLocationRefreshExtraAction) throw new Error('Chamberstick effect not configured');
  if (!player.lootDrops.includes('Coopella')) throw new Error(`${playerId} does not hold Coopella's Chamberstick`);
  const players = state.players.map((p) => (p.alive && p.location === player.location ? { ...p, extraActionTokenAvailable: true } : p));
  return { ...state, players };
}

// Cave Hoard (Hendel's Mother's Loot): "As a free action, you or a nearby
// teammate may draw a Bonus Card (multi-use)."
export function useCaveHoard(state: GameState, playerId: string, targetPlayerId?: string): GameState {
  const player = requireAlive(state, playerId);
  if (!PREDATOR_LOOT["Hendel's Mother"]?.freeDrawBonusCardForSelfOrTeammate) throw new Error('Cave Hoard effect not configured');
  if (!player.lootDrops.includes("Hendel's Mother")) throw new Error(`${playerId} does not hold Hendel's Mother's Cave Hoard`);
  const recipientId = targetPlayerId ?? playerId;
  const recipient = getPlayer(state.players, recipientId);
  if (recipientId !== playerId && recipient.location !== player.location) {
    throw new Error(`${recipientId} must be nearby ${playerId} to draw via Cave Hoard`);
  }
  if (!recipient.permanentNoBonusCardHandLimit && recipient.bonusCardHand.length >= recipient.bonusCardHandLimit) {
    throw new Error(`${recipientId} is at their Bonus Card hand limit (${recipient.bonusCardHandLimit})`);
  }
  let { drawPile, discard } = state.bonusDeck;
  if (drawPile.length === 0) {
    drawPile = [...discard];
    discard = [];
  }
  const [cardId, ...rest] = drawPile;
  if (cardId == null) return state; // deck fully exhausted — nothing to draw
  const updatedRecipient = { ...recipient, bonusCardHand: [...recipient.bonusCardHand, cardId] };
  return { ...state, players: replacePlayer(state.players, updatedRecipient), bonusDeck: { drawPile: rest, discard } };
}

// Healing Poultice (Chew Bawka's Loot): "As a free action, you may heal
// every player in your location 1 heart (multi-use)."
export function useHealingPoultice(state: GameState, playerId: string): GameState {
  const player = requireAlive(state, playerId);
  const amount = PREDATOR_LOOT['Chew Bawka']?.healEveryoneAtLocation;
  if (!amount) throw new Error('Healing Poultice effect not configured');
  if (!player.lootDrops.includes('Chew Bawka')) throw new Error(`${playerId} does not hold Chew Bawka's Healing Poultice`);
  const players = state.players.map((p) =>
    p.alive && p.location === player.location ? { ...p, health: Math.min(p.maxHealth, p.health + amount) } : p,
  );
  return { ...state, players };
}

// Secret Tunnels (Weasma and Clawnk's Loot): "You may take a free Move
// action for yourself or any nearby player, as desired (multi-use)."
export function useSecretTunnels(state: GameState, playerId: string, destination: Location, targetPlayerId?: string): GameState {
  const player = requireAlive(state, playerId);
  if (!PREDATOR_LOOT['Weasma and Clawnk']?.freeMoveForSelfOrNearby) throw new Error('Secret Tunnels effect not configured');
  if (!player.lootDrops.includes('Weasma and Clawnk')) throw new Error(`${playerId} does not hold Weasma and Clawnk's Secret Tunnels`);
  const moverId = targetPlayerId ?? playerId;
  const mover = getPlayer(state.players, moverId);
  if (moverId !== playerId && mover.location !== player.location) {
    throw new Error(`${moverId} must be nearby ${playerId} to use Secret Tunnels on them`);
  }
  return { ...state, players: replacePlayer(state.players, { ...mover, location: destination }) };
}

// Smallest Chicken / Garden Snail: "When a nearby player leaves your
// location, you may tag along and go with them." A synchronous reducer
// can't intercept between "a player decides to move" and the move actually
// resolving, so this is modeled as: at any time, move to match another
// player's current (different) location — free, unlimited, gated only on
// holding the ability. `targetPlayerId` already being at a different
// location than the holder stands in for "they left."
export function tagAlong(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = requireAlive(state, playerId);
  const hasAbility =
    getOwnAndBorrowedAbilities(player).some((a) => a.tagAlongUnlocked) || player.permanentTagAlongUnlocked;
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  const target = getPlayer(state.players, targetPlayerId);
  if (target.location === player.location) throw new Error(`${targetPlayerId} hasn't left ${playerId}'s location`);
  return { ...state, players: replacePlayer(state.players, { ...player, location: target.location }) };
}

// Quite Friendly (Cluckleberry Finn S2): "Can take one nearby player into
// combat with you. The other player attacks second." Bundles two Attack
// resolutions into the cost of one action: the primary attacks first via
// the normal attack() path, then the companion attacks second — against
// whatever's left of the target — paying their own food and taking their
// own return attack, but without spending a second action or needing it to
// be their turn. Simplification: the companion's strength is only capped
// by their own food supply here, not the full weather/ability max-strength
// check attack() enforces for a turn-holder's own attack.
export function attackWithCompanion(
  state: GameState,
  playerId: string,
  companionId: string,
  targetType: 'predator' | 'grub',
  targetId: string,
  primaryStrength: number,
  companionStrength: number,
): GameState {
  const player = getPlayer(state.players, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.joinsAttackAsSecond);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (companionId === playerId) throw new Error('Choose a different player to bring into combat');
  const companion = getPlayer(state.players, companionId);
  if (!companion.alive) throw new Error(`${companionId} is not alive`);
  if (companion.location !== player.location) throw new Error(`${companionId} must be nearby ${playerId} to join the attack`);

  const afterPrimary = attack(state, playerId, targetType, targetId, primaryStrength);

  const companionNow = getPlayer(afterPrimary.players, companionId);
  if (companionNow.food < companionStrength) throw new Error(`${companionId} does not have ${companionStrength} food to attack with`);
  const companionSpent = { ...companionNow, food: companionNow.food - companionStrength };
  const withCompanionCost: GameState = { ...afterPrimary, players: replacePlayer(afterPrimary.players, companionSpent) };
  const afterCompanion = resolveCombat(withCompanionCost, companionId, targetType, targetId, companionStrength);

  // The companion's attack didn't cost either player a second action.
  return { ...afterCompanion, actionsRemainingThisTurn: afterPrimary.actionsRemainingThisTurn };
}

// Strategem (General Tso S3): "For every egg you discard, you may adjust
// the roll of any die by 1." Sets the target's pendingRollIntercept — see
// its doc comment in types.ts for the deliberate scope limit (their next
// production/forage/lay-egg/Predator-effect roll, not a literal hook into
// every die in the engine).
export function useStrategem(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  eggsToSpend: number,
  direction: 1 | -1,
): GameState {
  const player = requireAlive(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.canAdjustAnyRollForEggs);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (eggsToSpend < 1) throw new Error('Spend at least 1 egg to use Strategem');
  if (player.eggs < eggsToSpend) throw new Error(`${playerId} does not have ${eggsToSpend} eggs to spend`);

  const intercept = { mode: 'adjustBy' as const, value: direction * eggsToSpend };
  if (targetPlayerId === playerId) {
    return { ...state, players: replacePlayer(state.players, { ...player, eggs: player.eggs - eggsToSpend, pendingRollIntercept: intercept }) };
  }
  const spentCaster = { ...player, eggs: player.eggs - eggsToSpend };
  const target = getPlayer(state.players, targetPlayerId);
  const players = replacePlayer(replacePlayer(state.players, spentCaster), { ...target, pendingRollIntercept: intercept });
  return { ...state, players };
}

// Deus Eggs Machina (J.R.R. Yolkien S3): "Can pay one egg to re-roll any
// die (Once per occasion)." "Once per occasion" reads as "once per use,"
// same as every other "pay a resource for X" ability in this data — not a
// separate cooldown, since nothing else in core_rules.md defines "occasion."
export function useDeusEggsMachina(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = requireAlive(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.canRerollAnyRollForEgg);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (player.eggs < 1) throw new Error(`${playerId} does not have an egg to spend`);

  const intercept = { mode: 'reroll' as const };
  if (targetPlayerId === playerId) {
    return { ...state, players: replacePlayer(state.players, { ...player, eggs: player.eggs - 1, pendingRollIntercept: intercept }) };
  }
  const spentCaster = { ...player, eggs: player.eggs - 1 };
  const target = getPlayer(state.players, targetPlayerId);
  const players = replacePlayer(replacePlayer(state.players, spentCaster), { ...target, pendingRollIntercept: intercept });
  return { ...state, players };
}

// Wherever, any Weather (Chickira S2): "Free action: Once per turn, you
// may roll. If 4-6, Draw a new Weather Card from the appropriate deck."
export function useWhereverAnyWeather(state: GameState, playerId: string): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.freeWeatherRedrawRoll);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  const marked: GameState = { ...state, players: replacePlayer(state.players, { ...player, freeAbilityUsedThisTurn: true }) };
  if (rollDie(state.config.rng) < 4) return marked;
  return redrawWeatherCard(marked);
}

// Dungeon Keys (Sheriff of Rottingham's Loot): "Shuffle the Grub discard
// pile. Draw until you have two 1-health Grubs. Keep one, give one to a
// nearby teammate (single-use)." Searches the combined Inside+Outside
// discard, redistributing whatever's left back across both piles evenly.
export function useDungeonKeys(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = requireAlive(state, playerId);
  if (!PREDATOR_LOOT['Sheriff of Rottingham']?.dungeonKeys) throw new Error('Dungeon Keys effect not configured');
  if (!player.lootDrops.includes('Sheriff of Rottingham')) throw new Error(`${playerId} does not hold Sheriff of Rottingham's Dungeon Keys`);
  if ((player.lootCharges['Sheriff of Rottingham'] ?? 0) < 1) throw new Error('Dungeon Keys has already been used');
  const target = getPlayer(state.players, targetPlayerId);
  if (targetPlayerId !== playerId && target.location !== player.location) {
    throw new Error(`${targetPlayerId} must be nearby ${playerId} to receive a Dungeon Keys Grub`);
  }

  const combined = shuffle([...state.grubDecks.inside.discard, ...state.grubDecks.outside.discard], state.config.rng);
  const found: number[] = [];
  const remaining: number[] = [];
  for (const cardId of combined) {
    if (found.length < 2 && parseIntField(loadGrubCards()[cardId]?.health ?? null, 0) === 1) found.push(cardId);
    else remaining.push(cardId);
  }
  if (found.length < 2) throw new Error('Could not find two 1-health Grubs in the discard pile');

  const [keptId, givenId] = found;
  const half = Math.ceil(remaining.length / 2);
  const grubDecks: GrubDecksState = {
    inside: { ...state.grubDecks.inside, discard: remaining.slice(0, half) },
    outside: { ...state.grubDecks.outside, discard: remaining.slice(half) },
  };
  const keptCard: HeldGrubCard = { cardId: keptId, currentHealth: 1, rewardUsed: false };
  const givenCard: HeldGrubCard = { cardId: givenId, currentHealth: 1, rewardUsed: false };
  const holder = { ...player, lootCharges: { ...player.lootCharges, 'Sheriff of Rottingham': 0 }, grubHand: [...player.grubHand, keptCard] };

  const players =
    targetPlayerId === playerId
      ? replacePlayer(state.players, { ...holder, grubHand: [...holder.grubHand, givenCard] })
      : replacePlayer(replacePlayer(state.players, holder), { ...target, grubHand: [...target.grubHand, givenCard] });
  return { ...state, players, grubDecks };
}

// Tomb Raider (Eggatha Christie S3): "Once per turn, you may attack a
// discarded grub. Once a revived grub has been used, remove it from the
// game." Targets a specific card sitting in either side's discard pile by
// index — same combat pipeline as a normal Grub attack (return-attack risk
// included), but against the discard pile instead of the face-up card.
export function attackDiscardedGrub(
  state: GameState,
  playerId: string,
  side: 'inside' | 'outside',
  discardIndex: number,
  attackStrength: number,
): GameState {
  const player = assertCanAct(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.canAttackDiscardedGrubs);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  const playerSide = player.location === 'Coop' ? 'inside' : 'outside';
  if (playerSide !== side) throw new Error(`${playerId} must be nearby the ${side} discard pile to raid it`);
  const cardId = state.grubDecks[side].discard[discardIndex];
  if (cardId == null) throw new Error(`No discarded Grub at index ${discardIndex} on the ${side} side`);
  if (attackStrength < 1) throw new Error('Attack strength must be at least 1');
  if (player.food < attackStrength) throw new Error(`${playerId} does not have ${attackStrength} food to Attack with`);

  const fullHealth = parseIntField(loadGrubCards()[cardId]?.health ?? null, 0);
  const revivedHealth = Math.max(0, fullHealth - attackStrength);
  const afterCost: GameState = { ...state, players: replacePlayer(state.players, { ...player, food: player.food - attackStrength }) };

  if (revivedHealth > 0) {
    // Not defeated this attack — the card goes back to the discard pile at
    // its reduced health, same "wild" resource it was before (matches the
    // face-up Grub combat model), still marked for removal once its
    // Reward is eventually used.
    return {
      ...afterCost,
      grubDecks: {
        ...state.grubDecks,
        [side]: { ...state.grubDecks[side], discard: state.grubDecks[side].discard.filter((_, i) => i !== discardIndex) },
      },
      actionsRemainingThisTurn: afterCost.actionsRemainingThisTurn - 1,
    };
  }

  // Defeated: transfers to the raider's hand exactly like a normal Grub
  // kill. "Once a revived grub has been used, remove it from the game" —
  // already true of every held Grub card today (useGrubReward's single-use
  // discard path removes it from the hand with no other destination, so it
  // never re-enters any deck), so no separate flag is needed here.
  const heldCard: HeldGrubCard = { cardId, currentHealth: fullHealth, rewardUsed: false };
  const updatedPlayer = getPlayer(afterCost.players, playerId);
  return {
    ...afterCost,
    players: replacePlayer(afterCost.players, { ...updatedPlayer, grubHand: [...updatedPlayer.grubHand, heldCard] }),
    grubDecks: {
      ...state.grubDecks,
      [side]: { ...state.grubDecks[side], discard: state.grubDecks[side].discard.filter((_, i) => i !== discardIndex) },
    },
    actionsRemainingThisTurn: afterCost.actionsRemainingThisTurn - 1,
  };
}

// "Move everyone for free" Bonus Card: grants every alive player a free
// Move (no action cost, usable any time, not gated to the caster's own
// turn — matching every other "any player may act off-turn" free-grant in
// this engine). Consumes the grant on use; a player who never uses it just
// loses it at nothing.
export function useFreeMoveGrant(state: GameState, playerId: string, destination: Location): GameState {
  const player = requireAlive(state, playerId);
  if (!player.pendingFreeMove) throw new Error(`${playerId} has no free Move available`);
  return { ...state, players: replacePlayer(state.players, { ...player, location: destination, pendingFreeMove: false }) };
}

// Portable House (Layonardo's Loot): "You or a nearby player may ignore
// weather effects for one turn (multi-use)." Reuses the existing
// pendingWeatherImmuneUntilNextTurn field (already checked at every
// weather-gated site in the engine).
export function usePortableHouse(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = requireAlive(state, playerId);
  if (!PREDATOR_LOOT['Layonardo']?.grantsWeatherImmunityForTurn) throw new Error('Portable House effect not configured');
  if (!player.lootDrops.includes('Layonardo')) throw new Error(`${playerId} does not hold Layonardo's Portable House`);
  const target = getPlayer(state.players, targetPlayerId);
  if (targetPlayerId !== playerId && target.location !== player.location) {
    throw new Error(`${targetPlayerId} must be nearby ${playerId} to use Portable House on them`);
  }
  return { ...state, players: replacePlayer(state.players, { ...target, pendingWeatherImmuneUntilNextTurn: true }) };
}

// Snow's "if in last phase, you may make exchanges during any turn" —
// an ad-hoc Egg Exchange outside the normal phase-boundary cadence,
// available only while Snow is active during the season's 3rd phase.
export function adHocEggExchange(state: GameState, playerId: string, amount: number): GameState {
  const player = requireAlive(state, playerId);
  if (activeWeatherName(state) !== 'Snow' || state.phase !== 3) {
    throw new Error('Ad-hoc Egg Exchanges are only available while Snow is active in the last phase of the season');
  }
  const rate = getOwnAndBorrowedAbilities(player).reduce((r, a) => a.eggExchangeRate ?? r, 1);
  return { ...state, players: replacePlayer(state.players, applyEggExchange(player, amount, rate)) };
}

// Wilderness Guide (Aracorn S3): "Free action: Once per turn, you may pay
// an egg to move another player."
export function useWildernessGuide(state: GameState, playerId: string, targetPlayerId: string, destination: Location): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.freeMoveAnotherPlayerForEgg);
  if (!hasAbility) throw new Error(`${playerId}'s chicken has no such ability`);
  if (player.eggs < 1) throw new Error(`${playerId} does not have an egg to spend`);
  if (targetPlayerId === playerId) throw new Error('Wilderness Guide moves another player, not yourself');
  const target = getPlayer(state.players, targetPlayerId);
  const spentCaster = { ...player, eggs: player.eggs - 1, freeAbilityUsedThisTurn: true };
  const players = replacePlayer(replacePlayer(state.players, spentCaster), { ...target, location: destination });
  return { ...state, players };
}

// Board-placed eggs (Bacaw!/Dedication) — collectible by any alive player
// currently at that location.
export function collectBoardEgg(state: GameState, playerId: string, location: Location): GameState {
  const player = requireAlive(state, playerId);
  if (player.location !== location) throw new Error(`${playerId} must be at ${location} to collect the egg there`);
  const available = state.boardEggs[location] ?? 0;
  if (available < 1) throw new Error(`No egg to collect at ${location}`);
  return {
    ...state,
    boardEggs: { ...state.boardEggs, [location]: available - 1 },
    players: replacePlayer(state.players, { ...player, eggs: player.eggs + 1 }),
  };
}

export function eat(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  // Freezing: "May Eat inside during this phase" — overrides the normal
  // Outside-only requirement while trapped in the Coop by the same card.
  const allowsEatInside = activeWeatherEffect(state, playerId)?.allowsEatInside && player.location === 'Coop';
  if (!isOutside(player.location) && !allowsEatInside) throw new Error('Eat requires being Outside');
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

  const weather = activeWeatherEffect(state, playerId);
  const weatherImmune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state, playerId) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;
  const cost = !weatherImmune && weather?.onForageCost ? weather.onForageCost : 1; // Drought: 2 actions instead of 1
  if (state.actionsRemainingThisTurn < cost) {
    throw new Error(`${playerId} needs ${cost} action(s) to Forage right now (has ${state.actionsRemainingThisTurn})`);
  }

  const abilities = getOwnAndBorrowedAbilities(player);
  let food = 1;
  let rerollConsumed = false;
  let interceptedPlayer: PlayerState | null = null;
  const battleCryBonus = nearbyAuraTeammateRollBonus(state, player.id); // Battle Cry
  for (const ability of abilities) {
    if (ability.forageRoll) {
      let baseRoll = rollDie(state.config.rng);
      if (player.pendingRerollNextRoll && !rerollConsumed) {
        baseRoll = Math.max(baseRoll, rollDie(state.config.rng));
        rerollConsumed = true;
      }
      if (player.pendingRollIntercept && !interceptedPlayer) {
        const applied = applyRollIntercept(player, baseRoll, state.config.rng);
        baseRoll = applied.roll;
        interceptedPlayer = applied.player;
      }
      const roll = baseRoll + battleCryBonus;
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
      pendingRollIntercept: interceptedPlayer ? null : player.pendingRollIntercept,
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
  const ability = getOwnAndBorrowedAbilities(player).find((a) => a.freeGiftFood);
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
  const ability = getOwnAndBorrowedAbilities(player).find((a) => a.freeDamageForEggs);
  if (!ability?.freeDamageForEggs) throw new Error(`${playerId}'s chicken has no such ability`);
  const { damage, eggsGained } = ability.freeDamageForEggs;
  const damaged = applyDamageAndMaybeDeath(player, damage);
  const updated = { ...damaged, eggs: damaged.eggs + eggsGained, freeAbilityUsedThisTurn: true };
  return { ...state, players: replacePlayer(state.players, updated) };
}

export function payEggForCard(state: GameState, playerId: string): GameState {
  const player = assertFreeAbilityAvailable(state, playerId);
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.freeEggForCard);
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
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.freeOutsideMove);
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
  const hasAbility = getOwnAndBorrowedAbilities(player).some((a) => a.drawTwoKeepOne);
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
    // Route through the same defeat-consequence path a real Attack uses
    // (grants the Loot Drop/reveals the Boss/transfers a defeated Grub to
    // hand) instead of just clamping health — a card-effect kill used to
    // leave a 0-health, still-not-`defeated` target behind, which silently
    // blocked the win check. Sync `player`'s pending local changes into
    // `players` first so this branch sees them (and the killer's own gains
    // from the damage, if any) correctly either direction.
    const beforeDamage: GameState = { ...state, players: replacePlayer(players, player), predators, grubDecks, bonusDeck };
    const damaged =
      params.targetType === 'predator'
        ? applyDirectPredatorDamage(beforeDamage, params.targetId, effect.enemyDamage, playerId)
        : applyDirectGrubDamage(beforeDamage, params.targetId as 'inside' | 'outside', effect.enemyDamage, playerId);
    players = damaged.players;
    predators = damaged.predators;
    grubDecks = damaged.grubDecks;
    bonusDeck = damaged.bonusDeck;
    player = getPlayer(players, playerId);
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
  if (effect.reflectsReturnAttackNextAttack) player = { ...player, pendingReflectReturnAttack: true };

  if (effect.permanentEggProductionBonus) {
    player = { ...player, permanentEggProductionBonus: player.permanentEggProductionBonus + effect.permanentEggProductionBonus };
  }
  if (effect.permanentReturnAttackReductionRoll) player = { ...player, permanentReturnAttackReductionRoll: effect.permanentReturnAttackReductionRoll };
  if (effect.permanentNoBonusCardHandLimit) player = { ...player, permanentNoBonusCardHandLimit: true };
  if (effect.permanentForageBonusUntilNextWeather) {
    player = { ...player, permanentForageBonusUntilNextWeather: player.permanentForageBonusUntilNextWeather + effect.permanentForageBonusUntilNextWeather };
  }
  if (effect.immuneToWeatherUntilNextCard) player = { ...player, permanentWeatherImmuneUntilNextCard: true };
  if (effect.permanentTagAlongUnlocked) player = { ...player, permanentTagAlongUnlocked: true };

  if (effect.grantsFreeMoveToEveryone) {
    players = players.map((p) => (p.alive ? { ...p, pendingFreeMove: true } : p));
  }

  if (effect.grantsInsideActionsOutsideForTurn) {
    player = { ...player, pendingMayActAsInsideThisTurn: true };
  }

  if (effect.borrowsTeammateAbility) {
    if (!params.targetPlayerId) throw new Error('This card requires a teammate target');
    const target = getPlayer(players, params.targetPlayerId);
    const stage = Math.min(target.stage, Math.max(1, params.amount ?? target.stage)) as Stage;
    player = { ...player, pendingBorrowedAbility: { chickenName: target.chickenName, stage } };
  }

  if (effect.rerollTargetPlayerNextRoll || effect.pickTargetPlayerNextRollOutcome) {
    if (!params.targetPlayerId) throw new Error('This card requires a target for the die roll');
    const intercept = effect.pickTargetPlayerNextRollOutcome
      ? { mode: 'forceValue' as const, value: Math.min(6, Math.max(1, params.amount ?? 1)) }
      : { mode: 'reroll' as const };
    if (params.targetPlayerId === playerId) {
      player = { ...player, pendingRollIntercept: intercept };
    } else {
      const target = getPlayer(players, params.targetPlayerId);
      players = replacePlayer(players, { ...target, pendingRollIntercept: intercept });
    }
  }

  if (effect.ladybugRoll) {
    const eggRoll = rollDie(state.config.rng);
    const foodRoll = rollDie(state.config.rng);
    const healthRoll = rollDie(state.config.rng);
    player = applyResourceDelta(player, { egg: eggRoll, food: foodRoll, health: -healthRoll });
  }

  if (effect.extraActions) actionsDelta += effect.extraActions;

  let weather = state.weather;
  if (effect.drawsNewWeatherCard) {
    const redrawn = redrawWeatherCard({ ...state, players: replacePlayer(players, player) });
    players = redrawn.players;
    weather = redrawn.weather;
  }

  if (effect.takeSpecificBonusCardFromDiscard) {
    const idx = params.discardExtraCardIndex;
    if (idx == null || bonusDeck.discard[idx] == null) throw new Error('Choose a discarded Bonus Card to take');
    if (!player.permanentNoBonusCardHandLimit && player.bonusCardHand.length >= player.bonusCardHandLimit) {
      throw new Error(`${playerId} is at their Bonus Card hand limit (${player.bonusCardHandLimit})`);
    }
    const cardId = bonusDeck.discard[idx];
    bonusDeck = { ...bonusDeck, discard: bonusDeck.discard.filter((_, i) => i !== idx) };
    player = { ...player, bonusCardHand: [...player.bonusCardHand, cardId] };
  }

  if (effect.redrawWeatherOrCallEggExchange) {
    if (params.option === 2) {
      const amount = Math.max(0, Math.min(params.amount ?? 0, player.eggs));
      player = applyEggExchange(player, amount);
    } else {
      const redrawn = redrawWeatherCard({ ...state, players: replacePlayer(players, player) });
      players = redrawn.players;
      weather = redrawn.weather;
    }
  }

  players = replacePlayer(players, player);
  return {
    ...state,
    players,
    predators,
    grubDecks,
    bonusDeck,
    weather,
    actionsRemainingThisTurn: state.actionsRemainingThisTurn + actionsDelta,
  };
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
    effect.permanentForageBonusUntilNextWeather ||
    effect.permanentTagAlongUnlocked
  );
  const updatedHand = isPermanent
    ? player.grubHand.map((h, i) => (i === grubHandIndex ? { ...h, rewardUsed: true } : h))
    : player.grubHand.filter((_, i) => i !== grubHandIndex);
  const withCardHandled: GameState = { ...state, players: replacePlayer(state.players, { ...player, grubHand: updatedHand }) };

  // Lucky Cricket: the effect to apply isn't its own — it's whichever held
  // Bonus Card of the chosen teammate's is being copied, looked up here
  // rather than in the generic resolveCardEffect dispatch.
  if (effect.copiesTeammateBonusCardEffect) {
    if (!params.targetPlayerId) throw new Error('This card requires a teammate target');
    const target = getPlayer(state.players, params.targetPlayerId);
    const idx = params.discardExtraCardIndex;
    const copiedCardId = idx != null ? target.bonusCardHand[idx] : undefined;
    if (copiedCardId == null) throw new Error(`${params.targetPlayerId} has no held Bonus Card at that index to copy`);
    const shorthand = loadBonusCards()[copiedCardId]?.shorthand;
    const copiedEffect = shorthand ? BONUS_CARD_EFFECTS[shorthand] : undefined;
    if (!copiedEffect) throw new Error(`"${shorthand}" is not yet implemented`);
    return resolveCardEffect(withCardHandled, playerId, copiedEffect, params);
  }

  return resolveCardEffect(withCardHandled, playerId, effect, params);
}
