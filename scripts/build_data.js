// Converts the hand-edited *_template.txt files into JSON (for reference/
// tooling) plus data/generated.mjs — a plain ES module both engine/ (Node)
// and ui/ (browser) import directly, keeping data-loading isomorphic
// without a bundler.
//
// Usage: node scripts/build_data.js
// Run this after editing any of the template files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');

function readTemplate(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');
}

function isPlaceholder(value, placeholder) {
  if (value == null) return true;
  const v = value.trim();
  if (v === '') return true;
  if (placeholder && v === placeholder) return true;
  return false;
}

// Some fields (Health, Attack Strength, Meals, Return Attack, chick
// Production) hold short values. Templates ask people to delete the
// brackets when filling them in ("[X]" -> "3"), but people naturally keep
// typing inside the brackets instead ("[3]"). Support both: strip one
// layer of brackets, and only treat the result as unfilled if what's left
// is empty or one of the generic placeholder tokens (X, ?).
function clean(value) {
  if (value == null) return null;
  let v = value.trim();
  if (v === '') return null;
  const m = v.match(/^\[(.*)\]$/);
  if (m) v = m[1].trim();
  if (v === '' || v === 'X' || v === '?') return null;
  return v;
}

// Predator Health Multiplier is formatted "x<N>", e.g. "x4" or "x[?]"
// (or, per the same habit above, "x[4]"). Strip the x, clean the rest,
// then re-add it.
function cleanHealthMultiplier(value) {
  if (value == null) return null;
  const v = value.trim();
  const m = v.match(/^x(.*)$/i);
  const rest = clean(m ? m[1] : v);
  return rest == null ? null : 'x' + rest;
}

