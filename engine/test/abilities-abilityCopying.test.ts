// Phase 11i: ability/effect copying — "For 1 Turn, borrow an unlocked
// ability from a teammate" (Bonus Card) and Lucky Cricket (Grub Reward).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/setup.js';
import { endTurn } from '../src/turn.js';
import { playBonusCard, useGrubReward, freeOutsideMove } from '../src/actions.js';
import { loadBonusCards, loadGrubCards } from '../src/data.js';
import { GameState } from '../src/types.js';
import { baseConfig } from './testHelpers.js';

function withPlayer(state: GameState, playerId: string, patch: Partial<GameState['players'][number]>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) };
}

test('Borrowing a teammate\'s ability grants it for 1 turn, then it expires at the borrower\'s own endTurn', () => {
  const config = baseConfig({ players: [{ id: 'p1', chickenName: 'Shellock Holmes' }, { id: 'p2', chickenName: 'Aracorn, Heir of Condor' }] });
  const state = createGame(config);
  const p2 = withPlayer(state, 'p2', { stage: 2 }); // Long Shanks (freeOutsideMove)
  assert.throws(() => freeOutsideMove(p2, 'p1', 'Grit Stones')); // p1 doesn't have it yet

  const cardIndex = loadBonusCards().findIndex((c) => c.shorthand === "For 1 Turn, borrow an unlocked ability from a teammate");
  const withCard = withPlayer(p2, 'p1', { bonusCardHand: [cardIndex], location: 'Hendred Acre Wood' });
  const cast = playBonusCard(withCard, 'p1', 0, { targetPlayerId: 'p2', amount: 2 });
  assert.deepEqual(cast.players.find((p) => p.id === 'p1')!.pendingBorrowedAbility, { chickenName: 'Aracorn, Heir of Condor', stage: 2 });

  const moved = freeOutsideMove(cast, 'p1', 'Grit Stones');
  assert.equal(moved.players.find((p) => p.id === 'p1')!.location, 'Grit Stones');
  assert.equal(moved.actionsRemainingThisTurn, cast.actionsRemainingThisTurn); // free

  const afterEndTurn = endTurn(moved);
  assert.equal(afterEndTurn.players.find((p) => p.id === 'p1')!.pendingBorrowedAbility, null);
});

test('Lucky Cricket copies a teammate\'s held Bonus Card effect without spending their card', () => {
  const state = createGame(baseConfig());
  const luckyCricketId = loadGrubCards().findIndex((c) => c.name === 'Lucky Cricket');
  const copiedCardIndex = loadBonusCards().findIndex((c) => c.shorthand === '+1 food OR health');
  let s = withPlayer(state, 'p1', { grubHand: [{ cardId: luckyCricketId, currentHealth: 1, rewardUsed: false }] });
  s = withPlayer(s, 'p2', { bonusCardHand: [copiedCardIndex], food: 0 });

  const result = useGrubReward(s, 'p1', 0, { targetPlayerId: 'p2', discardExtraCardIndex: 0, option: 1 });
  assert.equal(result.players.find((p) => p.id === 'p1')!.food, 1); // copied effect applied to the caster
  assert.deepEqual(result.players.find((p) => p.id === 'p2')!.bonusCardHand, [copiedCardIndex]); // teammate's card untouched
});
