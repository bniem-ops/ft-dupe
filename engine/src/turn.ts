// Day/season/phase progression and turn-start production resolution.
// Predator level-up at season end is implemented via combat.ts's
// levelUpPredators. Weather/chicken-ability effects (phase 6) are wired
// in via engine/src/abilities/ — see activeWeatherEffect and
// getActiveChickenAbilities below.
import { GameState, PlayerState, Season, SeasonPhase, GrubDecksState, RNG, rollDie } from './types.js';
import { chickenStage } from './data.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { dealFaceUp, discardFaceUp, maybeReshuffleGrubDecks } from './grubs.js';
import { levelUpPredators, applyDamageAndMaybeDeath } from './combat.js';
import { activeWeatherEffect, activeWeatherName, drawNextWeatherCard } from './abilities/weather.js';
import {
  getActiveChickenAbilities,
  getOwnAndBorrowedAbilities,
  isImmuneToWeather,
  nearbyAuraTeammateRollBonus,
  applyRollIntercept,
} from './abilities/chickens.js';
import { addMeals } from './leveling.js';
import { evaluateGameStatus } from './gameStatus.js';

const SEASON_ORDER: Season[] = ['Spring', 'Summer', 'Fall'];

export function seasonPhaseForDay(day: number): SeasonPhase {
  if (day <= 2) return 1;
  if (day <= 5) return 2;
  return 3;
}

// Egg Exchange + new Weather Card happen before days 1, 3, and 6 of each
// season — except day 1 of Spring, whose starting weather is set at
// createGame instead (core_rules.md).
export function isPhaseBoundaryDay(day: number, season: Season): boolean {
  if (day === 3 || day === 6) return true;
  if (day === 1 && season !== 'Spring') return true;
  return false;
}

// --- Production (turn start) -------------------------------------------

export interface ProductionRollInfo {
  roll: number;
  threshold: number;
  eggAmount: number;
  gained: boolean;
}

// `state` is needed (not just `player`/`rng`) for phase 6's weather
// threshold override (Daylight Savings) and chicken-ability modifiers
// (High Producer's extra roll, Payback/Shake it Off's on-miss trigger).
//
// Returns `pausable: true` (player left untouched, roll not yet applied)
// when this is the plain single-roll case, nothing is already
// pre-committed (pendingRollIntercept/pendingRerollNextRoll), and the
// player holds Strategem/Deus Eggs Machina with an egg to spend — lets the
// caller (startTurn) show the raw roll and let them react instead of
// committing it blind. High Producer's extra-roll stacking always
// auto-resolves (documented simplification, not covered by the reveal
// flow this pass — see docs/engine-plan.md).
export function computeProductionRoll(
  state: GameState,
  player: PlayerState,
  rng: RNG,
): { player: PlayerState; rollInfo: ProductionRollInfo | null; pausable: boolean } {
  if (player.stage === 1) {
    // Chick production is universally "+1 food" (confirmed in every
    // chicken's data, per chickens_template.txt's instructions) — no
    // roll at all, so nothing here for weather/ability rolls to modify.
    return { player: { ...player, food: player.food + 1 }, rollInfo: null, pausable: false };
  }
  const stageData = chickenStage(player.chickenName, player.stage);
  const production = stageData.production ?? '';
  const match = production.match(/Roll \d+ die:\s*(\d+)-6\s*=\s*\+(\d+)\s*egg/i);
  if (!match) return { player, rollInfo: null, pausable: false };
  const eggAmount = parseInt(match[2], 10);

  const weather = activeWeatherEffect(state, player.id);
  const threshold = weather?.onProductionThreshold ?? parseInt(match[1], 10);

  const abilities = getActiveChickenAbilities(player.chickenName, player.stage);
  const totalRolls = 1 + abilities.reduce((sum, a) => sum + (a.extraProductionRolls ?? 0), 0);
  const battleCryBonus = nearbyAuraTeammateRollBonus(state, player.id); // Battle Cry
  const hadPreCommit = !!player.pendingRollIntercept || player.pendingRerollNextRoll;

  if (
    totalRolls === 1 &&
    !hadPreCommit &&
    player.eggs >= 1 &&
    getOwnAndBorrowedAbilities(player).some((a) => a.canAdjustAnyRollForEggs || a.canRerollAnyRollForEgg)
  ) {
    // rollInfo.roll is the raw d6 (what a physical die would show) — bonuses
    // are folded in only for the gained comparison, not the displayed/
    // adjustable value, so Strategem's clamp-to-1-6 and the reveal UI both
    // stay honest to an actual die.
    const baseRoll = rollDie(rng);
    const gained = baseRoll + player.permanentEggProductionBonus + battleCryBonus >= threshold;
    return { player, rollInfo: { roll: baseRoll, threshold, eggAmount, gained }, pausable: true };
  }

  let updated = player;
  let anyHit = false;
  let rerollAvailable = player.pendingRerollNextRoll;
  let interceptAvailable = !!player.pendingRollIntercept;
  let firstRoll = 0;
  for (let i = 0; i < totalRolls; i++) {
    let baseRoll = rollDie(rng);
    if (rerollAvailable) {
      baseRoll = Math.max(baseRoll, rollDie(rng));
      rerollAvailable = false;
      updated = { ...updated, pendingRerollNextRoll: false };
    }
    if (interceptAvailable) {
      const applied = applyRollIntercept(updated, baseRoll, rng);
      baseRoll = applied.roll;
      updated = applied.player;
      interceptAvailable = false;
    }
    const roll = baseRoll + player.permanentEggProductionBonus + battleCryBonus;
    if (i === 0) firstRoll = baseRoll;
    if (roll >= threshold) {
      updated = { ...updated, eggs: updated.eggs + eggAmount };
      anyHit = true;
    }
  }

  if (!anyHit) {
    for (const ability of abilities) {
      if (!ability.onProductionMiss) continue;
      const result = ability.onProductionMiss({ state, playerId: player.id });
      if (result.food) updated = { ...updated, food: updated.food + result.food };
      if (result.meals) updated = addMeals(updated, result.meals);
      if (result.heal) updated = { ...updated, health: Math.min(updated.maxHealth, updated.health + result.heal) };
    }
  }

  return { player: updated, rollInfo: { roll: firstRoll, threshold, eggAmount, gained: anyHit }, pausable: false };
}

