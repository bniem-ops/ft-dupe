// Shared shapes for the phase 6 ability effect engine. One interface per
// content source (chickens/predators/weather), each a bag of *optional*
// named fields — one per effect shape, not one per named ability — plus a
// small `custom` escape hatch for the rare item whose shape doesn't fit
// the common table (documented at each use). See docs/rules-audit.md and
// the phase 6 plan for the full item-by-item mapping.
import { GameState, RNG, StatusEffectType, CombatContext, CombatStageResult, Location } from '../types.js';

export interface AbilityContext {
  state: GameState;
  playerId: string;
}

// A roll-table entry: "if the roll lands in [min,max], apply this result."
export interface PredatorRollOutcome {
  min: number;
  max: number;
  selfHeal?: number; // predator heals itself (Eggsmeralda, Chicksune) — gated by !defeated by the caller
  attackerStatus?: StatusEffectType[]; // Sal Moe Nella, Moltiarty (roll-gated)
  attackerFoodLoss?: number; // Hens Gruber
  returnAttackBonus?: number; // Ursula Bone
  discardCard?: 'bonus' | 'grub'; // Hendel's Mother
  cannotLeaveLocation?: boolean; // Layonardo
  attackerTakesFixedDamage?: number; // Layonardo S1's "else take 1 return attack" branch
  predatorDodges?: boolean; // Cleopoultra: attacker's damage to the predator is suppressed
  returnAttackOverride?: number; // Cleopoultra: "only suffer -1 return attack" — a fixed cap, not a delta
}

export interface PredatorEffect {
  rollOutcomes?: PredatorRollOutcome[];
  alwaysStatus?: StatusEffectType[]; // Moltiarty S1/S3 — unconditional, no roll
  returnAttackIfAttackerHasNoBonusCard?: number; // Hendel's Mother S1
  immuneToBonusCardEffects?: boolean; // Chicksune S1 — inert until phase 7 plays Bonus Cards
  custom?: (ctx: CombatContext, rng: RNG) => CombatStageResult;
  // Phase 11h: structural death/revival exceptions.
  preventsAttackOnMoveIn?: boolean; // Gravekeeper Fowl S1/S2 — checked by actions.ts's move()/attack()
  onDefeatRevive?: { threshold: number; health: number }; // Gravekeeper Fowl — checked by combat.ts's grantPredatorDefeatConsequences
}

export interface PredatorLoot {
  permanentAttackBonus?: number; // Brass Knuckles
  permanentMaxHealthBonus?: number; // Signature Cloak
  returnAttackReduction?: number; // Bandit Mask — passive, dynamic (not a one-time patch)
  // Phase 11a: a counter granted onto the killer's PlayerState.lootCharges
  // at defeat time, keyed by predator name. Same "N charges on a held
  // card" shape for 3 different consuming actions:
  stash?: { resource: 'egg' | 'food'; startingAmount: number }; // Egg Stash / Food Stash — collectFromStash
  chargedRangedAttack?: { charges: number; damagePerCharge: number }; // Arrow Pack — useArrowPack
  activatableAttackReduction?: { amount: number }; // Gas Mask (1 charge) — useGasMask
  // Phase 11b: global roll-outcome overrides, applied regardless of hook
  // customization (checked centrally in combat.ts, not per-hook).
  neverMissesAttacks?: boolean; // Monocle — the holder's own attacks are never dodged/whiffed by the target
  rerollPredatorEffectKeepBest?: boolean; // Fox's Staff — roll the Predator-effect roll twice, keep the lower (milder) result

