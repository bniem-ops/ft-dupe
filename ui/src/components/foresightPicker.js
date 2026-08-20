import { html } from 'htm/preact';
import { loadBonusCards } from '../engine.js';

// Mirrors actions.ts's drawTwoKeepOne exactly (reshuffle-from-discard
// when the draw pile runs dry, no shuffle involved there — same order
// the engine would actually draw in) so this peek is never wrong by the
// time the player confirms. Safe to peek client-side: nothing else can
// touch this player's own bonusDeck between arming this and confirming
// it — assertCanAct already requires it to be their own turn, and only
// they can act on it.
function peekTopTwo(bonusDeck) {
  let drawPile = bonusDeck.drawPile;
  let discard = bonusDeck.discard;
  const drawn = [];
  for (let i = 0; i < 2; i++) {
    if (drawPile.length === 0) {
      drawPile = discard;
      discard = [];
    }
    const cardId = drawPile[0];
    if (cardId == null) break;
    drawn.push(cardId);
    drawPile = drawPile.slice(1);
  }
  return drawn;
}

// General Tso's Foresight (and any borrowed drawTwoKeepOne ability): the
// Draw Card action reveals 2 cards instead of 1 and lets the player pick
// which to keep — the design mockup 6a dossier pattern applied to a
// card choice instead of an attack-strength choice.
export function ForesightPicker({ state, dispatch, pendingPick, setPendingPick, myPlayerId }) {
  const drawn = peekTopTwo(state.bonusDeck);
  const canAct = myPlayerId == null || myPlayerId === pendingPick.playerId;

  function keep(index) {
    dispatch({ type: 'drawTwoKeepOne', playerId: pendingPick.playerId, keep: index });
    setPendingPick(null);
  }

  return html`
    <div class="dossier-backdrop" onClick=${(e) => e.target === e.currentTarget && setPendingPick(null)}>
      <div class="foresight-panel">
        <div class="dossier-header">
          <span class="dossier-eyebrow">FORESIGHT</span>
          <span class="dossier-title">Draw 2, keep 1</span>
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-close" onClick=${() => setPendingPick(null)}>✕</button>
        </div>
        <div class="foresight-cards">
          ${drawn.length === 0 && html`<div class="ref-text">No Bonus Cards left to draw.</div>`}
          ${drawn.map((cardId, i) => {
            const card = loadBonusCards()[cardId];
            return html`
              <div key=${i} class="foresight-card">
                <div class="foresight-card-name">${card?.shorthand ?? 'Unknown'}</div>
                <div class="foresight-card-text">${card?.description ?? ''}</div>
                <button type="button" class="dossier-btn-confirm" disabled=${!canAct} onClick=${() => keep(i)}>Keep this</button>
              </div>
            `;
          })}
        </div>
        ${drawn.length > 1 && html`<div class="dossier-footer"><span class="dossier-footer-note">The other card goes to the Bonus discard pile.</span></div>`}
      </div>
    </div>
  `;
}
