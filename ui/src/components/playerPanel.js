import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findChicken, loadBonusCards, loadGrubCards, findPredator, BONUS_CARD_EFFECTS, GRUB_REWARDS, PREDATOR_LOOT, OUTSIDE_LOCATIONS } from '../engine.js';

const ALL_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];

function Hearts({ health, maxHealth }) {
  return html`
    <div class="hearts">
      ${Array.from({ length: maxHealth }, (_, i) => html`<span key=${i} class=${i < health ? 'heart full' : 'heart empty'}>❤</span>`)}
    </div>
  `;
}

// Reads what input a CardEffect needs (docs/engine-plan.md phase 7) so the
// UI doesn't hardcode per-card logic — mirrors actions.ts's own
// resolveCardEffect switch, one flag per shape actually present.
function cardInputShape(effect) {
  if (!effect) return null;
  return {
    needsOption: !!(effect.choiceGain || effect.teammateChoiceGain || effect.eggOrWeatherImmune || effect.discardExtraForBonus),
    needsTeammate: !!(effect.teammateGain || effect.teammateChoiceGain || (effect.drawBonusCards && effect.drawBonusCards.giveTeammate > 0)),
    needsAmount: !!(effect.teammateGain && effect.teammateGain.maxAmount > 1),
    maxAmount: effect.teammateGain?.maxAmount ?? 1,
    needsEnemy: !!effect.enemyDamage,
    needsExtraCardDiscard: !!effect.discardExtraForBonus,
  };
}

// Play button + whatever inline option/target/amount pickers the specific
// card needs, reusing the same dispatch/pendingPick plumbing actionBar.js
// and board.js already use for Move/Attack. `onPickEnemy` hands off to a
// board click (same pattern as Attack's target step) since a Predator/Grub
// target can't be chosen from a dropdown here.
function PlayCardControls({ effect, otherPlayers, playerNames, remainingCards, onPlay, onPickEnemy }) {
  const shape = cardInputShape(effect);
  const [option, setOption] = useState(1);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [amount, setAmount] = useState(1);
  const [discardExtraCardIndex, setDiscardExtraCardIndex] = useState('');

  if (!effect) return html`<span class="ref-text">(not yet implemented)</span>`;

  const blockedOnTeammate = shape.needsTeammate && !targetPlayerId;
  const blockedOnDiscard = shape.needsExtraCardDiscard && option === 2 && discardExtraCardIndex === '';

  function play() {
    const params = {
      option: shape.needsOption ? option : undefined,
      targetPlayerId: shape.needsTeammate ? targetPlayerId : undefined,
      amount: shape.needsAmount ? amount : undefined,
      discardExtraCardIndex: shape.needsExtraCardDiscard && option === 2 ? Number(discardExtraCardIndex) : undefined,
    };
    if (shape.needsEnemy) onPickEnemy(params);
    else onPlay(params);
  }

  return html`
    <span class="card-controls">
      ${shape.needsOption &&
      html`<select onChange=${(e) => setOption(Number(e.target.value))} value=${option}>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </select>`}
      ${shape.needsTeammate &&
      html`<select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">Teammate…</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>`}
      ${shape.needsAmount &&
      html`<input type="number" min="1" max=${shape.maxAmount} value=${amount} onInput=${(e) => setAmount(Number(e.target.value))} />`}
      ${shape.needsExtraCardDiscard &&
      option === 2 &&
      html`<select onChange=${(e) => setDiscardExtraCardIndex(e.target.value)} value=${discardExtraCardIndex}>
        <option value="">Discard which card…</option>
        ${remainingCards.map((c) => html`<option key=${c.index} value=${c.index}>${c.label}</option>`)}
      </select>`}
      <button type="button" disabled=${blockedOnTeammate || blockedOnDiscard} onClick=${play}>
        ${shape.needsEnemy ? 'Play (pick target on board)' : 'Play'}
      </button>
    </span>
  `;
}

// Egg Stash / Food Stash: draw down the shared pool held on the card,
// either into your own hand or a nearby player's (giftFood-style nearby
// check, enforced by the engine — this is just the picker).
function StashControls({ name, resource, remaining, otherPlayers, playerNames, onCollect }) {
  const [amount, setAmount] = useState(1);
  const [targetPlayerId, setTargetPlayerId] = useState('');

  if (remaining < 1) return html`<span class="ref-text">(stash empty)</span>`;
  return html`
    <span class="card-controls">
      <span class="ref-text">${remaining} ${resource} left</span>
      <input type="number" min="1" max=${remaining} value=${amount} onInput=${(e) => setAmount(Number(e.target.value))} />
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">Take for myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>Give to ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onCollect(amount, targetPlayerId || undefined)}>Take</button>
    </span>
  `;
}

// Cave Hoard: draw a Bonus Card for yourself or a nearby teammate.
function CaveHoardControls({ otherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState('');
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">For myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>For ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(targetPlayerId || undefined)}>Draw via Cave Hoard</button>
    </span>
  `;
}

