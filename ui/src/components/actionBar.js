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

export function ActionBar({ state, player, dispatch, onEndTurn, onUseExtraAction, pendingPick, setPendingPick, myPlayerId, displayName, playerNames }) {
  const [healAmount, setHealAmount] = useState(1);
  const [eatAmount, setEatAmount] = useState(0);
  const [attackStrength, setAttackStrength] = useState(1);
  const [broodTarget, setBroodTarget] = useState('');
  const [tagAlongTarget, setTagAlongTarget] = useState('');

  // In a remote session, only the device that claimed this seat may act
  // for them — a UX nicety, not a security boundary (the engine's own
  // assertCanAct is the real guard). myPlayerId is null in local hotseat
  // play, where anyone can act on any seat, same as before phase 8.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const label = displayName ?? player.id;
  const noActions = state.actionsRemainingThisTurn <= 0 || !canAct;
  const deadPlayers = state.players.filter((p) => !p.alive);
  const pickingAttackStrength = pendingPick?.type === 'attack' && pendingPick.step === 'strength';
  // A target already at 0 health (some Grubs — Slug, Wild Grain, Four Leaf
  // Clover — start there) needs no attack strength to claim; the food-cost
  // floor of 1 only makes sense against a target that has health left.
  const targetHealth = pickingAttackStrength
    ? pendingPick.targetType === 'predator'
      ? (state.predators.find((p) => p.name === pendingPick.targetId)?.health ?? 1)
      : (state.grubDecks[pendingPick.targetId]?.faceUp?.currentHealth ?? 1)
    : 1;
  const minAttackStrength = targetHealth <= 0 ? 0 : 1;

  function cancelPick() {
    setPendingPick(null);
  }

  return html`
    <div class="action-bar">
      <div class="turn-status">
        <strong>${label}'s turn</strong> — ${state.actionsRemainingThisTurn} action(s) left
        ${!canAct && html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
        ${player.extraActionTokenAvailable &&
        html`<button type="button" disabled=${!canAct} onClick=${onUseExtraAction}>Use Extra Action Token</button>`}
        ${player.chickenName === 'Princess Layer' &&
        !player.extraActionTokenAvailable &&
        player.eggs >= 1 &&
        html`<button type="button" disabled=${!canAct} onClick=${() => dispatch({ type: 'refreshExtraActionToken', playerId: player.id })}>
          Refresh Token (1 egg — Nobility)
        </button>`}
        ${player.chickenName === 'Cumberbill Rockefeather' &&
        player.stage >= 2 &&
        player.location !== 'Coop' &&
        html`<button type="button" disabled=${!canAct} onClick=${() => dispatch({ type: 'freeMoveToCoop', playerId: player.id })}>
          Move to Coop (free — Landlord)
        </button>`}
      </div>

      ${pendingPick?.type === 'move' &&
      html`<div class="pending-hint">Click a location on the board to Move. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'attack' &&
      pendingPick.step === 'target' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'cardTarget' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target the card. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pickingAttackStrength &&
      html`
        <div class="pending-hint">
          Attack strength (costs that much food):
          <input
            type="number"
            min=${minAttackStrength}
            max=${Math.max(minAttackStrength, Math.min(player.food, player.attackStrength))}
            value=${attackStrength}
            onInput=${(e) => setAttackStrength(Number(e.target.value))}
          />
          <button
            type="button"
            disabled=${!canAct}
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
            ${deadPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
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

      ${(player.permanentTagAlongUnlocked || (player.chickenName === 'Wingston Coophill' && player.stage >= 2)) &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setTagAlongTarget(e.target.value)} value=${tagAlongTarget}>
          <option value="">Tag along with…</option>
          ${state.players
            .filter((p) => p.id !== player.id && p.alive)
            .map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
        </select>
        <button
          type="button"
          disabled=${!canAct || !tagAlongTarget}
          onClick=${() => dispatch({ type: 'tagAlong', playerId: player.id, targetPlayerId: tagAlongTarget })}
        >
          Tag Along
        </button>
      </div>`}

      <button type="button" class="end-turn" disabled=${!canAct} onClick=${onEndTurn}>End Turn</button>
    </div>
  `;
}