// Finalizes a paused pendingProductionReveal once the player responds
// (keep/reroll/adjust) — same single-roll apply-or-miss semantics as
// computeProductionRoll's non-paused branch above, factored out since
// actions.ts's resolveProductionReveal needs it too.
export function applyProductionOutcome(state: GameState, player: PlayerState, gained: boolean, eggAmount: number): PlayerState {
  if (gained) return { ...player, eggs: player.eggs + eggAmount };
  let updated = player;
  const abilities = getActiveChickenAbilities(player.chickenName, player.stage);
  for (const ability of abilities) {
    if (!ability.onProductionMiss) continue;
    const result = ability.onProductionMiss({ state, playerId: player.id });
    if (result.food) updated = { ...updated, food: updated.food + result.food };
    if (result.meals) updated = addMeals(updated, result.meals);
    if (result.heal) updated = { ...updated, health: Math.min(updated.maxHealth, updated.health + result.heal) };
  }
  return updated;
}

// Back-compat wrapper — many existing tests/callers expect the old
// signature (resolves fully, no pause). startTurn uses
// computeProductionRoll/applyProductionOutcome directly instead, to
// implement the reveal-then-react pause.
export function resolveProduction(state: GameState, player: PlayerState, rng: RNG): PlayerState {
  const { player: computed, rollInfo, pausable } = computeProductionRoll(state, player, rng);
  if (!pausable || !rollInfo) return computed;
  return applyProductionOutcome(state, computed, rollInfo.gained, rollInfo.eggAmount);
}

function discardAndRedrawOneBonusCard(state: GameState, playerId: string): GameState {
  const player = getPlayer(state.players, playerId);
  if (player.bonusCardHand.length === 0) return state;
  const [discarded, ...remainingHand] = player.bonusCardHand;
  let { drawPile, discard } = state.bonusDeck;
  discard = [...discard, discarded];
  if (drawPile.length === 0) {
    drawPile = [...discard];
    discard = [];
  }
  const [newCardId, ...rest] = drawPile;
  const updatedHand = newCardId != null ? [...remainingHand, newCardId] : remainingHand;
  return {
    ...state,
    players: replacePlayer(state.players, { ...player, bonusCardHand: updatedHand }),
    bonusDeck: { drawPile: rest, discard },
  };
}