// ---------------------------------------------------------------------
// CHICKENS
// ---------------------------------------------------------------------
function parseChickens(text) {
  const lines = text.split('\n');
  const chickens = [];
  let current = null;
  let stage = null;

  const pushStage = () => {
    if (current && stage) current.stages.push(stage);
    stage = null;
  };
  const pushChicken = () => {
    pushStage();
    if (current) chickens.push(current);
  };

  for (const raw of lines) {
    const line = raw.trim();

    let m = line.match(/^CHICKEN:\s*(.+)$/);
    if (m) {
      pushChicken();
      let name = m[1].trim();
      let breed = null;
      const pm = name.match(/^(.+?)\s*\(([^)]*)\)/);
      if (pm) { name = pm[1].trim(); breed = pm[2].trim(); }
      const known = !/^\[.*\]$/.test(name);
      current = {
        name: known ? name : null,
        breed: clean(breed),
        expansion: 'Base',
        stages: [],
        flavorQuote: null,
      };
      continue;
    }
    if (!current) continue;

    m = line.match(/^Expansion:\s*(.+)$/);
    if (m) { current.expansion = m[1].trim(); continue; }

    m = line.match(/^Flavor quote \(optional\):\s*"(.*)"\s*$/);
    if (m) {
      const v = m[1].trim();
      current.flavorQuote = (v === '' || v === '...' || v === '[...]') ? null : v;
      continue;
    }

    m = line.match(/^STAGE (\d)\s*-\s*(.+)$/);
    if (m) {
      pushStage();
      stage = {
        stage: Number(m[1]),
        label: m[2].trim(),
        health: null,
        attackStrength: null,
        production: null,
        mealsToNext: null,
        abilities: [],
      };
      continue;
    }
    if (!stage) continue;

    m = line.match(/^Health:\s*(.+)$/);
    if (m) { stage.health = clean(m[1]); continue; }

    m = line.match(/^Attack Strength:\s*(.+)$/);
    if (m) { stage.attackStrength = clean(m[1]); continue; }

    m = line.match(/^Production:\s*(.+)$/);
    if (m) { stage.production = clean(m[1]); continue; }

    m = line.match(/^Meals to reach Stage \d:\s*(.+)$/);
    if (m) { stage.mealsToNext = clean(m[1]); continue; }

    m = line.match(/^(?:Starting Ability|New Ability):\s*(.+)$/);
    if (m) {
      const val = m[1].trim();
      if (!isPlaceholder(val, '[Ability Name] - [full text]')) {
        // Require real whitespace around the separator dash so hyphenated
        // ability names ("Warm-Hardy") don't get split in half.
        const am = val.match(/^(.+?)\s+-\s+(.+)$/);
        if (am) stage.abilities.push({ name: am[1].trim(), text: am[2].trim() });
        else stage.abilities.push({ name: null, text: val });
      }
      continue;
    }

    // Extra bulleted abilities, e.g. "Evasion - When attacking, roll [?]..."
    m = raw.match(/^\s{2,}([A-Z][\w' -]+?)\s+-\s+(.+)$/);
    if (m && !line.startsWith('(')) {
      stage.abilities.push({ name: m[1].trim(), text: m[2].trim() });
      continue;
    }
  }
  pushChicken();
  return chickens;
}

// ---------------------------------------------------------------------
// PREDATORS
// ---------------------------------------------------------------------
function parsePredators(text) {
  const lines = text.split('\n');
  const predators = [];
  let current = null;
  let stage = null;

  const pushStage = () => {
    if (current && stage) current.stages.push(stage);
    stage = null;
  };
  const pushPredator = () => {
    pushStage();
    if (current) predators.push(current);
  };

  for (const raw of lines) {
    const line = raw.trim();

    let m = line.match(/^PREDATOR:\s*(.+)$/);
    if (m) {
      pushPredator();
      let name = m[1].trim();
      let meta = null;
      let trailing = null;
      const pm = name.match(/^(.+?)\s*\(([^)]*)\)\s*(.*)$/);
      if (pm) { name = pm[1].trim(); meta = pm[2].trim(); trailing = pm[3].trim() || null; }
      const known = !/^\[.*\]$/.test(name);
      let species = null;
      if (meta) species = /^species:/i.test(meta) ? clean(meta.replace(/^species:\s*/i, '')) : clean(meta);
      current = {
        name: known ? name : null,
        species,
        note: trailing,
        expansion: 'Base',
        stages: [],
        lootDrop: null,
      };
      continue;
    }
    if (!current) continue;

    m = line.match(/^Expansion:\s*(.+)$/);
    if (m) { current.expansion = m[1].trim(); continue; }

    m = line.match(/^STAGE (\d)(?:\s*\(.*\))?\s*$/);
    if (m) {
      pushStage();
      stage = { stage: Number(m[1]), healthMultiplier: null, effect: null, returnAttack: null };
      continue;
    }
    if (!stage) continue;

    m = line.match(/^Health Multiplier:\s*(.+)$/);
    if (m) { stage.healthMultiplier = cleanHealthMultiplier(m[1]); continue; }

    m = line.match(/^Predator Effect:\s*(.+)$/);
    if (m) {
      const v = m[1].trim();
      stage.effect = /^\[full text/.test(v) ? null : v;
      continue;
    }

    m = line.match(/^Return Attack \(claws\):\s*(.+)$/);
    if (m) { stage.returnAttack = clean(m[1]); continue; }

    m = line.match(/^LOOT DROP:\s*(.+)$/);
    if (m) {
      const v = m[1].trim();
      current.lootDrop = /^\[Name\]/.test(v) ? null : v;
      continue;
    }
  }
  pushPredator();
  return predators;
}

// ---------------------------------------------------------------------
// WEATHER
// ---------------------------------------------------------------------
function parseWeatherLine(line) {
  // Require real whitespace around the name/effect separator dash so a
  // hyphenated card name (e.g. "Cold-Snap") doesn't get split in half.
  const m = line.match(/^\d+\.\s*(.+?)\s+-\s+(.+?)\s*\(Phase length:\s*(.+?)\s*days?\)\s*$/);
  if (!m) return null;
  const [, name, effect, phase] = m;
  return {
    name: /^\[Name\]$/.test(name.trim()) ? null : name.trim(),
    effect: /^\[full effect text\]$/.test(effect.trim()) ? null : effect.trim(),
    phaseLength: /^\[2 or 3\]$/.test(phase.trim()) ? null : phase.trim(),
  };
}

function parseWeather(text) {
  const lines = text.split('\n');
  const seasons = { spring: [], summer: [], fall: [] };
  const eggspansion = [];
  const unsorted = [];
  let section = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (/SPRING WEATHER DECK/.test(line)) { section = 'spring'; continue; }
    if (/SUMMER WEATHER DECK/.test(line)) { section = 'summer'; continue; }
    if (/FALL WEATHER DECK/.test(line)) { section = 'fall'; continue; }
    if (/EGGSPANSION WEATHER CARDS/.test(line)) { section = 'eggspansion'; continue; }
    if (/UNSORTED KNOWN CARDS/.test(line)) { section = 'unsorted'; continue; }

    if (section === 'eggspansion') {
      const m = line.match(/^\d+\.\s*(.+?)\s+-\s+Season:\s*(.+?)\s+-\s+(.+?)\s*\(Phase length:\s*(.+?)\s*days?\)\s*$/);
      if (m) {
        eggspansion.push({
          name: /^\[Name\]$/.test(m[1].trim()) ? null : m[1].trim(),
          season: /^\[.*\]$/.test(m[2].trim()) ? null : m[2].trim(),
          effect: /^\[full effect text\]$/.test(m[3].trim()) ? null : m[3].trim(),
          phaseLength: /^\[2 or 3\]$/.test(m[4].trim()) ? null : m[4].trim(),
        });
      }
      continue;
    }

    if (section === 'unsorted') {
      const m = line.match(/^-\s*(.+?)\s+-\s+(.+?)\s*(?:\((.*)\))?$/);
      if (m) {
        unsorted.push({
          name: m[1].trim(),
          effect: /effect unknown/.test(m[2]) ? null : m[2].replace(/^"|"$/g, '').trim(),
          note: m[3] ? m[3].trim() : null,
        });
      }
      continue;
    }

    if (seasons[section]) {
      const card = parseWeatherLine(line);
      if (card) seasons[section].push(card);
    }
  }

  return { seasons, eggspansion, unsorted };
}

// ---------------------------------------------------------------------
// BONUS CARDS
// ---------------------------------------------------------------------
function parseBonusCards(text) {
  const lines = text.split('\n');
  const cards = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^\d+\.\s*Shorthand:\s*(.+?)\s+-\s+Description:\s*(.+)$/);
    if (!m) continue;
    const [, shorthand, description] = m;
    cards.push({
      shorthand: clean(shorthand),
      description: clean(description),
    });
  }
  return cards;
}

