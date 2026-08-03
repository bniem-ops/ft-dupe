// Single entry point: applyAction(state, action) -> newState. Pure, no
// DOM/Firestore dependency — keeps this testable and leaves room for
// phase 7 (multiplayer sync) and any future undo/replay to build on the
// action log without a rewrite.
import { GameState, Action } from './types.js';
import * as actions from './actions.js';

export function applyAction(state: GameState, action: Action): GameState {
  let next: GameState;
  switch (action.type) {
    case 'layEgg':
      next = actions.layEgg(state, action.playerId);
      break;
    case 'heal':
      next = actions.heal(state, action.playerId, action.amount);
      break;
    case 'brood':
      next = actions.brood(state, action.playerId, action.targetPlayerId);
      break;
    case 'move':
      next = actions.move(state, action.playerId, action.destination);
      break;
    case 'drawCard':
      next = actions.drawCard(state, action.playerId);
      break;
    case 'attack':
      next = actions.attack(state, action.playerId, action.targetType, action.targetId, action.attackStrength);
      break;
    case 'eat':
      next = actions.eat(state, action.playerId, action.amount);
      break;
    case 'forage':
      next = actions.forage(state, action.playerId);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown action type: ${JSON.stringify(exhaustive)}`);
    }
  }
  return { ...next, actionLog: [...next.actionLog, action] };
}
