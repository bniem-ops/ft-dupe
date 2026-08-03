// The 8 base actions from core_rules.md. Each validates location/cost/
// stage requirements and consumes 1 of the turn's remaining actions.
import { GameState, PlayerState, Location, OUTSIDE_LOCATIONS, Stage } from './types.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { addMeals } from './leveling.js';
import { resolveCombat } from './combat.js';

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
  return withPlayer(state, { ...player, eggs: player.eggs + 1 });
}

export function heal(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  if (player.location !== 'Coop') throw new Error('Heal requires being Inside (the Coop)');
  const cap = healCap(player.stage);
  if (amount < 1 || amount > cap) throw new Error(`Heal amount must be between 1 and ${cap} for stage ${player.stage}`);
  if (player.food < amount) throw new Error(`${playerId} does not have ${amount} food to Heal`);
  const healedHealth = Math.min(player.maxHealth, player.health + amount);
  return withPlayer(state, { ...player, food: player.food - amount, health: healedHealth });
}

// Revives a dead player: pay 1 egg, skip your (the brooder's) next turn.
// The actual revival flow (draw 2 Chicken Books, pick one, rejoin as a
// Chick) is phase 8 — here the target is just marked alive again.
export function brood(state: GameState, playerId: string, targetPlayerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (player.location !== 'Coop') throw new Error('Brood requires being Inside (the Coop)');
  if (player.eggs < 1) throw new Error(`${playerId} does not have an egg to Brood`);
  const target = getPlayer(state.players, targetPlayerId);
  if (target.alive) throw new Error(`${targetPlayerId} is not dead and cannot be Brooded`);

  const brooder = { ...player, eggs: player.eggs - 1, skipNextTurn: true };
  const revived = { ...target, alive: true }; // TODO(phase 8): full revival flow
  const players = replacePlayer(replacePlayer(state.players, brooder), revived);
  return { ...state, players, actionsRemainingThisTurn: state.actionsRemainingThisTurn - 1 };
}

export function move(state: GameState, playerId: string, destination: Location): GameState {
  const player = assertCanAct(state, playerId);
  return withPlayer(state, { ...player, location: destination });
}

export function drawCard(state: GameState, playerId: string): GameState {
  const player = assertCanAct(state, playerId);
  if (player.bonusCardHand.length >= player.bonusCardHandLimit) {
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
): GameState {
  const player = assertCanAct(state, playerId);
  if (attackStrength < 1) throw new Error('Attack strength must be at least 1');
  const cost = attackStrength;
  if (player.food < cost) throw new Error(`${playerId} does not have ${cost} food to Attack with strength ${attackStrength}`);

  if (targetType === 'predator') {
    const predator = state.predators.find((p) => p.name === targetId);
    if (!predator) throw new Error(`Unknown predator: ${targetId}`);
    if (!predator.revealed) throw new Error(`${targetId} is not revealed yet`);
    if (predator.location !== player.location) throw new Error(`${playerId} must be nearby ${targetId} to Attack`);
  } else {
    const side = targetId === 'inside' ? 'inside' : targetId === 'outside' ? 'outside' : null;
    if (!side) throw new Error(`Grub target must be 'inside' or 'outside'`);
    const playerSide = player.location === 'Coop' ? 'inside' : 'outside';
    if (playerSide !== side) throw new Error(`${playerId} must be nearby the ${side} Grub to Attack it`);
    if (!state.grubDecks[side].faceUp) throw new Error(`No face-up Grub ${side} to Attack`);
  }

  const afterCost = withPlayer(state, { ...player, food: player.food - cost });
  return resolveCombat(afterCost, playerId, targetType, targetId, attackStrength);
}

export function eat(state: GameState, playerId: string, amount: number): GameState {
  const player = assertCanAct(state, playerId);
  if (!isOutside(player.location)) throw new Error('Eat requires being Outside');
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
  return withPlayer(state, { ...player, food: player.food + 1 });
}
