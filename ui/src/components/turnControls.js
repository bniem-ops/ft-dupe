import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import {
  loadGrubCards,
  parseIntField,
  activeWeatherName,
  activeWeatherEffect,
  isLastDayOfPhase,
  isImmuneToWeather,
  getActiveChickenAbilities,
  seasonCardList,
} from '../engine.js';
import { monogram, SEASON_COLORS } from '../cardVisuals.js';
import { Hearts } from './playerPanel.js';

// Fixed by core_rules.md's phase layout (days 1-2 / 3-5 / 6-7 every
// season) — not derived from seasonPhaseForDay since that maps day->phase,
// not phase->range, and the range only ever takes these three values.
const PHASE_DAY_RANGES = { 1: '1–2', 2: '3–5', 3: '6–7' };

// One selectable card per side, showing exactly what core_rules.md's
// discard decision needs to weigh: current health, the defend effect
// you'd be giving up if you keep it face-up, and the reward the *other*
// side's card would grant on defeat. Mirrors TargetDossier's grub layout
// rather than board.js's compact GrubSlot card, which omits the effect
// text entirely.
//
// Grid-laid-out (not flex) so the same four pieces — side label, hearts,
// art tile, name — can be rearranged between breakpoints via
// grid-template-areas without duplicating markup: desktop pairs side with
// hearts in a header row above a full-width art block, mobile pairs side
// with name beside a small inline art tile (README "Mobile" section).
function GrubChoiceCard({ side, deckSide, selected, onSelect, readOnly }) {
  const card = deckSide.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;
  const health = deckSide.faceUp?.currentHealth ?? 0;
  const maxHealth = parseIntField(card?.health ?? null, 0);
  return html`
    <button
      type="button"
      class=${`grub-choice-card ${selected ? 'selected' : ''} ${!card ? 'empty' : ''}`}
      disabled=${!card || readOnly}
      onClick=${onSelect}
    >
      <div class="grub-choice-content">
        <span class="gc-side">${side === 'inside' ? 'INSIDE' : 'OUTSIDE'}</span>
        ${card && html`<span class="gc-hearts"><${Hearts} health=${health} maxHealth=${maxHealth} /></span>`}
        ${card
          ? html`
              <div class="gc-art"><span class="monogram">${monogram(card.name)}</span></div>
              <div class="gc-name">${card.name ?? 'Unnamed Grub'}</div>
              <div class="grub-choice-label">DEFEND EFFECT</div>
              <div class="grub-choice-text">${card.effect || 'No special effect.'}</div>
              <div class="grub-choice-label">REWARD</div>
              <div class="grub-choice-text">${card.reward ?? '—'}</div>
            `
          : html`<div class="grub-choice-empty">No face-up Grub here.</div>`}
        ${selected && card && html`<div class="grub-choice-tag">DISCARDING THIS ONE</div>`}
      </div>
    </button>
  `;
}

// One player's Egg Exchange row: their own gets a +/- stepper (replacing
// the old <input type="number"> — playtest 2026-09-06 found the spinner
// fiddlier than useful for small ranges), everyone else gets a read-only
// pill. Status tag mirrors what advanceDay will actually do with this row,
// computed the same way (see engine's turn.ts) so it never lies.
function exchangeRowInfo(p, { myPlayerId, playerNames, pendingExchanges, outgoingWeatherEffect, outgoingWeatherName }) {
  const mine = myPlayerId == null || p.id === myPlayerId;
  const amountSet = pendingExchanges[p.id] !== undefined;
  const amount = pendingExchanges[p.id] ?? 0;
  const rate = getActiveChickenAbilities(p.chickenName, p.stage).reduce((r, a) => a.eggExchangeRate ?? r, 1);
  const cannotTrade = p.statusEffectsUntilNextEggExchange.includes('cannotParticipateInEggExchange');
  const rainBlocked =
    !cannotTrade &&
    !!outgoingWeatherEffect?.skipNextEggExchange &&
    !isImmuneToWeather(p.chickenName, p.stage, outgoingWeatherName ?? '', outgoingWeatherEffect.positive ?? false) &&
    !p.pendingWeatherImmuneUntilNextTurn &&
    !p.permanentWeatherImmuneUntilNextCard;
  const blocked = cannotTrade || rainBlocked;
  const noEggs = p.eggs === 0;
  const bonus = outgoingWeatherEffect?.eggExchangeBonusFoodIfParticipating ?? 0;
  const food = amount * rate + (amount > 0 ? bonus : 0);
  const editable = mine && !blocked && !noEggs;

  let tag, tagClass, yieldText, yieldActive;
  if (blocked) {
    tag = 'CANNOT TRADE';
    tagClass = 'cannot';
    yieldText = rainBlocked ? 'Pouring Rain — sitting out' : 'blocked';
    yieldActive = false;
  } else if (noEggs) {
    tag = 'NOTHING TO TRADE';
    tagClass = 'nothing';
    yieldText = '—';
    yieldActive = false;
  } else if (!amountSet) {
    tag = 'STILL DECIDING';
    tagClass = 'deciding';
    yieldText = 'no trade';
    yieldActive = false;
  } else if (amount === 0) {
    tag = 'SET';
    tagClass = 'set';
    yieldText = 'no trade';
    yieldActive = false;
  } else {
    tag = 'SET';
    tagClass = 'set';
    yieldText = `→ ${food} food`;
    yieldActive = true;
  }

  return {
    player: p,
    name: playerNames?.[p.id] ?? p.id,
    mine,
    editable,
    amount,
    rate,
    tag,
    tagClass,
    yieldText,
    yieldActive,
  };
}

