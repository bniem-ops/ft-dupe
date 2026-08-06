import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { loadChickens, loadPredators } from '../engine.js';

// Entry screen for remote play: create a new session (host picks the
// game-wide settings — difficulty/eggspansion/predators/player count, but
// NOT chickens, those get claimed per-seat in the Lobby) or join one by
// its 4-char code. Mirrors Setup.js's predator/difficulty fields exactly.
export function RemoteHome({ onCreate, onJoin, error }) {
  const predators = loadPredators().filter((p) => p.name);
  const [mode, setMode] = useState('create');

  const [playerCount, setPlayerCount] = useState(2);
  const [difficulty, setDifficulty] = useState(1);
  const [eggspansion, setEggspansion] = useState(false);
  const [regularPredators, setRegularPredators] = useState(['', '', '']);
  const [bossPredator, setBossPredator] = useState('');
  const [joinCode, setJoinCode] = useState('');

  function handleCreate(e) {
    e.preventDefault();
    const needsPredatorSelection = difficulty < 7;
    onCreate({
      playerCount,
      difficulty,
      eggspansion,
      ...(needsPredatorSelection ? { predators: { regular: regularPredators, boss: bossPredator } } : {}),
    });
  }

  function handleJoin(e) {
    e.preventDefault();
    onJoin(joinCode.trim().toUpperCase());
  }

  return html`
    <div class="setup">
      <h1>Flock Together — Play Remotely</h1>
      ${error && html`<div class="error-banner">${error}</div>`}
      <div class="player-row">
        <button type="button" disabled=${mode === 'create'} onClick=${() => setMode('create')}>Create a session</button>
        <button type="button" disabled=${mode === 'join'} onClick=${() => setMode('join')}>Join a session</button>
      </div>

      ${mode === 'create' &&
      html`
        <form onSubmit=${handleCreate}>
          <label class="field">
            Players
            <input type="number" min="1" max="6" value=${playerCount} onInput=${(e) => setPlayerCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
          </label>

          <label class="field">
            Difficulty
            <select value=${difficulty} onChange=${(e) => setDifficulty(Number(e.target.value))}>
              ${[1, 2, 3, 4, 5, 6, 7, 8].map((d) => html`<option key=${d} value=${d}>${d}</option>`)}
            </select>
          </label>

          <label class="field checkbox">
            <input type="checkbox" checked=${eggspansion} onChange=${(e) => setEggspansion(e.target.checked)} />
            Eggspansion
          </label>

          ${difficulty < 7 &&
          html`
            <fieldset>
              <legend>Predators</legend>
              ${[0, 1, 2].map(
                (i) => html`
                  <label class="field" key=${i}>
                    Regular ${i + 1}
                    <select required onChange=${(e) => setRegularPredators((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}>
                      <option value="">Choose…</option>
                      ${predators.map((pr) => html`<option key=${pr.name} value=${pr.name}>${pr.name} (${pr.species})</option>`)}
                    </select>
                  </label>
                `,
              )}
              <label class="field">
                Boss
                <select required onChange=${(e) => setBossPredator(e.target.value)}>
                  <option value="">Choose…</option>
                  ${predators.map((pr) => html`<option key=${pr.name} value=${pr.name}>${pr.name} (${pr.species})</option>`)}
                </select>
              </label>
            </fieldset>
          `}

          <button type="submit">Create Session</button>
        </form>
      `}

      ${mode === 'join' &&
      html`
        <form onSubmit=${handleJoin}>
          <label class="field">
            Session Code
            <input type="text" maxlength="4" value=${joinCode} onInput=${(e) => setJoinCode(e.target.value)} placeholder="ABCD" />
          </label>
          <button type="submit">Join Session</button>
        </form>
      `}
    </div>
  `;
}

// Seat-claiming waiting room: each device claims one unclaimed seat by
// picking a chicken, shown live to everyone via the doc subscription.
// Only the creating device (isHost) sees Start Game, enabled once every
// seat is claimed.
export function Lobby({ code, hostConfig, claimedSeats, mySeat, isHost, onClaim, onStart, error }) {
  const chickens = loadChickens().filter((c) => c.name);
  const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
  const allClaimed = seatIds.every((id) => claimedSeats[id]);
  const [pickedChicken, setPickedChicken] = useState('');

  return html`
    <div class="setup">
      <h1>Lobby</h1>
      <p>
        Session code: <strong>${code}</strong> — share this with the rest of your flock.
      </p>
      ${error && html`<div class="error-banner">${error}</div>`}

      <div class="lobby-seats">
        ${seatIds.map((seatId) => {
          const chicken = claimedSeats[seatId];
          if (chicken) {
            return html`<div class="player-row" key=${seatId}>
              <span>${seatId} — ${chicken}${seatId === mySeat ? ' (you)' : ''}</span>
            </div>`;
          }
          if (mySeat) {
            return html`<div class="player-row" key=${seatId}><span>${seatId} — open</span></div>`;
          }
          return html`<div class="player-row" key=${seatId}>
            <span>${seatId} — open</span>
            <select onChange=${(e) => setPickedChicken(e.target.value)} value=${pickedChicken}>
              <option value="">Choose a chicken…</option>
              ${chickens.map((c) => html`<option key=${c.name} value=${c.name}>${c.name} (${c.breed})</option>`)}
            </select>
            <button type="button" disabled=${!pickedChicken} onClick=${() => onClaim(seatId, pickedChicken)}>Claim this seat</button>
          </div>`;
        })}
      </div>

      ${isHost && html`<button type="button" disabled=${!allClaimed} onClick=${onStart}>Start Game</button>`}
      ${!isHost && html`<p>Waiting for the host to start the game once every seat is claimed…</p>`}
    </div>
  `;
}
