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
  // Phase 11e: multi-target / redirected combat.
  splashDamage?: number; // Shere Corn — dealt to every alive player at the Predator's location, attacker included
  forcedRelocation?: { playerId: string }; // Weasma and Clawnk — combat is voided; this player is moved to a random other location
  reflectReturnAttackToPredator?: boolean; // Wasp Swarm — the Predator's own base return attack is dealt back to it
  // Phase 11g: Coopella — consumed by actions.ts's attack() after
  // resolveCombat returns (combat.ts can't import turn.ts's weather-redraw
  // helper without a circular dependency).
  forcesExtraActionTokenUnavailable?: boolean;
  forcesWeatherRedraw?: boolean;
  // Phase 11j: Eggsmeralda S2/S3 — "take N eggs from [the attacker /
  // every player]," the roll-gated fork of the same effect.
  attackerEggDelta?: number; // negative = taken from the attacker only
  takesEggsFromEveryone?: number;
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
  pendingReflectReturnAttack: boolean; // Wasp Swarm Grub Reward — consumed by the next Predator attack
  // Phase 11f: roll interception (Strategem, Deus Eggs Machina, "Reroll a
  // teammate's/any die," Spotted Lanternfly). Settable on any player (self
  // or a chosen target), consumed by the first attributable die roll that
  // fires for them — genuinely "any roll," not limited to a handful of
  // sites: production/forage/layEgg, every custom and rollOutcomes-table
  // Predator-effect roll, Grub defend rolls, chicken on-attack/on-damage
  // rolls (Evasion, Berserker), weather turn-start/turn-end/on-attack
  // rolls (Tornado, Lightning Storm, Fog), Chickira's free redraw roll,
  // Ladybug's roll, and Gravekeeper Fowl's revival roll. Combat-stage
  // hooks read it via abilities/chickens.ts's peekRollIntercept and rely
  // on actions.ts's attack() to clear it afterward regardless of which
  // hook consumed it; sites reachable outside resolveCombat (Gravekeeper
  // Fowl's revival roll via Arrow Pack/direct card damage, and every
  // non-combat site) clear it explicitly themselves instead. The only
  // rolls NOT covered are ones with no single attributable player (Ice
  // Melts' daily Grub discard has no roll at all; Bird Flu's proximity
  // check isn't a roll either) or raw rng() calls that aren't a 1-6 die
  // roll in the first place (shuffles, random-pick-among-several).
  pendingRollIntercept: { mode: 'adjustBy' | 'reroll' | 'forceValue'; value?: number } | null;
  // Set by startTurn instead of committing the production roll immediately,
  // when the player holds Strategem/Deus Eggs Machina, has an egg to spend,
  // and hasn't already pre-committed a pendingRollIntercept/pendingRerollNextRoll
  // — lets them see the raw roll and react (keep/reroll/adjust) before it's
  // finalized, instead of blindly pre-committing before rolling like the
  // pendingRollIntercept flow above. Resolved by the resolveProductionReveal
  // action. Scope note: only the single-roll case pauses — a player who also
  // stacks an extra-roll ability (High Producer) still auto-resolves as
  // before, documented simplification rather than a silent bug.
  pendingProductionReveal: { roll: number; threshold: number; eggAmount: number; gained: boolean } | null;
  // Phase 11i: "For 1 Turn, borrow an unlocked ability from a teammate" —
  // a reference (chicken name + stage), not the ability object itself
  // (which can hold functions and wouldn't survive Firestore sync), looked
  // up fresh via abilities/chickens.ts's borrowedAbility() whenever
  // needed. Scope note: wired into the "free action" gate checks (Ladies'
  // Aid-style abilities, Nobility, Landlord, etc.) — the common,
  // observable case — not into passive auras/roll-modifiers/combat hooks,
  // which would need every consuming call site in the engine rewired.
  pendingBorrowedAbility: { chickenName: string; stage: Stage } | null;
  // Phase 11j: Four Leaf Clover ("For 1 turn, perform all actions
  // Outside") — same mechanism as Fur Coat's mayPerformInsideActionsOutside
  // but temporary; cleared at this player's own endTurn.
  pendingMayActAsInsideThisTurn: boolean;
  // "Move everyone for free" Bonus Card — consumed by the next move().
  pendingFreeMove: boolean;
  // Weasma and Clawnk: "pick your destination" — the printed text is a
  // player choice, not an engine pick, so the mover is flagged here
  // (location left unchanged) until they resolve it via
  // completeForcedRelocation. See combat.ts's forcedRelocation handling.
  pendingForcedRelocation: boolean;
  // Dedication (J.R.R. Yolkien S2): "Whenever you take the same action
  // twice on your turn, lay an egg" — counts per action type, reset in
  // startTurn.
  actionCountsThisTurn: Record<string, number>;
  // Permanent Grub Reward upgrades (docs/rules-audit.md's "Permanent
  // Upgrade" rewards) — applied once at play time, checked every time
  // afterward, same treatment as phase 6's permanent Loot Drop patches.
  permanentEggProductionBonus: number; // Caterpillar — added to the production roll before the threshold check
  permanentReturnAttackReductionRoll: { threshold: number; amount: number } | null; // Roly Poly
  permanentNoBonusCardHandLimit: boolean; // Large Spider
  permanentForageBonusUntilNextWeather: number; // Lizard — cleared when a new weather card is drawn
  permanentWeatherImmuneUntilNextCard: boolean; // Lunar Moth — cleared when a new weather card is drawn
  permanentTagAlongUnlocked: boolean; // Garden Snail — see the tagAlong action
  // Phase 9: revival flow. A dead player with choices pending stays
  // alive: false until completeRevival resolves — avoids a transient
  // "revived but no stats yet" state that startTurn could otherwise hit.
  pendingRevivalChoices: string[] | null; // the 2 drawn chicken names, set by brood()
  // Set true by completeRevival, cleared at this player's own endTurn —
  // core_rules.md's "must take their first turn back as a Chick" clause,
  // checked by gameStatus.ts's evaluateGameStatus alongside `alive`.
  justRevivedPendingFirstTurn: boolean;
  // Phase 11a: a counter held on a Loot Drop card itself (predator name ->
  // remaining count), granted at defeat time alongside lootDrops. Stash
  // Loot Drops (Egg/Food) start it as a shared resource pool drawn down by
  // collectFromStash; Arrow Pack starts it as ranged-attack ammo drawn down
  // by useArrowPack; Gas Mask starts it at 1 (single use). Kept through
  // death like lootDrops itself (core_rules.md: "Loot Drops are kept").
  lootCharges: Record<string, number>;
  // Mudslide (Eggspansion Summer): "Deal each player a personal Weather
  // Card. That weather is in effect for them until Mudslide is replaced."
  // Same shape as WeatherState.active — resolved by activeWeatherEffect/
  // activeWeatherName when a playerId is passed and the table's shared
  // active card is Mudslide; cleared when Mudslide itself is replaced
  // (see abilities/weather.ts's drawNextWeatherCard).
  personalWeatherOverride: { season: Season; cardIndex: number } | null;
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
  // Phase 11a: Gas Mask's "-1 return attack for an entire day" — reset to 0
  // every day in turn.ts's advanceDay (a calendar event, not tied to who
  // used it or on whom).
  returnAttackReductionToday: number;
  // Phase 11h: Gravekeeper Fowl S1/S2 — "Cannot be attacked on the day a
  // player moves into his area." Set by actions.ts's move(), reset daily
  // in turn.ts's advanceDay, same lifecycle as returnAttackReductionToday.
  cannotBeAttackedToday: boolean;
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
  // ProductionRollLogEntry entries are appended directly by turn.ts/actions.ts
  // (never dispatched, so reducer.ts's switch never needs a case for them) —
  // every stage 2/3 player's production roll, visible in the UI's toast/log
  // for trust, whether or not it paused for a reveal decision.
  actionLog: (Action | ProductionRollLogEntry)[];
  // Phase 11j: board-placed eggs anyone at that location can collect
  // (Bacaw!, Dedication) — a shared resource on the map, not a per-player one.
  boardEggs: Partial<Record<Location, number>>;
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
      // Tank: pre-committed redirect of some/all of the incoming return
      // attack onto a nearby ability-holder — same reasoning as mitigation.
      damageRedirect?: { toPlayerId: string; amount: number };
      // Plots & Ploys: a held Grub card's health shields this attack's
      // return-attack damage — index into grubHand.
      grubShieldIndex?: number;
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
  | { type: 'completeRevival'; playerId: string; chickenName: string }
  // Phase 11a: activatable stash/charge Loot Drops. Free (no action cost,
  // no turn-order check — "playable any time" like a held card) except
  // useArrowPack, which is an actual ranged Attack and costs 1 action.
  | { type: 'collectFromStash'; playerId: string; predatorName: string; amount: number; targetPlayerId?: string } // Egg/Food Stash
  | { type: 'useGasMask'; playerId: string; targetType: 'predator'; targetId: string } // Professor Moltiarty's Loot
  | { type: 'useArrowPack'; playerId: string; targetType: 'predator' | 'grub'; targetId: string } // Cleopoultra's Loot
  // Phase 11c: action-economy exceptions.
  | { type: 'refreshExtraActionToken'; playerId: string } // Nobility (Princess Layer)
  | { type: 'freeMoveToCoop'; playerId: string } // Landlord (Cumberbill Rockefeather)
  | { type: 'useChamberstick'; playerId: string } // Coopella's Loot
  | { type: 'useCaveHoard'; playerId: string; targetPlayerId?: string } // Hendel's Mother's Loot
  | { type: 'useHealingPoultice'; playerId: string } // Chew Bawka's Loot
  | { type: 'useSecretTunnels'; playerId: string; destination: Location; targetPlayerId?: string } // Weasma and Clawnk's Loot
  // Smallest Chicken (chicken) / Garden Snail (Grub Reward, permanent
  // upgrade) — same shape: move to match another player's current
  // location for free, any time.
  | { type: 'tagAlong'; playerId: string; targetPlayerId: string }
  // Quite Friendly (Cluckleberry Finn S2): bundles a second player's
  // Attack into the primary's single action — see actions.ts's
  // attackWithCompanion for the exact cost/ordering semantics.
  | {
      type: 'attackWithCompanion';
      playerId: string;
      companionId: string;
      targetType: 'predator' | 'grub';
      targetId: string;
      primaryStrength: number;
      companionStrength: number;
    }
  // Phase 11f: player-initiated roll interception.
  | { type: 'useStrategem'; playerId: string; targetPlayerId: string; eggsToSpend: number; direction: 1 | -1 } // General Tso
  | { type: 'useDeusEggsMachina'; playerId: string; targetPlayerId: string } // J.R.R. Yolkien
  // Phase 11g: on-demand shared-deck/schedule manipulation.
  | { type: 'useWhereverAnyWeather'; playerId: string } // Chickira
  | { type: 'useDungeonKeys'; playerId: string; targetPlayerId: string } // Sheriff of Rottingham's Loot
  | { type: 'attackDiscardedGrub'; playerId: string; side: 'inside' | 'outside'; discardIndex: number; attackStrength: number } // Tomb Raider
  // Phase 11j: remaining one-offs.
  | { type: 'useFreeMoveGrant'; playerId: string; destination: Location } // "Move everyone for free" Bonus Card
  | { type: 'usePortableHouse'; playerId: string; targetPlayerId: string } // Layonardo's Loot
  | { type: 'adHocEggExchange'; playerId: string; amount: number } // Snow's last-phase clause
  | { type: 'useWildernessGuide'; playerId: string; targetPlayerId: string; destination: Location } // Aracorn S3
  | { type: 'collectBoardEgg'; playerId: string; location: Location } // Bacaw!/Dedication
  // Sunny/Nighttime: "once during this phase," on whichever of the
  // player's turns they choose — see turn.ts's useWeatherActionAdjustment.
  | { type: 'useWeatherActionAdjustment'; playerId: string }
  // Free, only available once actually over the Bonus Card hand limit —
  // see actions.ts's discardBonusCard for the rules-gap reasoning.
  | { type: 'discardBonusCard'; playerId: string; cardHandIndex: number }
  // Weasma and Clawnk: resolves a pending forced relocation with the
  // mover's own choice of destination.
  | { type: 'completeForcedRelocation'; playerId: string; destination: Location }
  // Resolves a paused pendingProductionReveal (see PlayerState's doc
  // comment) — 'keep' commits the already-computed roll as-is; 'reroll'
  // (Deus Eggs Machina, 1 egg) rolls fresh; 'adjust' (Strategem, N eggs)
  // shifts the stored roll by direction*eggsToSpend.
  | { type: 'resolveProductionReveal'; playerId: string; choice: 'keep' | 'reroll' | 'adjust'; eggsToSpend?: number; direction?: 1 | -1 };

// Not part of the dispatchable Action union above — appended directly to
// GameState.actionLog by turn.ts/actions.ts, never through reducer.ts.
export interface ProductionRollLogEntry {
  type: 'productionRoll';
  playerId: string;
  roll: number;
  threshold: number;
  eggAmount: number;
  gained: boolean;
  method?: 'rerolled' | 'adjusted';
}

export function rollDie(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}
