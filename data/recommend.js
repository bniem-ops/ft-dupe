// HAND-AUTHORED, like strategy.js. This is the recommendation ENGINE: a
// curated pool of synergy-driven "archetype squads" plus logic that filters
// and scores them against a player's actual setup (player count, expansion
// on/off, difficulty, known predators) or a custom hand-picked team.
//
// Design note: these are combinatorial inputs (1-6 players x expansion x
// 7 difficulty levels x arbitrary predator sets x arbitrary custom teams),
// so this is deliberately NOT a lookup table of pre-written text per
// combination — it's archetype data + functions that compute a result.

(function () {
  // Each archetype's `core` is an ordered wishlist: the most thematically
  // essential picks first, optional flex picks after. To size a squad for N
  // players: filter core to whatever's allowed (expansion on/off), then
  // take the first N. If fewer than N remain, the archetype can't fully
  // staff that player count and is skipped for that query.
  // `resilience` is a rough read on how well an archetype holds up against
  // a scarier Boss / wider predator pool at high difficulty: 'high' means
  // it has a genuine tank (Atilla the Hen) or broad role coverage; 'low'
  // means it leans on a gimmick with no dedicated damage-soak. Used to
  // reorder (not remove) results at difficulty 4+.
  const ARCHETYPES = [
    // ---- Solo (1 player) ----
    { id: 'solo-attrition', title: 'Attrition Fighter', tag: 'Solo', resilience: 'medium',
      core: ['Wyatt Chirp'], minPlayers: 1, maxPlayers: 1,
      blurb: 'Payback backfills a missed production roll with a free meal, and Thick Feathers shaves down every return hit — a self-sufficient grind pick that needs no teammates to function.' },
    { id: 'solo-weatherproof', title: 'Weather-Proof Grinder', tag: 'Solo', resilience: 'medium',
      core: ['Cumberbill Rockefeather'], minPlayers: 1, maxPlayers: 1,
      blurb: 'By Stage 3 (Dandy) he\'s immune to ALL negative weather — solo play means you can\'t split weather risk across teammates, so removing the whole threat axis single-handedly is huge.' },
    { id: 'solo-egg-loop', title: 'Egg Economy Loop', tag: 'Solo', resilience: 'medium', requiresExpansion: true,
      core: ['Princess Layer'], minPlayers: 1, maxPlayers: 1,
      blurb: 'Doubles her own Lay Egg yield, funds Extra Action refreshes, and spends eggs to shrug off damage — a fully closed-loop kit with no "nearby teammate" abilities going to waste solo.' },

    // ---- Squads (2+) ----
    { id: 'balanced-core', title: 'Balanced Core', tag: 'All-Rounder', resilience: 'high',
      core: ['Atilla the Hen', 'Beowing', 'Princess Layer', 'General Tso', 'Shellock Holmes', 'Aracorn, Heir of Condor', 'Wingston Coophill', 'Cluck Norris'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'One tank, one universal buffer, one economy/control engine, then utility and a protected striker as the group grows. The safe, cohesive default if you don\'t want to lean into a theme.' },

    { id: 'grub-guild', title: 'Grub Guild', tag: 'Grub Synergy', resilience: 'high',
      core: ['Shellock Holmes', 'Eggatha Christie', 'Atilla the Hen', 'Beowing', 'J.R.R. Yolkien', 'Princess Layer'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'Shellock Holmes strikes either Grub from anywhere and turns Grub hearts into a damage buffer; Eggatha\'s Tomb Raider keeps pressuring discarded Grubs. Doubles as prep work for a Sheriff of Rottingham fight, whose return attack scales off Grub deck health.' },

    { id: 'egg-economy', title: 'Egg Economy Engine', tag: 'Economy', resilience: 'low',
      core: ['General Tso', 'Annie Yolkley', 'Cluckleberry Finn', 'Beowing', 'Princess Layer', 'J.R.R. Yolkien'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'Annie Yolkley and Cluckleberry Finn overproduce and inflate the value of eggs; General Tso (or J.R.R. Yolkien) spends the surplus to fix bad die rolls on demand. A reliability engine built on economic surplus rather than raw stats.' },

    { id: 'universal-buff', title: 'Universal Buff Core', tag: 'Support', resilience: 'high',
      core: ['Beowing', 'Atilla the Hen', 'General Tso', 'Madam Chickovsky', 'Wyatt Chirp', 'Cluck Norris'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'Battle Cry boosts every nearby teammate\'s dice on ANY roll — not just attacks — while weakening the Predator\'s. Build around Beowing and stack high-attack, roll-dependent teammates who benefit most.' },

    { id: 'weather-fortress', title: 'Weather-Immune Fortress', tag: 'Weather Denial', resilience: 'medium',
      core: ['Cumberbill Rockefeather', 'Madam Chickovsky', 'Eggatha Christie', 'Chickira', 'Aracorn, Heir of Condor', 'Beowing'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'Stacks weather immunities (Cumberbill goes fully immune by Stage 3; Madam Chickovsky and Eggatha cover specific cards) plus Chickira\'s ability to force a re-draw on whatever\'s left. Denies an entire threat category rather than out-fighting it.' },

    { id: 'passive-sustain', title: 'Passive Sustain', tag: 'Sustain', resilience: 'medium',
      core: ['Beowing', 'Chickira', 'Madam Chickovsky', 'Wyatt Chirp', 'Cumberbill Rockefeather', 'Shellock Holmes'],
      minPlayers: 2, maxPlayers: 6,
      caution: 'No dedicated Damage role in the core lineup — plan on spending real actions/food on Attack rather than leaning on a big hitter\'s kit.',
      blurb: 'Three different passive heal triggers stacked on one team — Beowing\'s Berserker, Chickira\'s Shake it Off, and Madam Chickovsky\'s Ladies\' Aid — so the squad barely needs to spend an action on Heal at all. Wyatt Chirp adds a real Tank and Shellock Holmes covers Grub Control, the two roles the core trio is missing on its own.' },

    { id: 'tank-glasscannon', title: 'Tank & Glass Cannon', tag: 'Tank + Damage', resilience: 'high',
      core: ['Atilla the Hen', 'Wingston Coophill', 'Broods Lee', 'Cluck Norris', 'Beowing', 'Shellock Holmes'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'Atilla intercepts damage meant for your fragile pieces and gets paid 2 eggs every time he does. Wingston punches above his stat line if protected; Broods Lee gets stronger the longer the team stays wounded.' },

    { id: 'mobility-recon', title: 'Mobility & Recon', tag: 'Utility', resilience: 'low',
      core: ['Cumberbill Rockefeather', 'Madam Chickovsky', 'Wingston Coophill', 'Shellock Holmes', 'Aracorn, Heir of Condor'],
      minPlayers: 2, maxPlayers: 5,
      blurb: 'Built around board coverage instead of raw combat: free movement, full Outside-action flexibility, and grub strikes from any location. Good for a team that wants to split up and multitask rather than deathball one location.' },

    { id: 'card-control', title: 'Card Control Engine', tag: 'Control', resilience: 'low',
      core: ['General Tso', 'Shellock Holmes', 'Beowing', 'J.R.R. Yolkien', 'Cluck Norris', 'Princess Layer'],
      minPlayers: 2, maxPlayers: 6,
      caution: 'Hard-countered by Chicksune, whose Stage 1 effect makes the whole team immune to Bonus Card effects — this archetype goes quiet against her specifically.',
      blurb: 'Draw-heavy, card-selection-heavy kit (Foresight, a bigger hand, egg-funded re-rolls) for players who like maximizing information and mitigating bad luck.' },

    { id: 'glass-cannon-gambit', title: 'Glass Cannon Gambit', tag: 'High Variance', resilience: 'low',
      core: ['Cluck Norris', 'Broods Lee', 'Wingston Coophill', 'Chickira', 'General Tso', 'Cluckleberry Finn'],
      minPlayers: 2, maxPlayers: 6,
      blurb: 'No dedicated tank — everyone leans into taking damage for resources or buffs. Higher skill ceiling and higher variance than the other archetypes, but a blast if your group likes risk over reliability.' },
  ];

  const RESILIENCE_RANK = { high: 0, medium: 1, low: 2 };

  function chickenExpansionMap() {
    const map = {};
    ((window.FLOCK_DATA && window.FLOCK_DATA.chickens) || []).forEach(c => { if (c.name) map[c.name] = c.expansion; });
    return map;
  }

  function rosterNames() {
    return ((window.FLOCK_DATA && window.FLOCK_DATA.chickens) || []).map(c => c.name).filter(Boolean);
  }

  // Which archetype-core entries are actually pickable given expansion on/off.
  function availableCore(archetype, expansionOn) {
    const tiers = chickenExpansionMap();
    return archetype.core.filter(name => expansionOn || tiers[name] !== 'Eggspansion');
  }

  // Names of the archetype's chickens that got excluded because expansion is off.
  function lockedByExpansion(archetype, expansionOn) {
    if (expansionOn) return [];
    const tiers = chickenExpansionMap();
    return archetype.core.filter(name => tiers[name] === 'Eggspansion');
  }

  // Difficulty is an 8-level scale where 4 is Normal (no modifiers) — 1-3
  // are progressively EASIER than Normal, 5-8 progressively HARDER. The
  // "randomize predator" modifiers at 5+ draw from a fixed species list,
  // not the full 16-predator roster, and that list is shorter without
  // Eggspansion. Mapped to actual predator names in this dataset:
  //   Bear=Ursula Bone, Coyote=Shere Corn, Hawk=Cleopoultra, Fox=Chicksune,
  //   Raccoon=Hens Gruber, Badger=Hendel's Mother, Cougar=Coopella,
  //   Snapping Turtle=Layonardo
  function bossSpeciesPool(expansionOn) {
    return expansionOn ? ['Bear', 'Coyote', 'Hawk', 'Badger', 'Cougar'] : ['Bear', 'Coyote', 'Hawk'];
  }
  function fullPredatorSpeciesPool(expansionOn) {
    return expansionOn
      ? ['Bear', 'Coyote', 'Hawk', 'Fox', 'Raccoon', 'Badger', 'Cougar', 'Snapping Turtle']
      : ['Bear', 'Coyote', 'Hawk', 'Fox', 'Raccoon'];
  }

  function difficultyModifiers(difficulty, expansionOn) {
    const d = Number(difficulty) || 4;
    if (d === 1) return ['All players start with a random Loot Drop', 'No +3 health bonus on the Boss', 'Guaranteed positive card on top of each Weather deck'];
    if (d === 2) return ['No +3 health bonus on the Boss', 'Guaranteed positive card on top of each Weather deck'];
    if (d === 3) return ['Guaranteed positive card on top of each Weather deck'];
    if (d === 4) return [];
    if (d === 5) return [`Boss randomly selected from: ${bossSpeciesPool(expansionOn).join(', ')}`];
    if (d === 6) return [`Boss randomly selected from: ${bossSpeciesPool(expansionOn).join(', ')}`, 'Fair/Sunny/Snow removed from their decks (no guaranteed calm top card)'];
    if (d === 7) return ['Fair/Sunny/Snow removed from their decks', `All 4 Predators randomly selected from: ${fullPredatorSpeciesPool(expansionOn).join(', ')}`];
    return ['Fair/Sunny/Snow removed from their decks', `All 4 Predators randomly selected from: ${fullPredatorSpeciesPool(expansionOn).join(', ')}`, 'Boss health multiplier increased to +4 (instead of +3)'];
  }

  function difficultyTip(difficulty, expansionOn) {
    const d = Number(difficulty) || 4;
    const mods = difficultyModifiers(d, expansionOn);
    if (d === 4) return 'Difficulty 4: Normal — no modifiers.';
    if (d < 4) return `Difficulty ${d} (easier than Normal): ${mods.join('; ')}.`;
    const strategyNote = d >= 5
      ? ' Broad predator-matchup coverage (see the Predator Guide) matters more than a narrow counter-pick at this tier.'
      : '';
    return `Difficulty ${d} (harder than Normal): ${mods.join('; ')}.${strategyNote}`;
  }

  // Substring-match a roster name inside free text (used for both combo
  // "chickens" entries and predator-guide "counters" entries, which are
  // written as prose like "Annie Yolkley or Princess Layer").
  function namesIn(text, roster) {
    return roster.filter(n => text.includes(n));
  }

  function suggestTeams({ players, expansion, difficulty, predators }) {
    const roster = rosterNames();
    const N = Math.max(1, Math.min(6, Number(players) || 1));
    const d = Number(difficulty) || 4;
    // Difficulty 4 is Normal (no modifiers); 1-3 are easier than Normal;
    // real extra difficulty (Boss/predator randomization) only starts at
    // 5+. Reorder toward higher-resilience archetypes from there instead
    // of the curated default order. This re-prioritizes, it never removes
    // an archetype — a fragile pick is still shown, just lower down, with
    // a caution note attached.
    const reorderByResilience = d >= 5;

    let viable = ARCHETYPES.filter(a => N >= a.minPlayers && N <= a.maxPlayers)
      .map(a => {
        const avail = availableCore(a, expansion);
        return { archetype: a, avail, locked: lockedByExpansion(a, expansion) };
      })
      .filter(x => x.avail.length >= N);

    if (reorderByResilience) {
      viable = [...viable].sort((x, y) => RESILIENCE_RANK[x.archetype.resilience] - RESILIENCE_RANK[y.archetype.resilience]);
    }

    const results = viable.slice(0, 5).map(({ archetype, avail, locked }) => {
      const squad = avail.slice(0, N);
      const covers = (predators || []).filter(predName => {
        const guide = (window.FLOCK_STRATEGY.predatorGuide || []).find(p => p.predator === predName);
        if (!guide) return false;
        return guide.counters.some(c => namesIn(c.chicken, squad).length > 0);
      });
      let caution = archetype.caution || null;
      if (d >= 5 && archetype.resilience === 'low') {
        const riskNote = `No dedicated tank — riskier at difficulty ${d}, where the Boss and/or predator pool is randomized to a tougher set. Consider designating your highest-health pick to soak damage.`;
        caution = caution ? `${caution} ${riskNote}` : riskNote;
      }
      return {
        id: archetype.id, title: archetype.title, tag: archetype.tag,
        blurb: archetype.blurb, caution,
        squad, covers,
        lockedCount: locked.length,
      };
    });

    return { results, tip: difficultyTip(difficulty, expansion) };
  }

  // --- Custom team analysis ---------------------------------------------
  function gapNote(gaps, difficulty) {
    if (!gaps.length) return 'Solid coverage across tank, economy, support, control, and damage.';
    const d = Number(difficulty) || 4;
    if (gaps.includes('Tank') && d >= 5) {
      return `No dedicated Tank on this team — a real risk at difficulty ${d}, where the Boss and/or predator pool is randomized to a tougher set. Designate whoever has the most health to absorb hits, or rethink the pick if you have the option.`;
    }
    return `No dedicated ${gaps.join(', ')} on this team — plan around the gap rather than relying on a specialist for it.`;
  }

  function analyzeTeam(teamNames, difficulty) {
    const roster = rosterNames();
    const arch = window.FLOCK_STRATEGY.archetypes || [];
    const picked = arch.filter(a => teamNames.includes(a.name));

    const roleCounts = {};
    picked.forEach(a => a.roles.forEach(r => { roleCounts[r] = (roleCounts[r] || 0) + 1; }));

    const KEY_ROLES = ['Tank', 'Economy', 'Support', 'Control', 'Damage', 'Utility'];
    const gaps = KEY_ROLES.filter(r => !roleCounts[r]);
    const gapMessage = gapNote(gaps, difficulty);

    const combos = (window.FLOCK_STRATEGY.combos || []).map(combo => {
      const entries = combo.chickens.map(e => namesIn(e, roster)).filter(names => names.length > 0);
      if (!entries.length) return null;
      // Per slot, which of ITS matched roster names are actually on this team —
      // e.g. a "General Tso or J.R.R. Yolkien" slot only counts the one you picked.
      const matchedPerSlot = entries.map(names => names.filter(n => teamNames.includes(n)));
      const satisfiedSlots = matchedPerSlot.filter(names => names.length > 0);
      if (!satisfiedSlots.length) return null;
      const matchedChickens = [...new Set(matchedPerSlot.flat())];
      const status = satisfiedSlots.length === entries.length ? 'active' : 'partial';
      return { ...combo, status, matchedChickens };
    }).filter(Boolean);

    // Leveling pace: sum of "meals to reach next stage" across stage 1 & 2
    // for each team member = total meals needed to fully level that bird.
    const dataChickens = (window.FLOCK_DATA && window.FLOCK_DATA.chickens) || [];
    const pace = teamNames.map(name => {
      const c = dataChickens.find(x => x.name === name);
      if (!c) return null;
      const total = c.stages.slice(0, 2).reduce((sum, s) => {
        const n = parseInt(s.mealsToNext, 10);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      return { name, total: total || null };
    }).filter(x => x && x.total);
    pace.sort((a, b) => a.total - b.total);

    const grubPickers = picked.filter(a => a.roles.includes('Grub Control')).map(a => a.name);

    return { picked, gaps, gapMessage, combos, pace, grubPickers };
  }

  function predatorPriority(teamNames, predatorNames) {
    const roster = rosterNames();
    return (predatorNames || []).map(predName => {
      const guide = (window.FLOCK_STRATEGY.predatorGuide || []).find(p => p.predator === predName);
      if (!guide) return { predator: predName, favorable: false, guide: null };
      const matchedCounters = guide.counters.filter(c => namesIn(c.chicken, roster).some(n => teamNames.includes(n)));
      return { predator: predName, favorable: matchedCounters.length > 0, matchedCounters, guide };
    }).sort((a, b) => (a.favorable === b.favorable) ? 0 : (a.favorable ? -1 : 1));
    // favorable (engage early) sorted first, unfavorable (engage later) last
  }

  window.FLOCK_RECOMMEND = { ARCHETYPES, suggestTeams, analyzeTeam, predatorPriority, namesIn, rosterNames };
})();
