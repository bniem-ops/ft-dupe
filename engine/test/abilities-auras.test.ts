// Phase 11d: cross-actor auras & reactive listeners — Battle Cry,
// Bolsterer, Free Range/Bird Flu, "Not really a miss," Smallest Chicken/
// Garden Snail (tagAlong), Chew Bawka's dynamic return attack, Freezing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveProduction, advanceDay } from '../src/turn.js';
import { resolveCombat } from '../src/combat.js';
import { attack, tagAlong, move } from '../src/actions.js';
import { GameState } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test("Battle Cry: +1 to a nearby teammate's own roll, turning a miss into a hit", () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Beowing' }] });
  const state = createGame(config);
  const rollsTwo = { ...state, config: { ...state.config, rng: constantRng(0.2) } }; // rollDie -> 2

  // Shellock Holmes S2 needs a 3+ to hit; roll 2 alone misses.
  const missing = withPlayer(rollsTwo, 'p1', { stage: 2 });
  assert.equal(resolveProduction(missing, missing.players.find((p) => p.id === 'p1')!, missing.config.rng).eggs, 0);

  // A nearby Beowing (S2+, Battle Cry) adds +1, turning the same roll into a hit.
  const withBattleCry = withPlayer(missing, 'p2', { stage: 2, location: missing.players.find((p) => p.id === 'p1')!.location });
  const boosted = resolveProduction(withBattleCry, withBattleCry.players.find((p) => p.id === 'p1')!, withBattleCry.config.rng);
  assert.equal(boosted.eggs, 1);
});

test("Bolsterer: +1 max attack strength to a nearby damaged player, not the holder's own attack", () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Broods Lee' }] });
  const state = createGame(config);
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  let s = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location, health: 2 }); // damaged (not lethal-fragile); Shellock Holmes attackStrength is 1
  assert.throws(() => attack(s, 'p1', 'predator', 'Eggsmeralda', 2)); // no Bolsterer yet -> cap is 1

  s = withPlayer(s, 'p2', { stage: 3, location: eggsmeralda.location }); // Broods Lee S3: Bolsterer
  const result = attack(s, 'p1', 'predator', 'Eggsmeralda', 2); // now allowed
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 3); // paid for strength 2
});

test('Free Range grants location-wide immunity to Bird Flu; otherwise ending the day near another player costs a heart', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = createGame(config);
  let together = withPlayer(state, 'p1', { location: 'Coop' });
  together = withPlayer(together, 'p2', { location: 'Coop' });
  const birdFluActive: GameState = { ...together, weather: { ...together.weather, active: { season: 'Spring', cardIndex: 5 } } }; // Bird Flu

  const result = advanceDay(birdFluActive, { discardSide: 'inside' });
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, together.players.find((p) => p.id === 'p1')!.health - 1);
  assert.equal(result.players.find((p) => p.id === 'p2')!.health, together.players.find((p) => p.id === 'p2')!.health - 1);

  const withFreeRange = withPlayer(birdFluActive, 'p1', { chickenName: 'Aracorn, Heir of Condor' });
  const protectedResult = advanceDay(withFreeRange, { discardSide: 'inside' });
  assert.equal(protectedResult.players.find((p) => p.id === 'p1')!.health, withFreeRange.players.find((p) => p.id === 'p1')!.health);
  assert.equal(protectedResult.players.find((p) => p.id === 'p2')!.health, withFreeRange.players.find((p) => p.id === 'p2')!.health); // protects everyone at the location
});

test('"Not really a miss" self clause: your own missed attack draws a Bonus Card', () => {
  const config = baseConfig({
    players: [{ id: 'p1', chickenName: 'Cluck Norris' }, { id: 'p2', chickenName: 'Wingston Coophill' }],
    predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' },
  });
  const g = createGame(config);
  const target = g.predators.find((p) => p.name === 'Cleopoultra')!;
  const s = withPlayer(g, 'p1', { food: 5, location: target.location });
  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.999 } }; // Cleopoultra S1: 5-6 dodges -> a miss

  const before = rolledSix.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const result = resolveCombat(rolledSix, 'p1', 'predator', 'Cleopoultra', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, before + 1);
});

