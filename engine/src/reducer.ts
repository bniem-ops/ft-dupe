// Single entry point: applyAction(state, action) -> newState. Pure, no
// DOM/Firestore dependency — keeps this testable and leaves room for
// phase 7 (multiplayer sync) and any future undo/replay to build on the
// action log without a rewrite.
import { GameState, Action } from './types.js';
import * as actions from './actions.js';
import { evaluateGameStatus } from './gameStatus.js';
import { getActiveChickenAbilities } from './abilities/chickens.js';
import { useWeatherActionAdjustment } from './turn.js';

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
      next = actions.attack(
        state,
        action.playerId,
        action.targetType,
        action.targetId,
        action.attackStrength,
        action.mitigation,
        action.damageRedirect,
        action.grubShieldIndex,
      );
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
    case 'collectFromStash':
      next = actions.collectFromStash(state, action.playerId, action.predatorName, action.amount, action.targetPlayerId);
      break;
    case 'useGasMask':
      next = actions.useGasMask(state, action.playerId, action.targetId);
      break;
    case 'useArrowPack':
      next = actions.useArrowPack(state, action.playerId, action.targetType, action.targetId);
      break;
    case 'refreshExtraActionToken':
      next = actions.refreshExtraActionToken(state, action.playerId);
      break;
    case 'freeMoveToCoop':
      next = actions.freeMoveToCoop(state, action.playerId);
      break;
    case 'useChamberstick':
      next = actions.useChamberstick(state, action.playerId);
      break;
    case 'useCaveHoard':
      next = actions.useCaveHoard(state, action.playerId, action.targetPlayerId);
      break;
    case 'useHealingPoultice':
      next = actions.useHealingPoultice(state, action.playerId);
      break;
    case 'useSecretTunnels':
      next = actions.useSecretTunnels(state, action.playerId, action.destination, action.targetPlayerId);
      break;
    case 'tagAlong':
      next = actions.tagAlong(state, action.playerId, action.targetPlayerId);
      break;
    case 'attackWithCompanion':
      next = actions.attackWithCompanion(
        state,
        action.playerId,
        action.companionId,
        action.targetType,
        action.targetId,
        action.primaryStrength,
        action.companionStrength,
      );
      break;
    case 'useStrategem':
      next = actions.useStrategem(state, action.playerId, action.targetPlayerId, action.eggsToSpend, action.direction);
      break;
    case 'useDeusEggsMachina':
      next = actions.useDeusEggsMachina(state, action.playerId, action.targetPlayerId);
      break;
    case 'useWhereverAnyWeather':
      next = actions.useWhereverAnyWeather(state, action.playerId);
      break;
    case 'useDungeonKeys':
      next = actions.useDungeonKeys(state, action.playerId, action.targetPlayerId);
      break;
    case 'attackDiscardedGrub':
      next = actions.attackDiscardedGrub(state, action.playerId, action.side, action.discardIndex, action.attackStrength);
      break;
    case 'useFreeMoveGrant':
      next = actions.useFreeMoveGrant(state, action.playerId, action.destination);
      break;
    case 'usePortableHouse':
      next = actions.usePortableHouse(state, action.playerId, action.targetPlayerId);
      break;
    case 'adHocEggExchange':
      next = actions.adHocEggExchange(state, action.playerId, action.amount);
      break;
    case 'useWildernessGuide':
      next = actions.useWildernessGuide(state, action.playerId, action.targetPlayerId, action.destination);
      break;
    case 'collectBoardEgg':
      next = actions.collectBoardEgg(state, action.playerId, action.location);
      break;
    case 'useWeatherActionAdjustment':
      next = useWeatherActionAdjustment(state, action.playerId);
      break;
    case 'discardBonusCard':
      next = actions.discardBonusCard(state, action.playerId, action.cardHandIndex);
      break;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown action type: ${JSON.stringify(exhaustive)}`);
    }
  }
  next = applyDedication(next, action);
  return { ...next, ...evaluateGameStatus(next), actionLog: [...next.actionLog, action] };
}

// Dedication (J.R.R. Yolkien S2): "Whenever you take the same action twice
// on your turn, lay an egg on your space." Scoped to the 8 base actions
// (the tabletop sense of "action"), tracked per player per turn.
const BASE_ACTION_TYPES = new Set(['layEgg', 'heal', 'brood', 'move', 'drawCard', 'attack', 'eat', 'forage']);

function applyDedication(after: GameState, action: Action): GameState {
  if (!BASE_ACTION_TYPES.has(action.type)) return after;
  const playerId = (action as { playerId: string }).playerId;
  const player = after.players.find((p) => p.id === playerId);
  if (!player) return after;
  const count = (player.actionCountsThisTurn[action.type] ?? 0) + 1;
  const updatedPlayer = { ...player, actionCountsThisTurn: { ...player.actionCountsThisTurn, [action.type]: count } };
  let boardEggs = after.boardEggs;
  if (count === 2 && getActiveChickenAbilities(updatedPlayer.chickenName, updatedPlayer.stage).some((a) => a.layEggOnRepeatedAction)) {
    boardEggs = { ...boardEggs, [updatedPlayer.location]: (boardEggs[updatedPlayer.location] ?? 0) + 1 };
  }
  return { ...after, players: after.players.map((p) => (p.id === playerId ? updatedPlayer : p)), boardEggs };
}
