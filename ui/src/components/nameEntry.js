import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

// Shared by both entry paths — the host right after creating a session,
// and anyone joining by code — since both need to claim a lobby seat with
// a name before anything else happens.
export function NameEntry({ code, onSubmitName, error }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim()) onSubmitName(name.trim());
  }

  return html`
    <div class="setup">
      <h1>Join the Flock</h1>
      <p>Session code: <strong>${code}</strong></p>
      ${error && html`<div class="error-banner">${error}</div>`}
      <form onSubmit=${handleSubmit}>
        <label class="field">
          Your Name
          <input type="text" required value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Enter your name" />
        </label>
        <button type="submit">Join Lobby</button>
      </form>
    </div>
  `;
}
