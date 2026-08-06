import { html } from 'htm/preact';

export function Landing({ onCreateGame, onJoinGame }) {
  return html`
    <div class="setup landing">
      <h1>Flock Together</h1>
      <div class="pill-group vertical">
        <button type="button" class="pill" onClick=${onCreateGame}>Create Game</button>
        <button type="button" class="pill" onClick=${onJoinGame}>Join Game</button>
      </div>
    </div>
  `;
}
