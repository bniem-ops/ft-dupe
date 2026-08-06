import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findChicken, findPredator } from '../engine.js';

function PredatorsPanel({ predators }) {
  return html`
    <div class="predators-panel">
      <h3>This Game's Predators</h3>
      <div class="predators-panel-cards">
        ${predators.regular.map((name) => {
          const data = findPredator(name);
          const stage1 = data.stages.find((s) => s.stage === 1);
          return html`<div class="predator-card" key=${name}>
            <div class="predator-name">${name}</div>
            <div class="predator-species">${data.species}</div>
            <div class="ref-text">Return attack: ${stage1?.returnAttack ?? '?'} — ${stage1?.effect ?? ''}</div>
          </div>`;
        })}
        <div class="predator-card hidden">??? — a hidden Boss lurks in the Badlands</div>
      </div>
    </div>
  `;
}

function ChickenCard({ name, highlighted, onClick }) {
  const chicken = findChicken(name);
  return html`
    <div class=${`chicken-card ${highlighted ? 'selected' : ''}`} onClick=${onClick}>
      <h3>${name}</h3>
      <div class="ref-text">${chicken.breed}</div>
      ${chicken.flavorQuote && html`<p class="ref-text"><em>"${chicken.flavorQuote}"</em></p>`}
      ${chicken.stages.map(
        (s) => html`
          <div key=${s.stage} class="chicken-card-stage">
            <strong>Stage ${s.stage} (${s.label}):</strong>
            <div class="stats-row">
              <span>❤ ${s.health ?? '?'}</span>
              <span>👊 ${s.attackStrength ?? '?'}</span>
              <span>🌾 ${s.production ?? '?'}</span>
              ${s.mealsToNext && html`<span>🍽 ${s.mealsToNext}</span>`}
            </div>
            ${s.abilities.map((a, i) => html`<div key=${i} class="ref-text">${a.name ? `${a.name} — ` : ''}${a.text}</div>`)}
          </div>
        `,
      )}
    </div>
  `;
}

export function ChickenDraft({ predators, candidates, lockedIn, onLockIn, waitingOn }) {
  const [highlighted, setHighlighted] = useState(null);

  return html`
    <div class="setup chicken-draft">
      <h1>Choose Your Chicken</h1>
      <${PredatorsPanel} predators=${predators} />

      ${lockedIn
        ? html`
            <p>You locked in <strong>${lockedIn}</strong>.</p>
            ${waitingOn.length > 0
              ? html`<p class="ref-text">Waiting on: ${waitingOn.join(', ')}</p>`
              : html`<p class="ref-text">Everyone's ready — starting the game…</p>`}
          `
        : html`
            <div class="chicken-draft-candidates">
              ${candidates.map(
                (name) =>
                  html`<${ChickenCard} key=${name} name=${name} highlighted=${highlighted === name} onClick=${() => setHighlighted(name)} />`,
              )}
            </div>
            <button type="button" disabled=${!highlighted} onClick=${() => onLockIn(highlighted)}>Lock In</button>
          `}
    </div>
  `;
}
