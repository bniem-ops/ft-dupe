// Core state/action shapes for the Flock Together turn engine.
// Phase 3 scope only: no combat resolution, ability/card effects, or
// death/revival logic — see docs/engine-plan.md and the phase 3 plan for
// what's deliberately deferred.

export type Season = 'Spring' | 'Summer' | 'Fall';

// A season's 7 days split into 3 phases of 2/3/2 days (confirmed against
// core_rules.md's "Egg Exchange + new Weather Card before days 1, 3, 6"
// rule during the rules-interaction audit — see docs/rules-audit.md).
export type SeasonPhase = 1 | 2 | 3;

export type Stage = 1 | 2 | 3; // Chick / Pullet-Cockerel / Hen-Rooster

// Coop + the 4 named Outside locations (confirmed board layout). Each
// Outside location holds one predator slot; Badlands is reserved for the
// Boss. Move can go between any two locations in one action — no
// adjacency graph. "Nearby" elsewhere in the rules means "same location."
export type Location =
  | 'Coop'
  | 'Hendred Acre Wood'
  | 'Golden Gables'
  | 'Badlands'
  | 'Grit Stones';

export const OUTSIDE_LOCATIONS: readonly Location[] = [
  'Hendred Acre Wood',
  'Golden Gables',
  'Badlands',
  'Grit Stones',
];

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// A die roll source, injected rather than calling Math.random() directly
// so turn/production logic stays deterministically testable.
export type RNG = () => number;

// Combat hook extension points. Phase 4 ships with no real
// implementations (all three default to a no-op returning `{}`) — the
// Weather/Predator/Chicken-ability *content* (free-text roll-table
// effects) is phase 6's job. `dodged` is the one cross-cutting behavior
// phase 4 needs structurally: "Dodging a return attack also dodges the
// Predator effect" (core_rules.md).
export interface CombatContext {
  state: GameState;
  attackerId: string;
  targetType: 'predator' | 'grub';
  targetId: string;
}

export interface CombatStageResult {
  dodged?: boolean;
}

export interface CombatHooks {
  weatherEffect?: (ctx: CombatContext) => CombatStageResult;
  targetEffect?: (ctx: CombatContext) => CombatStageResult;
  chickenAbilities?: (ctx: CombatContext) => CombatStageResult;
}

export interface GameConfig {
  // Any length >= 1 (solo supported). Chicken choice is a player decision,
  // not something the engine assigns.
  players: { id: string; chickenName: string }[];
  difficulty: DifficultyLevel;
  eggspansion: boolean;
  rng: RNG;
  // Predator selection: explicit choice, required at difficulty < 5 (no
  // rule-based default exists). At difficulty >= 5, the rulebook's
  // species-randomization pools apply (see setup.ts) — provide this to
  // pin a specific selection, or omit to let createGame randomize within
  // the allowed pool via `rng`.
  predators?: { regular: [string, string, string]; boss: string };
  hooks?: CombatHooks;
}

// Reference into data/bonusCards.json / data/grubCards.json by array index
// — neither card type has a unique printed name/id, so index is the id.
export type BonusCardId = number;
export type GrubCardId = number;

export interface HeldGrubCard {
  cardId: GrubCardId;
  // Grubs have their own health once in play; a player who defeats one
  // holds the card (see docs/rules-audit.md's confirmed Grub lifecycle
  // note) until its reward is used and it's discarded. Health matters for
  // abilities like Plots & Ploys (phase 5 territory) — tracked here as
  // plain state.
  currentHealth: number;
  rewardUsed: boolean;
}

export interface PlayerState {
  id: string;
  chickenName: string; // key into data/chickens.json
  stage: Stage;
  health: number;
  maxHealth: number;
  attackStrength: number;
  food: number;
  eggs: number;
  mealCounter: number;
  location: Location;
  extraActionTokenAvailable: boolean; // once per season
  skipNextTurn: boolean; // set by Brood (core_rules.md); revival flow is phase 8
  alive: boolean; // death/revival flow is phase 8 — flag exists so state has a home for it
  bonusCardHand: BonusCardId[];
  grubHand: HeldGrubCard[];
  bonusCardHandLimit: number; // base 2 per core_rules.md; ability-driven changes are phase 5
  // Loot Drops held (predator name used as the reference — look up
  // .lootDrop text via data.ts when needed). Interpreting what a loot
  // drop *does* is phase 5/6; this just tracks that it's held.
  lootDrops: string[];
}

export interface PredatorState {
  name: string; // key into data/predators.json
  location: Location;
  stage: Stage;
  health: number;
  maxHealth: number;
  revealed: boolean;
  defeated: boolean;
  isBoss: boolean;
}

export interface GrubDeckSide {
  drawPile: GrubCardId[];
  faceUp: HeldGrubCard | null; // the currently attackable card at this side
  discard: GrubCardId[];
}

export interface GrubDecksState {
  inside: GrubDeckSide;
  outside: GrubDeckSide;
}

export interface BonusDeckState {
  drawPile: BonusCardId[];
  discard: BonusCardId[];
}

export interface WeatherState {
  // Per-season shuffled draw order, prepared at setup (difficulty levels
  // 1-3 guarantee a positive card on top — see setup.ts).
  seasonDecks: Record<Season, number[]>; // indices into that season's card list
  active: { season: Season; cardIndex: number } | null;
}

export interface GameState {
  config: GameConfig;
  season: Season;
  day: number; // 1-7 within the current season
  phase: SeasonPhase;
  difficultyEggspansion: boolean;
  players: PlayerState[];
  turnOrder: string[]; // player ids
  currentPlayerIndex: number;
  actionsRemainingThisTurn: number;
  predators: PredatorState[];
  grubDecks: GrubDecksState;
  bonusDeck: BonusDeckState;
  weather: WeatherState;
  gameOver: boolean; // stubbed — real win/lose evaluation is phase 8
  actionLog: Action[];
}

// The 8 base actions from core_rules.md. Attack's actual damage
// resolution (weather → predator → chicken ability order) is phase 4;
// here it only validates cost/targeting and deducts food.
export type Action =
  | { type: 'layEgg'; playerId: string }
  | { type: 'heal'; playerId: string; amount: number }
  | { type: 'brood'; playerId: string; targetPlayerId: string }
  | { type: 'move'; playerId: string; destination: Location }
  | { type: 'drawCard'; playerId: string }
  | {
      type: 'attack';
      playerId: string;
      targetType: 'predator' | 'grub';
      targetId: string; // predator name, or 'inside'/'outside' for the face-up Grub
      attackStrength: number;
    }
  | { type: 'eat'; playerId: string; amount: number }
  | { type: 'forage'; playerId: string };

export function rollDie(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}
