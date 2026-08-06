import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { loadGrubCards } from '../src/data.js';
import { GameState } from '../src/types.js';
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

test('Scorpion: 1-2 deals 1 return damage to the attacker; 3-6 no effect', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Scorpion', 3), 'p1', { food: 5, location: 'Coop' });
  const hitConfig = { ...base.config, rng: constantRng(0) }; // roll 1
  const hit = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(hit.players.find((p) => p.id === 'p1')!.health, base.players[0].health - 1);

  const missConfig = { ...base.config, rng: constantRng(0.999) }; // roll 6
  const miss = resolveCombat({ ...base, config: missConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(miss.players.find((p) => p.id === 'p1')!.health, base.players[0].health);
});

test('"Miss your attack" shape (Lunar Moth): roll 1 negates the attack, grub health unchanged', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Lunar Moth', 3), 'p1', { food: 5, location: 'Coop' });
  const missConfig = { ...base.config, rng: constantRng(0) }; // roll 1 -> attack missed
  const missed = resolveCombat({ ...base, config: missConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(missed.grubDecks.inside.faceUp!.currentHealth, 3);

  const hitConfig = { ...base.config, rng: constantRng(0.999) }; // roll 6 -> attack lands normally
  const hit = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(hit.grubDecks.inside.faceUp!.currentHealth, 2);
});

test('Dung Beetle: roll 1 misses, roll 2 deals 1 return damage, 3-6 no effect', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Dung Beetle', 3), 'p1', { food: 5, location: 'Coop' });

  const missConfig = { ...base.config, rng: constantRng(0) }; // roll 1
  const missed = resolveCombat({ ...base, config: missConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(missed.grubDecks.inside.faceUp!.currentHealth, 3);
  assert.equal(missed.players.find((p) => p.id === 'p1')!.health, base.players[0].health);

  const hitConfig = { ...base.config, rng: constantRng(1 / 6) }; // roll 2
  const hit = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(hit.grubDecks.inside.faceUp!.currentHealth, 2);
  assert.equal(hit.players.find((p) => p.id === 'p1')!.health, base.players[0].health - 1);
});

test('Four Leaf Clover: roll 6 heals the Grub 1 as the attack lands', () => {
  // Manually elevated above its printed 0 health so the heal is observable
  // against the same attack's damage.
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Four Leaf Clover', 2), 'p1', { food: 5, location: 'Coop' });
  const hitConfig = { ...base.config, rng: constantRng(0.999) }; // roll 6
  const result = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  // -1 (attack) +1 (self-heal) = unchanged.
  assert.equal(result.grubDecks.inside.faceUp!.currentHealth, 2);
});

test('Ladybug: unconditional 1 return damage on every attack, regardless of roll', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Ladybug', 3), 'p1', { food: 5, location: 'Coop' });
  const config = { ...base.config, rng: constantRng(0) }; // roll 1 - still triggers, no roll gate
  const result = resolveCombat({ ...base, config }, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, base.players[0].health - 1);
});

test('Ant Pile: 1-3 deals 1 return damage, 4-6 no effect', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Ant Pile', 3), 'p1', { food: 5, location: 'Coop' });
  const hitConfig = { ...base.config, rng: constantRng(1 / 6) }; // roll 2
  const hit = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(hit.players.find((p) => p.id === 'p1')!.health, base.players[0].health - 1);

  const missConfig = { ...base.config, rng: constantRng(0.999) }; // roll 6
  const miss = resolveCombat({ ...base, config: missConfig }, 'p1', 'grub', 'inside', 1);
  assert.equal(miss.players.find((p) => p.id === 'p1')!.health, base.players[0].health);
});

test('Wild Grain: no defend effect at all (printed "none")', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Wild Grain', 3), 'p1', { food: 5, location: 'Coop' });
  const config = { ...base.config, rng: constantRng(0) };
  const result = resolveCombat({ ...base, config }, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, base.players[0].health);
});

test('Dodging the attack also dodges the Grub defend effect (core_rules.md)', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Ladybug', 3), 'p1', { food: 5, location: 'Coop' });
  const withDodgeHook = {
    ...base,
    config: { ...base.config, rng: constantRng(0), hooks: { chickenAbilities: () => ({ dodged: true }) } },
  };
  const result = resolveCombat(withDodgeHook, 'p1', 'grub', 'inside', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, base.players[0].health); // Ladybug's usually-unconditional damage is suppressed
  assert.equal(result.grubDecks.inside.faceUp!.currentHealth, 2); // the attack itself still lands
});

test('Defeating a Grub still applies its defend damage in the same attack', () => {
  const base = withPlayer(withGrub(createGame(baseConfig()), 'Scorpion', 1), 'p1', { food: 5, location: 'Coop' });
  const hitConfig = { ...base.config, rng: constantRng(0) }; // roll 1 -> return damage
  const result = resolveCombat({ ...base, config: hitConfig }, 'p1', 'grub', 'inside', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, base.players[0].health - 1);
  assert.equal(p1.grubHand.length, 1);
  assert.equal(p1.grubHand[0].cardId, base.grubDecks.inside.faceUp!.cardId);
});
