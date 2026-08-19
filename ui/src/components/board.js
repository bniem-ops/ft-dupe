import { html } from 'htm/preact';
import { findPredator, loadGrubCards, seasonCardList, OUTSIDE_LOCATIONS, getOwnAndBorrowedAbilities } from '../engine.js';
import { monogram, SEASON_COLORS } from '../cardVisuals.js';

export const PLAYER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085'];

// Percentage anchors on the board art (native ~1155x912, same layout across
// all three difficulty-tier scans below). Pulled directly from the design
// mockup's current 4a/4b turns — NOT from turn 2b's "anchor coordinate
// table", which documents an earlier pass that 4a/4b were hand-tweaked past
// without updating 2b back (bonusDeck/bonusDiscard/grubDiscard/weatherTrack
// all drifted; the day track and the four predator slots below don't exist
// in 2b's table at all). Every on-board element is one `{ x, y }` positioned
// with left:x%; top:y%; transform:translate(-50%,-50%) — nothing
// re-measures on resize, and swapping in a higher-res scan of the same
// composition changes nothing but the image file.
// The five outer-plus-Coop entries carry w/h too — these are the painted
// ovals themselves (where player tokens land and the Move target you click
// sits), sized and positioned to match 4a/4b exactly.
const BOARD_ANCHORS = {
  bonusDeck: { x: 5, y: 10 },
  bonusDiscard: { x: 15.65, y: 10 },
  grubDiscard: { x: 95.2, y: 9.9 },
  goldenGables: { x: 22, y: 47, w: 15.5, h: 8.5 },
  badlands: { x: 65, y: 31, w: 15.5, h: 8.5 },
  grubsOutside: { x: 85.8, y: 42 },
  grubsInside: { x: 63.3, y: 50.2 },
  coop: { x: 59.7, y: 66.5, w: 17.5, h: 8 },
  hendredAcreWood: { x: 11, y: 87, w: 15.5, h: 8.5 },
  gritStones: { x: 88, y: 84, w: 15.5, h: 8.5 },
  weatherTrack: { x: 27.2, y: 89.9 },
};

// The location NAME banner is a separately-positioned small tag, not part
// of the oval — matching 4a/4b, where the two are independent elements
// (the oval sits over open ground; the banner sits just below/past its
// edge so it never covers the oval's own "dead space").
const BANNER_ANCHORS = {
  coop: { x: 59.7, y: 71.5 },
  goldenGables: { x: 22, y: 50.5 },
  hendredAcreWood: { x: 11, y: 90.5 },
  gritStones: { x: 88, y: 87.5 },
  badlands: { x: 65, y: 34.5 },
};

// Each predator-bearing location gets its own card slot, floating above
// (not nested inside) the location oval — matching 4a/4b, where the
// predator "book" card and the location marker are two separately
// positioned elements. Coop never hosts a predator, so it has no entry.
// w is the slot's own width (design's printed-slot width), not just x/y.
const PREDATOR_ANCHORS = {
  'Golden Gables': { x: 22, y: 30.9, w: 12 },
  'Hendred Acre Wood': { x: 11, y: 71, w: 11.7 },
  'Grit Stones': { x: 88, y: 68, w: 11.7 },
  Badlands: { x: 65, y: 14.9, w: 11.7 },
};

// Width for each board-slot card, in cqw (percent of the board box's own
// width — .board.board-photo is container-type:size, so this is directly
// comparable to the design's own width% on the same box). Copied straight
// from the design's printed-slot widths, not guessed — this is what was
// making the on-board cards too wide before.
const BOARD_CARD_WIDTHS = {
  bonusDeck: 9.3,
  bonusDiscard: 9.3,
  grubDiscard: 8.7,
  grubsInside: 10.4,
  grubsOutside: 10.4,
  weatherTrack: 10.4,
};

