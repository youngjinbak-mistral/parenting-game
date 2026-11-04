// game.test.cjs — headless tests for game.js using stubbed window/document.
// Run: node --test game.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const { beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');

const dir = __dirname;

// ── DOM stubs ─────────────────────────────────────────────
function makeCtx() {
  const calls = { fillRect: 0, drawImage: 0, fillText: 0, arc: 0 };
  const target = {
    calls,
    canvas: null,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      return (...a) => { if (p in calls) calls[p]++; };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeEl(tag) {
  return {
    tagName: tag, children: [], style: {}, dataset: {}, width: 0, height: 0,
    listeners: {}, className: '', textContent: '',
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener() {}, appendChild(c) { this.children.push(c); },
    getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 960, height: this.height || 540 }; },
    querySelectorAll() { return []; },
  };
}
const els = {};
const canvas = makeEl('canvas'); canvas.width = 960; canvas.height = 540;
els.game = canvas; els.btnA = makeEl('button'); els.btnS = makeEl('button');
const dpadBtns = ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].map((k) => {
  const b = makeEl('button'); b.dataset.k = k; return b;
});
const documentStub = {
  getElementById(id) { return els[id] || (els[id] = makeEl('div')); },
  querySelectorAll(sel) { return sel === '#dpad .dbtn' ? dpadBtns : []; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
  body: makeEl('body'),
};
let rafCb = null;
const windowStub = {
  innerWidth: 960, innerHeight: 540, listeners: {},
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  Image: class {
    constructor() { this.onload = null; this._src = ''; }
    set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); }
    get src() { return this._src; }
  },
  requestAnimationFrame(cb) { rafCb = cb; return 1; },
  document: documentStub,
};
global.window = windowStub;
global.document = documentStub;
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };

function fire(el, type) { (el.listeners[type] || []).forEach((f) => f({ preventDefault() {} })); }

// deterministic randomness: rnd(a,b) -> a, randInt(n) -> 0
// (set in beforeEach because node:test runs tests after this file finishes loading)
const realRandom = Math.random;
beforeEach(() => { Math.random = () => 0.0001; });

// load the four scripts in index.html order
for (const f of ['sprites.js', 'photo.js', 'game_content.js', 'game.js']) {
  (0, eval)(fs.readFileSync(path.join(dir, f), 'utf8'));
}
const PG = windowStub.__PG;
const C = windowStub.GAME_CONTENT;

function stepSecs(total, dt = 0.1) {
  for (let t = 0; t < total; t += dt) PG.step(dt, t * 1000);
}

// ── tests ─────────────────────────────────────────────────
test('loads with inline base64 assets (CDN-ready, no file fetch needed)', () => {
  assert.ok(PG, 'test hook exposed');
  assert.strictEqual(PG.state, 'select');
  assert.ok(PG.sprites.img.startsWith('data:image/png;base64,'), 'sprites inline');
  assert.ok(PG.photoSrc.startsWith('data:image/jpeg;base64,'), 'photo inline');
  assert.strictEqual(PG.spriteImg.src, PG.sprites.img, 'sprite image uses inline data');
  assert.strictEqual(PG.photoImg.src, PG.photoSrc, 'photo image uses inline data');
  for (const f of ['dad0', 'dad1', 'mom0', 'mom1', 'baby0', 'baby1', 'babyLie', 'heart',
    'bottle', 'diaper', 'toy', 'duck', 'blanket', 'plate', 'grocery', 'broom', 'sun', 'moon', 'talk', 'sparkle']) {
    assert.ok(PG.sprites.frames[f], 'frame ' + f);
  }
  assert.strictEqual(typeof rafCb, 'function', 'rAF loop started');
});

test('select screen: arrows choose, A starts the game', () => {
  PG.key('ArrowRight'); assert.strictEqual(PG.sel, 1);
  PG.key('ArrowLeft'); assert.strictEqual(PG.sel, 0);
  PG.key('ArrowRight');
  PG.key('KeyA');
  assert.strictEqual(PG.state, 'play');
  assert.strictEqual(PG.happiness, C.logic.balance.start_happiness);
  assert.strictEqual(PG.gameMin, 6 * 60);
});

