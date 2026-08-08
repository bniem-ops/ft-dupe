// Phase 11j: the remaining one-off items — Informant Network, Plots &
// Ploys, Bacaw!, Dedication, Wilderness Guide, Portable House, Eggsmeralda
// S2/S3, Owl Coopone, Four Leaf Clover, Snow's ad-hoc exchange, "Move
// everyone for free."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { applyAction } from '../src/reducer.js';
import {
  attack,
  collectBoardEgg,
  useWildernessGuide,
  usePortableHouse,
  adHocEggExchange,
  useFreeMoveGrant,
  playBonusCard,
  useGrubReward,
} from '../src/actions.js';
import { loadBonusCards, loadGrubCards } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Informant Network: can attack a Grub from any location, not just the matching side', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = createGame(config);
  const dungBeetleId = loadGrubCards().findIndex((c) => c.name === 'Dung Beetle'); // health 2, no defend roll below a 1
  let s = withPlayer(state, 'p1', { stage: 2, food: 5, location: 'Grit Stones' }); // Outside, but attacking the Inside Grub
  s = { ...s, grubDecks: { ...s.grubDecks, inside: { ...s.grubDecks.inside, faceUp: { cardId: dungBeetleId, currentHealth: 2, rewardUsed: false } } } };

  const noAbility = withPlayer(s, 'p1', { chickenName: 'Wingston Coophill' });
  assert.throws(() => attack(noAbility, 'p1', 'grub', 'inside', 1)); // not nearby, no Informant Network

  const highRoll = { ...s, config: { ...s.config, rng: () => 0.9 } }; // avoid Dung Beetle's "1: Miss your attack"
  const result = attack(highRoll, 'p1', 'grub', 'inside', 1);
  assert.equal(result.grubDecks.inside.faceUp!.currentHealth, 1);
});

test('Plots & Ploys: a held Grub\'s health shields the return-attack damage, discarding it once drained', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = createGame(config);
  const sal = state.predators.find((p) => p.name === 'Sal Moe Nella')!; // base returnAttack 1
  const s = withPlayer(state, 'p1', {
    stage: 3,
    food: 5,
    location: sal.location,
    health: 3,
    maxHealth: 3,
    grubHand: [{ cardId: 0, currentHealth: 1, rewardUsed: false }],
  });
  const result = attack(s, 'p1', 'predator', 'Sal Moe Nella', 1, undefined, undefined, 0);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 3); // fully shielded
  assert.equal(p1.grubHand.length, 0); // the 1-health card was fully drained and discarded
});

test('Bacaw!: lays a board egg wherever the holder takes combat damage, collectible by any player there', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Annie Yolkley' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const sal = state.predators.find((p) => p.name === 'Sal Moe Nella')!;
  const s = withPlayer(state, 'p1', { stage: 2, food: 5, location: sal.location, health: 5, maxHealth: 5 });
  const result = resolveCombat(s, 'p1', 'predator', 'Sal Moe Nella', 1);
  assert.equal(result.boardEggs[sal.location], 1);

  const collector = withPlayer(result, 'p2', { location: sal.location });
  const collected = collectBoardEgg(collector, 'p2', sal.location);
  assert.equal(collected.players.find((p) => p.id === 'p2')!.eggs, 1);
  assert.equal(collected.boardEggs[sal.location], 0);
});

test('Dedication: taking the same base action twice in a turn lays a board egg', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'J.R.R. Yolkien' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const s = withPlayer(state, 'p1', { stage: 2, food: 5, location: 'Grit Stones' });
  const once = applyAction(s, { type: 'forage', playerId: 'p1' });
  assert.equal(once.boardEggs[once.players.find((p) => p.id === 'p1')!.location] ?? 0, 0);
  const twice = applyAction(once, { type: 'forage', playerId: 'p1' });
  assert.equal(twice.boardEggs[twice.players.find((p) => p.id === 'p1')!.location], 1);
});

test('Wilderness Guide: pay 1 egg to move another player, as a free action', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Aracorn, Heir of Condor' }, { id: 'p2', chickenName: 'Shellock Holmes' }] });
  const state = createGame(config);
  const s = withPlayer(state, 'p1', { stage: 3, eggs: 1 });
  const result = useWildernessGuide(s, 'p1', 'p2', 'Grit Stones');
  assert.equal(result.players.find((p) => p.id === 'p2')!.location, 'Grit Stones');
  assert.equal(result.players.find((p) => p.id === 'p1')!.eggs, 0);
  assert.equal(result.actionsRemainingThisTurn, s.actionsRemainingThisTurn); // free
});

