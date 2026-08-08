// Phase 11g: on-demand shared-deck/schedule manipulation — weather
// redraws (Wherever Any Weather, Coopella, Firefly, "Draw new weather"),
// Ice Melts, Sheriff of Rottingham, Dungeon Keys, Dung Beetle, Tomb Raider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { advanceDay } from '../src/turn.js';
import { resolveCombat } from '../src/combat.js';
import { useWhereverAnyWeather, useDungeonKeys, attackDiscardedGrub, playBonusCard, useGrubReward } from '../src/actions.js';
import { loadBonusCards, loadGrubCards } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Wherever, any Weather: free once-per-turn roll, 4-6 draws a new card', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Chickira' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const p1 = withPlayer(state, 'p1', { stage: 2 });

  const rolledLow = { ...p1, config: { ...p1.config, rng: () => 0.1 } };
  const missed = useWhereverAnyWeather(rolledLow, 'p1');
  assert.deepEqual(missed.weather.active, state.weather.active); // no redraw
  assert.equal(missed.players.find((p) => p.id === 'p1')!.freeAbilityUsedThisTurn, true);

  const rolledHigh = { ...p1, config: { ...p1.config, rng: () => 0.9 } };
  const drew = useWhereverAnyWeather(rolledHigh, 'p1');
  assert.notDeepEqual(drew.weather.active, state.weather.active); // redrawn

  assert.throws(() => useWhereverAnyWeather(withPlayer(state, 'p2', {}), 'p2')); // no such ability
});

test('Ice Melts: discards both locations\' face-up Grubs at day\'s end, not just the chosen one', () => {
  const state = createGame(baseConfig({ eggspansion: true }));
  // Ice Melts is the Spring Eggspansion card, appended after the 6 base Spring cards (indices 0-5).
  const active: GameState = { ...state, weather: { ...state.weather, active: { season: 'Spring', cardIndex: 6 } } };
  const insideBefore = active.grubDecks.inside.faceUp;
  const outsideBefore = active.grubDecks.outside.faceUp;
  assert.ok(insideBefore && outsideBefore);

  const result = advanceDay(active, { discardSide: 'inside' });
  assert.notDeepEqual(result.grubDecks.inside.faceUp, insideBefore);
  assert.notDeepEqual(result.grubDecks.outside.faceUp, outsideBefore); // outside also redealt, despite discardSide: 'inside'
});

test('Coopella: roll 4 exhausts the attacker\'s Extra Action Token, roll 5-6 redraws weather', () => {
  const config = baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Coopella'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const coopella = state.predators.find((p) => p.name === 'Coopella')!;
  const s = withPlayer(state, 'p1', { food: 5, location: coopella.location, extraActionTokenAvailable: true });

  const rolledFour = { ...s, config: { ...s.config, rng: () => 0.55 } }; // rollDie -> 4
  const tokenResult = resolveCombat(rolledFour, 'p1', 'predator', 'Coopella', 1);
  assert.equal(tokenResult.players.find((p) => p.id === 'p1')!.extraActionTokenAvailable, false);
  assert.deepEqual(tokenResult.weather.active, state.weather.active); // unchanged

  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.99 } }; // rollDie -> 6
  const weatherResult = resolveCombat(rolledSix, 'p1', 'predator', 'Coopella', 1);
  assert.notDeepEqual(weatherResult.weather.active, state.weather.active);
});

test('Sheriff of Rottingham: return attack is driven by the face-up Grub\'s printed max health', () => {
  const config = baseConfig({
    eggspansion: true,
    predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Sheriff of Rottingham'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const sheriff = state.predators.find((p) => p.name === 'Sheriff of Rottingham')!;
  const insideHealth = loadGrubCards()[state.grubDecks.inside.faceUp!.cardId]!.health;
  let s = withPlayer(state, 'p1', { food: 5, location: sheriff.location, health: 20, maxHealth: 20 });
  const forcedInsideRoll = { ...s, config: { ...s.config, rng: () => 0.1 } }; // roll 1 -> 1-3 branch -> Inside Grub

  const result = resolveCombat(forcedInsideRoll, 'p1', 'predator', 'Sheriff of Rottingham', 1);
  const damageTaken = 20 - result.players.find((p) => p.id === 'p1')!.health;
  assert.equal(damageTaken, Number(insideHealth));
});

test('Dungeon Keys: shuffles the discard pile, finds two 1-health Grubs, keeps one and gives one to a nearby teammate', () => {
  const config = baseConfig({
    eggspansion: true,
    predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Sheriff of Rottingham'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const scorpionId = loadGrubCards().findIndex((c) => c.name === 'Scorpion'); // health 1
  const lunarMothId = loadGrubCards().findIndex((c) => c.name === 'Lunar Moth'); // health 1
  let s = { ...state, grubDecks: { ...state.grubDecks, inside: { ...state.grubDecks.inside, discard: [scorpionId, lunarMothId] } } };
  s = withPlayer(s, 'p1', { lootDrops: ['Sheriff of Rottingham'], lootCharges: { 'Sheriff of Rottingham': 1 } });
  s = withPlayer(s, 'p2', { location: s.players.find((p) => p.id === 'p1')!.location });

  const result = useDungeonKeys(s, 'p1', 'p2');
  assert.equal(result.players.find((p) => p.id === 'p1')!.grubHand.length, 1);
  assert.equal(result.players.find((p) => p.id === 'p2')!.grubHand.length, 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.lootCharges['Sheriff of Rottingham'], 0);
  assert.throws(() => useDungeonKeys(result, 'p1', 'p2')); // already used
});

test('Dung Beetle Reward: takes a specific card from the Bonus discard pile', () => {
  const state = createGame(baseConfig());
  const discardedId = state.bonusDeck.drawPile[0];
  const withDiscard: GameState = { ...state, bonusDeck: { ...state.bonusDeck, discard: [discardedId] } };
  const dungBeetleId = loadGrubCards().findIndex((c) => c.name === 'Dung Beetle');
  const s = withPlayer(withDiscard, 'p1', { grubHand: [{ cardId: dungBeetleId, currentHealth: 1, rewardUsed: false }] });

  const result = useGrubReward(s, 'p1', 0, { discardExtraCardIndex: 0 });
  assert.ok(result.players.find((p) => p.id === 'p1')!.bonusCardHand.includes(discardedId));
  assert.equal(result.bonusDeck.discard.length, 0);
});

test('"Draw new weather" Bonus Card redraws on demand', () => {
  const state = createGame(baseConfig());
  const cardIndex = loadBonusCards().findIndex((c) => c.shorthand === 'Draw new weather');
  const s = withPlayer(state, 'p1', { bonusCardHand: [cardIndex] });
  const result = playBonusCard(s, 'p1', 0);
  assert.notDeepEqual(result.weather.active, state.weather.active);
});

test('Tomb Raider: attacks a Grub sitting in the discard pile, transferring it to hand on a kill', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Eggatha Christie' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const slugId = loadGrubCards().findIndex((c) => c.name === 'Slug'); // health 0
  let s = withPlayer(state, 'p1', { stage: 3, food: 5, location: 'Coop' });
  s = { ...s, grubDecks: { ...s.grubDecks, inside: { ...s.grubDecks.inside, discard: [slugId] } } };

  const result = attackDiscardedGrub(s, 'p1', 'inside', 0, 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.grubHand.length, 1);
  assert.equal(result.grubDecks.inside.discard.length, 0);

  const noAbility = withPlayer(s, 'p1', { chickenName: 'Shellock Holmes' });
  assert.throws(() => attackDiscardedGrub(noAbility, 'p1', 'inside', 0, 1));
});