  // Phase 11c: action-economy exceptions, all "free action, multi-use" per
  // their card text — no charge counter needed, just gated on holding the
  // Loot Drop (checked directly against PlayerState.lootDrops).
  everyoneAtLocationRefreshExtraAction?: boolean; // Chamberstick
  freeDrawBonusCardForSelfOrTeammate?: boolean; // Cave Hoard
  healEveryoneAtLocation?: number; // Healing Poultice — amount per player
  freeMoveForSelfOrNearby?: boolean; // Secret Tunnels
  // Phase 11g: search-the-discard-pile Loot Drop (1 charge, single-use).
  dungeonKeys?: boolean; // Sheriff of Rottingham's Loot — see useDungeonKeys
  // Phase 11h: "If you die, come back to life with 1 health (single-use)"
  // — bypasses the normal Brood-required revival flow, checked centrally
  // in combat.ts's applyDamageAndMaybeDeath (every death in the game
  // routes through it).
  selfRevive?: boolean; // Gravekeeper's Light (Gravekeeper Fowl's Loot)
  // Phase 11j: grants pendingWeatherImmuneUntilNextTurn (already-existing
  // field) to self or a nearby player.
  grantsWeatherImmunityForTurn?: boolean; // Portable House (Layonardo's Loot)
}

export interface ChickenAbility {
  // Setup-time grants (createPlayer)
  startingFood?: number;
  startingEggs?: number;
  startingBonusCards?: number;
  mayChooseStartingLocation?: boolean; // Traveler
  mayPerformInsideActionsOutside?: boolean; // Fur Coat — Lay Egg/Heal/Brood usable outside the Coop

  // Immunity — same shape/consumer as weather's Dandy check
  weatherImmunity?: string[] | 'all-negative';

  // Production
  extraProductionRolls?: number; // High Producer: +1 (2 total)
  onProductionMiss?: (ctx: AbilityContext) => { food?: number; meals?: number; heal?: number }; // Payback / Shake it Off

  // Forage
  forageRoll?: { threshold: number; bonusFood: number }; // The Forager

  // Combat
  onAttack?: (ctx: CombatContext, rng: RNG) => CombatStageResult; // Evasion
  returnAttackReduction?: number; // Thick Feathers
  maxAttackBonusIfDamaged?: number; // Adrenaline
  // Discard `resource` up to `spent` (player's pre-committed choice on the
  // attack action) to reduce incoming return-attack damage by whatever
  // `compute` returns. Misdirection (2 Bonus Cards -> half, rounded down)
  // and Eggpire Strikes Back (1 egg -> 1 heart, i.e. 1:1) are the same
  // shape at different ratios.
  damageMitigation?: { resource: 'bonusCards' | 'eggs'; compute: (incomingDamage: number, spent: number) => number };

  // Passive triggers
  onDamageTaken?: (ctx: AbilityContext, rng: RNG) => number; // Berserker — heal amount
  onPredatorDefeated?: (ctx: AbilityContext) => { drawBonusCard?: boolean }; // Revenge
  // Just Reward — inert until Tank (H) exists; nothing calls this yet.
  onProtectedTeammate?: (ctx: AbilityContext) => { eggs?: number };

  // Hand limit / damage-type immunity
  bonusCardHandLimitOverride?: number; // Bookworm
  immuneToGrubDamage?: boolean; // Bookworm

  // Egg Exchange / Lay Egg
  eggExchangeRate?: number; // Superior Product: food per egg (default 1)
  layEggRoll?: { threshold: number; bonusEggs: number }; // Well-Laid Plans

  // Draw Card
  drawTwoKeepOne?: boolean; // Foresight

  // "Free action... once per turn" — don't consume actionsRemainingThisTurn,
  // gated by PlayerState.freeAbilityUsedThisTurn.
  freeGiftFood?: { cost: number; healSelf: number }; // Ladies' Aid
  freeDamageForEggs?: { damage: number; eggsGained: number }; // Always on Purpose
  freeEggForCard?: boolean; // Quick Claws
  freeOutsideMove?: boolean; // Long Shanks

