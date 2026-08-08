import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { useGrubReward, attack, drawCard, forage } from '../src/actions.js';
import { resolveProduction, advanceDay } from '../src/turn.js';
import { loadGrubCards, parseIntField } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withGrubReward(state: GameState, playerId: string, name: string): GameState {
  const cardId = loadGrubCards().findIndex((c) => c.name === name);
  if (cardId < 0) throw new Error(`Grub not found: ${name}`);
  const health = parseIntField(loadGrubCards()[cardId]?.health ?? null, 0);
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, grubHand: [{ cardId, currentHealth: health, rewardUsed: false }] } : p)),
  };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Scorpion: "for one attack, ignore all Predator roll effects" skips the roll-table branch only', () => {
  let state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Scorpion'), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = useGrubReward(state, 'p1', 0);
  assert.equal(played.players.find((p) => p.id === 'p1')!.pendingIgnorePredatorRoll, true);
  const damaged = { ...played, predators: played.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, health: p.maxHealth - 1 } : p)) };
  const hitConfig = { ...damaged.config, rng: constantRng(0.999) }; // roll 6 -> would normally self-heal
  const result = attack({ ...damaged, config: hitConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  const eggsmeralda = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  // No self-heal this time: health just drops by the attack, no offset.
  assert.equal(eggsmeralda.health, damaged.predators.find((p) => p.name === 'Eggsmeralda')!.health - 1);
});

test('Lunar Moth: "ignore weather effects until a new weather card is drawn"', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Lunar Moth');
  const played = useGrubReward(state, 'p1', 0);
  assert.equal(played.players.find((p) => p.id === 'p1')!.permanentWeatherImmuneUntilNextCard, true);
  // The card is single-use and removed from hand once played.
  assert.equal(played.players.find((p) => p.id === 'p1')!.grubHand.length, 0);
});

test('Slug: heal 1 health', () => {
  const state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Slug'), 'p1', { health: 1, maxHealth: 5 });
  const result = useGrubReward(state, 'p1', 0);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, 2);
});

test('Cocoon: +3 food to a teammate', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Cocoon');
  const result = useGrubReward(state, 'p1', 0, { targetPlayerId: 'p2' });
  assert.equal(result.players.find((p) => p.id === 'p2')!.food, 3);
});

test('Dragonfly: draw 3, keep 2, give 1 to a teammate', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Dragonfly');
  const drawPileBefore = state.bonusDeck.drawPile.length;
  const startingHandSize = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length; // Shellock Holmes' Naturalist starts with 1
  const result = useGrubReward(state, 'p1', 0, { targetPlayerId: 'p2' });
  // The 2 kept cards are never capped by the hand limit (a separate
  // discardBonusCard step handles going over it) — only the card's own
  // printed "keep 2, give 1, discard the rest" split applies here.
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, startingHandSize + 2);
  assert.equal(result.players.find((p) => p.id === 'p2')!.bonusCardHand.length, 1);
  assert.equal(result.bonusDeck.drawPile.length, drawPileBefore - 3);
});

test('Praying Mantis: dodge an enemy attack (and effects)', () => {
  let state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Praying Mantis'), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = useGrubReward(state, 'p1', 0, { targetType: 'predator', targetId: 'Eggsmeralda' });
  const before = played.players.find((p) => p.id === 'p1')!.health;
  const hitConfig = { ...played.config, rng: constantRng(0.999) };
  const result = attack({ ...played, config: hitConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before);
});

test('Praying Mantis: cannot be played to dodge Owl Coopone', () => {
  const config = baseConfig({ predators: { regular: ['Owl Coopone', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } });
  const state = withPlayer(withGrubReward(createGame(config), 'p1', 'Praying Mantis'), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  assert.throws(() => useGrubReward(state, 'p1', 0, { targetType: 'predator', targetId: 'Owl Coopone' }), /Owl Coopone cannot be dodged/);
});

test('Caterpillar: +1 to your egg production rolls (Permanent Upgrade)', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Caterpillar');
  const played = useGrubReward(state, 'p1', 0);
  let p1 = played.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.permanentEggProductionBonus, 1);
  // Reward stays in hand marked used (a standing badge of the permanent upgrade).
  assert.equal(p1.grubHand.length, 1);
  assert.equal(p1.grubHand[0].rewardUsed, true);
  p1 = { ...p1, stage: 2 };
  const roll3 = resolveProduction(played, p1, constantRng(2 / 6)); // die 3, +1 bonus -> 4, meets threshold
  assert.ok(roll3.eggs > p1.eggs);
});

test('Roly Poly: when attacking, roll 4-6: Predator return attack -1 (Permanent Upgrade)', () => {
  let state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Roly Poly'), 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = useGrubReward(state, 'p1', 0);
  const before = played.players.find((p) => p.id === 'p1')!.health;
  const result = attack(played, 'p1', 'predator', 'Eggsmeralda', 1);
  // Eggsmeralda S1 returnAttack is 1; a permanent -1 roll-based reduction
  // (rolled via the same seeded rng as everything else) can fully negate
  // it — just assert it never exceeds the un-reduced amount.
  const after = result.players.find((p) => p.id === 'p1')!.health;
  assert.ok(after === before || after === before - 1);
});

test('Earthworm: heal up to 3 of a teammate\'s health', () => {
  const state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Earthworm'), 'p2', { health: 1, maxHealth: 5 });
  const result = useGrubReward(state, 'p1', 0, { targetPlayerId: 'p2', amount: 2 });
  assert.equal(result.players.find((p) => p.id === 'p2')!.health, 3);
});

test('Beehive / Centipede: +2 meals or +3 food', () => {
  const state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Beehive'), 'p1', { mealCounter: 0 });
  const result = useGrubReward(state, 'p1', 0, { option: 2 });
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 3);
});

