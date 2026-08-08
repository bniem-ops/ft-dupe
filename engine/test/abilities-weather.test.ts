import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { startTurn, endTurn, resolveProduction, advanceDay, useWeatherActionAdjustment } from '../src/turn.js';
import { forage, move, attack } from '../src/actions.js';
import { resolveCombat } from '../src/combat.js';
import { seasonCardList } from '../src/data.js';
import { GameState, Season } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withWeather(state: GameState, season: Season, cardName: string): GameState {
  const cards = seasonCardList(season.toLowerCase() as 'spring' | 'summer' | 'fall', state.config.eggspansion);
  const cardIndex = cards.findIndex((c) => c.name === cardName);
  if (cardIndex < 0) throw new Error(`Card not found: ${cardName} (${season})`);
  return { ...state, season, weather: { ...state.weather, active: { season, cardIndex } } };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Fair: bonus food on the first Forage of the turn only', () => {
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p1', { location: 'Grit Stones' }), 'Spring', 'Fair');
  const afterFirst = forage(state, 'p1');
  assert.equal(afterFirst.players.find((p) => p.id === 'p1')!.food, 2); // 1 base + 1 Fair bonus
  const afterSecond = forage(afterFirst, 'p1');
  assert.equal(afterSecond.players.find((p) => p.id === 'p1')!.food, 3); // no repeat bonus
});

test('Nighttime: -1 action, applied on whichever turn the player chooses (not automatic), once per phase', () => {
  const state = withWeather(createGame(baseConfig()), 'Spring', 'Nighttime');
  const started = startTurn(state);
  assert.equal(started.actionsRemainingThisTurn, 2); // not auto-applied at turn start
  const applied = useWeatherActionAdjustment(started, 'p1');
  assert.equal(applied.actionsRemainingThisTurn, 1);
  assert.equal(applied.players.find((p) => p.id === 'p1')!.weatherAdjustmentUsedThisPhase, true);
  assert.throws(() => useWeatherActionAdjustment(applied, 'p1')); // already used this phase
});

test('Nighttime: a chicken immune to it (Stargazer) cannot use the weather action adjustment', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Beowing' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = withWeather(createGame(config), 'Spring', 'Nighttime');
  const started = startTurn(state);
  assert.throws(() => useWeatherActionAdjustment(started, 'p1'));
});

test('Drought: Forage costs 2 actions', () => {
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p1', { location: 'Grit Stones' }), 'Spring', 'Drought');
  const result = forage(state, 'p1');
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn - 2);
  const poor = { ...state, actionsRemainingThisTurn: 1 };
  assert.throws(() => forage(poor, 'p1'));
});

test('Pollen: cannot Fight Grubs', () => {
  // p2 (Wingston Coophill) — p1 (Shellock Holmes) is immune to Pollen via
  // Naturalist, which is covered separately below.
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p2', { food: 5, location: 'Coop' }), 'Spring', 'Pollen');
  const asP2 = { ...state, currentPlayerIndex: 1 };
  assert.throws(() => attack(asP2, 'p2', 'grub', 'inside', 1));
});

test('Pollen: Naturalist grants immunity, so Fighting Grubs is still allowed', () => {
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Coop' }), 'Spring', 'Pollen');
  const result = attack(state, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 4);
});

test('Sunny: +1 action, applied on whichever turn the player chooses (not automatic), once per phase', () => {
  const state = withWeather(createGame(baseConfig()), 'Summer', 'Sunny');
  const started = startTurn(state);
  assert.equal(started.actionsRemainingThisTurn, 2); // not auto-applied at turn start
  const applied = useWeatherActionAdjustment(started, 'p1');
  assert.equal(applied.actionsRemainingThisTurn, 3);
  assert.throws(() => useWeatherActionAdjustment(applied, 'p1')); // already used this phase
});

test('Lightning Storm: ending your turn Outside can cost 1 health on a 1-2 roll', () => {
  const outside = withPlayer(withWeather(createGame(baseConfig()), 'Summer', 'Lightning Storm'), 'p1', { location: 'Grit Stones' });
  const hitConfig = { ...outside.config, rng: constantRng(0) }; // roll 1
  const hit = endTurn({ ...outside, config: hitConfig });
  assert.equal(hit.players.find((p) => p.id === 'p1')!.health, outside.players.find((p) => p.id === 'p1')!.health - 1);

  const missConfig = { ...outside.config, rng: constantRng(0.999) }; // roll 6
  const miss = endTurn({ ...outside, config: missConfig });
  assert.equal(miss.players.find((p) => p.id === 'p1')!.health, outside.players.find((p) => p.id === 'p1')!.health);
});

test('Flash Flood: all food discarded at the outgoing phase boundary', () => {
  let state = withWeather(createGame(baseConfig()), 'Summer', 'Flash Flood');
  state = withPlayer(state, 'p1', { food: 5 });
  state = { ...state, day: 5, phase: 2 }; // day 6 is a phase boundary
  const next = advanceDay(state, { discardSide: 'inside' });
  assert.equal(next.players.find((p) => p.id === 'p1')!.food, 0);
});

