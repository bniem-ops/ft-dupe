import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { layEgg, heal, brood, completeRevival, move, drawCard, discardBonusCard, attack, eat, forage } from '../src/actions.js';
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

test("Madam Chickovsky's stage-3 Fur Coat lifts the Inside-only restriction on Lay Egg/Heal/Brood", () => {
  const state = createGame(baseConfig());
  const outside = withPlayer(state, 'p1', {
    chickenName: 'Madam Chickovsky',
    stage: 3,
    location: 'Grit Stones',
    health: 1,
    maxHealth: 3,
    food: 5,
    eggs: 1,
  });
  const withDeadTarget = withPlayer(outside, 'p2', { alive: false });

  assert.equal(heal(outside, 'p1', 1).players.find((p) => p.id === 'p1')!.health, 2);
  assert.equal(layEgg(outside, 'p1').players.find((p) => p.id === 'p1')!.eggs, 2);
  assert.equal(brood(withDeadTarget, 'p1', 'p2').players.find((p) => p.id === 'p1')!.eggs, 0);

  // A chicken without Fur Coat is still blocked Outside (unaffected by this change).
  const otherOutside = withPlayer(state, 'p1', { location: 'Grit Stones', food: 5 });
  assert.throws(() => heal(otherOutside, 'p1', 1));
});

test('brood costs 1 egg, skips the brooder\'s next turn, and draws 2 revival choices (not an immediate revive)', () => {
  const state = createGame(baseConfig());
  const ready = withPlayer(state, 'p1', { eggs: 1 });
  const withDeadTarget = withPlayer(ready, 'p2', { alive: false });

  assert.throws(() => brood(ready, 'p1', 'p2')); // p2 still alive

  const result = brood(withDeadTarget, 'p1', 'p2');
  const brooder = result.players.find((p) => p.id === 'p1')!;
  const downed = result.players.find((p) => p.id === 'p2')!;
  assert.equal(brooder.eggs, 0);
  assert.equal(brooder.skipNextTurn, true);
  assert.equal(downed.alive, false);
  assert.equal(downed.pendingRevivalChoices?.length, 2);

  const withAnotherEgg = withPlayer(result, 'p1', { eggs: 1 });
  assert.throws(() => brood(withAnotherEgg, 'p1', 'p2')); // already has a pending choice

  const revived = completeRevival(result, 'p2', downed.pendingRevivalChoices![0]);
  const p2 = revived.players.find((p) => p.id === 'p2')!;
  assert.equal(p2.alive, true);
  assert.equal(p2.stage, 1);
  assert.equal(p2.chickenName, downed.pendingRevivalChoices![0]);
  assert.equal(p2.pendingRevivalChoices, null);
  assert.equal(p2.justRevivedPendingFirstTurn, true);
});

test('move sets the player\'s location with no cost beyond the action', () => {
  const state = createGame(baseConfig());
  const result = move(state, 'p1', 'Grit Stones');
  assert.equal(result.players.find((p) => p.id === 'p1')!.location, 'Grit Stones');
});

test('drawCard respects the hand limit and removes the card from the shared deck', () => {
  const state = createGame(baseConfig());
  // p1 is Shellock Holmes (Naturalist: starts with 1 Bonus Card already).
  const startingHandSize = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const drawn = drawCard(state, 'p1');
  const p1 = drawn.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.bonusCardHand.length, startingHandSize + 1);
  assert.equal(drawn.bonusDeck.drawPile.length, state.bonusDeck.drawPile.length - 1);

  // Drawing into an already-full hand succeeds instead of being blocked —
  // core_rules.md never spells out a discard rule; the table's reading is
  // you draw first, then discard down to size (discardBonusCard, below).
  const atLimit = withPlayer(state, 'p1', { bonusCardHand: [0, 1] }); // limit is 2
  const overLimit = drawCard(atLimit, 'p1');
  const overP1 = overLimit.players.find((p) => p.id === 'p1')!;
  assert.equal(overP1.bonusCardHand.length, 3);

  // Only available once actually over the limit, and the player chooses
  // which card goes.
  const discarded = discardBonusCard(overLimit, 'p1', 1);
  const discardedP1 = discarded.players.find((p) => p.id === 'p1')!;
  assert.deepEqual(discardedP1.bonusCardHand, [overP1.bonusCardHand[0], overP1.bonusCardHand[2]]);
  assert.throws(() => discardBonusCard(discarded, 'p1', 0)); // no longer over the limit
});

test('discardBonusCard: never proactive — only usable once your hand is actually over the limit', () => {
  const state = createGame(baseConfig());
  const atLimit = withPlayer(state, 'p1', { bonusCardHand: [0, 1] }); // exactly at the limit, not over it
  assert.throws(() => discardBonusCard(atLimit, 'p1', 0));

  const overLimit = withPlayer(state, 'p1', { bonusCardHand: [0, 1, 2] });
  assert.throws(() => discardBonusCard(overLimit, 'p1', 5)); // no card at that index
  const discarded = discardBonusCard(overLimit, 'p1', 2);
  assert.deepEqual(discarded.players.find((p) => p.id === 'p1')!.bonusCardHand, [0, 1]);
  assert.ok(discarded.bonusDeck.discard.includes(2));
});

test('attack on a Predator requires being nearby and revealed, and costs food per attack strength', () => {
  const state = createGame(baseConfig());
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const farAway = withPlayer(state, 'p1', { food: 5, location: 'Grit Stones' });
  assert.throws(() => attack(farAway, 'p1', 'predator', 'Eggsmeralda', 1));

  const nearby = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location });
  const result = attack(nearby, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 4);

  const poor = withPlayer(nearby, 'p1', { food: 0 });
  assert.throws(() => attack(poor, 'p1', 'predator', 'Eggsmeralda', 1));

  const boss = withPlayer(nearby, 'p1', { location: 'Badlands' });
  assert.throws(() => attack(boss, 'p1', 'predator', 'Ursula Bone', 1)); // not revealed yet
});

test('attack strength is capped at the chicken\'s stat (+ weather/ability modifiers)', () => {
  const state = createGame(baseConfig());
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const nearby = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location }); // Shellock Holmes Chick: attackStrength 1
  assert.throws(() => attack(nearby, 'p1', 'predator', 'Eggsmeralda', 2));
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

test('attack strength floor drops to 0 against a target already at 0 health (Slug, Wild Grain, Four Leaf Clover start there)', () => {
  const state = createGame(baseConfig());
  const zeroHealthGrub: GameState = {
    ...state,
    grubDecks: {
      ...state.grubDecks,
      inside: { ...state.grubDecks.inside, faceUp: { ...state.grubDecks.inside.faceUp!, currentHealth: 0 } },
    },
  };
  const poor = withPlayer(zeroHealthGrub, 'p1', { food: 0, location: 'Coop' });
  assert.throws(() => attack(poor, 'p1', 'grub', 'inside', 1)); // no food to spare for strength 1
  const result = attack(poor, 'p1', 'grub', 'inside', 0); // strength 0 is fine — it's already dead
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 0); // no cost
  assert.equal(result.players.find((p) => p.id === 'p1')!.grubHand.length, 1); // claimed

  // A healthy target still requires real strength.
  const healthy = withPlayer(state, 'p1', { food: 0, location: 'Coop' });
  assert.throws(() => attack(healthy, 'p1', 'grub', 'inside', 0));
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
