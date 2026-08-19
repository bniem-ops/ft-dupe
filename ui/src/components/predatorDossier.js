import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findPredator, maxAttackStrengthFor, attackCostFor } from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { Hearts } from './playerPanel.js';

// Design mockup 6a: opens the moment a Predator is selected during an
// armed Attack, and is itself the confirm step (no separate strength
// screen after it) — or, with nothing armed, opens read-only as a
// reference card. The caller decides *whether* to render this at all
// (and passes a stable `key=${predatorName}` so a target change remounts
// fresh rather than carrying over a stale attack-strength selection) —
// this component always has a real predatorName once mounted, which
// keeps its hook order unconditional.
export function PredatorDossier({ state, dispatch, pendingPick, setPendingPick, myPlayerId, predatorName, committing, onClose }) {
  const predator = state.predators.find((p) => p.name === predatorName);
  const { baseCap, maxAttackStrength } = committing ? maxAttackStrengthFor(state, pendingPick.playerId) : { baseCap: 0, maxAttackStrength: 0 };
  const minAttackStrength = predator && predator.health <= 0 ? 0 : 1;
  const [attackStrength, setAttackStrength] = useState(Math.max(minAttackStrength, Math.min(baseCap, maxAttackStrength)));
  if (!predator) return null;

  const data = findPredator(predator.name);
  const stageData = data.stages.find((s) => s.stage === predator.stage);
  const damageTaken = predator.maxHealth - predator.health;
  const player = committing ? state.players.find((p) => p.id === pendingPick.playerId) : null;
  const canAct = committing && (myPlayerId == null || myPlayerId === pendingPick.playerId);
  const cost = committing ? attackCostFor(state, pendingPick.playerId, attackStrength) : 0;

  function chooseAnotherTarget() {
    setPendingPick({ ...pendingPick, step: 'target', targetType: undefined, targetId: undefined });
  }

  function confirmAttack() {
    dispatch({ type: 'attack', playerId: pendingPick.playerId, targetType: 'predator', targetId: predator.name, attackStrength });
    setPendingPick(null);
  }

  return html`
    <div class="dossier-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="dossier-panel">
        <div class="dossier-header">
          <span class="dossier-eyebrow">PREDATOR</span>
          <span class="dossier-title">${predator.name}</span>
          <span class="dossier-subtitle">${data.species ?? ''} · ${predator.location}</span>
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-close" onClick=${onClose}>✕</button>
        </div>

        <div class="dossier-body">
          <div class="dossier-portrait-col">
            <div class="dossier-portrait-plate">
              <div class="dossier-portrait-art"><span class="monogram">${monogram(predator.name)}</span></div>
              <div class="dossier-portrait-label">${predator.name}</div>
            </div>

            <div class="dossier-health-card">
              <div class="dossier-label">HEALTH REMAINING</div>
              <div class="dossier-health-row">
                <span class="dossier-health-number">${predator.health}</span>
                <${Hearts} health=${predator.health} maxHealth=${predator.maxHealth} />
              </div>
              ${damageTaken > 0 && html`<div class="dossier-flavor">${damageTaken} damage already taken this season.</div>`}
            </div>

            <div class="dossier-stat-row">
              <div class="dossier-stat">
                <div class="dossier-label">RETURN</div>
                <div class="dossier-stat-value">${stageData?.returnAttack ?? '?'}</div>
              </div>
            </div>
          </div>

          <div class="dossier-detail-col">
            <div class="dossier-section">
              <span class="dossier-section-title">RETURN ATTACK</span>
              <div class="dossier-flavor-text">
                Striking ${predator.name} and failing to defeat it triggers its return attack of ${stageData?.returnAttack ?? '?'} to the
                attacking bird.
              </div>
            </div>

            <div class="dossier-divider"></div>

            <div class="dossier-section">
              <span class="dossier-section-title">PREDATOR EFFECT · STAGE ${predator.stage}</span>
              <div class="dossier-effect-card">
                <div class="dossier-flavor-text">${stageData?.effect || 'No special effect at this stage.'}</div>
              </div>
            </div>

            <div class="dossier-divider"></div>

            <div class="dossier-section">
              <span class="dossier-section-title">LOOT DROP</span>
              <div class="dossier-flavor-text">${data.lootDrop ?? '—'}</div>
            </div>

            ${committing &&
            html`
              <div class="dossier-divider"></div>
              <div class="dossier-section">
                <div class="dossier-strength-heading">
                  <span class="dossier-section-title">ATTACK STRENGTH</span>
                  <span class="dossier-flavor">${player?.chickenName ?? ''} · costs food per point spent</span>
                </div>
                <div class="dossier-strength-row">
                  ${Array.from({ length: Math.max(0, maxAttackStrength - minAttackStrength + 1) }, (_, i) => minAttackStrength + i).map(
                    (n) => html`
                      <button
                        key=${n}
                        type="button"
                        class=${`dossier-strength-box ${n === attackStrength ? 'selected' : ''} ${n > baseCap ? 'free' : ''}`}
                        onClick=${() => setAttackStrength(n)}
                      >
                        <span class="dossier-strength-number">${n}</span>
                        ${n > baseCap && html`<span class="dossier-strength-tag">FREE</span>`}
                      </button>
                    `,
                  )}
                </div>
              </div>
            `}
          </div>
        </div>

        <div class="dossier-footer">
          ${committing
            ? html`
                <span class="dossier-footer-note">Nothing is spent until you confirm.</span>
                <div class="dossier-spacer"></div>
                <button type="button" class="dossier-btn-secondary" onClick=${chooseAnotherTarget}>Choose another target</button>
                <button type="button" class="dossier-btn-confirm" disabled=${!canAct} onClick=${confirmAttack}>
                  ATTACK FOR ${attackStrength} (${cost} food)
                </button>
              `
            : html`
                <div class="dossier-spacer"></div>
                <button type="button" class="dossier-btn-secondary" onClick=${onClose}>Close</button>
              `}
        </div>
      </div>
    </div>
  `;
}
