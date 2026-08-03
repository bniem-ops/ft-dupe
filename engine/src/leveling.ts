// Meal counter tracking and stage transitions (core_rules.md "Leveling Up").
// Meal counter does NOT reset on level up. On level up: gain new max
// health (existing damage preserved) and the new stage's attack strength;
// new abilities are granted but interpreting/using them is phase 5.
import { PlayerState, Stage } from './types.js';
import { chickenStage, parseIntField } from './data.js';

function tryLevelUp(player: PlayerState): PlayerState {
  if (player.stage >= 3) return player;
  const currentStage = chickenStage(player.chickenName, player.stage);
  const threshold = parseIntField(currentStage.mealsToNext, Infinity);
  if (player.mealCounter < threshold) return player;

  const nextStage = (player.stage + 1) as Stage;
  const nextStageData = chickenStage(player.chickenName, nextStage);
  const newMaxHealth = parseIntField(nextStageData.health, player.maxHealth);
  const damageTaken = player.maxHealth - player.health;

  const leveled: PlayerState = {
    ...player,
    stage: nextStage,
    maxHealth: newMaxHealth,
    health: Math.max(0, newMaxHealth - damageTaken),
    attackStrength: parseIntField(nextStageData.attackStrength, player.attackStrength),
  };

  return tryLevelUp(leveled); // in case meals already cover more than one threshold
}

export function addMeals(player: PlayerState, amount: number): PlayerState {
  return tryLevelUp({ ...player, mealCounter: player.mealCounter + amount });
}
