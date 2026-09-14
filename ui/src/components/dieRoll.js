import { html } from 'htm/preact';

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// A "die dropped onto the table" flourish for the most recent roll
// (production, or an Attack's target-effect/Fog roll — see
// engine/src/types.ts's ProductionRollLogEntry/CombatRollLogEntry) — pure
// presentation over rolls the engine already logs, doesn't affect
// gameplay. app.js re-keys this by actionLog position on every new roll so
// the CSS animation (see .die-roll-overlay in styles.css) restarts fresh
// instead of just updating the number in place.
export function DieRoll({ roll, label }) {
  if (!roll) return null;
  return html`
    <div class="die-roll-overlay">
      <div class="die-roll-face">${DIE_FACES[roll] ?? roll}</div>
      <div class="die-roll-label">${label}</div>
    </div>
  `;
}
