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
}

export interface PredatorLoot {
  permanentAttackBonus?: number; // Brass Knuckles
  permanentMaxHealthBonus?: number; // Signature Cloak
  returnAttackReduction?: number; // Bandit Mask — passive, dynamic (not a one-time patch)
  // Gas Mask (single-use, player-activated) is deferred to phase 7's
  // held-effect-playing mechanism — its grant already works (phase 4).
}

export interface ChickenAbility {
  // Setup-time grants (createPlayer)
  startingFood?: number;
  startingEggs?: number;
  startingBonusCards?: number;
  mayChooseStartingLocation?: boolean; // Traveler

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
  dodgeNextAttack?: boolean; // pending — PlayerState.pendingDodgeNextAttack
  grantsFreeAttackPoint?: boolean; // pending — pendingFreeAttackPoint
  reducesPredatorRoll?: 1 | 2; // pending — pendingPredatorRollReduction
  reducesIncomingDamage?: number; // pending — pendingIncomingDamageReduction
  rerollNextOwnRoll?: boolean; // pending — pendingRerollNextRoll
  ignoresPredatorRollEffectsNextAttack?: boolean; // Scorpion — pending, pendingIgnorePredatorRoll
  // Permanent, one-time-patch Grub Rewards (same treatment as phase 6's
  // permanent Loot Drop stat boosts).
  permanentEggProductionBonus?: number; // Caterpillar
  permanentReturnAttackReductionRoll?: { threshold: number; amount: number }; // Roly Poly
  permanentNoBonusCardHandLimit?: boolean; // Large Spider
  permanentForageBonusUntilNextWeather?: number; // Lizard
  immuneToWeatherUntilNextCard?: boolean; // Lunar Moth
  ladybugRoll?: boolean; // roll 3 dice: eggs += roll1, food += roll2, health -= roll3
}

export interface WeatherEffect {
  // Immunity classification helper: which chickens are immune is looked
  // up from CHICKEN_ABILITIES; this just flags whether this card counts
  // as "negative" for Dandy's blanket immunity (positive cards — Fair,
  // Sunny, Snow — are never blocked by anything, so this only matters for
  // everything else, i.e. defaults to true / negative unless noted).
  positive?: boolean;

  onTurnStart?: (ctx: AbilityContext, rng: RNG) => { actionsDelta?: number; discardAndRedrawBonusCard?: boolean };
  // Nighttime/Sunny: "once during this phase," not every turn — gated by
  // PlayerState.weatherAdjustmentUsedThisPhase, reset when a new card is drawn.
  turnStartOncePerPhase?: boolean;
  onProductionThreshold?: number; // Daylight Savings — overrides the roll threshold to hit
  onForageCost?: number; // Drought — action cost override (default 1)
  onFirstForageThisTurn?: { bonusFood: number }; // Fair
  onAttack?: (ctx: CombatContext, rng: RNG) => CombatStageResult; // Fog
  onTurnEnd?: (ctx: AbilityContext, rng: RNG) => { healthLoss?: number; discardChoice?: ('food' | 'egg')[] }; // Hail/Lightning Storm/Severe Wind — gated by ending Outside, checked by the caller
  onTurnEndRequiresOutside?: boolean;
  onPhaseEnd?: () => { discardAllFood?: boolean }; // Flash Flood — group-wide, no per-player context needed
  skipNextEggExchange?: boolean; // Pouring Rain
  eggExchangeBonusFoodIfParticipating?: number; // Snow
  blocksMoveToLocation?: Location; // Heat Wave: cannot move (back) into Coop
  blocksGrubAttacks?: boolean; // Pollen
  maxAttackStrengthDelta?: number; // Dust Storm
}
