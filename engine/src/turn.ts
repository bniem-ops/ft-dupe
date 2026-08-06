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
import { activeWeatherEffect, activeWeatherName } from './abilities/weather.js';
import { getActiveChickenAbilities, isImmuneToWeather } from './abilities/chickens.js';
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

// `state` is needed (not just `player`/`rng`) for phase 6's weather
// threshold override (Daylight Savings) and chicken-ability modifiers
// (High Producer's extra roll, Payback/Shake it Off's on-miss trigger).
export function resolveProduction(state: GameState, player: PlayerState, rng: RNG): PlayerState {
  if (player.stage === 1) {
    // Chick production is universally "+1 food" (confirmed in every
    // chicken's data, per chickens_template.txt's instructions) — no
    // roll at all, so nothing here for weather/ability rolls to modify.
    return { ...player, food: player.food + 1 };
  }
  const stageData = chickenStage(player.chickenName, player.stage);
  const production = stageData.production ?? '';
  const match = production.match(/Roll \d+ die:\s*(\d+)-6\s*=\s*\+(\d+)\s*egg/i);
  if (!match) return player;
  const eggAmount = parseInt(match[2], 10);

  const weather = activeWeatherEffect(state);
  const threshold = weather?.onProductionThreshold ?? parseInt(match[1], 10);

  const abilities = getActiveChickenAbilities(player.chickenName, player.stage);
  const totalRolls = 1 + abilities.reduce((sum, a) => sum + (a.extraProductionRolls ?? 0), 0);

  let updated = player;
  let anyHit = false;
  let rerollAvailable = player.pendingRerollNextRoll;
  for (let i = 0; i < totalRolls; i++) {
    let roll = rollDie(rng) + player.permanentEggProductionBonus;
    if (rerollAvailable) {
      roll = Math.max(roll, rollDie(rng) + player.permanentEggProductionBonus);
      rerollAvailable = false;
      updated = { ...updated, pendingRerollNextRoll: false };
    }
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

  return updated;
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
    players: replacePlayer(state.players, { ...player, foragedThisTurn: false, pendingWeatherImmuneUntilNextTurn: false }),
  };
  let actionsDelta = 0;

  const weather = activeWeatherEffect(next);
  if (weather?.onTurnStart) {
    const current = getPlayer(next.players, playerId);
    const immune =
      isImmuneToWeather(current.chickenName, current.stage, activeWeatherName(next) ?? '', weather.positive ?? false) ||
      current.pendingWeatherImmuneUntilNextTurn ||
      current.permanentWeatherImmuneUntilNextCard;
    const canApply = !immune && (!weather.turnStartOncePerPhase || !current.weatherAdjustmentUsedThisPhase);
    if (canApply) {
      const result = weather.onTurnStart({ state: next, playerId }, next.config.rng);
      actionsDelta += result.actionsDelta ?? 0;
      const updatedPlayer = weather.turnStartOncePerPhase
        ? { ...current, weatherAdjustmentUsedThisPhase: true }
        : current;
      next = { ...next, players: replacePlayer(next.players, updatedPlayer) };
      if (result.discardAndRedrawBonusCard) {
        next = discardAndRedrawOneBonusCard(next, playerId);
      }
    }
  }

  const withProduction = resolveProduction(next, getPlayer(next.players, playerId), next.config.rng);
  next = { ...next, players: replacePlayer(next.players, withProduction) };

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
  const weather = activeWeatherEffect(next);
  const immune = weather
    ? isImmuneToWeather(player.chickenName, player.stage, activeWeatherName(next) ?? '', weather.positive ?? false) ||
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
    next = { ...next, players: replacePlayer(next.players, updated) };
  }

  // core_rules.md's revival clause: a just-revived player must complete
  // their first turn back before they count as "truly" alive for the win
  // check — this is that turn's completion.
  const ending = getPlayer(next.players, playerId);
  if (ending.justRevivedPendingFirstTurn) {
    next = { ...next, players: replacePlayer(next.players, { ...ending, justRevivedPendingFirstTurn: false }) };
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

// --- Weather --------------------------------------------------------------

function drawNextWeatherCard(state: GameState, season: Season): GameState {
  const deck = [...state.weather.seasonDecks[season]];
  const cardIndex = deck.shift();
  if (cardIndex == null) return state; // deck exhausted — shouldn't happen within 3 seasons' draw counts
  return {
    ...state,
    weather: {
      seasonDecks: { ...state.weather.seasonDecks, [season]: deck },
      active: { season, cardIndex },
    },
  };
}

// --- Grub daily discard ---------------------------------------------------

function performDailyGrubDiscard(decks: GrubDecksState, side: 'inside' | 'outside', rng: RNG): GrubDecksState {
  let updated: GrubDecksState = { ...decks, [side]: discardFaceUp(decks[side]) };
  updated = maybeReshuffleGrubDecks(updated, rng);
  updated = { ...updated, [side]: dealFaceUp(updated[side]) };
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
  let next: GameState = {
    ...state,
    grubDecks: performDailyGrubDiscard(state.grubDecks, options.discardSide, state.config.rng),
  };

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
    // new card is drawn immediately after, for the upcoming phase.
    const outgoingWeather = activeWeatherEffect(next);

    if (outgoingWeather?.onPhaseEnd?.().discardAllFood) {
      next = { ...next, players: next.players.map((p) => ({ ...p, food: 0 })) };
    }

    const outgoingWeatherName = activeWeatherName(next) ?? '';
    for (const exchange of options.exchanges ?? []) {
      const player = getPlayer(next.players, exchange.playerId);
      if (player.statusEffectsUntilNextEggExchange.includes('cannotParticipateInEggExchange')) continue;
      // Pouring Rain skips the exchange group-wide, except for a player
      // immune to it (Long Legs) — checked per-player, not gated globally.
      if (
        outgoingWeather?.skipNextEggExchange &&
        !isImmuneToWeather(player.chickenName, player.stage, outgoingWeatherName, outgoingWeather.positive ?? false) &&
        !player.pendingWeatherImmuneUntilNextTurn &&
        !player.permanentWeatherImmuneUntilNextCard
      ) {
        continue;
      }
      const rate = getActiveChickenAbilities(player.chickenName, player.stage).reduce((r, a) => a.eggExchangeRate ?? r, 1);
      let traded = applyEggExchange(player, exchange.amount, rate);
      if (outgoingWeather?.eggExchangeBonusFoodIfParticipating && exchange.amount > 0) {
        traded = { ...traded, food: traded.food + outgoingWeather.eggExchangeBonusFoodIfParticipating };
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
