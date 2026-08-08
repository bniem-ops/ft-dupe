import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  bossHealthBonus,
  positiveWeatherRemoved,
  guaranteedPositiveTopCard,
  grantsRandomLootDrop,
  bossPool,
  allFourPool,
  randomizePredatorSelection,
  dealChickenChoices,
} from '../src/setup.js';
import { loadPredators, loadChickens } from '../src/data.js';
import { baseConfig, seededRng } from './testHelpers.js';

test('createGame sets up players at Coop with stage-1 stats from chickens.json', () => {
  const state = createGame(baseConfig());
  const p1 = state.players.find((p) => p.id === 'p1')!;
  assert.equal(p1.location, 'Coop');
  assert.equal(p1.stage, 1);
  assert.equal(p1.health, 3); // Shellock Holmes Chick health
  assert.equal(p1.maxHealth, 3);
  assert.equal(p1.attackStrength, 1);
  assert.equal(p1.food, 0);
  assert.equal(p1.eggs, 0);
  assert.equal(p1.mealCounter, 0);
});

test('createGame places 3 regular predators + boss at the confirmed board locations', () => {
  const state = createGame(baseConfig());
  const boss = state.predators.find((p) => p.isBoss)!;
  assert.equal(boss.name, 'Ursula Bone');
  assert.equal(boss.location, 'Badlands');
  assert.equal(boss.revealed, false);

  const regulars = state.predators.filter((p) => !p.isBoss);
  assert.equal(regulars.length, 3);
  for (const r of regulars) {
    assert.equal(r.revealed, true);
    assert.notEqual(r.location, 'Badlands');
  }
  const locations = new Set(state.predators.map((p) => p.location));
  assert.equal(locations.size, 4); // one predator per location, no overlap
});

test('predator health = (own starting-stage multiplier + boss bonus) x player count', () => {
  const state = createGame(baseConfig()); // difficulty 4 -> boss bonus +3
  const eggsmeralda = state.predators.find((p) => p.name === 'Eggsmeralda')!; // stage 1 x2, regular
  assert.equal(eggsmeralda.health, 2 * 2);
  const boss = state.predators.find((p) => p.isBoss)!; // Ursula Bone starts at stage 3: x5 + 3 bonus
  assert.equal(boss.health, (5 + 3) * 2);
});

test('difficulty modifier table matches core_rules.md', () => {
  assert.equal(bossHealthBonus(1), 0);
  assert.equal(bossHealthBonus(2), 0);
  assert.equal(bossHealthBonus(3), 3);
  assert.equal(bossHealthBonus(7), 3);
  assert.equal(bossHealthBonus(8), 4);

  assert.equal(guaranteedPositiveTopCard(1), true);
  assert.equal(guaranteedPositiveTopCard(3), true);
  assert.equal(guaranteedPositiveTopCard(4), false);

  assert.equal(positiveWeatherRemoved(5), false);
  assert.equal(positiveWeatherRemoved(6), true);

  assert.equal(grantsRandomLootDrop(1), true);
  assert.equal(grantsRandomLootDrop(2), false);
});

test('difficulty 1 grants every player a random Loot Drop', () => {
  const state = createGame(baseConfig({ difficulty: 1 }));
  for (const player of state.players) {
    assert.equal(player.lootDrops.length, 1);
  }
});

test('difficulty 2 grants no Loot Drops', () => {
  const state = createGame(baseConfig({ difficulty: 2 }));
  for (const player of state.players) {
    assert.equal(player.lootDrops.length, 0);
  }
});

test('difficulty 5 requires explicit predator selection, boss constrained to the pool', () => {
  assert.throws(() => createGame(baseConfig({ difficulty: 5, predators: undefined })));
  assert.throws(() =>
    createGame(
      baseConfig({
        difficulty: 5,
        predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Chicksune' },
      }),
    ),
  );
  const state = createGame(
    baseConfig({
      difficulty: 5,
      predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Ursula Bone' },
    }),
  );
  assert.equal(state.predators.find((p) => p.isBoss)!.name, 'Ursula Bone');
});

test('difficulty 7 auto-randomizes all 4 predators from the pool when not provided', () => {
  const pool = ['Ursula Bone', 'Shere Corn', 'Cleopoultra', 'Chicksune', 'Hens Gruber'];
  const state = createGame(baseConfig({ difficulty: 7, predators: undefined, rng: seededRng(7) }));
  assert.equal(state.predators.length, 4);
  for (const p of state.predators) {
    assert.ok(pool.includes(p.name), `${p.name} should be in the level-7 pool`);
  }
  assert.equal(new Set(state.predators.map((p) => p.name)).size, 4); // no duplicates
});