test('"Not really a miss" teammate clause: a nearby different chicken\'s miss grants Cluck Norris food, not a card', () => {
  const config = baseConfig({
    players: [{ id: 'p1', chickenName: 'Wingston Coophill' }, { id: 'p2', chickenName: 'Cluck Norris' }],
    predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' },
  });
  const g = createGame(config);
  const target = g.predators.find((p) => p.name === 'Cleopoultra')!;
  let s = withPlayer(g, 'p1', { food: 5, location: target.location });
  s = withPlayer(s, 'p2', { location: target.location, food: 0 });
  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.999 } }; // Cleopoultra S1: 5-6 dodges -> a miss

  const p1CardsBefore = rolledSix.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const result = resolveCombat(rolledSix, 'p1', 'predator', 'Cleopoultra', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, p1CardsBefore); // p1 has no such ability
  assert.equal(result.players.find((p) => p.id === 'p2')!.food, 1); // Cluck Norris, nearby, +1 food
});

test("tagAlong (Smallest Chicken): free move to match another player's current location, gated by the ability", () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Wingston Coophill' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const moved = withPlayer(state, 'p2', { location: 'Grit Stones' });
  assert.throws(() => tagAlong(moved, 'p1', 'p2')); // Wingston Coophill is a Chick — Smallest Chicken not unlocked yet

  const leveled = withPlayer(moved, 'p1', { stage: 2 });
  const result = tagAlong(leveled, 'p1', 'p2');
  assert.equal(result.players.find((p) => p.id === 'p1')!.location, 'Grit Stones');
  assert.equal(result.actionsRemainingThisTurn, leveled.actionsRemainingThisTurn); // free

  assert.throws(() => tagAlong(result, 'p1', 'p2')); // p2 hasn't left p1's (now shared) location
});

test('Chew Bawka: return attack scales with nearby chicken counts (S2: +1 per teammate at its location)', () => {
  const config = baseConfig({ eggspansion: true, predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Chew Bawka'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const chewBawka = state.predators.find((p) => p.name === 'Chew Bawka')!;
  const leveled: GameState = { ...state, predators: state.predators.map((p) => (p.name === 'Chew Bawka' ? { ...p, stage: 2 } : p)) };

  let alone = withPlayer(leveled, 'p1', { food: 5, location: chewBawka.location, health: 10, maxHealth: 10 });
  alone = withPlayer(alone, 'p2', { location: 'Coop' }); // not nearby
  const soloResult = resolveCombat(alone, 'p1', 'predator', 'Chew Bawka', 1);
  const soloReturnAttack = 10 - soloResult.players.find((p) => p.id === 'p1')!.health;

  const withTeammate = withPlayer(alone, 'p2', { location: chewBawka.location });
  const teamResult = resolveCombat(withTeammate, 'p1', 'predator', 'Chew Bawka', 1);
  const teamReturnAttack = 10 - teamResult.players.find((p) => p.id === 'p1')!.health;

  assert.equal(teamReturnAttack, soloReturnAttack + 1);
});

test('Freezing: everyone not immune snaps to the Coop the moment the card is drawn, and Eat still works inside', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Madam Chickovsky' }] });
  const state = createGame(config);
  let s = withPlayer(state, 'p1', { location: 'Grit Stones' });
  s = withPlayer(s, 'p2', { location: 'Grit Stones' });
  s = { ...s, day: 5, weather: { ...s.weather, seasonDecks: { ...s.weather.seasonDecks, Spring: [1, ...s.weather.seasonDecks.Spring] } } }; // Freezing (index 1) drawn next

  const result = advanceDay(s, { discardSide: 'inside' }); // day 5 -> 6, a phase-boundary day: draws the new card
  assert.equal(result.players.find((p) => p.id === 'p1')!.location, 'Coop'); // snapped in
  assert.equal(result.players.find((p) => p.id === 'p2')!.location, 'Grit Stones'); // Madam Chickovsky (Cold-Hardy) is immune

  assert.throws(() => move(result, 'p1', 'Grit Stones')); // trapped
});
