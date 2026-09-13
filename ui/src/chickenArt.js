// Maps a chicken's engine name (the "name" field in data/chickens.json) to
// the filename slug used under ui/assets/chickens/. Mostly kebab-case of the
// name, but a couple of the actual art files don't match that mechanically
// (a typo baked into "Atilla the Hen"'s filename, and "Aracorn, Heir of
// Condor" dropping its subtitle) — so this is an explicit table rather than
// a derived transform.
const CHICKEN_ART = {
  'Shellock Holmes': { slug: 'shellock-holmes', sex: 'rooster' },
  Beowing: { slug: 'beowing', sex: 'rooster' },
  'Wyatt Chirp': { slug: 'wyatt-chirp', sex: 'rooster' },
  'Madam Chickovsky': { slug: 'madam-chickovsky', sex: 'hen' },
  'Cluckleberry Finn': { slug: 'cluckleberry-finn', sex: 'rooster' },
  'Eggatha Christie': { slug: 'eggatha-christie', sex: 'hen' },
  'Cumberbill Rockefeather': { slug: 'cumberbill-rockefeather', sex: 'rooster' },
  'Annie Yolkley': { slug: 'annie-yolkley', sex: 'hen' },
  'General Tso': { slug: 'general-tso', sex: 'rooster' },
  'Wingston Coophill': { slug: 'wingston-coophill', sex: 'rooster' },
  'Atilla the Hen': { slug: 'attilla-the-hen', sex: 'rooster' },
  'Princess Layer': { slug: 'princess-layer', sex: 'hen' },
  Chickira: { slug: 'chickira', sex: 'hen' },
  'Broods Lee': { slug: 'broods-lee', sex: 'rooster' },
  'J.R.R. Yolkien': { slug: 'jrr-yolkien', sex: 'rooster' },
  'Cluck Norris': { slug: 'cluck-norris', sex: 'rooster' },
  'Aracorn, Heir of Condor': { slug: 'aracorn', sex: 'rooster' },
};

const STAGE_WORD = {
  2: { rooster: 'cockerel', hen: 'pullet' },
  3: { rooster: 'rooster', hen: 'hen' },
};

// Returns the board asset path for this chicken at this stage, or null if
// the chicken (or that stage's image) isn't in the roster above yet.
export function chickenImagePath(chickenName, stage) {
  const art = CHICKEN_ART[chickenName];
  if (!art) return null;
  const word = stage === 1 ? 'chick' : STAGE_WORD[stage]?.[art.sex];
  if (!word) return null;
  return `assets/chickens/${art.slug}-${word}.jpg`;
}
