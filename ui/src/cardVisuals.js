// Shared "card anatomy" visual language (design mockup turn 3): every card
// kind renders as the same frame — a colour band for its kind, a monogram
// plate standing in for art, and rules text. Grubs/bonus/weather never get
// real art; predators/chickens are the only kinds expected to eventually.
// Used by both board.js (board-anchored decks/predators/weather) and
// playerPanel.js (hand entries), so the same card reads the same way
// whether it's on the table or in your hand.

export function monogram(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0].slice(0, 2).toUpperCase();
}

// Spring/Summer/Fall — matches SEASON_ORDER in app.js. No Winter season in
// this game's calendar.
export const SEASON_COLORS = {
  Spring: 'var(--gs-field)',
  Summer: 'var(--gs-ochre)',
  Fall: 'var(--gs-dusk)',
};
