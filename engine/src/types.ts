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

// Every "...until the next Egg Exchange" clause (Sal Moe Nella, Professor
// Moltiarty, Layonardo) shares one lifecycle: applied by a predator combat
// effect, checked by the relevant action/turn step, cleared for everyone
// the moment the next Egg Exchange fires (advanceDay) — calendar-based,
// not conditioned on that player actually exchanging eggs. See
// docs/rules-audit.md phase 6 (ability effect engine).
export type StatusEffectType =
  | 'cannotEat'
  | 'cannotHeal'
  | 'cannotLeaveLocation'
  | 'cannotParticipateInEggExchange'
  | 'skipProduction';

// A die roll source, injected rather than calling Math.random() directly
// so turn/production logic stays deterministically testable.
export type RNG = () => number;

// Combat hook extension points. When a slot is omitted, combat.ts's
// runCombatEffects defaults to looking up real content from the phase 6
// ability registries (engine/src/abilities/) instead of a no-op — tests
// (or future callers) can still pass an explicit hook here to fully
// override that default, same as before phase 6. `dodged` is the one
// cross-cutting behavior phase 4 needed structurally: "Dodging a return
// attack also dodges the Predator effect" (core_rules.md).
export interface CombatContext {
  state: GameState;
  attackerId: string;
  targetType: 'predator' | 'grub';
  targetId: string;
}

export interface CombatStageResult {
  dodged?: boolean;
  // Phase 6 additions: the executable-now Predator/weather/chicken combat
  // effects, summed across all 3 hook stages and applied by
  // resolvePredatorAttack alongside the base return-attack/defeat logic.
  returnAttackDelta?: number; // e.g. Ursula Bone +1..+3, Thick Feathers -1, Bandit Mask -1
  returnAttackOverride?: number; // Cleopoultra: "only suffer -1 return attack" — a fixed cap, not a delta
  predatorDodges?: boolean; // Cleopoultra: attacker's damage to the predator is suppressed
  predatorHealthDelta?: number; // predator self-heal (Eggsmeralda, Chicksune)
  attackerFoodDelta?: number; // Hens Gruber losses (negative)
  attackerStatusEffects?: StatusEffectType[];
  discardAfterCombat?: ('bonus' | 'grub')[]; // Hendel's Mother
}

export interface CombatHooks {
  weatherEffect?: (ctx: CombatContext, rng: RNG) => CombatStageResult;
  targetEffect?: (ctx: CombatContext, rng: RNG) => CombatStageResult;
  chickenAbilities?: (ctx: CombatContext, rng: RNG) => CombatStageResult;
}

