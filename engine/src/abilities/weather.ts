// The 16 "executable now" weather effects (docs/rules-audit.md). Keyed by
// card name — unique across all 3 season decks + the Eggspansion cards.
// Freezing/Bird Flu (Spring) are "needs hook" (H) and intentionally
// absent; Ice Melts/Mudslide (Eggspansion) are also H.
import { rollDie, RNG, GameState } from '../types.js';
import { seasonCardList } from '../data.js';
import { WeatherEffect } from './types.js';

export const WEATHER_EFFECTS: Record<string, WeatherEffect> = {
  // --- Spring ---
  Fair: {
    positive: true,
    onFirstForageThisTurn: { bonusFood: 1 },
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