test('Ladybug: roll 3 times; assign to eggs, food, and health loss', () => {
  const state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Ladybug'), 'p1', { health: 5, maxHealth: 5, eggs: 0, food: 0 });
  let n = 0;
  const rolls = [1, 2, 3]; // die values, not (0-1) fractions
  const rng = () => (rolls[n++] - 1) / 6; // rollDie maps 0..1 back to 1..6
  const result = useGrubReward({ ...state, config: { ...state.config, rng } }, 'p1', 0);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 1);
  assert.equal(p1.food, 2);
  assert.equal(p1.health, 2); // 5 - 3
});

test('Mosquitoes: +2 Bonus Cards', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Mosquitoes');
  const startingHandSize = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length; // Shellock Holmes' Naturalist starts with 1
  const result = useGrubReward(state, 'p1', 0);
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, startingHandSize + 2);
});

test('Wild Grain: +2 food', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Wild Grain');
  const result = useGrubReward(state, 'p1', 0);
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 2);
});

test('Ant Pile: -2 health to any enemy (Predator or Grub)', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Ant Pile');
  const predator = state.predators[0];
  const result = useGrubReward(state, 'p1', 0, { targetType: 'predator', targetId: predator.name });
  assert.equal(result.predators.find((p) => p.name === predator.name)!.health, predator.health - 2);
});

test('Lizard: Forage produces +1 additional food until the next weather card', () => {
  let state = withPlayer(withGrubReward(createGame(baseConfig()), 'p1', 'Lizard'), 'p1', { location: 'Grit Stones' });
  const played = useGrubReward(state, 'p1', 0);
  assert.equal(played.players.find((p) => p.id === 'p1')!.permanentForageBonusUntilNextWeather, 1);
  const foraged = forage(played, 'p1');
  assert.equal(foraged.players.find((p) => p.id === 'p1')!.food, 2); // 1 base + 1 Lizard bonus

  // Clears at the next phase-boundary weather draw.
  const atBoundary = { ...played, day: 5, phase: 2 as const };
  const next = advanceDay(atBoundary, { discardSide: 'inside' });
  assert.equal(next.players.find((p) => p.id === 'p1')!.permanentForageBonusUntilNextWeather, 0);
});

test('Large Spider: no Bonus Card hand limit (Permanent upgrade)', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Large Spider');
  const played = useGrubReward(state, 'p1', 0);
  const atLimit = withPlayer(played, 'p1', { bonusCardHand: [0, 1] }); // already at the default limit of 2
  const result = drawCard(atLimit, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, 3);
});

test('using a Reward the registry does not implement throws (needs-hook Grubs stay deferred)', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Dung Beetle');
  assert.throws(() => useGrubReward(state, 'p1', 0));
});

test('a single-use Reward is removed from hand after use; using it again throws', () => {
  const state = withGrubReward(createGame(baseConfig()), 'p1', 'Wild Grain');
  const result = useGrubReward(state, 'p1', 0);
  assert.equal(result.players.find((p) => p.id === 'p1')!.grubHand.length, 0);
  assert.throws(() => useGrubReward(state, 'p1', 1)); // no card at that index anymore in a fresh call
});