// Secret Tunnels: free Move for yourself or a nearby player, to any location.
function SecretTunnelsControls({ otherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [destination, setDestination] = useState(ALL_LOCATIONS[0]);
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">Move myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>Move ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <select onChange=${(e) => setDestination(e.target.value)} value=${destination}>
        ${ALL_LOCATIONS.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(destination, targetPlayerId || undefined)}>Use Secret Tunnels</button>
    </span>
  `;
}

export function PlayerPanel({ player, isCurrent, state, dispatch, pendingPick, setPendingPick, myPlayerId, displayName, playerNames }) {
  const chicken = findChicken(player.chickenName);
  const stageData = chicken.stages.find((s) => s.stage === player.stage);
  const otherPlayers = state.players.filter((p) => p.id !== player.id && p.alive);
  // Bonus/Grub cards and revival choices are playable "any time" in the
  // engine (not turn-gated), so in a remote session each device may only
  // act on its own panel — same canAct nicety as actionBar.js.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const label = displayName ?? player.id;

  return html`
    <div class=${`player-panel ${isCurrent ? 'current' : ''} ${!player.alive ? 'dead' : ''}`}>
      <h3>${label} — ${chicken.name}${!player.alive ? ' (dead)' : ''}</h3>
      ${player.pendingRevivalChoices &&
      html`<div class="revival-choice">
        <strong>Choose your chicken to rejoin (as a Chick):</strong>
        ${!canAct && html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
        ${player.pendingRevivalChoices.map(
          (name) =>
            html`<button
              key=${name}
              type="button"
              disabled=${!canAct}
              onClick=${() => dispatch({ type: 'completeRevival', playerId: player.id, chickenName: name })}
            >
              ${name}
            </button>`,
        )}
      </div>`}
      <div class="breed">${chicken.breed} · Stage ${player.stage}</div>
      <${Hearts} health=${player.health} maxHealth=${player.maxHealth} />
      <div class="stats-row">
        <span>🌾 ${player.food}</span>
        <span>🥚 ${player.eggs}</span>
        <span>👊 ${player.attackStrength}</span>
        <span>📍 ${player.location}</span>
      </div>
      <div class="meal-counter">Meals: ${player.mealCounter}${stageData?.mealsToNext ? ` / ${stageData.mealsToNext}` : ''}</div>
      <div class="extra-action">Extra Action Token: ${player.extraActionTokenAvailable ? 'available' : 'used'}</div>

      <details open=${isCurrent}>
        <summary>Abilities</summary>
        ${chicken.stages.map(
          (s) => html`
            <div key=${s.stage} class=${s.stage > player.stage ? 'ability-future' : 'ability-current'}>
              <strong>Stage ${s.stage} (${s.label}):</strong>
              ${s.abilities.map((a, i) => html`<div key=${i}>${a.name ? `${a.name} — ` : ''}${a.text}</div>`)}
            </div>
          `,
        )}
      </details>

      <details>
        <summary>Bonus Cards (${player.bonusCardHand.length})</summary>
        ${player.bonusCardHand.map((id, i) => {
          const card = loadBonusCards()[id];
          const effect = card?.shorthand ? BONUS_CARD_EFFECTS[card.shorthand] : undefined;
          const remainingCards = player.bonusCardHand
            .filter((_, j) => j !== i)
            .map((cid, j) => ({ index: j, label: loadBonusCards()[cid]?.shorthand ?? '?' }));
          return html`
            <div key=${i} class="ref-text card-row">
              <div>${card?.shorthand} — ${card?.description}</div>
              ${canAct
                ? html`<${PlayCardControls}
                    effect=${effect}
                    otherPlayers=${otherPlayers}
                    playerNames=${playerNames}
                    remainingCards=${remainingCards}
                    onPlay=${(params) => dispatch({ type: 'playBonusCard', playerId: player.id, cardHandIndex: i, ...params })}
                    onPickEnemy=${(params) =>
                      setPendingPick({
                        type: 'cardTarget',
                        actionType: 'playBonusCard',
                        playerId: player.id,
                        handIndexField: 'cardHandIndex',
                        handIndex: i,
                        step: 'target',
                        extraParams: params,
                      })}
                  />`
                : html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
            </div>
          `;
        })}
      </details>

      <details>
        <summary>Grub Cards (${player.grubHand.length})</summary>
        ${player.grubHand.map((held, i) => {
          const card = loadGrubCards()[held.cardId];
          const effect = card?.name ? GRUB_REWARDS[card.name] : undefined;
          return html`
            <div key=${i} class="ref-text card-row">
              <div>${card?.name} (${held.currentHealth}/${card?.health}) — Reward: ${card?.reward ?? '—'}</div>
              ${held.rewardUsed
                ? html`<span class="ref-text">(Reward used)</span>`
                : !canAct
                ? html`<span class="ref-text">(waiting for ${label}'s device)</span>`
                : html`<${PlayCardControls}
                    effect=${effect}
                    otherPlayers=${otherPlayers}
                    playerNames=${playerNames}
                    remainingCards=${[]}
                    onPlay=${(params) => dispatch({ type: 'useGrubReward', playerId: player.id, grubHandIndex: i, ...params })}
                    onPickEnemy=${(params) =>
                      setPendingPick({
                        type: 'cardTarget',
                        actionType: 'useGrubReward',
                        playerId: player.id,
                        handIndexField: 'grubHandIndex',
                        handIndex: i,
                        step: 'target',
                        extraParams: params,
                      })}
                  />`}
            </div>
          `;
        })}
      </details>

      <details>
        <summary>Loot Drops (${player.lootDrops.length})</summary>
        ${player.lootDrops.map((name, i) => {
          const loot = PREDATOR_LOOT[name];
          const remaining = player.lootCharges?.[name] ?? 0;
          return html`
            <div key=${i} class="ref-text card-row">
              <div>${name} — ${findPredator(name).lootDrop ?? '—'}</div>
              ${canAct &&
              loot?.stash &&
              html`<${StashControls}
                name=${name}
                resource=${loot.stash.resource === 'egg' ? 'eggs' : 'food'}
                remaining=${remaining}
                otherPlayers=${otherPlayers}
                playerNames=${playerNames}
                onCollect=${(amount, targetPlayerId) => dispatch({ type: 'collectFromStash', playerId: player.id, predatorName: name, amount, targetPlayerId })}
              />`}
              ${canAct &&
              loot?.chargedRangedAttack &&
              html`<span class="card-controls">
                <span class="ref-text">${remaining} arrows left</span>
                <button
                  type="button"
                  disabled=${remaining < 1}
                  onClick=${() =>
                    setPendingPick({ type: 'cardTarget', actionType: 'useArrowPack', playerId: player.id, handIndexField: 'unused', step: 'target', extraParams: {} })}
                >
                  Fire Arrow (pick target on board)
                </button>
              </span>`}
              ${canAct &&
              loot?.activatableAttackReduction &&
              html`<span class="card-controls">
                ${remaining > 0
                  ? html`<button
                      type="button"
                      onClick=${() =>
                        setPendingPick({ type: 'cardTarget', actionType: 'useGasMask', playerId: player.id, handIndexField: 'unused', step: 'target', extraParams: {} })}
                    >
                      Use Gas Mask (pick Predator on board)
                    </button>`
                  : html`<span class="ref-text">(used)</span>`}
              </span>`}
              ${canAct &&
              loot?.everyoneAtLocationRefreshExtraAction &&
              html`<button type="button" onClick=${() => dispatch({ type: 'useChamberstick', playerId: player.id })}>
                Refresh everyone's Token here
              </button>`}
              ${canAct &&
              loot?.freeDrawBonusCardForSelfOrTeammate &&
              html`<${CaveHoardControls}
                otherPlayers=${otherPlayers}
                playerNames=${playerNames}
                onUse=${(targetPlayerId) => dispatch({ type: 'useCaveHoard', playerId: player.id, targetPlayerId })}
              />`}
              ${canAct &&
              loot?.healEveryoneAtLocation &&
              html`<button type="button" onClick=${() => dispatch({ type: 'useHealingPoultice', playerId: player.id })}>
                Heal everyone here ${loot.healEveryoneAtLocation}
              </button>`}
              ${canAct &&
              loot?.freeMoveForSelfOrNearby &&
              html`<${SecretTunnelsControls}
                otherPlayers=${otherPlayers}
                playerNames=${playerNames}
                onUse=${(destination, targetPlayerId) => dispatch({ type: 'useSecretTunnels', playerId: player.id, destination, targetPlayerId })}
              />`}
            </div>
          `;
        })}
      </details>
    </div>
  `;
}
