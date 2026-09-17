// Maps a Grub Card's name (data/grubCards.json's "name" field) to the
// filename under ui/assets/grubs/. Unlike chickenArt.js/predatorArt.js,
// every one of the 24 names' plain kebab-case already matches its art
// file exactly (checked against the actual filenames), so this is a
// derived slug rather than an explicit per-name table — one card, one
// image, no per-stage variants (Grubs don't have stages).
export function grubImagePath(cardName) {
  if (!cardName) return null;
  const slug = cardName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  return `assets/grubs/${slug}.jpg`;
}
