// Phase 11a: activatable stash/charge Loot Drops (Egg Stash, Food Stash,
// Gas Mask, Arrow Pack), plus the adjacent fix making a card-effect kill
// (enemyDamage) grant the same defeat consequences as a normal Attack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { advanceDay } from '../src/turn.js';
import { collectFromStash, useGasMask, useArrowPack, playBonusCard } from '../src/actions.js';
import { loadBonusCards } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

// Overkill rather than deal exactly-lethal damage — some predators
// (Eggsmeralda, Chicksune) can self-heal on their own combat-step roll, so
// `attackStrength === health` isn't reliably lethal once other rolls
// earlier in a test have shifted the shared RNG sequence.
function defeat(state: GameState, playerId: string, predatorName: string): GameState {
  const predator = state.predators.find((p) => p.name === predatorName)!;
  return resolveCombat(state, playerId, 'predator', predatorName, predator.health + 10);
}

// Returns each value in order, repeating the last once exhausted — lets a
// test script exactly which of several sequential rollDie() calls land
// where, unlike constantRng (same value every time).
function sequenceRng(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('Egg Stash: defeating Eggsmeralda grants 3 egg charges, drawn down by collectFromStash', () => {
  const state = defeat(createGame(baseConfig()), 'p1', 'Eggsmeralda');
  const p1 = state.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.lootCharges['Eggsmeralda'], 3);

  const collected = collectFromStash(state, 'p1', 'Eggsmeralda', 2);
  const after = collected.players.find((p) => p.id === 'p1')!;
  assert.equal(after.eggs, p1.eggs + 2);
  assert.equal(after.lootCharges['Eggsmeralda'], 1);
});

test('Food Stash: defeating Sal Moe Nella grants 3 food charges, distributable to a nearby teammate', () => {
  const state = defeat(createGame(baseConfig()), 'p1', 'Sal Moe Nella');
  const nearby = withPlayer(state, 'p2', { location: state.players.find((p) => p.id === 'p1')!.location, food: 0 });

  const given = collectFromStash(nearby, 'p1', 'Sal Moe Nella', 3, 'p2');
  assert.equal(given.players.find((p) => p.id === 'p1')!.lootCharges['Sal Moe Nella'], 0);
  assert.equal(given.players.find((p) => p.id === 'p2')!.food, 3);
});

test('collectFromStash rejects over-drawing, not holding the Loot Drop, and a non-nearby recipient', () => {
  const state = defeat(createGame(baseConfig()), 'p1', 'Eggsmeralda');
  assert.throws(() => collectFromStash(state, 'p1', 'Eggsmeralda', 4)); // only 3 available
  assert.throws(() => collectFromStash(state, 'p2', 'Eggsmeralda', 1)); // p2 doesn't hold it

  const farTeammate = withPlayer(state, 'p2', { location: 'Grit Stones' });
  const holderLocation = state.players.find((p) => p.id === 'p1')!.location;
  assert.notEqual(holderLocation, 'Grit Stones');
  assert.throws(() => collectFromStash(farTeammate, 'p1', 'Eggsmeralda', 1, 'p2'));
});

test("Gas Mask: -1 return attack for the day it's used, resets on the next day rollover", () => {
  let state = defeat(createGame(baseConfig()), 'p1', 'Professor Moltiarty');
  const p1 = state.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.lootCharges['Professor Moltiarty'], 1);

  const target = state.predators.find((p) => p.name === 'Sal Moe Nella')!;
  state = withPlayer(state, 'p1', { location: target.location, food: 5, health: p1.maxHealth });
  const before = resolveCombat(state, 'p1', 'predator', 'Sal Moe Nella', 0).players.find((p) => p.id === 'p1')!.health;

  const masked = useGasMask(state, 'p1', 'Sal Moe Nella');
  assert.equal(masked.players.find((p) => p.id === 'p1')!.lootCharges['Professor Moltiarty'], 0);
  assert.equal(masked.predators.find((p) => p.name === 'Sal Moe Nella')!.returnAttackReductionToday, 1);
  assert.throws(() => useGasMask(masked, 'p1', 'Sal Moe Nella')); // single use, already spent

  const afterMask = resolveCombat(masked, 'p1', 'predator', 'Sal Moe Nella', 0).players.find((p) => p.id === 'p1')!.health;
  assert.equal(afterMask, before + 1); // Sal Moe Nella's return attack reduced by 1

  const rolledOver = advanceDay(masked, { discardSide: 'inside' });
  assert.equal(rolledOver.predators.find((p) => p.name === 'Sal Moe Nella')!.returnAttackReductionToday, 0);
});

test('Arrow Pack: ranged, 1 food + 1 action per arrow, no return attack, works from any location', () => {
  const config = baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' } });
  let state = defeat(createGame(config), 'p1', 'Cleopoultra');
  const p1 = state.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.lootCharges['Cleopoultra'], 3);

  state = withPlayer(state, 'p1', { food: 5, location: 'Coop', health: p1.maxHealth }); // nowhere near Eggsmeralda — ranged, so that's fine
  const target = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  const fired = useArrowPack(state, 'p1', 'predator', 'Eggsmeralda');
  const shooter = fired.players.find((p) => p.id === 'p1')!;
  assert.equal(shooter.food, 4); // 1 food per arrow
  assert.equal(shooter.health, shooter.maxHealth); // no return attack — it's ranged
  assert.equal(shooter.lootCharges['Cleopoultra'], 2);
  assert.equal(fired.actionsRemainingThisTurn, state.actionsRemainingThisTurn - 1);
  assert.equal(fired.predators.find((p) => p.name === 'Eggsmeralda')!.health, target.health - 1);
});

