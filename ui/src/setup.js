import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { loadChickens, loadPredators } from './engine.js';

function makeDefaultPlayers(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, chickenName: '' }));
}

export function Setup({ onStart, onPlayRemotely, error }) {
  const chickens = loadChickens().filter((c) => c.name);
  const predators = loadPredators().filter((p) => p.name);

  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState(makeDefaultPlayers(2));
  const [difficulty, setDifficulty] = useState(1);
  const [eggspansion, setEggspansion] = useState(false);
  const [regularPredators, setRegularPredators] = useState(['', '', '']);
  const [bossPredator, setBossPredator] = useState('');

  function updatePlayerCount(n) {
    const count = Math.max(1, Math.min(6, n || 1));
    setPlayerCount(count);
    setPlayers((prev) => {
      const next = makeDefaultPlayers(count);
      for (let i = 0; i < Math.min(count, prev.length); i++) next[i].chickenName = prev[i].chickenName;
      return next;
    });
  }

  function updatePlayerChicken(i, name) {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, chickenName: name } : p)));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const needsPredatorSelection = difficulty < 7;
    onStart({
      players,
      difficulty,
      eggspansion,
      rng: () => Math.random(),
      ...(needsPredatorSelection ? { predators: { regular: regularPredators, boss: bossPredator } } : {}),
    });
  }

  return html`
    <div class="setup">
      <h1>Flock Together — New Game</h1>
      ${error && html`<div class="error-banner">${error}</div>`}
      ${onPlayRemotely &&
      html`<div class="player-row">
        <button type="button" onClick=${onPlayRemotely}>Play Remotely (with friends on other devices)</button>
      </div>`}
      <form onSubmit=${handleSubmit}>
        <label class="field">
          Players
          <input type="number" min="1" max="6" value=${playerCount} onInput=${(e) => updatePlayerCount(Number(e.target.value))} />
        </label>

        ${players.map(
          (p, i) => html`
            <div class="player-row" key=${p.id}>
              <span>${p.id}</span>
              <select required onChange=${(e) => updatePlayerChicken(i, e.target.value)}>
                <option value="">Choose a chicken…</option>
                ${chickens.map((c) => html`<option key=${c.name} value=${c.name}>${c.name} (${c.breed})</option>`)}
              </select>
            </div>
          `,
        )}

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
            <legend>
              Predators
              ${difficulty >= 5 ? ' (Boss is constrained to the difficulty pool — see core_rules.md)' : ''}
            </legend>
            ${[0, 1, 2].map(
              (i) => html`
                <label class="field" key=${i}>
                  Regular ${i + 1}
                  <select
                    required
                    onChange=${(e) => setRegularPredators((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  >
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

        <button type="submit">Start Game</button>
      </form>
    </div>
  `;
}
