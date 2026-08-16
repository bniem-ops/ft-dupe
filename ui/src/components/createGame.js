import { html } from 'htm/preact';
import {
  bossPool,
  allFourPool,
  bossHealthBonus,
  positiveWeatherRemoved,
  guaranteedPositiveTopCard,
  grantsRandomLootDrop,
} from '../engine.js';

// Generated straight from the engine's own difficulty-modifier functions
// (setup.ts) so this list can never drift from what the game actually
// does — no hand-copied rules summary to keep in sync. Each entry is
// either a plain string (one bullet) or a {label, items} pair rendered as
// a labeled sub-list, since the predator/boss pool reads much easier as
// an indented list than as a comma-joined sentence.
function difficultyBlurbParts(difficulty, eggspansion) {
  const parts = [];
  if (grantsRandomLootDrop(difficulty)) parts.push('Every player starts with a random Loot Drop.');
  if (bossHealthBonus(difficulty) === 0) parts.push('No Boss health bonus.');
  else if (bossHealthBonus(difficulty) === 4) parts.push('Boss health bonus increased to +4.');
  if (guaranteedPositiveTopCard(difficulty)) parts.push('Guaranteed positive Weather card on top of each deck.');
  if (positiveWeatherRemoved(difficulty)) parts.push('Fair/Sunny/Snow removed from the Weather decks.');
  const fourPool = allFourPool(difficulty, eggspansion);
  const bPool = bossPool(difficulty, eggspansion);
  if (fourPool) parts.push({ label: 'All 4 Predators randomly chosen from:', items: fourPool });
  else if (bPool) parts.push({ label: 'Boss randomly chosen from:', items: bPool });
  return parts;
}

// Exported so both the lobby's host settings column and the guest's
// read-only summary render the same list instead of duplicating markup.
export function DifficultyBlurb({ difficulty, eggspansion }) {
  const parts = difficultyBlurbParts(difficulty, eggspansion);
  if (parts.length === 0) return html`<div class="ref-text">No modifiers.</div>`;
  return html`
    <ul class="difficulty-blurb-list ref-text">
      ${parts.map((part, i) =>
        typeof part === 'string'
          ? html`<li key=${i}>${part}</li>`
          : html`<li key=${i}>
              ${part.label}
              <ul>
                ${part.items.map((item) => html`<li key=${item}>${item}</li>`)}
              </ul>
            </li>`,
      )}
    </ul>
  `;
}

// Eggspansion + Difficulty pickers only — no player count (the lobby's
// flock-size grid handles that, with its own min/max-perch locking logic;
// solo has no player count at all). Shared by soloSetup.js and lobby.js's
// host settings column so this rules-facing UI only exists once.
export function DifficultySettings({ eggspansion, difficulty, onChangeEggspansion, onChangeDifficulty }) {
  return html`
    <div class="field">
      <label>Eggspansion pack?</label>
      <div class="pill-group">
        <button type="button" class=${`pill ${!eggspansion ? 'selected' : ''}`} onClick=${() => onChangeEggspansion(false)}>No</button>
        <button type="button" class=${`pill ${eggspansion ? 'selected' : ''}`} onClick=${() => onChangeEggspansion(true)}>Yes</button>
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
            onClick=${() => onChangeDifficulty(d)}
          >
            ${d}${d === 4 ? html`<span class="pill-suffix"> (Normal)</span>` : ''}
          </button>`,
        )}
      </div>
      <${DifficultyBlurb} difficulty=${difficulty} eggspansion=${eggspansion} />
    </div>
  `;
}