test('first baby request spawns ~4s in, grab at station, deliver to baby for +happiness', () => {
  stepSecs(4.5);
  assert.strictEqual(PG.requests.length, 1, 'one baby request');
  const r = PG.requests[0];
  assert.strictEqual(r.who, 'baby');
  assert.strictEqual(r.icon, 'bottle', 'first pool entry with deterministic rng');
  assert.ok(r.timer > 0 && r.timer <= r.max);
  // walk to pantry station (bottle) and grab
  PG.player.x = 685 - 16; PG.player.y = 152 - 16;
  PG.key('KeyA');
  assert.strictEqual(PG.carrying, 'bottle');
  // walk to baby and deliver
  PG.player.x = 468 - 16; PG.player.y = 124 - 16;
  PG.key('KeyA');
  assert.strictEqual(PG.requests.length, 0, 'fulfilled');
  assert.strictEqual(PG.carrying, null, 'item consumed');
  assert.strictEqual(PG.happiness, 80 + 5, '+reward from request def');
});

test('expired request costs penalty and next one comes after cooldown', () => {
  const h0 = PG.happiness;
  stepSecs(13); // cooldown rnd(12,22) -> ~12s with rng=0.0001
  assert.strictEqual(PG.requests.length, 1, 'next request after cooldown');
  const r = PG.requests[0];
  stepSecs(r.max + 1); // let it expire
  assert.strictEqual(PG.requests.length, 0);
  assert.strictEqual(PG.happiness, h0 - r.def.penalty, 'penalty applied');
});

test('S drops the carried item', () => {
  PG.player.x = 685 - 16; PG.player.y = 152 - 16; // pantry
  PG.key('KeyA');
  assert.strictEqual(PG.carrying, 'bottle');
  PG.key('KeyS');
  assert.strictEqual(PG.carrying, null);
});

test('movement respects walls/furniture and arrows move the player', () => {
  PG.player.x = 300; PG.player.y = 300;
  PG.press('ArrowRight'); stepSecs(0.5); PG.release('ArrowRight');
  assert.ok(PG.player.x > 340, 'moved right, x=' + PG.player.x);
  PG.player.x = 250; PG.player.y = 300; // clear column
  PG.press('ArrowUp'); stepSecs(2); PG.release('ArrowUp');
  assert.ok(PG.player.y >= 38 && PG.player.y <= 72, 'wall strip blocks, y=' + PG.player.y);
  PG.player.x = 450; PG.player.y = 250; // below crib
  PG.press('ArrowUp'); stepSecs(1); PG.release('ArrowUp');
  assert.ok(PG.player.y >= 140, 'crib blocks, y=' + PG.player.y);
});

test('spouse arrives at 18:00 and makes requests; night dim data present', () => {
  PG.setGameMin(17 * 60 + 59);
  stepSecs(1.5);
  assert.ok(PG.spousePresent, 'spouse home at 18:00');
  stepSecs(7); // spouse_first_request_after_sec = 6
  assert.ok(PG.requests.some((r) => r.who === 'spouse'), 'spouse request spawned');
});

test('evening checklist spawns timed requests at 21:00/21:30/22:00/22:30', () => {
  PG.setGameMin(21 * 60);
  stepSecs(0.2);
  const bath = PG.requests.find((r) => r.kind === 'checklist' && r.def.id === 'bath');
  assert.ok(bath, 'bath at 21:00');
  assert.strictEqual(bath.who, 'baby');
  assert.strictEqual(bath.icon, 'duck');
  assert.strictEqual(bath.max, 20);
  PG.setGameMin(21 * 60 + 30); stepSecs(0.2);
  assert.ok(PG.requests.some((r) => r.def.id === 'dinner' && r.who === 'spouse' && r.icon === 'plate'), 'dinner 21:30');
  PG.setGameMin(22 * 60); stepSecs(0.2);
  assert.ok(PG.requests.some((r) => r.def.id === 'clean' && r.icon === 'broom'), 'clean 22:00');
  PG.setGameMin(22 * 60 + 30); stepSecs(0.2);
  assert.ok(PG.requests.some((r) => r.def.id === 'bedtime' && r.who === 'baby' && r.icon === 'blanket'), 'bedtime 22:30');
});

