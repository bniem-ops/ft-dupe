import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export function JoinGame({ onJoinByCode, error }) {
  const [code, setCode] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onJoinByCode(code.trim().toUpperCase());
  }

  return html`
    <div class="setup">
      <h1>Join Game</h1>
      ${error && html`<div class="error-banner">${error}</div>`}
      <form onSubmit=${handleSubmit}>
        <label class="field">
          Session Code
          <input type="text" maxlength="4" value=${code} onInput=${(e) => setCode(e.target.value)} placeholder="ABCD" />
        </label>
        <button type="submit">Continue</button>
      </form>
    </div>
  `;
}
