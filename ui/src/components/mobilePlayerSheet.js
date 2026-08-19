import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { findChicken } from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { PlayerPanel } from './playerPanel.js';

// Design mockup 7c: the desktop dock panel rebuilt for a thumb — 38px
// health targets instead of small pips, a horizontally scroll-snapping
// meal track instead of cramming every cell into 360px, and Traits &
// Cards pushed to its own second sheet (reusing the real `PlayerPanel`
// dock variant there rather than re-deriving its traits/cards content).
export function MobilePlayerSheet({ player, state, dispatch, pendingPick, setPendingPick, myPlayerId, displayName, playerNames, onClose }) {
  const [notebookOpen, setNotebookOpen] = useState(false);
  const chicken = findChicken(player.chickenName);
  const stageData = chicken.stages.find((s) => s.stage === player.stage);
  const mealsToNext = stageData?.mealsToNext;
  const trackRef = useRef(null);

  // Scrolls the current meal-counter cell into view on open — "the track
  // scrolls and snaps to your marker" per the mockup, not a fixed-width
  // grid the player has to hunt across.
  useEffect(() => {
    trackRef.current?.querySelector('.mobile-sheet-meal-cell.filled')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [player.mealCounter, mealsToNext]);

  function tapHeart(index) {
    if (index < player.health) return; // full hearts are display-only
    // Arms the same Heal pendingPick the desktop Heal tile does; close so
    // the amount-confirm prompt (rendered on 7a/7b, not in this sheet) is
    // immediately visible instead of hidden behind this overlay.
    setPendingPick({ type: 'heal', playerId: player.id });
    onClose();
  }

  return html`
    <div class="mobile-play-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="mobile-sheet">
        <div class="mobile-sheet-handle"></div>

        <div class="mobile-sheet-header">
          <div class="mobile-sheet-portrait"><span class="monogram">${monogram(player.chickenName)}</span></div>
          <div class="mobile-sheet-header-body">
            <div class="mobile-sheet-name">${displayName ?? player.id}</div>
            <div class="mobile-sheet-breed">${chicken.breed} · Stage ${player.stage}</div>
            <div class="mobile-sheet-chips">
              <span class="mobile-sheet-chip">${state.actionsRemainingThisTurn} action(s)</span>
              <span class="mobile-sheet-chip blood">${player.attackStrength} claw</span>
            </div>
            <button type="button" class="mobile-sheet-notebook-btn" onClick=${() => setNotebookOpen(true)}>Traits & Cards ›</button>
          </div>
        </div>

        <div class="mobile-sheet-section">
          <div class="mobile-sheet-section-head">
            <span class="mobile-sheet-label">HEALTH</span>
            <span class="mobile-sheet-value">${player.health} / ${player.maxHealth}</span>
            <div class="gs-spacer"></div>
            <span class="mobile-sheet-hint">Tap a heart to heal</span>
          </div>
          <div class="mobile-sheet-hearts">
            ${Array.from(
              { length: player.maxHealth },
              (_, i) => html`<button key=${i} type="button" class=${`mobile-sheet-heart ${i < player.health ? 'full' : 'empty'}`} onClick=${() => tapHeart(i)}>♥</button>`,
            )}
          </div>
        </div>

        <div class="mobile-sheet-section">
          <div class="mobile-sheet-resource-row">
            <div class="mobile-sheet-resource">
              <span class="mobile-sheet-resource-value">${player.food}</span>
              <span class="mobile-sheet-label">FOOD</span>
            </div>
            <div class="mobile-sheet-resource">
              <span class="mobile-sheet-resource-value">${player.eggs}</span>
              <span class="mobile-sheet-label">EGGS</span>
            </div>
            <div class="mobile-sheet-resource">
              <span class="mobile-sheet-resource-value">${player.mealCounter}</span>
              <span class="mobile-sheet-label">MEALS</span>
            </div>
            <div class="mobile-sheet-resource">
              <span class="mobile-sheet-resource-value">${mealsToNext ?? '—'}</span>
              <span class="mobile-sheet-label">TO GROW</span>
            </div>
          </div>
        </div>

        ${mealsToNext
          ? html`<div class="mobile-sheet-section">
              <div class="mobile-sheet-section-head">
                <span class="mobile-sheet-label">MEAL COUNTER</span>
                <span class="mobile-sheet-hint">${player.mealCounter} of ${mealsToNext} · grow at ${mealsToNext}</span>
              </div>
              <div class="mobile-sheet-meal-track" ref=${trackRef}>
                ${Array.from(
                  { length: mealsToNext },
                  (_, i) => html`<span key=${i} class=${`mobile-sheet-meal-cell ${i + 1 === player.mealCounter ? 'filled' : ''}`}>${i + 1}</span>`,
                )}
              </div>
            </div>`
          : html`<div class="mobile-sheet-section"><span class="ref-text">No further meal-counter growth at Stage 3.</span></div>`}

        <div class="gs-spacer"></div>
        <div class="mobile-play-footer">
          <button type="button" class="mobile-play-footer-btn wide" onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>

    ${notebookOpen &&
    html`<div class="mobile-play-overlay mobile-play-overlay-top" onClick=${(e) => e.target === e.currentTarget && setNotebookOpen(false)}>
      <div class="mobile-play-overlay-sheet">
        <div class="mobile-play-overlay-header">
          <span>TRAITS & CARDS</span>
          <button type="button" class="mobile-play-icon-btn" onClick=${() => setNotebookOpen(false)}>✕</button>
        </div>
        <div class="mobile-play-overlay-body">
          <${PlayerPanel}
            variant="dock"
            player=${player}
            isCurrent=${true}
            state=${state}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            myPlayerId=${myPlayerId}
            displayName=${displayName}
            playerNames=${playerNames}
          />
        </div>
      </div>
    </div>`}
  `;
}