test("Portable House: grants weather immunity for a turn to self or a nearby player", () => {
  const state = createGame(baseConfig());
  let s = withPlayer(state, 'p1', { lootDrops: ['Layonardo'] });
  s = withPlayer(s, 'p2', { location: s.players.find((p) => p.id === 'p1')!.location });
  const result = usePortableHouse(s, 'p1', 'p2');
  assert.equal(result.players.find((p) => p.id === 'p2')!.pendingWeatherImmuneUntilNextTurn, true);
});

test('Eggsmeralda S2/S3: "take eggs from every player," not just the attacker', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = createGame(config);
  const egg = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const leveled: GameState = { ...state, predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, stage: 2 } : p)) };
  let s = withPlayer(leveled, 'p1', { food: 5, location: egg.location, eggs: 2 });
  s = withPlayer(s, 'p2', { location: 'Coop', eggs: 2 });
  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.99 } }; // 5-6 -> every player

  const result = resolveCombat(rolledSix, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.eggs, 1);
  assert.equal(result.players.find((p) => p.id === 'p2')!.eggs, 1); // took eggs even though not nearby
});

test('Owl Coopone: gains bonus health (and S1 return attack) only while its matching weather is active', () => {
  const config = baseConfig({ predators: { regular: ['Sal Moe Nella', 'Professor Moltiarty', 'Owl Coopone'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const owl = state.predators.find((p) => p.name === 'Owl Coopone')!;
  let s = withPlayer(state, 'p1', { food: 5, location: owl.location, health: 20, maxHealth: 20 });
  s = { ...s, predators: s.predators.map((p) => (p.name === 'Owl Coopone' ? { ...p, health: p.maxHealth - 3 } : p)) };

  // Difficulty 4 doesn't guarantee a positive top card, so pin the weather
  // explicitly on both sides rather than relying on whatever the shuffle
  // happened to deal — Spring's fixed order is Fair(0), Freezing(1), Nighttime(2).
  const withFair: GameState = { ...s, weather: { ...s.weather, active: { season: 'Spring', cardIndex: 0 } } };
  const notNighttime = resolveCombat(withFair, 'p1', 'predator', 'Owl Coopone', 1);
  const healthNoBonus = notNighttime.predators.find((p) => p.name === 'Owl Coopone')!.health;

  const withNighttime: GameState = { ...s, weather: { ...s.weather, active: { season: 'Spring', cardIndex: 2 } } };
  const withBonus = resolveCombat(withNighttime, 'p1', 'predator', 'Owl Coopone', 1);
  const healthWithBonus = withBonus.predators.find((p) => p.name === 'Owl Coopone')!.health;

  assert.equal(healthWithBonus, healthNoBonus + 2); // +2 health during Nighttime
});

test('Four Leaf Clover: "for 1 turn, perform all actions Outside," expiring at the holder\'s own endTurn', () => {
  const state = createGame(baseConfig());
  const cloverId = loadGrubCards().findIndex((c) => c.name === 'Four Leaf Clover');
  const s = withPlayer(state, 'p1', { location: 'Grit Stones', grubHand: [{ cardId: cloverId, currentHealth: 1, rewardUsed: false }] });
  const result = useGrubReward(s, 'p1', 0);
  assert.equal(result.players.find((p) => p.id === 'p1')!.pendingMayActAsInsideThisTurn, true);
});

test('Snow\'s last-phase clause: ad-hoc Egg Exchange available only while Snow is active in the final phase', () => {
  const state = createGame(baseConfig());
  const s = withPlayer(state, 'p1', { eggs: 2, food: 0 });
  assert.throws(() => adHocEggExchange(s, 'p1', 1)); // no Snow active yet

  const snowFallIndex = 0; // Fall: Snow(0)
  const inLastPhase: GameState = { ...s, phase: 3, weather: { ...s.weather, active: { season: 'Fall', cardIndex: snowFallIndex } } };
  const result = adHocEggExchange(inLastPhase, 'p1', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 1);
});

test('"Move everyone for free": grants every alive player a free Move', () => {
  const state = createGame(baseConfig());
  const cardIndex = loadBonusCards().findIndex((c) => c.shorthand === 'Move everyone for free');
  const s = withPlayer(state, 'p1', { bonusCardHand: [cardIndex] });
  const granted = playBonusCard(s, 'p1', 0);
  assert.equal(granted.players.find((p) => p.id === 'p2')!.pendingFreeMove, true);

  const before = granted.actionsRemainingThisTurn;
  const moved = useFreeMoveGrant(granted, 'p2', 'Grit Stones');
  assert.equal(moved.players.find((p) => p.id === 'p2')!.location, 'Grit Stones');
  assert.equal(moved.actionsRemainingThisTurn, before); // free

  assert.throws(() => useFreeMoveGrant(moved, 'p2', 'Golden Gables')); // already spent
});