// Minimum height (cqh) for the small deck/pile slots — a floor, not a
// fixed height: content-driven "auto" sizing still applies on top of it, so
// a card never gets forced shorter than its content needs, and the min
// itself shrinks proportionally as the board does since cqh is relative to
// the board's own rendered height, not a fixed pixel value.
// bonusDeck/bonusDiscard/grubDiscard sit near the top of the board (y≈10)
// and are centered on that anchor via translateY(-50%), so a height as
// tall as the grub piles' 20.9 pushed their top edge above y=0 and got
// clipped by the board's overflow:hidden — back to the design's own
// (shorter) heights for these three specifically.
const BOARD_CARD_MIN_HEIGHTS = {
  bonusDeck: 17.5,
  bonusDiscard: 17.5,
  grubDiscard: 16.7,
  grubsInside: 20.9,
  grubsOutside: 20.9,
};

// Day track — 7 cells, current day carries the weathervane token — laid
// across open ground at the bottom of the board, clear of the weather slot
// (which now sits to the left, matching 4a/4b's actual weatherTrack
// position above).
const DAY_TRACK_Y = 94.15;
const DAY_TRACK_XS = [36.0, 41.38, 46.76, 52.14, 57.52, 62.9, 68.28];

// Season key — a stacked SPRING/SUMMER/FALL legend just past the day
// track's last cell, same row (4a/4b).
const SEASON_KEY_ANCHOR = { x: 75.5, y: 94.15 };
const SEASON_ORDER = ['Spring', 'Summer', 'Fall'];

const LOCATION_ANCHOR_KEY = {
  Coop: 'coop',
  'Golden Gables': 'goldenGables',
  Badlands: 'badlands',
  'Grit Stones': 'gritStones',
  'Hendred Acre Wood': 'hendredAcreWood',
};

function anchorStyle(anchor) {
  return { left: `${anchor.x}%`, top: `${anchor.y}%`, transform: 'translate(-50%,-50%)' };
}

function slotStyle(anchorKey) {
  const minHeight = BOARD_CARD_MIN_HEIGHTS[anchorKey];
  return {
    ...anchorStyle(BOARD_ANCHORS[anchorKey]),
    width: `${BOARD_CARD_WIDTHS[anchorKey]}cqw`,
    ...(minHeight != null ? { minHeight: `${minHeight}cqh` } : {}),
  };
}

// Difficulty 1-3 → lighthearted, 4-6 → normal, 7-8 → dark and gloomy. Same
// village/river/mountain composition across all three scans (only mood and
// lighting change), so the BOARD_ANCHORS table above needs no per-tier
// variant — just the image file swaps.
function boardImageForDifficulty(difficulty) {
  if (difficulty <= 3) return 'assets/board-light.jpg';
  if (difficulty <= 6) return 'assets/board-normal.jpg';
  return 'assets/board-dark.jpg';
}

export function playerColor(state, playerId) {
  return PLAYER_COLORS[state.turnOrder.indexOf(playerId) % PLAYER_COLORS.length];
}

function activeWeatherCard(state) {
  const active = state.weather.active;
  if (!active) return null;
  const cards = seasonCardList(active.season.toLowerCase(), state.config.eggspansion);
  return cards[active.cardIndex] ?? null;
}

function PlayerTokens({ state, location, playerNames }) {
  const here = state.players.filter((p) => p.alive && p.location === location);
  return html`
    <div class="tokens">
      ${here.map((p) => {
        const name = playerNames?.[p.id] ?? p.id;
        return html`<span class="token" key=${p.id} title=${name} style=${{ background: playerColor(state, p.id) }}>${name.slice(0, 2)}</span>`;
      })}
    </div>
  `;
}

