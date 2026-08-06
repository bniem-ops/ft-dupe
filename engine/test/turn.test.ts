import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import {
  seasonPhaseForDay,
  isPhaseBoundaryDay,
  resolveProduction,
  startTurn,
  endTurn,
  isLastPlayerOfDay,
  useExtraActionToken,
  applyEggExchange,
  advanceDay,
} from '../src/turn.js';
import { GameState } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

test('seasonPhaseForDay matches the confirmed 2/3/2 split', () => {
  assert.equal(seasonPhaseForDay(1), 1);
  assert.equal(seasonPhaseForDay(2), 1);
  assert.equal(seasonPhaseForDay(3), 2);
  assert.equal(seasonPhaseForDay(5), 2);
  assert.equal(seasonPhaseForDay(6), 3);
  assert.equal(seasonPhaseForDay(7), 3);
});

test('isPhaseBoundaryDay is true for days 1(non-Spring)/3/6, false for Spring day 1', () => {
  assert.equal(isPhaseBoundaryDay(1, 'Spring'), false);
  assert.equal(isPhaseBoundaryDay(1, 'Summer'), true);
  assert.equal(isPhaseBoundaryDay(1, 'Fall'), true);
  assert.equal(isPhaseBoundaryDay(3, 'Spring'), true);
  assert.equal(isPhaseBoundaryDay(6, 'Fall'), true);
  assert.equal(isPhaseBoundaryDay(2, 'Spring'), false);
});

test('resolveProduction: Chick always gains 1 food, no roll', () => {
  const state = createGame(baseConfig());
  const chick = state.players[0];
  const updated = resolveProduction(state, chick, constantRng(0));
  assert.equal(updated.food, chick.food + 1);
  assert.equal(updated.eggs, chick.eggs);
});

test('resolveProduction: leveled-up chicken gains an egg only on a high enough roll', () => {
  const state = createGame(baseConfig());
  const leveled = { ...state.players[0], stage: 2 as const }; // Shellock Holmes S2: "Roll 1 die: 3-6 = +1 egg"
  const missed = resolveProduction(state, leveled, constantRng(0)); // roll 1 -> below threshold
  assert.equal(missed.eggs, leveled.eggs);
  const hit = resolveProduction(state, leveled, constantRng(0.999)); // roll 6 -> meets threshold
  assert.equal(hit.eggs, leveled.eggs + 1);
});

test('startTurn applies production and grants 2 actions', () => {
  // No active weather card — isolates this from phase 6's turn-start
  // weather effects (Nighttime/Sunny/Tornado/Earthquake), covered in
  // abilities-weather.test.ts.
  const state: GameState = { ...createGame(baseConfig()), weather: { seasonDecks: { Spring: [], Summer: [], Fall: [] }, active: null } };
  const started = startTurn(state);
  assert.equal(started.actionsRemainingThisTurn, 2);
  const p1 = started.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.food, 1); // Chick production
});

test('startTurn skips a turn (0 actions, no production) when skipNextTurn is set', () => {
  const state = createGame(baseConfig());
  const withSkip = {
    ...state,
    players: state.players.map((p) => (p.id === 'p1' ? { ...p, skipNextTurn: true } : p)),
  };
  const started = startTurn(withSkip);
  assert.equal(started.actionsRemainingThisTurn, 0);
  const p1 = started.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.skipNextTurn, false);
  assert.equal(p1.food, 0); // no production applied
});

test('endTurn cycles players and wraps around', () => {
  const state = createGame(baseConfig());
  assert.equal(state.currentPlayerIndex, 0);
  const afterFirst = endTurn(state);
  assert.equal(afterFirst.currentPlayerIndex, 1);
  assert.equal(isLastPlayerOfDay(afterFirst), true);
  const afterSecond = endTurn(afterFirst);
  assert.equal(afterSecond.currentPlayerIndex, 0);
});

test('useExtraActionToken grants +1 action and can only be used once per season', () => {
  const state = createGame(baseConfig());
  const boosted = useExtraActionToken(state, 'p1');
  assert.equal(boosted.actionsRemainingThisTurn, state.actionsRemainingThisTurn + 1);
  assert.equal(boosted.players.find((p) => p.id === 'p1')!.extraActionTokenAvailable, false);
  assert.throws(() => useExtraActionToken(boosted, 'p1'));
});

test('applyEggExchange trades eggs 1:1 for food and rejects over-spending', () => {
  const state = createGame(baseConfig());
  const withEggs = { ...state.players[0], eggs: 3, food: 1 };
  const traded = applyEggExchange(withEggs, 2);
  assert.equal(traded.eggs, 1);
  assert.equal(traded.food, 3);
  assert.throws(() => applyEggExchange(withEggs, 10));
});

test('advanceDay handles the daily Grub discard and redeal', () => {
  const state = createGame(baseConfig());
  const insideFaceUpBefore = state.grubDecks.inside.faceUp!.cardId;
  const next = advanceDay(state, { discardSide: 'inside' });
  assert.ok(next.grubDecks.inside.discard.includes(insideFaceUpBefore));
  assert.notEqual(next.grubDecks.inside.faceUp?.cardId, insideFaceUpBefore);
  assert.equal(next.grubDecks.inside.drawPile.length, state.grubDecks.inside.drawPile.length - 1);
  // untouched side is unaffected
  assert.deepEqual(next.grubDecks.outside, state.grubDecks.outside);
});

test('advanceDay crosses a phase boundary: applies Egg Exchange and draws new weather', () => {
  const state = createGame(baseConfig());
  const day2 = advanceDay(state, { discardSide: 'inside' }); // day 1 -> 2, not a boundary
  assert.equal(day2.day, 2);
  assert.deepEqual(day2.weather.active, state.weather.active);

  const withEggs = { ...day2, players: day2.players.map((p) => (p.id === 'p1' ? { ...p, eggs: 2 } : p)) };
  const day3 = advanceDay(withEggs, { discardSide: 'inside', exchanges: [{ playerId: 'p1', amount: 2 }] });
  assert.equal(day3.day, 3);
  assert.equal(day3.phase, 2);
  assert.notDeepEqual(day3.weather.active, state.weather.active); // new card drawn
  const p1 = day3.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 0);
  assert.equal(p1.food, 2);
});

test('advanceDay rolls Spring day 7 into Summer day 1, refreshing Extra Action Tokens and drawing weather', () => {
  let state = createGame(baseConfig());
  state = { ...state, players: state.players.map((p) => ({ ...p, extraActionTokenAvailable: false })) };
  state = { ...state, day: 7, season: 'Spring', phase: 3 };
  const next = advanceDay(state, { discardSide: 'inside' });
  assert.equal(next.day, 1);
  assert.equal(next.season, 'Summer');
  assert.equal(next.phase, 1);
  assert.ok(next.players.every((p) => p.extraActionTokenAvailable));
  assert.equal(next.weather.active?.season, 'Summer');

  // Every surviving Predator levels up at end of Spring (core_rules.md).
  const eggsmeralda = next.predators.find((p) => p.name === 'Eggsmeralda')!; // stage1 x2 -> stage2 x3
  assert.equal(eggsmeralda.stage, 2);
  assert.equal(eggsmeralda.maxHealth, 6); // x3 * 2 players, no prior damage
  assert.equal(eggsmeralda.health, 6);
});

test('advanceDay ends the game after Fall day 7 as a loss (Predators still alive)', () => {
  let state = createGame(baseConfig());
  state = { ...state, day: 7, season: 'Fall', phase: 3 };
  const next = advanceDay(state, { discardSide: 'outside' });
  assert.equal(next.gameOver, true);
  assert.equal(next.won, false);
});
