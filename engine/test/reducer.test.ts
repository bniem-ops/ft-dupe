import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { applyAction } from '../src/reducer.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

test('applyAction dispatches to the right handler and appends to the action log', () => {
  const state = createGame(baseConfig());
  const outside = withPlayer(state, 'p1', { location: 'Golden Gables' });
  const action = { type: 'forage' as const, playerId: 'p1' };
  const result = applyAction(outside, action);

  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 1);
  assert.equal(result.actionLog.length, 1);
  assert.deepEqual(result.actionLog[0], action);
});

test('applyAction chains correctly across multiple actions', () => {
  const state = createGame(baseConfig());
  const outside = withPlayer(state, 'p1', { location: 'Golden Gables' });
  let result = applyAction(outside, { type: 'forage', playerId: 'p1' });
  result = applyAction(result, { type: 'forage', playerId: 'p1' });
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 2);
  assert.equal(result.actionLog.length, 2);
});
