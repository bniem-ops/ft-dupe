// Win/lose evaluation (phase 9). core_rules.md's Objective section:
// Win if, before the 3rd season ends, all 4 Predators are defeated AND
// every player is alive at that moment. Lose if all players die at any
// point, or a player is dead (or a just-revived player hasn't taken
// their first turn back yet) when the final Predator falls. The third
// condition — the season timing out before all Predators are defeated —
// is a *timing* event, not a fact derivable from a state snapshot, so
// it's handled directly in turn.ts's advanceDay instead of here.
import { GameState } from './types.js';

export function evaluateGameStatus(state: GameState): { gameOver: boolean; won: boolean } {
  if (state.players.every((p) => !p.alive)) return { gameOver: true, won: false };

  const allPredatorsDefeated = state.predators.every((p) => p.defeated);
  const everyoneTrulyBack = state.players.every((p) => p.alive && !p.justRevivedPendingFirstTurn);
  if (allPredatorsDefeated && everyoneTrulyBack) return { gameOver: true, won: true };

  return { gameOver: state.gameOver, won: state.won };
}
