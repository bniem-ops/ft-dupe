import { html } from 'htm/preact';
import { DifficultySettings, DifficultyBlurb } from './createGame.js';

function FlockSizeField({ value, onChange, minPlayers, eggspansion }) {
  const maxPlayers = eggspansion ? 6 : 5;
  return html`
    <div class="field">
      <label>Flock size</label>
      <div class="pill-group flock-size-grid">
        ${[1, 2, 3, 4, 5, 6].map((n) => {
          const locked = n > maxPlayers || n < minPlayers;
          return html`<button
            key=${n}
            type="button"
            class=${`pill ${value === n ? 'selected' : ''}`}
            disabled=${locked}
            onClick=${() => onChange(n)}
          >
            ${n}
          </button>`;
        })}
      </div>
      ${!eggspansion && html`<span class="ref-text">6 players requires Eggspansion.</span>`}
      ${minPlayers > 1 && html`<span class="ref-text">Can't drop below ${minPlayers} — that many perches are already filled.</span>`}
    </div>
  `;
}

function PerchRow({ seat, isHost }) {
  if (!seat) {
    return html`
      <div class="perch-row perch-empty">
        <div class="perch-avatar perch-avatar-empty">+</div>
        <div class="perch-info">
          <div class="perch-name ref-text">Empty perch</div>
        </div>
      </div>
    `;
  }
  return html`
    <div class="perch-row">
      <div class="perch-avatar">${seat.name.charAt(0).toUpperCase()}</div>
      <div class="perch-info">
        <div class="perch-name">${seat.name}</div>
      </div>
      ${isHost
        ? html`<span class="perch-host-tag">HOST</span>`
        : html`<span class=${`perch-ready ${seat.ready ? 'is-ready' : ''}`}>${seat.ready ? 'Ready' : 'Not ready'}</span>`}
    </div>
  `;
}

// One component for both roles, per HANDOFF.md — host gets editable
// settings + Start, guest gets a read-only summary + a Ready toggle.
// Settings (hostConfig) are live now, not a one-time setup step: every
// pill click here writes straight to Firestore via onUpdateHostConfig.
export function Lobby({ role, code, hostConfig, seats, myPlayerId, onUpdateHostConfig, onStart, onToggleReady, error }) {
  const isHost = role === 'host';
  const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
  const filledCount = seatIds.filter((id) => seats[id]).length;
  const allFilled = filledCount === seatIds.length;
  const hostName = seats.p1?.name ?? 'Host';
  const unreadyNames = seatIds.filter((id) => id !== 'p1' && seats[id] && !seats[id].ready).map((id) => seats[id].name);
  const mySeat = seats[myPlayerId];

  return html`
    <div class="entry-screen">
      <div class="entry-backdrop"></div>
      <div class="entry-scrim"></div>
      <div class="roost-card">
        <div class="roost-header">
          <span class="roost-title">${isHost ? 'THE ROOST' : `${hostName.toUpperCase()}'S ROOST`}</span>
          <span class="roost-subtitle">
            ${isHost ? (allFilled ? 'Party is full — ready to start!' : 'Waiting on more birds') : 'The host starts when everyone\'s settled'}
          </span>
          <div class="roost-header-spacer"></div>
          <div class="roost-code">
            <span class="roost-code-label">CODE</span>
            <span class="roost-code-value">${code}</span>
            ${isHost && html`<button type="button" class="roost-copy-btn" onClick=${() => navigator.clipboard?.writeText(code)}>Copy code</button>`}
          </div>
        </div>

        ${error && html`<div class="error-banner">${error}</div>`}

        <div class="roost-body">
          <div class="roost-perches">
            <div class="roost-perches-label">PERCHES · ${filledCount} OF ${seatIds.length}</div>
            ${seatIds.map((id) => html`<${PerchRow} key=${id} seat=${seats[id]} isHost=${id === 'p1'} />`)}
          </div>

          <div class="roost-settings">
            ${isHost
              ? html`
                  <${FlockSizeField}
                    value=${hostConfig.playerCount}
                    minPlayers=${Math.max(1, filledCount)}
                    eggspansion=${hostConfig.eggspansion}
                    onChange=${(playerCount) => onUpdateHostConfig({ playerCount })}
                  />
                  <${DifficultySettings}
                    eggspansion=${hostConfig.eggspansion}
                    difficulty=${hostConfig.difficulty}
                    onChangeEggspansion=${(eggspansion) => onUpdateHostConfig({ eggspansion })}
                    onChangeDifficulty=${(difficulty) => onUpdateHostConfig({ difficulty })}
                  />
                `
              : html`
                  <div class="roost-settings-label">SET BY THE HOST</div>
                  <div class="roost-summary-row"><span>Flock size</span><span>${hostConfig.playerCount}</span></div>
                  <div class="roost-summary-row"><span>Eggspansion</span><span>${hostConfig.eggspansion ? 'ON' : 'OFF'}</span></div>
                  <div class="roost-summary-row"><span>Difficulty</span><span>${hostConfig.difficulty}${hostConfig.difficulty === 4 ? ' · NORMAL' : ''}</span></div>
                  <${DifficultyBlurb} difficulty=${hostConfig.difficulty} eggspansion=${hostConfig.eggspansion} />
                `}
          </div>
        </div>

        <div class="roost-footer">
          <div class="roost-footer-text">
            ${isHost
              ? unreadyNames.length > 0
                ? `${unreadyNames.join(', ')} hasn't readied up — you can start anyway.`
                : ''
              : 'Waiting for the host to start…'}
          </div>
          <div class="roost-footer-spacer"></div>
          ${isHost
            ? html`<button type="button" class="roost-start-btn" disabled=${!allFilled} onClick=${onStart}>START GAME</button>`
            : html`<button type="button" class=${`roost-ready-btn ${mySeat?.ready ? 'is-ready' : ''}`} onClick=${() => onToggleReady(!mySeat?.ready)}>
                ${mySeat?.ready ? '✓ READY' : 'READY'}
              </button>`}
        </div>
      </div>
    </div>
  `;
}
