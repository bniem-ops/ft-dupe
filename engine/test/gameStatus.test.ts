import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { applyAction } from '../src/reducer.js';
import { brood, completeRevival } from '../src/actions.js';
import { evaluateGameStatus } from '../src/gameStatus.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

// Marks every predator except `except` as already defeated (health 0),
// and drops `except` to 1 health — a convenience for testing the
// killing-blow win check with a single 1-strength attack, without
// needing to actually fight through all 4.
function withAllButOneDefeated(state: GameState, except: string): GameState {
  return {
    ...state,
    predators: state.predators.map((p) => (p.name === except ? { ...p, health: 1 } : { ...p, health: 0, defeated: true })),
  };
}

test('win: defeating the final Predator with everyone alive sets gameOver + won', () => {
  const state = withPlayer(withAllButOneDefeated(createGame(baseConfig()), 'Eggsmeralda'), 'p1', {
    food: 5,
    location: 'Hendred Acre Wood',
  });
  const result = applyAction(state, { type: 'attack', playerId: 'p1', targetType: 'predator', targetId: 'Eggsmeralda', attackStrength: 1 });
  assert.equal(result.gameOver, true);
  assert.equal(result.won, true);
});

test('the revival edge case: all Predators defeated but a revived player has not taken their first turn back yet is not a win', () => {
  let state = withAllButOneDefeated(createGame(baseConfig()), 'Eggsmeralda');
  state = withPlayer(state, 'p2', { justRevivedPendingFirstTurn: true });
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const result = applyAction(state, { type: 'attack', playerId: 'p1', targetType: 'predator', targetId: 'Eggsmeralda', attackStrength: 1 });
  assert.equal(result.gameOver, false);
});

test('loss: the last living player dying ends the game as a loss', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { health: 1, maxHealth: 3 });
  const dead = { ...state, players: state.players.map((p) => ({ ...p, alive: false })) };
  const status = evaluateGameStatus(dead);
  assert.equal(status.gameOver, true);
  assert.equal(status.won, false);
});

test('no action can be dispatched once the game has ended', () => {
  const won = { ...withAllButOneDefeated(createGame(baseConfig()), 'Eggsmeralda'), gameOver: true, won: true };
  assert.throws(() => applyAction(won, { type: 'forage', playerId: 'p1' }));
});

test('brood: the drawn pool excludes chickens already in use by a living player', () => {
  const state = withPlayer(withPlayer(createGame(baseConfig()), 'p2', { alive: false }), 'p1', { eggs: 1, location: 'Coop' });
  const result = brood(state, 'p1', 'p2');
  const choices = result.players.find((p) => p.id === 'p2')!.pendingRevivalChoices!;
  assert.equal(choices.length, 2);
  assert.ok(!choices.includes('Shellock Holmes')); // p1 is alive and using it
  assert.equal(new Set(choices).size, 2); // distinct
});

test('completeRevival rejects a chicken name that was not offered', () => {
  const state = withPlayer(withPlayer(createGame(baseConfig()), 'p2', { alive: false, pendingRevivalChoices: ['Beowing', 'Wyatt Chirp'] }), 'p1', {
    eggs: 1,
  });
  assert.throws(() => completeRevival(state, 'p2', 'Shellock Holmes'));
});

test('a successful completeRevival grants full stage-1 stats and clears the pending choice', () => {
  const state = withPlayer(createGame(baseConfig()), 'p2', { alive: false, pendingRevivalChoices: ['Beowing', 'Wyatt Chirp'] });
  const result = completeRevival(state, 'p2', 'Beowing');
  const p2 = result.players.find((p) => p.id === 'p2')!;
  assert.equal(p2.alive, true);
  assert.equal(p2.chickenName, 'Beowing');
  assert.equal(p2.stage, 1);
  assert.equal(p2.health, p2.maxHealth);
  assert.equal(p2.location, 'Coop');
  assert.equal(p2.pendingRevivalChoices, null);
  assert.equal(p2.justRevivedPendingFirstTurn, true);
});