export function startTurn(state: GameState): GameState {
  const playerId = state.turnOrder[state.currentPlayerIndex];
  const player = getPlayer(state.players, playerId);

  if (player.skipNextTurn) {
    const cleared = { ...player, skipNextTurn: false };
    return { ...state, players: replacePlayer(state.players, cleared), actionsRemainingThisTurn: 0 };
  }

  let next: GameState = {
    ...state,
    players: replacePlayer(state.players, {
      ...player,
      foragedThisTurn: false,
      pendingWeatherImmuneUntilNextTurn: false,
      actionCountsThisTurn: {}, // Dedication — counted per turn, not cumulative
    }),
  };
  let actionsDelta = 0;

  // turnStartOncePerPhase effects (Sunny, Nighttime) are NOT applied here
  // automatically — per clarified rules, the player chooses which one of
  // their turns in the phase to take the bonus/reduced action on, via the
  // explicit useWeatherActionAdjustment action below. Only ordinary
  // per-turn onTurnStart effects (Tornado's random -1, Earthquake's
  // redraw) still fire automatically on every turn.
  const weather = activeWeatherEffect(next, playerId);
  if (weather?.onTurnStart && !weather.turnStartOncePerPhase) {
    const current = getPlayer(next.players, playerId);
    const immune =
      isImmuneToWeather(current.chickenName, current.stage, activeWeatherName(next, playerId) ?? '', weather.positive ?? false) ||
      current.pendingWeatherImmuneUntilNextTurn ||
      current.permanentWeatherImmuneUntilNextCard;
    if (!immune) {
      const result = weather.onTurnStart({ state: next, playerId }, next.config.rng);
      actionsDelta += result.actionsDelta ?? 0;
      if (result.discardAndRedrawBonusCard) {
        next = discardAndRedrawOneBonusCard(next, playerId);
      }
      if (result.rollIntercepted) {
        next = { ...next, players: replacePlayer(next.players, { ...getPlayer(next.players, playerId), pendingRollIntercept: null }) };
      }
    }
  }

  const { player: withProduction, rollInfo, pausable } = computeProductionRoll(next, getPlayer(next.players, playerId), next.config.rng);
  if (pausable && rollInfo) {
    // Leave the roll unapplied — the player reacts via resolveProductionReveal.
    next = { ...next, players: replacePlayer(next.players, { ...withProduction, pendingProductionReveal: { ...rollInfo } }) };
  } else {
    next = { ...next, players: replacePlayer(next.players, withProduction) };
    if (rollInfo) {
      next = {
        ...next,
        actionLog: [...next.actionLog, { type: 'productionRoll', playerId, roll: rollInfo.roll, threshold: rollInfo.threshold, eggAmount: rollInfo.eggAmount, gained: rollInfo.gained }],
      };
    }
  }

  return { ...next, actionsRemainingThisTurn: Math.max(0, 2 + actionsDelta) };
}

// Consumes the once-per-season Extra Action Token for one bonus action
// this turn. Refreshing it early (e.g. Princess Layer's Nobility ability)
// is phase 5 — this is just the base once-per-season grant/spend.
export function useExtraActionToken(state: GameState, playerId: string): GameState {
  const player = getPlayer(state.players, playerId);
  if (!player.extraActionTokenAvailable) throw new Error(`${playerId} has no Extra Action Token available this season`);
  const updated = { ...player, extraActionTokenAvailable: false };
  return {
    ...state,
    players: replacePlayer(state.players, updated),
    actionsRemainingThisTurn: state.actionsRemainingThisTurn + 1,
  };
}