  // Phase 11c: action-economy exceptions that aren't "once per turn" like
  // the free actions above — Landlord is unlimited (gated only by it
  // being your turn), Nobility is gated only by egg supply.
  freeMoveIntoCoop?: boolean; // Landlord — unlimited free Move into the Coop
  refreshExtraActionTokenCost?: number; // Nobility — pay this many eggs to refresh it early

  // Phase 11d: cross-actor auras & reactive listeners — checked against
  // every OTHER player nearby (or the target's location), not the acting
  // player's own abilities, via the aura helpers in abilities/chickens.ts.
  auraTeammateRollBonus?: number; // Battle Cry: +1 to a nearby teammate's own action roll
  auraPredatorRollPenalty?: number; // Battle Cry: -1 to a Predator/Grub roll made nearby
  auraMaxAttackBonusIfDamaged?: number; // Bolsterer: +1 max attack strength to a nearby damaged player
  grantsNearbyImmunity?: string[]; // Free Range: everyone at your location is immune to these named weather cards
  missDrawsBonusCard?: boolean; // "Not really a miss" — self clause: your own missed attack draws a card
  nearbyTeammateMissGrantsFood?: number; // "Not really a miss" — teammate clause: a nearby miss grants you food
  tagAlongUnlocked?: boolean; // Smallest Chicken — see the tagAlong action

  // Phase 11e: multi-attacker / redirected combat.
  joinsAttackAsSecond?: boolean; // Quite Friendly — see the attackWithCompanion action
  canRedirectDamage?: boolean; // Tank — see attack()'s damageRedirect param

  // Phase 11f: player-initiated roll interception (see PlayerState.
  // pendingRollIntercept's doc comment for the full list of covered rolls).
  canAdjustAnyRollForEggs?: boolean; // Strategem — see the useStrategem action
  canRerollAnyRollForEgg?: boolean; // Deus Eggs Machina — see the useDeusEggsMachina action

  // Phase 11g: on-demand shared-deck manipulation.
  freeWeatherRedrawRoll?: boolean; // Wherever, any Weather — see useWhereverAnyWeather
  canAttackDiscardedGrubs?: boolean; // Tomb Raider — see the attackDiscardedGrub action

  // Phase 11j: remaining one-offs.
  mayAttackGrubsFromAnyLocation?: boolean; // Informant Network — no nearby-Grub requirement
  canShieldWithGrubHealth?: boolean; // Plots & Ploys — see attack()'s grubShieldIndex param
  layEggOnDamageTaken?: boolean; // Bacaw! — see resolvePredatorAttack's boardEggs handling
  layEggOnRepeatedAction?: boolean; // Dedication — see reducer.ts's actionCountsThisTurn tracking
  freeMoveAnotherPlayerForEgg?: boolean; // Wilderness Guide — see the useWildernessGuide action
}

// Bonus Cards (played from bonusCardHand) and Grub Rewards (played from
// grubHand) share this one shape — a Reward is functionally a Bonus Card
// that came from a Grub instead of the deck (docs/rules-audit.md). One
// optional field per shape actually present in the 27 unique Bonus Card
// effects + 17 Grub Rewards, same "bag of optional fields" pattern as
// ChickenAbility/PredatorEffect/WeatherEffect above.
export type Resource = 'health' | 'food' | 'egg' | 'meal';

