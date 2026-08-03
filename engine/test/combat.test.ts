import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat, levelUpPredators } from '../src/combat.js';
import { loadGrubCards, parseIntField } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

test('resolveCombat reduces predator health and applies return-attack damage', () => {
  const state = createGame(baseConfig());
  const before = state.predators.find((p) => p.name === 'Eggsmeralda')!; // stage1, returnAttack 1
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', 1);
  const after = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  assert.equal(after.health, before.health - 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, state.players[0].health - 1);
});

test('defeating a predator marks it defeated and grants its name as a Loot Drop', () => {
  const state = createGame(baseConfig());
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', eggsmeralda.health);
  const after = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  assert.equal(after.defeated, true);
  assert.equal(after.health, 0);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.ok(p1.lootDrops.includes('Eggsmeralda'));
});

test('defeating the last surviving regular predator reveals the Boss', () => {
  let state = createGame(baseConfig());
  for (const name of ['Eggsmeralda', 'Sal Moe Nella', 'Professor Moltiarty']) {
    const predator = state.predators.find((p) => p.name === name)!;
    state = resolveCombat(state, 'p1', 'predator', name, predator.health);
  }
  const boss = state.predators.find((p) => p.isBoss)!;
  assert.equal(boss.revealed, true);
});

test('a dodged hook suppresses return-attack damage', () => {
  const state = createGame(baseConfig({ hooks: { targetEffect: () => ({ dodged: true }) } }));
  const before = state.players.find((p) => p.id === 'p1')!.health;
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', 1);
  const after = result.players.find((p) => p.id === 'p1')!.health;
  assert.equal(after, before);
});

test('attacker health reaching 0 triggers the death consequence, keeping Loot Drops', () => {
  const state = createGame(baseConfig());
  const withLowHealth: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === 'p1' ? { ...p, health: 1, food: 5, eggs: 2, lootDrops: ['Some Predator'] } : p,
    ),
  };
  const result = resolveCombat(withLowHealth, 'p1', 'predator', 'Eggsmeralda', 1); // returnAttack 1 -> 1-1=0
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.alive, false);
  assert.equal(p1.health, 0);
  assert.equal(p1.food, 0);
  assert.equal(p1.eggs, 0);
  assert.deepEqual(p1.lootDrops, ['Some Predator']); // kept; Eggsmeralda wasn't defeated by 1 damage
});

test('Grub attack reduces face-up health; defeating it transfers a fresh HeldGrubCard and redeals', () => {
  const state = createGame(baseConfig());
  // Card 19 is Wasp Swarm (printed health 4) — set explicitly rather than
  // relying on the shuffled deal, since several Grubs have 0-1 health and
  // would be defeated outright by a "partial" 1-damage hit.
  const wasSwarmCardId = 19;
  assert.equal(parseIntField(loadGrubCards()[wasSwarmCardId].health, 0), 4);
  const withKnownGrub: GameState = {
    ...state,
    players: state.players.map((p) => (p.id === 'p1' ? { ...p, location: 'Coop' as const } : p)),
    grubDecks: {
      ...state.grubDecks,
      inside: { ...state.grubDecks.inside, faceUp: { cardId: wasSwarmCardId, currentHealth: 4, rewardUsed: false } },
    },
  };

  const partial = resolveCombat(withKnownGrub, 'p1', 'grub', 'inside', 1);
  const partialFaceUp = partial.grubDecks.inside.faceUp!;
  assert.equal(partialFaceUp.cardId, wasSwarmCardId);
  assert.equal(partialFaceUp.currentHealth, 3);

  const lethal = resolveCombat(withKnownGrub, 'p1', 'grub', 'inside', 4);
  const p1 = lethal.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.grubHand.length, 1);
  assert.equal(p1.grubHand[0].cardId, wasSwarmCardId);
  assert.equal(p1.grubHand[0].currentHealth, 4); // fresh, full-health personal resource
  assert.notEqual(lethal.grubDecks.inside.faceUp?.cardId, wasSwarmCardId);
  // The card moves to the killer's hand, not the shared discard pile — it
  // only returns there once the player uses and discards it themselves
  // (per the confirmed Grub lifecycle in docs/rules-audit.md).
  assert.ok(!lethal.grubDecks.inside.discard.includes(wasSwarmCardId));
});

test('levelUpPredators recalculates health from the new stage multiplier, carrying damage over', () => {
  const state = createGame(baseConfig());
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!; // stage1, x2, health 4 (2 players)
  const damaged = { ...eggsmeralda, health: eggsmeralda.health - 1 };
  const predators = state.predators.map((p) => (p.name === 'Eggsmeralda' ? damaged : p));
  const leveled = levelUpPredators(predators, 2, 4);
  const after = leveled.find((p) => p.name === 'Eggsmeralda')!;
  assert.equal(after.stage, 2);
  assert.equal(after.maxHealth, 6); // Eggsmeralda S2 x3 * 2 players
  assert.equal(after.health, 5); // 6 - 1 damage carried over
});

test('levelUpPredators skips defeated predators and the already-stage-3 Boss', () => {
  const state = createGame(baseConfig());
  const defeated = { ...state.predators.find((p) => p.name === 'Eggsmeralda')!, defeated: true };
  const predators = state.predators.map((p) => (p.name === 'Eggsmeralda' ? defeated : p));
  const leveled = levelUpPredators(predators, 2, 4);
  assert.equal(leveled.find((p) => p.name === 'Eggsmeralda')!.stage, 1);
  assert.equal(leveled.find((p) => p.isBoss)!.stage, 3);
});
