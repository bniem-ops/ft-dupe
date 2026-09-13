import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  activeWeatherEffect,
  activeWeatherName,
  isImmuneToWeather,
  getOwnAndBorrowedAbilities,
  maxAttackStrengthFor,
  attackCostFor,
  OUTSIDE_LOCATIONS,
  loadGrubCards,
} from '../engine.js';

const ALL_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];

// Mirrors actions.ts's healCap/eatCap exactly, including eatCap's 0 for
// stage 3 — Hens/Roosters have no meal-counter benefit left to level into
// (mealsToNext is null past stage 3), so Eat is a deliberate no-op there,
// not a UI oversight. Used both for greying out invalid amounts and for
// disabling the button entirely when no nonzero amount is ever valid; the
// engine remains the source of truth and any miss here still surfaces via
// the dispatch error banner.
export function healCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 3;
}
export function eatCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 0;
}

// Left rail redesign (design 7a / 6b): one dark plate per action, color only
// in the icon and the trailing legality tag. `where` is the actual location
// rule from core_rules.md's action table — NOT the handoff doc's own table,
// which has Eat/Heal/Attack wrong (it lists them ANY/ANY/OUT; the rules are
// OUT/IN/ANY respectively). Ink colors are exactly the handoff's, since
// those aren't a rules question — only which location-word gets attached is.
const ACTION_META = {
  forage: { icon: '🌾', where: 'OUT', ink: 'var(--gs-ink-forage)' },
  eat: { icon: '🍽', where: 'OUT', ink: 'var(--gs-ink-eat)' },
  layEgg: { icon: '🥚', where: 'IN', ink: 'var(--gs-ink-layegg)' },
  brood: { icon: '🪺', where: 'IN', ink: 'var(--gs-ink-brood)' },
  heal: { icon: '❤️', where: 'IN', ink: 'var(--gs-ink-heal)' },
  move: { icon: '👣', where: 'ANY', ink: 'var(--gs-ink-move)' },
  drawCard: { icon: '🃏', where: 'ANY', ink: 'var(--gs-ink-draw)' },
  attack: { icon: '⚔️', where: 'ANY', ink: 'var(--gs-ink-attack)' },
};

function ActionTile({ meta, label, disabled, onClick }) {
  return html`
    <button type="button" class="rail-action-btn" disabled=${disabled} onClick=${onClick}>
      <span class="rail-action-icon">${meta.icon}</span>
      <span>${label}</span>
      <span class="rail-action-tag" style=${{ color: meta.ink, opacity: 0.8 }}>${meta.where}</span>
    </button>
  `;
}

// A row of clickable number boxes (1..max) instead of a native
// <input type="number">'s tiny spinner arrows — same pattern
// TargetDossier already uses for Attack Strength, reused here for Eat/Heal
// amounts, which cover an even smaller range (playtest feedback,
// 2026-09-06 "tiny arrow clicks... feels distracting").
export function AmountPicker({ min, max, value, onChange }) {
  const options = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
  return html`
    <div class="amount-picker-row">
      ${options.map(
        (n) => html`
          <button key=${n} type="button" class=${`amount-picker-box ${n === value ? 'selected' : ''}`} onClick=${() => onChange(n)}>
            ${n}
          </button>
        `,
      )}
    </div>
  `;
}

// A row of named buttons instead of a <select> — pick a target directly
// rather than opening a dropdown then a separate confirm step. Used for
// Brood (dead players), Tag Along (other alive players), and — in the left
// rail's play prompt — teammate/enemy/location picks that used to be
// <select> dropdowns. Candidates are usually 1-3 people, which is exactly
// what this suits (playtest feedback, 2026-09-06).
export function TargetChipRow({ candidates, selected, onSelect, emptyLabel }) {
  if (candidates.length === 0) return html`<span class="target-chip-empty">${emptyLabel}</span>`;
  return html`
    <div class="target-chip-row">
      ${candidates.map(
        (c) => html`
          <button key=${c.id} type="button" class=${`target-chip ${selected === c.id ? 'selected' : ''}`} onClick=${() => onSelect(c.id)}>
            ${c.label}
          </button>
        `,
      )}
    </div>
  `;
}