export interface CardEffect {
  // Unconditional, signed resource delta applied regardless of option
  // (negative = cost, positive = gain) — e.g. "-2 food -> +2 health" is
  // two selfDelta entries in one card, or "-2 eggs -> ..." paired with a
  // choiceGain below for the branching part.
  selfDelta?: Partial<Record<Resource, number>>;
  // Player picks option 1 or 2 (playBonusCard/useGrubReward's `option`
  // param, defaults to 1); each side is its own signed resource delta.
  choiceGain?: [Partial<Record<Resource, number>>, Partial<Record<Resource, number>>];
  // Bounded one-time gift to a named teammate — requires targetPlayerId
  // (+ `amount` up to maxAmount for the "up to N" cards).
  teammateGain?: { resource: 'food' | 'health' | 'meal'; maxAmount: number };
  // Same as teammateGain but the resource itself depends on the chosen option.
  teammateChoiceGain?: [{ resource: 'food' | 'health' | 'meal'; amount: number }, { resource: 'food' | 'health' | 'meal'; amount: number }];
  // Requires targetType/targetId (a Predator name, or 'inside'/'outside' for a Grub).
  enemyDamage?: number;
  extraActions?: number;
  // Option 1: gain `baseEggGain` eggs. Option 2: discard a 2nd held Bonus
  // Card (discardExtraCardIndex) for `eggsGained` eggs instead.
  discardExtraForBonus?: { baseEggGain: number; eggsGained: number };
  // Option 1: gain 1 egg. Option 2: immune to negative weather until this
  // player's own next turn begins.
  eggOrWeatherImmune?: boolean;
  drawBonusCards?: { draw: number; keep: number; giveTeammate: number }; // Dragonfly/Mosquitoes
  // Requires targetType/targetId (a Predator name, or 'inside'/'outside' for
  // a Grub) — declaring the target up front is what lets Owl Coopone's
  // "cannot use Bonus/Grub Cards to dodge" reject the play outright instead
  // of silently no-op'ing once the return attack actually lands.
  dodgeNextAttack?: boolean; // pending — PlayerState.pendingDodgeNextAttack
  grantsFreeAttackPoint?: boolean; // pending — pendingFreeAttackPoint
  reducesPredatorRoll?: 1 | 2; // pending — pendingPredatorRollReduction
  reducesIncomingDamage?: number; // pending — pendingIncomingDamageReduction
  rerollNextOwnRoll?: boolean; // pending — pendingRerollNextRoll
  ignoresPredatorRollEffectsNextAttack?: boolean; // Scorpion — pending, pendingIgnorePredatorRoll
  reflectsReturnAttackNextAttack?: boolean; // Wasp Swarm — pending, pendingReflectReturnAttack
  // Permanent, one-time-patch Grub Rewards (same treatment as phase 6's
  // permanent Loot Drop stat boosts).
  permanentEggProductionBonus?: number; // Caterpillar
  permanentReturnAttackReductionRoll?: { threshold: number; amount: number }; // Roly Poly
  permanentNoBonusCardHandLimit?: boolean; // Large Spider
  permanentForageBonusUntilNextWeather?: number; // Lizard
  immuneToWeatherUntilNextCard?: boolean; // Lunar Moth
  ladybugRoll?: boolean; // roll 3 dice: eggs += roll1, food += roll2, health -= roll3
  permanentTagAlongUnlocked?: boolean; // Garden Snail — same shape as chicken Smallest Chicken, see the tagAlong action
  // Phase 11f: sets targetPlayerId's pendingRollIntercept — requires
  // targetPlayerId; "Pick the outcome" additionally requires `amount` (1-6).
  rerollTargetPlayerNextRoll?: boolean; // "Reroll a teammate's die" / "Reroll any die" Bonus Cards
  pickTargetPlayerNextRollOutcome?: boolean; // Spotted Lanternfly

