import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { DifficultySettings } from './createGame.js';

// The one settings step a solo player needs — no lobby to edit these in
// live (there's nobody else to wait for), so this stands in for it. No
// player-count field: solo is always 1.
export function SoloSetup({ onStart, error }) {
  const [eggspansion, setEggspansion] = useState(false);
  const [difficulty, setDifficulty] = useState(4);

  function handleSubmit(e) {
    e.preventDefault();
    onStart({ difficulty, eggspansion });
  }

  return html`
    <div class="entry-screen">
      <div class="entry-backdrop"></div>
      <div class="entry-scrim"></div>
      <div class="entry-card solo-setup-card">
        <div class="entry-title">
          <div class="entry-wordmark">SOLO ROOST</div>
          <div class="entry-tagline">Set the table before you sit down alone.</div>
        </div>
        ${error && html`<div class="error-banner">${error}</div>`}
        <form onSubmit=${handleSubmit}>
          <${DifficultySettings}
            eggspansion=${eggspansion}
            difficulty=${difficulty}
            onChangeEggspansion=${setEggspansion}
            onChangeDifficulty=${setDifficulty}
          />
          <button type="submit" class="entry-host-btn">START</button>
        </form>
      </div>
    </div>
  `;
}
