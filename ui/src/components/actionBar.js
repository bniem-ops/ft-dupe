import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

// Mirrors actions.ts's healCap/eatCap — just for greying out obviously
// invalid amounts; the engine remains the source of truth and any miss
// here still surfaces via the dispatch error banner.
function healCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 3;
}
function eatCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 0;
}

export function ActionBar({ state, player, dispatch, onEndTurn, onUseExtraAction, pendingPick, setPendingPick }) {
  const [healAmount, setHealAmount] = useState(1);
  const [eatAmount, setEatAmount] = useState(0);
  const [attackStrength, setAttackStrength] = useState(1);
  const [broodTarget, setBroodTarget] = useState('');

  const noActions = state.actionsRemainingThisTurn <= 0;
  const deadPlayers = state.players.filter((p) => !p.alive);
  const pickingAttackStrength = pendingPick?.type === 'attack' && pendingPick.step === 'strength';

  function cancelPick() {
    setPendingPick(null);
  }

  return html`
    <div class="action-bar">
      <div class="turn-status">
        <strong>${player.id}'s turn</strong> — ${state.actionsRemainingThisTurn} action(s) left
        ${player.extraActionTokenAvailable && html`<button type="button" onClick=${onUseExtraAction}>Use Extra Action Token</button>`}
      </div>

      ${pendingPick?.type === 'move' &&
      html`<div class="pending-hint">Click a location on the board to Move. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'attack' &&
      pendingPick.step === 'target' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pickingAttackStrength &&
      html`
        <div class="pending-hint">
          Attack strength (costs that much food):
          <input
            type="number"
            min="1"
            max=${Math.max(1, Math.min(player.food, player.attackStrength))}
            value=${attackStrength}
            onInput=${(e) => setAttackStrength(Number(e.target.value))}
          />
          <button
            type="button"
            onClick=${() => {
              dispatch({
                type: 'attack',
                playerId: pendingPick.playerId,
                targetType: pendingPick.targetType,
                targetId: pendingPick.targetId,
                attackStrength,
              });
              setPendingPick(null);
            }}
          >
            Confirm Attack
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}

      <div class="actions-grid">
        <button type="button" disabled=${noActions} onClick=${() => dispatch({ type: 'layEgg', playerId: player.id })}>Lay Egg</button>

        <div class="action-with-amount">
          <input
            type="number"
            min="1"
            max=${healCap(player.stage)}
            value=${healAmount}
            onInput=${(e) => setHealAmount(Number(e.target.value))}
          />
          <button type="button" disabled=${noActions} onClick=${() => dispatch({ type: 'heal', playerId: player.id, amount: healAmount })}>
            Heal
          </button>
        </div>

        <div class="action-with-amount">
          <select onChange=${(e) => setBroodTarget(e.target.value)}>
            <option value="">Dead player…</option>
            ${deadPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${p.id}</option>`)}
          </select>
          <button
            type="button"
            disabled=${noActions || !broodTarget}
            onClick=${() => dispatch({ type: 'brood', playerId: player.id, targetPlayerId: broodTarget })}
          >
            Brood
          </button>
        </div>

        <button type="button" disabled=${noActions} onClick=${() => setPendingPick({ type: 'move', playerId: player.id })}>Move</button>

        <button type="button" disabled=${noActions} onClick=${() => dispatch({ type: 'drawCard', playerId: player.id })}>Draw Card</button>

        <button type="button" disabled=${noActions} onClick=${() => setPendingPick({ type: 'attack', step: 'target', playerId: player.id })}>
          Attack
        </button>

        <div class="action-with-amount">
          <input
            type="number"
            min="0"
            max=${eatCap(player.stage)}
            value=${eatAmount}
            onInput=${(e) => setEatAmount(Number(e.target.value))}
          />
          <button type="button" disabled=${noActions} onClick=${() => dispatch({ type: 'eat', playerId: player.id, amount: eatAmount })}>
            Eat
          </button>
        </div>

        <button type="button" disabled=${noActions} onClick=${() => dispatch({ type: 'forage', playerId: player.id })}>Forage</button>
      </div>

      <button type="button" class="end-turn" onClick=${onEndTurn}>End Turn</button>
    </div>
  `;
}
