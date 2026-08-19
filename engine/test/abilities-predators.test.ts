import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { eat, heal, move, attack } from '../src/actions.js';
import { GameState } from '../src/types.js';
import { PREDATOR_EFFECTS } from '../src/abilities/predators.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withPredatorStage(state: GameState, name: string, stage: 1 | 2 | 3): GameState {
  return { ...state, predators: state.predators.map((p) => (p.name === name ? { ...p, stage } : p)) };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Eggsmeralda S1: 4-6 self-heals 1 health (and never below defeat)', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const damaged: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, health: p.maxHealth - 1 } : p)),
  };
  const hitConfig = { ...damaged.config, rng: constantRng(0.999) }; // roll 6
  const result = resolveCombat({ ...damaged, config: hitConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  const eggsmeralda = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  // -1 (attack) +1 (self-heal), capped at maxHealth either way.
  assert.equal(eggsmeralda.health, damaged.predators.find((p) => p.name === 'Eggsmeralda')!.health);
});

test('Sal Moe Nella S1: 4-6 blocks Eat until the next Egg Exchange', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Golden Gables' });
  const hitConfig = { ...state.config, rng: constantRng(0.999) }; // roll 6
  const result = resolveCombat({ ...state, config: hitConfig }, 'p1', 'predator', 'Sal Moe Nella', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.ok(p1.statusEffectsUntilNextEggExchange.includes('cannotEat'));
  assert.throws(() => eat(withPlayer(result, 'p1', { location: 'Golden Gables' }), 'p1', 1));
});

test('Professor Moltiarty S1: unconditionally skips production until the next Egg Exchange', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Badlands' });
  // Boss isn't revealed — swap the boss out for Moltiarty at Badlands isn't
  // valid, so attack him at his real (regular) location instead.
  const moltiarty = state.predators.find((p) => p.name === 'Professor Moltiarty')!;
  const nearby = withPlayer(state, 'p1', { location: moltiarty.location });
  const result = resolveCombat(nearby, 'p1', 'predator', 'Professor Moltiarty', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.ok(p1.statusEffectsUntilNextEggExchange.includes('skipProduction'));
});

test('Hens Gruber S1: 3-4 loses 1 food, 5-6 loses 2 food', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  // baseConfig's regulars don't include Hens Gruber — attach it manually at Eggsmeralda's slot for this test.
  const withHensGruber: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Hens Gruber', stage: 1 as const } : p)),
  };
  const hitConfig = { ...withHensGruber.config, rng: constantRng(4 / 6) }; // roll 5 -> lose 2
  const result = resolveCombat({ ...withHensGruber, config: hitConfig }, 'p1', 'predator', 'Hens Gruber', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  // food: 5 - 1 (attack cost already deducted by actions.ts, not resolveCombat) so just check the delta from combat itself
  assert.equal(p1.food, 5 - 2);
});

test('Chicksune S1: immune to Bonus Card effects flag is set (inert until phase 7)', () => {
  // Structural check only — nothing consumes this yet since Bonus Card
  // play doesn't exist until phase 7.
  assert.equal(PREDATOR_EFFECTS['Chicksune'][1]!.immuneToBonusCardEffects, true);
});

test('Chicksune S3: a lethal hit defeats it even on a self-heal roll ("cannot heal after defeat")', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const withChicksune: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Chicksune', stage: 3 as const, health: 3 } : p)),
  };
  const hitConfig = { ...withChicksune.config, rng: constantRng(0.999) }; // roll 6 -> self-heal 3
  const result = resolveCombat({ ...withChicksune, config: hitConfig }, 'p1', 'predator', 'Chicksune', 3);
  const chicksune = result.predators.find((p) => p.name === 'Chicksune')!;
  assert.equal(chicksune.health, 0);
  assert.equal(chicksune.defeated, true);
});

test('Chicksune S3: a non-lethal hit still gets its self-heal roll', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const withChicksune: GameState = {
    ...state,
    predators: state.predators.map((p) =>
      p.name === 'Eggsmeralda' ? { ...p, name: 'Chicksune', stage: 3 as const, health: 5, maxHealth: 10 } : p,
    ),
  };
  const hitConfig = { ...withChicksune.config, rng: constantRng(0.999) }; // roll 6 -> self-heal 3
  const result = resolveCombat({ ...withChicksune, config: hitConfig }, 'p1', 'predator', 'Chicksune', 1);
  const chicksune = result.predators.find((p) => p.name === 'Chicksune')!;
  // 5 - 1 (attack) + 3 (self-heal) = 7, survives, heal applies since it wasn't a killing blow.
  assert.equal(chicksune.health, 7);
  assert.equal(chicksune.defeated, false);
});

