// Dice-roll transparency (docs/playtest-feedback.md-style ask: "let me see
// what I rolled"): every roll made while resolving an Attack — a Predator's
// own effect roll (both the plain roll-table shape and the bespoke `custom`
// shape), a Grub's defend roll, and Fog's dodge roll — should show up as a
// CombatRollLogEntry in actionLog. See combat.ts's resolveCombat/
// defaultTargetEffect and types.ts's CombatRollLogEntry doc comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { loadGrubCards, seasonCardList } from '../src/data.js';
import { CombatRollLogEntry, GameState, Season } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withGrub(state: GameState, name: string, currentHealth?: number): GameState {
  const cardId = loadGrubCards().findIndex((c) => c.name === name);
  if (cardId < 0) throw new Error(`Grub not found: ${name}`);
  const health = currentHealth ?? parseInt(loadGrubCards()[cardId]?.health ?? '0', 10);
  return {
    ...state,
    grubDecks: { ...state.grubDecks, inside: { ...state.grubDecks.inside, faceUp: { cardId, currentHealth: health, rewardUsed: false } } },
  };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

function withWeather(state: GameState, season: Season, cardName: string): GameState {
  const cards = seasonCardList(season.toLowerCase() as 'spring' | 'summer' | 'fall', state.config.eggspansion);
  const cardIndex = cards.findIndex((c) => c.name === cardName);
  if (cardIndex < 0) throw new Error(`Card not found: ${cardName} (${season})`);
  return { ...state, season, weather: { ...state.weather, active: { season, cardIndex } } };
}

function combatRollEntries(state: GameState): CombatRollLogEntry[] {
  return state.actionLog.filter((e): e is CombatRollLogEntry => e.type === 'combatRoll');
}

test('logs a Predator effect roll (plain roll-table shape)', () => {
  const state = createGame(baseConfig());
  // Eggsmeralda stage 1: "4-6: heals 1 health."
  const hit = resolveCombat({ ...state, config: { ...state.config, rng: constantRng(0.999) } }, 'p1', 'predator', 'Eggsmeralda', 1); // roll 6
  const [entry] = combatRollEntries(hit);
  assert.ok(entry);
  assert.equal(entry.kind, 'predatorEffect');
  assert.equal(entry.roll, 6);
  assert.equal(entry.triggered, true);
  assert.equal(entry.targetType, 'predator');
  assert.equal(entry.targetName, 'Eggsmeralda');
  assert.match(entry.effectText ?? '', /heals 1 health/i);

  const miss = resolveCombat({ ...state, config: { ...state.config, rng: constantRng(0) } }, 'p1', 'predator', 'Eggsmeralda', 1); // roll 1
  const [missEntry] = combatRollEntries(miss);
  assert.equal(missEntry.roll, 1);
  assert.equal(missEntry.triggered, false);
});

test('logs a Predator effect roll (bespoke `custom` shape)', () => {
  const state = createGame(
    baseConfig({ predators: { regular: ['Weasma and Clawnk', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } }),
  );
  // Stage 1: roll >= 4 forces the attacker out before combat resolves.
  const result = resolveCombat(
    { ...state, config: { ...state.config, rng: constantRng(0.999) } },
    'p1',
    'predator',
    'Weasma and Clawnk',
    1,
  ); // roll 6
  const [entry] = combatRollEntries(result);
  assert.ok(entry);
  assert.equal(entry.kind, 'predatorEffect');
  assert.equal(entry.roll, 6);
  assert.equal(entry.triggered, true);
  assert.equal(entry.targetName, 'Weasma and Clawnk');
});

test('logs a Grub defend roll', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Scorpion', 3), 'p1', { food: 5, location: 'Coop' });
  const hit = resolveCombat({ ...base, config: { ...base.config, rng: constantRng(0) } }, 'p1', 'grub', 'inside', 1); // roll 1 -> Scorpion's own defend triggers
  const [entry] = combatRollEntries(hit);
  assert.ok(entry);
  assert.equal(entry.kind, 'grubDefend');
  assert.equal(entry.roll, 1);
  assert.equal(entry.triggered, true);
  assert.equal(entry.targetType, 'grub');
  assert.equal(entry.targetName, 'Scorpion');
  assert.ok(entry.effectText);
});

test("logs Fog's dodge roll alongside the target's own effect roll", () => {
  const state = withWeather(createGame(baseConfig()), 'Fall', 'Fog');
  const missed = resolveCombat({ ...state, config: { ...state.config, rng: constantRng(0) } }, 'p1', 'predator', 'Eggsmeralda', 1); // roll 1 for both Fog and Eggsmeralda
  const entries = combatRollEntries(missed);
  assert.equal(entries.length, 2); // Fog's own roll, plus Eggsmeralda's (unrelated) effect roll
  const fogEntry = entries.find((e) => e.kind === 'fogDodge')!;
  assert.ok(fogEntry);
  assert.equal(fogEntry.roll, 1);
  assert.equal(fogEntry.triggered, true); // 1-2 misses
  assert.equal(fogEntry.effectText, null);
});

test('no combatRoll entry when the target effect never rolls', () => {
  const state = createGame(
    baseConfig({ predators: { regular: ['Gravekeeper Fowl', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } }),
  );
  const result = resolveCombat(state, 'p1', 'predator', 'Gravekeeper Fowl', 1);
  assert.equal(combatRollEntries(result).length, 0);
});
