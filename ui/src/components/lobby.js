import { html } from 'htm/preact';

// Named seat-waiting room: each device already claimed a seat with a name
// (nameEntry.js) before landing here. Start Game (host only) enables once
// every configured seat has a name attached.
export function Lobby({ code, hostConfig, seats, isHost, onStart, error }) {
  const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
  const allFilled = seatIds.every((id) => seats[id]);

  return html`
    <div class="setup">
      <h1>Lobby</h1>
      <p>Session code: <strong>${code}</strong> — share this with the rest of your flock.</p>
      ${error && html`<div class="error-banner">${error}</div>`}
      ${isHost && allFilled && html`<div class="success-banner">Party is full — ready to start!</div>`}

      <div class="lobby-seats">
        ${seatIds.map(
          (seatId) => html`<div class="player-row" key=${seatId}>
            <span>${seats[seatId]?.name ?? html`<span class="ref-text">open</span>`}</span>
          </div>`,
        )}
      </div>

      ${isHost && html`<button type="button" disabled=${!allFilled} onClick=${onStart}>Start Game</button>`}
      ${!isHost && html`<p>Waiting for the host to start the game once every seat is filled…</p>`}
    </div>
  `;
}