  // Phase 11g: on-demand shared-deck manipulation.
  drawsNewWeatherCard?: boolean; // "Draw new weather" Bonus Card
  // Dung Beetle: takes a specific card from the Bonus discard pile —
  // `discardExtraCardIndex` (an index into bonusDeck.discard) is reused
  // here as "which discarded card to take," same field, different pile.
  takeSpecificBonusCardFromDiscard?: boolean;
  // Firefly: option 1 redraws weather, option 2 calls an ad-hoc Egg
  // Exchange for the caster only (outside the normal phase-boundary cadence).
  redrawWeatherOrCallEggExchange?: boolean;
  // Phase 11i: "For 1 Turn, borrow an unlocked ability from a teammate" —
  // requires targetPlayerId; `amount` (1-3) picks which of their unlocked
  // stages' abilities, defaulting to their current (highest) stage.
  borrowsTeammateAbility?: boolean;
  // "Move everyone for free" Bonus Card — grants every alive player a
  // pendingFreeMove, consumed by useFreeMoveGrant.
  grantsFreeMoveToEveryone?: boolean;
  // Lucky Cricket: copies whatever effect a chosen held Bonus Card of a
  // chosen teammate's has — requires targetPlayerId + discardExtraCardIndex
  // (reused here as "which of their held cards," same reuse pattern Dung
  // Beetle uses for the discard pile). Handled specially in useGrubReward,
  // not the generic resolveCardEffect dispatch, since the effect to apply
  // isn't known until the target card is looked up.
  copiesTeammateBonusCardEffect?: boolean;
  // Four Leaf Clover: "For 1 turn, perform all actions Outside" — sets
  // PlayerState.pendingMayActAsInsideThisTurn, cleared at this player's
  // own endTurn.
  grantsInsideActionsOutsideForTurn?: boolean;
}

export interface WeatherEffect {
  // Immunity classification helper: which chickens are immune is looked
  // up from CHICKEN_ABILITIES; this just flags whether this card counts
  // as "negative" for Dandy's blanket immunity (positive cards — Fair,
  // Sunny, Snow — are never blocked by anything, so this only matters for
  // everything else, i.e. defaults to true / negative unless noted).
  positive?: boolean;

  // rollIntercepted: set true when the hook actually rolled and consumed a
  // pending roll intercept (Strategem/Deus Eggs Machina/etc.) — Tornado
  // rolls, Earthquake doesn't, so the caller (turn.ts) needs this to know
  // whether to clear PlayerState.pendingRollIntercept afterward.
  onTurnStart?: (ctx: AbilityContext, rng: RNG) => { actionsDelta?: number; discardAndRedrawBonusCard?: boolean; rollIntercepted?: boolean };
  // Nighttime/Sunny: "once during this phase," not every turn — gated by
  // PlayerState.weatherAdjustmentUsedThisPhase, reset when a new card is drawn.
  turnStartOncePerPhase?: boolean;
  onProductionThreshold?: number; // Daylight Savings — overrides the roll threshold to hit
  onForageCost?: number; // Drought — action cost override (default 1)
  onFirstForageThisTurn?: { bonusFood: number }; // Fair
  onAttack?: (ctx: CombatContext, rng: RNG) => CombatStageResult; // Fog
  onTurnEnd?: (
    ctx: AbilityContext,
    rng: RNG,
  ) => { healthLoss?: number; discardChoice?: ('food' | 'egg')[]; rollIntercepted?: boolean }; // Hail/Lightning Storm/Severe Wind — gated by ending Outside, checked by the caller
  onTurnEndRequiresOutside?: boolean;
  onPhaseEnd?: () => { discardAllFood?: boolean }; // Flash Flood — group-wide, no per-player context needed
  skipNextEggExchange?: boolean; // Pouring Rain
  eggExchangeBonusFoodIfParticipating?: number; // Snow
  blocksMoveToLocation?: Location; // Heat Wave: cannot move (back) into Coop
  blocksGrubAttacks?: boolean; // Pollen
  maxAttackStrengthDelta?: number; // Dust Storm
  onDayEndProximityDamage?: number; // Bird Flu — anyone who ends the day near another player loses this much health
  forcesCoopLockdown?: boolean; // Freezing — everyone not immune snaps to Coop and can't leave while active
  allowsEatInside?: boolean; // Freezing — overrides Eat's normal Outside-only requirement while in the Coop
  discardBothGrubsDaily?: boolean; // Ice Melts — both locations' face-up Grubs discard at day's end, not just the chosen one
  dealsPersonalWeatherOnDraw?: boolean; // Mudslide — see abilities/weather.ts's drawNextWeatherCard
}