// Sunny/Nighttime: "once during this phase" — but the player picks which
// of their turns in the phase it lands on, rather than it being forced on
// their first turn. Same once-per-phase gate (weatherAdjustmentUsedThisPhase)
// as before, just triggered explicitly instead of automatically in startTurn.
export function useWeatherActionAdjustment(state: GameState, playerId: string): GameState {
  if (state.turnOrder[state.currentPlayerIndex] !== playerId) {
    throw new Error(`It is not ${playerId}'s turn`);
  }
  const player = getPlayer(state.players, playerId);
  if (!player.alive) throw new Error(`${playerId} is not alive`);
  const weather = activeWeatherEffect(state, playerId);
  if (!weather?.turnStartOncePerPhase || !weather.onTurnStart) {
    throw new Error('No discretionary weather action-adjustment is available right now');
  }
  if (player.weatherAdjustmentUsedThisPhase) {
    throw new Error(`${playerId} has already used this phase's weather action adjustment`);
  }
  const immune =
    isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(state, playerId) ?? '', weather.positive ?? false) ||
    player.pendingWeatherImmuneUntilNextTurn ||
    player.permanentWeatherImmuneUntilNextCard;
  if (immune) throw new Error(`${playerId} is immune to the active weather`);

  const result = weather.onTurnStart({ state, playerId }, state.config.rng);
  const updatedPlayer = { ...player, weatherAdjustmentUsedThisPhase: true };
  return {
    ...state,
    players: replacePlayer(state.players, updatedPlayer),
    actionsRemainingThisTurn: Math.max(0, state.actionsRemainingThisTurn + (result.actionsDelta ?? 0)),
  };
}

export interface EndTurnOptions {
  // Severe Wind requires discarding one or the other when ending your
  // turn Outside — optional override for a future UI prompt; defaults to
  // whichever resource the player actually has (food preferred) so
  // existing callers that don't know about this yet keep working rather
  // than needing to supply it.
  severeWindDiscard?: 'food' | 'egg';
}

// Cycles to the next player within the same day. Day/season rollover is
// the caller's responsibility via advanceDay once every player has gone.
// Also resolves the ending player's end-of-turn weather trigger (Hail,
// Lightning Storm, Severe Wind), gated on their final location.
export function endTurn(state: GameState, options?: EndTurnOptions): GameState {
  const playerId = state.turnOrder[state.currentPlayerIndex];
  let next = state;
  const player = getPlayer(next.players, playerId);
  const weather = activeWeatherEffect(next, playerId);
  const immune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(next, playerId) ?? '', weather.positive ?? false) ||
      player.pendingWeatherImmuneUntilNextTurn ||
      player.permanentWeatherImmuneUntilNextCard
    : false;

  if (weather?.onTurnEnd && !immune && (!weather.onTurnEndRequiresOutside || player.location !== 'Coop')) {
    const result = weather.onTurnEnd({ state: next, playerId }, next.config.rng);
    let updated = player;
    if (result.healthLoss) {
      updated = applyDamageAndMaybeDeath(updated, result.healthLoss);
    }
    if (result.discardChoice && result.discardChoice.length > 0) {
      const choice = options?.severeWindDiscard ?? (updated.food > 0 ? 'food' : updated.eggs > 0 ? 'egg' : null);
      if (choice === 'food') updated = { ...updated, food: updated.food - 1 };
      else if (choice === 'egg') updated = { ...updated, eggs: updated.eggs - 1 };
    }
    if (result.rollIntercepted) updated = { ...updated, pendingRollIntercept: null };
    next = { ...next, players: replacePlayer(next.players, updated) };
  }

  // core_rules.md's revival clause: a just-revived player must complete
  // their first turn back before they count as "truly" alive for the win
  // check — this is that turn's completion.
  // "For 1 Turn, borrow an unlocked ability" and Four Leaf Clover's "for 1
  // turn, perform all actions Outside" also expire here.
  const ending = getPlayer(next.players, playerId);
  if (ending.justRevivedPendingFirstTurn || ending.pendingBorrowedAbility || ending.pendingMayActAsInsideThisTurn) {
    next = {
      ...next,
      players: replacePlayer(next.players, {
        ...ending,
        justRevivedPendingFirstTurn: false,
        pendingBorrowedAbility: null,
        pendingMayActAsInsideThisTurn: false,
      }),
    };
  }

  const nextIndex = (next.currentPlayerIndex + 1) % next.turnOrder.length;
  return { ...next, ...evaluateGameStatus(next), currentPlayerIndex: nextIndex };
}