// ---------------------------------------------------------------------
// GRUB CARDS
// ---------------------------------------------------------------------
function parseGrubCards(text) {
  const lines = text.split('\n');
  const cards = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^\d+\.\s*(.+?)\s+-\s+Health:\s*(.+?)\s+-\s+Effect:\s*(.+?)\s+-\s+Reward:\s*(.+)$/);
    if (!m) continue;
    const [, name, health, effect, reward] = m;
    cards.push({
      name: /^\[Name\]$/.test(name.trim()) ? null : name.trim(),
      health: clean(health),
      effect: /^none$/i.test(effect.trim()) ? null : (/^\[\?\]$/.test(effect.trim()) ? null : effect.trim()),
      reward: /^\[full reward text\]$/.test(reward.trim()) ? null : reward.trim(),
    });
  }
  return cards;
}

// ---------------------------------------------------------------------
function main() {
  const chickens = parseChickens(readTemplate('chickens_template.txt'));
  const predators = parsePredators(readTemplate('predators_template.txt'));
  const weather = parseWeather(readTemplate('weather_template.txt'));
  const bonusCards = parseBonusCards(readTemplate('bonus_cards_template.txt'));
  const grubCards = parseGrubCards(readTemplate('grub_cards_template.txt'));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'chickens.json'), JSON.stringify(chickens, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'predators.json'), JSON.stringify(predators, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'weather.json'), JSON.stringify(weather, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'bonusCards.json'), JSON.stringify(bonusCards, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'grubCards.json'), JSON.stringify(grubCards, null, 2));

  // Plain ES module, not JSON-with-import-attributes: works identically in
  // Node (engine/tests) and every browser (ui/) with zero bundler and zero
  // import-attribute compatibility risk. This is what makes engine/src/
  // data.ts isomorphic (see phase 5's plan).
  const esm = [
    '// AUTO-GENERATED by scripts/build_data.js — do not edit by hand.',
    `export const chickens = ${JSON.stringify(chickens, null, 2)};`,
    `export const predators = ${JSON.stringify(predators, null, 2)};`,
    `export const weather = ${JSON.stringify(weather, null, 2)};`,
    `export const bonusCards = ${JSON.stringify(bonusCards, null, 2)};`,
    `export const grubCards = ${JSON.stringify(grubCards, null, 2)};`,
    '',
  ].join('\n\n');
  fs.writeFileSync(path.join(OUT_DIR, 'generated.mjs'), esm);

  const chickenDone = chickens.filter(c => c.stages.every(s => s.health && s.attackStrength && s.production)).length;
  const predatorDone = predators.filter(p => p.stages.every(s => s.healthMultiplier && s.effect)).length;
  const weatherDone = Object.values(weather.seasons).flat().filter(c => c.name && c.effect).length;
  const bonusDone = bonusCards.filter(c => c.shorthand && c.description).length;
  const grubDone = grubCards.filter(c => c.name && c.health && c.reward).length;

  console.log(`Chickens: ${chickens.length} parsed, ${chickenDone} fully statted`);
  console.log(`Predators: ${predators.length} parsed, ${predatorDone} fully statted`);
  console.log(`Weather: ${weatherDone} / 18 season cards filled`);
  console.log(`Bonus Cards: ${bonusCards.length} parsed, ${bonusDone} fully filled`);
  console.log(`Grub Cards: ${grubCards.length} parsed, ${grubDone} fully filled`);
  console.log('Wrote data/chickens.json, data/predators.json, data/weather.json, data/bonusCards.json, data/grubCards.json, data/generated.mjs');
}

main();
