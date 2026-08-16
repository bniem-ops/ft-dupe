import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findChicken, findPredator } from '../engine.js';

function PredatorsStrip({ predators }) {
  return html`
    <div class="draft-predators">
      <div class="draft-predators-label">
        <div class="draft-predators-title">THIS GAME'S<br/>PREDATORS</div>
        <div class="ref-text">Pick a bird that answers them.</div>
      </div>
      <div class="draft-predators-cards">
        ${predators.regular.map((name) => {
          const data = findPredator(name);
          const stage1 = data.stages.find((s) => s.stage === 1);
          return html`<div class="draft-predator-card" key=${name}>
            <div class="draft-predator-name">${name} <span class="ref-text">${data.species}</span></div>
            <div class="draft-predator-return">RETURN <b>${stage1?.returnAttack ?? '?'}</b></div>
            <div class="ref-text">${stage1?.effect ?? ''}</div>
          </div>`;
        })}
        <div class="draft-predator-card draft-predator-hidden">
          <div class="draft-predator-name">? ? ?</div>
          <div class="ref-text">A hidden Boss lurks in the Badlands.</div>
        </div>
      </div>
    </div>
  `;
}

// Full stat detail for one candidate, shown side by side with the other
// candidate (there are always exactly 2 — dealChickenChoices always deals
// a pair) so they can be compared directly instead of clicking back and
// forth between a list and a single detail panel.
function CandidateCard({ name, selected, onClick }) {
  const chicken = findChicken(name);
  return html`
    <div class=${`draft-detail ${selected ? 'selected' : ''}`} onClick=${onClick}>
      <div class="draft-detail-head">
        <div class="draft-detail-swatch"></div>
        <div class="draft-detail-headtext">
          <div class="draft-detail-name">${name}</div>
          <div class="ref-text">${chicken.breed}</div>
          ${chicken.flavorQuote && html`<div class="draft-detail-quote">"${chicken.flavorQuote}"</div>`}
        </div>
        <div class=${`draft-detail-pick ${selected ? 'is-selected' : ''}`}>${selected ? '✓ Picking this one' : 'Pick this one'}</div>
      </div>
      <div class="draft-stages">
        ${chicken.stages.map(
          (s) => html`
            <div key=${s.stage} class="draft-stage-row">
              <div class="draft-stage-head"><b>STAGE ${s.stage}</b> <span class="ref-text">${s.label}</span></div>
              <div class="draft-stage-stats">
                <div class="draft-stat"><span class="ref-text">HEALTH</span><b>${s.health ?? '?'}</b></div>
                <div class="draft-stat"><span class="ref-text">ATTACK</span><b>${s.attackStrength ?? '?'}</b></div>
                <div class="draft-stat draft-stat-wide"><span class="ref-text">PRODUCE</span><b>${s.production ?? '?'}</b></div>
                ${s.mealsToNext && html`<div class="draft-stat"><span class="ref-text">TO GROW</span><b>${s.mealsToNext}</b></div>`}
              </div>
              ${s.abilities.map(
                (a, i) => html`<div key=${i} class="draft-ability">
                  ${a.name && html`<span class="draft-ability-name">${a.name} — </span>`}<span class="ref-text">${a.text}</span>
                </div>`,
              )}
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

function FlockStatus({ seatIds, seats, chosenChicken, myPlayerId }) {
  return html`
    <div class="draft-flock">
      <div class="draft-flock-label">YOUR FLOCK</div>
      ${seatIds
        .filter((id) => seats[id])
        .map((id) => {
          const locked = chosenChicken[id];
          return html`<div key=${id} class=${`draft-flock-row ${locked ? 'is-locked' : ''}`}>
            <div class="draft-flock-avatar">${seats[id].name.charAt(0).toUpperCase()}</div>
            <div class="draft-flock-info">
              <div class="draft-flock-name">${seats[id].name}${id === myPlayerId ? html` <span class="ref-text">— you</span>` : ''}</div>
              <div class=${locked ? 'draft-flock-locked' : 'ref-text'}>${locked ? locked : 'Still choosing…'}</div>
            </div>
          </div>`;
        })}
    </div>
  `;
}

// Each player only ever sees their own 2 privately-dealt candidates —
// engine/src/setup.ts's dealChickenChoices guarantees no name is ever
// dealt to two players, matching the physical game, so there's no
// cross-player contention to show here (no "taken by" state is possible).
export function ChickenDraft({ predators, candidates, lockedIn, seatIds, seats, chosenChicken, myPlayerId, onLockIn }) {
  const [highlighted, setHighlighted] = useState(candidates[0] ?? null);
  const waitingOn = seatIds.filter((id) => id !== myPlayerId && seats[id] && !chosenChicken[id]).map((id) => seats[id].name);

  return html`
    <div class="draft-screen">
      <div class="entry-backdrop"></div>
      <div class="entry-scrim"></div>
      <div class="draft-shell">
        <div class="draft-topbar">
          <span class="draft-title">CHOOSE YOUR BIRD</span>
          <span class="ref-text">Pick from your own two candidates below.</span>
        </div>

        <${PredatorsStrip} predators=${predators} />

        <div class="draft-main">
          <div class="draft-candidates-compare">
            <div class="draft-candidates-label">YOUR CANDIDATES — pick one</div>
            <div class="draft-candidates-grid">
              ${candidates.map(
                (name) => html`<${CandidateCard} key=${name} name=${name} selected=${highlighted === name} onClick=${() => setHighlighted(name)} />`,
              )}
            </div>
          </div>

          <${FlockStatus} seatIds=${seatIds} seats=${seats} chosenChicken=${chosenChicken} myPlayerId=${myPlayerId} />
        </div>

        <div class="draft-footer">
          ${lockedIn
            ? html`
                <div class="draft-footer-text">You locked in <b>${lockedIn}</b>.</div>
                <div class="draft-footer-spacer"></div>
                <div class="ref-text">
                  ${waitingOn.length > 0 ? `Waiting on: ${waitingOn.join(', ')}` : "Everyone's ready — starting the game…"}
                </div>
              `
            : html`
                <div class="draft-footer-spacer"></div>
                ${waitingOn.length > 0 && html`<div class="ref-text">${waitingOn.join(', ')} still choosing</div>`}
                <button type="button" class="draft-lockin-btn" disabled=${!highlighted} onClick=${() => onLockIn(highlighted)}>
                  ${highlighted ? `LOCK IN ${highlighted.toUpperCase()}` : 'LOCK IN'}
                </button>
              `}
        </div>
      </div>
    </div>
  `;
}