function EggExchangeRow({ info, onSetExchangeAmount }) {
  const { player: p, name, mine, editable, amount, rate, tag, tagClass, yieldText, yieldActive } = info;
  const setAmount = (next) => onSetExchangeAmount(p.id, Math.max(0, Math.min(p.eggs, next)));
  return html`
    <div class=${`egg-exchange-row ${mine ? 'mine' : ''}`} key=${p.id}>
      <span class="egg-exchange-avatar-wrap">
        <span class=${`egg-exchange-avatar ${mine ? 'mine' : ''}`}>${(name?.[0] ?? '?').toUpperCase()}</span>
        <span class=${`egg-exchange-dot ${tagClass}`}></span>
      </span>
      <div class="egg-exchange-info">
        <span class="egg-exchange-name">${name}${mine ? ' — you' : ''}</span>
        <span class="egg-exchange-holding">holds ${p.eggs} egg${p.eggs === 1 ? '' : 's'}${rate > 1 ? ' · 2× rate' : ''}</span>
      </div>
      ${editable
        ? html`
            <div class="egg-exchange-stepper">
              <button type="button" class="egg-exchange-step-btn" disabled=${amount <= 0} onClick=${() => setAmount(amount - 1)}>−</button>
              <span class="egg-exchange-amount">${amount}</span>
              <button type="button" class="egg-exchange-step-btn" disabled=${amount >= p.eggs} onClick=${() => setAmount(amount + 1)}>+</button>
            </div>
          `
        : html`<span class="egg-exchange-readonly">${amount}</span>`}
      <span class=${`egg-exchange-yield ${yieldActive ? 'active' : ''}`}>${yieldText}</span>
      <span class=${`egg-exchange-tag ${tagClass}`}>${tag}</span>
    </div>
  `;
}

// Header content differs by step and (on a season rollover) gets a third
// variant — see README "Header (both steps)" and "Season rollover".
function computeHeader(state, dayEndReveal, exchangeApplies, pendingExchanges) {
  if (!dayEndReveal) {
    const alive = state.players.filter((p) => p.alive);
    const setCount = alive.filter((p) => pendingExchanges[p.id] !== undefined).length;
    return {
      eyebrow: 'END OF DAY',
      title: `Day ${state.day}`,
      subtitle: `${state.season} · Phase ${state.phase}`,
      chip: exchangeApplies ? `${setCount} OF ${alive.length} SET` : null,
      rollover: false,
    };
  }
  if (dayEndReveal.seasonRolledOver) {
    return {
      eyebrow: `${state.season.toUpperCase()} BEGINS`,
      title: `Day ${state.day}`,
      subtitle: `${state.season} · Phase ${state.phase}`,
      chip: 'SEASON TURNS',
      rollover: true,
    };
  }
  return {
    eyebrow: `DAY ${state.day} BEGINS`,
    title: `Day ${state.day}`,
    subtitle: `${state.season} · Phase ${state.phase}`,
    chip: 'WEATHER DRAWN',
    rollover: false,
  };
}

function revealIntroLine(reveal) {
  if (reveal.seasonRolledOver) {
    return `${reveal.fromSeason} closes. The flock wakes into ${reveal.season} — and so do the things hunting it.`;
  }
  return `${reveal.fromWeather ?? 'The old card'} lifts. ${reveal.toWeather ?? 'A new card'} settles over the flock for the rest of ${reveal.season}.`;
}

