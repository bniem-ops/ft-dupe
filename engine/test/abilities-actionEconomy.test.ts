// Phase 11c: action-economy exceptions — Nobility/Landlord (chicken
// abilities) and Chamberstick/Cave Hoard/Healing Poultice/Secret Tunnels
// (predator Loot Drops).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import {
  refreshExtraActionToken,
  freeMoveToCoop,
  useChamberstick,
  useCaveHoard,
  useHealingPoultice,
  useSecretTunnels,
} from '../src/actions.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Nobility: paying 1 egg refreshes an already-used Extra Action Token, repeatably as long as eggs last', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Princess Layer' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = withPlayer(createGame(config), 'p1', { extraActionTokenAvailable: false, eggs: 2 });
  assert.throws(() => refreshExtraActionToken(state, 'p2')); // no such ability

  const refreshed = refreshExtraActionToken(state, 'p1');
  const p1 = refreshed.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.extraActionTokenAvailable, true);
  assert.equal(p1.eggs, 1);

  assert.throws(() => refreshExtraActionToken(refreshed, 'p1')); // already available

  const usedAgain = withPlayer(refreshed, 'p1', { extraActionTokenAvailable: false });
  const refreshedAgain = refreshExtraActionToken(usedAgain, 'p1');
  assert.equal(refreshedAgain.players.find((p) => p.id === 'p1')!.eggs, 0); // 2nd refresh, same turn

  const noEggsLeft = withPlayer(refreshedAgain, 'p1', { extraActionTokenAvailable: false });
  assert.throws(() => refreshExtraActionToken(noEggsLeft, 'p1')); // out of eggs
});

test('Landlord: unlimited free Move into the Coop, not gated by freeAbilityUsedThisTurn', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Cumberbill Rockefeather' }, { id: 'p2', chickenName: 'Wingston Coophill' }] });
  const state = withPlayer(createGame(config), 'p1', { location: 'Grit Stones', freeAbilityUsedThisTurn: true, stage: 2 });
  const result = freeMoveToCoop(state, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.location, 'Coop');
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn); // no action cost

  const otherChicken = withPlayer(state, 'p1', { chickenName: 'Wingston Coophill' });
  assert.throws(() => freeMoveToCoop(otherChicken, 'p1')); // no such ability without Landlord
});

test('Chamberstick: refreshes every alive player at the holder\'s location, not those elsewhere', () => {
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { lootDrops: ['Coopella'], location: 'Grit Stones' });
  state = withPlayer(state, 'p2', { location: 'Grit Stones', extraActionTokenAvailable: false });
  const result = useChamberstick(state, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p2')!.extraActionTokenAvailable, true);

  const p2Elsewhere = withPlayer(state, 'p2', { location: 'Golden Gables', extraActionTokenAvailable: false });
  const notRefreshed = useChamberstick(p2Elsewhere, 'p1');
  assert.equal(notRefreshed.players.find((p) => p.id === 'p2')!.extraActionTokenAvailable, false);
});

test('Cave Hoard: draws a Bonus Card for self or a nearby teammate, respecting their hand limit', () => {
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { lootDrops: ["Hendel's Mother"], location: 'Grit Stones' });
  const forSelf = useCaveHoard(state, 'p1');
  assert.equal(forSelf.players.find((p) => p.id === 'p1')!.bonusCardHand.length, state.players.find((p) => p.id === 'p1')!.bonusCardHand.length + 1);

  const nearby = withPlayer(state, 'p2', { location: 'Grit Stones' });
  const forTeammate = useCaveHoard(nearby, 'p1', 'p2');
  assert.equal(forTeammate.players.find((p) => p.id === 'p2')!.bonusCardHand.length, 1);
});

test('Cave Hoard rejects drawing into an already-full hand and a non-nearby teammate', () => {
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { lootDrops: ["Hendel's Mother"], bonusCardHand: [0, 1] }); // limit 2
  assert.throws(() => useCaveHoard(state, 'p1'));

  const farTeammate = withPlayer(state, 'p2', { location: 'Grit Stones' });
  assert.throws(() => useCaveHoard(farTeammate, 'p1', 'p2'));
});

test('Healing Poultice: heals every alive player at the holder\'s location by 1, capped at maxHealth', () => {
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { lootDrops: ['Chew Bawka'], location: 'Grit Stones' });
  const p2Full = state.players.find((p) => p.id === 'p2')!;
  state = withPlayer(state, 'p2', { location: 'Grit Stones', health: Math.max(0, p2Full.maxHealth - 1) });
  const result = useHealingPoultice(state, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p2')!.health, p2Full.maxHealth);
});

test('Secret Tunnels: free Move for self or a nearby player, to any location', () => {
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { lootDrops: ['Weasma and Clawnk'], location: 'Grit Stones' });
  const nearby = withPlayer(state, 'p2', { location: 'Grit Stones' });

  const movedSelf = useSecretTunnels(state, 'p1', 'Golden Gables');
  assert.equal(movedSelf.players.find((p) => p.id === 'p1')!.location, 'Golden Gables');
  assert.equal(movedSelf.actionsRemainingThisTurn, state.actionsRemainingThisTurn);

  const movedTeammate = useSecretTunnels(nearby, 'p1', 'Badlands', 'p2');
  assert.equal(movedTeammate.players.find((p) => p.id === 'p2')!.location, 'Badlands');

  const farTeammate = withPlayer(state, 'p2', { location: 'Golden Gables' });
  assert.throws(() => useSecretTunnels(farTeammate, 'p1', 'Badlands', 'p2'));
});
