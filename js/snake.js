/* Rainbow Snake — colorful, configurable, touch + keyboard, pause/resume. */
(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const elScore = $('score');
  const elBest = $('best');
  const elCanvas = $('game');
  const elOverlay = $('overlay');
  const elOvTitle = $('ovTitle');
  const elOvSub = $('ovSub');
  const elStart = $('startBtn');
  const elPause = $('pauseBtn');
  const elReset = $('resetBtn');
  const ctx = elCanvas.getContext('2d');

  // ---------- state ----------
  const STATE = {
    size: 20,           // grid cells per side
    speed: 10,          // ticks per second
    difficulty: 'normal',
    wrap: false,
    rainbow: true,
    sound: false,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    foodKind: 0,        // 0=apple, 1=gold, 2=rainbow
    score: 0,
    best: Number(localStorage.getItem('snake_best') || 0),
    running: false,
    paused: false,
    dead: false,
    tickMs: 100,
    lastTick: 0,
    acc: 0,
    hueT: 0,
  };

  const DIFFICULTY_PRESETS = {
    easy:   { speed: 6,  scorePerFood: 1 },
    normal: { speed: 10, scorePerFood: 1 },
    hard:   { speed: 16, scorePerFood: 2 },
    insane: { speed: 24, scorePerFood: 3 },
  };

  // ---------- canvas sizing (HiDPI) ----------
  function fitCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const r = elCanvas.getBoundingClientRect();
    elCanvas.width = Math.max(2, Math.floor(r.width * dpr));
    elCanvas.height = Math.max(2, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', fitCanvas);

  // ---------- game logic ----------
  function reset() {
    STATE.snake = [
      { x: Math.floor(STATE.size / 2) - 1, y: Math.floor(STATE.size / 2) },
      { x: Math.floor(STATE.size / 2) - 2, y: Math.floor(STATE.size / 2) },
      { x: Math.floor(STATE.size / 2) - 3, y: Math.floor(STATE.size / 2) },
    ];
    STATE.dir = { x: 1, y: 0 };
    STATE.nextDir = { x: 1, y: 0 };
    STATE.score = 0;
    STATE.dead = false;
    STATE.paused = false;
    spawnFood();
    updateHUD();
    draw();
  }

  function spawnFood() {
    const free = [];
    const occ = new Set(STATE.snake.map(s => s.x + ',' + s.y));
    for (let x = 0; x < STATE.size; x++) {
      for (let y = 0; y < STATE.size; y++) {
        if (!occ.has(x + ',' + y)) free.push({ x, y });
      }
    }
    if (!free.length) { STATE.food = null; return; }
    STATE.food = free[Math.floor(Math.random() * free.length)];
    // 10% rainbow bonus, 15% gold double, 75% normal
    const r = Math.random();
    STATE.foodKind = r < 0.10 ? 2 : (r < 0.25 ? 1 : 0);
  }

  function setDir(x, y) {
    // disallow 180° reversal
    if (x === -STATE.dir.x && y === -STATE.dir.y) return;
    if (x === STATE.nextDir.x && y === STATE.nextDir.y) return;
    STATE.nextDir = { x, y };
    if (window.SFX) SFX.turn();
  }

  function step() {
    STATE.dir = STATE.nextDir;
    const head = STATE.snake[0];
    let nx = head.x + STATE.dir.x;
    let ny = head.y + STATE.dir.y;

    if (STATE.wrap) {
      nx = (nx + STATE.size) % STATE.size;
      ny = (ny + STATE.size) % STATE.size;
    } else if (nx < 0 || ny < 0 || nx >= STATE.size || ny >= STATE.size) {
      return die();
    }

    // self-collision
    for (let i = 0; i < STATE.snake.length - 1; i++) {
      if (STATE.snake[i].x === nx && STATE.snake[i].y === ny) return die();
    }

    STATE.snake.unshift({ x: nx, y: ny });

    // eat?
    if (STATE.food && nx === STATE.food.x && ny === STATE.food.y) {
      const mult = STATE.foodKind === 2 ? 3 : (STATE.foodKind === 1 ? 2 : 1);
      const base = DIFFICULTY_PRESETS[STATE.difficulty].scorePerFood;
      STATE.score += base * mult;
      if (window.SFX) SFX.eat();
      spawnFood();
    } else {
      STATE.snake.pop();
    }
  }

  function die() {
    STATE.dead = true;
    STATE.running = false;
    if (window.SFX) SFX.die();
    if (STATE.score > STATE.best) {
      STATE.best = STATE.score;
      localStorage.setItem('snake_best', String(STATE.best));
    }
    showOverlay('💀 你死了', `得分 ${STATE.score} · 最高 ${STATE.best}`, '再来一局');
  }

  // ---------- rendering ----------
  function cellPx() {
    const r = elCanvas.getBoundingClientRect();
    return Math.min(r.width, r.height) / STATE.size;
  }
  function origin() {
    const r = elCanvas.getBoundingClientRect();
    const c = cellPx();
    return { ox: (r.width - c * STATE.size) / 2, oy: (r.height - c * STATE.size) / 2, c };
  }

  function bgGradient() {
    const r = elCanvas.getBoundingClientRect();
    const g = ctx.createLinearGradient(0, 0, r.width, r.height);
    g.addColorStop(0, '#10173a');
    g.addColorStop(1, '#0a0f25');
    return g;
  }

  function drawGrid({ ox, oy, c }) {
    ctx.fillStyle = bgGradient();
    ctx.fillRect(0, 0, elCanvas.width, elCanvas.height);
    // board
    const w = c * STATE.size, h = c * STATE.size;
    ctx.save();
    const rg = ctx.createRadialGradient(ox + w / 2, oy + h / 2, 0, ox + w / 2, oy + h / 2, Math.max(w, h) / 1.2);
    rg.addColorStop(0, 'rgba(124,92,255,0.18)');
    rg.addColorStop(1, 'rgba(124,92,255,0.00)');
    ctx.fillStyle = rg;
    ctx.fillRect(ox - 6, oy - 6, w + 12, h + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(ox, oy, w, h);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < STATE.size; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * c, oy);
      ctx.lineTo(ox + i * c, oy + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, oy + i * c);
      ctx.lineTo(ox + w, oy + i * c);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnake({ ox, oy, c }) {
    const snake = STATE.snake;
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const x = ox + s.x * c, y = oy + s.y * c;
      let hue;
      if (STATE.rainbow) {
        hue = (STATE.hueT * 360 + i * 8) % 360;
      } else {
        hue = 200 - Math.min(80, i * 2);
      }
      ctx.fillStyle = `hsl(${hue}, 85%, 60%)`;
      const pad = i === 0 ? 1 : 2;
      roundRect(x + pad, y + pad, c - pad * 2, c - pad * 2, Math.max(3, c * 0.18));
      ctx.fill();
      // head decoration
      if (i === 0) {
        ctx.fillStyle = '#0a0d1c';
        const ex = x + c / 2 + STATE.dir.x * (c * 0.18);
        const ey = y + c / 2 + STATE.dir.y * (c * 0.18);
        const ox2 = -STATE.dir.y, oy2 = STATE.dir.x;
        ctx.beginPath();
        ctx.arc(ex + ox2 * c * 0.12, ey + oy2 * c * 0.12, Math.max(1.5, c * 0.07), 0, Math.PI * 2);
        ctx.arc(ex - ox2 * c * 0.12, ey - oy2 * c * 0.12, Math.max(1.5, c * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFood({ ox, oy, c }) {
    if (!STATE.food) return;
    const x = ox + STATE.food.x * c, y = oy + STATE.food.y * c;
    const pad = 3;
    let color, glow;
    if (STATE.foodKind === 2) { color = `hsl(${(STATE.hueT * 360) % 360}, 90%, 65%)`; glow = '#ff66cc'; }
    else if (STATE.foodKind === 1) { color = '#ffd24a'; glow = '#ffb300'; }
    else { color = '#ff5577'; glow = '#ff2244'; }
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = Math.max(6, c * 0.5);
    ctx.fillStyle = color;
    roundRect(x + pad, y + pad, c - pad * 2, c - pad * 2, Math.max(3, c * 0.25));
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const o = origin();
    drawGrid(o);
    drawFood(o);
    drawSnake(o);
  }

  // ---------- HUD / overlay ----------
  function updateHUD() {
    elScore.textContent = STATE.score;
    elBest.textContent = STATE.best;
  }
  function showOverlay(title, sub, btn) {
    elOvTitle.textContent = title;
    elOvSub.textContent = sub;
    elStart.textContent = btn || '开始';
    elOverlay.classList.remove('hidden');
  }
  function hideOverlay() { elOverlay.classList.add('hidden'); }

  // ---------- main loop ----------
  function loop(ts) {
    if (!STATE.running) return;
    requestAnimationFrame(loop);
    STATE.hueT = (STATE.hueT + 0.004) % 1;
    const interval = 1000 / STATE.speed;
    if (!STATE.paused) {
      const dt = ts - STATE.lastTick;
      STATE.acc += dt;
      while (STATE.acc >= interval) {
        STATE.acc -= interval;
        step();
        if (!STATE.running) break;
      }
      STATE.lastTick = ts;
    } else {
      STATE.lastTick = ts;
    }
    draw();
    updateHUD();
  }

  function start() {
    if (STATE.dead) reset();
    STATE.running = true;
    STATE.paused = false;
    STATE.lastTick = performance.now();
    STATE.acc = 0;
    hideOverlay();
    requestAnimationFrame(loop);
  }
  function pauseToggle() {
    if (!STATE.running) return;
    STATE.paused = !STATE.paused;
    elPause.textContent = STATE.paused ? '继续' : '暂停';
    if (STATE.paused) showOverlay('⏸ 暂停中', '点击继续恢复游戏', '继续');
    else hideOverlay();
  }
  function resetAll() {
    STATE.running = false;
    STATE.paused = false;
    reset();
    showOverlay('准备好了吗？', '调节难度/大小/速度后开始', '开始');
  }

  // ---------- input ----------
  const keyMap = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.key]) { setDir(keyMap[e.key][0], keyMap[e.key][1]); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'p' || e.key === 'P') { pauseToggle(); e.preventDefault(); }
  }, { passive: false });

  // touch swipe on canvas
  let touch = null;
  elCanvas.addEventListener('touchstart', (e) => {
    if (!e.touches[0]) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  elCanvas.addEventListener('touchmove', (e) => {
    if (!touch || !e.touches[0]) return;
    const dx = e.touches[0].clientX - touch.x;
    const dy = e.touches[0].clientY - touch.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  // dpad
  document.querySelectorAll('#dpad button').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.dir;
      if (d === 'up') setDir(0, -1);
      else if (d === 'down') setDir(0, 1);
      else if (d === 'left') setDir(-1, 0);
      else if (d === 'right') setDir(1, 0);
    });
  });

  // settings
  function bindSeg(id, key) {
    const root = $(id);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      root.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (key === 'difficulty') {
        STATE.difficulty = b.dataset.v;
        const preset = DIFFICULTY_PRESETS[STATE.difficulty];
        $('speed').value = preset.speed;
        $('speedVal').textContent = preset.speed;
        STATE.speed = preset.speed;
      } else if (key === 'size') {
        const v = parseInt(b.dataset.v, 10);
        STATE.size = v;
        fitCanvas();
        reset();
      }
    });
  }
  bindSeg('difficulty', 'difficulty');
  bindSeg('size', 'size');

  $('speed').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    STATE.speed = v;
    $('speedVal').textContent = v;
    // de-sync from preset when user overrides
    document.querySelectorAll('#difficulty button').forEach(x => x.classList.remove('active'));
  });
  $('wrap').addEventListener('change', (e) => { STATE.wrap = e.target.checked; });
  $('rainbow').addEventListener('change', (e) => { STATE.rainbow = e.target.checked; });
  $('sound').addEventListener('change', (e) => { STATE.sound = e.target.checked; if (window.SFX) SFX.enabled = e.target.checked; });

  elStart.addEventListener('click', start);
  elPause.addEventListener('click', pauseToggle);
  elReset.addEventListener('click', resetAll);

  // init
  fitCanvas();
  reset();
  showOverlay('🐍 彩虹贪吃蛇', '滑屏 / 方向键 / 屏幕方向键 移动', '开始');
})();
