// Maps a predator's engine name (data/predators.json's "name" field) to the
// filename slug(s) used under ui/assets/predators/. Most predators use one
// slug for all 3 seasons, but a few art files have inconsistent spelling
// across stages (typos baked into individual filenames) — those get a
// per-stage override instead of a single derived slug.
const PREDATOR_ART = {
  Eggsmeralda: { slugByStage: { 1: 'eggsmeralda', 2: 'eggsmerelda', 3: 'eggsmeralda' } },
  'Sal Moe Nella': { slug: 'sal-moe-nella' },
  'Professor Moltiarty': { slugByStage: { 1: 'professor-moltiarty', 2: 'professor-motiarty', 3: 'professor-moltiarty' } },
  'Gravekeeper Fowl': { slugByStage: { 1: 'gravekeeper-fowl', 2: 'gravekeeper-fowl', 3: 'gravekeper-fowl' } },
  'Owl Coopone': { slug: 'owl-coopone' },
  'Hens Gruber': { slug: 'hens-gruber' },
  'Shere Corn': { slug: 'shere-corn' },
  Chicksune: { slug: 'chicksune' },
  Cleopoultra: { slug: 'cleopultra' },
  'Ursula Bone': { slug: 'ursula-bone' },
  'Chew Bawka': { slug: 'chew-baka' },
  'Weasma and Clawnk': { slug: 'weasma-and-clawnk' },
  "Hendel's Mother": { slug: 'hendels-mother' },
  Coopella: { slug: 'coopella' },
  Layonardo: { slug: 'layonardo' },
  'Sheriff of Rottingham': { slug: 'sheriff-of-rottingham' },
};

const SEASON_WORD = { 1: 'spring', 2: 'summer', 3: 'fall' };

// Returns the board asset path for this predator at this stage, or null if
// the predator isn't in the roster above.
export function predatorImagePath(predatorName, stage) {
  const art = PREDATOR_ART[predatorName];
  if (!art) return null;
  const season = SEASON_WORD[stage];
  if (!season) return null;
  const slug = art.slugByStage ? art.slugByStage[stage] : art.slug;
  if (!slug) return null;
  return `assets/predators/${slug}-${season}.jpg`;
}
