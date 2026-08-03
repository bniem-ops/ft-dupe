// Game setup: initial GameState from a GameConfig, applying the
// difficulty-modifier table from core_rules.md.
import {
  GameConfig,
  GameState,
  PlayerState,
  PredatorState,
  Location,
  OUTSIDE_LOCATIONS,
  WeatherState,
  GrubDecksState,
  Season,
  DifficultyLevel,
} from './types.js';
import {
  chickenStage,
  findPredator,
  loadPredators,
  loadGrubCards,
  parseIntField,
  parseHealthMultiplier,
  seasonCardList,
} from './data.js';
import { pick, shuffle } from './random.js';
import { dealFaceUp } from './grubs.js';

// Species -> predator name mapping used by the difficulty table's
// randomization pools (core_rules.md's Difficulty Modifiers section).
const SPECIES_TO_PREDATOR: Record<string, string> = {
  Bear: 'Ursula Bone',
  Coyote: 'Shere Corn',
  Hawk: 'Cleopoultra',
  Fox: 'Chicksune',
  Raccoon: 'Hens Gruber',
  Badger: "Hendel's Mother",
  Cougar: 'Coopella',
  'Snapping Turtle': 'Layonardo',
};

const BASE_POOL = ['Bear', 'Coyote', 'Hawk'];
const BASE_ALL_FOUR_POOL = ['Bear', 'Coyote', 'Hawk', 'Fox', 'Raccoon'];
const EGGSPANSION_POOL = ['Bear', 'Coyote', 'Hawk', 'Badger', 'Cougar'];
const EGGSPANSION_ALL_FOUR_POOL = [
  'Bear',
  'Coyote',
  'Hawk',
  'Fox',
  'Raccoon',
  'Badger',
  'Cougar',
  'Snapping Turtle',
];

function bossPool(difficulty: DifficultyLevel, eggspansion: boolean): string[] | null {
  if (difficulty < 5) return null;
  return (eggspansion ? EGGSPANSION_POOL : BASE_POOL).map((s) => SPECIES_TO_PREDATOR[s]);
}

function allFourPool(difficulty: DifficultyLevel, eggspansion: boolean): string[] | null {
  if (difficulty < 7) return null;
  return (eggspansion ? EGGSPANSION_ALL_FOUR_POOL : BASE_ALL_FOUR_POOL).map(
    (s) => SPECIES_TO_PREDATOR[s],
  );
}

// Boss health multiplier bonus over its stage-3 base multiplier.
// Levels 1-2 remove it; level 8 increases it to +4; otherwise +3.
export function bossHealthBonus(difficulty: DifficultyLevel): number {
  if (difficulty <= 2) return 0;
  if (difficulty === 8) return 4;
  return 3;
}

// Whether Fair/Sunny/Snow are removed from their season decks (levels 6+).
export function positiveWeatherRemoved(difficulty: DifficultyLevel): boolean {
  return difficulty >= 6;
}

// Whether a guaranteed positive card sits on top of each season's deck
// (levels 1-3). Mutually exclusive in practice with positiveWeatherRemoved
// (that only kicks in at 6+), but callers should check both if difficulty
// logic changes.
export function guaranteedPositiveTopCard(difficulty: DifficultyLevel): boolean {
  return difficulty <= 3;
}

// Level 1 grants every player a random Loot Drop at setup.
export function grantsRandomLootDrop(difficulty: DifficultyLevel): boolean {
  return difficulty === 1;
}

function resolvePredatorSelection(config: GameConfig): { regular: [string, string, string]; boss: string } {
  const { difficulty, eggspansion, rng, predators } = config;
  const fourPool = allFourPool(difficulty, eggspansion);

  if (fourPool) {
    // Levels 7-8: all 4 predators randomly selected from the pool (unless
    // explicitly pinned by config, e.g. for reproducible tests).
    if (predators) return predators;
    const drawn = shuffle(fourPool, rng).slice(0, 4);
    return { regular: [drawn[0], drawn[1], drawn[2]], boss: drawn[3] };
  }

  const bPool = bossPool(difficulty, eggspansion);
  if (bPool) {
    // Levels 5-6: only the Boss is constrained to the pool; the 3 regular
    // predators are a free choice and must be provided.
    if (!predators) {
      throw new Error(
        `Difficulty ${difficulty} requires an explicit predator selection (regular predators are freely chosen; only the Boss is randomized).`,
      );
    }
    if (!bPool.includes(predators.boss)) {
      throw new Error(
        `Boss "${predators.boss}" is not in the allowed pool for difficulty ${difficulty}: ${bPool.join(', ')}`,
      );
    }
    return predators;
  }

  // Difficulty < 5: no randomization rule exists, must be explicit.
  if (!predators) {
    throw new Error(`Difficulty ${difficulty} has no default predator selection — must be provided explicitly.`);
  }
  return predators;
}

