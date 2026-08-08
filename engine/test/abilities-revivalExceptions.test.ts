// Phase 11h: structural death/revival/defeat exceptions — Gravekeeper Fowl
// (can't-be-attacked-today, on-defeat revival) and Gravekeeper's Light
// (bypasses Brood entirely).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { move, attack } from '../src/actions.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

function gravekeeperConfig() {
  return baseConfig({ predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Gravekeeper Fowl'], boss: 'Ursula Bone' } });
}

test("Gravekeeper Fowl S1/S2: cannot be attacked the day a player moves into its area", () => {
  const state = createGame(gravekeeperConfig());
  const gk = state.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  const elsewhere = (['Hendred Acre Wood', 'Golden Gables', 'Grit Stones'] as const).find((l) => l !== gk.location)!;
  const s = withPlayer(state, 'p1', { food: 5, location: elsewhere });

  const movedIn = move(s, 'p1', gk.location);
  assert.equal(movedIn.predators.find((p) => p.name === 'Gravekeeper Fowl')!.cannotBeAttackedToday, true);
  assert.throws(() => attack(movedIn, 'p1', 'predator', 'Gravekeeper Fowl', 1));

  // A player already there (not moving in today) can still attack.
  const alreadyThere = withPlayer(state, 'p1', { food: 5, location: gk.location });
  const result = attack(alreadyThere, 'p1', 'predator', 'Gravekeeper Fowl', 1);
  assert.equal(result.predators.find((p) => p.name === 'Gravekeeper Fowl')!.health, gk.health - 1);
});

test('Gravekeeper Fowl: on defeat, a 5-6 roll revives it (undoing the Boss reveal too)', () => {
  const state = createGame(gravekeeperConfig());
  const gk = state.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  let s = withPlayer(state, 'p1', { food: 5, location: gk.location });
  // Defeat the other 2 regulars first so Gravekeeper Fowl's death would
  // otherwise be the one that reveals the Boss.
  for (const name of ['Eggsmeralda', 'Sal Moe Nella']) {
    const p = s.predators.find((pr) => pr.name === name)!;
    s = resolveCombat(s, 'p1', 'predator', name, p.health + 10);
  }
  s = withPlayer(s, 'p1', { health: s.players.find((p) => p.id === 'p1')!.maxHealth, food: 5 });

  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.999 } }; // roll 6 -> revives
  const revived = resolveCombat(rolledSix, 'p1', 'predator', 'Gravekeeper Fowl', gk.health);
  const gkAfter = revived.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  assert.equal(gkAfter.defeated, false);
  assert.equal(gkAfter.health, 1); // S1 revival health
  assert.equal(revived.predators.find((p) => p.isBoss)!.revealed, false); // Boss stays hidden — a regular is still "alive"
  assert.ok(revived.players.find((p) => p.id === 'p1')!.lootDrops.includes('Gravekeeper Fowl')); // loot still granted

  const rolledOne = { ...s, config: { ...s.config, rng: () => 0.01 } }; // roll 1 -> stays dead
  const stayedDead = resolveCombat(rolledOne, 'p1', 'predator', 'Gravekeeper Fowl', gk.health);
  const gkAfter2 = stayedDead.predators.find((p) => p.name === 'Gravekeeper Fowl')!;
  assert.equal(gkAfter2.defeated, true);
  assert.equal(stayedDead.predators.find((p) => p.isBoss)!.revealed, true); // no regulars left -> Boss reveals
});

test("Gravekeeper's Light: the holder comes back to life with 1 health instead of dying (single-use)", () => {
  const state = createGame(gravekeeperConfig());
  const sal = state.predators.find((p) => p.name === 'Sal Moe Nella')!; // base returnAttack 1
  let s = withPlayer(state, 'p1', {
    food: 5,
    location: sal.location,
    health: 1,
    maxHealth: 3,
    lootDrops: ['Gravekeeper Fowl'],
    lootCharges: { 'Gravekeeper Fowl': 1 },
  });

  const result = attack(s, 'p1', 'predator', 'Sal Moe Nella', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.alive, true);
  assert.equal(p1.health, 1);
  assert.equal(p1.lootCharges['Gravekeeper Fowl'], 0);

  // Single-use: the next lethal hit actually kills.
  const woundedAgain = withPlayer(result, 'p1', { health: 1 });
  const secondHit = attack(woundedAgain, 'p1', 'predator', 'Sal Moe Nella', 1);
  assert.equal(secondHit.players.find((p) => p.id === 'p1')!.alive, false);
});
