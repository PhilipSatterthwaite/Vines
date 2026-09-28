(() => {
  const MAX_GUESSES = 6;
  const EPOCH = new Date(2026, 8, 27); // puzzle #1
  const NS = 'http://www.w3.org/2000/svg';
  const LEAF = 'M0 0C3-5 9-6.5 14-4.5C10.5 1 5 3 0 0Z';
  const KEYS = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];

  const $ = id => document.getElementById(id);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
  };

  let data, FIVE;
  let practice = null;     // puzzle index while practising, null for the daily
  let game;
  let entry = [];

  function dayIndex(date = new Date()) {
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((midnight - EPOCH) / 864e5);
  }

  const reveal = hidden => [...atob(hidden)].reverse().join('');
  const dailyKey = day => `vines:clue:${day}`;
  const STATS_KEY = 'vines:clue:stats';

  // ---------- game state ----------

  function load() {
    const list = data.puzzles;
    const day = dayIndex();
    const idx = practice ?? ((day % list.length) + list.length) % list.length;
    const [clue, hidden] = list[idx];
    const answer = reveal(hidden);
    const saved = practice === null ? store.get(dailyKey(day), null) : null;
    const ok = saved && saved.answer === hidden;
    game = {
      clue, answer, hidden, day,
      guesses: ok ? saved.guesses : [],
      status: ok ? saved.status : 'playing',
      counted: ok ? !!saved.counted : false,
    };
    entry = [];
    renderAll();
    requestAnimationFrame(() => drawVines());
  }

  function save() {
    if (practice !== null) return;
    const { hidden, guesses, status, counted } = game;
    store.set(dailyKey(game.day), { answer: hidden, guesses, status, counted });
  }

  // Every place a pair from this guess sits in the answer: j is the pair's
  // position in the guess, i its position in the answer.
  function matches(guess) {
    const out = [];
    for (let j = 0; j < 4; j++) {
      const pair = guess[j] + guess[j + 1];
      for (let i = game.answer.indexOf(pair); i >= 0; i = game.answer.indexOf(pair, i + 1)) out.push({ j, i });
    }
    return out;
  }

  // The vines each guess actually grows: a place in the answer that an earlier
  // guess already reached doesn't get a second vine.
  function newVines(guesses = game.guesses) {
    const grown = new Set();
    return guesses.map(g => matches(g).filter(({ i }) => !grown.has(i) && grown.add(i)));
  }

  function revealed(guesses = game.guesses) {
    const set = new Set();
    for (const g of guesses) for (const { i } of matches(g)) { set.add(i); set.add(i + 1); }
    return set;
  }

  const pairLive = (guess, j) => game.answer.includes(guess[j] + guess[j + 1]);
  // How each tile of a guess is coloured: 'vined' if it's part of a pair that
  // grew a vine, 'present' if the letter is in the answer but grew no vine, or
  // ''. Like Wordle, each letter in the answer accounts for one coloured tile at
  // most: vined tiles use up their letters first, and yellow gets what's left,
  // left to right.
  function tileStates(guess, answer = game.answer) {
    const live = j => j >= 0 && j < 4 && answer.includes(guess[j] + guess[j + 1]);
    const states = [...guess].map((_, j) => live(j - 1) || live(j) ? 'vined' : '');
    const left = {};
    for (const c of answer) left[c] = (left[c] || 0) + 1;
    states.forEach((st, j) => { if (st) left[guess[j]]--; });
    states.forEach((st, j) => {
      if (!st && left[guess[j]] > 0) { states[j] = 'present'; left[guess[j]]--; }
    });
    return states;
  }

  // ---------- rendering ----------

  function renderAll(arrivals = new Map()) {
    renderStatus();
    $('clue-text').textContent = game.clue;
    $('clue-len').textContent = `(${game.answer.length})`;
    renderAnswer(arrivals);
    renderGrid();
    renderKeyboard();
    $('practice-btn').textContent = practice === null ? 'Practice puzzle' : 'New practice puzzle';
    $('today-btn').hidden = practice === null;
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

  // arrivals: answer position -> seconds until its vine reaches it.
  function renderAnswer(arrivals = new Map(), bloomNow = false) {
    const shown = revealed();
    const box = $('answer');
    box.style.setProperty('--n', game.answer.length);
    box.innerHTML = [...game.answer].map((letter, i) => {
      if (game.status === 'won') {
        const style = bloomNow ? ` style="animation-delay:${(i * 0.08).toFixed(2)}s"` : ' style="animation:none"';
        return `<span class="tile bloom"${style}>${letter}</span>`;
      }
      if (shown.has(i)) {
        const t = arrivals.get(i);
        return `<span class="tile filled${t !== undefined ? ' arrive' : ''}"${t !== undefined ? ` style="animation-delay:${t.toFixed(2)}s"` : ''}>${letter}</span>`;
      }
      if (game.status === 'lost') return `<span class="tile missed">${letter}</span>`;
      return '<span class="tile"></span>';
    }).join('');
  }

  function linkHTML(guess, j) {
    return `<span class="link ${pairLive(guess, j) ? 'live' : 'dead'}"></span>`;
  }

  function renderGrid() {
    let html = '';
    for (let r = 0; r < MAX_GUESSES; r++) {
      const guess = game.guesses[r];
      if (guess) {
        let row = '';
        const states = tileStates(guess);
        for (let j = 0; j < 5; j++) {
          if (j) row += linkHTML(guess, j - 1);
          row += `<span class="tile ${states[j]}">${guess[j]}</span>`;
        }
        html += `<div class="row done" data-row="${r}">${row}</div>`;
      } else if (r === game.guesses.length && game.status === 'playing') {
        let row = '';
        for (let j = 0; j < 5; j++) {
          if (j) row += '<span class="link"></span>';
          row += `<span class="tile${j < entry.length ? ' filled' : ''}">${entry[j] ?? ''}</span>`;
        }
        html += `<div class="row current" id="current-row">${row}</div>`;
      } else {
        html += `<div class="row empty">${'<span class="tile"></span><span class="link"></span>'.repeat(4)}<span class="tile"></span></div>`;
      }
    }
    $('grid').innerHTML = html;
  }

  function renderCurrentRow() {
    const row = $('current-row');
    if (!row) return;
    row.querySelectorAll('.tile').forEach((tile, j) => {
      tile.textContent = entry[j] ?? '';
      tile.classList.toggle('filled', j < entry.length);
    });
  }

  // Guessed letters turn green on the keyboard if they're in the answer, grey if not.
  function renderKeyboard() {
    const tried = new Set(game.guesses.join(''));
    document.querySelectorAll('.key[data-key]').forEach(key => {
      const k = key.dataset.key;
      const guessed = k.length === 1 && tried.has(k);
      key.classList.toggle('hit', guessed && game.answer.includes(k));
      key.classList.toggle('absent', guessed && !game.answer.includes(k));
    });
  }

  // ---------- vines ----------

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Draws every vine; the ones from row animateRow grow in.
  function drawVines(animateRow = -1) {
    const svg = $('vines');
    const board = $('board').getBoundingClientRect();
    svg.setAttribute('width', board.width);
    svg.setAttribute('height', board.height);
    svg.innerHTML = '';
    const answerTiles = $('answer').children;
    const rel = r => ({ left: r.left - board.left, right: r.right - board.left, top: r.top - board.top, bottom: r.bottom - board.top });

    const vines = newVines();
    game.guesses.forEach((guess, r) => {
      const row = document.querySelector(`.row[data-row="${r}"]`);
      if (!row) return;
      const links = row.querySelectorAll('.link');
      const rowTop = rel(row.getBoundingClientRect()).top;
      vines[r].forEach(({ j, i }, k) => {
        const link = rel(links[j].getBoundingClientRect());
        const a = rel(answerTiles[i].getBoundingClientRect());
        const b = rel(answerTiles[i + 1].getBoundingClientRect());
        const start = { x: (link.left + link.right) / 2, y: rowTop + 6 };
        const end = { x: (a.right + b.left) / 2, y: a.bottom - 4 };
        const dy = start.y - end.y;
        const q = { p0: start, c1: { x: start.x, y: start.y - dy * 0.55 }, c2: { x: end.x, y: end.y + dy * 0.45 }, p3: end };
        const animate = r === animateRow;
        const delay = 0.15 * k;
        drawVine(svg, q, animate, delay, (r + k) % 2 ? 1 : -1);
      });
    });
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

  function drawVine(svg, q, animate, delay, side) {
    const g = el('g', {}, svg);
    const path = el('path', { class: `vine${animate ? ' grow' : ''}`, d: `M${fmt(q.p0)}C${fmt(q.c1)} ${fmt(q.c2)} ${fmt(q.p3)}`, pathLength: 1 }, g);
    if (animate) path.style.animationDelay = `${delay}s`;
    [[0.3, 55 * side, 'leaf'], [0.55, -55 * side, 'leaf dark'], [0.8, 55 * side, 'leaf']].forEach(([t, turn, cls], n) => {
      const p = at(q, t);
      const leaf = el('path', { class: cls, d: LEAF, transform: `translate(${fmt(p)}) rotate(${(heading(q, t) + turn).toFixed(1)}) scale(.85)` }, g);
      if (animate) { leaf.classList.add('pop'); leaf.style.animationDelay = `${delay + 0.3 + n * 0.15}s`; }
    });
  }

  // ---------- input ----------

  function type(letter) {
    if (game.status !== 'playing' || entry.length >= 5) return;
    entry.push(letter);
    renderCurrentRow();
  }

  function del() {
    if (!entry.length) return;
    entry.pop();
    renderCurrentRow();
  }

  function reject(msg) {
    toast(msg);
    const row = $('current-row');
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function submit() {
    if (game.status !== 'playing') return;
    const word = entry.join('');
    if (word.length < 5) return reject('Guesses are 5 letters');
    if (game.guesses.includes(word)) return reject('Already guessed');
    if (!FIVE.has(word)) return reject('Not in the word list');

    const before = revealed();
    game.guesses.push(word);
    entry = [];
    const found = matches(word);
    const arrivals = new Map();
    const grown = newVines().at(-1);
    grown.forEach(({ i }, k) => {
      const t = 0.15 * k + 0.75;
      for (const p of [i, i + 1]) if (!before.has(p) && !arrivals.has(p)) arrivals.set(p, t);
    });

    if (revealed().size === game.answer.length) game.status = 'won';
    else if (game.guesses.length >= MAX_GUESSES) game.status = 'lost';

    const newLetters = arrivals.size;
    if (game.status === 'playing') {
      toast(newLetters ? `${newLetters} letter${newLetters > 1 ? 's' : ''} grew in`
        : grown.length ? 'New vines, but no new letters'
        : found.length ? 'Those vines were already grown'
        : 'Nothing took root');
    }

    finish();
    save();
    // Show the board as if play went on until the vines land; then bloom or reveal.
    const status = game.status;
    game.status = 'playing';
    renderAll(arrivals);
    game.status = status;
    requestAnimationFrame(() => drawVines(game.guesses.length - 1));

    if (status !== 'playing') {
      const landed = Math.max(0.9, ...arrivals.values()) + 0.6;
      setTimeout(() => {
        renderGrid();
        renderAnswer(new Map(), true);
        requestAnimationFrame(() => drawVines());
      }, landed * 1000);
      setTimeout(openStats, landed * 1000 + 1500);
    }
  }

  function finish() {
    if (game.status === 'playing' || practice !== null || game.counted) return;
    game.counted = true;
    const s = store.get(STATS_KEY, { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: null });
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
    store.set(STATS_KEY, s);
  }

  // ---------- stats & sharing ----------

  function openStats() {
    const s = store.get(STATS_KEY, { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] });
    const over = game.status !== 'playing';
    const clue = `<p class="result-clue">${escapeHTML(game.clue)}</p>`;
    let result = '';
    if (game.status === 'won') {
      const n = game.guesses.length;
      const words = ['Perfect bloom', 'Magnificent', 'In full bloom', 'Flourishing', 'Growing nicely', 'Just in time'];
      result = `<div class="result"><h2>${words[n - 1]}</h2><div class="answer-word">${game.answer}</div>${clue}<p>Grown in ${n} of ${MAX_GUESSES}</p></div>`;
    } else if (game.status === 'lost') {
      result = `<div class="result"><h2>Withered</h2><p>The word was</p><div class="answer-word">${game.answer}</div>${clue}</div>`;
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

  const escapeHTML = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    const lines = game.guesses.map(w => [0, 1, 2, 3].map(j => pairLive(w, j) ? '🟩' : '🟫').join(''));
    const shown = revealed();
    const top = [...game.answer].map((_, i) => shown.has(i) ? '🌸' : '▫️').join('');
    return `${title} · ${score}/${MAX_GUESSES}\n${top}\n${lines.join('\n')}\n${location.origin}${location.pathname}`;
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
    const answer = 'planter';
    const top = [...answer].map((c, i) => i >= 1 && i <= 4 ? `<span class="tile filled">${c}</span>` : '<span class="tile"></span>').join('');
    const row = guess => {
      const states = tileStates(guess, answer);
      let html = '';
      for (let j = 0; j < 5; j++) {
        if (j) html += `<span class="link ${answer.includes(guess[j - 1] + guess[j]) ? 'live' : 'dead'}"></span>`;
        html += `<span class="tile ${states[j]}">${guess[j]}</span>`;
      }
      return `<div class="row">${html}</div>`;
    };
    $('example').innerHTML = `<div class="answer">${top}</div><div class="arrow">↑ grown from</div>${row('slant')}`;
    $('example-2').innerHTML = row('prone');
  }

  // ---------- keyboard ----------

  function buildKeyboard() {
    $('keyboard').innerHTML = KEYS.map(row => `<div class="kb-row">${[...row].map(k => {
      if (k === '>') return '<button class="key wide enter" data-key="enter" tabindex="-1">Enter</button>';
      if (k === '<') return '<button class="key wide" data-key="del" aria-label="Delete" tabindex="-1"><svg viewBox="0 0 24 24"><path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg></button>';
      return `<button class="key" data-key="${k}" tabindex="-1">${k}</button>`;
    }).join('')}</div>`).join('');
    $('keyboard').addEventListener('click', e => {
      const key = e.target.closest('.key')?.dataset.key;
      if (!key) return;
      if (key === 'enter') submit();
      else if (key === 'del') del();
      else type(key);
    });
  }

  // ---------- wiring ----------

  function wire() {
    buildKeyboard();
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
      else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
    });

    // Close a dialog by clicking its backdrop.
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
      if (e.target === d) d.close();
    }));

    let resizeFrame;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => game && drawVines());
    });

    // A new day may have started while the tab sat open.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && practice === null && game && game.day !== dayIndex()) load();
    });
  }

  async function start() {
    wire();
    renderExample();
    const res = await fetch('data/vines.json?v=9');
    data = await res.json();
    FIVE = new Set(data.five.split(' '));
    await document.fonts?.ready;
    load();
    // The rules changed, so show them again even to people who saw the old ones.
    if (!store.get('vines:seen-clue', false)) {
      store.set('vines:seen-clue', true);
      $('help').showModal();
    }
  }

  start();
})();
