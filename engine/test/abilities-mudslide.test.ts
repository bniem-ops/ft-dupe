// Mudslide (Eggspansion, Summer): "Shuffle the rest of the Summer deck.
// Deal each player a personal Weather Card. That weather is in effect for
// them until Mudslide is replaced." Formerly flagged 11k/deferred — see
// docs/engine-plan.md's phase 11 closing note for the design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { drawNextWeatherCard, activeWeatherName, activeWeatherEffect } from '../src/abilities/weather.js';
import { advanceDay } from '../src/turn.js';
import { resolveCombat } from '../src/combat.js';
import { seasonCardList } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

function summerIndex(state: GameState, name: string): number {
  const idx = seasonCardList('summer', state.config.eggspansion).findIndex((c) => c.name === name);
  if (idx < 0) throw new Error(`Card not found: ${name}`);
  return idx;
}

test('Mudslide: drawing it deals each alive player a personal card from the rest of the Summer deck', () => {
  const state = createGame(baseConfig({ eggspansion: true }));
  const mudslide = summerIndex(state, 'Mudslide');
  const rest = [0, 1, 2, 3, 4, 5].filter((i) => i !== mudslide);
  const withDeck: GameState = { ...state, weather: { ...state.weather, active: null, seasonDecks: { ...state.weather.seasonDecks, Summer: [mudslide, ...rest] } } };

  const result = drawNextWeatherCard(withDeck, 'Summer');

  assert.deepEqual(result.weather.active, { season: 'Summer', cardIndex: mudslide });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  const p2 = result.players.find((p) => p.id === 'p2')!;
  assert.equal(p1.personalWeatherOverride?.season, 'Summer');
  assert.ok(rest.includes(p1.personalWeatherOverride!.cardIndex));
  assert.ok(rest.includes(p2.personalWeatherOverride!.cardIndex));
  // Both dealt cards came out of the deck, same as a real draw would deplete it.
  assert.equal(result.weather.seasonDecks.Summer.length, rest.length - 2);
});

test('Mudslide: a player with a personal override resolves THEIR card, not the shared Mudslide card', () => {
  const state = createGame(baseConfig({ eggspansion: true }));
  const mudslide = summerIndex(state, 'Mudslide');
  const sunny = summerIndex(state, 'Sunny');
  const lightning = summerIndex(state, 'Lightning Storm');
  let s: GameState = { ...state, weather: { ...state.weather, active: { season: 'Summer', cardIndex: mudslide } } };
  s = withPlayer(s, 'p1', { personalWeatherOverride: { season: 'Summer', cardIndex: sunny } });
  s = withPlayer(s, 'p2', { personalWeatherOverride: { season: 'Summer', cardIndex: lightning } });

  assert.equal(activeWeatherName(s, 'p1'), 'Sunny');
  assert.equal(activeWeatherName(s, 'p2'), 'Lightning Storm');
  assert.equal(activeWeatherEffect(s, 'p1')?.turnStartOncePerPhase, true);
  // No playerId (or a player with no override) still reads the shared card.
  assert.equal(activeWeatherName(s), 'Mudslide');
});

test('Mudslide: replacing it clears every player\'s personal override', () => {
  const state = createGame(baseConfig({ eggspansion: true }));
  const mudslide = summerIndex(state, 'Mudslide');
  const sunny = summerIndex(state, 'Sunny');
  let s: GameState = {
    ...state,
    weather: { ...state.weather, active: { season: 'Summer', cardIndex: mudslide }, seasonDecks: { ...state.weather.seasonDecks, Summer: [2] } },
  };
  s = withPlayer(s, 'p1', { personalWeatherOverride: { season: 'Summer', cardIndex: sunny } });
  s = withPlayer(s, 'p2', { personalWeatherOverride: { season: 'Summer', cardIndex: sunny } });

  const next = drawNextWeatherCard(s, 'Summer');

  assert.notEqual(next.weather.active?.cardIndex, mudslide);
  assert.equal(next.players.find((p) => p.id === 'p1')!.personalWeatherOverride, null);
  assert.equal(next.players.find((p) => p.id === 'p2')!.personalWeatherOverride, null);
});

test("Mudslide: Owl Coopone's weather-conditional bonus resolves per-attacker, not table-wide", () => {
  const config = baseConfig({
    eggspansion: true,
    predators: { regular: ['Sal Moe Nella', 'Professor Moltiarty', 'Owl Coopone'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const owl = state.predators.find((p) => p.name === 'Owl Coopone')!;
  const mudslide = summerIndex(state, 'Mudslide');
  const sunny = summerIndex(state, 'Sunny');
  const lightning = summerIndex(state, 'Lightning Storm');

  let s: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Owl Coopone' ? { ...p, stage: 2, health: p.maxHealth - 3 } : p)),
    weather: { ...state.weather, active: { season: 'Summer', cardIndex: mudslide } },
  };
  s = withPlayer(s, 'p1', { food: 5, location: owl.location, health: 20, maxHealth: 20, personalWeatherOverride: { season: 'Summer', cardIndex: sunny } });
  s = withPlayer(s, 'p2', { food: 5, location: owl.location, health: 20, maxHealth: 20, personalWeatherOverride: { season: 'Summer', cardIndex: lightning } });

  const healthAfterP1 = resolveCombat(s, 'p1', 'predator', 'Owl Coopone', 1).predators.find((p) => p.name === 'Owl Coopone')!.health;
  const healthAfterP2 = resolveCombat(s, 'p2', 'predator', 'Owl Coopone', 1).predators.find((p) => p.name === 'Owl Coopone')!.health;

  assert.equal(healthAfterP1, healthAfterP2 + 3); // p1's personal Sunny triggers the +3 self-heal; p2's Lightning Storm doesn't
});

test('Mudslide: a personal Flash Flood only discards that player\'s food at the phase boundary', () => {
  const config = baseConfig({ eggspansion: true });
  const state = createGame(config);
  const mudslide = summerIndex(state, 'Mudslide');
  const flashFlood = summerIndex(state, 'Flash Flood');
  let s: GameState = {
    ...state,
    day: 5,
    phase: 2,
    season: 'Summer',
    weather: { ...state.weather, active: { season: 'Summer', cardIndex: mudslide } },
  };
  s = withPlayer(s, 'p1', { food: 5, personalWeatherOverride: { season: 'Summer', cardIndex: flashFlood } });
  s = withPlayer(s, 'p2', { food: 5, personalWeatherOverride: null }); // still personally "seeing" Mudslide itself (no onPhaseEnd effect)

  const next = advanceDay(s, { discardSide: 'inside' }); // day 6 is a phase boundary

  const p1 = next.players.find((p) => p.id === 'p1')!;
  const p2 = next.players.find((p) => p.id === 'p2')!;
  assert.equal(p1.food, 0); // hit by their personal Flash Flood
  assert.equal(p2.food, 5); // untouched — Mudslide itself has no onPhaseEnd effect
});
