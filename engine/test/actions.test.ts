import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { layEgg, heal, brood, move, drawCard, attack, eat, forage } from '../src/actions.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

test('layEgg requires being Inside and stage >= 2', () => {
  const state = createGame(baseConfig());
  assert.throws(() => layEgg(state, 'p1')); // Chick

  const leveled = withPlayer(state, 'p1', { stage: 2 });
  const outside = withPlayer(leveled, 'p1', { location: 'Grit Stones' });
  assert.throws(() => layEgg(outside, 'p1'));

  const result = layEgg(leveled, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.eggs, 1);
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn - 1);
});

test('heal is capped by stage and requires food', () => {
  const state = createGame(baseConfig());
  const damaged = withPlayer(state, 'p1', { health: 1, food: 5 }); // Chick cap = 1
  assert.throws(() => heal(damaged, 'p1', 2)); // over the Chick cap of 1
  const healed = heal(damaged, 'p1', 1);
  const p1 = healed.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 2);
  assert.equal(p1.food, 4);

  const poor = withPlayer(state, 'p1', { food: 0 });
  assert.throws(() => heal(poor, 'p1', 1));
});

test('heal never exceeds maxHealth', () => {
  const state = createGame(baseConfig());
  const almostFull = withPlayer(state, 'p1', { health: 3, maxHealth: 3, food: 5 });
  const healed = heal(almostFull, 'p1', 1);
  assert.equal(healed.players.find((p) => p.id === 'p1')!.health, 3);
});

test('brood revives a dead player, costs 1 egg, and skips the brooder\'s next turn', () => {
  const state = createGame(baseConfig());
  const ready = withPlayer(state, 'p1', { eggs: 1 });
  const withDeadTarget = withPlayer(ready, 'p2', { alive: false });

  assert.throws(() => brood(ready, 'p1', 'p2')); // p2 still alive

  const result = brood(withDeadTarget, 'p1', 'p2');
  const brooder = result.players.find((p) => p.id === 'p1')!;
  const revived = result.players.find((p) => p.id === 'p2')!;
  assert.equal(brooder.eggs, 0);
  assert.equal(brooder.skipNextTurn, true);
  assert.equal(revived.alive, true);
});

test('move sets the player\'s location with no cost beyond the action', () => {
  const state = createGame(baseConfig());
  const result = move(state, 'p1', 'Grit Stones');
  assert.equal(result.players.find((p) => p.id === 'p1')!.location, 'Grit Stones');
});

test('drawCard respects the hand limit and removes the card from the shared deck', () => {
  const state = createGame(baseConfig());
  const drawn = drawCard(state, 'p1');
  const p1 = drawn.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.bonusCardHand.length, 1);
  assert.equal(drawn.bonusDeck.drawPile.length, state.bonusDeck.drawPile.length - 1);

  const atLimit = withPlayer(state, 'p1', { bonusCardHand: [0, 1] }); // limit is 2
  assert.throws(() => drawCard(atLimit, 'p1'));
});

test('attack on a Predator requires being nearby and revealed, and costs food per attack strength', () => {
  const state = createGame(baseConfig());
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const farAway = withPlayer(state, 'p1', { food: 5, location: 'Grit Stones' });
  assert.throws(() => attack(farAway, 'p1', 'predator', 'Eggsmeralda', 2));

  const nearby = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location });
  const result = attack(nearby, 'p1', 'predator', 'Eggsmeralda', 2);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 3);

  const poor = withPlayer(nearby, 'p1', { food: 1 });
  assert.throws(() => attack(poor, 'p1', 'predator', 'Eggsmeralda', 2));

  const boss = withPlayer(nearby, 'p1', { location: 'Badlands' });
  assert.throws(() => attack(boss, 'p1', 'predator', 'Ursula Bone', 1)); // not revealed yet
});

test('attack on a Grub requires matching Inside/Outside and a face-up card', () => {
  const state = createGame(baseConfig());
  const insideAttacker = withPlayer(state, 'p1', { food: 5, location: 'Coop' });
  const result = attack(insideAttacker, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 4);

  const wrongSide = withPlayer(state, 'p1', { food: 5, location: 'Coop' });
  assert.throws(() => attack(wrongSide, 'p1', 'grub', 'outside', 1));

  const noFaceUp: GameState = {
    ...insideAttacker,
    grubDecks: { ...insideAttacker.grubDecks, inside: { ...insideAttacker.grubDecks.inside, faceUp: null } },
  };
  assert.throws(() => attack(noFaceUp, 'p1', 'grub', 'inside', 1));
});

test('eat requires Outside, is capped by stage, and can trigger a level-up', () => {
  const state = createGame(baseConfig());
  const inside = withPlayer(state, 'p1', { food: 5 });
  assert.throws(() => eat(inside, 'p1', 1)); // still at Coop

  const outside = withPlayer(state, 'p1', { food: 5, location: 'Grit Stones' });
  assert.throws(() => eat(outside, 'p1', 2)); // Chick cap is 1

  // Shellock Holmes Chick needs 5 meals to reach stage 2
  const almostLeveled = withPlayer(outside, 'p1', { mealCounter: 4 });
  const result = eat(almostLeveled, 'p1', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.stage, 2);
  assert.equal(p1.maxHealth, 4); // Shellock Holmes S2 health
  assert.equal(p1.attackStrength, 2);
  assert.equal(p1.food, 4);
});

test('eat preserves existing damage through a level-up (new hearts at full health)', () => {
  const state = createGame(baseConfig());
  const damaged = withPlayer(state, 'p1', {
    food: 5,
    location: 'Grit Stones',
    health: 1, // 2 damage taken out of maxHealth 3
    maxHealth: 3,
    mealCounter: 4,
  });
  const result = eat(damaged, 'p1', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.maxHealth, 4); // new stage max
  assert.equal(p1.health, 2); // 4 - 2 damage carried over
});

test('forage requires Outside and grants 1 food with no cost', () => {
  const state = createGame(baseConfig());
  assert.throws(() => forage(state, 'p1'));
  const outside = withPlayer(state, 'p1', { location: 'Golden Gables' });
  const result = forage(outside, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 1);
});

test('actions reject when it is not the player\'s turn or no actions remain', () => {
  const state = createGame(baseConfig());
  assert.throws(() => forage(withPlayer(state, 'p2', { location: 'Golden Gables' }), 'p2')); // p1's turn
  const outOfActions = { ...state, actionsRemainingThisTurn: 0 };
  assert.throws(() => forage(withPlayer(outOfActions, 'p1', { location: 'Golden Gables' }), 'p1'));
});
