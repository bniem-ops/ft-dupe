import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { playBonusCard } from '../src/actions.js';
import { attack } from '../src/actions.js';
import { resolveProduction } from '../src/turn.js';
import { loadBonusCards } from '../src/data.js';
import { BONUS_CARD_EFFECTS } from '../src/abilities/bonusCards.js';
import { GameState } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

function withBonusCard(state: GameState, playerId: string, shorthand: string): GameState {
  const cardId = loadBonusCards().findIndex((c) => c.shorthand === shorthand);
  if (cardId < 0) throw new Error(`Bonus Card not found: ${shorthand}`);
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, bonusCardHand: [cardId] } : p)) };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('"-2 health -> -2 enemy health": self cost + direct damage to a chosen enemy', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { health: 5, maxHealth: 5 }), 'p1', '-2 health -> -2 enemy health');
  const predator = state.predators[0];
  const result = playBonusCard(state, 'p1', 0, { targetType: 'predator', targetId: predator.name });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 3);
  assert.equal(result.predators.find((pr) => pr.name === predator.name)!.health, predator.health - 2);
  assert.equal(p1.bonusCardHand.length, 0);
});

test('"+1 to a Teammates food" (teammateGain): self-targeting in solo actually applies the gain', () => {
  // Regression: resolveCardEffect's final `players = replacePlayer(players,
  // player)` sync used to silently discard a self-targeted teammateGain,
  // since the gain was written into `players` via a separate `target`
  // variable that never touched the locally-tracked `player`.
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { food: 0 }), 'p1', '+1 to a Teammates food');
  const result = playBonusCard(state, 'p1', 0, { targetPlayerId: 'p1' });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.food, 1);
  assert.equal(p1.bonusCardHand.length, 0);
});

test('"+1 to a Teammate\'s meals or health" (teammateChoiceGain): self-targeting applies the chosen option', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { health: 2, maxHealth: 5 }), 'p1', "+1 to a Teammate's meals or health");
  const result = playBonusCard(state, 'p1', 0, { targetPlayerId: 'p1', option: 2 }); // option 2 = health
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 3);
});

test('"+1 egg OR Immune to weather effects for one turn": option 1 gains an egg, option 2 sets pending immunity', () => {
  const state = withBonusCard(createGame(baseConfig()), 'p1', '+1 egg OR Immune to weather effects for one turn');
  const optionOne = playBonusCard(state, 'p1', 0, { option: 1 });
  assert.equal(optionOne.players.find((p) => p.id === 'p1')!.eggs, 1);

  const optionTwo = playBonusCard(state, 'p1', 0, { option: 2 });
  assert.equal(optionTwo.players.find((p) => p.id === 'p1')!.pendingWeatherImmuneUntilNextTurn, true);
});

test('"+1 food OR health": a plain choiceGain card', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { health: 2, maxHealth: 5 }), 'p1', '+1 food OR health');
  const foodChoice = playBonusCard(state, 'p1', 0, { option: 1 });
  assert.equal(foodChoice.players.find((p) => p.id === 'p1')!.food, 1);
  const healthChoice = playBonusCard(state, 'p1', 0, { option: 2 });
  assert.equal(healthChoice.players.find((p) => p.id === 'p1')!.health, 3);
});

test('"+1 to attack strength, no extra food cost": raises the cap by 1 and exempts only that point from food', () => {
  let state = withBonusCard(createGame(baseConfig()), 'p1', '+1 to attack strength');
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = playBonusCard(state, 'p1', 0);
  const p1 = played.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.pendingFreeAttackPoint, true);

  // Shellock Holmes Chick attackStrength is 1; the card raises the cap to 2.
  const predator = played.predators.find((pr) => pr.revealed)!;
  const attacked = attack(played, 'p1', 'predator', predator.name, 2);
  // 2 declared, but the 2nd (bonus) point is free -> only 1 food spent.
  assert.equal(attacked.players.find((p) => p.id === 'p1')!.food, 4);
  assert.equal(attacked.players.find((p) => p.id === 'p1')!.pendingFreeAttackPoint, false);
});

