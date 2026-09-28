(() => {
  const MAX_GUESSES = 6;
  const MAX_LENGTH = 12;
  const EPOCH = new Date(2026, 8, 27); // puzzle #1
  const NS = 'http://www.w3.org/2000/svg';
  const LEAF = 'M0 0C3-5 9-6.5 14-4.5C10.5 1 5 3 0 0Z';
  const TIP = 'M3 0L-7-5.5Q-4 0-7 5.5Z';

  const $ = id => document.getElementById(id);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
  };

  let data, FIVE, LONG;
  let practice = null;     // puzzle index while practising, null for the daily
  let game;
  let entry = [];
  let fresh = new Set();   // links discovered by the latest guess, to animate
  let hideDead = store.get('vines:hideDead', false);
  let geom;                // letter -> {x, y, angle}

  function dayIndex(date = new Date()) {
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((midnight - EPOCH) / 864e5);
  }

  function decode(puzzle) {
    const [ring, key] = puzzle.split(':');
    return { ring, target: [...key].map(c => ring[+c]).join('') };
  }

  const dailyKey = day => `vines:daily:${day}`;

  // ---------- game state ----------

  function load() {
    const list = data.puzzles;
    const day = dayIndex();
    const idx = practice ?? ((day % list.length) + list.length) % list.length;
    const { ring, target } = decode(list[idx]);
    const saved = practice === null ? store.get(dailyKey(day), null) : null;
    const ok = saved && saved.ring === ring;
    game = {
      ring, target, day,
      order: ok && saved.order ? saved.order : shuffle([...ring]),
      guesses: ok ? saved.guesses : [],
      status: ok ? saved.status : 'playing',
      counted: ok ? !!saved.counted : false,
    };
    entry = [];
    fresh = new Set();
    buildRing();
    renderAll();
  }

  function save() {
    if (practice !== null) return;
    const { ring, order, guesses, status, counted } = game;
    store.set(dailyKey(game.day), { ring, order, guesses, status, counted });
  }

  const pairsOf = w => Array.from({ length: w.length - 1 }, (_, i) => w[i] + w[i + 1]);

  function links(guesses = game.guesses) {
    const map = new Map();
    for (const g of guesses) {
      if (g.length !== 5) continue;
      for (const pair of pairsOf(g)) map.set(pair, game.target.includes(pair));
    }
    return map;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- ring ----------

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildRing() {
    const svg = $('ring');
    svg.innerHTML = '';
    svg.classList.toggle('hide-dead', hideDead);
    const n = game.order.length;
    const i = Math.min(Math.max(n - 5, 0), 4);
    const R = [118, 126, 132, 136, 138][i];
    const r = [34, 32, 30, 29, 27][i];
    geom = { r, R, pos: {} };
    game.order.forEach((letter, k) => {
      const angle = -Math.PI / 2 + (k * 2 * Math.PI) / n;
      geom.pos[letter] = { x: 200 + R * Math.cos(angle), y: 200 + R * Math.sin(angle), angle };
    });

    el('circle', { class: 'halo', cx: 200, cy: 200, r: R }, svg);
    el('g', { id: 'dead-vines', class: 'dead-group' }, svg);
    el('g', { id: 'live-vines' }, svg);
    el('g', { id: 'answer-vines' }, svg);
    const nodes = el('g', { id: 'nodes' }, svg);
    el('g', { id: 'flowers' }, svg);

    for (const letter of game.order) {
      const { x, y } = geom.pos[letter];
      const g = el('g', { class: 'node', 'data-letter': letter, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, role: 'button', 'aria-label': letter.toUpperCase() }, nodes);
      el('circle', { r }, g);
      el('text', { y: 1 }, g).textContent = letter;
      g.addEventListener('pointerdown', () => g.classList.add('pressed'));
      const release = () => g.classList.remove('pressed');
      g.addEventListener('pointerleave', release);
      g.addEventListener('pointercancel', release);
      g.addEventListener('pointerup', () => { release(); type(letter); });
    }
    drawVines();
  }

  // Every vine is a cubic Bézier {p0, c1, c2, p3}.
  function curve(a, b) {
    const pa = geom.pos[a], pb = geom.pos[b];
    if (a === b) {
      // A doubled letter: a loop out from the letter and back into it.
      const { angle } = pa;
      const on = (da, dist) => ({ x: pa.x + dist * Math.cos(angle + da), y: pa.y + dist * Math.sin(angle + da) });
      return { p0: on(-0.45, geom.r + 2), c1: on(-0.8, geom.r + 56), c2: on(0.8, geom.r + 56), p3: on(0.45, geom.r + 5) };
    }
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const d = Math.hypot(dx, dy);
    // Bend to the left of the direction of travel, so A→B and B→A never overlap.
    // A bend toward the centre can be generous; one outward stays shallow so it
    // doesn't run under the letters between A and B.
    const nx = dy / d, ny = -dx / d;
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const inward = nx * (200 - mx) + ny * (200 - my) > 0;
    const k = d * (inward ? 0.22 : 0.05);
    const c = { x: mx + nx * k, y: my + ny * k };
    const trim = (p, dist) => {
      const vx = c.x - p.x, vy = c.y - p.y, l = Math.hypot(vx, vy);
      return { x: p.x + (vx / l) * dist, y: p.y + (vy / l) * dist };
    };
    const p0 = trim(pa, geom.r + 3), p3 = trim(pb, geom.r + 6);
    const lerp = (p, t) => ({ x: p.x + (c.x - p.x) * t, y: p.y + (c.y - p.y) * t });
    return { p0, c1: lerp(p0, 2 / 3), c2: lerp(p3, 2 / 3), p3 };
  }
  const at = (q, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * q.p0.x + b * q.c1.x + c * q.c2.x + d * q.p3.x, y: a * q.p0.y + b * q.c1.y + c * q.c2.y + d * q.p3.y };
  };
  const heading = (q, t) => {
    const u = 1 - t;
    const f = k => 3 * u * u * (q.c1[k] - q.p0[k]) + 6 * u * t * (q.c2[k] - q.c1[k]) + 3 * t * t * (q.p3[k] - q.c2[k]);
    return (Math.atan2(f('y'), f('x')) * 180) / Math.PI;
  };
  const fmt = p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const pathD = q => `M${fmt(q.p0)}C${fmt(q.c1)} ${fmt(q.c2)} ${fmt(q.p3)}`;
  const place = (q, t, turn = 0, scale = 1) => {
    const p = at(q, t);
    return `translate(${fmt(p)}) rotate(${(heading(q, t) + turn).toFixed(1)}) scale(${scale})`;
  };

  function drawVine(parent, a, b, kind, delay = 0, animate = false) {
    const q = curve(a, b);
    const g = el('g', {}, parent);
    // Withered vines keep their own dash pattern, so they fade in rather than grow.
    const motion = animate ? (kind === 'dead' ? ' fade' : ' grow') : '';
    const path = el('path', { class: `vine ${kind}${motion}`, d: pathD(q) }, g);
    if (kind !== 'dead') path.setAttribute('pathLength', 1);
    if (animate) path.style.animationDelay = `${delay}s`;
    const extras = [];
    if (kind === 'live') {
      extras.push(el('path', { class: 'leaf', d: LEAF, transform: place(q, 0.3, -55) }, g));
      extras.push(el('path', { class: 'leaf dark', d: LEAF, transform: place(q, 0.56, 55) }, g));
      extras.push(el('path', { class: 'tip', d: TIP, transform: place(q, 1) }, g));
    } else {
      extras.push(el('path', { class: `tip ${kind}`, d: TIP, transform: place(q, 1, 0, kind === 'dead' ? 0.75 : 1.1) }, g));
    }
    if (animate) {
      extras.forEach((x, i) => { x.classList.add('pop'); x.style.animationDelay = `${delay + 0.35 + i * 0.18}s`; });
    }
  }

  function drawVines() {
    const dead = $('dead-vines'), live = $('live-vines'), answer = $('answer-vines'), flowers = $('flowers');
    dead.innerHTML = live.innerHTML = answer.innerHTML = flowers.innerHTML = '';
    let i = 0;
    for (const [pair, alive] of links()) {
      const animate = fresh.has(pair);
      drawVine(alive ? live : dead, pair[0], pair[1], alive ? 'live' : 'dead', animate ? 0.15 * i++ : 0, animate);
    }
    if (game.status !== 'playing') drawAnswer();
  }

  function drawAnswer() {
    const animate = fresh.has('*answer');
    [...new Set(pairsOf(game.target))].forEach((pair, i) =>
      drawVine($('answer-vines'), pair[0], pair[1], 'answer', 0.3 + i * 0.28, animate));
    if (game.status !== 'won') return;
    game.order.forEach((letter, i) => {
      const { angle } = geom.pos[letter];
      const d = geom.R - geom.r + 3;
      const f = el('g', { class: 'flower', transform: `translate(${(200 + d * Math.cos(angle)).toFixed(1)} ${(200 + d * Math.sin(angle)).toFixed(1)})` }, $('flowers'));
      if (animate) f.style.animationDelay = `${2 + i * 0.12}s`;
      for (let p = 0; p < 5; p++) {
        const a = (p * 72 * Math.PI) / 180;
        el('circle', { class: 'petal', cx: (5 * Math.cos(a)).toFixed(1), cy: (5 * Math.sin(a)).toFixed(1), r: 4.4 }, f);
      }
      el('circle', { class: 'heart', r: 3 }, f);
    });
  }

  function updateNodes() {
    const over = game.status !== 'playing';
    document.querySelectorAll('#nodes .node').forEach(g => {
      g.classList.toggle('active', !over && entry.includes(g.dataset.letter));
      g.classList.toggle('bloom', over);
    });
  }

  // ---------- input ----------

  function type(letter) {
    if (game.status !== 'playing' || entry.length >= MAX_LENGTH) return;
    entry.push(letter);
    renderEntry(true);
    updateNodes();
  }

  function del() {
    if (!entry.length) return;
    entry.pop();
    renderEntry();
    updateNodes();
  }

  function reject(msg) {
    toast(msg);
    const e = $('entry');
    e.classList.remove('shake');
    void e.offsetWidth;
    e.classList.add('shake');
  }

  function submit() {
    if (game.status !== 'playing') return;
    const word = entry.join('');
    const left = MAX_GUESSES - game.guesses.length;

    if (word.length === 5) {
      if (left === 1) return reject('Last guess: it has to be the word itself');
      if (game.guesses.includes(word)) return reject('Already grown');
      if (!FIVE.has(word)) return reject('Not in the word list');
      const before = links();
      game.guesses.push(word);
      const after = links();
      fresh = new Set([...after.keys()].filter(p => !before.has(p)));
      const grew = [...fresh].filter(p => after.get(p)).length;
      toast(grew ? `${grew} new vine${grew > 1 ? 's' : ''} grew` : fresh.size ? 'Nothing new grew' : 'No new pairs there');
    } else if (word.length > 5) {
      if (game.order.some(c => !word.includes(c))) return reject('The word uses every letter on the ring');
      if (game.guesses.includes(word)) return reject('Already tried that one');
      if (!LONG.has(word)) return reject('Not in the word list');
      game.guesses.push(word);
      fresh = new Set();
      if (word === game.target) game.status = 'won';
      else if (game.guesses.length >= MAX_GUESSES) game.status = 'lost';
      else toast('Not it');
    } else {
      return reject('5 letters grow vines · longer words guess the answer');
    }

    entry = [];
    if (game.status !== 'playing') {
      fresh.add('*answer');
      finish();
    }
    save();
    drawVines();
    renderAll();
    if (game.status !== 'playing') setTimeout(() => openStats(), 2800);
  }

  function finish() {
    if (practice !== null || game.counted) return;
    game.counted = true;
    const s = store.get('vines:stats', { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: null });
    s.played++;
    if (game.status === 'won') {
      s.won++;
      s.dist[game.guesses.length - 1]++;
      s.streak = s.last === game.day - 1 ? s.streak + 1 : 1;
      s.best = Math.max(s.best, s.streak);
      s.last = game.day;
    } else {
      s.streak = 0;
      s.last = null;
    }
    store.set('vines:stats', s);
  }

  // ---------- rendering ----------

  function renderAll() {
    renderStatus();
    renderEntry();
    renderHistory();
    updateNodes();
    $('practice-btn').textContent = practice === null ? 'Practice puzzle' : 'New practice puzzle';
    $('today-btn').hidden = practice === null;
    $('wither-btn').setAttribute('aria-pressed', hideDead);
    $('enter-btn').disabled = game.status !== 'playing';
  }

  function leafIcon(used) {
    return `<svg viewBox="0 0 32 32" class="${used ? 'used' : ''}"><path d="M6 26C10 14 18 8 27 6c-2 9-8 17-20 20z"/><path class="vein" d="M6 26C12 20 17 15 22 11"/></svg>`;
  }

  function renderStatus() {
    $('puzzle-label').innerHTML = practice === null ? `<b>Puzzle #${game.day + 1}</b>` : '<b>Practice</b>';
    const used = game.guesses.length;
    $('budget').innerHTML = Array.from({ length: MAX_GUESSES }, (_, i) => leafIcon(i < used)).join('');
    $('budget').setAttribute('aria-label', `${MAX_GUESSES - used} guesses left`);
  }

  function connector(a, b, known) {
    if (!a || !b) return '<span class="link"></span>';
    const state = known.get(a + b);
    return `<span class="link ${state === true ? 'live' : state === false ? 'dead' : ''}"></span>`;
  }

  function renderEntry(popLast = false) {
    const known = links();
    const slots = Math.max(5, entry.length);
    let html = '';
    for (let i = 0; i < slots; i++) {
      if (i > 0) html += connector(entry[i - 1], entry[i], known);
      const filled = i < entry.length;
      const pop = popLast && i === entry.length - 1 ? ' pop-in' : '';
      html += `<span class="slot${i >= 5 ? ' answer-slot' : ''}${filled ? ' filled' + pop : ''}">${filled ? entry[i] : ''}</span>`;
    }
    const e = $('entry');
    e.innerHTML = html;
    e.style.setProperty('--n', Math.max(7, slots));

    const left = MAX_GUESSES - game.guesses.length;
    let hint;
    if (game.status === 'won') hint = 'Solved. Come back tomorrow for a new one.';
    else if (game.status === 'lost') hint = `The word was ${game.target.toUpperCase()}.`;
    else if (left === 1) hint = 'Last guess: it has to be the word itself';
    else if (entry.length === 5) hint = 'Enter to grow vines';
    else if (entry.length > 5) hint = 'Enter to guess the word';
    else hint = '5 letters grow vines · longer words guess the answer';
    $('entry-hint').textContent = hint;
  }

  function rowHTML(word, i, known) {
    let tiles = '';
    if (word.length === 5) {
      for (let j = 0; j < 5; j++) {
        if (j) tiles += connector(word[j - 1], word[j], known);
        tiles += `<span class="tile">${word[j]}</span>`;
      }
      return `<div class="row"><span class="num">${i + 1}</span>${tiles}<span class="end"></span></div>`;
    }
    const win = word === game.target;
    for (let j = 0; j < word.length; j++) {
      if (j) tiles += '<span class="link"></span>';
      tiles += `<span class="tile">${word[j]}</span>`;
    }
    return `<div class="row answer${win ? ' win' : ''}" style="--n:${Math.max(7, word.length)}"><span class="num">${i + 1}</span>${tiles}<span class="end">${win ? '✿' : '✗'}</span></div>`;
  }

  function renderHistory() {
    const known = links();
    $('history').innerHTML = game.guesses.length
      ? game.guesses.map((w, i) => rowHTML(w, i, known)).join('')
      : '<p class="history-empty">Your guesses will grow here.</p>';
  }

  // ---------- stats & sharing ----------

  function openStats() {
    const s = store.get('vines:stats', { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] });
    const over = game.status !== 'playing';
    const vines = [...links().values()].filter(Boolean).length;
    let result = '';
    if (game.status === 'won') {
      const n = game.guesses.length;
      const words = ['Perfect bloom', 'Magnificent', 'In full bloom', 'Flourishing', 'Growing nicely', 'Just in time'];
      result = `<div class="result"><h2>${words[n - 1]}</h2><div class="answer-word">${game.target}</div><p>Solved in ${n} of ${MAX_GUESSES} · ${vines} vine${vines === 1 ? '' : 's'} grown</p></div>`;
    } else if (game.status === 'lost') {
      result = `<div class="result"><h2>Withered</h2><p>The word was</p><div class="answer-word">${game.target}</div></div>`;
    }
    $('result').innerHTML = result;
    const pct = s.played ? Math.round((100 * s.won) / s.played) : 0;
    $('stat-row').innerHTML = [[s.played, 'Played'], [pct, 'Win %'], [s.streak, 'Streak'], [s.best, 'Best']]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const top = Math.max(1, ...s.dist);
    const hit = game.status === 'won' && practice === null ? game.guesses.length : 0;
    $('dist').innerHTML = s.dist.map((v, i) =>
      `<div class="bar${hit === i + 1 ? ' hit' : ''}"><span>${i + 1}</span><div style="width:${Math.max(8, (100 * v) / top)}%">${v}</div></div>`).join('');
    $('share-row').hidden = !over;
    $('share-btn').textContent = practice === null ? 'Share' : 'Share result';
    tickCountdown();
    $('stats').showModal();
    if (over) $('share-btn').focus();
  }

  function tickCountdown() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let s = Math.max(0, Math.floor((next - now) / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    s = String(s % 60).padStart(2, '0');
    $('countdown').textContent = `${h}:${m}:${s}`;
  }
  setInterval(() => { if ($('stats').open) tickCountdown(); }, 1000);

  function shareText() {
    const score = game.status === 'won' ? game.guesses.length : 'X';
    const title = practice === null ? `Vines #${game.day + 1}` : 'Vines practice';
    const lines = game.guesses.map(w => {
      if (w.length !== 5) return w === game.target ? '🌸' : '❌';
      return pairsOf(w).map(p => game.target.includes(p) ? '🟩' : '🟫').join('');
    });
    return `${title} · ${score}/${MAX_GUESSES}\n${lines.join('\n')}\n${location.origin}${location.pathname}`;
  }

  async function share() {
    const text = shareText();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Couldn\'t copy. Try again?');
    }
  }

  let toastTimer;
  function toast(msg, ms = 1700) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- help example ----------

  function renderExample() {
    const word = 'banal', target = 'balloon';
    let html = '';
    for (let j = 0; j < 5; j++) {
      if (j) html += `<span class="link ${target.includes(word[j - 1] + word[j]) ? 'live' : 'dead'}"></span>`;
      html += `<span class="tile">${word[j]}</span>`;
    }
    $('example').innerHTML = html;
  }

  // ---------- wiring ----------

  function wire() {
    $('del-btn').addEventListener('click', del);
    $('enter-btn').addEventListener('click', submit);
    $('shuffle-btn').addEventListener('click', () => {
      const old = game.order.join('');
      do shuffle(game.order); while (game.order.join('') === old);
      fresh = new Set();
      save();
      buildRing();
      updateNodes();
    });
    $('wither-btn').addEventListener('click', () => {
      hideDead = !hideDead;
      store.set('vines:hideDead', hideDead);
      $('ring').classList.toggle('hide-dead', hideDead);
      $('wither-btn').setAttribute('aria-pressed', hideDead);
      toast(hideDead ? 'Withered vines hidden' : 'Withered vines shown', 1100);
    });
    $('help-btn').addEventListener('click', () => $('help').showModal());
    $('stats-btn').addEventListener('click', openStats);
    $('share-btn').addEventListener('click', share);
    $('practice-btn').addEventListener('click', () => {
      const list = data.puzzles;
      const today = ((dayIndex() % list.length) + list.length) % list.length;
      let idx;
      do idx = Math.floor(Math.random() * list.length); while (idx === today || idx === practice);
      practice = idx;
      load();
    });
    $('today-btn').addEventListener('click', () => { practice = null; load(); });

    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); del(); }
      else if (/^[a-z]$/i.test(e.key)) {
        const letter = e.key.toLowerCase();
        if (game.status !== 'playing') return;
        if (game.order.includes(letter)) type(letter);
        else toast(`${letter.toUpperCase()} isn't on the ring`, 1000);
      }
    });

    // Close a dialog by clicking its backdrop.
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
      if (e.target === d) d.close();
    }));

    // A new day may have started while the tab sat open.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && practice === null && game && game.day !== dayIndex()) load();
    });
  }

  async function start() {
    wire();
    renderExample();
    const res = await fetch('data/vines.json?v=3');
    data = await res.json();
    FIVE = new Set(data.five.split(' '));
    LONG = new Set(data.long.split(' '));
    load();
    // The rules changed, so show them again even to people who saw the old ones.
    if (!store.get('vines:seen-v3', false)) {
      store.set('vines:seen-v3', true);
      $('help').showModal();
    }
  }

  start();
})();
