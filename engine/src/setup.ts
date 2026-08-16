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
  BonusDeckState,
  Season,
  DifficultyLevel,
  RNG,
} from './types.js';
import { getActiveChickenAbilities } from './abilities/chickens.js';
import {
  chickenStage,
  findPredator,
  loadPredators,
  loadChickens,
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

// Exported so the UI's difficulty blurb (Create Game screen) can read the
// exact same pools instead of duplicating the species lists.
export function bossPool(difficulty: DifficultyLevel, eggspansion: boolean): string[] | null {
  if (difficulty < 5) return null;
  return (eggspansion ? EGGSPANSION_POOL : BASE_POOL).map((s) => SPECIES_TO_PREDATOR[s]);
}

export function allFourPool(difficulty: DifficultyLevel, eggspansion: boolean): string[] | null {
  if (difficulty < 7) return null;
  return (eggspansion ? EGGSPANSION_ALL_FOUR_POOL : BASE_ALL_FOUR_POOL).map(
    (s) => SPECIES_TO_PREDATOR[s],
  );
}

// Every predator, filtered only by Eggspansion — the pool for whichever
// slots aren't constrained to a named species list (core_rules.md: all 4
// slots at levels 1-4, and the 3 regular slots at levels 5-6, where only
// the Boss is pool-constrained). No exclusion list: core_rules.md's
// "never part of this randomization pool" note only applies to the
// levels 7-8 pool above (see the note's correction alongside this change).
function fullRandomPool(eggspansion: boolean): string[] {
  return loadPredators()
    .filter((p) => p.name && (eggspansion || p.expansion === 'Base'))
    .map((p) => p.name as string);
}

// Randomly resolves all 4 predators for a game at any difficulty level —
// used by the UI at "Start Game" time (before chickens are dealt, per
// core_rules.md: predators are known first) so the result can be shown to
// players and then pinned into GameConfig.predators for the eventual
// createGame() call, rather than re-randomized there.
export function randomizePredatorSelection(
  difficulty: DifficultyLevel,
  eggspansion: boolean,
  rng: RNG,
): { regular: [string, string, string]; boss: string } {
  const fourPool = allFourPool(difficulty, eggspansion);
  if (fourPool) {
    const drawn = shuffle(fourPool, rng).slice(0, 4);
    return { regular: [drawn[0], drawn[1], drawn[2]], boss: drawn[3] };
  }

  const bPool = bossPool(difficulty, eggspansion);
  if (bPool) {
    const boss = pick(bPool, rng);
    const regularPool = fullRandomPool(eggspansion).filter((name) => name !== boss);
    const regular = shuffle(regularPool, rng).slice(0, 3) as [string, string, string];
    return { regular, boss };
  }

  const pool = fullRandomPool(eggspansion);
  const drawn = shuffle(pool, rng).slice(0, 4);
  return { regular: [drawn[0], drawn[1], drawn[2]], boss: drawn[3] };
}

// Deals 2 chicken candidates to each player from one shared shuffle, so no
// name can ever land with two players — each pair is exclusively reserved
// for that seat from the moment of dealing (see setup flow doc).
export function dealChickenChoices(
  playerIds: string[],
  eggspansion: boolean,
  rng: RNG,
): Record<string, [string, string]> {
  const pool = loadChickens()
    .filter((c) => c.name && (eggspansion || c.expansion === 'Base'))
    .map((c) => c.name as string);
  if (pool.length < playerIds.length * 2) {
    throw new Error(
      `Not enough chickens (${pool.length}) to deal 2 to each of ${playerIds.length} players`,
    );
  }
  const shuffled = shuffle(pool, rng);
  const result: Record<string, [string, string]> = {};
  playerIds.forEach((id, i) => {
    result[id] = [shuffled[i * 2], shuffled[i * 2 + 1]];
  });
  return result;
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
  const startStage = isBoss ? 3 : 1;
  const stageData = data.stages.find((s) => s.stage === startStage);
  if (!stageData) throw new Error(`${name} has no stage ${startStage} data`);
  const bonus = isBoss ? bossHealthBonus(difficulty) : 0;
  const multiplier = parseHealthMultiplier(stageData.healthMultiplier) + bonus;
  const health = multiplier * playerCount;
  return {
    name,
    location: 'Coop', // placeholder until assigned to a board location below
    stage: startStage,
    health,
    maxHealth: health,
    revealed: !isBoss,
    defeated: false,
    isBoss,
    returnAttackReductionToday: 0,
    cannotBeAttackedToday: false,
  };
}

function setupPredators(config: GameConfig): PredatorState[] {
  const selection = resolvePredatorSelection(config);

  // Same one-card-per-name reasoning as the chicken check above. The
  // difficulty>=7 auto-random path already draws without replacement, so
  // this only ever actually catches a manual (or manually pinned) selection.
  const predatorNames = [...selection.regular, selection.boss];
  if (new Set(predatorNames).size !== predatorNames.length) {
    throw new Error('All 4 predators must be different');
  }

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

// Stage-1 (Chick) stats + starting-grant ability for a chicken — shared
// by createPlayer (initial setup) and actions.ts's completeRevival
// ("rejoin as a Chick" per core_rules.md's revival flow), so the grants
// aren't duplicated between the two entry points.
export function baseChickStats(chickenName: string) {
  const stage1 = chickenStage(chickenName, 1);
  const [ability] = getActiveChickenAbilities(chickenName, 1);
  return {
    health: parseIntField(stage1.health, 1),
    attackStrength: parseIntField(stage1.attackStrength, 1),
    ability,
  };
}

function createPlayer(id: string, chickenName: string, startingLocation: Location | undefined): PlayerState {
  const { health, attackStrength, ability } = baseChickStats(chickenName);

  if (startingLocation && startingLocation !== 'Coop' && !ability?.mayChooseStartingLocation) {
    throw new Error(`${chickenName} cannot choose a starting location other than Coop`);
  }

  return {
    id,
    chickenName,
    stage: 1,
    health,
    maxHealth: health,
    attackStrength,
    food: ability?.startingFood ?? 0,
    eggs: ability?.startingEggs ?? 0,
    mealCounter: 0,
    location: startingLocation ?? 'Coop',
    extraActionTokenAvailable: true,
    skipNextTurn: false,
    alive: true,
    bonusCardHand: [],
    grubHand: [],
    bonusCardHandLimit: ability?.bonusCardHandLimitOverride ?? 2,
    lootDrops: [],
    statusEffectsUntilNextEggExchange: [],
    foragedThisTurn: false,
    weatherAdjustmentUsedThisPhase: false,
    freeAbilityUsedThisTurn: false,
    pendingFreeAttackPoint: false,
    pendingPredatorRollReduction: 0,
    pendingIncomingDamageReduction: 0,
    pendingDodgeNextAttack: false,
    pendingWeatherImmuneUntilNextTurn: false,
    pendingRerollNextRoll: false,
    pendingIgnorePredatorRoll: false,
    pendingReflectReturnAttack: false,
    pendingRollIntercept: null,
    pendingProductionReveal: null,
    permanentEggProductionBonus: 0,
    permanentReturnAttackReductionRoll: null,
    permanentNoBonusCardHandLimit: false,
    permanentForageBonusUntilNextWeather: 0,
    permanentWeatherImmuneUntilNextCard: false,
    pendingRevivalChoices: null,
    justRevivedPendingFirstTurn: false,
    lootCharges: {},
    permanentTagAlongUnlocked: false,
    pendingBorrowedAbility: null,
    pendingMayActAsInsideThisTurn: false,
    pendingFreeMove: false,
    actionCountsThisTurn: {},
    personalWeatherOverride: null,
    pendingForcedRelocation: false,
  };
}

// Starting Bonus Card grants (Naturalist, Stargazer) need the shared
// bonus deck, which doesn't exist until createGame builds it — so this
// runs as a second pass over already-created players, not inside
// createPlayer itself.
function grantStartingBonusCards(players: PlayerState[], bonusDeck: BonusDeckState): { players: PlayerState[]; bonusDeck: BonusDeckState } {
  let drawPile = [...bonusDeck.drawPile];
  const updatedPlayers = players.map((player) => {
    const [ability] = getActiveChickenAbilities(player.chickenName, 1);
    const count = ability?.startingBonusCards ?? 0;
    if (count <= 0) return player;
    const drawn = drawPile.slice(0, count);
    drawPile = drawPile.slice(count);
    return { ...player, bonusCardHand: [...player.bonusCardHand, ...drawn] };
  });
  return { players: updatedPlayers, bonusDeck: { ...bonusDeck, drawPile } };
}

export function createGame(config: GameConfig): GameState {
  if (config.players.length < 1) throw new Error('At least 1 player is required (solo is supported)');

  // Physically there's only one card per chicken, so two players can't
  // pick the same one at a real table — the digital setup form has no
  // equivalent constraint built in, so it's enforced here instead.
  const chickenNames = config.players.map((p) => p.chickenName);
  if (new Set(chickenNames).size !== chickenNames.length) {
    throw new Error('Each player must choose a different chicken');
  }

  let players = config.players.map((p) => createPlayer(p.id, p.chickenName, p.startingLocation));

  if (grantsRandomLootDrop(config.difficulty)) {
    const allLootDropPredators = loadPredators()
      .filter((p) => p.name && p.lootDrop)
      .map((p) => p.name as string);
    for (const player of players) {
      player.lootDrops.push(pick(allLootDropPredators, config.rng));
    }
  }

  let bonusDeck: BonusDeckState = { drawPile: shuffle([...Array(66).keys()], config.rng), discard: [] };
  ({ players, bonusDeck } = grantStartingBonusCards(players, bonusDeck));

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
    bonusDeck,
    weather: setupWeather(config.eggspansion, config.difficulty, config.rng),
    gameOver: false,
    won: false,
    actionLog: [],
    boardEggs: {},
  };
}
