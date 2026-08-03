// Day/season/phase progression and turn-start production resolution.
// Ability/card effects are deliberately NOT implemented here (phase 6) —
// see the comments below marking where those hook in. Predator level-up
// at season end is implemented via combat.ts's levelUpPredators.
import { GameState, PlayerState, Season, SeasonPhase, GrubDecksState, RNG, rollDie } from './types.js';
import { chickenStage } from './data.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { dealFaceUp, discardFaceUp, maybeReshuffleGrubDecks } from './grubs.js';
import { levelUpPredators } from './combat.js';

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

export function resolveProduction(player: PlayerState, rng: RNG): PlayerState {
  if (player.stage === 1) {
    // Chick production is universally "+1 food" (confirmed in every
    // chicken's data, per chickens_template.txt's instructions).
    return { ...player, food: player.food + 1 };
  }
  const stageData = chickenStage(player.chickenName, player.stage);
  const production = stageData.production ?? '';
  const match = production.match(/Roll \d+ die:\s*(\d+)-6\s*=\s*\+(\d+)\s*egg/i);
  if (!match) return player;
  const threshold = parseInt(match[1], 10);
  const eggAmount = parseInt(match[2], 10);
  if (rollDie(rng) >= threshold) return { ...player, eggs: player.eggs + eggAmount };
  return player;
}

export function startTurn(state: GameState): GameState {
  const playerId = state.turnOrder[state.currentPlayerIndex];
  const player = getPlayer(state.players, playerId);

  if (player.skipNextTurn) {
    const cleared = { ...player, skipNextTurn: false };
    return { ...state, players: replacePlayer(state.players, cleared), actionsRemainingThisTurn: 0 };
  }

  const withProduction = resolveProduction(player, state.config.rng);
  return { ...state, players: replacePlayer(state.players, withProduction), actionsRemainingThisTurn: 2 };
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

// Cycles to the next player within the same day. Day/season rollover is
// the caller's responsibility via advanceDay once every player has gone.
export function endTurn(state: GameState): GameState {
  const nextIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
  return { ...state, currentPlayerIndex: nextIndex };
}

export function isLastPlayerOfDay(state: GameState): boolean {
  return state.currentPlayerIndex === state.turnOrder.length - 1;
}

// --- Egg Exchange --------------------------------------------------------

export function applyEggExchange(player: PlayerState, amount: number): PlayerState {
  if (amount < 0 || amount > player.eggs) {
    throw new Error(`${player.id} cannot exchange ${amount} eggs (has ${player.eggs})`);
  }
  return { ...player, eggs: player.eggs - amount, food: player.food + amount };
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
// draw, and predator level-up at end of Spring/Summer. Win/lose
// evaluation (phase 9) is NOT implemented here — see the comment below.
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
      // End of Fall day 7 — game reaches its final checkpoint. Real
      // win/lose evaluation (all Predators defeated AND all players
      // alive) is phase 9; this just stops the clock.
      return { ...next, day: 7, phase: 3, gameOver: true };
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
    for (const exchange of options.exchanges ?? []) {
      const player = getPlayer(next.players, exchange.playerId);
      next = { ...next, players: replacePlayer(next.players, applyEggExchange(player, exchange.amount)) };
    }
    next = drawNextWeatherCard(next, season);
  }

  return next;
}