test('createGame deals Grub decks from a shuffled 24-card pool, 12/12 split with one face-up each', () => {
  const state = createGame(baseConfig());
  assert.equal(state.grubDecks.inside.drawPile.length, 11);
  assert.equal(state.grubDecks.outside.drawPile.length, 11);
  assert.ok(state.grubDecks.inside.faceUp);
  assert.ok(state.grubDecks.outside.faceUp);
  const allIds = [
    ...state.grubDecks.inside.drawPile,
    state.grubDecks.inside.faceUp!.cardId,
    ...state.grubDecks.outside.drawPile,
    state.grubDecks.outside.faceUp!.cardId,
  ];
  assert.equal(new Set(allIds).size, 24);
});

test('createGame sets Spring\'s starting weather from the deck top, not a draw', () => {
  const state = createGame(baseConfig());
  assert.equal(state.weather.active?.season, 'Spring');
  assert.equal(state.weather.seasonDecks.Spring.length, 5); // 6 base cards - 1 revealed
});

test('solo (1 player) is supported', () => {
  const state = createGame(baseConfig({ players: [{ id: 'solo', chickenName: 'Shellock Holmes' }] }));
  assert.equal(state.players.length, 1);
  assert.equal(state.predators[0].health, state.predators[0].maxHealth); // multiplier x 1 player
});

test('createGame rejects two players choosing the same chicken', () => {
  assert.throws(
    () =>
      createGame(
        baseConfig({
          players: [
            { id: 'p1', chickenName: 'Shellock Holmes' },
            { id: 'p2', chickenName: 'Shellock Holmes' },
          ],
        }),
      ),
    /different chicken/,
  );
});

test('randomizePredatorSelection at levels 1-4 draws all 4 distinct predators from the full roster (no exclusion)', () => {
  const { regular, boss } = randomizePredatorSelection(1, false, seededRng(1));
  const names = [...regular, boss];
  assert.equal(new Set(names).size, 4);
  const allNames = loadPredators().map((p) => p.name);
  for (const name of names) assert.ok(allNames.includes(name), `${name} should be a real predator`);
});

test('randomizePredatorSelection at levels 5-6 constrains only the Boss to the pool; regulars are free (and distinct)', () => {
  const { regular, boss } = randomizePredatorSelection(5, false, seededRng(2));
  assert.ok(bossPool(5, false)!.includes(boss));
  const names = [...regular, boss];
  assert.equal(new Set(names).size, 4);
});

test('randomizePredatorSelection at levels 7-8 draws all 4 from the named closed pool', () => {
  const pool = allFourPool(7, false)!;
  const { regular, boss } = randomizePredatorSelection(7, false, seededRng(3));
  const names = [...regular, boss];
  assert.equal(new Set(names).size, 4);
  for (const name of names) assert.ok(pool.includes(name));
});

test('randomizePredatorSelection respects Eggspansion off (no Eggspansion-only predator at any level)', () => {
  for (const difficulty of [1, 5, 7] as const) {
    const { regular, boss } = randomizePredatorSelection(difficulty, false, seededRng(difficulty));
    for (const name of [...regular, boss]) {
      const data = loadPredators().find((p) => p.name === name);
      assert.equal(data?.expansion, 'Base', `${name} at difficulty ${difficulty} should be a Base predator`);
    }
  }
});

test('dealChickenChoices deals 2 distinct chickens to each player with no repeats across the whole game', () => {
  const dealt = dealChickenChoices(['p1', 'p2', 'p3'], false, seededRng(4));
  const allDealt = Object.values(dealt).flat();
  assert.equal(allDealt.length, 6);
  assert.equal(new Set(allDealt).size, 6); // every card is unique across all players
  for (const [name1, name2] of Object.values(dealt)) assert.notEqual(name1, name2);
});

test('dealChickenChoices respects Eggspansion off', () => {
  const dealt = dealChickenChoices(['p1', 'p2'], false, seededRng(5));
  for (const [name1, name2] of Object.values(dealt)) {
    for (const name of [name1, name2]) {
      const data = loadChickens().find((c) => c.name === name);
      assert.equal(data?.expansion, 'Base');
    }
  }
});

test('dealChickenChoices throws when the pool is too small (6 players, no Eggspansion: needs 12, pool has 11)', () => {
  const sixPlayers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  assert.throws(() => dealChickenChoices(sixPlayers, false, seededRng(6)), /Not enough chickens/);
});

test('createGame rejects a predator selection with a repeated name', () => {
  assert.throws(
    () =>
      createGame(
        baseConfig({
          predators: { regular: ['Eggsmeralda', 'Eggsmeralda', 'Professor Moltiarty'], boss: 'Ursula Bone' },
        }),
      ),
    /All 4 predators must be different/,
  );
  assert.throws(
    () =>
      createGame(
        baseConfig({
          predators: { regular: ['Eggsmeralda', 'Sal Moe Nella', 'Professor Moltiarty'], boss: 'Eggsmeralda' },
        }),
      ),
    /All 4 predators must be different/,
  );
});