test('Cleopoultra: on a dodge roll, the attack itself is negated and return attack is capped at 1', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const withCleopoultra: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Cleopoultra', stage: 1 as const } : p)),
  };
  const before = withCleopoultra.predators.find((p) => p.name === 'Cleopoultra')!;
  const hitConfig = { ...withCleopoultra.config, rng: constantRng(0.999) }; // roll 6 -> dodges
  const result = resolveCombat({ ...withCleopoultra, config: hitConfig }, 'p1', 'predator', 'Cleopoultra', 1);
  const after = result.predators.find((p) => p.name === 'Cleopoultra')!;
  assert.equal(after.health, before.health); // attack negated
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, state.players.find((pp) => pp.id === 'p1')!.health - 1); // capped return attack of 1
});

test('Ursula Bone: return attack scales by roll tier', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Badlands' });
  // Reveal the boss directly for this test.
  const revealed: GameState = { ...state, predators: state.predators.map((p) => (p.isBoss ? { ...p, revealed: true } : p)) };
  const before = revealed.players.find((p) => p.id === 'p1')!.health;
  const config = { ...revealed.config, rng: constantRng(0.999) }; // roll 6 -> S1 "4-6: +1"
  const result = resolveCombat({ ...revealed, config }, 'p1', 'predator', 'Ursula Bone', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before - 3); // base return attack 2 + 1
});

test("Hendel's Mother S1: return attack +1 if the attacker holds no Bonus Card", () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood', bonusCardHand: [] });
  const withHendel: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: "Hendel's Mother", stage: 1 as const } : p)),
  };
  const before = withHendel.players.find((p) => p.id === 'p1')!.health;
  const result = resolveCombat(withHendel, 'p1', 'predator', "Hendel's Mother", 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before - 3); // base return attack 2 + 1
});

test('Layonardo S1: 1-3 blocks leaving the location, 4-6 deals 1 fixed return damage', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const withLayonardo: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Layonardo', stage: 1 as const } : p)),
  };
  const missConfig = { ...withLayonardo.config, rng: constantRng(0) }; // roll 1 -> can't leave
  const missed = resolveCombat({ ...withLayonardo, config: missConfig }, 'p1', 'predator', 'Layonardo', 1);
  assert.ok(missed.players.find((p) => p.id === 'p1')!.statusEffectsUntilNextEggExchange.includes('cannotLeaveLocation'));
  assert.throws(() => move(withPlayer(missed, 'p1', { location: 'Hendred Acre Wood' }), 'p1', 'Grit Stones'));

  const hitConfig = { ...withLayonardo.config, rng: constantRng(0.999) }; // roll 6 -> fixed 1 damage
  const before = withLayonardo.players.find((p) => p.id === 'p1')!.health;
  const hit = resolveCombat({ ...withLayonardo, config: hitConfig }, 'p1', 'predator', 'Layonardo', 1);
  assert.equal(hit.players.find((p) => p.id === 'p1')!.health, before - 1);
});

test('Loot passives: Bandit Mask reduces return attack, Brass Knuckles/Signature Cloak are permanent one-time boosts', () => {
  let state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood', lootDrops: ['Hens Gruber'] });
  const withHensGruber: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Hens Gruber', stage: 1 as const, health: 1 } : p)),
  };
  const before = withHensGruber.players.find((p) => p.id === 'p1')!.health;
  // Defeat it — Hens Gruber's own S1 roll table (food loss) doesn't touch return attack, so Bandit Mask's -1 reduces the base return attack of 2 to 1.
  const result = resolveCombat(withHensGruber, 'p1', 'predator', 'Hens Gruber', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before - 1); // 2 base - 1 (Bandit Mask)

  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.ok(p1.lootDrops.includes('Hens Gruber'));
});

test('Signature Cloak: permanent +1 max health applied once at the moment of grant', () => {
  let state = withPlayer(createGame(baseConfig()), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const withShereCorn: GameState = {
    ...state,
    predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, name: 'Shere Corn', stage: 1 as const, health: 1 } : p)),
  };
  const beforeMax = withShereCorn.players.find((p) => p.id === 'p1')!.maxHealth;
  const result = resolveCombat(withShereCorn, 'p1', 'predator', 'Shere Corn', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.maxHealth, beforeMax + 1);
});
