import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findChicken, loadBonusCards, loadGrubCards, findPredator, BONUS_CARD_EFFECTS, GRUB_REWARDS } from '../engine.js';

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
function PlayCardControls({ effect, otherPlayers, remainingCards, onPlay, onPickEnemy }) {
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
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${p.id}</option>`)}
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

export function PlayerPanel({ player, isCurrent, state, dispatch, pendingPick, setPendingPick, myPlayerId }) {
  const chicken = findChicken(player.chickenName);
  const stageData = chicken.stages.find((s) => s.stage === player.stage);
  const otherPlayers = state.players.filter((p) => p.id !== player.id && p.alive);
  // Bonus/Grub cards and revival choices are playable "any time" in the
  // engine (not turn-gated), so in a remote session each device may only
  // act on its own panel — same canAct nicety as actionBar.js.
  const canAct = myPlayerId == null || myPlayerId === player.id;

  return html`
    <div class=${`player-panel ${isCurrent ? 'current' : ''} ${!player.alive ? 'dead' : ''}`}>
      <h3>${player.id} — ${chicken.name}${!player.alive ? ' (dead)' : ''}</h3>
      ${player.pendingRevivalChoices &&
      html`<div class="revival-choice">
        <strong>Choose your chicken to rejoin (as a Chick):</strong>
        ${!canAct && html`<span class="ref-text">(waiting for ${player.id}'s device)</span>`}
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
                : html`<span class="ref-text">(waiting for ${player.id}'s device)</span>`}
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
                ? html`<span class="ref-text">(waiting for ${player.id}'s device)</span>`
                : html`<${PlayCardControls}
                    effect=${effect}
                    otherPlayers=${otherPlayers}
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
        ${player.lootDrops.map((name, i) => html`<div key=${i} class="ref-text">${name} — ${findPredator(name).lootDrop ?? '—'}</div>`)}
      </details>
    </div>
  `;
}
