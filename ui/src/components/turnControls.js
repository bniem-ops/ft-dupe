import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export function TurnControls({ state, onSubmitDayEnd }) {
  const [discardSide, setDiscardSide] = useState('inside');
  const [exchanges, setExchanges] = useState({});

  function setExchangeAmount(playerId, amount) {
    setExchanges((prev) => ({ ...prev, [playerId]: amount }));
  }

  function submit() {
    onSubmitDayEnd({
      discardSide,
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
        <select value=${discardSide} onChange=${(e) => setDiscardSide(e.target.value)}>
          <option value="inside">Inside</option>
          <option value="outside">Outside</option>
        </select>
      </label>

      <div class="egg-exchange">
        <p>Egg Exchange (only applies on a phase-boundary day — harmless to fill in otherwise):</p>
        ${state.players
          .filter((p) => p.alive)
          .map(
            (p) => html`
              <label class="field" key=${p.id}>
                ${p.id} (has ${p.eggs} eggs)
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

      <button type="button" onClick=${submit}>Confirm and Advance</button>
    </div>
  `;
}
