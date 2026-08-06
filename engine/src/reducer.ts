// Single entry point: applyAction(state, action) -> newState. Pure, no
// DOM/Firestore dependency — keeps this testable and leaves room for
// phase 7 (multiplayer sync) and any future undo/replay to build on the
// action log without a rewrite.
import { GameState, Action } from './types.js';
import * as actions from './actions.js';
import { evaluateGameStatus } from './gameStatus.js';

export function applyAction(state: GameState, action: Action): GameState {
  if (state.gameOver) throw new Error('The game has already ended');
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
      next = actions.attack(state, action.playerId, action.targetType, action.targetId, action.attackStrength, action.mitigation);
      break;
    case 'eat':
      next = actions.eat(state, action.playerId, action.amount);
      break;
    case 'forage':
      next = actions.forage(state, action.playerId);
      break;
    case 'giftFood':
      next = actions.giftFood(state, action.playerId, action.targetPlayerId);
      break;
    case 'sacrificeHealthForEggs':
      next = actions.sacrificeHealthForEggs(state, action.playerId);
      break;
    case 'payEggForCard':
      next = actions.payEggForCard(state, action.playerId);
      break;
    case 'freeOutsideMove':
      next = actions.freeOutsideMove(state, action.playerId, action.destination);
      break;
    case 'drawTwoKeepOne':
      next = actions.drawTwoKeepOne(state, action.playerId, action.keep);
      break;
    case 'playBonusCard':
      next = actions.playBonusCard(state, action.playerId, action.cardHandIndex, action);
      break;
    case 'useGrubReward':
      next = actions.useGrubReward(state, action.playerId, action.grubHandIndex, action);
      break;
    case 'completeRevival':
      next = actions.completeRevival(state, action.playerId, action.chickenName);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown action type: ${JSON.stringify(exhaustive)}`);
    }
  }
  return { ...next, ...evaluateGameStatus(next), actionLog: [...next.actionLog, action] };
}
