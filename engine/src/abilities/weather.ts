// The 16 "executable now" weather effects (docs/rules-audit.md). Keyed by
// card name — unique across all 3 season decks + the Eggspansion cards.
// Freezing/Bird Flu (Spring) are "needs hook" (H) and intentionally
// absent; Ice Melts/Mudslide (Eggspansion) are also H.
import { rollDie, RNG, GameState, Season } from '../types.js';
import { seasonCardList } from '../data.js';
import { WeatherEffect } from './types.js';
import { isImmuneToWeather } from './chickens.js';

export const WEATHER_EFFECTS: Record<string, WeatherEffect> = {
  // --- Spring ---
  Fair: {
    positive: true,
    onFirstForageThisTurn: { bonusFood: 1 },
  },
  Freezing: {
    forcesCoopLockdown: true,
    allowsEatInside: true,
  },
  Nighttime: {
    turnStartOncePerPhase: true,
    onTurnStart: () => ({ actionsDelta: -1 }),
  },
  Drought: {
    onForageCost: 2,
  },
  Pollen: {
    blocksGrubAttacks: true,
  },
  'Bird Flu': {
    onDayEndProximityDamage: 1,
  },

  // --- Summer ---
  Sunny: {
    positive: true,
    turnStartOncePerPhase: true,
    onTurnStart: () => ({ actionsDelta: 1 }),
  },
  'Lightning Storm': {
    onTurnEndRequiresOutside: true,
    onTurnEnd: (_ctx, rng: RNG) => (rollDie(rng) <= 2 ? { healthLoss: 1 } : {}),
  },
  'Flash Flood': {
    onPhaseEnd: (): { discardAllFood?: boolean } => ({ discardAllFood: true }),
  },
  Tornado: {
    onTurnStart: (_ctx, rng: RNG) => (rollDie(rng) <= 2 ? { actionsDelta: -1 } : {}),
  },
  'Pouring Rain': {
    skipNextEggExchange: true,
  },
  'Heat Wave': {
    blocksMoveToLocation: 'Coop',
  },

  // --- Fall ---
  Snow: {
    positive: true,
    eggExchangeBonusFoodIfParticipating: 3,
  },
  Hail: {
    onTurnEndRequiresOutside: true,
    onTurnEnd: () => ({ healthLoss: 1 }),
  },
  'Daylight Savings': {
    onProductionThreshold: 4,
  },
  'Severe Wind': {
    onTurnEndRequiresOutside: true,
    onTurnEnd: () => ({ discardChoice: ['food', 'egg'] }),
  },
  Fog: {
    onAttack: (_ctx, rng: RNG) => (rollDie(rng) <= 2 ? { dodged: true } : {}),
  },
  'Dust Storm': {
    maxAttackStrengthDelta: -1,
  },

  // --- Eggspansion ---
  'Ice Melts': {
    discardBothGrubsDaily: true,
  },
  Earthquake: {
    onTurnStart: (ctx) => {
      const player = ctx.state.players.find((p) => p.id === ctx.playerId)!;
      return player.bonusCardHand.length > 0 ? { discardAndRedrawBonusCard: true } : {};
    },
  },
};

// Resolves state.weather.active (a season + index into that season's
// combined card list) to its name and WEATHER_EFFECTS entry, if any.
export function activeWeatherName(state: GameState): string | null {
  const active = state.weather.active;
  if (!active) return null;
  const cards = seasonCardList(active.season.toLowerCase() as 'spring' | 'summer' | 'fall', state.config.eggspansion);
  return cards[active.cardIndex]?.name ?? null;
}

export function activeWeatherEffect(state: GameState): WeatherEffect | null {
  const name = activeWeatherName(state);
  return name ? (WEATHER_EFFECTS[name] ?? null) : null;
}

// Draws the next card for `season` (phase-boundary scheduled draws, and the
// on-demand redraws below). Freezing's "Immediately enter the Coop" fires
// right here, the moment the card is drawn, rather than waiting for
// someone's next Move.
export function drawNextWeatherCard(state: GameState, season: Season): GameState {
  const deck = [...state.weather.seasonDecks[season]];
  const cardIndex = deck.shift();
  if (cardIndex == null) return state; // deck exhausted — shouldn't happen within 3 seasons' draw counts
  let next: GameState = {
    ...state,
    weather: {
      seasonDecks: { ...state.weather.seasonDecks, [season]: deck },
      active: { season, cardIndex },
    },
  };
  const effect = activeWeatherEffect(next);
  if (effect?.forcesCoopLockdown) {
    const name = activeWeatherName(next) ?? '';
    next = {
      ...next,
      players: next.players.map((p) => {
        if (!p.alive || p.location === 'Coop') return p;
        const immune =
          isImmuneToWeather(p.chickenName, p.stage, name, effect.positive ?? false) ||
          p.pendingWeatherImmuneUntilNextTurn ||
          p.permanentWeatherImmuneUntilNextCard;
        return immune ? p : { ...p, location: 'Coop' };
      }),
    };
  }
  return next;
}

// Phase 11g: on-demand weather redraw, outside the normal phase-boundary
// cadence — Wherever Any Weather / Coopella / Firefly / "Draw new Weather
// Card" Bonus Card all funnel through here. `avoidCardName` re-draws once
// more if the new card happens to match (Coopella's "redraw on
// Fair/Sunny/Snow" clause).
export function redrawWeatherCard(state: GameState, avoidCardName?: string): GameState {
  let next = drawNextWeatherCard(state, state.season);
  if (avoidCardName && activeWeatherName(next) === avoidCardName) {
    next = drawNextWeatherCard(next, next.season);
  }
  return next;
}
