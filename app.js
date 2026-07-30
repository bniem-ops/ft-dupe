(function () {
  const DATA = window.FLOCK_DATA || { chickens: [], predators: [], weather: { seasons: {}, eggspansion: [], unsorted: [] } };

  const state = {
    tab: 'chickens', search: '', openCards: new Set(), openStage: {},
    strategySection: 'archetypes',
    setup: null, wizardOpen: false, wizardDraft: null,
    compareA: null, compareB: null, myTeam: [],
  };

  const appEl = document.getElementById('app');
  const progressEl = document.getElementById('progress');
  const tabbar = document.getElementById('tabbar');
  const wizardRoot = document.getElementById('wizard-root');
  const setupBtn = document.getElementById('setup-btn');

  function defaultDraft() { return { players: 3, expansion: false, difficulty: 1, predators: [] }; }
  function loadSetup() {
    try {
      const raw = localStorage.getItem('flockSetup');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    return null;
  }
  function saveSetup(setup) {
    state.setup = setup;
    try { localStorage.setItem('flockSetup', JSON.stringify(setup)); } catch (e) { /* storage unavailable */ }
  }

  tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.search = ''; // search is scoped to whichever tab/section is showing
    [...tabbar.children].forEach(t => t.classList.toggle('active', t === btn));
    render();
  });

  if (setupBtn) {
    setupBtn.addEventListener('click', () => {
      state.wizardDraft = state.setup ? { ...state.setup, predators: [...state.setup.predators] } : defaultDraft();
      state.wizardOpen = true;
      render();
    });
  }

  // ---------------------------------------------------------------------
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function val(v, placeholder = 'Not yet transcribed') {
    return v == null
      ? `<span class="value unknown">${placeholder}</span>`
      : `<span class="value">${esc(v)}</span>`;
  }

  function statBlock(label, v) {
    return `<div class="stat"><div class="label">${esc(label)}</div><div class="value ${v == null ? 'unknown' : ''}">${v == null ? '—' : esc(v)}</div></div>`;
  }

  // ---------------------------------------------------------------------
  // Progress summary
  // ---------------------------------------------------------------------
  function updateProgress() {
    const namedChickens = DATA.chickens.filter(c => c.name).length;
    const statFullChickens = DATA.chickens.filter(c => c.name && c.stages.every(s => s.health && s.attackStrength && s.production)).length;

    const namedPredators = DATA.predators.filter(p => p.name).length;
    const statFullPredators = DATA.predators.filter(p => p.name && p.stages.every(s => s.healthMultiplier && s.effect)).length;

    const allWeather = [...Object.values(DATA.weather.seasons || {}).flat(), ...(DATA.weather.eggspansion || [])];
    const weatherFull = allWeather.filter(w => w.name && w.effect).length;

    progressEl.textContent =
      `Chickens ${statFullChickens}/${DATA.chickens.length} statted (${namedChickens} named) · ` +
      `Predators ${statFullPredators}/${DATA.predators.length} statted (${namedPredators} named) · ` +
      `Weather ${weatherFull}/${allWeather.length} statted`;
  }

  // ---------------------------------------------------------------------
  // CHICKENS
  // ---------------------------------------------------------------------
  function chickenCompleteness(c) {
    let total = 0, filled = 0;
    c.stages.forEach((s, i) => {
      total += 3; // health, attack, production
      if (s.health) filled++;
      if (s.attackStrength) filled++;
      if (s.production) filled++;
      if (i < c.stages.length - 1) { total += 1; if (s.mealsToNext) filled++; }
      total += 1; if (s.abilities.length) filled++;
    });
    return { total, filled };
  }

  function renderChickenCard(c, idx) {
    const key = 'chk-' + idx;
    const isOpen = state.openCards.has(key);
    const { total, filled } = chickenCompleteness(c);
    const full = filled === total;
    const name = c.name || `Eggspansion slot #${idx + 1}`;
    const openStageIdx = state.openStage[key] ?? 0;

    const stageTabs = c.stages.map((s, i) => `
      <button class="stage-tab ${i === openStageIdx ? 'active' : ''}" data-key="${key}" data-stage="${i}">
        ${esc(s.label.split(' ')[0] || 'Stage ' + s.stage)}
      </button>`).join('');

    const stage = c.stages[openStageIdx];
    // Abilities stack — a chicken keeps every prior stage's abilities on
    // top of its new one (rulebook p.13). Show the cumulative set for the
    // selected stage, tagging which stage each was gained at so it's clear
    // what's new vs. carried over.
    const cumulativeAbilities = c.stages
      .slice(0, openStageIdx + 1)
      .flatMap(s => s.abilities.map(a => ({ ...a, gainedAtStage: s.stage })));
    const abilities = cumulativeAbilities.length
      ? cumulativeAbilities.map(a => `
          <div class="ability">
            <div class="aname">
              ${a.name ? esc(a.name) : '<span class="unknown">Unnamed ability</span>'}
              ${a.gainedAtStage !== stage.stage ? `<span class="stage-badge">from Stage ${a.gainedAtStage}</span>` : ''}
            </div>
            <div class="atext ${a.text ? '' : 'unknown'}">${a.text ? esc(a.text) : 'Not yet transcribed'}</div>
          </div>`).join('')
      : `<div class="note">No abilities recorded through this stage yet.</div>`;

    return `
      <div class="card ${isOpen ? 'open' : ''}" data-key="${key}">
        <div class="card-head" data-toggle="${key}">
          <div class="card-title">
            <span class="name">${esc(name)}</span>
            <span class="sub">${c.breed ? esc(c.breed) : 'Breed unknown'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="completeness ${full ? 'full' : ''}">${filled}/${total}</span>
            <span class="chevron">▶</span>
          </div>
        </div>
        <div class="card-body">
          <div class="stage-tabs">${stageTabs}</div>
          <div class="stat-grid">
            ${statBlock('Health', stage.health)}
            ${statBlock('Attack Strength', stage.attackStrength)}
            ${statBlock('Production', stage.production)}
            ${stage.mealsToNext !== undefined && openStageIdx < c.stages.length - 1 ? statBlock('Meals to next stage', stage.mealsToNext) : ''}
          </div>
          ${abilities}
          ${c.flavorQuote ? `<div class="flavor">"${esc(c.flavorQuote)}"</div>` : ''}
        </div>
      </div>`;
  }

  function renderChickens() {
    const q = state.search.trim().toLowerCase();
    const items = DATA.chickens
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        if (!q) return true;
        const hay = [c.name, c.breed, ...c.stages.flatMap(s => s.abilities.map(a => a.name + ' ' + a.text))].join(' ').toLowerCase();
        return hay.includes(q);
      });

    if (!items.length) return `<div class="empty-state">No chickens match "${esc(state.search)}"</div>`;
    return items.map(({ c, i }) => renderChickenCard(c, i)).join('');
  }

  // ---------------------------------------------------------------------
  // PREDATORS
  // ---------------------------------------------------------------------
  function predatorCompleteness(p) {
    let total = 0, filled = 0;
    p.stages.forEach(s => {
      total += 3;
      if (s.healthMultiplier) filled++;
      if (s.effect) filled++;
      if (s.returnAttack) filled++;
    });
    total += 1; if (p.lootDrop) filled++;
    return { total, filled };
  }

  function renderPredatorCard(p, idx) {
    const key = 'pred-' + idx;
    const isOpen = state.openCards.has(key);
    const { total, filled } = predatorCompleteness(p);
    const full = filled === total;
    const name = p.name || `Eggspansion slot #${idx + 1}`;
    const openStageIdx = state.openStage[key] ?? 0;
    const stage = p.stages[openStageIdx];

    const stageTabs = p.stages.map((s, i) => `
      <button class="stage-tab ${i === openStageIdx ? 'active' : ''}" data-key="${key}" data-stage="${i}">Stage ${s.stage}</button>`).join('');

    return `
      <div class="card ${isOpen ? 'open' : ''}" data-key="${key}">
        <div class="card-head" data-toggle="${key}">
          <div class="card-title">
            <span class="name">${esc(name)}</span>
            <span class="sub">${p.species ? esc(p.species) : 'Species unknown'}${p.note ? ' · ' + esc(p.note) : ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="completeness ${full ? 'full' : ''}">${filled}/${total}</span>
            <span class="chevron">▶</span>
          </div>
        </div>
        <div class="card-body">
          <div class="stage-tabs">${stageTabs}</div>
          <div class="stat-grid">
            ${statBlock('Health Multiplier', stage.healthMultiplier)}
            ${statBlock('Return Attack (claws)', stage.returnAttack)}
          </div>
          <div class="ability">
            <div class="aname">Predator Effect</div>
            <div class="atext ${stage.effect ? '' : 'unknown'}">${stage.effect ? esc(stage.effect) : 'Not yet transcribed'}</div>
          </div>
          <div class="loot">
            <div class="label">Loot Drop</div>
            ${p.lootDrop ? esc(p.lootDrop) : '<span class="value unknown">Not yet transcribed</span>'}
          </div>
        </div>
      </div>`;
  }

  function renderPredators() {
    const q = state.search.trim().toLowerCase();
    const items = DATA.predators
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        if (!q) return true;
        const hay = [p.name, p.species, p.note, p.lootDrop, ...p.stages.map(s => s.effect)].join(' ').toLowerCase();
        return hay.includes(q);
      });

    if (!items.length) return `<div class="empty-state">No predators match "${esc(state.search)}"</div>`;
    return items.map(({ p, i }) => renderPredatorCard(p, i)).join('');
  }

  // ---------------------------------------------------------------------
  // WEATHER
  // ---------------------------------------------------------------------
  function weatherCard(w) {
    return `
      <div class="card open" style="cursor:default;">
        <div class="card-body" style="border-top:none;padding-top:14px;">
          <div class="ability">
            <div class="aname">${w.name ? esc(w.name) : '<span class="unknown">Unnamed card</span>'}</div>
            <div class="atext ${w.effect ? '' : 'unknown'}">${w.effect ? esc(w.effect) : 'Not yet transcribed'}</div>
            <div class="note">${w.phaseLength ? 'Phase length: ' + esc(w.phaseLength) + ' days' : (w.season ? 'Season: ' + esc(w.season) : '')}${w.note ? ' · ' + esc(w.note) : ''}</div>
          </div>
        </div>
      </div>`;
  }

  function renderWeather() {
    const q = state.search.trim().toLowerCase();
    const seasons = ['spring', 'summer', 'fall'];
    let out = '';
    seasons.forEach(season => {
      const cards = (DATA.weather.seasons[season] || []).filter(w => {
        if (!q) return true;
        return [w.name, w.effect].join(' ').toLowerCase().includes(q);
      });
      if (!cards.length && q) return;
      out += `<div class="section-title">${season} deck</div>`;
      out += cards.length ? cards.map(weatherCard).join('') : `<div class="empty-state">No cards yet</div>`;
    });

    const eggs = (DATA.weather.eggspansion || []).filter(w => !q || [w.name, w.effect].join(' ').toLowerCase().includes(q));
    if (eggs.length || !q) {
      out += `<div class="section-title">Eggspansion cards</div>`;
      out += eggs.length ? eggs.map(weatherCard).join('') : `<div class="empty-state">No cards yet</div>`;
    }

    const unsorted = (DATA.weather.unsorted || []).filter(w => !q || [w.name, w.effect].join(' ').toLowerCase().includes(q));
    if (unsorted.length) {
      out += `<div class="section-title">Unsorted (season unknown)</div>`;
      out += unsorted.map(weatherCard).join('');
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // STRATEGY
  // ---------------------------------------------------------------------
  const STRAT = window.FLOCK_STRATEGY;

  function staticCard(inner) {
    return `<div class="card open" style="cursor:default;"><div class="card-body" style="border-top:none;padding-top:14px;">${inner}</div></div>`;
  }
  function roleChips(list) {
    return `<div style="margin:4px 0 6px 0;">${list.map(r => `<span class="role-chip">${esc(r)}</span>`).join('')}</div>`;
  }

  function renderArchetypes() {
    if (!STRAT) return `<div class="empty-state">Strategy data not loaded.</div>`;
    const q = state.search.trim().toLowerCase();
    const items = STRAT.archetypes.filter(a => !q || [a.name, ...a.roles, a.summary].join(' ').toLowerCase().includes(q));
    if (!items.length) return `<div class="empty-state">No chickens match "${esc(state.search)}"</div>`;
    return items.map(a => staticCard(`
      <div class="ability">
        <div class="aname">${esc(a.name)}</div>
        ${roleChips(a.roles)}
        <div class="atext">${esc(a.summary)}</div>
      </div>`)).join('');
  }

  function renderMatchups() {
    if (!STRAT) return `<div class="empty-state">Strategy data not loaded.</div>`;
    const q = state.search.trim().toLowerCase();
    const items = STRAT.predatorGuide.filter(p => !q || [p.predator, p.species, p.threat, ...p.counters.map(c => c.chicken + ' ' + c.why)].join(' ').toLowerCase().includes(q));
    if (!items.length) return `<div class="empty-state">No predators match "${esc(state.search)}"</div>`;
    return items.map(p => staticCard(`
        <div class="ability">
          <div class="aname">${esc(p.predator)}
            <span class="stage-badge">${esc(p.species)}</span>${p.note ? ` <span class="stage-badge">${esc(p.note)}</span>` : ''}
          </div>
          <div class="atext">${esc(p.threat)}</div>
        </div>
        <div style="margin-top:6px;">
          <div class="section-title" style="margin:8px 0 4px 4px;">Best counters</div>
          ${p.counters.map(c => `
            <div class="ability">
              <div class="aname" style="color:var(--accent-2);">${esc(c.chicken)}</div>
              <div class="atext">${esc(c.why)}</div>
            </div>`).join('')}
        </div>
        <div class="note" style="margin-top:6px;">⚠ ${esc(p.caution)}</div>`)).join('');
  }

  function renderTeamComps() {
    const REC = window.FLOCK_RECOMMEND;
    if (!STRAT || !REC) return `<div class="empty-state">Strategy data not loaded.</div>`;
    if (!state.setup) {
      return staticCard(`
        <div class="ability">
          <div class="aname">Set up your game to see tailored comps</div>
          <div class="atext">Tap ⚙ Setup above and answer player count, Eggspansion, and difficulty — the suggestions here are computed from that, not a fixed list.</div>
        </div>`);
    }

    const setup = state.setup;
    const { results, tip } = REC.suggestTeams(setup);

    let out = staticCard(`
      <div class="ability">
        <div class="aname">Your setup</div>
        <div class="atext">${setup.players} player${setup.players > 1 ? 's' : ''} · Eggspansion ${setup.expansion ? 'On' : 'Off'} · Difficulty ${esc(setup.difficulty)}${setup.predators.length ? ' · Facing: ' + setup.predators.map(esc).join(', ') : ''}</div>
      </div>`);

    if (tip) out += `<div class="note" style="margin:0 0 10px 4px;">${esc(tip)}</div>`;

    if (!results.length) {
      out += `<div class="empty-state">No archetype fully fits that combination yet — try toggling Eggspansion on, since most archetypes need it to staff higher player counts.</div>`;
    } else {
      out += results.map(r => staticCard(`
        <div class="ability">
          <div class="aname">${esc(r.title)} <span class="stage-badge">${esc(r.tag)}</span></div>
          <div class="atext">${esc(r.blurb)}</div>
          ${roleChips(r.squad)}
          ${r.covers.length ? `<div class="note" style="color:var(--accent-2);font-style:normal;">✓ Already covers: ${r.covers.map(esc).join(', ')}</div>` : ''}
          ${r.caution ? `<div class="note">⚠ ${esc(r.caution)}</div>` : ''}
          ${r.lockedCount ? `<div class="note">+${r.lockedCount} more pick${r.lockedCount > 1 ? 's' : ''} available for this archetype with Eggspansion on</div>` : ''}
        </div>`)).join('');
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // COMPARE CHICKENS
  // ---------------------------------------------------------------------
  function parseNum(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

  function chickenQuickStats(c) {
    const healthSum = c.stages.reduce((s, st) => s + (parseNum(st.health) || 0), 0);
    const attackSum = c.stages.reduce((s, st) => s + (parseNum(st.attackStrength) || 0), 0);
    const mealsSum = c.stages.slice(0, 2).reduce((s, st) => s + (parseNum(st.mealsToNext) || 0), 0);
    const rollThresholds = c.stages.slice(1).map(st => {
      const m = (st.production || '').match(/(\d)-6/);
      return m ? Number(m[1]) : null;
    }).filter(n => n != null);
    const avgThreshold = rollThresholds.length ? (rollThresholds.reduce((a, b) => a + b, 0) / rollThresholds.length) : null;
    const abilityTexts = c.stages.flatMap(st => st.abilities.map(a => a.text || ''));
    const cardDependent = abilityTexts.some(t => /bonus card/i.test(t));
    return { healthSum, attackSum, mealsSum, avgThreshold, cardDependent };
  }

  function renderComparisonBody(nameA, nameB) {
    const cA = DATA.chickens.find(c => c.name === nameA);
    const cB = DATA.chickens.find(c => c.name === nameB);
    if (!cA || !cB) return '';
    const qa = chickenQuickStats(cA), qb = chickenQuickStats(cB);

    const bullets = [];
    if (qa.healthSum !== qb.healthSum) {
      const higher = qa.healthSum > qb.healthSum ? nameA : nameB;
      bullets.push(`${higher} has more total health across all 3 stages (${Math.max(qa.healthSum, qb.healthSum)} vs ${Math.min(qa.healthSum, qb.healthSum)}) — tankier, better for soaking hits.`);
    }
    if (qa.attackSum !== qb.attackSum) {
      const higher = qa.attackSum > qb.attackSum ? nameA : nameB;
      bullets.push(`${higher} has more total attack strength across all 3 stages (${Math.max(qa.attackSum, qb.attackSum)} vs ${Math.min(qa.attackSum, qb.attackSum)}) — hits harder, wastes less food on weak attacks.`);
    }
    if (qa.mealsSum != null && qb.mealsSum != null && qa.mealsSum !== qb.mealsSum) {
      const faster = qa.mealsSum < qb.mealsSum ? nameA : nameB;
      bullets.push(`${faster} levels faster — needs fewer total meals to reach Stage 3 (${Math.min(qa.mealsSum, qb.mealsSum)} vs ${Math.max(qa.mealsSum, qb.mealsSum)}).`);
    }
    if (qa.avgThreshold != null && qb.avgThreshold != null && qa.avgThreshold !== qb.avgThreshold) {
      const better = qa.avgThreshold < qb.avgThreshold ? nameA : nameB;
      bullets.push(`${better} has better production-roll odds on average (needs ${(qa.avgThreshold < qb.avgThreshold ? qa.avgThreshold : qb.avgThreshold)}-6 vs ${(qa.avgThreshold < qb.avgThreshold ? qb.avgThreshold : qa.avgThreshold)}-6) — more reliable egg income.`);
    }
    if (qa.cardDependent !== qb.cardDependent) {
      const safer = !qa.cardDependent ? nameA : nameB;
      bullets.push(`${safer}'s kit doesn't depend on Bonus Cards — untouched by Chicksune's card-lockdown effect, where the other isn't.`);
    }

    const archA = STRAT.archetypes.find(a => a.name === nameA);
    const archB = STRAT.archetypes.find(a => a.name === nameB);

    const profile = (c, arch) => staticCard(`
      <div class="ability">
        <div class="aname">${esc(c.name)}</div>
        <div class="sub" style="margin-bottom:6px;">${c.breed ? esc(c.breed) : ''}${arch ? roleChips(arch.roles) : ''}</div>
        ${c.stages.map(st => `
          <div style="margin-top:8px;">
            <div class="section-title" style="margin:6px 0 4px 0;">${esc(st.label)}</div>
            <div class="stat-grid">
              ${statBlock('Health', st.health)}
              ${statBlock('Attack', st.attackStrength)}
              ${statBlock('Production', st.production)}
            </div>
            ${st.abilities.map(a => `<div class="ability"><div class="aname">${esc(a.name || 'Ability')}</div><div class="atext">${esc(a.text)}</div></div>`).join('')}
          </div>`).join('')}
      </div>`);

    return `
      ${staticCard(`
        <div class="ability">
          <div class="aname">Quick take</div>
          ${bullets.length ? bullets.map(b => `<div class="atext" style="margin-bottom:6px;">• ${b}</div>`).join('') : '<div class="atext">These two are close on the numbers — the difference comes down to playstyle (see roles below).</div>'}
        </div>`)}
      ${profile(cA, archA)}
      ${profile(cB, archB)}`;
  }

  function renderCompare() {
    const roster = DATA.chickens.filter(c => c.name).map(c => c.name).sort();
    if (roster.length < 2) return `<div class="empty-state">Need at least 2 named chickens in the data to compare.</div>`;
    if (!state.compareA) state.compareA = roster[0];
    if (!state.compareB) state.compareB = roster.find(n => n !== state.compareA) || roster[1];

    const picker = (which, current) => `
      <select class="searchbar" data-compare="${which}" style="margin-bottom:0;">
        ${roster.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>`;

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        ${picker('a', state.compareA)}
        ${picker('b', state.compareB)}
      </div>
      ${renderComparisonBody(state.compareA, state.compareB)}`;
  }

  // ---------------------------------------------------------------------
  // MY TEAM
  // ---------------------------------------------------------------------
  function renderMyTeam() {
    const REC = window.FLOCK_RECOMMEND;
    const roster = DATA.chickens.filter(c => c.name).map(c => c.name).sort();
    const n = state.setup ? state.setup.players : null;

    let out = staticCard(`
      <div class="ability">
        <div class="aname">Pick your team${n ? ` (${n} player${n > 1 ? 's' : ''})` : ''}</div>
        <div class="atext">Select the chickens you're actually playing to get tailored advice below.</div>
      </div>`);

    out += `<div class="chicken-picker">${roster.map(name => `
      <label class="check-row">
        <input type="checkbox" data-myteam="${esc(name)}" ${state.myTeam.includes(name) ? 'checked' : ''}>
        ${esc(name)}
      </label>`).join('')}</div>`;

    if (!state.myTeam.length || !REC) {
      out += `<div class="empty-state">Pick at least one chicken above to see analysis.</div>`;
      return out;
    }

    const analysis = REC.analyzeTeam(state.myTeam);

    out += staticCard(`
      <div class="ability">
        <div class="aname">Role coverage</div>
        ${roleChips(analysis.picked.flatMap(a => a.roles))}
        <div class="atext" style="margin-top:6px;">${analysis.gaps.length
          ? `No dedicated ${analysis.gaps.join(', ')} on this team — plan around the gap rather than relying on a specialist for it.`
          : `Solid coverage across tank, economy, support, control, and damage.`}</div>
      </div>`);

    if (analysis.combos.length) {
      out += `<div class="section-title">Synergies in this team</div>`;
      out += analysis.combos.map(c => staticCard(`
        <div class="ability">
          <div class="aname">${esc(c.title)} <span class="stage-badge">${c.status === 'active' ? 'Active' : 'Partial'}</span></div>
          <div class="atext">${esc(c.synergy)}</div>
        </div>`)).join('');
    }

    if (analysis.pace.length) {
      out += `<div class="section-title">Leveling pace</div>`;
      out += staticCard(`
        <div class="ability">
          <div class="atext">Total meals to reach Stage 3 — ${analysis.pace.map(p => `${esc(p.name)} (${p.total})`).join(', ')}. Feed <strong>${esc(analysis.pace[0].name)}</strong> first — cheapest to unlock their full kit.</div>
        </div>`);
    }

    if (analysis.grubPickers.length) {
      out += staticCard(`
        <div class="ability">
          <div class="aname">Early game: prioritize Grubs</div>
          <div class="atext">${analysis.grubPickers.map(esc).join(', ')} turn Grub kills into real value — clear Grubs early rather than ignoring them, especially if Sheriff of Rottingham is in the Predator pool this game.</div>
        </div>`);
    }

    if (state.setup && state.setup.predators.length) {
      const priority = REC.predatorPriority(state.myTeam, state.setup.predators);
      out += `<div class="section-title">Suggested engagement order</div>`;
      out += priority.map((p, i) => staticCard(`
        <div class="ability">
          <div class="aname">${i + 1}. ${esc(p.predator)} <span class="stage-badge">${p.favorable ? 'Engage early' : 'Save for later'}</span></div>
          <div class="atext">${p.favorable
            ? `Your team already counters this — ${p.matchedCounters.map(m => esc(m.chicken)).join(', ')}.`
            : `No natural counter on this team yet. Level up and stock resources before engaging, or let the fight come to you.`}</div>
        </div>`)).join('');
    } else {
      out += `<div class="note" style="margin-top:8px;">Add known predators in ⚙ Setup to get a suggested engagement order.</div>`;
    }

    return out;
  }

  function renderCombos() {
    if (!STRAT) return `<div class="empty-state">Strategy data not loaded.</div>`;
    const q = state.search.trim().toLowerCase();
    const items = STRAT.combos.filter(c => !q || [c.title, c.synergy, ...c.chickens].join(' ').toLowerCase().includes(q));
    if (!items.length) return `<div class="empty-state">No combos match "${esc(state.search)}"</div>`;
    return items.map(c => staticCard(`
      <div class="ability">
        <div class="aname">${esc(c.title)}</div>
        ${roleChips(c.chickens)}
        <div class="atext">${esc(c.synergy)}</div>
      </div>`)).join('');
  }

  function renderStrategy() {
    const sections = [
      { key: 'teams', label: 'Team Comps' },
      { key: 'myteam', label: 'My Team' },
      { key: 'compare', label: 'Compare' },
      { key: 'matchups', label: 'Predator Guide' },
      { key: 'archetypes', label: 'Archetypes' },
      { key: 'combos', label: 'Combos' },
    ];
    const active = state.strategySection || 'teams';
    const nav = `<div class="stage-tabs">${sections.map(s => `<button class="stage-tab ${s.key === active ? 'active' : ''}" data-strat="${s.key}">${esc(s.label)}</button>`).join('')}</div>`;

    let body = '';
    if (active === 'archetypes') body = renderArchetypes();
    else if (active === 'matchups') body = renderMatchups();
    else if (active === 'teams') body = renderTeamComps();
    else if (active === 'compare') body = renderCompare();
    else if (active === 'myteam') body = renderMyTeam();
    else body = renderCombos();

    const searchableSections = ['archetypes', 'matchups', 'combos'];
    return { nav, body, searchable: searchableSections.includes(active) };
  }

  // ---------------------------------------------------------------------
  // SETUP WIZARD
  // ---------------------------------------------------------------------
  function pillRow(items) {
    return `<div class="stage-tabs">${items.join('')}</div>`;
  }

  function renderWizard() {
    if (!wizardRoot) return;
    if (!state.wizardOpen || !state.wizardDraft) { wizardRoot.innerHTML = ''; return; }
    const d = state.wizardDraft;

    const playerPills = [1, 2, 3, 4, 5, 6].map(n => {
      const disabled = n === 6 && !d.expansion;
      return `<button class="stage-tab ${d.players === n ? 'active' : ''}" ${disabled ? 'disabled' : ''} data-players="${n}">${n}${disabled ? ' 🔒' : ''}</button>`;
    });

    const expansionPills = [
      `<button class="stage-tab ${!d.expansion ? 'active' : ''}" data-expansion="no">No</button>`,
      `<button class="stage-tab ${d.expansion ? 'active' : ''}" data-expansion="yes">Yes</button>`,
    ];

    const difficultyPills = [1, 2, 3, 4, 5, 6, 7].map(n =>
      `<button class="stage-tab ${d.difficulty === n ? 'active' : ''}" data-difficulty="${n}">${n}</button>`);

    const predatorChoices = DATA.predators.filter(p => p.name && (d.expansion || p.expansion !== 'Eggspansion'));
    const predatorList = predatorChoices.map(p => {
      const checked = d.predators.includes(p.name);
      const capReached = !checked && d.predators.length >= 3;
      return `<label class="check-row ${capReached ? 'disabled' : ''}">
        <input type="checkbox" data-predator="${esc(p.name)}" ${checked ? 'checked' : ''} ${capReached ? 'disabled' : ''}>
        ${esc(p.name)} <span class="text-muted">(${p.species ? esc(p.species) : 'species unknown'})</span>
      </label>`;
    }).join('');

    wizardRoot.innerHTML = `
      <div class="modal-backdrop" id="wizard-backdrop">
        <div class="modal-card">
          <h2>Set up your game</h2>
          <p class="modal-sub">Answer what you know — reopen this anytime from the ⚙ Setup button.</p>

          <div class="modal-field">
            <label>Players</label>
            ${pillRow(playerPills)}
          </div>

          <div class="modal-field">
            <label>Eggspansion pack?</label>
            ${pillRow(expansionPills)}
          </div>

          <div class="modal-field">
            <label>Difficulty</label>
            ${pillRow(difficultyPills)}
          </div>

          <div class="modal-field">
            <label>Known predators <span class="modal-optional">(optional — pick up to 3 if the board's already set up)</span></label>
            <div class="predator-check-list">${predatorList}</div>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" id="wizard-skip" type="button">Skip for now</button>
            <button class="btn-primary" id="wizard-submit" type="button">Show My Options</button>
          </div>
        </div>
      </div>`;

    wizardRoot.querySelectorAll('[data-players]').forEach(el => {
      el.addEventListener('click', () => { if (!el.disabled) { d.players = Number(el.dataset.players); render(); } });
    });
    wizardRoot.querySelectorAll('[data-expansion]').forEach(el => {
      el.addEventListener('click', () => {
        d.expansion = el.dataset.expansion === 'yes';
        if (!d.expansion) {
          if (d.players === 6) d.players = 5;
          d.predators = d.predators.filter(name => {
            const p = DATA.predators.find(x => x.name === name);
            return p && p.expansion !== 'Eggspansion';
          });
        }
        render();
      });
    });
    wizardRoot.querySelectorAll('[data-difficulty]').forEach(el => {
      el.addEventListener('click', () => { d.difficulty = Number(el.dataset.difficulty); render(); });
    });
    wizardRoot.querySelectorAll('[data-predator]').forEach(el => {
      el.addEventListener('change', () => {
        const name = el.dataset.predator;
        if (el.checked) { if (d.predators.length < 3) d.predators.push(name); else el.checked = false; }
        else { d.predators = d.predators.filter(n => n !== name); }
        render();
      });
    });
    const skipBtn = document.getElementById('wizard-skip');
    if (skipBtn) skipBtn.addEventListener('click', () => { state.wizardOpen = false; render(); });
    const submitBtn = document.getElementById('wizard-submit');
    if (submitBtn) submitBtn.addEventListener('click', () => {
      saveSetup({ ...d, predators: [...d.predators] });
      state.wizardOpen = false;
      state.tab = 'strategy';
      state.strategySection = 'teams';
      [...tabbar.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'strategy'));
      render();
    });
    const backdrop = document.getElementById('wizard-backdrop');
    if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { state.wizardOpen = false; render(); } });
  }

  // ---------------------------------------------------------------------
  function render() {
    const wasSearchFocused = document.activeElement && document.activeElement.id === 'search';
    updateProgress();

    let html;
    if (state.tab === 'strategy') {
      const { nav, body, searchable } = renderStrategy();
      html = `
        ${STRAT ? `<div class="legend">${esc(STRAT.legend)}</div>` : ''}
        ${nav}
        ${searchable ? `<input type="text" class="searchbar" id="search" placeholder="Search…" value="${esc(state.search)}">` : ''}
        <div id="list">${body}</div>`;
    } else {
      const searchPlaceholder = { chickens: 'Search chickens & abilities…', predators: 'Search predators & effects…', weather: 'Search weather cards…' }[state.tab];
      let body = '';
      if (state.tab === 'chickens') body = renderChickens();
      else if (state.tab === 'predators') body = renderPredators();
      else body = renderWeather();
      html = `
        <input type="text" class="searchbar" id="search" placeholder="${searchPlaceholder}" value="${esc(state.search)}">
        <div id="list">${body}</div>`;
    }

    appEl.innerHTML = html;

    const search = document.getElementById('search');
    if (search) {
      search.addEventListener('input', (e) => { state.search = e.target.value; render(); });
      if (wasSearchFocused) {
        search.focus({ preventScroll: true });
        search.setSelectionRange(state.search.length, state.search.length);
      }
    }

    appEl.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.toggle;
        if (state.openCards.has(key)) state.openCards.delete(key);
        else state.openCards.add(key);
        render();
      });
    });

    appEl.querySelectorAll('.stage-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.dataset.strat) {
          state.strategySection = el.dataset.strat;
          state.search = '';
          render();
          return;
        }
        const key = el.dataset.key;
        state.openStage[key] = Number(el.dataset.stage);
        render();
      });
    });

    appEl.querySelectorAll('[data-myteam]').forEach(el => {
      el.addEventListener('change', () => {
        const name = el.dataset.myteam;
        state.myTeam = el.checked ? [...state.myTeam, name] : state.myTeam.filter(n => n !== name);
        render();
      });
    });

    appEl.querySelectorAll('[data-compare]').forEach(el => {
      el.addEventListener('change', () => {
        if (el.dataset.compare === 'a') state.compareA = el.value; else state.compareB = el.value;
        render();
      });
    });

    renderWizard();
  }

  state.setup = loadSetup();
  state.wizardDraft = state.setup ? { ...state.setup, predators: [...state.setup.predators] } : defaultDraft();
  if (!state.setup) state.wizardOpen = true;
  render();
})();
