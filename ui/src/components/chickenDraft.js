import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findChicken, findPredator, getActiveChickenAbilities, OUTSIDE_LOCATIONS } from '../engine.js';
import { chickenImagePath } from '../chickenArt.js';

const STAGE_COLOR = { 1: 'var(--gs-blood)', 2: 'var(--gs-ochre)', 3: 'var(--gs-field)' };
const START_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];

// "Production" in the chicken data is a full sentence ("Roll 1 die: 3-6 =
// +1 egg, else nothing") or the stage-1 short form ("+1 food") — the
// booklet's stat pip wants just the number and unit ("3-6" / "EGG"), so
// this pulls those back out rather than storing a second copy of the value.
function productionPip(production) {
  if (!production) return { value: '—', label: '' };
  const flat = production.match(/^\+(\d+)\s*(food|egg)$/i);
  if (flat) return { value: `+${flat[1]}`, label: flat[2].toUpperCase() };
  const roll = production.match(/(\d+-\d+)\s*=\s*\+\d+\s*(food|egg)/i);
  if (roll) return { value: roll[1], label: roll[2].toUpperCase() };
  return { value: production, label: '' };
}

function statPips(stage) {
  return [
    { value: stage.health ?? '?', label: 'HP' },
    { value: stage.attackStrength ?? '?', label: 'ATK' },
    stage.mealsToNext ? { value: stage.mealsToNext, label: 'GROW' } : { value: '—', label: 'MAX' },
    productionPip(stage.production),
  ];
}

// "Surname, uppercased" for the LOCK IN button — the part before a comma
// (subtitles like "Aracorn, Heir of Condor" name the bird, not a title),
// last word of what's left ("Madam Chickovsky" -> CHICKOVSKY).
function shortName(name) {
  const words = name.split(',')[0].trim().split(/\s+/);
  return words[words.length - 1].toUpperCase();
}

function StageRow({ stage }) {
  return html`
    <div class="draft-stage-row" style=${`border-left-color:${STAGE_COLOR[stage.stage]}`}>
      <div class="draft-stage-medal" style=${`background:${STAGE_COLOR[stage.stage]}`}>${stage.stage}</div>
      <div class="draft-stage-body">
        <div class="draft-stage-headline">
          <span class="draft-ability-name">${stage.abilities.find((a) => a.name)?.name ?? stage.label}</span>
          <span class="draft-stage-label">${stage.label}</span>
        </div>
        <div class="draft-ability-text">${stage.abilities.map((a) => a.text).filter(Boolean).join(' ')}</div>
        <div class="draft-stat-pips">
          ${statPips(stage).map(
            (p, i) => html`<span key=${i} class="draft-stat-pip"><b>${p.value}</b>${p.label}</span>`,
          )}
        </div>
      </div>
    </div>
  `;
}

function Booklet({ name }) {
  const chicken = findChicken(name);
  const stage1 = chicken.stages.find((s) => s.stage === 1);
  const health = parseInt(stage1?.health, 10) || 0;
  const attack = parseInt(stage1?.attackStrength, 10) || 0;
  const art = chickenImagePath(name, 1);
  return html`
    <div class="draft-spread">
      <div class="draft-page draft-page-abilities">
        <div class="draft-page-head">
          <span class="draft-page-title">ABILITIES</span>
          <span class="draft-page-subtitle">unlocked as she grows</span>
        </div>
        ${chicken.stages.map((s) => html`<${StageRow} key=${s.stage} stage=${s} />`)}
      </div>
      <div class="draft-spine"></div>
      <div class="draft-page draft-page-portrait">
        <div class="draft-book-art">
          <span class="draft-book-art-kicker">CHICKEN ART</span>
          ${art &&
          html`<img
            class="draft-book-art-img"
            src=${art}
            alt=${name}
            onError=${(e) => { e.currentTarget.style.display = 'none'; }}
          />`}
        </div>
        <div class="draft-page-portrait-body">
          <div class="draft-page-name">${name}</div>
          <div class="draft-page-breed">${chicken.breed}</div>
          <div class="draft-page-vitals">
            <span class="draft-page-hearts">${'❤'.repeat(health)}</span>
            <span class="draft-page-claws">${'👊'.repeat(attack)}</span>
          </div>
          ${chicken.flavorQuote && html`<div class="draft-page-quote">"${chicken.flavorQuote}"</div>`}
        </div>
      </div>
    </div>
  `;
}

function PredatorsStrip({ predators }) {
  return html`
    <div class="draft-predators">
      <div class="draft-predators-label">THIS GAME'S<br />PREDATORS</div>
      <div class="draft-predators-cards">
        ${predators.regular.map((name) => {
          const data = findPredator(name);
          const stage1 = data.stages.find((s) => s.stage === 1);
          return html`<div class="draft-predator-chip" key=${name}>
            <span class="draft-predator-name">${name}</span>
            <span class="draft-predator-note">return <b>${stage1?.returnAttack ?? '?'}</b> · ${stage1?.effect ?? ''}</span>
          </div>`;
        })}
      </div>
      <div class="draft-predators-hint">Pick a bird that answers them.</div>
    </div>
  `;
}

