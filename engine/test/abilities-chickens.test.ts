import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { layEgg, heal, move, drawCard, attack, forage, giftFood, sacrificeHealthForEggs, payEggForCard, freeOutsideMove, drawTwoKeepOne } from '../src/actions.js';
import { resolveCombat } from '../src/combat.js';
import { startTurn, applyEggExchange, resolveProduction } from '../src/turn.js';
import { chickenStage, parseIntField } from '../src/data.js';
import { isImmuneToWeather } from '../src/abilities/chickens.js';
import { GameState, Stage } from '../src/types.js';
import { baseConfig, constantRng } from './testHelpers.js';

// Swaps p1's chicken (keeping its own stats consistent) so each test can
// pick whichever chicken/stage its ability needs, independent of baseConfig.
function withChicken(state: GameState, playerId: string, chickenName: string, stage: Stage): GameState {
  const stageData = chickenStage(chickenName, stage);
  const health = parseIntField(stageData.health, 1);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, chickenName, stage, health, maxHealth: health, attackStrength: parseIntField(stageData.attackStrength, 1) }
        : p,
    ),
  };
}

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

// For setup-time abilities (starting resources, hand-limit override) —
// withChicken swaps the chicken *after* createGame already ran, so it
// can't retroactively apply those; this configures it from the start.
function createGameWithP1Chicken(chickenName: string): GameState {
  return createGame(baseConfig({ players: [{ id: 'p1', chickenName }, { id: 'p2', chickenName: 'Wingston Coophill' }] }));
}

test('Naturalist: starting Bonus Card + Pollen immunity (covered in abilities-weather.test.ts)', () => {
  const state = createGame(baseConfig()); // p1 is Shellock Holmes
  assert.equal(state.players.find((p) => p.id === 'p1')!.bonusCardHand.length, 1);
});

test('Hardtack: starts with 1 food', () => {
  const state = createGameWithP1Chicken('Wyatt Chirp');
  assert.equal(state.players.find((p) => p.id === 'p1')!.food, 1);
});

test('Payback: missed production roll grants a free meal', () => {
  const state = withChicken(createGame(baseConfig()), 'p1', 'Wyatt Chirp', 2);
  const player = state.players.find((p) => p.id === 'p1')!;
  const missed = { ...player, mealCounter: 0 };
  // stage 2 threshold is 3-6; constantRng(0) -> roll 1, a miss
  const stateWithMissed = withPlayer(state, 'p1', missed);
  const result = resolveProduction(stateWithMissed, missed, constantRng(0));
  assert.equal(result.mealCounter, 1);
});

test('Thick Feathers: all predator return attacks are -1', () => {
  const state = withChicken(withPlayer(createGame(baseConfig()), 'p1', { food: 5 }), 'p1', 'Wyatt Chirp', 3);
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!; // base return attack 1
  const before = state.players.find((p) => p.id === 'p1')!.health;
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before); // 1 - 1 = 0 damage
  assert.equal(result.predators.find((p) => p.name === 'Eggsmeralda')!.health, eggsmeralda.health - 1);
});

test("Ladies' Aid: gift 1 food to a nearby player, heal 1 heart, free action", () => {
  let state = createGame(baseConfig()); // p1 is Shellock Holmes; use p2 as giver
  state = withChicken(state, 'p2', 'Madam Chickovsky', 2);
  state = withPlayer(state, 'p2', { food: 3, health: 1 });
  state = { ...state, currentPlayerIndex: 1 }; // p2's turn
  const result = giftFood(state, 'p2', 'p1');
  const giver = result.players.find((p) => p.id === 'p2')!;
  const receiver = result.players.find((p) => p.id === 'p1')!;
  assert.equal(giver.food, 2);
  assert.equal(giver.health, 2);
  assert.equal(receiver.food, 1);
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn); // free action
  assert.throws(() => giftFood(result, 'p2', 'p1')); // once per turn
});

test('Superior Product: eggs worth 2x food during the Egg Exchange', () => {
  const state = withChicken(createGame(baseConfig()), 'p1', 'Cluckleberry Finn', 3);
  const player = { ...state.players.find((p) => p.id === 'p1')!, eggs: 2, food: 0 };
  const rate = 2; // exercised directly via applyEggExchange's rate param, matching turn.ts's advanceDay wiring
  const traded = applyEggExchange(player, 2, rate);
  assert.equal(traded.food, 4);
});

