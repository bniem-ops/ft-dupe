(function () {
  const DATA = window.FLOCK_DATA || { chickens: [], predators: [], weather: { seasons: {}, eggspansion: [], unsorted: [] } };

  const state = { tab: 'chickens', search: '', openCards: new Set(), openStage: {} };

  const appEl = document.getElementById('app');
  const progressEl = document.getElementById('progress');
  const tabbar = document.getElementById('tabbar');

  tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.search = ''; // search is scoped to whichever tab/section is showing
    [...tabbar.children].forEach(t => t.classList.toggle('active', t === btn));
    render();
  });

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
    if (!STRAT) return `<div class="empty-state">Strategy data not loaded.</div>`;
    let out = STRAT.teamComps.map(tc => staticCard(`
        <div class="ability">
          <div class="aname">${tc.players} Player${tc.players > 1 ? 's' : ''}</div>
          <div class="atext">${esc(tc.philosophy)}</div>
          ${roleChips(tc.picks)}
        </div>`)).join('');

    out += `<div class="section-title">Just for fun</div>`;
    const fs = STRAT.funSquad;
    out += staticCard(`
        <div class="ability">
          <div class="aname">${esc(fs.title)}</div>
          <div class="atext">${esc(fs.philosophy)}</div>
          ${roleChips(fs.picks)}
        </div>`);
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
      { key: 'archetypes', label: 'Archetypes' },
      { key: 'matchups', label: 'Predator Guide' },
      { key: 'teams', label: 'Team Comps' },
      { key: 'combos', label: 'Combos' },
    ];
    const active = state.strategySection || 'archetypes';
    const nav = `<div class="stage-tabs">${sections.map(s => `<button class="stage-tab ${s.key === active ? 'active' : ''}" data-strat="${s.key}">${esc(s.label)}</button>`).join('')}</div>`;

    let body = '';
    if (active === 'archetypes') body = renderArchetypes();
    else if (active === 'matchups') body = renderMatchups();
    else if (active === 'teams') body = renderTeamComps();
    else body = renderCombos();

    return { nav, body, searchable: active !== 'teams' };
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
  }

  render();
})();
