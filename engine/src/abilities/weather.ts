// The weather effects (docs/rules-audit.md). Keyed by card name — unique
// across all 3 season decks + the Eggspansion cards.
import { rollDie, RNG, GameState, Season } from '../types.js';
import { seasonCardList } from '../data.js';
import { WeatherEffect } from './types.js';
import { isImmuneToWeather, peekRollIntercept } from './chickens.js';
import { shuffle } from '../random.js';

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
    onTurnEnd: (ctx, rng: RNG) => {
      const rollIntercepted = !!ctx.state.players.find((p) => p.id === ctx.playerId)?.pendingRollIntercept;
      const roll = peekRollIntercept(ctx.state, ctx.playerId, rollDie(rng), rng);
      return { ...(roll <= 2 ? { healthLoss: 1 } : {}), rollIntercepted };
    },
  },
  'Flash Flood': {
    onPhaseEnd: (): { discardAllFood?: boolean } => ({ discardAllFood: true }),
  },
  Tornado: {
    onTurnStart: (ctx, rng: RNG) => {
      const rollIntercepted = !!ctx.state.players.find((p) => p.id === ctx.playerId)?.pendingRollIntercept;
      const roll = peekRollIntercept(ctx.state, ctx.playerId, rollDie(rng), rng);
      return { ...(roll <= 2 ? { actionsDelta: -1 } : {}), rollIntercepted };
    },
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
    onAttack: (ctx, rng: RNG) => (peekRollIntercept(ctx.state, ctx.attackerId, rollDie(rng), rng) <= 2 ? { dodged: true } : {}),
  },
  'Dust Storm': {
    maxAttackStrengthDelta: -1,
  },

  // --- Eggspansion ---
  'Ice Melts': {
    discardBothGrubsDaily: true,
  },
  Mudslide: {
    dealsPersonalWeatherOnDraw: true,
  },
  Earthquake: {
    onTurnStart: (ctx) => {
      const player = ctx.state.players.find((p) => p.id === ctx.playerId)!;
      return player.bonusCardHand.length > 0 ? { discardAndRedrawBonusCard: true } : {};
    },
  },
};

function cardNameAt(pointer: { season: Season; cardIndex: number }, eggspansion: boolean): string | null {
  const cards = seasonCardList(pointer.season.toLowerCase() as 'spring' | 'summer' | 'fall', eggspansion);
  return cards[pointer.cardIndex]?.name ?? null;
}

// Resolves the weather a given player actually experiences right now.
// Normally that's just the shared state.weather.active card. Mudslide is
// the one exception (core_rules.md/Eggspansion): once it's drawn, each
// player gets their own personal card, in effect "until Mudslide is
// replaced" — so while the table's shared card is still Mudslide, a
// player holding a personalWeatherOverride sees THAT card instead. Omit
// playerId for the plain table-wide lookup (day-end/global checks that
// have no single acting player, e.g. Ice Melts/Bird Flu).
export function activeWeatherName(state: GameState, playerId?: string): string | null {
  const active = state.weather.active;
  if (!active) return null;
  if (playerId) {
    const activeName = cardNameAt(active, state.config.eggspansion);
    if (activeName === 'Mudslide') {
      const player = state.players.find((p) => p.id === playerId);
      if (player?.personalWeatherOverride) {
        return cardNameAt(player.personalWeatherOverride, state.config.eggspansion);
      }
    }
  }
  return cardNameAt(active, state.config.eggspansion);
}

export function activeWeatherEffect(state: GameState, playerId?: string): WeatherEffect | null {
  const name = activeWeatherName(state, playerId);
  return name ? (WEATHER_EFFECTS[name] ?? null) : null;
}

// Draws the next card for `season` (phase-boundary scheduled draws, and the
// on-demand redraws below). Freezing's "Immediately enter the Coop" fires
// right here, the moment the card is drawn, rather than waiting for
// someone's next Move. Same treatment for Mudslide's personal deal-out,
// and for clearing everyone's personal override the moment Mudslide is
// itself replaced by whatever this call draws next.
export function drawNextWeatherCard(state: GameState, season: Season): GameState {
  const wasMudslide = state.weather.active ? cardNameAt(state.weather.active, state.config.eggspansion) === 'Mudslide' : false;
  const deck = [...state.weather.seasonDecks[season]];
  const cardIndex = deck.shift();
  if (cardIndex == null) return state; // deck exhausted — shouldn't happen within 3 seasons' draw counts
  let next: GameState = {
    ...state,
    weather: {
      seasonDecks: { ...state.weather.seasonDecks, [season]: deck },
      active: { season, cardIndex },
    },
    players: wasMudslide ? state.players.map((p) => ({ ...p, personalWeatherOverride: null })) : state.players,
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
  if (effect?.dealsPersonalWeatherOnDraw) {
    next = dealPersonalWeatherCards(next, season);
  }
  return next;
}

// Mudslide: "Shuffle the rest of the Summer deck. Deal each player a
// personal Weather Card." `state.weather.seasonDecks[season]` at this
// point IS "the rest" — Mudslide's own index was already shifted off
// above. Dealt cards are removed from the deck (a real deck would run
// out), same as any other draw. If there aren't enough distinct cards
// left for every alive player (rare — 6 base Summer cards minus however
// many already drawn this season), deals with replacement rather than
// failing; disclosed here rather than silently duplicating without a
// reason.
function dealPersonalWeatherCards(state: GameState, season: Season): GameState {
  const remaining = shuffle(state.weather.seasonDecks[season], state.config.rng);
  if (remaining.length === 0) return state;
  const aliveIds = state.players.filter((p) => p.alive).map((p) => p.id);
  const dealt = new Map<string, number>();
  aliveIds.forEach((id, i) => dealt.set(id, remaining[i % remaining.length]));
  const usedCount = Math.min(remaining.length, aliveIds.length);
  return {
    ...state,
    weather: { ...state.weather, seasonDecks: { ...state.weather.seasonDecks, [season]: remaining.slice(usedCount) } },
    players: state.players.map((p) =>
      dealt.has(p.id) ? { ...p, personalWeatherOverride: { season, cardIndex: dealt.get(p.id)! } } : p,
    ),
  };
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