export function isLastPlayerOfDay(state: GameState): boolean {
  return state.currentPlayerIndex === state.turnOrder.length - 1;
}

// --- Egg Exchange --------------------------------------------------------

// `rate` is food gained per egg exchanged (default 1:1; Superior Product
// makes it 2 — "your eggs are worth 2x food during the Egg Exchange").
export function applyEggExchange(player: PlayerState, amount: number, rate = 1): PlayerState {
  if (amount < 0 || amount > player.eggs) {
    throw new Error(`${player.id} cannot exchange ${amount} eggs (has ${player.eggs})`);
  }
  return { ...player, eggs: player.eggs - amount, food: player.food + amount * rate };
}

// --- Grub daily discard ---------------------------------------------------

// Ice Melts (Eggspansion): "At end of each day, discard the Grubs in both
// locations" — overrides the normal single-side daily discard for its
// duration.
function performDailyGrubDiscard(decks: GrubDecksState, side: 'inside' | 'outside', rng: RNG, discardBoth: boolean): GrubDecksState {
  const sides: ('inside' | 'outside')[] = discardBoth ? ['inside', 'outside'] : [side];
  let updated = decks;
  for (const s of sides) {
    updated = { ...updated, [s]: discardFaceUp(updated[s]) };
  }
  updated = maybeReshuffleGrubDecks(updated, rng);
  for (const s of sides) {
    updated = { ...updated, [s]: dealFaceUp(updated[s]) };
  }
  return updated;
}

// --- Day / season advancement ---------------------------------------------

export interface AdvanceDayOptions {
  // Which side's face-up Grub gets discarded today (player's choice, per
  // core_rules.md) — required every day.
  discardSide: 'inside' | 'outside';
  // Egg Exchange trades to apply if the new day is a phase-boundary day;
  // ignored otherwise.
  exchanges?: { playerId: string; amount: number }[];
}