test('Tornado: at turn start, roll 1-2 takes 1 less action', () => {
  const state = withWeather(createGame(baseConfig()), 'Summer', 'Tornado');
  const hit = startTurn({ ...state, config: { ...state.config, rng: constantRng(0) } });
  assert.equal(hit.actionsRemainingThisTurn, 1);
  const miss = startTurn({ ...state, config: { ...state.config, rng: constantRng(0.999) } });
  assert.equal(miss.actionsRemainingThisTurn, 2);
});

test('Pouring Rain: skips the outgoing phase boundary Egg Exchange', () => {
  let state = withWeather(createGame(baseConfig()), 'Summer', 'Pouring Rain');
  state = withPlayer(state, 'p1', { eggs: 3, food: 0 });
  state = { ...state, day: 5, phase: 2 };
  const next = advanceDay(state, { discardSide: 'inside', exchanges: [{ playerId: 'p1', amount: 2 }] });
  const p1 = next.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 3); // exchange skipped
  assert.equal(p1.food, 0);
});

test('Heat Wave: cannot move into the Coop', () => {
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p1', { location: 'Grit Stones' }), 'Summer', 'Heat Wave');
  assert.throws(() => move(state, 'p1', 'Coop'));
  const ok = move(state, 'p1', 'Golden Gables');
  assert.equal(ok.players.find((p) => p.id === 'p1')!.location, 'Golden Gables');
});

test('Snow: bonus 3 food for participating in the outgoing phase boundary Egg Exchange', () => {
  let state = withWeather(createGame(baseConfig()), 'Fall', 'Snow');
  state = withPlayer(state, 'p1', { eggs: 2, food: 0 });
  state = { ...state, day: 5, phase: 2 };
  const next = advanceDay(state, { discardSide: 'inside', exchanges: [{ playerId: 'p1', amount: 2 }] });
  const p1 = next.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 0);
  assert.equal(p1.food, 2 + 3); // 1:1 exchange + Snow's bonus
});

test('Hail: -1 health every time you end your turn Outside, no roll needed', () => {
  const state = withPlayer(withWeather(createGame(baseConfig()), 'Fall', 'Hail'), 'p1', { location: 'Grit Stones' });
  const next = endTurn(state);
  assert.equal(next.players.find((p) => p.id === 'p1')!.health, state.players.find((p) => p.id === 'p1')!.health - 1);
});

test('Daylight Savings: Egg Production rolls require 4-6 regardless of the chicken\'s printed threshold', () => {
  const state = withWeather(createGame(baseConfig()), 'Fall', 'Daylight Savings');
  const leveled = { ...state.players[0], stage: 2 as const }; // Shellock Holmes S2 printed threshold is 3-6
  const roll3 = resolveProduction(state, leveled, constantRng(2 / 6)); // die roll 3 -> below Daylight Savings' 4
  assert.equal(roll3.eggs, leveled.eggs);
  const roll4 = resolveProduction(state, leveled, constantRng(3 / 6)); // die roll 4 -> meets it
  assert.equal(roll4.eggs, leveled.eggs + 1);
});

test('Severe Wind: discards a food or egg when ending your turn Outside', () => {
  const state = withPlayer(withWeather(createGame(baseConfig()), 'Fall', 'Severe Wind'), 'p1', {
    location: 'Grit Stones',
    food: 3,
    eggs: 0,
  });
  const next = endTurn(state);
  const p1 = next.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.food, 2); // defaults to discarding food when available
});

test('Fog: attacks miss (no return damage) on a 1-2 roll', () => {
  const state = withWeather(createGame(baseConfig()), 'Fall', 'Fog');
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const missConfig = { ...state.config, rng: constantRng(0) }; // roll 1 -> Fog triggers a miss
  const missed = resolveCombat({ ...state, config: missConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  const p1After = missed.players.find((p) => p.id === 'p1')!;
  assert.equal(p1After.health, state.players[0].health); // no return damage taken
  assert.equal(missed.predators.find((p) => p.name === 'Eggsmeralda')!.health, eggsmeralda.health - 1); // attack still lands
});

test('Dust Storm: max attack strength is reduced by 1', () => {
  const state = withWeather(withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' }), 'Fall', 'Dust Storm');
  // Shellock Holmes Chick attackStrength is 1; Dust Storm should reduce the cap to 0.
  assert.throws(() => attack(state, 'p1', 'predator', 'Eggsmeralda', 1));
});

test('Earthquake (Eggspansion): discards and redraws a held Bonus Card at turn start', () => {
  const config = baseConfig({ eggspansion: true });
  let state = withWeather(createGame(config), 'Fall', 'Earthquake');
  const heldCardId = state.bonusDeck.drawPile[0];
  state = withPlayer(state, 'p1', { bonusCardHand: [heldCardId] });
  // Actually remove it from the shared pile — it's "held", not still sitting
  // in the draw pile too — otherwise the redraw could trivially re-deal the
  // same card and this test wouldn't prove anything.
  state = { ...state, bonusDeck: { ...state.bonusDeck, drawPile: state.bonusDeck.drawPile.slice(1) } };
  const drawPileBefore = state.bonusDeck.drawPile.length;
  const next = startTurn(state);
  const p1 = next.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.bonusCardHand.length, 1);
  assert.notEqual(p1.bonusCardHand[0], state.players.find((pp) => pp.id === 'p1')!.bonusCardHand[0]);
  assert.equal(next.bonusDeck.discard.length, 1);
  assert.equal(next.bonusDeck.drawPile.length, drawPileBefore - 1);
});
