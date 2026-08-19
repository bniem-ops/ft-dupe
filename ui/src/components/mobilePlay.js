import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { loadGrubCards, activeWeatherName, OUTSIDE_LOCATIONS } from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { Board, playerColor, BOARD_ANCHORS, LOCATION_ANCHOR_KEY, boardZoomFrame } from './board.js';
import { healCap, eatCap } from './actionBar.js';
import { TurnControls } from './turnControls.js';
import { ProductionReveal } from './productionReveal.js';
import { PlayerPanel } from './playerPanel.js';

// Design mockups 7a ("Play") / 7b ("Place focus"): the mobile game
// screen, replacing the old .gs-mobile-dock's Board/Flock/Log tabs. One
// component, two view states — `focusLocation` null is 7a's whole-board
// overview, a location name is 7b's zoomed place view. See
// board.js's `boardZoomFrame` for how the zoom itself works: it renders
// the *real* Board component oversized inside a clipped viewport, so 7b
// gets fully legible, fully interactive cards for free — Attack/Move
// target-selection there is the exact same click handlers Board already
// has, not reimplemented.
const ALL_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];
const ZOOM_FACTOR = 2.6;
const PLACE_VIEWPORT = { width: 390, height: 346 };

const ACTION_TILES = [
  { key: 'forage', label: 'Forage', icon: '🌿', colorClass: 'field' },
  { key: 'eat', label: 'Eat', icon: '🍽', colorClass: 'teal' },
  { key: 'move', label: 'Move', icon: '➜', colorClass: 'dusk' },
  { key: 'drawCard', label: 'Draw', icon: '🂠', colorClass: 'dusk' },
  { key: 'layEgg', label: 'Lay Egg', icon: '🥚', colorClass: '' },
  { key: 'heal', label: 'Heal', icon: '✚', colorClass: '' },
  { key: 'brood', label: 'Brood', icon: '🪺', colorClass: '' },
  { key: 'attack', label: 'Attack', icon: '⚔', colorClass: 'blood' },
];

// What's at a location right now — the grub matching that side, a
// revealed/live predator (if any), and which other players are there.
// Same per-location filters board.js/actionBar.js already use
// (discardSide's Coop->inside mapping, PredatorSlot's location filter),
// just gathered in one place for the HERE card / IN THIS PLACE list.
function placeInfo(state, location) {
  const side = location === 'Coop' ? 'inside' : 'outside';
  const deckSide = state.grubDecks[side];
  const grubCard = deckSide.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;
  const predator = state.predators.find((p) => p.location === location && p.revealed && !p.defeated) ?? null;
  return { side, deckSide, grubCard, predator };
}

function MobileBoardOverview({ state, hereLocation, focusMoveTarget, onTapLocation }) {
  return html`
    <div class="mobile-board-overview">
      <img class="mobile-board-img" src="assets/board-normal.jpg" alt="Flock Together board" />
      <div class="mobile-board-scrim"></div>
      ${ALL_LOCATIONS.map((loc) => {
        const anchor = BOARD_ANCHORS[LOCATION_ANCHOR_KEY[loc]];
        const { predator } = placeInfo(state, loc);
        const here = state.players.filter((p) => p.alive && p.location === loc);
        return html`
          <div
            key=${loc}
            class=${`mobile-board-dot ${hereLocation === loc ? 'is-here' : ''} ${focusMoveTarget ? 'is-target' : ''}`}
            style=${{ left: `${anchor.x}%`, top: `${anchor.y}%`, width: `${anchor.w}%`, height: `${anchor.h}%` }}
            onClick=${() => onTapLocation(loc)}
          >
            ${here.map((p) => html`<span key=${p.id} class="mobile-board-token" style=${{ background: playerColor(state, p.id) }}>${(p.id).slice(0, 2)}</span>`)}
            ${predator &&
            html`<span class="mobile-board-predator-badge">${monogram(predator.name)}</span>`}
          </div>
        `;
      })}
      <div class="mobile-board-hint">⊕ Tap a place to zoom</div>
    </div>
  `;
}

function PlaceCard({ label, sublabel, tone }) {
  return html`
    <div class=${`mobile-place-row ${tone ?? ''}`}>
      <div class="mobile-place-row-label">${label}</div>
      ${sublabel && html`<div class="mobile-place-row-sub">${sublabel}</div>`}
    </div>
  `;
}