// Call once every player has taken their turn for the day (see
// isLastPlayerOfDay + endTurn). Handles: daily Grub discard/redeal,
// Weathervane/day/season rollover, phase-boundary Egg Exchange + weather
// draw, and predator level-up at end of Spring/Summer.
export function advanceDay(state: GameState, options: AdvanceDayOptions): GameState {
  const discardBothGrubs = !!activeWeatherEffect(state)?.discardBothGrubsDaily; // Ice Melts
  let next: GameState = {
    ...state,
    grubDecks: performDailyGrubDiscard(state.grubDecks, options.discardSide, state.config.rng, discardBothGrubs),
    // Gas Mask's "-1 return attack for an entire day" ends here, every day,
    // regardless of who used it or which Predator it targeted.
    predators: state.predators.map((p) =>
      p.returnAttackReductionToday || p.cannotBeAttackedToday
        ? { ...p, returnAttackReductionToday: 0, cannotBeAttackedToday: false }
        : p,
    ),
  };

  // Bird Flu: "Anyone who ends the day near another player loses 1 heart" —
  // a proximity check between different players at every day's end (not
  // just phase boundaries), gated by the usual weather-immunity checks plus
  // Free Range's location-wide immunity grant.
  const dayEndWeather = activeWeatherEffect(next);
  if (dayEndWeather?.onDayEndProximityDamage) {
    const weatherName = activeWeatherName(next) ?? '';
    const damage = dayEndWeather.onDayEndProximityDamage;
    let players = next.players;
    for (const player of next.players) {
      if (!player.alive) continue;
      const hasNeighbor = next.players.some((other) => other.id !== player.id && other.alive && other.location === player.location);
      if (!hasNeighbor) continue;
      const grantedImmunity = next.players.some(
        (p2) =>
          p2.alive &&
          p2.location === player.location &&
          getActiveChickenAbilities(p2.chickenName, p2.stage).some((a) => a.grantsNearbyImmunity?.includes(weatherName)),
      );
      const immune =
        grantedImmunity ||
        isImmuneToWeather(player.chickenName, player.stage, weatherName, dayEndWeather.positive ?? false) ||
        player.pendingWeatherImmuneUntilNextTurn ||
        player.permanentWeatherImmuneUntilNextCard;
      if (immune) continue;
      players = players.map((p) => (p.id === player.id ? applyDamageAndMaybeDeath(p, damage) : p));
    }
    next = { ...next, players };
  }

  let { day, season } = next;
  day += 1;

  if (day > 7) {
    const seasonIndex = SEASON_ORDER.indexOf(season);
    if (seasonIndex === SEASON_ORDER.length - 1) {
      // End of Fall day 7 — the season timing out before all Predators
      // are defeated is a loss (core_rules.md) — unless a win already
      // landed earlier that same day via applyAction, which this
      // preserves rather than overwrites.
      return { ...next, day: 7, phase: 3, gameOver: true, won: next.gameOver ? next.won : false };
    }
    // Season rollover: Weathervane resets to day 1, Extra Action Tokens
    // refresh for everyone, and every surviving Predator levels up
    // (core_rules.md: "End of Spring and Summer: every surviving
    // Predator levels up").
    day = 1;
    season = SEASON_ORDER[seasonIndex + 1];
    next = {
      ...next,
      players: next.players.map((p) => ({ ...p, extraActionTokenAvailable: true })),
      predators: levelUpPredators(next.predators, next.players.length, next.config.difficulty),
    };
  }

  next = { ...next, day, season, phase: seasonPhaseForDay(day) };

  if (isPhaseBoundaryDay(day, season)) {
    // The Egg Exchange happening right now wraps up the phase that just
    // ended, so it's still governed by the OUTGOING weather card (Flash
    // Flood's end-of-phase wipe, Pouring Rain's skip, Snow's bonus) — the
    // new card is drawn immediately after, for the upcoming phase. Resolved
    // per-player (not once table-wide) since under Mudslide each player's
    // outgoing card can differ from everyone else's.
    next = {
      ...next,
      players: next.players.map((p) => (activeWeatherEffect(next, p.id)?.onPhaseEnd?.().discardAllFood ? { ...p, food: 0 } : p)),
    };

    for (const exchange of options.exchanges ?? []) {
      const player = getPlayer(next.players, exchange.playerId);
      if (player.statusEffectsUntilNextEggExchange.includes('cannotParticipateInEggExchange')) continue;
      const playerOutgoingWeather = activeWeatherEffect(next, player.id);
      const playerOutgoingWeatherName = activeWeatherName(next, player.id) ?? '';
      // Pouring Rain skips the exchange group-wide, except for a player
      // immune to it (Long Legs) — checked per-player, not gated globally.
      if (
        playerOutgoingWeather?.skipNextEggExchange &&
        !isImmuneToWeather(player.chickenName, player.stage, playerOutgoingWeatherName, playerOutgoingWeather.positive ?? false) &&
        !player.pendingWeatherImmuneUntilNextTurn &&
        !player.permanentWeatherImmuneUntilNextCard
      ) {
        continue;
      }
      const rate = getActiveChickenAbilities(player.chickenName, player.stage).reduce((r, a) => a.eggExchangeRate ?? r, 1);
      let traded = applyEggExchange(player, exchange.amount, rate);
      if (playerOutgoingWeather?.eggExchangeBonusFoodIfParticipating && exchange.amount > 0) {
        traded = { ...traded, food: traded.food + playerOutgoingWeather.eggExchangeBonusFoodIfParticipating };
      }
      next = { ...next, players: replacePlayer(next.players, traded) };
    }

    // Every "...until the next Egg Exchange" status clears now — this is
    // the calendar event that ends them, regardless of who exchanged.
    next = { ...next, players: next.players.map((p) => ({ ...p, statusEffectsUntilNextEggExchange: [] })) };

    next = drawNextWeatherCard(next, season);
    next = {
      ...next,
      players: next.players.map((p) => ({
        ...p,
        weatherAdjustmentUsedThisPhase: false,
        // Lunar Moth's Reward and Lizard's Reward are both scoped "until
        // a new weather card is drawn" — this is that clearing point.
        permanentWeatherImmuneUntilNextCard: false,
        permanentForageBonusUntilNextWeather: 0,
      })),
    };
  }

  return next;
}
