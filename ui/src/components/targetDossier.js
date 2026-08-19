import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { findPredator, loadGrubCards, maxAttackStrengthFor, attackCostFor, parseIntField } from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { Hearts } from './playerPanel.js';

// Design mockup 6a, generalized to both Predators and Grubs: opens the
// moment a target is selected during an armed Attack, and is itself the
// confirm step (no separate strength screen after it) — or, with nothing
// armed, opens read-only as a reference card. The caller decides
// *whether* to render this at all (and passes a stable
// `key=${targetType}-${targetId}` so a target change remounts fresh
// rather than carrying over a stale attack-strength selection) — this
// component always has a real target once mounted, which keeps its hook
// order unconditional.
//
// Predators (findPredator) carry stages/species/return-attack/Loot Drop;
// Grubs (loadGrubCards, indexed by faceUp.cardId) are simpler — one
// health value, a defend/retaliation effect roll folded into `effect`
// (no separate return-attack number), and a Reward instead of a Loot
// Drop. The shared chrome (backdrop, header, strength picker, footer)
// is identical either way.
export function TargetDossier({ state, dispatch, pendingPick, setPendingPick, myPlayerId, targetType, targetId, committing, onClose }) {
  const isPredator = targetType === 'predator';
  const predator = isPredator ? state.predators.find((p) => p.name === targetId) : null;
  const deckSide = !isPredator ? state.grubDecks[targetId] : null;
  const grubCard = deckSide?.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;
  const found = isPredator ? !!predator : !!grubCard;

  const health = isPredator ? (predator?.health ?? 0) : (deckSide?.faceUp?.currentHealth ?? 0);
  const maxHealth = isPredator ? (predator?.maxHealth ?? 0) : parseIntField(grubCard?.health ?? null, 0);

  const { baseCap, maxAttackStrength } = committing ? maxAttackStrengthFor(state, pendingPick.playerId) : { baseCap: 0, maxAttackStrength: 0 };
  const minAttackStrength = health <= 0 ? 0 : 1;
  const [attackStrength, setAttackStrength] = useState(Math.max(minAttackStrength, Math.min(baseCap, maxAttackStrength)));
  if (!found) return null;

  const predatorData = isPredator ? findPredator(predator.name) : null;
  const stageData = isPredator ? predatorData.stages.find((s) => s.stage === predator.stage) : null;
  const damageTaken = Math.max(0, maxHealth - health);
  const player = committing ? state.players.find((p) => p.id === pendingPick.playerId) : null;
  const canAct = committing && (myPlayerId == null || myPlayerId === pendingPick.playerId);
  const cost = committing ? attackCostFor(state, pendingPick.playerId, attackStrength) : 0;

  const name = isPredator ? predator.name : (grubCard.name ?? 'Unnamed Grub');
  const subtitle = isPredator ? `${predatorData.species ?? ''} · ${predator.location}` : targetId === 'inside' ? 'Inside Grub' : 'Outside Grub';
  const effectSectionTitle = isPredator ? `PREDATOR EFFECT · STAGE ${predator.stage}` : 'DEFEND EFFECT';
  const effectText = (isPredator ? stageData?.effect : grubCard.effect) || 'No special effect.';
  const rewardSectionTitle = isPredator ? 'LOOT DROP' : 'REWARD';
  const rewardText = (isPredator ? predatorData.lootDrop : grubCard.reward) ?? '—';

  function chooseAnotherTarget() {
    setPendingPick({ ...pendingPick, step: 'target', targetType: undefined, targetId: undefined });
  }

  function confirmAttack() {
    dispatch({ type: 'attack', playerId: pendingPick.playerId, targetType, targetId, attackStrength });
    setPendingPick(null);
  }

  return html`
    <div class="dossier-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class=${`dossier-panel kind-${targetType}`}>
        <div class="dossier-header">
          <span class="dossier-eyebrow">${isPredator ? 'PREDATOR' : 'GRUB'}</span>
          <span class="dossier-title">${name}</span>
          <span class="dossier-subtitle">${subtitle}</span>
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-close" onClick=${onClose}>✕</button>
        </div>

        <div class="dossier-body">
          <div class="dossier-portrait-col">
            <div class="dossier-portrait-plate">
              <div class="dossier-portrait-art"><span class="monogram">${monogram(name)}</span></div>
              <div class="dossier-portrait-label">${name}</div>
            </div>

            <div class="dossier-health-card">
              <div class="dossier-label">HEALTH REMAINING</div>
              <div class="dossier-health-row">
                <span class="dossier-health-number">${health}</span>
                <${Hearts} health=${health} maxHealth=${maxHealth} />
              </div>
              ${damageTaken > 0 && html`<div class="dossier-flavor">${damageTaken} damage already taken this season.</div>`}
            </div>

            ${isPredator &&
            html`
              <div class="dossier-stat-row">
                <div class="dossier-stat">
                  <div class="dossier-label">RETURN</div>
                  <div class="dossier-stat-value">${stageData?.returnAttack ?? '?'}</div>
                </div>
              </div>
            `}
          </div>

          <div class="dossier-detail-col">
            ${isPredator &&
            html`
              <div class="dossier-section">
                <span class="dossier-section-title">RETURN ATTACK</span>
                <div class="dossier-flavor-text">
                  Striking ${name} and failing to defeat it triggers its return attack of ${stageData?.returnAttack ?? '?'} to the attacking
                  bird.
                </div>
              </div>
              <div class="dossier-divider"></div>
            `}

            <div class="dossier-section">
              <span class="dossier-section-title">${effectSectionTitle}</span>
              <div class="dossier-effect-card">
                <div class="dossier-flavor-text">${effectText}</div>
              </div>
            </div>

            <div class="dossier-divider"></div>

            <div class="dossier-section">
              <span class="dossier-section-title">${rewardSectionTitle}</span>
              <div class="dossier-flavor-text">${rewardText}</div>
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