function TablePanel({ seatIds, seats, chosenChicken, allCandidates, myPlayerId }) {
  const rows = seatIds
    .filter((id) => seats[id])
    .map((id) => {
      const locked = chosenChicken[id];
      const pair = allCandidates?.[id] ?? [];
      return { id, name: seats[id].name, isMe: id === myPlayerId, locked, pair };
    });
  return html`
    <div class="draft-table-panel">
      <div class="draft-table-head">
        <span class="draft-table-title">AT THE TABLE</span>
        <span class="draft-table-subtitle">who's weighing what</span>
      </div>
      <div class="draft-table-rows">
        ${rows.map(
          (row) => html`
            <div key=${row.id} class=${`draft-table-row ${row.isMe ? 'is-me' : ''}`}>
              <div class="draft-table-row-head">
                <span class=${`draft-table-avatar ${row.isMe ? 'is-me' : ''}`}>${row.name.charAt(0).toUpperCase()}</span>
                <span class="draft-table-name">${row.name}${row.isMe ? ' — you' : ''}</span>
                <span class=${`draft-table-status ${row.locked ? 'is-locked' : ''}`}>${row.locked ? 'LOCKED' : 'CHOOSING'}</span>
              </div>
              <div class="draft-table-spines">
                ${row.pair.map((name) => {
                  const chosen = row.locked === name;
                  const dimmed = row.locked && !chosen;
                  return html`<div key=${name} class=${`draft-table-spine ${chosen ? 'is-chosen' : ''} ${dimmed ? 'is-dimmed' : ''}`}>
                    <span class="draft-table-spine-name">${name}</span>
                    <span class="draft-table-spine-breed">${findChicken(name).breed}</span>
                  </div>`;
                })}
              </div>
            </div>
          `,
        )}
      </div>
      <div class="draft-table-footnote">Everyone's pair is face-up — talk it over before you lock in. Locked birds turn ochre.</div>
    </div>
  `;
}

// Each candidate is shown as a spiral-bound two-page spread (abilities /
// portrait); only one booklet is open at a time, switched via the tabs.
// AT THE TABLE shows every seat's pair face-up — dealtChickens (passed as
// allCandidates) is already synced to every device, so this needs no
// engine change, just forwarding the full map instead of only your own pair.
export function ChickenDraft({ predators, candidates, allCandidates, lockedIn, seatIds, seats, chosenChicken, myPlayerId, onLockIn }) {
  const [openBook, setOpenBook] = useState(0);
  const [startingLocation, setStartingLocation] = useState('Coop');

  const openName = candidates[openBook];
  const waitingOn = seatIds.filter((id) => id !== myPlayerId && seats[id] && !chosenChicken[id]).map((id) => seats[id].name);
  const filledSeats = seatIds.filter((id) => seats[id]);
  const lockedCount = filledSeats.filter((id) => chosenChicken[id]).length;
  const canChooseLocation = getActiveChickenAbilities(openName, 1).some((a) => a.mayChooseStartingLocation);

  function openTab(i) {
    setOpenBook(i);
    setStartingLocation('Coop');
  }

  return html`
    <div class="draft-screen">
      <div class="draft-topbar">
        <span class="draft-title">CHOOSE YOUR BIRD</span>
        <span class="draft-topbar-divider"></span>
        <span class="draft-subhead">Two booklets are on the table in front of you. Take your time.</span>
        <div class="draft-topbar-spacer"></div>
        <span class="draft-topbar-count">${lockedCount} OF ${filledSeats.length} LOCKED IN</span>
      </div>

      <${PredatorsStrip} predators=${predators} />

      <div class="draft-body">
        <div class="draft-booklet-col">
          <div class="draft-tabs">
            ${candidates.map(
              (name, i) => html`<button
                key=${name}
                type="button"
                class=${`draft-tab ${i === openBook ? 'is-open' : ''}`}
                onClick=${() => openTab(i)}
              >${name}</button>`,
            )}
            <div class="draft-tabs-spacer"></div>
            <span class="draft-booklet-count">Booklet ${openBook + 1} of 2</span>
          </div>

          <${Booklet} name=${openName} />

          <div class="draft-footer">
            ${!lockedIn &&
            canChooseLocation &&
            html`<div class="draft-start-at">
              <span class="draft-start-at-label">START AT</span>
              ${START_LOCATIONS.map(
                (loc) => html`<button
                  key=${loc}
                  type="button"
                  class=${`draft-start-pill ${startingLocation === loc ? 'is-selected' : ''}`}
                  onClick=${() => setStartingLocation(loc)}
                >${loc === 'Coop' ? 'Coop (default)' : loc}</button>`,
              )}
            </div>`}
            <div class="draft-footer-spacer"></div>
            ${lockedIn
              ? html`<div class="draft-footer-locked">
                  You locked in <b>${lockedIn}</b>. ${waitingOn.length > 0 ? `Waiting on: ${waitingOn.join(', ')}` : "Everyone's ready — starting the game…"}
                </div>`
              : html`
                  ${waitingOn.length > 0 && html`<span class="draft-waiting">${waitingOn.join(', ')} still choosing</span>`}
                  <button
                    type="button"
                    class="draft-lockin-btn"
                    onClick=${() => onLockIn(openName, canChooseLocation ? startingLocation : 'Coop')}
                  >LOCK IN ${shortName(openName)}</button>
                `}
          </div>
        </div>

        <${TablePanel}
          seatIds=${seatIds}
          seats=${seats}
          chosenChicken=${chosenChicken}
          allCandidates=${allCandidates}
          myPlayerId=${myPlayerId}
        />
      </div>
    </div>
  `;
}