function createPredator(name: string, isBoss: boolean, playerCount: number, difficulty: DifficultyLevel): PredatorState {
  const data = findPredator(name);
  const stage3 = data.stages.find((s) => s.stage === 3);
  if (!stage3) throw new Error(`${name} has no stage 3 data`);
  const bonus = isBoss ? bossHealthBonus(difficulty) : 0;
  const multiplier = parseHealthMultiplier(stage3.healthMultiplier) + bonus;
  const health = multiplier * playerCount;
  return {
    name,
    location: 'Coop', // placeholder until assigned to a board location below
    stage: isBoss ? 3 : 1,
    health,
    maxHealth: health,
    revealed: !isBoss,
    defeated: false,
    isBoss,
  };
}

function setupPredators(config: GameConfig): PredatorState[] {
  const selection = resolvePredatorSelection(config);
  const playerCount = config.players.length;
  const regularLocations = OUTSIDE_LOCATIONS.filter((l) => l !== 'Badlands');
  const regulars = selection.regular.map((name, i) => {
    const predator = createPredator(name, false, playerCount, config.difficulty);
    predator.location = regularLocations[i];
    return predator;
  });
  const boss = createPredator(selection.boss, true, playerCount, config.difficulty);
  boss.location = 'Badlands';
  return [...regulars, boss];
}

function setupWeather(eggspansion: boolean, difficulty: DifficultyLevel, rng: () => number): WeatherState {
  const seasons: Season[] = ['Spring', 'Summer', 'Fall'];
  const guaranteedName: Record<Season, string> = { Spring: 'Fair', Summer: 'Sunny', Fall: 'Snow' };
  const seasonDecks = {} as Record<Season, number[]>;

  for (const season of seasons) {
    const key = season.toLowerCase() as 'spring' | 'summer' | 'fall';
    let cards = seasonCardList(key, eggspansion);
    if (positiveWeatherRemoved(difficulty)) {
      cards = cards.filter((c) => c.name !== guaranteedName[season]);
    }
    const indices = shuffle(
      cards.map((_, i) => i),
      rng,
    );
    if (guaranteedPositiveTopCard(difficulty)) {
      const positiveIndex = cards.findIndex((c) => c.name === guaranteedName[season]);
      if (positiveIndex >= 0) {
        const withoutPositive = indices.filter((i) => i !== positiveIndex);
        seasonDecks[season] = [positiveIndex, ...withoutPositive];
        continue;
      }
    }
    seasonDecks[season] = indices;
  }

  // Spring's first card is set at setup (revealed, not "drawn") — day 1
  // of Spring explicitly skips the draw step per core_rules.md.
  const springDeck = [...seasonDecks.Spring];
  const firstSpringCard = springDeck.shift();
  seasonDecks.Spring = springDeck;

  return {
    seasonDecks,
    active: firstSpringCard != null ? { season: 'Spring', cardIndex: firstSpringCard } : null,
  };
}

function setupGrubDecks(rng: () => number): GrubDecksState {
  const allIds = [...Array(loadGrubCards().length).keys()]; // 24 cards
  const shuffled = shuffle(allIds, rng);
  const half = Math.ceil(shuffled.length / 2);
  const inside = dealFaceUp({ drawPile: shuffled.slice(0, half), faceUp: null, discard: [] });
  const outside = dealFaceUp({ drawPile: shuffled.slice(half), faceUp: null, discard: [] });
  return { inside, outside };
}

function createPlayer(id: string, chickenName: string): PlayerState {
  const stage1 = chickenStage(chickenName, 1);
  const health = parseIntField(stage1.health, 1);
  return {
    id,
    chickenName,
    stage: 1,
    health,
    maxHealth: health,
    attackStrength: parseIntField(stage1.attackStrength, 1),
    food: 0,
    eggs: 0,
    mealCounter: 0,
    location: 'Coop',
    extraActionTokenAvailable: true,
    skipNextTurn: false,
    alive: true,
    bonusCardHand: [],
    grubHand: [],
    bonusCardHandLimit: 2,
    lootDrops: [],
  };
}

export function createGame(config: GameConfig): GameState {
  if (config.players.length < 1) throw new Error('At least 1 player is required (solo is supported)');

  const players = config.players.map((p) => createPlayer(p.id, p.chickenName));

  if (grantsRandomLootDrop(config.difficulty)) {
    const allLootDropPredators = loadPredators()
      .filter((p) => p.name && p.lootDrop)
      .map((p) => p.name as string);
    for (const player of players) {
      player.lootDrops.push(pick(allLootDropPredators, config.rng));
    }
  }

  return {
    config,
    season: 'Spring',
    day: 1,
    phase: 1,
    difficultyEggspansion: config.eggspansion,
    players,
    turnOrder: players.map((p) => p.id),
    currentPlayerIndex: 0,
    actionsRemainingThisTurn: 2,
    predators: setupPredators(config),
    grubDecks: setupGrubDecks(config.rng),
    bonusDeck: { drawPile: shuffle([...Array(66).keys()], config.rng), discard: [] },
    weather: setupWeather(config.eggspansion, config.difficulty, config.rng),
    gameOver: false,
    actionLog: [],
  };
}