export function MobilePlay({
  state,
  dispatch,
  pendingPick,
  setPendingPick,
  myPlayerId,
  playerNames,
  myPlayer,
  currentPlayer,
  opponents,
  dayEndPending,
  onSubmitDayEnd,
  onEndTurn,
  onUseExtraAction,
  recentLog,
  formatLogEntry,
  onInspectTarget,
  onOpenPlayerSheet,
  actionBarFactory,
}) {
  const [focusLocation, setFocusLocation] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [broodTarget, setBroodTarget] = useState('');

  const canAct = myPlayerId == null || myPlayerId === currentPlayer.id;
  const noActions = state.actionsRemainingThisTurn <= 0 || !canAct;
  const deadPlayers = state.players.filter((p) => !p.alive);
  // Display (weather/location/strip/HERE-card) always follows myPlayer —
  // the device's own seat — not currentPlayer (whoever's turn it is), so a
  // teammate's turn never makes this device show their board as if it
  // were yours (playtest-feedback.md, 2026-08-19 "Multi-Player Board").
  // Action-taking (tapTile's dispatches, the embedded ActionBar/caps)
  // stays on currentPlayer since only the active player can act — the two
  // are the same player whenever a tile is actually enabled.
  const weatherName = activeWeatherName(state, myPlayer.id);
  const hereLocation = myPlayer.location;
  const pickingMove = pendingPick?.type === 'move';

  function tapLocation(name) {
    if (pickingMove) {
      dispatch({ type: 'move', playerId: pendingPick.playerId, destination: name });
      setPendingPick(null);
      setFocusLocation(null);
      return;
    }
    setFocusLocation(name);
  }

  function tapTile(key) {
    switch (key) {
      case 'forage':
        dispatch({ type: 'forage', playerId: currentPlayer.id });
        return;
      case 'layEgg':
        dispatch({ type: 'layEgg', playerId: currentPlayer.id });
        return;
      case 'drawCard':
        dispatch({ type: 'drawCard', playerId: currentPlayer.id });
        return;
      case 'eat':
        setPendingPick({ type: 'eat', playerId: currentPlayer.id });
        return;
      case 'heal':
        setPendingPick({ type: 'heal', playerId: currentPlayer.id });
        return;
      case 'move':
        setPendingPick({ type: 'move', playerId: currentPlayer.id });
        return;
      case 'attack':
        // The base Attack action always targets something at the
        // player's own current location (predator/grub reachability
        // both require it) — so jumping to the place-focus view for
        // "here" always lands on a screen where a real target is
        // actually clickable, no separate targeting UI needed on 7a.
        setPendingPick({ type: 'attack', step: 'target', playerId: currentPlayer.id });
        setFocusLocation(hereLocation);
        return;
      case 'brood':
        if (deadPlayers.length === 1) {
          dispatch({ type: 'brood', playerId: currentPlayer.id, targetPlayerId: deadPlayers[0].id });
        }
        return;
      default:
        return;
    }
  }

  const tileDisabled = {
    forage: noActions,
    layEgg: noActions,
    drawCard: noActions,
    eat: noActions || eatCap(currentPlayer.stage) < 1 || currentPlayer.food < 1,
    heal: noActions || healCap(currentPlayer.stage) < 1 || currentPlayer.food < 1 || currentPlayer.health >= currentPlayer.maxHealth,
    move: noActions,
    attack: noActions,
    brood: noActions || deadPlayers.length === 0,
  };

  const topbar = html`
    <div class="mobile-play-topbar">
      <span class="mobile-play-brand">FLOCK</span>
      <span class="mobile-play-season">${state.season.toUpperCase()}</span>
      <span class="mobile-play-day">Day ${state.day} · ${weatherName ?? '—'}</span>
      <div class="gs-spacer"></div>
      <button type="button" class="mobile-play-icon-btn" onClick=${() => setMenuOpen(true)}>⋯</button>
    </div>
  `;

  const footer = html`
    <div class="mobile-play-footer">
      <button type="button" class="mobile-play-footer-btn" onClick=${() => setLogOpen(true)}>Log</button>
      <button type="button" class="mobile-play-end-turn" disabled=${!canAct} onClick=${onEndTurn}>END TURN</button>
    </div>
  `;

  const actionsAndExtras = dayEndPending
    ? html`<${TurnControls} state=${state} onSubmitDayEnd=${onSubmitDayEnd} myPlayerId=${myPlayerId} playerNames=${playerNames} />`
    : currentPlayer.pendingProductionReveal
      ? html`<${ProductionReveal} player=${currentPlayer} dispatch=${dispatch} myPlayerId=${myPlayerId} />`
      : html`
          <div class="mobile-play-actions-header">
            <span class="mobile-play-actions-label">ACTIONS</span>
            <div class="actions-dots">
              ${Array.from({ length: state.actionsRemainingThisTurn }, (_, i) => html`<span key=${i} class="actions-dot"></span>`)}
            </div>
            <span class="actions-left-text">${state.actionsRemainingThisTurn} left</span>
            <div class="gs-spacer"></div>
            ${currentPlayer.extraActionTokenAvailable &&
            html`<button type="button" class="actions-token-btn" disabled=${!canAct} onClick=${onUseExtraAction}>+1 token</button>`}
          </div>
          <div class="mobile-play-tiles">
            ${ACTION_TILES.map(
              (t) => html`
                <button
                  key=${t.key}
                  type="button"
                  class=${`mobile-play-tile ${t.colorClass}`}
                  disabled=${tileDisabled[t.key]}
                  onClick=${() => tapTile(t.key)}
                >
                  <span class="mobile-play-tile-icon">${t.icon}</span>
                  <span class="mobile-play-tile-label">${t.label}</span>
                </button>
              `,
            )}
          </div>
          ${tileDisabled.brood === false &&
          deadPlayers.length > 1 &&
          html`<div class="mobile-play-brood-picker">
            <select onChange=${(e) => setBroodTarget(e.target.value)}>
              <option value="">Dead player…</option>
              ${deadPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
            </select>
            <button
              type="button"
              disabled=${!broodTarget}
              onClick=${() => dispatch({ type: 'brood', playerId: currentPlayer.id, targetPlayerId: broodTarget })}
            >
              Brood
            </button>
          </div>`}
          <div class="mobile-play-actionbar-embed">${actionBarFactory()}</div>
        `;

  const playerStrip = html`
    <div class="mobile-play-strip">
      <div class="mobile-play-strip-portrait">
        <span class="monogram">${monogram(myPlayer.chickenName)}</span>
      </div>
      <div class="mobile-play-strip-body">
        <div class="mobile-play-strip-name">
          <span>${playerNames?.[myPlayer.id] ?? myPlayer.id}</span>
          <span class="mobile-play-strip-stage">Stage ${myPlayer.stage}</span>
        </div>
        <div class="mobile-play-strip-stats">
          <span class="ref-text">❤ ${myPlayer.health}/${myPlayer.maxHealth}</span>
          <span class="ref-text">🌾 ${myPlayer.food}</span>
          <span class="ref-text">🥚 ${myPlayer.eggs}</span>
          <span class="ref-text">MEAL ${myPlayer.mealCounter}</span>
        </div>
      </div>
      <button type="button" class="mobile-play-strip-expand" onClick=${onOpenPlayerSheet}>▴</button>
    </div>
  `;

  if (focusLocation) {
    const anchor = BOARD_ANCHORS[LOCATION_ANCHOR_KEY[focusLocation]];
    const frame = boardZoomFrame(anchor, PLACE_VIEWPORT, ZOOM_FACTOR);
    const { grubCard, deckSide, predator } = placeInfo(state, focusLocation);
    const othersHere = state.players.filter((p) => p.alive && p.id !== myPlayer.id && p.location === focusLocation);
    const weatherCardName = weatherName;

    return html`
      <div class="mobile-play">
        ${topbar}
        <div class="mobile-place-header">
          <button type="button" class="mobile-play-icon-btn" onClick=${() => setFocusLocation(null)}>‹</button>
          <span class="mobile-place-title">${focusLocation.toUpperCase()}</span>
          <div class="gs-spacer"></div>
          <button type="button" class="mobile-play-icon-btn wide" onClick=${() => setFocusLocation(null)}>Fit board</button>
        </div>
        <div class="mobile-place-board" style=${{ width: `${PLACE_VIEWPORT.width}px`, height: `${PLACE_VIEWPORT.height}px` }}>
          <div class="mobile-place-board-inner" style=${{ width: `${frame.width}px`, height: `${frame.height}px`, left: `${frame.left}px`, top: `${frame.top}px` }}>
            <${Board}
              state=${state}
              dispatch=${dispatch}
              pendingPick=${pendingPick}
              setPendingPick=${setPendingPick}
              playerNames=${playerNames}
              hereLocation=${hereLocation}
              onInspectTarget=${onInspectTarget}
            />
          </div>
        </div>
        <div class="mobile-place-sheet">
          <div class="mobile-place-sheet-handle"></div>
          <div class="mobile-place-sheet-title">IN THIS PLACE</div>
          <div class="mobile-place-sheet-body">
            ${grubCard && html`<${PlaceCard} label=${`${grubCard.name} · grub`} sublabel=${`${deckSide.faceUp.currentHealth}/${grubCard.health} health`} tone="grub" />`}
            ${predator && html`<${PlaceCard} label=${`${predator.name} · predator`} sublabel=${`${predator.health}/${predator.maxHealth} health`} tone="predator" />`}
            ${othersHere.map(
              (p) => html`<${PlaceCard} key=${p.id} label=${playerNames?.[p.id] ?? p.id} sublabel=${`Stage ${p.stage} · ${p.health}♥`} />`,
            )}
            ${weatherCardName && html`<${PlaceCard} label=${weatherCardName} sublabel="Active weather" />`}
            ${!grubCard && !predator && othersHere.length === 0 && html`<${PlaceCard} label="Nothing else here right now." />`}
          </div>
          <div class="mobile-place-sheet-scroll">${actionsAndExtras}</div>
          ${footer}
        </div>
      </div>

      ${menuOpen &&
      html`<${MobileFlockSheet}
        opponents=${opponents}
        currentPlayer=${currentPlayer}
        state=${state}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        myPlayerId=${myPlayerId}
        playerNames=${playerNames}
        onClose=${() => setMenuOpen(false)}
      />`}
      ${logOpen && html`<${MobileLogSheet} recentLog=${recentLog} formatLogEntry=${formatLogEntry} playerNames=${playerNames} onClose=${() => setLogOpen(false)} />`}
    `;
  }

  const { grubCard, deckSide, predator } = placeInfo(state, hereLocation);

  return html`
    <div class="mobile-play">
      ${topbar}
      <${MobileBoardOverview} state=${state} hereLocation=${hereLocation} focusMoveTarget=${pickingMove} onTapLocation=${tapLocation} />
      <div class="mobile-play-sheet">
        <div class="mobile-play-here-card">
          <div class="mobile-play-here-label">YOU ARE HERE</div>
          <div class="mobile-play-here-name">${hereLocation.toUpperCase()}</div>
          <div class="mobile-play-here-badges">
            ${grubCard && html`<span class="mobile-play-badge grub">🪱 ${grubCard.name} ${deckSide.faceUp.currentHealth}♥</span>`}
            ${predator && html`<span class="mobile-play-badge predator">⚔ ${predator.name}</span>`}
            ${!predator && html`<span class="mobile-play-badge safe">Safe</span>`}
          </div>
        </div>
        ${playerStrip}
        ${actionsAndExtras}
        ${footer}
      </div>
    </div>

    ${menuOpen && html`<${MobileFlockSheet} opponents=${opponents} currentPlayer=${currentPlayer} playerNames=${playerNames} onClose=${() => setMenuOpen(false)} />`}
    ${logOpen && html`<${MobileLogSheet} recentLog=${recentLog} formatLogEntry=${formatLogEntry} playerNames=${playerNames} onClose=${() => setLogOpen(false)} />`}
  `;
}

// No opponent-status view exists in the 7a/7b mockups at all — dropping
// it entirely would regress the old mobile Flock tab, so the otherwise-
// undefined "⋯" button opens this instead: the same per-opponent info
// the desktop right-rail's expand card already shows, just listed.
function MobileFlockSheet({ opponents, currentPlayer, state, dispatch, pendingPick, setPendingPick, myPlayerId, playerNames, onClose }) {
  return html`
    <div class="mobile-play-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="mobile-play-overlay-sheet">
        <div class="mobile-play-overlay-header">
          <span>FLOCK</span>
          <button type="button" class="mobile-play-icon-btn" onClick=${onClose}>✕</button>
        </div>
        <div class="mobile-play-overlay-body">
          ${opponents.length === 0 && html`<div class="ref-text">Solo game — no other birds.</div>`}
          ${opponents.map(
            (p) => html`<${PlayerPanel}
              key=${p.id}
              variant="rail"
              player=${p}
              isCurrent=${p.id === currentPlayer.id}
              state=${state}
              dispatch=${dispatch}
              pendingPick=${pendingPick}
              setPendingPick=${setPendingPick}
              myPlayerId=${myPlayerId}
              displayName=${playerNames?.[p.id] ?? p.id}
              playerNames=${playerNames}
            />`,
          )}
        </div>
      </div>
    </div>
  `;
}

function MobileLogSheet({ recentLog, formatLogEntry, playerNames, onClose }) {
  return html`
    <div class="mobile-play-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="mobile-play-overlay-sheet">
        <div class="mobile-play-overlay-header">
          <span>LOG</span>
          <button type="button" class="mobile-play-icon-btn" onClick=${onClose}>✕</button>
        </div>
        <div class="mobile-play-overlay-body">
          ${recentLog.map((a, i) => html`<div key=${i} class="gs-log-entry">${formatLogEntry(a, playerNames)}</div>`)}
        </div>
      </div>
    </div>
  `;
}
