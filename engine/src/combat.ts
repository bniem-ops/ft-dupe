// Combat resolution machinery: the 3-step order (Weather -> Predator ->
// Chicken abilities), return-attack damage, loot drop on kill, Grub
// combat, the death consequence, and predator level-up at season end.
//
// Scope boundary (decided before this phase): this module builds the
// combat *pipeline* only. The Weather/Predator/Chicken-ability *content*
// — the free-text roll-table effects themselves (e.g. Hens Gruber's
// "Lose 1 food", Ursula Bone's "Return attack +1") — stays stubbed as
// no-op hooks. That's phase 6 ("ability effect engine"). The one
// cross-cutting behavior phase 4 needs structurally is `dodged`:
// "Dodging a return attack also dodges the Predator effect"
// (core_rules.md).
import {
  GameState,
  PlayerState,
  PredatorState,
  Stage,
  DifficultyLevel,
  HeldGrubCard,
  CombatContext,
  CombatStageResult,
} from './types.js';
import { findPredator, loadGrubCards, parseIntField, parseHealthMultiplier } from './data.js';
import { getPlayer, replacePlayer } from './helpers.js';
import { dealFaceUp } from './grubs.js';
import { bossHealthBonus } from './setup.js';

function runHooks(state: GameState, attackerId: string, targetType: 'predator' | 'grub', targetId: string): boolean {
  const hooks = state.config.hooks ?? {};
  const ctx: CombatContext = { state, attackerId, targetType, targetId };
  const results: CombatStageResult[] = [
    hooks.weatherEffect?.(ctx) ?? {},
    hooks.targetEffect?.(ctx) ?? {},
    hooks.chickenAbilities?.(ctx) ?? {},
  ];
  return results.some((r) => r.dodged);
}

// core_rules.md "Death": discard all food, eggs, Bonus Cards, Grub Cards,
// and Meal Counter token. Loot Drops are kept. The Brood-triggered
// revival flow is phase 9 — this is just the immediate consequence.
export function applyDeath(player: PlayerState): PlayerState {
  return {
    ...player,
    alive: false,
    food: 0,
    eggs: 0,
    mealCounter: 0,
    bonusCardHand: [],
    grubHand: [],
  };
}

function applyDamageAndMaybeDeath(player: PlayerState, damage: number): PlayerState {
  const damaged = { ...player, health: Math.max(0, player.health - damage) };
  return damaged.health <= 0 ? applyDeath(damaged) : damaged;
}

function resolvePredatorAttack(
  state: GameState,
  playerId: string,
  predatorName: string,
  attackStrength: number,
  dodged: boolean,
): GameState {
  const predator = state.predators.find((p) => p.name === predatorName);
  if (!predator) throw new Error(`Unknown predator: ${predatorName}`);
  const predatorData = findPredator(predatorName);
  const stageData = predatorData.stages.find((s) => s.stage === predator.stage);
  const returnAttack = dodged ? 0 : parseIntField(stageData?.returnAttack ?? null, 0);

  const newHealth = Math.max(0, predator.health - attackStrength);
  const justDefeated = newHealth <= 0 && !predator.defeated;

  let predators: PredatorState[] = state.predators.map((p) =>
    p.name === predatorName ? { ...p, health: newHealth, defeated: p.defeated || newHealth <= 0 } : p,
  );

  const player = getPlayer(state.players, playerId);
  let updatedPlayer = applyDamageAndMaybeDeath(player, returnAttack);

  if (justDefeated) {
    updatedPlayer = { ...updatedPlayer, lootDrops: [...updatedPlayer.lootDrops, predatorName] };
    // Boss stays face-down until the last regular predator dies (core_rules.md).
    const anyRegularSurviving = predators.some((p) => !p.isBoss && !p.defeated);
    if (!anyRegularSurviving) {
      predators = predators.map((p) => (p.isBoss ? { ...p, revealed: true } : p));
    }
  }

  return { ...state, predators, players: replacePlayer(state.players, updatedPlayer) };
}

function resolveGrubAttack(
  state: GameState,
  playerId: string,
  side: 'inside' | 'outside',
  attackStrength: number,
  _dodged: boolean, // Grub defend-effect rolls (phase 6) aren't implemented yet, so there's no return damage to suppress
): GameState {
  const deckSide = state.grubDecks[side];
  const faceUp = deckSide.faceUp;
  if (!faceUp) throw new Error(`No face-up Grub ${side} to attack`);

  const newHealth = Math.max(0, faceUp.currentHealth - attackStrength);
  const player = getPlayer(state.players, playerId);

  if (newHealth > 0) {
    return {
      ...state,
      grubDecks: { ...state.grubDecks, [side]: { ...deckSide, faceUp: { ...faceUp, currentHealth: newHealth } } },
    };
  }

  // Defeated: the card becomes the killer's own held card at full health —
  // a fresh personal resource, separate from the "wild" combat health it
  // just lost (see docs/rules-audit.md's confirmed Grub lifecycle note).
  const fullHealth = parseIntField(loadGrubCards()[faceUp.cardId]?.health ?? null, 0);
  const heldCard: HeldGrubCard = { cardId: faceUp.cardId, currentHealth: fullHealth, rewardUsed: false };
  const updatedPlayer = { ...player, grubHand: [...player.grubHand, heldCard] };
  const redealt = dealFaceUp({ ...deckSide, faceUp: null });

  return {
    ...state,
    players: replacePlayer(state.players, updatedPlayer),
    grubDecks: { ...state.grubDecks, [side]: redealt },
  };
}

// Entry point actions.ts's `attack` calls after deducting cost.
export function resolveCombat(
  state: GameState,
  playerId: string,
  targetType: 'predator' | 'grub',
  targetId: string,
  attackStrength: number,
): GameState {
  const dodged = runHooks(state, playerId, targetType, targetId);
  return targetType === 'predator'
    ? resolvePredatorAttack(state, playerId, targetId, attackStrength, dodged)
    : resolveGrubAttack(state, playerId, targetId as 'inside' | 'outside', attackStrength, dodged);
}

// End-of-Spring/Summer recalculation (core_rules.md): surviving predators
// advance one stage; health recalculates from the new stage's multiplier
// (+ Boss bonus if applicable) x player count, with damage sustained so
// far carried over. Defeated predators and the Boss (already stage 3, per
// createPredator in setup.ts) are no-ops.
export function levelUpPredators(predators: PredatorState[], playerCount: number, difficulty: DifficultyLevel): PredatorState[] {
  return predators.map((predator) => {
    if (predator.defeated || predator.stage >= 3) return predator;
    const nextStage = (predator.stage + 1) as Stage;
    const data = findPredator(predator.name);
    const stageData = data.stages.find((s) => s.stage === nextStage);
    if (!stageData) return predator;
    const bonus = predator.isBoss ? bossHealthBonus(difficulty) : 0;
    const newMaxHealth = (parseHealthMultiplier(stageData.healthMultiplier) + bonus) * playerCount;
    const damageTaken = predator.maxHealth - predator.health;
    return {
      ...predator,
      stage: nextStage,
      maxHealth: newMaxHealth,
      health: Math.max(0, newMaxHealth - damageTaken),
    };
  });
}