test('Arrow Pack defeating a predator still grants its Loot Drop and reveals the Boss once it was the last regular', () => {
  const config = baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' } });
  let state = createGame(config);
  state = defeat(state, 'p1', 'Cleopoultra');
  state = defeat(state, 'p1', 'Eggsmeralda');
  // Both defeats landed a return attack on p1 (a 3-max-health Chick) —
  // top them back up so the arrow shot below isn't blocked by death.
  state = withPlayer(state, 'p1', { alive: true, health: state.players.find((p) => p.id === 'p1')!.maxHealth, food: 5 });
  state = { ...state, predators: state.predators.map((p) => (p.name === 'Sal Moe Nella' ? { ...p, health: 1 } : p)) };

  const result = useArrowPack(state, 'p1', 'predator', 'Sal Moe Nella');
  const defeated = result.predators.find((p) => p.name === 'Sal Moe Nella')!;
  assert.equal(defeated.defeated, true);
  assert.ok(result.players.find((p) => p.id === 'p1')!.lootDrops.includes('Sal Moe Nella'));
  assert.equal(result.predators.find((p) => p.isBoss)!.revealed, true); // last regular down
});

test('useArrowPack rejects once out of arrows or without food for one', () => {
  const config = baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' } });
  let state = defeat(createGame(config), 'p1', 'Cleopoultra');
  state = withPlayer(state, 'p1', { food: 0 });
  assert.throws(() => useArrowPack(state, 'p1', 'predator', 'Eggsmeralda')); // no food

  const depleted = withPlayer(state, 'p1', { food: 5, lootCharges: { Cleopoultra: 0 } });
  assert.throws(() => useArrowPack(depleted, 'p1', 'predator', 'Eggsmeralda')); // no arrows left
});

test("Monocle: the holder's attacks are never dodged by the target, even on a roll that would normally dodge it", () => {
  const config = baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Cleopoultra'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const nearby = withPlayer(state, 'p1', { food: 5, location: state.predators.find((p) => p.name === 'Cleopoultra')!.location });
  const rolledSix = { ...nearby, config: { ...nearby.config, rng: () => 0.999 } }; // Cleopoultra S1: 5-6 dodges

  const withoutMonocle = resolveCombat(rolledSix, 'p1', 'predator', 'Cleopoultra', 2);
  const cleopoultraBefore = state.predators.find((p) => p.name === 'Cleopoultra')!;
  assert.equal(withoutMonocle.predators.find((p) => p.name === 'Cleopoultra')!.health, cleopoultraBefore.health); // dodged, no damage

  const withMonocle = withPlayer(rolledSix, 'p1', { lootDrops: ['Owl Coopone'] });
  const result = resolveCombat(withMonocle, 'p1', 'predator', 'Cleopoultra', 2);
  assert.equal(result.predators.find((p) => p.name === 'Cleopoultra')!.health, cleopoultraBefore.health - 2); // not dodged
});

test("Fox's Staff: rolls the Predator-effect roll twice and keeps the milder (lower) result", () => {
  const state = createGame(baseConfig()); // Sal Moe Nella S1: 4-6 -> cannotEat
  const nearby = withPlayer(state, 'p1', {
    food: 5,
    location: state.predators.find((p) => p.name === 'Sal Moe Nella')!.location,
  });

  const badRollOnly = { ...nearby, config: { ...nearby.config, rng: sequenceRng([0.999]) } }; // roll 6 -> cannotEat
  const withoutFoxStaff = resolveCombat(badRollOnly, 'p1', 'predator', 'Sal Moe Nella', 1);
  assert.ok(withoutFoxStaff.players.find((p) => p.id === 'p1')!.statusEffectsUntilNextEggExchange.includes('cannotEat'));

  const withFoxStaff = withPlayer(nearby, 'p1', { lootDrops: ['Chicksune'] });
  const badThenGood = { ...withFoxStaff, config: { ...withFoxStaff.config, rng: sequenceRng([0.999, 0.0]) } }; // 6, then 1 -> keep 1
  const result = resolveCombat(badThenGood, 'p1', 'predator', 'Sal Moe Nella', 1);
  assert.ok(!result.players.find((p) => p.id === 'p1')!.statusEffectsUntilNextEggExchange.includes('cannotEat'));
});

test("a Bonus Card's direct enemy damage now marks a killed Predator defeated and grants its Loot Drop (previously silently left it at 0 health, un-defeated)", () => {
  const state = createGame(baseConfig());
  const lowHealth: GameState = { ...state, predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, health: 1 } : p)) };
  const cardIndex = loadBonusCards().findIndex((c) => c.shorthand === '-1 to enemy health');
  const withCard = withPlayer(lowHealth, 'p1', { bonusCardHand: [cardIndex], health: lowHealth.players.find((p) => p.id === 'p1')!.maxHealth });

  const result = playBonusCard(withCard, 'p1', 0, { targetType: 'predator', targetId: 'Eggsmeralda' });
  const after = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  assert.equal(after.health, 0);
  assert.equal(after.defeated, true);
  assert.ok(result.players.find((p) => p.id === 'p1')!.lootDrops.includes('Eggsmeralda'));
});