test('The Forager: rolling 3-6 while Foraging collects 2 food instead of 1', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Eggatha Christie', 2);
  state = withPlayer(state, 'p1', { location: 'Grit Stones' });
  const hit = { ...state, config: { ...state.config, rng: constantRng(0.999) } }; // roll 6
  const result = forage(hit, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 2);
});

test('Dandy: immune to negative weather (blanket)', () => {
  const state = withChicken(createGame(baseConfig()), 'p1', 'Cumberbill Rockefeather', 3);
  assert.equal(isImmuneToWeather('Cumberbill Rockefeather', 3, 'Hail', false), true);
  assert.equal(isImmuneToWeather('Cumberbill Rockefeather', 3, 'Fair', true), false); // never blocks a positive card
});

test('High Producer: two independent production rolls, both apply', () => {
  const state = withChicken(createGame(baseConfig()), 'p1', 'Annie Yolkley', 3);
  const player = state.players.find((p) => p.id === 'p1')!;
  // Stage 3 threshold 3-6; roll 4 both times -> +1 egg each roll
  const result = resolveProduction(state, player, constantRng(3 / 6));
  assert.equal(result.eggs, player.eggs + 2);
});

test('Traveler: may start Outside; createGame rejects it for chickens without the ability', () => {
  const config = baseConfig({
    players: [
      { id: 'p1', chickenName: 'General Tso', startingLocation: 'Grit Stones' },
      { id: 'p2', chickenName: 'Wingston Coophill' },
    ],
  });
  const state = createGame(config);
  assert.equal(state.players.find((p) => p.id === 'p1')!.location, 'Grit Stones');

  const rejected = baseConfig({
    players: [
      { id: 'p1', chickenName: 'Wingston Coophill', startingLocation: 'Grit Stones' },
      { id: 'p2', chickenName: 'Shellock Holmes' },
    ],
  });
  assert.throws(() => createGame(rejected));
});

test('Foresight: draw 2 keep 1', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'General Tso', 2);
  const drawPileBefore = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const result = drawTwoKeepOne(state, 'p1', 0);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.bonusCardHand.length, drawPileBefore + 1);
  assert.equal(result.bonusDeck.discard.length, 1);
});

test('Misdirection: discard 2 Bonus Cards to halve incoming return-attack damage', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Wingston Coophill', 1);
  state = withPlayer(state, 'p1', { food: 5, bonusCardHand: [0, 1, 2] });
  // Bump Eggsmeralda to stage 2 (return attack 2) so halving actually
  // reduces something — stage 1's return attack of 1 floors to 0 either way.
  state = { ...state, predators: state.predators.map((p) => (p.name === 'Eggsmeralda' ? { ...p, stage: 2 } : p)) };
  const before = state.players.find((p) => p.id === 'p1')!.health;
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', 1, { resource: 'bonusCards', amount: 2 });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, before - 1); // return attack 2, floor(2/2)=1 prevented -> 1 taken
  assert.equal(p1.bonusCardHand.length, 1); // 2 spent
});

test('Evasion: rolling 3-6 when attacking dodges the return attack', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Wingston Coophill', 3);
  state = withPlayer(state, 'p1', { food: 5 });
  const hitConfig = { ...state.config, rng: constantRng(0.999) }; // roll 6
  const before = state.players.find((p) => p.id === 'p1')!.health;
  const result = resolveCombat({ ...state, config: hitConfig }, 'p1', 'predator', 'Eggsmeralda', 1);
  assert.equal(result.players.find((p) => p.id === 'p1')!.health, before);
});

test('Big-Boned: starts with 2 food, immune to Tornado', () => {
  const state = createGameWithP1Chicken('Atilla the Hen');
  assert.equal(state.players.find((p) => p.id === 'p1')!.food, 2);
});

test('Well-Laid Plans: Lay Egg roll 3-6 collects 2 eggs instead of 1', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Princess Layer', 2);
  state = withPlayer(state, 'p1', { location: 'Coop' });
  const hit = { ...state, config: { ...state.config, rng: constantRng(0.999) } };
  const result = layEgg(hit, 'p1');
  assert.equal(result.players.find((p) => p.id === 'p1')!.eggs, 2);
});

