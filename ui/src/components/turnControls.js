import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { loadGrubCards, parseIntField, activeWeatherName, activeWeatherEffect, isLastDayOfPhase } from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { Hearts } from './playerPanel.js';

// One selectable card per side, showing exactly what core_rules.md's
// discard decision needs to weigh: current health, the defend effect
// you'd be giving up if you keep it face-up, and the reward the *other*
// side's card would grant on defeat. Mirrors TargetDossier's grub layout
// rather than board.js's compact GrubSlot card, which omits the effect
// text entirely.
function GrubChoiceCard({ side, deckSide, selected, onSelect }) {
  const card = deckSide.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;
  const health = deckSide.faceUp?.currentHealth ?? 0;
  const maxHealth = parseIntField(card?.health ?? null, 0);
  return html`
    <button
      type="button"
      class=${`grub-choice-card ${selected ? 'selected' : ''} ${!card ? 'empty' : ''}`}
      disabled=${!card}
      onClick=${onSelect}
    >
      <div class="grub-choice-header">
        <span>${side === 'inside' ? 'INSIDE' : 'OUTSIDE'}</span>
        ${card && html`<${Hearts} health=${health} maxHealth=${maxHealth} />`}
      </div>
      ${card
        ? html`
            <div class="grub-choice-art"><span class="monogram">${monogram(card.name)}</span></div>
            <div class="grub-choice-name">${card.name ?? 'Unnamed Grub'}</div>
            <div class="grub-choice-label">DEFEND EFFECT</div>
            <div class="grub-choice-text">${card.effect || 'No special effect.'}</div>
            <div class="grub-choice-label">REWARD</div>
            <div class="grub-choice-text">${card.reward ?? '—'}</div>
          `
        : html`<div class="grub-choice-empty">No face-up Grub here.</div>`}
      ${selected && card && html`<div class="grub-choice-tag">DISCARDING THIS ONE</div>`}
    </button>
  `;
}

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
  // picker claim a choice that won't actually happen.
  const insideHasCard = !!state.grubDecks.inside.faceUp;
  const outsideHasCard = !!state.grubDecks.outside.faceUp;
  const effectiveSide =
    discardSide === 'inside' && !insideHasCard && outsideHasCard
      ? 'outside'
      : discardSide === 'outside' && !outsideHasCard && insideHasCard
        ? 'inside'
        : discardSide;

  // Egg Exchange only actually moves anything on the day that rolls into a
  // new phase — core_rules.md: "before days 1, 3, 6" of each season, i.e.
  // at the end of days 2, 5, 7 (isLastDayOfPhase). Any other day, advanceDay
  // just ignores whatever's filled in here. Rather than always showing the
  // section with a "may not apply" disclaimer, hide it outright on days it
  // can't do anything, and surface Snow's exception (it grants an ad-hoc
  // Egg Exchange on any turn of the season's last phase, not just here —
  // see actions.ts's adHocEggExchange / playerPanel.js's dock control) as a
  // pointer instead of a second copy of that control.
  const exchangeApplies = isLastDayOfPhase(state.day);
  const outgoingWeatherName = activeWeatherName(state);
  const outgoingWeatherEffect = activeWeatherEffect(state);
  const exchangeBonus = outgoingWeatherEffect?.eggExchangeBonusFoodIfParticipating ?? 0;
  const snowAdHocAvailable = !exchangeApplies && outgoingWeatherName === 'Snow' && state.phase === 3;

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
    <div class="dossier-backdrop">
      <div class="dossier-panel kind-dayend">
        <div class="dossier-header">
          <span class="dossier-eyebrow">END OF DAY</span>
          <span class="dossier-title">Day ${state.day}</span>
          <span class="dossier-subtitle">${state.season} · Phase ${state.phase}</span>
        </div>

        <div class="dossier-stack-body">
          <div class="dossier-section">
            <span class="dossier-section-title">DISCARD WHICH FACE-UP GRUB TODAY?</span>
            <div class="grub-choice-row">
              <${GrubChoiceCard}
                side="inside"
                deckSide=${state.grubDecks.inside}
                selected=${effectiveSide === 'inside'}
                onSelect=${() => setDiscardSide('inside')}
              />
              <${GrubChoiceCard}
                side="outside"
                deckSide=${state.grubDecks.outside}
                selected=${effectiveSide === 'outside'}
                onSelect=${() => setDiscardSide('outside')}
              />
            </div>
          </div>

          ${exchangeApplies &&
          html`
            <div class="dossier-divider"></div>
            <div class="dossier-section">
              <span class="dossier-section-title">EGG EXCHANGE</span>
              <div class="dossier-flavor-text">
                Trade any number of eggs for equal food.
                ${exchangeBonus > 0 &&
                html` <b>${outgoingWeatherName} bonus: +${exchangeBonus} food to anyone who trades at least 1 egg.</b>`}
              </div>
              <div class="egg-exchange-rows">
                ${state.players
                  .filter((p) => p.alive)
                  .map(
                    (p) => html`
                      <label class="egg-exchange-row" key=${p.id}>
                        <span>${playerNames?.[p.id] ?? p.id} <span class="dossier-flavor">(${p.eggs} eggs)</span></span>
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
            </div>
          `}

          ${snowAdHocAvailable &&
          html`
            <div class="dossier-divider"></div>
            <div class="dossier-section">
              <span class="dossier-section-title">EGG EXCHANGE</span>
              <div class="dossier-flavor-text">
                Not a phase-boundary day, but Snow is active in the season's last phase — you can still Egg Exchange on any of your
                turns from your own player panel, any day this phase.
              </div>
            </div>
          `}
        </div>

        <div class="dossier-footer">
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-btn-confirm" disabled=${!canAct} onClick=${submit}>Confirm and Advance</button>
        </div>
      </div>
    </div>
  `;
}
