// Phase 11e: multi-target / redirected combat — Shere Corn's splash
// damage, Weasma and Clawnk's forced relocation, Wasp Swarm's reflected
// damage, Quite Friendly (second attacker), Tank (damage redirection).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { resolveCombat } from '../src/combat.js';
import { attack, attackWithCompanion, playBonusCard, useGrubReward, completeForcedRelocation } from '../src/actions.js';
import { loadGrubCards } from '../src/data.js';
import { GameState, OUTSIDE_LOCATIONS } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Shere Corn: splash damage hits every alive player at its location, attacker included, not players elsewhere', () => {
  const config = baseConfig({ predators: { regular: ['Shere Corn', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } });
  const state = createGame(config);
  const shereCorn = state.predators.find((p) => p.name === 'Shere Corn')!;
  let s = withPlayer(state, 'p1', { food: 5, location: shereCorn.location, health: 10, maxHealth: 10 });
  s = withPlayer(s, 'p2', { location: shereCorn.location, health: 10, maxHealth: 10 });
  const rolledFour = { ...s, config: { ...s.config, rng: () => 0.6 } }; // Shere Corn S1: 4-6 -> 1 splash

  const result = resolveCombat(rolledFour, 'p1', 'predator', 'Shere Corn', 1);
  assert.equal(result.players.find((p) => p.id === 'p2')!.health, 9); // nearby, not the attacker, still splashed
  assert.ok(result.players.find((p) => p.id === 'p1')!.health < 10); // attacker also splashed (plus their own return attack)

  const elsewhere = withPlayer(rolledFour, 'p2', { location: 'Coop', health: 10, maxHealth: 10 });
  const result2 = resolveCombat(elsewhere, 'p1', 'predator', 'Shere Corn', 1);
  assert.equal(result2.players.find((p) => p.id === 'p2')!.health, 10); // not nearby -> untouched
});

test('Weasma and Clawnk: a triggered roll voids the whole combat instance and flags the mover for relocation, their own choice', () => {
  const config = baseConfig({
    eggspansion: true,
    predators: { regular: ['Weasma and Clawnk', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' },
  });
  const state = createGame(config);
  const wac = state.predators.find((p) => p.name === 'Weasma and Clawnk')!;
  const s = withPlayer(state, 'p1', { food: 5, location: wac.location, health: 10, maxHealth: 10 });
  const rolledSix = { ...s, config: { ...s.config, rng: () => 0.999 } }; // stage1: 4-6 triggers

  const result = resolveCombat(rolledSix, 'p1', 'predator', 'Weasma and Clawnk', 3);
  assert.equal(result.predators.find((p) => p.name === 'Weasma and Clawnk')!.health, wac.health); // no damage dealt
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, 10); // no damage taken
  // "Pick your destination" is the mover's own choice, not the engine's —
  // location is unchanged until they resolve it themselves.
  const flagged = result.players.find((p) => p.id === 'p1')!;
  assert.equal(flagged.location, wac.location);
  assert.equal(flagged.pendingForcedRelocation, true);

  const elsewhere = [...OUTSIDE_LOCATIONS, 'Coop' as const].find((l) => l !== wac.location)!;
  assert.throws(() => completeForcedRelocation(result, 'p1', wac.location)); // must pick somewhere else
  const relocated = completeForcedRelocation(result, 'p1', elsewhere);
  const p1 = relocated.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.location, elsewhere);
  assert.equal(p1.pendingForcedRelocation, false);
  assert.throws(() => completeForcedRelocation(relocated, 'p1', 'Coop')); // nothing pending anymore
});

test('Wasp Swarm Reward: dodges the return attack and reflects the Predator\'s base return attack back onto it', () => {
  const config = baseConfig();
  const state = createGame(config);
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!; // base returnAttack 1
  const wasHeldCard = { cardId: loadGrubCards().findIndex((c) => c.name === 'Wasp Swarm'), currentHealth: 1, rewardUsed: false };
  let s = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location, health: 3, maxHealth: 3, grubHand: [wasHeldCard] });

  const withPending = useGrubReward(s, 'p1', 0);
  assert.equal(withPending.players.find((p) => p.id === 'p1')!.pendingReflectReturnAttack, true);

  const before = withPending.predators.find((p) => p.name === 'Eggsmeralda')!.health;
  // Force a low roll so Eggsmeralda's own "4-6: self-heal" doesn't fire and
  // muddy the damage total this test is checking.
  const lowRoll = { ...withPending, config: { ...withPending.config, rng: () => 0.1 } };
  const result = attack(lowRoll, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, 3); // dodged the return attack entirely
  // 1 (own attack) + 1 (reflected base return attack) = 2 total damage
  assert.equal(result.predators.find((p) => p.name === 'Eggsmeralda')!.health, before - 2);
});

test('Quite Friendly: a companion attacks second, for their own food, without spending a second action', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Cluckleberry Finn' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = createGame(config);
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  let s = withPlayer(state, 'p1', { food: 5, location: eggsmeralda.location, stage: 2 });
  s = withPlayer(s, 'p2', { food: 5, location: eggsmeralda.location });
  s = { ...s, config: { ...s.config, rng: () => 0.1 } }; // avoid Eggsmeralda's own self-heal roll muddying the damage total
  const before = s.actionsRemainingThisTurn;

  const result = attackWithCompanion(s, 'p1', 'p2', 'predator', 'Eggsmeralda', 1, 1);
  assert.equal(result.predators.find((p) => p.name === 'Eggsmeralda')!.health, eggsmeralda.health - 2); // both hits landed
  assert.equal(result.players.find((p) => p.id === 'p2')!.food, 4); // companion paid their own food
  assert.equal(result.actionsRemainingThisTurn, before - 1); // only 1 action spent total

  const noAbility = withPlayer(s, 'p1', { chickenName: 'Wingston Coophill', stage: 1 });
  assert.throws(() => attackWithCompanion(noAbility, 'p1', 'p2', 'predator', 'Eggsmeralda', 1, 1));
});

test('Tank: redirects some of the incoming return attack to a nearby ability-holder, who gains Just Reward eggs', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Atilla the Hen' }] });
  const state = createGame(config);
  const sal = state.predators.find((p) => p.name === 'Sal Moe Nella')!; // base returnAttack 1
  let s = withPlayer(state, 'p1', { food: 5, location: sal.location, health: 3, maxHealth: 3 });
  s = withPlayer(s, 'p2', { stage: 3, location: sal.location, health: 4, maxHealth: 4, eggs: 0 }); // Atilla S2 Tank + S3 Just Reward

  const result = attack(s, 'p1', 'predator', 'Sal Moe Nella', 1, undefined, { toPlayerId: 'p2', amount: 1 });
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, 3); // fully redirected away
  assert.equal(result.players.find((p) => p.id === 'p2')!.health, 3); // took the 1 redirected damage
  assert.equal(result.players.find((p) => p.id === 'p2')!.eggs, 2); // Just Reward
});
