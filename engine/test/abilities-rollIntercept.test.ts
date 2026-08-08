// Phase 11f: roll interception — Strategem, Deus Eggs Machina, "Reroll a
// teammate's/any die" Bonus Cards, Spotted Lanternfly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveProduction } from '../src/turn.js';
import { useStrategem, useDeusEggsMachina, playBonusCard, useGrubReward } from '../src/actions.js';
import { loadBonusCards, loadGrubCards } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Strategem: spending eggs adjusts a target roll, turning a miss into a hit', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'General Tso' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const p1 = withPlayer(state, 'p1', { stage: 3, eggs: 2 });
  const p2 = withPlayer(p1, 'p2', { stage: 2 }); // needs a 3+ to hit

  const cast = useStrategem(p2, 'p1', 'p2', 1, 1); // +1 to p2's next roll
  assert.equal(cast.players.find((p) => p.id === 'p1')!.eggs, 1);
  assert.deepEqual(cast.players.find((p) => p.id === 'p2')!.pendingRollIntercept, { mode: 'adjustBy', value: 1 });

  const rollsTwo = { ...cast, config: { ...cast.config, rng: constantRng(0.2) } }; // rollDie -> 2, +1 = 3, hits
  const result = resolveProduction(rollsTwo, rollsTwo.players.find((p) => p.id === 'p2')!, rollsTwo.config.rng);
  assert.equal(result.eggs, 1);
  assert.equal(result.pendingRollIntercept, null);

  assert.throws(() => useStrategem(p2, 'p2', 'p2', 1, 1)); // p2 has no such ability
});

test('Deus Eggs Machina: pay 1 egg to force a reroll on a target\'s next roll', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'J.R.R. Yolkien' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const p1 = withPlayer(state, 'p1', { stage: 3, eggs: 1 });
  const p2 = withPlayer(p1, 'p2', { stage: 2 });

  const cast = useDeusEggsMachina(p2, 'p1', 'p2');
  assert.equal(cast.players.find((p) => p.id === 'p1')!.eggs, 0);
  assert.deepEqual(cast.players.find((p) => p.id === 'p2')!.pendingRollIntercept, { mode: 'reroll' });
  assert.throws(() => useDeusEggsMachina(cast, 'p1', 'p2')); // no eggs left
});

test('"Reroll any die" Bonus Card sets the chosen target\'s pendingRollIntercept', () => {
  const state = createGame(baseConfig());
  const cardIndex = loadBonusCards().findIndex((c) => c.shorthand === 'Reroll any die');
  const s = withPlayer(state, 'p1', { bonusCardHand: [cardIndex] });
  const result = playBonusCard(s, 'p1', 0, { targetPlayerId: 'p2' });
  assert.deepEqual(result.players.find((p) => p.id === 'p2')!.pendingRollIntercept, { mode: 'reroll' });
});

test('Spotted Lanternfly: forces an exact roll outcome on the chosen target', () => {
  const state = createGame(baseConfig());
  const cardIndex = loadGrubCards().findIndex((c) => c.name === 'Spotted Lanternfly');
  const s = withPlayer(state, 'p1', { grubHand: [{ cardId: cardIndex, currentHealth: 1, rewardUsed: false }] });
  const result = useGrubReward(s, 'p1', 0, { targetPlayerId: 'p2', amount: 6 });
  assert.deepEqual(result.players.find((p) => p.id === 'p2')!.pendingRollIntercept, { mode: 'forceValue', value: 6 });
});