// One frame, one optional art layer (design mockup turn 3 — "card
// anatomy"): a colour band for the card's kind, a monogram plate standing
// in for real art, and rules text. Predators and Grubs both use this; the
// data shape only needs { kind, name, subtitle, band, hp, text }.
function PredatorCard({ predator, clickable, onSelect }) {
  if (!predator.revealed) {
    return html`
      <div class="card-plate kind-predator hidden">
        <div class="card-plate-header"><span>PREDATOR</span></div>
        <div class="card-plate-art"><span class="monogram">?</span></div>
        <div class="card-plate-body"><div class="ref-text">Face-down Boss</div></div>
      </div>
    `;
  }
  const data = findPredator(predator.name);
  const stageData = data.stages.find((s) => s.stage === predator.stage);
  return html`
    <div
      class=${`card-plate kind-predator ${predator.defeated ? 'defeated' : ''} ${clickable ? 'clickable' : ''}`}
      onClick=${clickable ? onSelect : undefined}
    >
      <div class="card-plate-header">
        <span>PREDATOR · STAGE ${predator.stage} ${predator.isBoss ? '👑' : ''}</span>
      </div>
      <div class="card-plate-art"><span class="monogram">${monogram(predator.name)}</span></div>
      <div class="card-plate-body">
        <div class="card-plate-title-row">
          <span class="card-plate-name">${predator.name} · ${data.species}</span>
          <span class="card-plate-hp">♥ ${predator.health}/${predator.maxHealth}</span>
        </div>
        <div class="health-bar"><div class="health-fill" style=${{ width: `${(predator.health / predator.maxHealth) * 100}%` }}></div></div>
        ${!predator.defeated && html`<div class="ref-text card-effect-text">Return attack: ${stageData?.returnAttack ?? '?'} — ${stageData?.effect ?? ''}</div>`}
        ${predator.defeated && html`<div class="ref-text loot">Loot: ${data.lootDrop ?? '—'}</div>`}
      </div>
    </div>
  `;
}

// The painted oval itself — where tokens sit and what you click to move
// there. Shape and position are independent of the name banner (see
// LocationBanner below), matching 4a/4b's structure.
function LocationOval({ name, anchor, state, dispatch, pendingPick, setPendingPick, playerNames, hereLocation }) {
  const pickingMove = pendingPick?.type === 'move';
  const isHere = hereLocation === name;

  function move() {
    dispatch({ type: 'move', playerId: pendingPick.playerId, destination: name });
    setPendingPick(null);
  }

  return html`
    <div
      class=${`loc-oval ${isHere ? 'is-here' : ''} ${pickingMove ? 'is-target' : ''}`}
      style=${{ ...anchorStyle(anchor), width: `${anchor.w}%`, height: `${anchor.h}%` }}
      onClick=${pickingMove ? move : undefined}
    >
      <${PlayerTokens} state=${state} location=${name} playerNames=${playerNames} />
    </div>
  `;
}

// A small read-only name tag, positioned near (not on top of) its oval.
function LocationBanner({ name, anchor, hereLocation }) {
  return html`
    <div class="loc-banner" style=${anchorStyle(anchor)}>
      <span>${name}</span>
      ${hereLocation === name && html`<span class="here-badge">YOU ARE HERE</span>`}
    </div>
  `;
}

