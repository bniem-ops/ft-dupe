import { html } from 'htm/preact';
import { findPredator, loadGrubCards, seasonCardList, OUTSIDE_LOCATIONS, getOwnAndBorrowedAbilities } from '../engine.js';
import { monogram, SEASON_COLORS } from '../cardVisuals.js';

export const PLAYER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085'];

// Percentage anchors on the board art (native ~1155x912, same layout across
// all three difficulty-tier scans below), matching the design mockup's own
// coordinate table ("2b — how the anchors work"). Every on-board element is
// one `{ id, x, y }` positioned with left:x%; top:y%;
// transform:translate(-50%,-50%) — nothing re-measures on resize, and
// swapping in a higher-res scan of the same composition changes nothing but
// the image file.
const BOARD_ANCHORS = {
  bonusDeck: { x: 7.5, y: 11.5 },
  bonusDiscard: { x: 19, y: 11.5 },
  grubDiscard: { x: 92.5, y: 10.5 },
  goldenGables: { x: 22, y: 47 },
  badlands: { x: 69, y: 31 },
  grubsOutside: { x: 85.8, y: 42 },
  grubsInside: { x: 63.3, y: 50.2 },
  coop: { x: 59.7, y: 66.5 },
  hendredAcreWood: { x: 11, y: 87 },
  gritStones: { x: 88, y: 84 },
  weatherTrack: { x: 52, y: 91 },
};

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
        <span>${predator.name} ${predator.isBoss ? '👑' : ''}</span>
      </div>
      <div class="card-plate-art"><span class="monogram">${monogram(predator.name)}</span></div>
      <div class="card-plate-body">
        <div class="card-plate-title-row">
          <span class="card-plate-name">${data.species} · Stage ${predator.stage}</span>
          <span class="card-plate-hp">♥ ${predator.health}/${predator.maxHealth}</span>
        </div>
        <div class="health-bar"><div class="health-fill" style=${{ width: `${(predator.health / predator.maxHealth) * 100}%` }}></div></div>
        ${!predator.defeated && html`<div class="ref-text">Return attack: ${stageData?.returnAttack ?? '?'} — ${stageData?.effect ?? ''}</div>`}
        ${predator.defeated && html`<div class="ref-text loot">Loot: ${data.lootDrop ?? '—'}</div>`}
      </div>
    </div>
  `;
}

function LocationNode({ name, anchor, state, dispatch, pendingPick, setPendingPick, playerNames, hereLocation }) {
  const isCoop = name === 'Coop';
  const predator = state.predators.find((p) => p.location === name);
  const pickingMove = pendingPick?.type === 'move';
  const pickingAttackTarget =
    (pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') && pendingPick.step === 'target';
  const pickingCardTarget = pendingPick?.type === 'cardTarget' && pendingPick.step === 'target';
  const actingPlayer = pickingAttackTarget ? state.players.find((p) => p.id === pendingPick.playerId) : null;
  // The base Attack action (unlike ranged loot such as Arrow Pack, which
  // uses the separate cardTarget flow) requires being at the Predator's
  // location — mirrors actions.ts's own check, so the board never
  // highlights a target the engine would then reject.
  const attackTargetReachable =
    !pickingAttackTarget || (predator != null && predator.location === actingPlayer?.location && !predator.cannotBeAttackedToday);

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

  function move() {
    dispatch({ type: 'move', playerId: pendingPick.playerId, destination: name });
    setPendingPick(null);
  }

  return html`
    <div
      class=${`loc-node ${isCoop ? 'coop' : ''} ${pickingMove ? 'pickable' : ''}`}
      style=${anchorStyle(anchor)}
      onClick=${pickingMove ? move : undefined}
    >
      <div class="loc-name">
        <span>${name}</span>
        ${hereLocation === name && html`<span class="here-badge">YOU ARE HERE</span>`}
      </div>
      ${predator &&
      html`<${PredatorCard}
        predator=${predator}
        clickable=${((pickingAttackTarget && attackTargetReachable) || pickingCardTarget) && predator.revealed && !predator.defeated}
        onSelect=${selectPredator}
      />`}
      <${PlayerTokens} state=${state} location=${name} playerNames=${playerNames} />
      ${pickingMove && html`<span class="loc-move-btn">Move here</span>`}
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

      <div class="board-locations">
        ${locations.map(
          (loc) =>
            html`<${LocationNode}
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
      </div>

      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.bonusDeck), width: '13.143cqw' }}>
        <div class="card-plate kind-bonus">
          <div class="card-plate-header"><span>BONUS</span></div>
          <div class="card-plate-art"><span class="monogram">${state.bonusDeck.drawPile.length}</span></div>
          <div class="card-plate-body"><div class="ref-text">face down</div></div>
        </div>
      </div>
      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.bonusDiscard), width: '12cqw' }}>
        <div class="card-plate kind-empty">
          <div class="ref-text">DISCARD</div>
          <div class="card-plate-count">${state.bonusDeck.discard.length}</div>
        </div>
      </div>
      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.grubDiscard), width: '13.429cqw' }}>
        <div class="card-plate kind-empty">
          <div class="ref-text">GRUB DISCARD</div>
          <div class="card-plate-count">${grubDiscardCount}</div>
        </div>
      </div>

      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.grubsInside), width: '16.571cqw' }}>
        <${GrubDeckBadge} side="inside" deckSide=${state.grubDecks.inside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>
      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.grubsOutside), width: '16.571cqw' }}>
        <${GrubDeckBadge} side="outside" deckSide=${state.grubDecks.outside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>

      <div class="board-slot" style=${{ ...anchorStyle(BOARD_ANCHORS.weatherTrack), width: '24.286cqw' }}>
        <div class="card-plate kind-weather">
          <div class="card-plate-stripe" style=${{ background: SEASON_COLORS[state.season] ?? 'var(--gs-ochre)' }}></div>
          <div class="card-plate-body">
            ${weatherCard
              ? html`
                  <div class="weather-name">${(weatherCard.name ?? 'Unnamed weather').toUpperCase()}</div>
                  <div class="weather-tag">${state.season.toUpperCase()} · DAY ${state.day}</div>
                  <div class="ref-text">${weatherCard.effect ?? ''}</div>
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