export function ActionBar({ state, player, dispatch, onEndTurn, onUseExtraAction, pendingPick, setPendingPick, myPlayerId, displayName, playerNames }) {
  const [healAmount, setHealAmount] = useState(1);
  const [eatAmount, setEatAmount] = useState(1);
  const [attackStrength, setAttackStrength] = useState(1);
  const [broodTarget, setBroodTarget] = useState('');
  const [tagAlongTarget, setTagAlongTarget] = useState('');
  const [strategemTarget, setStrategemTarget] = useState('');
  const [strategemEggs, setStrategemEggs] = useState(1);
  const [strategemDirection, setStrategemDirection] = useState('1');
  const [deusTarget, setDeusTarget] = useState('');
  const [guideTarget, setGuideTarget] = useState('');
  const [guideDestination, setGuideDestination] = useState('');
  const [companionId, setCompanionId] = useState('');
  const [companionStrength, setCompanionStrength] = useState(1);
  const [discardIndex, setDiscardIndex] = useState('');
  const [discardStrength, setDiscardStrength] = useState(1);

  // In a remote session, only the device that claimed this seat may act
  // for them — a UX nicety, not a security boundary (the engine's own
  // assertCanAct is the real guard). myPlayerId is null in local hotseat
  // play, where anyone can act on any seat, same as before phase 8.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const label = displayName ?? player.id;
  const noActions = state.actionsRemainingThisTurn <= 0 || !canAct;
  const deadPlayers = state.players.filter((p) => !p.alive);
  // Sunny/Nighttime: "once during this phase," on whichever of the
  // player's turns they choose — engine remains the source of truth
  // (useWeatherActionAdjustment throws if any of this is stale/wrong).
  const weather = activeWeatherEffect(state);
  const weatherName = activeWeatherName(state);
  const weatherAdjustmentAvailable =
    weather?.turnStartOncePerPhase &&
    !player.weatherAdjustmentUsedThisPhase &&
    !isImmuneToWeather(player.chickenName, player.stage, weatherName ?? '', weather.positive ?? false) &&
    !player.pendingWeatherImmuneUntilNextTurn &&
    !player.permanentWeatherImmuneUntilNextCard;

  const pickingAttackStrength =
    (pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') && pendingPick.step === 'strength';
  // A target already at 0 health (some Grubs — Slug, Wild Grain, Four Leaf
  // Clover — start there) needs no attack strength to claim; the food-cost
  // floor of 1 only makes sense against a target that has health left.
  const targetHealth = pickingAttackStrength
    ? pendingPick.targetType === 'predator'
      ? (state.predators.find((p) => p.name === pendingPick.targetId)?.health ?? 1)
      : (state.grubDecks[pendingPick.targetId]?.faceUp?.currentHealth ?? 1)
    : 1;
  const minAttackStrength = targetHealth <= 0 ? 0 : 1;
  // Mirrors actions.ts's attack() cap exactly — weather deltas, ability
  // bonuses (Adrenaline/Bolsterer), and a "+1 to attack strength" Bonus
  // Card all raise this above the chicken's base stat, so this can't just
  // be player.attackStrength (that let the card's bonus point be
  // unreachable through this input — see actionBar.js's git history /
  // playtest-feedback.md's 2026-08-19 "+1 Strength" entry).
  const { baseCap: attackBaseCap, maxAttackStrength: attackCap } = maxAttackStrengthFor(state, player.id);
  const attackCapCost = attackCostFor(state, player.id, attackCap);
  const affordableAttackMax = attackCapCost <= player.food ? attackCap : Math.min(attackBaseCap, player.food);
  const attackStrengthMax = Math.max(minAttackStrength, affordableAttackMax);
  const attackFoodCost = attackCostFor(state, player.id, attackStrength);
  const pickingCompanion = pendingPick?.type === 'attackWithCompanion' && pendingPick.step === 'companion';

  const abilities = getOwnAndBorrowedAbilities(player);
  // Foresight (General Tso S2): Draw Card reveals 2 and lets you pick —
  // opens the ForesightPicker (app.js, keyed off pendingPick) instead of
  // dispatching drawCard directly.
  const hasForesight = abilities.some((a) => a.drawTwoKeepOne);
  const nearbyAlivePlayers = state.players.filter((p) => p.id !== player.id && p.alive && p.location === player.location);
  const otherAlivePlayers = state.players.filter((p) => p.id !== player.id && p.alive);
  // Tomb Raider only reaches the discard pile on your own side (same
  // inside/outside rule as a normal Attack — see actions.ts's own check).
  const discardSide = player.location === 'Coop' ? 'inside' : 'outside';
  const discardPile = state.grubDecks[discardSide].discard;

  function cancelPick() {
    setPendingPick(null);
  }

  const canTagAlong = player.permanentTagAlongUnlocked || (player.chickenName === 'Wingston Coophill' && player.stage >= 2);

  // Per-chicken/situational triggered abilities — not one of the 8 core
  // actions, not a held card. The handoff doc doesn't cover these (they
  // didn't exist in the prototype); grouped here under their own section,
  // styled like the action tiles per the call made with the user rather
  // than guessing at an unspecified design.
  const hasSpecialAbilities =
    weatherAdjustmentAvailable ||
    (player.chickenName === 'Princess Layer' && !player.extraActionTokenAvailable && player.eggs >= 1) ||
    (player.chickenName === 'Cumberbill Rockefeather' && player.stage >= 2 && player.location !== 'Coop') ||
    abilities.some((a) => a.canAdjustAnyRollForEggs) ||
    abilities.some((a) => a.canRerollAnyRollForEgg) ||
    (abilities.some((a) => a.freeWeatherRedrawRoll) && !player.freeAbilityUsedThisTurn) ||
    (abilities.some((a) => a.freeMoveAnotherPlayerForEgg) && !player.freeAbilityUsedThisTurn) ||
    (abilities.some((a) => a.canAttackDiscardedGrubs) && discardPile.length > 0) ||
    canTagAlong;

  // The 8 actions below are color-coded by where core_rules.md's action
  // table allows them — the tag text/ink tells you where you need to be
  // (playtest feedback, 2026-08-23). Kept in sync with mobilePlay.js's
  // ACTION_TILES.
  return html`
    <div class="action-bar">
      <div class="actions-header">
        <span class="actions-header-label">Actions</span>
        <div class="actions-dots">
          ${Array.from({ length: state.actionsRemainingThisTurn }, (_, i) => html`<span key=${i} class="actions-dot"></span>`)}
        </div>
        <span class="actions-left-text">${state.actionsRemainingThisTurn} left</span>
        <span class="rail-location">📍 ${player.location}</span>
      </div>

      ${!canAct && html`<div class="turn-status"><span class="ref-text">(waiting for ${label}'s device)</span></div>`}

      ${pendingPick?.type === 'move' &&
      html`<div class="pending-hint">Click a location on the board to Move. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'eat' &&
      html`
        <div class="pending-hint">
          How much food to eat (1 meal per food)?
          <${AmountPicker} min=${1} max=${Math.max(1, Math.min(eatCap(player.stage), player.food))} value=${eatAmount} onChange=${setEatAmount} />
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              dispatch({ type: 'eat', playerId: player.id, amount: eatAmount });
              setPendingPick(null);
            }}
          >
            Confirm Eat
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${pendingPick?.type === 'heal' &&
      html`
        <div class="pending-hint">
          How many hearts to heal (1 food per heart)?
          <${AmountPicker}
            min=${1}
            max=${Math.max(1, Math.min(healCap(player.stage), player.food, player.maxHealth - player.health))}
            value=${healAmount}
            onChange=${setHealAmount}
          />
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              dispatch({ type: 'heal', playerId: player.id, amount: healAmount });
              setPendingPick(null);
            }}
          >
            Confirm Heal
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${pickingCompanion &&
      html`
        <div class="pending-hint">
          Bring along (must be nearby):
          <select onChange=${(e) => setCompanionId(e.target.value)} value=${companionId}>
            <option value="">Companion…</option>
            ${nearbyAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
          </select>
          <button
            type="button"
            disabled=${!canAct || !companionId}
            onClick=${() => setPendingPick({ ...pendingPick, step: 'target', companionId })}
          >
            Next: pick target
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${(pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') &&
      pendingPick.step === 'target' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'cardTarget' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target the card. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pickingAttackStrength &&
      html`
        <div class="pending-hint">
          ${pendingPick.type === 'attackWithCompanion' ? 'Your attack strength:' : 'Attack strength:'}
          <input
            type="number"
            min=${minAttackStrength}
            max=${attackStrengthMax}
            value=${attackStrength}
            onInput=${(e) => setAttackStrength(Number(e.target.value))}
          />
          (costs ${attackFoodCost} food${attackStrength > attackBaseCap ? ' — bonus point free' : ''})
          ${pendingPick.type === 'attackWithCompanion' &&
          html`
            ${playerNames?.[pendingPick.companionId] ?? pendingPick.companionId}'s attack strength:
            <input
              type="number"
              min="1"
              max=${state.players.find((p) => p.id === pendingPick.companionId)?.food ?? 1}
              value=${companionStrength}
              onInput=${(e) => setCompanionStrength(Number(e.target.value))}
            />
          `}
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              if (pendingPick.type === 'attackWithCompanion') {
                dispatch({
                  type: 'attackWithCompanion',
                  playerId: pendingPick.playerId,
                  companionId: pendingPick.companionId,
                  targetType: pendingPick.targetType,
                  targetId: pendingPick.targetId,
                  primaryStrength: attackStrength,
                  companionStrength,
                });
              } else {
                dispatch({
                  type: 'attack',
                  playerId: pendingPick.playerId,
                  targetType: pendingPick.targetType,
                  targetId: pendingPick.targetId,
                  attackStrength,
                });
              }
              setPendingPick(null);
            }}
          >
            Confirm Attack
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}

      <div class="actions-grid rail-tile-grid">
        <${ActionTile}
          meta=${ACTION_META.forage}
          label="Forage"
          disabled=${noActions}
          onClick=${() => dispatch({ type: 'forage', playerId: player.id })}
        />

        <${ActionTile}
          meta=${ACTION_META.eat}
          label="Eat"
          disabled=${noActions || eatCap(player.stage) < 1 || player.food < 1}
          onClick=${() => {
            setEatAmount(1);
            setPendingPick({ type: 'eat', playerId: player.id });
          }}
        />

        <${ActionTile}
          meta=${ACTION_META.layEgg}
          label="Lay Egg"
          disabled=${noActions}
          onClick=${() => dispatch({ type: 'layEgg', playerId: player.id })}
        />

        <${ActionTile}
          meta=${ACTION_META.brood}
          label="Brood"
          disabled=${noActions || deadPlayers.length === 0}
          onClick=${() => setPendingPick({ type: 'broodPick', playerId: player.id })}
        />

        <${ActionTile}
          meta=${ACTION_META.heal}
          label="Heal"
          disabled=${noActions || healCap(player.stage) < 1 || player.food < 1 || player.health >= player.maxHealth}
          onClick=${() => {
            setHealAmount(1);
            setPendingPick({ type: 'heal', playerId: player.id });
          }}
        />

        <${ActionTile} meta=${ACTION_META.move} label="Move" disabled=${noActions} onClick=${() => setPendingPick({ type: 'move', playerId: player.id })} />

        <${ActionTile}
          meta=${ACTION_META.drawCard}
          label="Draw Card"
          disabled=${noActions}
          onClick=${() =>
            hasForesight
              ? setPendingPick({ type: 'drawTwoKeepOne', playerId: player.id })
              : dispatch({ type: 'drawCard', playerId: player.id })}
        />

        <${ActionTile}
          meta=${ACTION_META.attack}
          label="Attack"
          disabled=${noActions}
          onClick=${() => setPendingPick({ type: 'attack', step: 'target', playerId: player.id })}
        />

        ${abilities.some((a) => a.joinsAttackAsSecond) &&
        html`<${ActionTile}
          meta=${ACTION_META.attack}
          label="Attack w/ Companion"
          disabled=${noActions || nearbyAlivePlayers.length === 0}
          onClick=${() => setPendingPick({ type: 'attackWithCompanion', step: 'companion', playerId: player.id })}
        />`}
      </div>

      ${pendingPick?.type === 'broodPick' &&
      html`
        <div class="pending-hint">
          Revive who?
          <${TargetChipRow}
            candidates=${deadPlayers.map((p) => ({ id: p.id, label: playerNames?.[p.id] ?? p.id }))}
            selected=${broodTarget}
            onSelect=${setBroodTarget}
            emptyLabel="No dead players"
          />
          <button
            type="button"
            disabled=${!canAct || !broodTarget}
            onClick=${() => {
              dispatch({ type: 'brood', playerId: player.id, targetPlayerId: broodTarget });
              setBroodTarget('');
              setPendingPick(null);
            }}
          >
            Confirm Brood
          </button>
          <button type="button" onClick=${() => { setBroodTarget(''); cancelPick(); }}>Cancel</button>
        </div>
      `}

      ${canAct &&
      hasSpecialAbilities &&
      html`
        <div class="rail-section-head">
          <span class="rail-section-label">Special</span>
          <span class="rail-section-rule"></span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${weatherAdjustmentAvailable &&
          html`<button type="button" class="rail-action-btn" onClick=${() => dispatch({ type: 'useWeatherActionAdjustment', playerId: player.id })}>
            <span class="rail-action-icon">🌤</span>
            <span>${weather.positive ? `Bonus Action (${weatherName})` : `Reduced Action (${weatherName})`}</span>
          </button>`}
          ${player.chickenName === 'Princess Layer' &&
          !player.extraActionTokenAvailable &&
          player.eggs >= 1 &&
          html`<button type="button" class="rail-action-btn" onClick=${() => dispatch({ type: 'refreshExtraActionToken', playerId: player.id })}>
            <span class="rail-action-icon">🔥</span>
            <span>Refresh Token (1 egg — Nobility)</span>
          </button>`}
          ${player.chickenName === 'Cumberbill Rockefeather' &&
          player.stage >= 2 &&
          player.location !== 'Coop' &&
          html`<button type="button" class="rail-action-btn" onClick=${() => dispatch({ type: 'freeMoveToCoop', playerId: player.id })}>
            <span class="rail-action-icon">🏠</span>
            <span>Move to Coop (free — Landlord)</span>
          </button>`}

          ${abilities.some((a) => a.canAdjustAnyRollForEggs) &&
          html`<div class="action-with-amount">
            <select onChange=${(e) => setStrategemTarget(e.target.value)} value=${strategemTarget}>
              <option value=${player.id}>Myself</option>
              ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
            </select>
            <input type="number" min="1" max=${Math.max(1, player.eggs)} value=${strategemEggs} onInput=${(e) => setStrategemEggs(Number(e.target.value))} />
            <select onChange=${(e) => setStrategemDirection(e.target.value)} value=${strategemDirection}>
              <option value="1">+1 per egg</option>
              <option value="-1">-1 per egg</option>
            </select>
            <button
              type="button"
              class="rail-action-btn"
              disabled=${player.eggs < 1}
              onClick=${() =>
                dispatch({
                  type: 'useStrategem',
                  playerId: player.id,
                  targetPlayerId: strategemTarget || player.id,
                  eggsToSpend: strategemEggs,
                  direction: Number(strategemDirection),
                })}
            >
              <span class="rail-action-icon">🥚</span>
              <span>Use Strategem</span>
            </button>
          </div>`}

          ${abilities.some((a) => a.canRerollAnyRollForEgg) &&
          html`<div class="action-with-amount">
            <select onChange=${(e) => setDeusTarget(e.target.value)} value=${deusTarget}>
              <option value=${player.id}>Myself</option>
              ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
            </select>
            <button
              type="button"
              class="rail-action-btn"
              disabled=${player.eggs < 1}
              onClick=${() => dispatch({ type: 'useDeusEggsMachina', playerId: player.id, targetPlayerId: deusTarget || player.id })}
            >
              <span class="rail-action-icon">🎲</span>
              <span>Deus Eggs Machina (1 egg, reroll)</span>
            </button>
          </div>`}

          ${abilities.some((a) => a.freeWeatherRedrawRoll) &&
          !player.freeAbilityUsedThisTurn &&
          html`<button type="button" class="rail-action-btn" onClick=${() => dispatch({ type: 'useWhereverAnyWeather', playerId: player.id })}>
            <span class="rail-action-icon">🌦</span>
            <span>Roll for New Weather (free, once/turn)</span>
          </button>`}

          ${abilities.some((a) => a.freeMoveAnotherPlayerForEgg) &&
          !player.freeAbilityUsedThisTurn &&
          html`<div class="action-with-amount">
            <select onChange=${(e) => setGuideTarget(e.target.value)} value=${guideTarget}>
              <option value="">Move who…</option>
              ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
            </select>
            <select onChange=${(e) => setGuideDestination(e.target.value)} value=${guideDestination}>
              <option value="">Destination…</option>
              ${ALL_LOCATIONS.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
            </select>
            <button
              type="button"
              class="rail-action-btn"
              disabled=${player.eggs < 1 || !guideTarget || !guideDestination}
              onClick=${() => {
                dispatch({ type: 'useWildernessGuide', playerId: player.id, targetPlayerId: guideTarget, destination: guideDestination });
                setGuideTarget('');
                setGuideDestination('');
              }}
            >
              <span class="rail-action-icon">🧭</span>
              <span>Wilderness Guide (1 egg)</span>
            </button>
          </div>`}

          ${abilities.some((a) => a.canAttackDiscardedGrubs) &&
          discardPile.length > 0 &&
          html`<div class="action-with-amount">
            <select onChange=${(e) => setDiscardIndex(e.target.value)} value=${discardIndex}>
              <option value="">Raid ${discardSide} discard…</option>
              ${discardPile.map(
                (cardId, i) => html`<option key=${i} value=${i}>${loadGrubCards()[cardId]?.name ?? 'Unnamed Grub'}</option>`,
              )}
            </select>
            <input
              type="number"
              min="1"
              max=${Math.max(1, player.food)}
              value=${discardStrength}
              onInput=${(e) => setDiscardStrength(Number(e.target.value))}
            />
            <button
              type="button"
              class="rail-action-btn"
              disabled=${noActions || discardIndex === ''}
              onClick=${() => {
                dispatch({
                  type: 'attackDiscardedGrub',
                  playerId: player.id,
                  side: discardSide,
                  discardIndex: Number(discardIndex),
                  attackStrength: discardStrength,
                });
                setDiscardIndex('');
              }}
            >
              <span class="rail-action-icon">🪦</span>
              <span>Raid Discard Pile (Tomb Raider)</span>
            </button>
          </div>`}

          ${canTagAlong &&
          html`<div class="action-with-amount">
            <${TargetChipRow}
              candidates=${state.players.filter((p) => p.id !== player.id && p.alive).map((p) => ({ id: p.id, label: playerNames?.[p.id] ?? p.id }))}
              selected=${tagAlongTarget}
              onSelect=${setTagAlongTarget}
              emptyLabel="No one nearby"
            />
            <button
              type="button"
              class="rail-action-btn"
              disabled=${!tagAlongTarget}
              onClick=${() => dispatch({ type: 'tagAlong', playerId: player.id, targetPlayerId: tagAlongTarget })}
            >
              <span class="rail-action-icon">🐥</span>
              <span>Tag Along</span>
            </button>
          </div>`}
        </div>
      `}
    </div>
  `;
}
