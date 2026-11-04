// game.js — PARENTING. Loads after sprites.js, photo.js, game_content.js.
// All assets are inline base64 globals (window.SPRITES / window.PHOTO) so the repo
// works over a pure-text CDN (jsDelivr); file fallbacks keep local play working.
(function () {
'use strict';
var win = window, doc = document;
var C = win.GAME_CONTENT;
var SPR = win.SPRITES || { img: 'sprites.png', cell: 16, cols: 8, frames: {} };
var PHOTO_SRC = win.PHOTO || 'photo.jpg';

var W = 960, H = 540, HUD_H = 46;
var START_MIN = 6 * 60, END_MIN = 24 * 60, MIN_PER_SEC = 2; // 6:00 -> 24:00 in 9 real minutes
var INTERACT = 64, SPEED = 190;

var BAL = C.logic.balance, SCH = C.logic.schedule;
var UI = C.ui || (C.requests && C.requests.ui) || {}; // tolerate ui nested under requests
UI.title = UI.title || 'PARENTING';
UI.select_prompt = UI.select_prompt || 'PRESS A TO START!';
UI.hint_grab = UI.hint_grab || 'Press A near an item to grab it';
UI.hint_deliver = UI.hint_deliver || 'Press A near a family member to deliver';
UI.gameover = UI.gameover || 'Game over. Press A.';
UI.happiness = UI.happiness || 'FAMILY HAPPINESS';
UI.ending_message = UI.ending_message || 'You survived the day!';
var CHECKLIST_ICON = { bath: 'duck', dinner: 'plate', clean: 'broom', bedtime: 'blanket' };

var cv = doc.getElementById('game');
var cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

var spriteImg = new win.Image(); spriteImg.src = SPR.img;          // inline data URI (fallback: sprites.png)
var photoImg = new win.Image(); photoImg.src = PHOTO_SRC;          // inline data URI (fallback: photo.jpg)
var photoReady = false;
photoImg.onload = function () { photoReady = true; };

// ── layout: one cozy studio room ──────────────────────────
var FURN = [
  { x: 820, y: 62,  w: 130, h: 60, top: '#8a7658', edge: '#6b5a44', label: 'KITCHEN' },
  { x: 640, y: 62,  w: 90,  h: 60, top: '#9a7448', edge: '#7a5a3a', label: 'PANTRY' },
  { x: 560, y: 62,  w: 60,  h: 60, top: '#e8ecef', edge: '#c8ccd0', label: '' },        // fridge
  { x: 400, y: 90,  w: 170, h: 80, top: '#e8ddc8', edge: '#8a6c4a', label: 'CRIB' },
  { x: 740, y: 300, w: 200, h: 70, top: '#8c6b4a', edge: '#6a4e32', label: 'SOFA' },
  { x: 450, y: 300, w: 120, h: 60, top: '#a07840', edge: '#7a5a38', label: '' },        // coffee table
  { x: 40,  y: 300, w: 120, h: 80, top: '#d8ecf4', edge: '#a8ccdc', label: 'BATH' },
  { x: 40,  y: 440, w: 140, h: 70, top: '#b8a890', edge: '#90806a', label: 'CHANGER' },
  { x: 320, y: 460, w: 120, h: 60, top: '#b89060', edge: '#8a6030', label: 'TOYBOX' },
  { x: 560, y: 460, w: 120, h: 60, top: '#8c6c44', edge: '#5e4028', label: 'CLOSET' },
  { x: 740, y: 460, w: 110, h: 60, top: '#a08858', edge: '#6e5638', label: 'WARDROBE' },
];
var STATIONS = [
  { item: 'grocery', x: 84,  y: 240, label: 'DOOR' },
  { item: 'plate',   x: 885, y: 152, label: 'KITCHEN' },
  { item: 'bottle',  x: 685, y: 152, label: 'PANTRY' },
  { item: 'duck',    x: 200, y: 352, label: 'BATH' },
  { item: 'diaper',  x: 222, y: 420, label: 'CHANGER' },
  { item: 'toy',     x: 380, y: 442, label: 'TOYBOX' },
  { item: 'broom',   x: 620, y: 442, label: 'CLOSET' },
  { item: 'blanket', x: 795, y: 442, label: 'WARDROBE' },
];
var BABY_POS = { x: 452, y: 108 };    // sprite top-left; center ≈ (468, 124)
var SPOUSE_POS = { x: 830, y: 356 };  // in front of sofa; center ≈ (846, 372)

// ── helpers ───────────────────────────────────────────────
function rnd(a, b) { return a + Math.random() * (b - a); }
function randInt(n) { return Math.floor(Math.random() * n); }
function parseTime(s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); }
function fmtClock(min) {
  var h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// ── state ─────────────────────────────────────────────────
var S;
function freshState() {
  return {
    state: 'select', sel: 0, // 0 = dad, 1 = mom
    elapsed: 0, gameMin: START_MIN,
    happiness: BAL.start_happiness,
    requests: [],            // {who, def, icon, timer, max, kind}
    nextAt: { baby: SCH.baby_first_request_after_sec, spouse: Infinity },
    spousePresent: false,
    checklistSpawned: {}, wakeupSpawned: false, wakeupActive: false,
    carrying: null, flash: '', flashT: 0,
    player: { x: 440, y: 300, dir: 'down', frame: 0, ft: 0 },
    confetti: [], keys: {},
  };
}
S = freshState();

function startGame() {
  var sel = S.sel;
  S = freshState();
  S.state = 'play'; S.sel = sel;
}

// ── requests ──────────────────────────────────────────────
function spawnRandom(who) {
  var pool = who === 'baby' ? C.requests.baby_requests : C.requests.spouse_requests;
  var eligible = pool.filter(function (d) {
    return !S.requests.some(function (r) { return r.def && r.def.id === d.id; });
  });
  if (!eligible.length) return false;
  var def = eligible[randInt(eligible.length)];
  var t = rnd(def.min_sec, def.max_sec);
  S.requests.push({ who: who, def: def, icon: def.icon, timer: t, max: t, kind: 'random' });
  S.nextAt[who] = Infinity; // one active per character; rescheduled on resolve
  return true;
}
function spawnTimed(who, id, icon, windowSec, kind) {
  var def = { id: id, icon: icon, en: id, reward: 6, penalty: 10 };
  // checklist / wakeup events replace any pending random request for that character
  if (SCH.checklist_replaces_random_request || SCH.wakeup_replaces_random_request) {
    S.requests = S.requests.filter(function (r) { return !(r.who === who && r.kind === 'random'); });
    S.nextAt[who] = Infinity;
  }
  S.requests.push({ who: who, def: def, icon: icon, timer: windowSec, max: windowSec, kind: kind });
}
function fulfill(req) {
  var gain = req.def.reward != null ? req.def.reward : BAL.happiness_per_fulfill;
  S.happiness = clamp(S.happiness + gain, 0, BAL.max_happiness);
  S.requests = S.requests.filter(function (r) { return r !== req; });
  if (req.icon && S.carrying === req.icon) S.carrying = null;
  var cd = SCH.cooldown_after_fulfill_sec;
  S.nextAt[req.who] = S.elapsed + rnd(cd[0], cd[1]);
  S.flash = '+ ' + gain + '  ' + (req.def.en || ''); S.flashT = 1.6;
}
function expire(req) {
  var loss = req.def.penalty != null ? req.def.penalty : -BAL.happiness_per_expired_request;
  S.happiness = clamp(S.happiness - loss, 0, BAL.max_happiness);
  S.requests = S.requests.filter(function (r) { return r !== req; });
  var cd = SCH.cooldown_after_fulfill_sec;
  S.nextAt[req.who] = S.elapsed + rnd(cd[0], cd[1]);
  S.flash = '- ' + loss + '  ' + (req.def.en || 'too late!'); S.flashT = 1.6;
  if (S.happiness <= 0) gameOver();
}
function gameOver() { if (S.state === 'play') S.state = 'over'; }
function winGame() { if (S.state === 'play') { S.state = 'win'; initConfetti(); } }
function initConfetti() {
  var cols = ['#ffd080', '#f4b8c8', '#c8a0b4', '#88ccff', '#a0d890'];
  S.confetti = [];
  for (var i = 0; i < 140; i++) {
    S.confetti.push({ x: Math.random() * W, y: Math.random() * -H, vy: 40 + Math.random() * 90,
      vx: (Math.random() - 0.5) * 40, s: 4 + Math.random() * 4, c: cols[i % cols.length], r: Math.random() * 6.28 });
  }
}

// ── interaction ───────────────────────────────────────────
function playerCenter() { return { x: S.player.x + 16, y: S.player.y + 16 }; }
function stationNear(p) {
  for (var i = 0; i < STATIONS.length; i++) {
    var st = STATIONS[i];
    if (dist(p.x, p.y, st.x, st.y) < INTERACT) return st;
  }
  return null;
}
function charNear(p) {
  var bc = { x: BABY_POS.x + 16, y: BABY_POS.y + 16 };
  if (dist(p.x, p.y, bc.x, bc.y) < INTERACT) return { who: 'baby', cx: bc.x, cy: bc.y };
  if (S.spousePresent) {
    var sc = { x: SPOUSE_POS.x + 16, y: SPOUSE_POS.y + 16 };
    if (dist(p.x, p.y, sc.x, sc.y) < INTERACT) return { who: 'spouse', cx: sc.x, cy: sc.y };
  }
  return null;
}
function requestFor(who) {
  for (var i = 0; i < S.requests.length; i++) if (S.requests[i].who === who) return S.requests[i];
  return null;
}
function interact() {
  var p = playerCenter();
  if (!S.carrying) {
    var st = stationNear(p);
    if (st) { S.carrying = st.item; S.flash = UI.hint_grab; S.flashT = 1.2; return; }
  }
  var ch = charNear(p);
  if (ch) {
    var r = requestFor(ch.who);
    if (r) {
      if (!r.icon || S.carrying === r.icon) { fulfill(r); return; }
      S.flash = 'needs: ' + r.icon; S.flashT = 1.2; return;
    }
    S.happiness = clamp(S.happiness + 1, 0, BAL.max_happiness); // a pat on the head
    S.flash = '♥'; S.flashT = 0.8; return;
  }
  if (S.carrying) { S.flash = UI.hint_deliver; S.flashT = 1.2; return; }
  S.flash = UI.hint_grab; S.flashT = 1.2;
}
function dropItem() { if (S.carrying) { S.flash = 'dropped ' + S.carrying; S.flashT = 1; S.carrying = null; } }

function onKey(code) {
  if (S.state === 'select') {
    if (code === 'ArrowLeft') S.sel = 0;
    if (code === 'ArrowRight') S.sel = 1;
    if (code === 'KeyA' || code === 'Enter' || code === 'Space') startGame();
  } else if (S.state === 'play') {
    if (code === 'KeyA' || code === 'Space') interact();
    if (code === 'KeyS') dropItem();
  } else if (S.state === 'over' || S.state === 'win') {
    if (code === 'KeyA' || code === 'Enter' || code === 'Space') S.state = 'select';
  }
}

// ── input wiring ──────────────────────────────────────────
win.addEventListener('keydown', function (e) {
  S.keys[e.code] = true; onKey(e.code);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0 && e.preventDefault) e.preventDefault();
});
win.addEventListener('keyup', function (e) { S.keys[e.code] = false; });
cv.addEventListener('click', function (e) {
  if (S.state !== 'select') return;
  var rect = cv.getBoundingClientRect();
  var mx = (e.clientX - rect.left) / Math.max(rect.width / W, 0.0001);
  S.sel = mx < W / 2 ? 0 : 1;
});
// touch controls (index.html: #dpad .dbtn[data-k], #btnA, #btnS)
(function wireTouch() {
  var btns = doc.querySelectorAll ? doc.querySelectorAll('#dpad .dbtn') : [];
  Array.prototype.forEach.call(btns, function (b) {
    var k = b.dataset && b.dataset.k; if (!k) return;
    b.addEventListener('pointerdown', function (e) { if (e.preventDefault) e.preventDefault(); S.keys[k] = true; onKey(k); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      b.addEventListener(ev, function () { S.keys[k] = false; });
    });
  });
  var bA = doc.getElementById('btnA');
  if (bA) {
    bA.addEventListener('pointerdown', function (e) { if (e.preventDefault) e.preventDefault(); S.keys['KeyA'] = true; onKey('KeyA'); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { bA.addEventListener(ev, function () { S.keys['KeyA'] = false; }); });
  }
  var bS = doc.getElementById('btnS');
  if (bS) {
    bS.addEventListener('pointerdown', function (e) { if (e.preventDefault) e.preventDefault(); S.keys['KeyS'] = true; onKey('KeyS'); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { bS.addEventListener(ev, function () { S.keys['KeyS'] = false; }); });
  }
})();

// ── update ────────────────────────────────────────────────
function walkable(px, py) {
  var fx = px + 16, fy = py + 28; // feet point
  if (fx < 10 || fx > W - 10 || fy < HUD_H + 20 || fy > H - 8) return false;
  for (var i = 0; i < FURN.length; i++) {
    var f = FURN[i];
    if (fx > f.x - 4 && fx < f.x + f.w + 4 && fy > f.y - 4 && fy < f.y + f.h + 4) return false;
  }
  return true;
}
function update(dt) {
  if (S.state !== 'play') return;
  S.elapsed += dt;
  S.gameMin = START_MIN + S.elapsed * MIN_PER_SEC;
  if (S.flashT > 0) S.flashT -= dt;

  // spouse comes home
  var spouseAt = parseTime(BAL.spouse_arrival);
  if (!S.spousePresent && S.gameMin >= spouseAt) {
    S.spousePresent = true;
    S.nextAt.spouse = S.elapsed + SCH.spouse_first_request_after_sec;
    S.flash = 'spouse is home!'; S.flashT = 1.6;
  }
  // random requests
  ['baby', 'spouse'].forEach(function (who) {
    if (who === 'spouse' && !S.spousePresent) return;
    if (S.requests.some(function (r) { return r.who === who; })) return; // max_concurrent_per_character
    if (S.elapsed >= S.nextAt[who]) {
      if (!spawnRandom(who)) S.nextAt[who] = S.elapsed + 5;
      else if (S.elapsed - S.nextAt[who] > SCH.random_request_window_sec) S.nextAt[who] = S.elapsed + SCH.random_request_window_sec;
    }
  });
  // evening checklist
  C.logic.evening_checklist.forEach(function (item) {
    if (S.checklistSpawned[item.id]) return;
    if (S.gameMin < parseTime(item.at)) return;
    S.checklistSpawned[item.id] = true;
    var who = item.who === 'any' ? (S.spousePresent ? 'spouse' : 'baby') : item.who;
    spawnTimed(who, item.id, CHECKLIST_ICON[item.id] || 'sparkle', item.window_sec, 'checklist');
  });
  // 23:30 wakeup
  var wu = C.logic.wakeup_event;
  if (!S.wakeupSpawned && S.gameMin >= parseTime(wu.at)) {
    S.wakeupSpawned = true; S.wakeupActive = true;
    spawnTimed(wu.who, 'wakeup', wu.action, wu.window_sec, 'wakeup');
    S.flash = 'baby woke up!'; S.flashT = 1.6;
  }
  // request timers
  var expired = [];
  S.requests.forEach(function (r) { r.timer -= dt; if (r.timer <= 0) expired.push(r); });
  expired.forEach(expire);
  if (S.state !== 'play') return;
  // win / over
  if (S.gameMin >= END_MIN) { winGame(); return; }
  if (S.happiness <= 0) { gameOver(); return; }
  // movement
  var dx = 0, dy = 0;
  if (S.keys['ArrowLeft']) dx -= 1;
  if (S.keys['ArrowRight']) dx += 1;
  if (S.keys['ArrowUp']) dy -= 1;
  if (S.keys['ArrowDown']) dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  if (dx) S.player.dir = dx > 0 ? 'right' : 'left';
  if (dy) S.player.dir = dy > 0 ? 'down' : 'up';
  var nx = S.player.x + dx * SPEED * dt, ny = S.player.y + dy * SPEED * dt;
  if (walkable(nx, S.player.y)) S.player.x = nx;
  if (walkable(S.player.x, ny)) S.player.y = ny;
  if (dx || dy) { S.player.ft += dt; if (S.player.ft > 0.16) { S.player.ft = 0; S.player.frame = (S.player.frame + 1) % 2; } }
  else S.player.frame = 0;
}

// ── render ────────────────────────────────────────────────
function drawSprite(name, x, y, s) {
  var f = SPR.frames && SPR.frames[name]; if (!f) return;
  var cell = SPR.cell || 16;
  cx.drawImage(spriteImg, f[0] * cell, f[1] * cell, cell, cell, x, y, cell * s, cell * s);
}
function rr(x, y, w, h, r, fill, stroke) {
  cx.beginPath();
  if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h);
  if (fill) { cx.fillStyle = fill; cx.fill(); }
  if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = 2; cx.stroke(); }
}
function text(str, x, y, font, color, align) {
  cx.font = font; cx.fillStyle = color; cx.textAlign = align || 'center';
  cx.fillText(str, x, y);
}
var FONT = '"Press Start 2P", monospace';

function renderPlay(ts) {
  // floor + wall
  cx.fillStyle = '#3a2c22'; cx.fillRect(0, 0, W, H);
  cx.fillStyle = '#c89858'; cx.fillRect(0, HUD_H, W, H - HUD_H);
  cx.fillStyle = 'rgba(0,0,0,0.08)';
  for (var gx = 0; gx < W; gx += 48) cx.fillRect(gx, HUD_H, 2, H - HUD_H);
  cx.fillStyle = '#5c3d22'; cx.fillRect(0, HUD_H, W, 18); // wall strip
  // rug
  cx.fillStyle = 'rgba(155,107,63,0.35)'; cx.fillRect(300, 220, 360, 200);
  cx.strokeStyle = 'rgba(122,76,40,0.5)'; cx.lineWidth = 2; cx.strokeRect(308, 228, 344, 184); cx.lineWidth = 1;
  // door on left wall
  cx.fillStyle = '#7a5030'; cx.fillRect(0, 200, 26, 80);
  cx.fillStyle = '#e4b040'; cx.fillRect(18, 236, 5, 5);
  // furniture
  FURN.forEach(function (f) {
    cx.fillStyle = 'rgba(0,0,0,0.2)'; cx.fillRect(f.x + 4, f.y + f.h + 4, f.w, 5);
    cx.fillStyle = f.top; cx.fillRect(f.x, f.y, f.w, f.h);
    cx.fillStyle = f.edge; cx.fillRect(f.x, f.y + f.h - 6, f.w, 6);
    cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 1; cx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
    if (f.label) text(f.label, f.x + f.w / 2, f.y + f.h / 2 + 4, '8px ' + FONT, 'rgba(0,0,0,0.45)');
  });
  // stations (infinite respawn)
  STATIONS.forEach(function (st) {
    cx.fillStyle = 'rgba(255,255,255,0.35)';
    cx.beginPath(); cx.arc(st.x, st.y, 22, 0, 6.29); cx.fill();
    drawSprite(st.item, st.x - 16, st.y - 16, 2);
    text(st.label, st.x, st.y + 34, '7px ' + FONT, 'rgba(60,40,20,0.8)');
  });
  // baby in crib
  var babyFrame = requestFor('baby') ? (Math.floor(ts / 200) % 2 ? 'baby1' : 'baby0') : 'babyLie';
  drawSprite(babyFrame, BABY_POS.x, BABY_POS.y, 2);
  // spouse on sofa
  if (S.spousePresent) {
    var spFrame = S.sel === 0 ? (Math.floor(ts / 400) % 2 ? 'mom1' : 'mom0') : (Math.floor(ts / 400) % 2 ? 'dad1' : 'dad0');
    drawSprite(spFrame, SPOUSE_POS.x, SPOUSE_POS.y, 2);
  }
  // player
  var pf = S.sel === 0 ? (S.player.frame ? 'dad1' : 'dad0') : (S.player.frame ? 'mom1' : 'mom0');
  drawSprite(pf, S.player.x, S.player.y, 2);
  if (S.carrying) drawSprite(S.carrying, S.player.x + 8, S.player.y - 22, 2);
  // request bubbles
  S.requests.forEach(function (r) {
    var cxp = r.who === 'baby' ? BABY_POS.x + 16 : SPOUSE_POS.x + 16;
    var cyp = r.who === 'baby' ? BABY_POS.y - 6 : SPOUSE_POS.y - 6;
    var bw = 210, bh = 54, bx = clamp(cxp - bw / 2, 4, W - bw - 4), by = cyp - bh - 12;
    rr(bx, by, bw, bh, 8, 'rgba(255,248,240,0.97)', 'rgba(200,160,80,0.4)');
    drawSprite(r.icon || 'talk', bx + 6, by + 11, 2);
    text((r.def.en || '').slice(0, 24), bx + 48, by + 24, '7px ' + FONT, '#2a1a0e', 'left');
    var frac = clamp(r.timer / r.max, 0, 1);
    cx.fillStyle = '#e0d8d0'; cx.fillRect(bx + 8, by + bh - 12, bw - 16, 6);
    cx.fillStyle = frac > 0.5 ? '#78c478' : frac > 0.25 ? '#eec040' : '#dc7878';
    cx.fillRect(bx + 8, by + bh - 12, (bw - 16) * frac, 6);
  });
  // hints
  var p = playerCenter();
  var hint = null;
  if (!S.carrying && stationNear(p)) hint = UI.hint_grab;
  else if (S.carrying && charNear(p)) hint = UI.hint_deliver;
  if (hint) text(hint, p.x, S.player.y - 30, '8px ' + FONT, '#fff8dc');
  // night dim
  if (S.gameMin >= parseTime(BAL.night_dim_from)) {
    cx.fillStyle = 'rgba(10,10,40,0.35)'; cx.fillRect(0, HUD_H, W, H - HUD_H);
  }
  // HUD
  cx.fillStyle = '#1c1626'; cx.fillRect(0, 0, W, HUD_H);
  text(UI.happiness, 12, 28, '8px ' + FONT, '#f5edd8', 'left');
  cx.fillStyle = '#3a2c40'; cx.fillRect(150, 14, 200, 18);
  var hp = clamp(S.happiness / BAL.max_happiness, 0, 1);
  cx.fillStyle = hp > 0.6 ? '#78c478' : hp > 0.3 ? '#eec040' : '#dc7878';
  cx.fillRect(150, 14, 200 * hp, 18);
  cx.strokeStyle = '#8a6040'; cx.lineWidth = 1; cx.strokeRect(150, 14, 200, 18);
  text(Math.round(S.happiness) + '', 250, 28, '9px ' + FONT, '#fff');
  drawSprite(S.gameMin < parseTime(BAL.spouse_arrival) ? 'sun' : 'moon', W / 2 - 60, 8, 2);
  text(fmtClock(S.gameMin), W / 2 + 10, 29, '12px ' + FONT, '#ffd080');
  if (S.carrying) { drawSprite(S.carrying, W - 70, 7, 2); text('A: give  S: drop', W - 110, 28, '7px ' + FONT, '#ffaa60', 'right'); }
  else text('A: grab/give  S: drop', W - 12, 28, '7px ' + FONT, '#8a6050', 'right');
  if (S.flashT > 0) {
    cx.globalAlpha = clamp(S.flashT, 0, 1);
    text(S.flash, W / 2, H - 14, '9px ' + FONT, '#ffd080');
    cx.globalAlpha = 1;
  }
}

function renderSelect(ts) {
  var g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a0a24'); g.addColorStop(1, '#2a1430');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  text(UI.title, W / 2, 110, '40px ' + FONT, '#ffd080');
  text('a day with Haebyol', W / 2, 150, '10px ' + FONT, '#c8a0b4');
  [['dad0', 'DAD', 0], ['mom0', 'MOM', 1]].forEach(function (c) {
    var cardX = c[2] === 0 ? 170 : 570, cardY = 220, cw = 220, ch = 220;
    var sel = S.sel === c[2];
    rr(cardX, cardY, cw, ch, 12, sel ? 'rgba(255,208,80,0.15)' : 'rgba(255,255,255,0.05)', sel ? '#ffd080' : '#604050');
    drawSprite(c[0], cardX + cw / 2 - 48, cardY + 40, 6);
    text(c[1], cardX + cw / 2, cardY + 180, '16px ' + FONT, sel ? '#ffd080' : '#c0a090');
  });
  if (Math.sin(ts / 400) > 0) text(UI.select_prompt, W / 2, 500, '11px ' + FONT, '#ffd080');
}
function renderOver() {
  cx.fillStyle = '#160a10'; cx.fillRect(0, 0, W, H);
  drawSprite('heart', W / 2 - 16, 120, 2);
  text('GAME OVER', W / 2, 220, '28px ' + FONT, '#ff6060');
  text(UI.gameover, W / 2, 280, '9px ' + FONT, '#c09090');
  text('survived until ' + fmtClock(Math.min(S.gameMin, END_MIN)), W / 2, 330, '9px ' + FONT, '#907070');
  if (Math.sin(performanceNow() / 400) > 0) text('PRESS A TO TRY AGAIN', W / 2, 430, '11px ' + FONT, '#ffd080');
}
function renderWin(ts) {
  cx.fillStyle = '#0d0718'; cx.fillRect(0, 0, W, H);
  // confetti
  S.confetti.forEach(function (c) {
    c.y += c.vy * 0.016; c.x += c.vx * 0.016 + Math.sin(c.r + c.y * 0.05) * 0.6;
    if (c.y > H + 8) { c.y = -8; c.x = Math.random() * W; }
    cx.fillStyle = c.c; cx.fillRect(c.x, c.y, c.s, c.s);
  });
  // family photo
  if (photoReady) {
    cx.save();
    cx.beginPath(); cx.arc(W / 2, 170, 95, 0, 6.29); cx.clip();
    cx.drawImage(photoImg, W / 2 - 95, 75, 190, 190);
    cx.restore();
    cx.strokeStyle = '#ffd080'; cx.lineWidth = 4;
    cx.beginPath(); cx.arc(W / 2, 170, 96, 0, 6.29); cx.stroke(); cx.lineWidth = 1;
  } else {
    drawSprite('heart', W / 2 - 32, 138, 4);
  }
  text('YOU SURVIVED THE DAY!', W / 2, 320, '20px ' + FONT, '#ffd080');
  text(UI.ending_message, W / 2, 370, '9px ' + FONT, '#f4b8c8');
  text('happiness ' + Math.round(S.happiness) + ' / ' + BAL.max_happiness, W / 2, 410, '9px ' + FONT, '#9090b0');
  if (Math.sin(ts / 400) > 0) text('PRESS A TO PLAY AGAIN', W / 2, 480, '11px ' + FONT, '#ffd080');
}
var perfT0 = 0;
function performanceNow() { return perfT0; }
function render(ts) {
  perfT0 = ts;
  if (S.state === 'select') renderSelect(ts);
  else if (S.state === 'over') renderOver();
  else if (S.state === 'win') renderWin(ts);
  else renderPlay(ts);
}

// ── main loop ─────────────────────────────────────────────
var last = 0;
function loop(ts) {
  var dt = Math.min(((ts - last) / 1000) || 0, 0.05);
  last = ts;
  update(dt); render(ts);
  win.requestAnimationFrame(loop);
}
win.requestAnimationFrame(loop);

// ── test hook ─────────────────────────────────────────────
win.__PG = {
  get state() { return S.state; },
  get sel() { return S.sel; },
  get happiness() { return S.happiness; },
  get gameMin() { return S.gameMin; },
  get requests() { return S.requests; },
  get carrying() { return S.carrying; },
  get spousePresent() { return S.spousePresent; },
  get player() { return S.player; },
  get keys() { return S.keys; },
  press: function (c) { S.keys[c] = true; onKey(c); },
  key: function (c) { S.keys[c] = true; onKey(c); S.keys[c] = false; },
  release: function (c) { S.keys[c] = false; },
  step: function (dt, ts) { update(dt); render(ts || 0); },
  start: startGame, interact: interact,
  setGameMin: function (m) { S.elapsed = (m - START_MIN) / MIN_PER_SEC; S.gameMin = m; },
  setHappiness: function (v) { S.happiness = v; },
  sprites: SPR, photoSrc: PHOTO_SRC, spriteImg: spriteImg, photoImg: photoImg,
};
})();
