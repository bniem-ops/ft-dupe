import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export function TurnControls({ state, onSubmitDayEnd, myPlayerId, playerNames }) {
  const [discardSide, setDiscardSide] = useState('inside');
  const [exchanges, setExchanges] = useState({});

  // Day-end is a continuation of the last player's turn in the day — same
  // seat-gating rule as ActionBar (see actionBar.js for why this is a UX
  // nicety, not a security boundary).
  const lastPlayerId = state.turnOrder[state.currentPlayerIndex];
  const canAct = myPlayerId == null || myPlayerId === lastPlayerId;

  // The discard is mandatory, not a free pick of an already-empty pile — if
  // the selected side has no face-up Grub but the other one does, the
  // engine forces the discard onto that side anyway (turn.ts's
  // performDailyGrubDiscard), so reflect that here rather than let the
  // dropdown claim a choice that won't actually happen.
  const insideHasCard = !!state.grubDecks.inside.faceUp;
  const outsideHasCard = !!state.grubDecks.outside.faceUp;
  const effectiveSide =
    discardSide === 'inside' && !insideHasCard && outsideHasCard
      ? 'outside'
      : discardSide === 'outside' && !outsideHasCard && insideHasCard
        ? 'inside'
        : discardSide;

  function setExchangeAmount(playerId, amount) {
    setExchanges((prev) => ({ ...prev, [playerId]: amount }));
  }

  function submit() {
    onSubmitDayEnd({
      discardSide: effectiveSide,
      exchanges: state.players
        .filter((p) => p.alive && exchanges[p.id] > 0)
        .map((p) => ({ playerId: p.id, amount: exchanges[p.id] })),
    });
  }

  return html`
    <div class="turn-controls day-end">
      <h3>End of Day ${state.day}</h3>

      <label class="field">
        Discard which face-up Grub today?
        <select value=${effectiveSide} onChange=${(e) => setDiscardSide(e.target.value)}>
          <option value="inside" disabled=${!insideHasCard}>Inside${insideHasCard ? '' : ' (empty)'}</option>
          <option value="outside" disabled=${!outsideHasCard}>Outside${outsideHasCard ? '' : ' (empty)'}</option>
        </select>
      </label>

      <div class="egg-exchange">
        <p>Egg Exchange (only applies on a phase-boundary day — harmless to fill in otherwise):</p>
        ${state.players
          .filter((p) => p.alive)
          .map(
            (p) => html`
              <label class="field" key=${p.id}>
                ${playerNames?.[p.id] ?? p.id} (has ${p.eggs} eggs)
                <input
                  type="number"
                  min="0"
                  max=${p.eggs}
                  value=${exchanges[p.id] ?? 0}
                  onInput=${(e) => setExchangeAmount(p.id, Number(e.target.value))}
                />
              </label>
            `,
          )}
      </div>

      <button type="button" disabled=${!canAct} onClick=${submit}>Confirm and Advance</button>
    </div>
  `;
}
