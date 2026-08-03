import { html } from 'htm/preact';
import { findChicken, loadBonusCards, loadGrubCards, findPredator } from '../engine.js';

function Hearts({ health, maxHealth }) {
  return html`
    <div class="hearts">
      ${Array.from({ length: maxHealth }, (_, i) => html`<span key=${i} class=${i < health ? 'heart full' : 'heart empty'}>❤</span>`)}
    </div>
  `;
}

export function PlayerPanel({ player, isCurrent }) {
  const chicken = findChicken(player.chickenName);
  const stageData = chicken.stages.find((s) => s.stage === player.stage);

  return html`
    <div class=${`player-panel ${isCurrent ? 'current' : ''} ${!player.alive ? 'dead' : ''}`}>
      <h3>${player.id} — ${chicken.name}${!player.alive ? ' (dead)' : ''}</h3>
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
          return html`<div key=${i} class="ref-text">${card?.shorthand} — ${card?.description}</div>`;
        })}
      </details>

      <details>
        <summary>Grub Cards (${player.grubHand.length})</summary>
        ${player.grubHand.map((held, i) => {
          const card = loadGrubCards()[held.cardId];
          return html`<div key=${i} class="ref-text">${card?.name} (${held.currentHealth}/${card?.health}) — Reward: ${card?.reward ?? '—'}</div>`;
        })}
      </details>

      <details>
        <summary>Loot Drops (${player.lootDrops.length})</summary>
        ${player.lootDrops.map((name, i) => html`<div key=${i} class="ref-text">${name} — ${findPredator(name).lootDrop ?? '—'}</div>`)}
      </details>
    </div>
  `;
}