// Turns the captured dayEndReveal facts into the ledger strips — see
// README "The ledger" for the required lines. Capped implicitly by
// .dayend-ledger's own scroll rather than sliced here; a real day never
// produces more than a handful of these.
function buildLedgerLines(reveal, playerNames) {
  const name = (id) => playerNames?.[id] ?? id;
  const lines = [];
  if (reveal.discardedGrub) {
    const sideLabel = reveal.discardedGrub.side === 'inside' ? 'Inside' : 'Outside';
    lines.push({ mark: '✓', good: true, text: `${reveal.discardedGrub.cardName ?? 'A Grub'} discarded from ${sideLabel} — a fresh Grub is dealt in its place.` });
  }
  for (const ex of reveal.exchanges) {
    if (ex.blockedReason) {
      const reasonText = ex.blockedReason === 'pouringRain' ? 'sitting out Pouring Rain.' : 'marked by a Predator.';
      lines.push({ mark: '✕', good: false, text: `${name(ex.playerId)} could not trade — ${reasonText}` });
    } else if (ex.eggs > 0) {
      const parts = [];
      if (ex.rate > 1) parts.push(`${ex.eggs * ex.rate} at their ${ex.rate}× rate`);
      if (ex.bonus > 0) parts.push(`${reveal.fromWeather}'s ${ex.bonus}`);
      const detail = parts.length ? ` (${parts.join(' + ')})` : '';
      lines.push({ mark: '✓', good: true, text: `${name(ex.playerId)} traded ${ex.eggs} egg${ex.eggs === 1 ? '' : 's'} → ${ex.food} food${detail}.` });
    }
  }
  if (reveal.flashFloodFired) {
    lines.push({ mark: '✕', good: false, text: "Flash Flood discarded everyone's food as the phase ended." });
  }
  if (reveal.seasonRolledOver) {
    lines.push({ mark: '✦', good: true, text: `${reveal.fromSeason} ends. ${reveal.season} begins on day 1.` });
    if (reveal.predatorLevelUps.length) {
      const list = reveal.predatorLevelUps.join(' and ');
      lines.push({ mark: '✦', good: false, text: `Every surviving Predator levels up — ${list} advance${reveal.predatorLevelUps.length === 1 ? 's' : ''} a stage.` });
    }
    lines.push({ mark: '✦', good: true, text: 'Extra Action Tokens refresh for the whole flock.' });
  }
  for (const pc of reveal.personalCards) {
    lines.push({ mark: '✦', good: true, text: `${name(pc.playerId)} draws their own card — ${pc.cardName ?? 'unknown'}.` });
  }
  return lines;
}

function WeatherCard({ state, dayEndReveal, flipped, onFlip }) {
  const season = state.season;
  const active = state.weather.active;
  const card = active ? seasonCardList(season.toLowerCase(), state.config.eggspansion)[active.cardIndex] : null;
  const effect = activeWeatherEffect(state);
  const positive = effect?.positive ?? false;
  const range = PHASE_DAY_RANGES[state.phase] ?? '';
  return html`
    <button type="button" class=${`dayend-weather-card ${flipped ? 'face-up' : 'face-down'}`} disabled=${flipped} onClick=${onFlip}>
      ${!flipped
        ? html`
            <span class="dayend-card-hatch"></span>
            <span class="dayend-card-back-text"
              >${season.toUpperCase()}<br />WEATHER<br /><span class="dayend-card-qmark">?</span><br /><span class="dayend-card-prompt">TAP TO FLIP</span></span
            >
          `
        : html`
            <span class="dayend-card-inner">
              <span class="dayend-card-season-band" style=${`background:${SEASON_COLORS[season] ?? 'var(--gs-ochre)'}`}>${season.toUpperCase()} · PHASE ${state.phase}</span>
              <span class="dayend-card-body">
                <span class="dayend-card-name">${card?.name ?? 'Unknown'}</span>
                <span class=${`dayend-card-valence ${positive ? 'boon' : 'hazard'}`}>${positive ? 'BOON' : 'HAZARD'}</span>
                <span class="dayend-card-effect">${card?.effect || 'No special effect.'}</span>
                <span class="dayend-card-range">IN EFFECT FOR DAYS ${range}</span>
              </span>
            </span>
          `}
    </button>
  `;
}

