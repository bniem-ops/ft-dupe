import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { getOwnAndBorrowedAbilities } from '../engine.js';

// Shown at turn start instead of the action bar when the player holds
// Strategem/Deus Eggs Machina and their production roll paused for a
// decision (engine/src/turn.ts's computeProductionRoll) — lets them see
// the raw roll before committing, instead of pre-declaring blind like the
// actionBar.js Strategem/Deus Eggs Machina controls still do for
// targeting a teammate's future roll.
export function ProductionReveal({ player, dispatch, myPlayerId }) {
  const [eggsToSpend, setEggsToSpend] = useState(1);
  const [direction, setDirection] = useState('1');

  const reveal = player.pendingProductionReveal;
  if (!reveal) return null;

  // Same spectator-view convention as actionBar.js: every device sees
  // whoever's turn it is, but only that seat's own device can actually act.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const abilities = getOwnAndBorrowedAbilities(player);
  const canReroll = abilities.some((a) => a.canRerollAnyRollForEgg);
  const canAdjust = abilities.some((a) => a.canAdjustAnyRollForEggs);

  function resolve(choice, extra = {}) {
    dispatch({ type: 'resolveProductionReveal', playerId: player.id, choice, ...extra });
  }

  return html`
    <div class="production-reveal">
      <div class="production-reveal-title">Production roll</div>
      <div class="production-reveal-roll">You rolled a <b>${reveal.roll}</b> <span class="ref-text">(need ${reveal.threshold}+)</span></div>
      <div class=${`production-reveal-outcome ${reveal.gained ? 'is-hit' : 'is-miss'}`}>
        ${reveal.gained ? `Gains ${reveal.eggAmount} egg${reveal.eggAmount > 1 ? 's' : ''}` : 'No egg this time'}
      </div>

      <button type="button" class="production-reveal-keep" disabled=${!canAct} onClick=${() => resolve('keep')}>Keep it</button>

      ${canReroll &&
      html`<button type="button" class="production-reveal-option" disabled=${!canAct || player.eggs < 1} onClick=${() => resolve('reroll')}>
        Reroll — Deus Eggs Machina (1 egg)
      </button>`}

      ${canAdjust &&
      html`<div class="production-reveal-adjust">
        <input
          type="number"
          min="1"
          max=${Math.max(1, player.eggs)}
          value=${eggsToSpend}
          onInput=${(e) => setEggsToSpend(Number(e.target.value))}
        />
        <select onChange=${(e) => setDirection(e.target.value)} value=${direction}>
          <option value="1">+1 per egg</option>
          <option value="-1">-1 per egg</option>
        </select>
        <button
          type="button"
          disabled=${!canAct || player.eggs < 1}
          onClick=${() => resolve('adjust', { eggsToSpend, direction: Number(direction) })}
        >
          Adjust — Strategem
        </button>
      </div>`}
    </div>
  `;
}
