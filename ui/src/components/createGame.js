import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  bossPool,
  allFourPool,
  bossHealthBonus,
  positiveWeatherRemoved,
  guaranteedPositiveTopCard,
  grantsRandomLootDrop,
} from '../engine.js';

// Generated straight from the engine's own difficulty-modifier functions
// (setup.ts) so this text can never drift from what the game actually
// does — no hand-copied rules summary to keep in sync.
function difficultyBlurb(difficulty, eggspansion) {
  const parts = [];
  if (grantsRandomLootDrop(difficulty)) parts.push('Every player starts with a random Loot Drop.');
  if (bossHealthBonus(difficulty) === 0) parts.push('No Boss health bonus.');
  else if (bossHealthBonus(difficulty) === 4) parts.push('Boss health bonus increased to +4.');
  if (guaranteedPositiveTopCard(difficulty)) parts.push('Guaranteed positive Weather card on top of each deck.');
  if (positiveWeatherRemoved(difficulty)) parts.push('Fair/Sunny/Snow removed from the Weather decks.');
  const fourPool = allFourPool(difficulty, eggspansion);
  const bPool = bossPool(difficulty, eggspansion);
  if (fourPool) parts.push(`All 4 Predators randomly chosen from: ${fourPool.join(', ')}.`);
  else if (bPool) parts.push(`Boss randomly chosen from: ${bPool.join(', ')}.`);
  return parts.length ? parts.join(' ') : 'No modifiers.';
}

export function CreateGame({ onCreateLobby, error }) {
  const [playerCount, setPlayerCount] = useState(1);
  const [eggspansion, setEggspansion] = useState(false);
  const [difficulty, setDifficulty] = useState(4);

  const maxPlayers = eggspansion ? 6 : 5;

  function toggleEggspansion(value) {
    setEggspansion(value);
    if (!value && playerCount > 5) setPlayerCount(5);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onCreateLobby({ playerCount, difficulty, eggspansion });
  }

  return html`
    <div class="setup">
      <h1>Create Game</h1>
      ${error && html`<div class="error-banner">${error}</div>`}
      <form onSubmit=${handleSubmit}>
        <div class="field">
          <label>Players</label>
          <div class="pill-group">
            ${[1, 2, 3, 4, 5, 6].map((n) => {
              const locked = n > maxPlayers;
              return html`<button
                key=${n}
                type="button"
                class=${`pill ${playerCount === n ? 'selected' : ''}`}
                disabled=${locked}
                onClick=${() => setPlayerCount(n)}
              >
                ${n}${locked ? ' 🔒' : ''}
              </button>`;
            })}
          </div>
          ${!eggspansion && html`<span class="ref-text">6 players requires Eggspansion.</span>`}
        </div>

        <div class="field">
          <label>Eggspansion pack?</label>
          <div class="pill-group">
            <button type="button" class=${`pill ${!eggspansion ? 'selected' : ''}`} onClick=${() => toggleEggspansion(false)}>No</button>
            <button type="button" class=${`pill ${eggspansion ? 'selected' : ''}`} onClick=${() => toggleEggspansion(true)}>Yes</button>
          </div>
        </div>

        <div class="field">
          <label>Difficulty (4 = Normal; 1-3 are easier, 5-8 are harder)</label>
          <div class="pill-group">
            ${[1, 2, 3, 4, 5, 6, 7, 8].map(
              (d) => html`<button
                key=${d}
                type="button"
                class=${`pill ${difficulty === d ? 'selected' : ''}`}
                onClick=${() => setDifficulty(d)}
              >
                ${d}${d === 4 ? ' (Normal)' : ''}
              </button>`,
            )}
          </div>
          <span class="ref-text difficulty-blurb">${difficultyBlurb(difficulty, eggspansion)}</span>
        </div>

        <button type="submit">Create Lobby</button>
      </form>
    </div>
  `;
}
