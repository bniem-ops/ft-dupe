// Phase 11f: roll interception — Strategem, Deus Eggs Machina, "Reroll a
// teammate's/any die" Bonus Cards, Spotted Lanternfly. Originally wired to
// only 4 sites (layEgg, forage, resolveProduction, the standard predator-
// effect roll) — widened later to cover every attributable die roll in
// the engine (custom predator-effect rolls, Grub defend rolls, weather
// turn-start/turn-end rolls, chicken on-attack/on-damage rolls, Chickira's
// free redraw roll, Ladybug's roll, Gravekeeper Fowl's revival roll).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveProduction, startTurn } from '../src/turn.js';
import { resolveCombat } from '../src/combat.js';
import {
  useStrategem,
  useDeusEggsMachina,
  playBonusCard,
  useGrubReward,
  attack,
  useWhereverAnyWeather,
  useArrowPack,
} from '../src/actions.js';
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

// --- Widened coverage: every attributable roll in the engine, not just the original 4 ---

test('Weasma and Clawnk: a pending intercept can push the custom predator-effect trigger roll below its threshold', () => {
  const config = baseConfig({
    eggspansion: true,
    predators: { regular: ['Weasma and Clawnk', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const wac = state.predators.find((p) => p.name === 'Weasma and Clawnk')!;
  const s = withPlayer(state, 'p1', {
    food: 5,
    location: wac.location,
    health: 10,
    maxHealth: 10,
    pendingRollIntercept: { mode: 'adjustBy', value: -3 },
  });
  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.999 } }; // rollDie -> 6, -3 = 3, below the S1 "4+" trigger

  const result = resolveCombat(rolledSix, 'p1', 'predator', 'Weasma and Clawnk', 3);
  assert.equal(result.players.find((p) => p.id === 'p1')!.pendingForcedRelocation, false); // trigger avoided
});

test('Coopella: a pending intercept clears via attack()\'s post-combat cleanup, same as the original wired sites', () => {
  const config = baseConfig({ predators: { regular: ['Coopella', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const coopella = state.predators.find((p) => p.name === 'Coopella')!;
  const s = withPlayer(state, 'p1', {
    food: 5,
    location: coopella.location,
    pendingRollIntercept: { mode: 'forceValue', value: 1 }, // 1 is a no-op outcome for Coopella's roll
  });
  const result = attack(s, 'p1', 'predator', 'Coopella', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.pendingRollIntercept, null);
});

test('Grub defend roll respects a pending intercept', () => {
  const state = createGame(baseConfig());
  const scorpionId = loadGrubCards().findIndex((c) => c.name === 'Scorpion'); // "1-2: Lose 1 health", miss otherwise
  const withGrub: GameState = {
    ...state,
    grubDecks: { ...state.grubDecks, inside: { ...state.grubDecks.inside, faceUp: { cardId: scorpionId, currentHealth: 3, rewardUsed: false } } },
  };
  const base = withPlayer(withGrub, 'p1', { food: 5, location: 'Coop', health: 10, maxHealth: 10 });
  const highRollConfig = { ...base.config, rng: () => 0.999 }; // rollDie -> 6, misses the 1-2 outcome on its own

  const withIntercept = withPlayer(base, 'p1', { pendingRollIntercept: { mode: 'forceValue', value: 1 } });
  const result = resolveCombat({ ...withIntercept, config: highRollConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, 9); // forced into the 1-2 outcome despite the high roll
});

test("Tornado: a pending intercept affects the turn-start action-loss roll, then clears", () => {
  const config = baseConfig({ eggspansion: false });
  const state = createGame(config);
  const tornadoIndex = 3; // Sunny(0), Lightning Storm(1), Flash Flood(2), Tornado(3)
  const s: GameState = {
    ...withPlayer(state, 'p1', { pendingRollIntercept: { mode: 'forceValue', value: 6 } }), // 6 avoids Tornado's 1-2 trigger
    season: 'Summer',
    weather: { ...state.weather, active: { season: 'Summer', cardIndex: tornadoIndex } },
    config: { ...state.config, rng: () => 0 }, // rollDie -> 1, would normally trigger -1 action
  };
  const started = startTurn(s);
  assert.equal(started.actionsRemainingThisTurn, 2); // trigger avoided thanks to the intercept
  assert.equal(started.players.find((p) => p.id === 'p1')!.pendingRollIntercept, null); // consumed either way
});

test("Chickira's Wherever Any Weather: a pending intercept affects the free roll, then clears", () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Chickira' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const s = withPlayer(state, 'p1', { stage: 2, pendingRollIntercept: { mode: 'forceValue', value: 6 } });
  const lowRollConfig = { ...s.config, rng: () => 0 }; // rollDie -> 1, would normally miss (needs 4+)
  const result = useWhereverAnyWeather({ ...s, config: lowRollConfig }, 'p1');
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.freeAbilityUsedThisTurn, true);
  assert.equal(p1.pendingRollIntercept, null); // consumed
  // forceValue=6 clears the "4+" bar the raw roll of 1 wouldn't have — the
  // weather card actually redrawing is already covered elsewhere; this
  // test is specifically about the intercept applying and clearing.
});

test("Gravekeeper Fowl's revival roll respects a pending intercept even via Arrow Pack, which bypasses attack()'s cleanup entirely", () => {
  const config = baseConfig({
    players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Wingston Coophill' }],
    predators: { regular: ['Gravekeeper Fowl', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const gkf = state.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  let s = withPlayer(state, 'p1', {
    food: 5,
    lootDrops: ['Cleopoultra'],
    lootCharges: { Cleopoultra: 1 },
    pendingRollIntercept: { mode: 'forceValue', value: 5 }, // Gravekeeper Fowl's threshold is 5
  });
  s = { ...s, predators: s.predators.map((p) => (p.name === 'Gravekeeper Fowl' ? { ...p, health: 1 } : p)) };
  const lowRollConfig = { ...s.config, rng: () => 0 }; // rollDie -> 1, would normally miss the revival threshold

  const result = useArrowPack({ ...s, config: lowRollConfig }, 'p1', 'predator', gkf.name);
  const revived = result.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  assert.equal(revived.defeated, false); // forced revival via the intercept, despite the low roll
  assert.equal(revived.health, 1); // stage 1's onDefeatRevive health
  // Critical: Arrow Pack never calls attack(), so nothing clears the flag
  // automatically the way it does for a normal Attack — this must be
  // cleared explicitly at the revival-roll site itself, or it would leak
  // and silently double-apply to whatever roll comes next.
  assert.equal(result.players.find((p) => p.id === 'p1')!.pendingRollIntercept, null);
});