export function TurnControls({
  state,
  onSubmitDayEnd,
  onCancel,
  myPlayerId,
  playerNames,
  pendingExchanges,
  onSetExchangeAmount,
  dayEndReveal,
  onDismissReveal,
}) {
  const [discardSide, setDiscardSide] = useState('inside');
  const [flipped, setFlipped] = useState(false);

  // A new reveal (a different day/season than whatever was last shown)
  // always starts face down again — see README "State": flipped is local
  // per device and resets when dayEndReveal changes identity.
  useEffect(() => {
    setFlipped(false);
  }, [dayEndReveal?.day, dayEndReveal?.season]);

  // Day-end is a continuation of the last player's turn in the day — same
  // seat-gating rule as ActionBar (see actionBar.js for why this is a UX
  // nicety, not a security boundary).
  const lastPlayerId = state.turnOrder[state.currentPlayerIndex];
  const canAct = myPlayerId == null || myPlayerId === lastPlayerId;
  const lastPlayerName = playerNames?.[lastPlayerId] ?? lastPlayerId;

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

  // The Grub discard is one shared choice for the whole table (README
  // "Engine / data changes" #2, option (b)) — only the day's last player's
  // pick is ever read by advanceDay, so everyone else gets a read-only
  // view of their live pick rather than an independent, unsynced one.
  const isDecider = canAct;

  // Egg Exchange only actually moves anything on the day that rolls into a
  // new phase — core_rules.md: "before days 1, 3, 6" of each season, i.e.
  // at the end of days 2, 5, 7 (isLastDayOfPhase) — except Fall day 7,
  // where advanceDay hits game-over before the exchange block ever runs,
  // so anything entered there is silently discarded (README "The
  // Fall-day-7 exception is a fix, not cosmetics").
  const isFallDay7 = state.season === 'Fall' && state.day === 7;
  const exchangeApplies = isLastDayOfPhase(state.day) && !isFallDay7;
  const outgoingWeatherName = activeWeatherName(state);
  const outgoingWeatherEffect = activeWeatherEffect(state);
  const snowAdHocAvailable = !exchangeApplies && !isFallDay7 && outgoingWeatherName === 'Snow' && state.phase === 3;

  const step = dayEndReveal ? 'reveal' : 'setup';
  const header = computeHeader(state, dayEndReveal, exchangeApplies, pendingExchanges);

  function submit() {
    onSubmitDayEnd({
      discardSide: effectiveSide,
      exchanges: state.players
        .filter((p) => p.alive && pendingExchanges[p.id] > 0)
        .map((p) => ({ playerId: p.id, amount: pendingExchanges[p.id] })),
    });
  }

  const rows = exchangeApplies
    ? state.players.filter((p) => p.alive).map((p) => exchangeRowInfo(p, { myPlayerId, playerNames, pendingExchanges, outgoingWeatherEffect, outgoingWeatherName }))
    : [];
  const notSet = rows.filter((r) => !r.mine && r.tagClass === 'deciding');
  // A player who never sets an amount is implicitly trading nothing — the
  // absent case reads as "still deciding" for everyone else's benefit, but
  // must never gate the table (README footer note: "an AFK player must not
  // be able to stall the table").
  const waitNote = exchangeApplies && notSet.length > 0 ? `${notSet[0].name} hasn't set theirs yet — you can still advance.` : '';

  const exchangeBonus = outgoingWeatherEffect?.eggExchangeBonusFoodIfParticipating ?? 0;
  const exchangeSkips = !!outgoingWeatherEffect?.skipNextEggExchange;
  const flashFloodWipe = !!outgoingWeatherEffect?.onPhaseEnd?.()?.discardAllFood;
  const calloutText = exchangeBonus > 0
    ? `+${exchangeBonus} bonus food to anyone who trades at least 1 egg`
    : exchangeSkips
      ? 'No exchange this phase — except for anyone immune'
      : flashFloodWipe
        ? 'All food is discarded when the phase ends — trade before it goes.'
        : null;
  const showCallout = exchangeApplies && calloutText;

  const footnoteParts = [];
  for (const r of rows) {
    if (r.rate > 1) footnoteParts.push(`${r.name} trades at ${r.rate}× rate.`);
  }
  for (const r of rows) {
    if (r.tagClass === 'cannot') footnoteParts.push(`${r.name} cannot trade this exchange.`);
  }

  return html`
    <div class="dossier-backdrop">
      <div class="dossier-panel kind-dayend">
        <div class="dossier-header">
          <span class="dossier-eyebrow">${header.eyebrow}</span>
          <span class="dossier-title">${header.title}</span>
          <span class="dossier-subtitle">${header.subtitle}</span>
          <div class="dossier-spacer"></div>
          ${header.chip && html`<span class=${`dayend-chip ${header.rollover ? 'rollover' : ''}`}>${header.chip}</span>`}
        </div>

        ${step === 'setup'
          ? html`
              <div class="dossier-stack-body">
                <div class="dossier-section">
                  <div class="dayend-section-head">
                    <span class="dossier-section-title">${exchangeApplies ? '1 · ' : ''}DISCARD A FACE-UP GRUB</span>
                    <span class="dossier-flavor-text"
                      >One shared choice — ${isDecider ? 'you make' : `${lastPlayerName} makes`} it for the table.</span
                    >
                  </div>
                  <div class="grub-choice-row">
                    <${GrubChoiceCard}
                      side="inside"
                      deckSide=${state.grubDecks.inside}
                      selected=${effectiveSide === 'inside'}
                      onSelect=${() => setDiscardSide('inside')}
                      readOnly=${!isDecider}
                    />
                    <${GrubChoiceCard}
                      side="outside"
                      deckSide=${state.grubDecks.outside}
                      selected=${effectiveSide === 'outside'}
                      onSelect=${() => setDiscardSide('outside')}
                      readOnly=${!isDecider}
                    />
                  </div>
                </div>

                ${exchangeApplies &&
                html`
                  <div class="dossier-divider"></div>
                  <div class="dossier-section">
                    <div class="dayend-section-head">
                      <span class="dossier-section-title">2 · EGG EXCHANGE</span>
                      <span class="dossier-flavor-text">Everyone sets their own from their own device. ${lastPlayerName} confirms for the table.</span>
                    </div>

                    ${showCallout &&
                    html`
                      <div class=${`dayend-weather-callout ${outgoingWeatherEffect?.positive ? 'boon' : 'hazard'}`}>
                        <span class="dayend-weather-chip">${(outgoingWeatherName ?? '').toUpperCase()} · ${outgoingWeatherEffect?.positive ? 'BOON' : 'HAZARD'}</span>
                        <span class="dossier-flavor-text">${calloutText}</span>
                      </div>
                    `}

                    <div class="egg-exchange-rows">
                      ${rows.map((info) => html`<${EggExchangeRow} info=${info} onSetExchangeAmount=${onSetExchangeAmount} />`)}
                    </div>
                    ${footnoteParts.length > 0 && html`<div class="egg-exchange-footnote">${footnoteParts.join(' ')}</div>`}
                  </div>

                  <div class="dossier-divider"></div>
                  <div class="dossier-section dayend-weather-teaser">
                    <div class="dayend-weather-stub">?</div>
                    <div class="dayend-weather-teaser-text">
                      <span class="dossier-section-title">3 · TOMORROW'S WEATHER</span>
                      <span class="dossier-flavor-text"
                        >Still face down. It turns over the moment the day advances — ${outgoingWeatherName}'s grip on the flock ends with it.</span
                      >
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

              <div class="dossier-footer dayend-setup-footer">
                <button type="button" class="dossier-btn-secondary" disabled=${!canAct} onClick=${onCancel}>Back to board</button>
                <span class="dossier-footer-note">${waitNote}</span>
                <button type="button" class="dossier-btn-confirm" disabled=${!canAct} onClick=${submit}>Confirm and advance</button>
              </div>
            `
          : html`
              <div class="dossier-stack-body dayend-reveal-body">
                <div class="dayend-reveal-card-col">
                  <${WeatherCard} state=${state} dayEndReveal=${dayEndReveal} flipped=${flipped} onFlip=${() => setFlipped(true)} />
                </div>
                <div class="dayend-ledger-col">
                  <span class="dossier-section-title">THE DAY TURNS OVER</span>
                  <span class="dossier-flavor-text dayend-ledger-intro">${revealIntroLine(dayEndReveal)}</span>
                  <div class="dayend-ledger">
                    ${buildLedgerLines(dayEndReveal, playerNames).map(
                      (l, i) => html`
                        <div class="dayend-ledger-row" key=${i}>
                          <span class=${`dayend-ledger-mark ${l.good ? 'good' : 'bad'}`}>${l.mark}</span>
                          <span class="dayend-ledger-text">${l.text}</span>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              </div>
              <div class="dossier-footer dayend-reveal-footer">
                <span class="dossier-footer-note">Everyone at the table sees this card.</span>
                <button type="button" class="dossier-btn-confirm" onClick=${onDismissReveal}>Start Day ${state.day}</button>
              </div>
            `}
      </div>
    </div>
  `;
}