test('"-2 food -> +2 health": unconditional selfDelta, no choice', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { food: 3, health: 1, maxHealth: 5 }), 'p1', '-2 food -> +2 health');
  const result = playBonusCard(state, 'p1', 0);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.food, 1);
  assert.equal(p1.health, 3);
});

test('"-1 to enemy health": direct chip damage, no self cost', () => {
  const state = withBonusCard(createGame(baseConfig()), 'p1', '-1 to enemy health');
  const predator = state.predators[0];
  const result = playBonusCard(state, 'p1', 0, { targetType: 'predator', targetId: predator.name });
  assert.equal(result.predators.find((p) => p.name === predator.name)!.health, predator.health - 1);
});

test("\"+1 to a Teammate's meals or health\": teammateChoiceGain picks the resource by option", () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p2', { health: 2, maxHealth: 5 }), 'p1', "+1 to a Teammate's meals or health");
  const healthChoice = playBonusCard(state, 'p1', 0, { option: 2, targetPlayerId: 'p2' });
  assert.equal(healthChoice.players.find((p) => p.id === 'p2')!.health, 3);
});

test('"-1 meal OR -1 health -> +3 food": choiceGain branches can each mix cost and gain', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { mealCounter: 2, health: 5, maxHealth: 5, food: 0 }), 'p1', '-1 meal OR -1 health -> +3 food');
  const mealChoice = playBonusCard(state, 'p1', 0, { option: 1 });
  assert.equal(mealChoice.players.find((p) => p.id === 'p1')!.mealCounter, 1);
  const healthChoice = playBonusCard(state, 'p1', 0, { option: 2 });
  const p1 = healthChoice.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 4);
  assert.equal(p1.food, 3);
});

test('"Reroll your own die": best-of-2 on the very next production roll', () => {
  const state = withBonusCard(createGame(baseConfig()), 'p1', 'Reroll your own die');
  const played = playBonusCard(state, 'p1', 0);
  let p1 = played.players.find((p) => p.id === 'p1')!;
  p1 = { ...p1, stage: 2 };
  // First roll misses (die 2), reroll (die 6) should still land the hit.
  let calls = 0;
  const rng = () => (calls++ === 0 ? 1 / 6 : 5 / 6); // die 2, then die 6
  const result = resolveProduction(played, p1, rng);
  assert.ok(result.eggs > p1.eggs);
  assert.equal(result.pendingRerollNextRoll, false);
});

test('"-1 to enemy attack": reduces the next return-attack/Grub-defend damage by 1', () => {
  // Eggsmeralda S1's printed return attack is 1 and its effect is a
  // self-heal only (no returnAttackDelta), so the card should fully
  // negate the return attack here.
  let state = withBonusCard(createGame(baseConfig()), 'p1', '-1 to enemy attack');
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = playBonusCard(state, 'p1', 0);
  const before = played.players.find((p) => p.id === 'p1')!.health;
  const result = attack(played, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before);
});

test('"-2 eggs -> +4 food OR +2 health": another signed selfDelta + choiceGain pair', () => {
  const state = withBonusCard(withPlayer(createGame(baseConfig()), 'p1', { eggs: 3, health: 1, maxHealth: 5 }), 'p1', '-2 eggs -> +4 food OR +2 health');
  const result = playBonusCard(state, 'p1', 0, { option: 2 });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 1);
  assert.equal(p1.health, 3);
});

test('"+1 egg OR Discard an additional bonus card for +3 eggs": option 2 requires a 2nd card to discard', () => {
  const cardId = loadBonusCards().findIndex((c) => c.shorthand === '+1 egg OR Discard an additional bonus card for +3 eggs');
  const otherCardId = loadBonusCards().findIndex((c) => c.shorthand === '-1 to enemy health');
  let state = createGame(baseConfig());
  state = withPlayer(state, 'p1', { bonusCardHand: [cardId, otherCardId] });

  const optionOne = playBonusCard(state, 'p1', 0, { option: 1 });
  assert.equal(optionOne.players.find((p) => p.id === 'p1')!.eggs, 1);

  const optionTwo = playBonusCard(state, 'p1', 0, { option: 2, discardExtraCardIndex: 0 }); // index into the hand *after* the played card is removed
  const p1 = optionTwo.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 3);
  assert.equal(p1.bonusCardHand.length, 0);
});

