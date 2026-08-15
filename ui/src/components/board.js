import { html } from 'htm/preact';
import { findPredator, loadGrubCards, seasonCardList, OUTSIDE_LOCATIONS, getOwnAndBorrowedAbilities } from '../engine.js';

export const PLAYER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085'];

// Fixed board layout (Coop + the 4 real Outside locations) — percentage
// positions matching the design mockup's node placement. Hardcoded per
// location name since the board itself is a fixed 5-node layout, not
// dynamically generated.
const LOCATION_POSITIONS = {
  Coop: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' },
  'Golden Gables': { left: '4%', top: '18%' },
  Badlands: { right: '4%', top: '5%' },
  'Grit Stones': { right: '4%', bottom: '5%' },
  'Hendred Acre Wood': { left: '4%', bottom: '5%' },
};

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

function PredatorCard({ predator, clickable, onSelect }) {
  if (!predator.revealed) {
    return html`<div class="predator-card hidden">Face-down Boss</div>`;
  }
  const data = findPredator(predator.name);
  const stageData = data.stages.find((s) => s.stage === predator.stage);
  return html`
    <div
      class=${`predator-card ${predator.defeated ? 'defeated' : ''} ${clickable ? 'clickable' : ''}`}
      onClick=${clickable ? onSelect : undefined}
    >
      <div class="predator-name">${predator.name} ${predator.isBoss ? '👑' : ''}</div>
      <div class="predator-species">${data.species} · Stage ${predator.stage}</div>
      <div class="health-bar"><div class="health-fill" style=${{ width: `${(predator.health / predator.maxHealth) * 100}%` }}></div></div>
      <div class="health-text">${predator.health} / ${predator.maxHealth}</div>
      ${!predator.defeated && html`<div class="ref-text">Return attack: ${stageData?.returnAttack ?? '?'} — ${stageData?.effect ?? ''}</div>`}
      ${predator.defeated && html`<div class="ref-text loot">Loot: ${data.lootDrop ?? '—'}</div>`}
    </div>
  `;
}

function LocationNode({ name, state, dispatch, pendingPick, setPendingPick, playerNames, hereLocation }) {
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
      style=${LOCATION_POSITIONS[name]}
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
    <div class=${`deck-badge ${clickable ? 'clickable' : ''}`} onClick=${clickable ? select : undefined}>
      <div class="deck-label">${side === 'inside' ? 'INSIDE GRUB' : 'OUTSIDE GRUB'}</div>
      ${card
        ? html`
            <div class="grub-name">${card.name ?? 'Unnamed Grub'}</div>
            <div class="health-text">${deckSide.faceUp.currentHealth} / ${card.health}</div>
          `
        : html`<div class="ref-text">empty</div>`}
      <div class="deck-counts">Draw ${deckSide.drawPile.length} · Disc ${deckSide.discard.length}</div>
    </div>
  `;
}

export function Board({ state, dispatch, pendingPick, setPendingPick, playerNames, hereLocation }) {
  const weatherCard = activeWeatherCard(state);
  const locations = ['Coop', ...OUTSIDE_LOCATIONS];

  return html`
    <div class="board">
      <div class="board-locations">
        ${locations.map(
          (loc) =>
            html`<${LocationNode}
              key=${loc}
              name=${loc}
              state=${state}
              dispatch=${dispatch}
              pendingPick=${pendingPick}
              setPendingPick=${setPendingPick}
              playerNames=${playerNames}
              hereLocation=${hereLocation}
            />`,
        )}
      </div>

      <div class="board-hud">
        <strong>${state.season} · Day ${state.day} (Phase ${state.phase})</strong>
        ${weatherCard
          ? html`<span>${weatherCard.name ?? 'Unnamed weather'} — ${weatherCard.effect ?? ''}</span>`
          : html`<span>No weather card active</span>`}
      </div>

      <div class="board-decks">
        <div class="deck-badge">
          <div class="deck-label">BONUS</div>
          <div class="deck-counts">Draw ${state.bonusDeck.drawPile.length} · Disc ${state.bonusDeck.discard.length}</div>
        </div>
        <${GrubDeckBadge} side="inside" deckSide=${state.grubDecks.inside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
        <${GrubDeckBadge} side="outside" deckSide=${state.grubDecks.outside} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>
    </div>
  `;
}
