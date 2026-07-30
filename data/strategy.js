// HAND-AUTHORED analysis — unlike app-data.js (mechanically parsed from the
// txt templates), this file is a strategic reading of the chicken/predator
// text and is edited directly. Re-review it if chicken/predator text changes
// meaningfully (ability rewordings, Eggspansion additions, etc.).
//
// Ruling used throughout: an ability only affects the chicken who has it
// UNLESS its text explicitly says "nearby," "teammate," or "any player"
// (per the rulebook's own clarification that Bonus/Grub cards can't be
// played on teammates unless the card says so — the same logic is applied
// here to character abilities).

window.FLOCK_STRATEGY = {
  legend:
    "An ability only affects its own chicken unless the text explicitly says " +
    "“nearby,” “teammate,” or “any player.” That distinction drives most of the " +
    "combo picks below.",

  archetypes: [
    { name: "Shellock Holmes", roles: ["Utility", "Grub Control"],
      summary: "Grub specialist — strikes either Grub from anywhere and turns Grub Cards into a damage buffer. Prime tech pick when Sheriff of Rottingham or a Grub-heavy game is expected." },
    { name: "Beowing", roles: ["Support", "Control"],
      summary: "The team's universal buff/debuff engine — boosts every nearby teammate's dice on ANY roll (not just attacks) while weakening the Predator's. Arguably the strongest support pick in the roster." },
    { name: "Wyatt Chirp", roles: ["Tank", "Economy"],
      summary: "Self-sufficient attrition fighter: Payback backfills missed production, Thick Feathers shaves damage off every return attack he personally takes." },
    { name: "Madam Chickovsky", roles: ["Support", "Weather"],
      summary: "Team healer via food-sharing (Ladies' Aid), plus full Outside-action flexibility at Stage 3. Weather-immune to Freezing/Hail." },
    { name: "Cluckleberry Finn", roles: ["Support", "Economy"],
      summary: "Bring-a-friend combat support — Quite Friendly doubles a location's attack output for one extra chicken's food cost. Superior Product turns her eggs into premium currency." },
    { name: "Eggatha Christie", roles: ["Economy"],
      summary: "Foraging specialist — The Forager doubles food yield on a good roll. Strong pure economy engine, weather-immune to Drought/Extreme Heat." },
    { name: "Cumberbill Rockefeather", roles: ["Utility", "Weather"],
      summary: "The weather-immunity specialist — by Stage 3 (Dandy) shrugs off ALL negative weather, removing an entire threat axis for whoever's near him." },
    { name: "Annie Yolkley", roles: ["Economy", "Support"],
      summary: "Egg-production engine — High Producer doubles her production rolls — that also seeds eggs for teammates via Bacaw! whenever she's hit." },
    { name: "General Tso", roles: ["Control", "Economy"],
      summary: "Converts banked eggs into guaranteed die results (Stratagem) — a reliability engine for any roll-dependent play, backed by strong raw combat stats." },
    { name: "Wingston Coophill", roles: ["Evasion", "Damage"],
      summary: "Fragile — lowest health and attack in the roster — but built entirely around not getting hit: discard cards to halve damage, dodge return attacks outright. Needs protection but punches above its stat line when played carefully." },
    { name: "Atilla the Hen", roles: ["Tank"],
      summary: "The premier tank — highest health and attack in the game — intercepts damage meant for teammates and gets paid 2 eggs every time he does." },
    { name: "Princess Layer", roles: ["Economy", "Control"],
      summary: "Egg-economy powerhouse — doubles Lay Egg yield, funds Extra Action refreshes, and can spend eggs to shrug off damage. Fully self-sufficient engine; great solo pick." },
    { name: "Chickira", roles: ["Utility", "Weather"],
      summary: "The only chicken who can force a Weather re-draw — huge value against a bad deck draw for the whole team — plus self-heals off a missed production roll." },
    { name: "Broods Lee", roles: ["Damage", "Support"],
      summary: "Gets stronger the more hurt he (and nearby teammates) are — scales beautifully with a team willing to stay in a fight rather than retreat to heal." },
    { name: "J.R.R. Yolkien", roles: ["Control", "Utility"],
      summary: "Bigger Bonus Card hand, immune to Grub damage, and can burn an egg to force a re-roll — resilient utility, especially for a repeated-action playstyle." },
    { name: "Cluck Norris", roles: ["Damage", "Economy"],
      summary: "Aggressive risk-taker who converts misses and self-inflicted damage directly into cards and eggs — best paired with a healer to offset the chip damage." },
    { name: "Aracorn, Heir of Condor", roles: ["Utility", "Mobility"],
      summary: "Team mobility specialist — free movement, can relocate a teammate for an egg, and grants Bird Flu immunity to everyone sharing his location." },
  ],

  predatorGuide: [
    { predator: "Eggsmeralda", species: "Snake",
      threat: "Steals eggs from the attacker or the whole team on a bad roll — bleeds your economy over a fight.",
      counters: [
        { chicken: "Annie Yolkley or Princess Layer", why: "out-produce the drain with doubled egg income" },
        { chicken: "General Tso or Cluck Norris", why: "spend eggs down before engaging so there's nothing to lose" },
      ],
      caution: "Avoid parking a heavy egg-banker (Princess Layer mid-stockpile) into repeated fights without spending down first." },
    { predator: "Sal Moe Nella", species: "Rat",
      threat: "Locks you out of Eat and/or Heal until the next Egg Exchange — stalls leveling and recovery.",
      counters: [
        { chicken: "Beowing or Chickira", why: "heal from triggers other than the Heal action (Berserker, Shake it Off)" },
        { chicken: "Princess Layer", why: "Eggpire Strikes Back mitigates damage before it needs healing at all" },
      ],
      caution: "Bad matchup for a team leaning hard on the Heal action to stay topped off." },
    { predator: "Professor Moltiarty", species: "Skunk",
      threat: "Locks the attacker out of Production or the Egg Exchange — a slow economic strangle.",
      counters: [
        { chicken: "General Tso, Cluck Norris, or Aracorn", why: "chickens who spend eggs directly instead of banking for the Exchange barely notice the lockout" },
      ],
      caution: "Punishes food-hoarding strategies that rely on one big Exchange payday." },
    { predator: "Gravekeeper Fowl", species: "Opossum", note: "default first-game Boss",
      threat: "Can't be struck the day you arrive, and has a real chance to shrug off the killing blow and come back with health.",
      counters: [
        { chicken: "Atilla the Hen or General Tso", why: "high raw attack pushes damage past the revival buffer in fewer swings" },
      ],
      caution: "Don't rush him turn one — plan for a 2-visit kill." },
    { predator: "Owl Coopone", species: "Owl",
      threat: "Buffs itself hard during specific weather AND shuts down Bonus/Grub-card dodges.",
      counters: [
        { chicken: "Beowing", why: "immune to Nighttime — directly denies the Stage 1 buff condition" },
        { chicken: "Wingston Coophill", why: "Evasion/Misdirection are innate abilities, not cards — untouched by the card lockout" },
      ],
      caution: "Card-dependent kits (General Tso's Foresight, big Bonus Card hands) lose their edge here." },
    { predator: "Hens Gruber", species: "Raccoon",
      threat: "Straightforward, escalating food theft.",
      counters: [
        { chicken: "Eggatha Christie", why: "The Forager's double-food output outpaces the drain" },
      ],
      caution: "Low-food-reserve chickens get squeezed fast at Stage 3 (up to −3 food)." },
    { predator: "Shere Corn", species: "Coyote",
      threat: "Splash damage hits everyone nearby, not just the attacker — punishes clustering.",
      counters: [
        { chicken: "Wyatt Chirp", why: "Thick Feathers shaves the splash damage he personally takes" },
      ],
      caution: "Don't group-attack this one with your whole squishy squad standing together — spread out or send the tank alone." },
    { predator: "Chicksune", species: "Fox",
      threat: "Immune to Bonus Card effects at Stage 1 — completely shuts down card-reliant kits.",
      counters: [
        { chicken: "Atilla the Hen, Wingston Coophill, or Broods Lee", why: "abilities that don't depend on Bonus Cards keep working at full strength" },
      ],
      caution: "Your card-engine chickens (General Tso, J.R.R. Yolkien, Cluck Norris) are dead weight against this one specifically." },
    { predator: "Cleopoultra", species: "Hawk",
      threat: "High dodge chance wastes your attack's food cost while you still eat the (reduced) return hit.",
      counters: [
        { chicken: "Atilla the Hen or General Tso", why: "high attack strength affords the wasted attempts" },
      ],
      caution: "Cheap, low-attack pokes just bleed food for nothing here — commit properly or don't engage." },
    { predator: "Ursula Bone", species: "Bear",
      threat: "Escalating bonus return damage the more you attack her.",
      counters: [
        { chicken: "Wyatt Chirp", why: "Thick Feathers directly eats into the escalating return bonus" },
        { chicken: "Wingston Coophill", why: "Evasion dodges the return attack (and the bonus) outright" },
      ],
      caution: "A prolonged slugging match gets worse for you every round — burst her down instead." },
    { predator: "Chew Bawka", species: "Bobcat",
      threat: "Return attack scales with how many chickens are nearby/in the Coop — worse the bigger your group.",
      counters: [
        { chicken: "Atilla the Hen", why: "highest health in the game absorbs the crowd-scaling penalty best" },
      ],
      caution: "In higher player counts, dogpiling this one is actively worse — send fewer attackers." },
    { predator: "Weasma and Clawnk", species: "Weasels",
      threat: "Can dodge combat before it resolves by forcing you (or a teammate) to move — no damage either way, just wasted tempo.",
      counters: [
        { chicken: "Princess Layer", why: "egg-funded Extra Action Token refresh guarantees a same-turn second attempt" },
      ],
      caution: "Frustrating but low-stakes — don't overcommit resources chasing a fight it keeps escaping." },
    { predator: "Hendel's Mother", species: "Badger",
      threat: "Punishes attacking without a Bonus Card in hand, then strips your cards after combat.",
      counters: [
        { chicken: "J.R.R. Yolkien", why: "3-card hand size buffers the post-combat card drain" },
      ],
      caution: "Draw a card before you swing — attacking empty-handed costs extra return damage." },
    { predator: "Coopella", species: "Cougar",
      threat: "Can burn your Extra Action Token or force an unwanted Weather re-draw.",
      counters: [
        { chicken: "Chickira", why: "already has her own controlled weather re-draw, so a forced one is less scary" },
      ],
      caution: "Bad luck here can undo a favorable Weather card your team was counting on." },
    { predator: "Layonardo", species: "Snapping Turtle",
      threat: "Very high health but very low return attack — a long grind, and pins you in place until the next Egg Exchange.",
      counters: [
        { chicken: "Atilla the Hen or General Tso", why: "high attack plus low risk from the weak return attack means efficient repeated swings" },
      ],
      caution: "Being pinned can strand you away from a favorable Egg Exchange timing — watch the season clock before engaging." },
    { predator: "Sheriff of Rottingham", species: "Boar",
      threat: "Return damage scales off whichever Grub deck's max health is highest — can spike unpredictably.",
      counters: [
        { chicken: "Shellock Holmes", why: "Informant Network lets him clear high-health Grubs from both decks ahead of time as prep" },
      ],
      caution: "Check both Grub decks before engaging — a stacked deck makes this fight far more dangerous than it looks." },
  ],

  combos: [
    { title: "Tank & Payout", chickens: ["Atilla the Hen", "any fragile teammate (e.g. Wingston Coophill)"],
      synergy: "Atilla's Tank redirects damage away from the fragile pick, and Just Reward pays him 2 eggs every time he does — turns protecting your squishiest member into a steady income stream." },
    { title: "Hurt Locker", chickens: ["Atilla the Hen", "Broods Lee"],
      synergy: "Both want to stay wounded rather than topped off: Atilla profits eggs from tanking, Broods Lee's own Adrenaline gets him +1 strength while hurt, and his Bolsterer extends that +1 to Atilla (or any injured teammate) nearby. The team hits harder the longer a fight drags on." },
    { title: "Universal Buff", chickens: ["Beowing", "anyone"],
      synergy: "Battle Cry boosts every nearby teammate's dice on ANY roll — not just attacks — while weakening the Predator's. That quietly improves everyone's production rolls too. Close to a strict upgrade for whichever team he's on." },
    { title: "Egg Bank & Guaranteed Rolls", chickens: ["Princess Layer", "General Tso or J.R.R. Yolkien"],
      synergy: "Layer's Well-Laid Plans and Nobility overproduce eggs; Tso's Stratagem (or Yolkien's paid re-roll) spends them to fix bad die results on demand — a reliability engine built on Layer's surplus." },
    { title: "Card Lockdown Insurance", chickens: ["Wingston Coophill, Atilla the Hen, or Broods Lee", "vs. Chicksune"],
      synergy: "None of their kits touch Bonus Cards, so Chicksune's Stage 1 card-immunity effect doesn't cost them anything — lead with these against her." },
    { title: "Grub Prep", chickens: ["Shellock Holmes", "solo tech pick"],
      synergy: "Clear high-health Grubs from both decks ahead of a Sheriff of Rottingham fight to defang his scaling return attack before it spikes." },
  ],

  teamComps: [
    { players: 1, philosophy: "Solo mode counts you as your own teammate for card-targeting, but abilities that need an actual second player physically present — Tank, Battle Cry, Ladies' Aid, and similar — go dead. Pick a fully self-sufficient kit instead.",
      picks: ["Princess Layer", "or Cumberbill Rockefeather"] },
    { players: 2, philosophy: "One tank/support anchor plus one economy/control engine covers most fights.",
      picks: ["Atilla the Hen", "Beowing"] },
    { players: 3, philosophy: "Matches the rulebook's own first-game roster pool. Tank, support, and an economy/control piece forms a balanced core.",
      picks: ["Atilla the Hen", "Beowing", "Princess Layer or General Tso"] },
    { players: 4, philosophy: "Add a utility/prep piece to round out the core three roles.",
      picks: ["Atilla the Hen", "Beowing", "Princess Layer or General Tso", "Shellock Holmes or Aracorn"] },
    { players: 5, philosophy: "Round out with a protected glass-cannon striker, kept behind the tank.",
      picks: ["Atilla the Hen", "Beowing", "Princess Layer or General Tso", "Shellock Holmes or Aracorn", "Wingston Coophill or Cluck Norris"] },
  ],

  funSquad: {
    title: "Glass Cannon Gambit",
    picks: ["Cluck Norris", "Broods Lee", "Wingston Coophill", "Chickira (optional 4th)"],
    philosophy: "No dedicated tank — everyone leans into taking damage for resources or buffs: Cluck Norris trades self-damage for eggs, Broods Lee gets stronger while hurt, Wingston gambles on evasion instead of raw stats. Higher skill ceiling and higher variance than the balanced comps above, but a blast if your group likes risk.",
  },
};