export interface GameConfig {
  // Any length >= 1 (solo supported). Chicken choice is a player decision,
  // not something the engine assigns. startingLocation is only valid for
  // chickens whose ability grants mayChooseStartingLocation (e.g.
  // General Tso's Traveler) — createGame throws if set otherwise.
  players: { id: string; chickenName: string; startingLocation?: Location }[];
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
  skipNextTurn: boolean; // set by Brood (core_rules.md)
  alive: boolean; // false on death; see pendingRevivalChoices/justRevivedPendingFirstTurn below for the phase 9 revival flow
  bonusCardHand: BonusCardId[];
  grubHand: HeldGrubCard[];
  bonusCardHandLimit: number; // base 2 per core_rules.md; ability-driven changes are phase 5
  // Loot Drops held (predator name used as the reference — look up
  // .lootDrop text via data.ts when needed). Interpreting what a loot
  // drop *does* is phase 6/7; this just tracks that it's held.
  lootDrops: string[];
  // Phase 6 additions.
  statusEffectsUntilNextEggExchange: StatusEffectType[];
  foragedThisTurn: boolean; // transient, reset in startTurn — drives Fair weather
  // "Once during this phase" (Nighttime's -1 action, Sunny's +1 action) —
  // reset whenever a new weather card is drawn, not per-turn.
  weatherAdjustmentUsedThisPhase: boolean;
  // "Free action... once per turn" abilities (Ladies' Aid, Always on
  // Purpose, Quick Claws, Long Shanks) — reset in startTurn. A single flag
  // is sufficient since only the player's *current* stage ability is
  // active and no chicken has two such abilities at once.
  freeAbilityUsedThisTurn: boolean;
  // Phase 7: pre-committed "pending" modifiers from a played Bonus Card or
  // Grub Reward, consumed (and cleared) by the next matching action —
  // same pattern as phase 6's damageMitigation, needed because a
  // synchronous reducer can't pause mid-resolution to ask "reroll now?".
  pendingFreeAttackPoint: boolean; // consumed by attack(): 1 point exempt from the food cost
  pendingPredatorRollReduction: number; // consumed by the next Predator-roll combat
  pendingIncomingDamageReduction: number; // consumed by the next return-attack/Grub-defend damage
  pendingDodgeNextAttack: boolean; // consumed by the next attack (Predator or Grub)
  pendingWeatherImmuneUntilNextTurn: boolean; // cleared at this player's next startTurn
  pendingRerollNextRoll: boolean; // consumed by the next production/forage/layEgg/Grub-defend roll
  pendingIgnorePredatorRoll: boolean; // Scorpion Grub Reward — consumed by the next Predator attack
  // Permanent Grub Reward upgrades (docs/rules-audit.md's "Permanent
  // Upgrade" rewards) — applied once at play time, checked every time
  // afterward, same treatment as phase 6's permanent Loot Drop patches.
  permanentEggProductionBonus: number; // Caterpillar — added to the production roll before the threshold check
  permanentReturnAttackReductionRoll: { threshold: number; amount: number } | null; // Roly Poly
  permanentNoBonusCardHandLimit: boolean; // Large Spider
  permanentForageBonusUntilNextWeather: number; // Lizard — cleared when a new weather card is drawn
  permanentWeatherImmuneUntilNextCard: boolean; // Lunar Moth — cleared when a new weather card is drawn
  // Phase 9: revival flow. A dead player with choices pending stays
  // alive: false until completeRevival resolves — avoids a transient
  // "revived but no stats yet" state that startTurn could otherwise hit.
  pendingRevivalChoices: string[] | null; // the 2 drawn chicken names, set by brood()
  // Set true by completeRevival, cleared at this player's own endTurn —
  // core_rules.md's "must take their first turn back as a Chick" clause,
  // checked by gameStatus.ts's evaluateGameStatus alongside `alive`.
  justRevivedPendingFirstTurn: boolean;
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
  gameOver: boolean; // see engine/src/gameStatus.ts for real evaluation (phase 9)
  won: boolean; // only meaningful once gameOver is true
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
      // Pre-committed damage mitigation (Misdirection, Eggpire Strikes
      // Back) — see actions.ts's attack() for why this is a commitment,
      // not a mid-resolution prompt.
      mitigation?: { resource: 'bonusCards' | 'eggs'; amount: number };
    }
  | { type: 'eat'; playerId: string; amount: number }
  | { type: 'forage'; playerId: string }
  // Phase 6: "Free action" chicken abilities — validated against the
  // acting player's unlocked CHICKEN_ABILITIES entry, don't consume
  // actionsRemainingThisTurn, gated to once per turn via
  // freeAbilityUsedThisTurn. Named by shape (reusable if another chicken
  // gets a similar ability later), not by the specific chicken.
  | { type: 'giftFood'; playerId: string; targetPlayerId: string } // Ladies' Aid
  | { type: 'sacrificeHealthForEggs'; playerId: string } // Always on Purpose
  | { type: 'payEggForCard'; playerId: string } // Quick Claws
  | { type: 'freeOutsideMove'; playerId: string; destination: Location } // Long Shanks
  | { type: 'drawTwoKeepOne'; playerId: string; keep: 0 | 1 } // Foresight
  // Phase 7: playing a held Bonus Card or Grub Reward. Free (no action
  // cost) per core_rules.md. `option` selects between a choiceGain card's
  // two branches; targetPlayerId/targetType+targetId/amount/
  // discardExtraCardIndex are only required by the specific card's shape
  // (validated in actions.ts against the BONUS_CARD_EFFECTS/GRUB_REWARDS
  // registry entry — unneeded ones are ignored).
  | {
      type: 'playBonusCard';
      playerId: string;
      cardHandIndex: number;
      option?: 1 | 2;
      targetPlayerId?: string;
      targetType?: 'predator' | 'grub';
      targetId?: string;
      amount?: number;
      discardExtraCardIndex?: number;
    }
  | {
      type: 'useGrubReward';
      playerId: string;
      grubHandIndex: number;
      option?: 1 | 2;
      targetPlayerId?: string;
      targetType?: 'predator' | 'grub';
      targetId?: string;
      amount?: number;
      discardExtraCardIndex?: number;
    }
  // Phase 9: resolves a dead player's brood()-drawn revival choice. Not
  // turn-gated, no action cost — same "playable any time" reasoning as
  // Bonus Cards, since a revived player's stats need to be locked in
  // before their own turn starts, not necessarily on someone else's turn.
  | { type: 'completeRevival'; playerId: string; chickenName: string };

export function rollDie(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}