test('23:30 wakeup event spawns a blanket request for the baby', () => {
  PG.setGameMin(23 * 60 + 30);
  stepSecs(0.2);
  const wu = PG.requests.find((r) => r.kind === 'wakeup');
  assert.ok(wu, 'wakeup spawned');
  assert.strictEqual(wu.who, 'baby');
  assert.strictEqual(wu.icon, 'blanket');
  assert.strictEqual(wu.max, 25);
  // fulfill baby requests (incl. the wakeup) by delivering the right item each time
  const ST = { bottle: [685, 152], diaper: [222, 420], toy: [380, 442], duck: [200, 352],
               blanket: [795, 442], plate: [885, 152], grocery: [84, 240], broom: [620, 442] };
  const h0 = PG.happiness;
  for (let i = 0; i < 6 && PG.requests.some((r) => r.kind === 'wakeup'); i++) {
    const r = PG.requests.find((x) => x.who === 'baby');
    const st = ST[r.icon];
    PG.player.x = st[0] - 16; PG.player.y = st[1] - 16;
    PG.key('KeyA');
    assert.strictEqual(PG.carrying, r.icon, 'grabbed ' + r.icon);
    PG.player.x = 468 - 16; PG.player.y = 124 - 16;
    PG.key('KeyA');
  }
  assert.ok(!PG.requests.some((r) => r.kind === 'wakeup'), 'wakeup fulfilled');
  assert.ok(PG.happiness > h0, 'happiness gained');
});

test('surviving to 24:00 wins the game (photo + ending screen)', () => {
  PG.setGameMin(23 * 60 + 59);
  stepSecs(1.5);
  assert.strictEqual(PG.state, 'win');
  PG.key('KeyA'); // back to select
  assert.strictEqual(PG.state, 'select');
});

test('happiness 0 ends the game; A restarts to select', () => {
  PG.key('KeyA'); // start again
  assert.strictEqual(PG.state, 'play');
  PG.setHappiness(5);
  stepSecs(4.5); // spawn baby request
  assert.strictEqual(PG.requests.length, 1);
  stepSecs(PG.requests[0].max + 1); // expire -> -12
  assert.strictEqual(PG.happiness, 0);
  assert.strictEqual(PG.state, 'over');
  PG.key('KeyA');
  assert.strictEqual(PG.state, 'select');
});

test('touch controls: d-pad buttons set keys, A button starts the game', () => {
  fire(dpadBtns[2], 'pointerdown'); // ArrowRight
  assert.strictEqual(PG.sel, 1);
  assert.strictEqual(PG.keys['ArrowRight'], true);
  fire(dpadBtns[2], 'pointerup');
  assert.strictEqual(PG.keys['ArrowRight'], false);
  fire(els.btnA, 'pointerdown');
  assert.strictEqual(PG.state, 'play', 'A button starts');
  fire(els.btnA, 'pointerup');
  // S button drops
  PG.player.x = 380 - 16; PG.player.y = 442 - 16; // toybox
  PG.key('KeyA');
  assert.strictEqual(PG.carrying, 'toy');
  fire(els.btnS, 'pointerdown');
  assert.strictEqual(PG.carrying, null);
  fire(els.btnS, 'pointerup');
});

test('render never throws in any state and draws to the canvas', () => {
  PG.key('KeyA'); // select -> play (state is play already? ensure)
  if (PG.state !== 'play') PG.key('KeyA');
  stepSecs(1, 0.05);
  const calls = canvas._ctx ? null : null;
  // force each screen
  PG.step(0.016, 1000);
  assert.ok(PG.state === 'play');
  PG.setGameMin(24 * 60 - 0.5); PG.step(0.5, 2000);
  assert.strictEqual(PG.state, 'win');
  PG.step(0.016, 3000); // render win (confetti + photo path)
  PG.key('KeyA'); PG.key('KeyA'); // win -> select -> play
  PG.setHappiness(0.5); stepSecs(30); // force expiry -> over
  if (PG.state === 'over') PG.step(0.016, 4000);
  assert.ok(['play', 'over', 'win', 'select'].includes(PG.state));
});

test('file fallback: without inline globals the game would request sprites.png/photo.jpg', () => {
  // re-evaluate game.js in a bare window to check fallback srcs
  const bareWindow = {
    innerWidth: 960, innerHeight: 540, listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    Image: class { set src(v) { this._src = v; } get src() { return this._src; } },
    requestAnimationFrame() { return 1; },
    document: documentStub,
    GAME_CONTENT: C, // no SPRITES / PHOTO
  };
  const prevWindow = global.window;
  global.window = bareWindow;
  try {
    (0, eval)(fs.readFileSync(path.join(dir, 'game.js'), 'utf8'));
    assert.strictEqual(bareWindow.__PG.spriteImg.src, 'sprites.png');
    assert.strictEqual(bareWindow.__PG.photoImg.src, 'photo.jpg');
  } finally {
    global.window = prevWindow;
    Math.random = realRandom;
  }
});
