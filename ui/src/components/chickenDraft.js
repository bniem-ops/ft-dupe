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

// Compact row for the candidates list — click to preview in the detail
// panel. Only ever 2 rows (dealChickenChoices always deals a pair), so this
// is a small stand-in for the design mockup's scrollable 9-bird "roost"
// list, without any "taken by" state — see the ChickenDraft comment below
// for why that cross-player contention can't happen here.
function CandidateRow({ name, viewing, onClick }) {
  const chicken = findChicken(name);
  return html`
    <div class=${`draft-roost-row ${viewing ? 'viewing' : ''}`} onClick=${onClick}>
      <div class="draft-roost-swatch"></div>
      <div class="draft-roost-info">
        <div class="draft-roost-name">${name}</div>
        <div class="ref-text">${chicken.breed}</div>
      </div>
      ${viewing && html`<span class="draft-roost-viewing">VIEWING</span>`}
    </div>
  `;
}

// Full stat detail for whichever candidate is currently highlighted.
function CandidateDetail({ name }) {
  const chicken = findChicken(name);
  return html`
    <div class="draft-detail">
      <div class="draft-detail-head">
        <div class="draft-detail-swatch"></div>
        <div class="draft-detail-headtext">
          <div class="draft-detail-name">${name}</div>
          <div class="ref-text">${chicken.breed}</div>
          ${chicken.flavorQuote && html`<div class="draft-detail-quote">"${chicken.flavorQuote}"</div>`}
        </div>
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
  const filledSeats = seatIds.filter((id) => seats[id]);
  const lockedCount = filledSeats.filter((id) => chosenChicken[id]).length;
  const previewChicken = highlighted ? findChicken(highlighted) : null;
  const previewTraits = previewChicken
    ? [previewChicken.breed, ...previewChicken.stages.flatMap((s) => s.abilities.map((a) => a.name)).filter(Boolean)].join(' · ')
    : '';

  return html`
    <div class="draft-screen">
      <div class="entry-backdrop"></div>
      <div class="entry-scrim"></div>
      <div class="draft-shell">
        <div class="draft-topbar">
          <span class="draft-title">CHOOSE YOUR BIRD</span>
          <span class="ref-text">Pick from your own two candidates below.</span>
          <div class="draft-topbar-spacer"></div>
          <span class="ref-text">${lockedCount} of ${filledSeats.length} locked in</span>
        </div>

        <${PredatorsStrip} predators=${predators} />

        <div class="draft-main">
          <div class="draft-roost">
            <div class="draft-candidates-label">YOUR CANDIDATES</div>
            ${candidates.map(
              (name) => html`<${CandidateRow} key=${name} name=${name} viewing=${highlighted === name} onClick=${() => setHighlighted(name)} />`,
            )}
          </div>

          ${highlighted && html`<${CandidateDetail} name=${highlighted} />`}

          <${FlockStatus} seatIds=${seatIds} seats=${seats} chosenChicken=${chosenChicken} myPlayerId=${myPlayerId} />
        </div>

        <div class="draft-footer">
          ${previewChicken &&
          html`<div class="draft-footer-preview">
            <div class="draft-footer-swatch"></div>
            <div>
              <div class="draft-footer-name">${highlighted}</div>
              <div class="ref-text">${previewTraits}</div>
            </div>
          </div>`}
          <div class="draft-footer-spacer"></div>
          ${lockedIn
            ? html`<div class="ref-text">
                You locked in <b>${lockedIn}</b>. ${waitingOn.length > 0 ? `Waiting on: ${waitingOn.join(', ')}` : "Everyone's ready — starting the game…"}
              </div>`
            : html`
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
