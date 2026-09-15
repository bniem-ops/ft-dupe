import { html } from 'htm/preact';

// A condensed, player-facing pass over core_rules.md — not the full
// rulebook (that lives in the physical Chicken/Predator Books plus the
// rulebook PDF), just enough to sit down and play. Reuses the shared
// .dossier-* chrome (same pattern as targetDossier.js) so it costs no new
// modal plumbing, with its own `kind-howto` cream palette since this is a
// reference read, not a combat/outcome screen (same reasoning as the
// day-end dossier's `kind-dayend`).
export function HowToPlay({ onClose }) {
  return html`
    <div class="dossier-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="dossier-panel kind-howto">
        <div class="dossier-header">
          <span class="dossier-eyebrow">HOW TO PLAY</span>
          <span class="dossier-title">Flock Together</span>
          <span class="dossier-subtitle">A quick reference, not the full rulebook</span>
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-close" onClick=${onClose}>✕</button>
        </div>

        <div class="dossier-stack-body howto-body">
          <div class="dossier-section">
            <span class="dossier-section-title">OBJECTIVE</span>
            <div class="dossier-flavor-text">
              It's a co-op game — everyone wins or loses together. Before the 3rd season (Fall) ends, defeat all
              four Predators <b>while every player is still alive</b>. You lose if the whole flock dies, if Fall
              ends with a Predator still standing, or if anyone is dead the moment the last Predator falls.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">YOUR TURN</span>
            <div class="dossier-flavor-text">
              At the start of your turn you get <b>Production</b>: Chicks get 1 free food; leveled-up chickens roll
              for a chance at an egg instead. Then take <b>2 actions</b> (you can repeat the same one, and some
              cards/weather/the once-per-season Extra Action Token give you more). Bonus Cards and Grub Cards don't
              cost an action and can be played any time — including on someone else's turn.
            </div>
            <table class="howto-table">
              <tbody>
                <tr><td>Lay Egg</td><td>Inside only</td><td>Not available to Chicks</td></tr>
                <tr><td>Heal</td><td>Inside only</td><td>Chick: 1 food per heart. Pullet/Cockerel: up to 2. Hen/Rooster: up to 3.</td></tr>
                <tr><td>Brood</td><td>Inside only</td><td>Revive a dead player — pay 1 egg, skip your next turn</td></tr>
                <tr><td>Move</td><td>Anywhere</td><td>Coop ↔ Outside, or between Outside locations</td></tr>
                <tr><td>Draw Card</td><td>Anywhere</td><td>Draw 1 Bonus Card (hand limit 2)</td></tr>
                <tr><td>Attack</td><td>Anywhere</td><td>Must be near the target. Costs 1 food per point of attack strength.</td></tr>
                <tr><td>Eat</td><td>Outside only</td><td>Levels up your chicken. Chick: 1 food per meal-track space. Pullet/Cockerel: up to 2.</td></tr>
                <tr><td>Forage</td><td>Outside only</td><td>Collect 1 food</td></tr>
              </tbody>
            </table>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">THE CALENDAR</span>
            <div class="dossier-flavor-text">
              3 seasons (Spring, Summer, Fall), 7 days each. At the end of every day, the table discards one
              face-up Grub Card (Inside or Outside — the last player's choice). Before days 1, 3, and 6 of each
              season, everyone also gets an <b>Egg Exchange</b> (trade any number of eggs for equal food) before a
              new <b>Weather Card</b> is drawn. At the end of Spring and Summer, every surviving Predator levels
              up.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">COMBAT</span>
            <div class="dossier-flavor-text">
              Attacking costs 1 food per point of attack strength you choose, and you take the Predator's return
              attack regardless of whether your hit is the killing blow. Effects resolve in order: Weather, then
              the Predator, then your own chicken's abilities. A miss from Weather/Predator effects still costs
              the food — and dodging a return attack dodges its effect too.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">LEVELING UP</span>
            <div class="dossier-flavor-text">
              Chick → Pullet (or Cockerel) → Hen (or Rooster). Eating fills your Meal Counter; hitting the
              threshold flips your Chicken Book to the next stage — new abilities on top of your old ones, a new
              meal threshold, and often more health, attack, or production. The Meal Counter does not reset when
              you level up.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">GRUBS & PREDATORS</span>
            <div class="dossier-flavor-text">
              Grubs aren't required to win, but they help — no hand limit, single-use, playable any time for no
              action cost. A Predator's max health is set by a multiplier on its card times your player count;
              whoever lands the killing blow keeps its Loot Drop. Three Predators are revealed at setup; the 4th
              (the Boss) stays face down until the last regular one falls.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">DEATH & REVIVAL</span>
            <div class="dossier-flavor-text">
              Hitting 0 health means you die and discard your food, eggs, Bonus Cards, Grub Cards, and Meal
              Counter (Loot Drops are kept). Another player can revive you by using Brood — 1 egg, and they skip
              their next turn. You come back as a fresh Chick with 2 new Chicken Books to choose from. If the game
              ends before a revived player has taken a turn, the whole flock loses, even if every Predator is
              already dead.
            </div>
          </div>

          <div class="dossier-divider"></div>

          <div class="dossier-section">
            <span class="dossier-section-title">A FEW MORE RULES</span>
            <div class="dossier-flavor-text">
              No trading food or eggs between teammates unless a card says otherwise. You can't play a Bonus or
              Grub Card on a teammate unless it specifically says "teammate" or "any" (in Solo mode, you count as
              your own teammate).
            </div>
          </div>
        </div>

        <div class="dossier-footer">
          <div class="dossier-spacer"></div>
          <button type="button" class="dossier-btn-confirm" onClick=${onClose}>Got it</button>
        </div>
      </div>
    </div>
  `;
}