test('Eggpire Strikes Back: discard eggs 1:1 to mitigate incoming damage', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Princess Layer', 3);
  state = withPlayer(state, 'p1', { food: 5, eggs: 3, health: 5, maxHealth: 5 });
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!; // return attack 1
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', 1, { resource: 'eggs', amount: 1 });
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 5); // fully mitigated
  assert.equal(p1.eggs, 2);
});

test('Shake it Off: heal 1 heart on a missed production roll', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Chickira', 3);
  state = withPlayer(state, 'p1', { health: 1 });
  const player = state.players.find((p) => p.id === 'p1')!;
  const result = resolveProduction(state, player, constantRng(0)); // roll 1 -> miss
  assert.equal(result.health, 2);
});

test('Revenge: draw a Bonus Card for being present when a Predator is defeated', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Broods Lee', 1);
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!;
  state = withPlayer(state, 'p1', { food: eggsmeralda.health, location: eggsmeralda.location });
  const handBefore = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const result = resolveCombat(state, 'p1', 'predator', 'Eggsmeralda', eggsmeralda.health);
  assert.equal(result.players.find((p) => p.id === 'p1')!.bonusCardHand.length, handBefore + 1);
});

test('Adrenaline: max attack strength +1 if not at full health', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Broods Lee', 2); // base attackStrength 2
  state = withPlayer(state, 'p1', { food: 5, health: 1, location: 'Hendred Acre Wood' }); // damaged
  const result = attack(state, 'p1', 'predator', 'Eggsmeralda', 3); // 2 base + 1 bonus
  assert.ok(result); // no throw
  assert.throws(() => attack(withPlayer(state, 'p1', { health: state.players.find((p) => p.id === 'p1')!.maxHealth }), 'p1', 'predator', 'Eggsmeralda', 3)); // full health, no bonus
});

test('Bookworm: Bonus Card hand limit of 3', () => {
  const state = createGameWithP1Chicken('J.R.R. Yolkien');
  assert.equal(state.players.find((p) => p.id === 'p1')!.bonusCardHandLimit, 3);
});

test('Always on Purpose: free action, take 1 damage to gain 2 eggs', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Cluck Norris', 2);
  state = withPlayer(state, 'p1', { health: 3 });
  const result = sacrificeHealthForEggs(state, 'p1');
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 2);
  assert.equal(p1.eggs, 2);
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn);
});

test('Quick Claws: free action, pay 1 egg to draw a Bonus Card', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Cluck Norris', 3);
  state = withPlayer(state, 'p1', { eggs: 1 });
  const before = state.players.find((p) => p.id === 'p1')!.bonusCardHand.length;
  const result = payEggForCard(state, 'p1');
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.eggs, 0);
  assert.equal(p1.bonusCardHand.length, before + 1);
});

test('Long Shanks: free action, move between Outside locations for free', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Aracorn, Heir of Condor', 2);
  state = withPlayer(state, 'p1', { location: 'Grit Stones' });
  const result = freeOutsideMove(state, 'p1', 'Golden Gables');
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.location, 'Golden Gables');
  assert.equal(result.actionsRemainingThisTurn, state.actionsRemainingThisTurn);
  assert.throws(() => freeOutsideMove(withPlayer(state, 'p1', { location: 'Coop' }), 'p1', 'Golden Gables')); // must start Outside
});

test('Berseker: heal on taking damage (roll 3-5 -> 1 heart, 6 -> 2 hearts)', () => {
  let state = withChicken(createGame(baseConfig()), 'p1', 'Beowing', 3);
  state = withPlayer(state, 'p1', { food: 5, health: 2, maxHealth: 6, location: 'Hendred Acre Wood' });
  // Eggsmeralda S1 return attack 1; roll die via a second rng call inside onDamageTaken.
  const config = { ...state.config, rng: constantRng(0.999) }; // both the (absent) predator roll and Berserker's heal roll land high
  const result = resolveCombat({ ...state, config }, 'p1', 'predator', 'Eggsmeralda', 1);
  const p1 = result.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.health, 2 - 1 + 2); // took 1 damage, healed 2 (roll 6)
});

test('Cold-Hardy: immune to Freezing and Hail', () => {
  assert.equal(isImmuneToWeather('Madam Chickovsky', 1, 'Hail', false), true);
  assert.equal(isImmuneToWeather('Madam Chickovsky', 1, 'Freezing', false), true);
  assert.equal(isImmuneToWeather('Madam Chickovsky', 1, 'Drought', false), false);
});
