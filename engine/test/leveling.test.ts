import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { addMeals } from '../src/leveling.js';
import { baseConfig } from './testHelpers.js';

// Shellock Holmes: Chick mealsToNext=5 (health 3->4, attack 1->2),
// Pullet/Cockerel mealsToNext=10 (health 4->5, attack 2->3), Hen/Rooster
// mealsToNext=null (no further stage).

test('addMeals below threshold just increments the counter', () => {
  const state = createGame(baseConfig());
  const player = state.players.find((p) => p.id === 'p1')!;
  const updated = addMeals(player, 3);
  assert.equal(updated.mealCounter, 3);
  assert.equal(updated.stage, 1);
});

test('addMeals crossing the threshold levels up, preserving damage and not resetting the counter', () => {
  const state = createGame(baseConfig());
  const damaged = { ...state.players.find((p) => p.id === 'p1')!, health: 1, mealCounter: 4 }; // 2 damage taken
  const updated = addMeals(damaged, 1); // reaches 5 -> levels up
  assert.equal(updated.stage, 2);
  assert.equal(updated.mealCounter, 5); // not reset
  assert.equal(updated.maxHealth, 4); // S2 health
  assert.equal(updated.health, 2); // 4 - 2 damage carried over
  assert.equal(updated.attackStrength, 2);
});

test('addMeals can cross two thresholds in one call', () => {
  const state = createGame(baseConfig());
  const player = state.players.find((p) => p.id === 'p1')!;
  const updated = addMeals(player, 10); // crosses both 5 and 10
  assert.equal(updated.stage, 3);
  assert.equal(updated.mealCounter, 10);
  assert.equal(updated.maxHealth, 5); // S3 health
  assert.equal(updated.attackStrength, 3);
});

test('addMeals does nothing further once at stage 3 (no mealsToNext)', () => {
  const state = createGame(baseConfig());
  const maxed = { ...state.players.find((p) => p.id === 'p1')!, stage: 3 as const, mealCounter: 999 };
  const updated = addMeals(maxed, 5);
  assert.equal(updated.stage, 3);
  assert.equal(updated.mealCounter, 1004);
});
