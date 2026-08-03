// Typed accessors over the build-generated data/generated.mjs (see
// scripts/build_data.js). A plain ES module import rather than an fs read
// or a JSON import — this keeps data-loading isomorphic (identical in
// Node for the engine/tests and in the browser for ui/), with no bundler
// and no JSON-import-attribute compatibility risk.
// Resolved via the "#data/*" subpath import mapped in package.json rather
// than a literal relative path: tsc emits relative specifiers unchanged,
// but rootDir "engine" + outDir "engine/dist" means the compiled file
// (engine/dist/src/data.js) sits one directory deeper than the source
// (engine/src/data.ts) relative to repo root, so a literal ../../ that's
// correct for one is wrong for the other. The "#data/*" specifier instead
// resolves via Node's package.json "imports" field at runtime (works from
// any depth) and via the matching <script type="importmap"> entry in
// ui/index.html when this same compiled file is loaded in a browser.
import {
  chickens as rawChickens,
  predators as rawPredators,
  weather as rawWeather,
  grubCards as rawGrubCards,
  bonusCards as rawBonusCards,
} from '#data/generated.mjs';

export interface ChickenAbility {
  name: string | null;
  text: string | null;
}

export interface ChickenStage {
  stage: 1 | 2 | 3;
  label: string;
  health: string | null;
  attackStrength: string | null;
  production: string | null;
  mealsToNext: string | null;
  abilities: ChickenAbility[];
}

export interface Chicken {
  name: string | null;
  breed: string | null;
  expansion: string;
  stages: ChickenStage[];
  flavorQuote: string | null;
}

export interface PredatorStage {
  stage: 1 | 2 | 3;
  healthMultiplier: string | null; // e.g. "x2"
  effect: string | null;
  returnAttack: string | null;
}

export interface Predator {
  name: string | null;
  species: string | null;
  note: string | null;
  expansion: string;
  stages: PredatorStage[];
  lootDrop: string | null;
}

export interface WeatherCard {
  name: string | null;
  effect: string | null;
  phaseLength: string | null;
}

export interface EggspansionWeatherCard extends WeatherCard {
  season: string | null;
}

export interface WeatherData {
  seasons: {
    spring: WeatherCard[];
    summer: WeatherCard[];
    fall: WeatherCard[];
  };
  eggspansion: EggspansionWeatherCard[];
  unsorted: unknown[];
}

export interface GrubCard {
  name: string | null;
  health: string | null;
  effect: string | null; // defend/retaliation roll text, or null ("none")
  reward: string | null;
}

export interface BonusCard {
  shorthand: string | null;
  description: string | null;
}

export function loadChickens(): Chicken[] {
  return rawChickens as Chicken[];
}

export function loadPredators(): Predator[] {
  return rawPredators as Predator[];
}

export function loadWeather(): WeatherData {
  return rawWeather as WeatherData;
}

export function loadGrubCards(): GrubCard[] {
  return rawGrubCards as GrubCard[];
}

export function loadBonusCards(): BonusCard[] {
  return rawBonusCards as BonusCard[];
}

// Combined per-season card list: the 6 base cards plus (if eggspansion is
// on) the one Eggspansion card shuffled into that season, per
// data/weather.json's `eggspansion[].season` field.
export function seasonCardList(season: 'spring' | 'summer' | 'fall', eggspansion: boolean): WeatherCard[] {
  const data = loadWeather();
  const base = [...data.seasons[season]];
  if (eggspansion) {
    const extra = data.eggspansion.find((c) => c.season?.toLowerCase() === season);
    if (extra) base.push(extra);
  }
  return base;
}

export function findChicken(name: string): Chicken {
  const chicken = loadChickens().find((c) => c.name === name);
  if (!chicken) throw new Error(`Unknown chicken: ${name}`);
  return chicken;
}

export function findPredator(name: string): Predator {
  const predator = loadPredators().find((p) => p.name === name);
  if (!predator) throw new Error(`Unknown predator: ${name}`);
  return predator;
}

export function chickenStage(chickenName: string, stage: 1 | 2 | 3): ChickenStage {
  const found = findChicken(chickenName).stages.find((s) => s.stage === stage);
  if (!found) throw new Error(`${chickenName} has no stage ${stage}`);
  return found;
}

export function parseIntField(value: string | null, fallback = 0): number {
  if (value == null) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function parseHealthMultiplier(value: string | null): number {
  if (value == null) return 0;
  const match = value.match(/x(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}