// A predator's card floats above its location's oval as its own
// independently-anchored slot (design mockup turns 4a/4b), rather than
// nesting inside the location box — see PREDATOR_ANCHORS above.
function PredatorSlot({ location, anchor, state, dispatch, pendingPick, setPendingPick }) {
  const predator = state.predators.find((p) => p.location === location);
  if (!predator) return null;

  const pickingAttackTarget =
    (pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') && pendingPick.step === 'target';
  const pickingCardTarget = pendingPick?.type === 'cardTarget' && pendingPick.step === 'target';
  const actingPlayer = pickingAttackTarget ? state.players.find((p) => p.id === pendingPick.playerId) : null;
  // The base Attack action (unlike ranged loot such as Arrow Pack, which
  // uses the separate cardTarget flow) requires being at the Predator's
  // location — mirrors actions.ts's own check, so the board never
  // highlights a target the engine would then reject.
  const attackTargetReachable = !pickingAttackTarget || (predator.location === actingPlayer?.location && !predator.cannotBeAttackedToday);

  function selectPredator() {
    if (pickingCardTarget) {
      dispatch({
        type: pendingPick.actionType,
        playerId: pendingPick.playerId,
        [pendingPick.handIndexField]: pendingPick.handIndex,
        ...pendingPick.extraParams,
        targetType: 'predator',
        targetId: predator.name,
      });
      setPendingPick(null);
    } else {
      setPendingPick({ ...pendingPick, step: 'strength', targetType: 'predator', targetId: predator.name });
    }
  }

  return html`
    <div class="board-slot" style=${{ ...anchorStyle(anchor), width: `${anchor.w}cqw` }}>
      <${PredatorCard}
        predator=${predator}
        clickable=${((pickingAttackTarget && attackTargetReachable) || pickingCardTarget) && predator.revealed && !predator.defeated}
        onSelect=${selectPredator}
      />
    </div>
  `;
}

function DayTrack({ day }) {
  return html`
    <div class="day-track">
      ${DAY_TRACK_XS.map(
        (x, i) => html`
          <div key=${i + 1} class=${`day-cell ${day === i + 1 ? 'is-current' : ''}`} style=${{ left: `${x}%`, top: `${DAY_TRACK_Y}%`, transform: 'translate(-50%,-50%)' }}>
            ${day === i + 1 ? html`<span class="day-token">${i + 1}</span>` : html`<span class="day-num">${i + 1}</span>`}
          </div>
        `,
      )}
    </div>
  `;
}

function SeasonKey({ season }) {
  return html`
    <div class="season-key" style=${anchorStyle(SEASON_KEY_ANCHOR)}>
      ${SEASON_ORDER.map(
        (s) =>
          html`<span key=${s} class=${`season-key-pill season-${s.toLowerCase()} ${s === season ? 'is-active' : ''}`}>${s.toUpperCase()}</span>`,
      )}
    </div>
  `;
}

function GrubDeckBadge({ side, deckSide, state, dispatch, pendingPick, setPendingPick }) {
  const pickingAttackTarget =
    (pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') && pendingPick.step === 'target';
  const pickingCardTarget = pendingPick?.type === 'cardTarget' && pendingPick.step === 'target';
  const card = deckSide.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;

  // The base Attack action requires being on the matching side (Coop ->
  // inside, everywhere else -> outside) — mirrors actions.ts's own check —
  // unless the player holds Informant Network (Shellock Holmes S2), which
  // lifts that requirement entirely.
  const actingPlayer = pickingAttackTarget ? state.players.find((p) => p.id === pendingPick.playerId) : null;
  const playerSide = actingPlayer ? (actingPlayer.location === 'Coop' ? 'inside' : 'outside') : null;
  const mayAttackAnyLocation = actingPlayer ? getOwnAndBorrowedAbilities(actingPlayer).some((a) => a.mayAttackGrubsFromAnyLocation) : false;
  const attackTargetReachable = !pickingAttackTarget || mayAttackAnyLocation || side === playerSide;
  const clickable = !!card && ((pickingAttackTarget && attackTargetReachable) || pickingCardTarget);

  function select() {
    if (pickingCardTarget) {
      dispatch({
        type: pendingPick.actionType,
        playerId: pendingPick.playerId,
        [pendingPick.handIndexField]: pendingPick.handIndex,
        ...pendingPick.extraParams,
        targetType: 'grub',
        targetId: side,
      });
      setPendingPick(null);
    } else {
      setPendingPick({ ...pendingPick, step: 'strength', targetType: 'grub', targetId: side });
    }
  }

  return html`
    <div class=${`card-plate kind-grub ${clickable ? 'clickable' : ''}`} onClick=${clickable ? select : undefined}>
      <div class="card-plate-header">
        <span>${side === 'inside' ? 'INSIDE GRUB' : 'OUTSIDE GRUB'}</span>
        ${card && html`<span>${deckSide.faceUp.currentHealth}/${card.health}</span>`}
      </div>
      <div class="card-plate-art"><span class="monogram">${card ? monogram(card.name) : '—'}</span></div>
      <div class="card-plate-body">
        ${card ? html`<div class="card-plate-name">${card.name ?? 'Unnamed Grub'}</div>` : html`<div class="ref-text">empty</div>`}
        ${card && html`<div class="ref-text grub-reward-text">Reward: ${card.reward ?? '—'}</div>`}
        <div class="ref-text">Draw ${deckSide.drawPile.length} · Disc ${deckSide.discard.length}</div>
      </div>
    </div>
  `;
}

export function Board({ state, dispatch, pendingPick, setPendingPick, playerNames, hereLocation }) {
  const weatherCard = activeWeatherCard(state);
  const locations = ['Coop', ...OUTSIDE_LOCATIONS];
  const grubDiscardCount = state.grubDecks.inside.discard.length + state.grubDecks.outside.discard.length;

  return html`
    <div class="board board-photo">
      <img class="board-img" src=${boardImageForDifficulty(state.config.difficulty)} alt="Flock Together board" />
      <div class="board-scrim"></div>

      <${DayTrack} day=${state.day} />
      <${SeasonKey} season=${state.season} />

      <div class="board-locations">
        ${locations.map(
          (loc) =>
            html`<${LocationOval}
              key=${loc}
              name=${loc}
              anchor=${BOARD_ANCHORS[LOCATION_ANCHOR_KEY[loc]]}
              state=${state}
              dispatch=${dispatch}
              pendingPick=${pendingPick}
              setPendingPick=${setPendingPick}
              playerNames=${playerNames}
              hereLocation=${hereLocation}
            />`,
        )}
        ${locations.map(
          (loc) =>
            html`<${LocationBanner} key=${loc} name=${loc} anchor=${BANNER_ANCHORS[LOCATION_ANCHOR_KEY[loc]]} hereLocation=${hereLocation} />`,
        )}
      </div>

      ${Object.keys(PREDATOR_ANCHORS).map(
        (loc) =>
          html`<${PredatorSlot}
            key=${loc}
            location=${loc}
            anchor=${PREDATOR_ANCHORS[loc]}
            state=${state}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
          />`,
      )}

      <div class="board-slot" style=${slotStyle('bonusDeck')}>
        <div class="card-plate kind-bonus">
          <div class="card-plate-header"><span>BONUS</span></div>
          <div class="card-plate-art"><span class="monogram">${state.bonusDeck.drawPile.length}</span></div>
          <div class="card-plate-body"><div class="ref-text">face down</div></div>
        </div>
      </div>
      <div class="board-slot" style=${slotStyle('bonusDiscard')} title="Bonus discard pile">
        <div class="card-plate kind-empty">
          <span class="card-plate-count">${state.bonusDeck.discard.length}</span>
        </div>
      </div>
      <div class="board-slot" style=${slotStyle('grubDiscard')} title="Grub discard pile">
        <div class="card-plate kind-empty kind-grub-empty">
          <span class="card-plate-count">${grubDiscardCount}</span>
        </div>
      </div>

      <div class="board-slot" style=${slotStyle('grubsInside')}>
        <${GrubDeckBadge} side="inside" deckSide=${state.grubDecks.inside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>
      <div class="board-slot" style=${slotStyle('grubsOutside')}>
        <${GrubDeckBadge} side="outside" deckSide=${state.grubDecks.outside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>

      <div class="board-slot" style=${slotStyle('weatherTrack')}>
        <div class="card-plate kind-weather">
          <div class="card-plate-stripe" style=${{ background: SEASON_COLORS[state.season] ?? 'var(--gs-ochre)' }}></div>
          <div class="card-plate-body">
            ${weatherCard
              ? html`
                  <div class="weather-name">${(weatherCard.name ?? 'Unnamed weather').toUpperCase()}</div>
                  <div class="weather-tag">${state.season.toUpperCase()} · DAY ${state.day}</div>
                  <div class="ref-text card-effect-text">${weatherCard.effect ?? ''}</div>
                `
              : html`
                  <div class="weather-name">NO WEATHER</div>
                  <div class="weather-tag">${state.season.toUpperCase()} · DAY ${state.day}</div>
                `}
          </div>
        </div>
      </div>
    </div>
  `;
}