test('"Dodge Enemy attack": suppresses the next attack\'s return damage and target effect entirely', () => {
  let state = withBonusCard(createGame(baseConfig()), 'p1', 'Dodge Enemy attack');
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = playBonusCard(state, 'p1', 0, { targetType: 'predator', targetId: 'Eggsmeralda' });
  const before = played.players.find((p) => p.id === 'p1')!.health;
  const hitConfig = { ...played.config, rng: constantRng(0.999) }; // would otherwise hit Eggsmeralda's self-heal roll
  const result = attack({ ...played, config: hitConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before); // no return damage
});

test('"Dodge Enemy attack": cannot be played against Owl Coopone', () => {
  const config = baseConfig({ predators: { regular: ['Owl Coopone', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' } });
  let state = withBonusCard(createGame(config), 'p1', 'Dodge Enemy attack');
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  assert.throws(() => playBonusCard(state, 'p1', 0, { targetType: 'predator', targetId: 'Owl Coopone' }), /Owl Coopone cannot be dodged/);
});

test('"2 extra actions": grants 2 bonus actions this turn', () => {
  const state = withBonusCard(createGame(baseConfig()), 'p1', '2 extra actions');
  const before = state.actionsRemainingThisTurn;
  const result = playBonusCard(state, 'p1', 0);
  assert.equal(result.actionsRemainingThisTurn, before + 2);
});

test('"-1 to a Predators roll": shifts the next Predator-roll combat down by 1', () => {
  let state = withBonusCard(createGame(baseConfig()), 'p1', '-1 to a Predators roll');
  state = withPlayer(state, 'p1', { food: 5, location: 'Hendred Acre Wood' });
  const played = playBonusCard(state, 'p1', 0);
  // Eggsmeralda S1 self-heals on a roll of 4-6; rolling a 5 would normally
  // hit, but a -1 reduction brings it to 4, which still hits (rollOutcomes
  // include 4) — use a roll that only hits without the reduction (roll 4 -> reduced to 3, miss).
  const config = { ...played.config, rng: constantRng(3 / 6) }; // die roll 4
  const damaged = { ...played, predators: played.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, health: p.maxHealth - 1 } : p)) };
  const result = attack({ ...damaged, config }, 'p1', 'predator', 'Eggsmeralda', 1);
  const eggsmeralda = result.predators.find((p) => p.name === 'Eggsmeralda')!;
  // Without the card: roll 4 hits (4-6 range), self-heals 1, netting no
  // change from the attack's -1. With the card: roll reduced to 3, misses,
  // so the predator ends up 1 lower than its pre-attack (already-damaged) health.
  assert.equal(eggsmeralda.health, damaged.predators.find((p) => p.name === 'Eggsmeralda')!.health - 1);
});

test('every printed Bonus Card shorthand now has an implemented effect (phase 11 closed the "needs hook" gap)', () => {
  const shorthands = new Set(loadBonusCards().map((c) => c.shorthand));
  for (const shorthand of shorthands) {
    assert.ok(BONUS_CARD_EFFECTS[shorthand as string], `"${shorthand}" has no BONUS_CARD_EFFECTS entry`);
  }
});

test('playing a card the registry does not implement throws', () => {
  const state = withPlayer(createGame(baseConfig()), 'p1', { bonusCardHand: [0] });
  const withFakeCard: GameState = {
    ...state,
    players: state.players.map((p) => (p.id === 'p1' ? { ...p, bonusCardHand: [-1] } : p)),
  };
  assert.throws(() => playBonusCard(withFakeCard, 'p1', 0));
});
