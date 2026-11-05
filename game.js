'use strict';
/* PARENTING — keep the family happy from morning to midnight. Arrows move, A grabs/delivers. */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 480, H = 270;          // logical resolution
  const SCALE = 2;                  // backing store is 2x -> crisp, readable text
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  ctx.imageSmoothingEnabled = false;

  const CONTENT = window.GAME_CONTENT || {"requests": {"baby_requests": [{"id": "baby_hungry", "icon": "bottle", "en": "Waaah! Milk time~!", "ko": "으아앙! 우유 타임~!", "min_sec": 12, "max_sec": 20, "penalty": 12, "reward": 5}, {"id": "baby_diaper", "icon": "diaper", "en": "Eww... stinky diaper!", "ko": "으악… 냄새나는 기저귀!", "min_sec": 14, "max_sec": 24, "penalty": 14, "reward": 6}, {"id": "baby_play", "icon": "toy", "en": "Play with me! Toss the toy~", "ko": "나랑 놀아줘! 장난감 던져줘~", "min_sec": 15, "max_sec": 28, "penalty": 10, "reward": 7}, {"id": "baby_bath", "icon": "duck", "en": "Splish splash! Ducky time!", "ko": "첨벙첨벙! 오리 목욕 시간!", "min_sec": 18, "max_sec": 30, "penalty": 12, "reward": 8}, {"id": "baby_sleepy", "icon": "blanket", "en": "Yawwwn... tuck me in please~", "ko": "하암… 이불 덮어줘~", "min_sec": 15, "max_sec": 26, "penalty": 15, "reward": 7}, {"id": "baby_milk_again", "icon": "bottle", "en": "Gulp gulp... more milk please!", "ko": "꿀꺽꿀꺽… 우유 한 잔 더!", "min_sec": 12, "max_sec": 20, "penalty": 10, "reward": 5}, {"id": "baby_bored", "icon": "toy", "en": "Booored! New toy pleeease!", "ko": "심심해! 새 장난감 주라~!", "min_sec": 12, "max_sec": 22, "penalty": 8, "reward": 5}], "spouse_requests": [{"id": "spouse_dinner", "icon": "plate", "en": "I'm starving! Dinner please~", "ko": "배고파 죽겠어! 저녁 준비해줘~", "min_sec": 15, "max_sec": 30, "penalty": 15, "reward": 8}, {"id": "spouse_grocery", "icon": "grocery", "en": "Fridge is empty! Run some errands?", "ko": "냉장고가 텅 비었어! 장 좀 봐와 줄래?", "min_sec": 20, "max_sec": 30, "penalty": 14, "reward": 10}, {"id": "spouse_talk", "icon": null, "en": "Long day... let's chat a bit?", "ko": "긴 하루였네… 잠깐 얘기 좀 하자?", "min_sec": 12, "max_sec": 24, "penalty": 12, "reward": 6}, {"id": "spouse_clean", "icon": "broom", "en": "House is a mess! Sweep it up~", "ko": "집이 엉망이야! 좀 쓸어줘~", "min_sec": 16, "max_sec": 30, "penalty": 13, "reward": 8}, {"id": "spouse_tired", "icon": "blanket", "en": "So tired... bring me a blanket?", "ko": "너무 피곤해… 담요 좀 가져다줄래?", "min_sec": 12, "max_sec": 22, "penalty": 11, "reward": 5}, {"id": "spouse_snack", "icon": "plate", "en": "Feeling peckish! Something to munch?", "ko": "출출해! 먹을 거 좀 줘!", "min_sec": 12, "max_sec": 20, "penalty": 10, "reward": 6}], "ui": {"title": "PARENTING", "select_prompt": "CHOOSE MOM OR DAD - PRESS A TO START!", "hint_grab": "Press A near an item to grab it", "hint_deliver": "Press A near a family member to deliver", "gameover": "The house went quiet... Happiness hit zero. Try again tomorrow!", "happiness": "FAMILY HAPPINESS", "clock_label": "", "ending_message": "오늘 하루도 무사히 이겨낸 거 축하해! 매일의 도전을 더 즐겁게 맞이하자."}}, "logic": {"schedule": {"baby_first_request_after_sec": 4, "spouse_first_request_after_sec": 6, "cooldown_after_fulfill_sec": [12, 22], "max_concurrent_per_character": 1, "passive_drain_per_min": 0, "random_request_window_sec": 30, "checklist_replaces_random_request": true, "wakeup_replaces_random_request": true}, "evening_checklist": [{"at": "21:00", "id": "bath", "who": "baby", "window_sec": 20}, {"at": "21:30", "id": "dinner", "who": "spouse", "window_sec": 20}, {"at": "22:00", "id": "clean", "who": "any", "window_sec": 20}, {"at": "22:30", "id": "bedtime", "who": "baby", "window_sec": 20}], "wakeup_event": {"at": "23:30", "who": "baby", "action": "blanket", "window_sec": 25}, "balance": {"start_happiness": 80, "max_happiness": 100, "happiness_per_fulfill": 4, "happiness_per_expired_request": -8, "item_station_respawn": "infinite", "spouse_arrival": "18:00", "night_dim_from": "18:00"}}};
  const L = CONTENT.logic || {};
  const BAL = (L.balance) || {};
  const SCHED = (L.schedule) || {};
  const UI = (CONTENT.requests && CONTENT.requests.ui) || {};
  const BABY_POOL = CONTENT.requests.baby_requests || [];
  // cleaning belongs to the house, not the spouse: spawnRequest redirects broom icons to HS
  const SPOUSE_POOL = CONTENT.requests.spouse_requests || [];
  // extra diverse spouse requests
  SPOUSE_POOL.push(
    { id: 'spouse_play', icon: 'toy', en: "Let's play a game together!", ko: '같이 게임하자!', min_sec: 14, max_sec: 26, penalty: 10, reward: 7 },
    { id: 'spouse_hug', icon: null, en: 'Come here... a hug?', ko: '이리 와… 안아줘?', min_sec: 12, max_sec: 22, penalty: 10, reward: 6 },
    { id: 'spouse_coffee', icon: 'bottle', en: 'Coffee please! Hot!', ko: '커피 부탁해! 따뜻하게!', min_sec: 12, max_sec: 22, penalty: 10, reward: 6 },
    { id: 'spouse_laundry', icon: 'diaper', en: 'The laundry pile is huge...', ko: '빨래가 산더미야…', min_sec: 16, max_sec: 28, penalty: 11, reward: 8 },
  );
  // story time is the baby's request, not a spouse chat
  BABY_POOL.push({ id: 'baby_story', icon: null, en: 'Read me a story~', ko: '동화 읽어줘~', min_sec: 14, max_sec: 28, penalty: 9, reward: 8 });
  // baby words popped when the player interacts with / serves the baby
  const BABY_WORDS = [
    () => 'I love you, ' + (chosen === 0 ? 'dad!' : 'mom!'),
    () => 'I am happy!',
    () => 'My name is Haebyol!',
    () => '해별!',
    () => 'Hehe~',
    () => 'Again! Again!',
    () => 'Thank you~',
    () => 'Yummy!',
  ];
  function popBabyWords(n) {
    for (let i = 0; i < (n || 2); i++) {
      particles.push({
        x: B.x + rand(-10, 10), y: B.y - 26 - i * 10,
        vx: rand(-6, 6), vy: rand(-24, -14),
        life: rand(1.2, 1.8), max: 1.8,
        txt: BABY_WORDS[randi(0, BABY_WORDS.length - 1)](),
        c: ['#ff7bac', '#ffd23f', '#5eead4', '#8b5cf6'][randi(0, 3)],
      });
    }
  }

  const CHAT_LINES = [
    { who: 'them', en: 'Long day, huh?', ko: '긴 하루였지?' },
    { who: 'me', en: 'You worked hard today.', ko: '오늘 수고했어.' },
    { who: 'them', en: 'The baby is adorable.', ko: '우리 아기가 참 귀엽다.' },
    { who: 'me', en: "Let's get through tomorrow too.", ko: '내일도 잘 해보자.' },
  ];

  // ---------------- utils ----------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const FONT = (s) => s + 'px "Press Start 2P", "Apple SD Gothic Neo", "Malgun Gothic", monospace';
  const fmtClock = (min) => {
    min = Math.floor(min) % (24 * 60);
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  };
  function text(str, x, y, size, color, align, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = FONT(size);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10,8,20,0.9)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function wrap(str, maxChars) {
    const words = String(str).split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------------- sprites ----------------
  // One sprite sheet (single request, tunnel-proof); individual PNGs are the fallback.
  const SPR = {};
  const CHAR_NAMES = ['dad_idle', 'dad_walk', 'dad_tired', 'mom_idle', 'mom_walk', 'mom_tired',
    'baby_idle', 'baby_cry', 'baby_happy', 'baby_sleep', 'baby_lying', 'dad_eat', 'mom_eat', 'baby_eat', 'baby_bath'];
  const ITEM_NAMES = ['bottle', 'diaper', 'toy', 'grocery', 'duck', 'plate', 'broom', 'blanket'];
  const SPR_NAMES = CHAR_NAMES.concat(ITEM_NAMES.map((i) => 'item_' + i));
  let sprLoaded = 0;
  function sprCanvas(img, sx, sy, sw, sh) {
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return c;
  }
  const SHEET_IY = 35; // item row offset in spr_sheet.png
  const sheet = new Image();
  sheet.onload = () => {
    CHAR_NAMES.forEach((n, i) => { SPR[n] = sprCanvas(sheet, i * 24, 0, 24, 33); });
    ITEM_NAMES.forEach((n, i) => { SPR['item_' + n] = sprCanvas(sheet, i * 16, SHEET_IY, 16, 16); });
    sprLoaded = SPR_NAMES.length;
  };
  sheet.onerror = () => loadIndividualSprites(0);
  // inline base64 (web publish) with file fallback (local dev)
  sheet.src = (typeof window !== 'undefined' && window.SPR_SHEET_B64)
    ? ('data:image/png;base64,' + window.SPR_SHEET_B64)
    : 'spr_sheet.png';
  function loadIndividualSprites(retry) {
    for (const n of SPR_NAMES) {
      const img = new Image();
      img.onload = () => { SPR[n] = img; sprLoaded++; };
      img.onerror = () => {
        sprLoaded++;
        if (retry === 0 && !SPR[n]) { // one retry with cache-buster
          const img2 = new Image();
          img2.onload = () => { SPR[n] = img2; };
          img2.src = 'spr_' + n + '.png?r=1';
        }
      };
      img.src = 'spr_' + n + '.png';
    }
  }
  const familyImg = new Image();
  familyImg.src = (typeof window !== 'undefined' && window.PHOTO_B64)
    ? ('data:image/jpeg;base64,' + window.PHOTO_B64)
    : 'family_web.jpeg';

  function drawSpr(name, x, y, size, flip) {
    const img = SPR[name];
    if (!img) return;
    const h = size * img.height / img.width;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -h / 2, size, h);
    ctx.restore();
  }

  // ---------------- game constants ----------------
  const SEC_PER_GAME_HOUR = 20;          // 1 game hour = 20 real seconds (~6 min day)
  const DAY_START = 6 * 60;              // 6:00
  const DAY_END = 24 * 60;               // midnight
  const SPOUSE_AT = 18 * 60;             // spouse comes home 18:00

  const STATIONS = [
    { item: 'bottle', x: 46, y: 70, name: 'FRIDGE' },
    { item: 'plate', x: 104, y: 70, name: 'STOVE' },
    { item: 'diaper', x: 434, y: 70, name: 'CABINET' },
    { item: 'toy', x: 434, y: 138, name: 'TOYBOX' },
    { item: 'grocery', x: 44, y: 152, name: 'DOOR' },
    { item: 'broom', x: 44, y: 190, name: 'CLOSET' },
    { item: 'duck', x: 434, y: 210, name: 'BATH' },
    { item: 'blanket', x: 312, y: 240, name: 'DRESSER' },
  ];

  // ---------------- state ----------------
  let state = 'title'; // title | play | gameover | win
  let chosen = 0;      // 0 = dad, 1 = mom
  let elapsed = 0, perf = 0;
  let happiness = BAL.start_happiness || 80;
  let fulfilled = 0, expired = 0;
  let shake = 0, flash = 0;
  let announce = null; // {text, t}
  let checklistFired = new Set(), wakeupDone = false;
  let particles = [];
  let chat = null; // {t} while the talk dialog is open

  const P = { x: W / 2, y: H / 2 + 30, vx: 0, vy: 0, size: 36, face: 1, carry: null };
  const B = { x: 180, y: 160, r: 12, wx: 0, wy: 0, req: null, cooldown: 4, mood: 0, asleep: false, asleepUntil: 0, action: null };
  const S = { x: -40, y: 152, active: false, req: null, cooldown: 6, mood: 0, wx: 0, vx: 0, vy: 0, action: null };
  const HS = { x: 250, y: 190, active: true, req: null, cooldown: 25, mood: 0, action: null }; // the house (cleaning spot); first clean request after ~25s

  const gameMin = () => DAY_START + (elapsed / SEC_PER_GAME_HOUR) * 60;

  // ---------------- input ----------------
  // use e.code (not e.key) so Korean IME mode still works; ignore auto-repeat; lock inputs briefly after state changes
  const keys = {};
  let stateAt = 0;
  function setState(s) { state = s; stateAt = perf; }
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const code = e.code || e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    keys[code] = true;
    if (P.target && code.startsWith('Arrow')) P.target = null; // keyboard overrides tap-to-move
    const act = code === 'KeyA' || code === 'Enter' || code === 'Space';
    const rst = code === 'KeyR' || act;
    if (state === 'title') {
      if (code === 'ArrowLeft') chosen = 0;
      if (code === 'ArrowRight') chosen = 1;
      if (act) reset();
    } else if (state === 'gameover' || state === 'win') {
      if (rst && perf - stateAt > 0.8) toTitle();
    } else if (state === 'play') {
      if (act) { if (chat) chat = null; interact(); } // A dismisses the chat AND acts
      else if (code === 'KeyS' || code === 'KeyX') dropCarry();
    }
  });
  addEventListener('keyup', (e) => { keys[e.code || e.key] = false; });

  // tap-to-move / tap-to-act (touch + primary mouse button): a short, low-motion tap on the canvas.
  // Tap an interactable -> walk there and act on THAT entity on arrival; tap floor -> just walk.
  // Single active pointer of any type; pointer capture so a finger sliding off can't deadlock input.
  P.target = null;
  function tap(lx, ly) {
    // deterministic pick: nearest station (r30) vs nearest requester (r36), nearer wins, requester wins ties
    let bestSt = null, bdSt = 30;
    for (const st of STATIONS) {
      const d = Math.hypot(lx - st.x, ly - st.y);
      if (d < bdSt) { bdSt = d; bestSt = st; }
    }
    let bestWho = null, bdWho = 36;
    for (const who of [B, S, HS]) {
      if (who !== B && who !== HS && !who.active) continue;
      if (!who.req) continue;
      const d = Math.hypot(lx - who.x, ly - who.y);
      if (d < bdWho) { bdWho = d; bestWho = who; }
    }
    if (bestWho && (!bestSt || bdWho <= bdSt)) {
      P.target = { kind: 'who', ref: bestWho, x: bestWho.x, y: bestWho.y, act: true, since: perf };
    } else if (bestSt) {
      P.target = { kind: 'station', ref: bestSt, x: bestSt.x, y: bestSt.y, act: true, since: perf };
    } else {
      P.target = { kind: 'floor', x: clamp(lx, 16, W - 16), y: clamp(ly, 34, H - 14), act: false, since: perf };
    }
  }
  function actOnTarget(t) { // act on the exact entity tapped (revalidated at arrival)
    if (t.kind === 'station') {
      const st = t.ref;
      if (near(st.x, st.y, 30) && P.carry !== st.item) { P.carry = st.item; announce = { text: 'GOT ' + st.item.toUpperCase(), t: 0 }; }
    } else if (t.kind === 'who') {
      const who = t.ref;
      if (who.req && near(who.x, who.y, 34)) {
        const need = who.req.entry.icon;
        if (!need || P.carry === need) { if (need) P.carry = null; fulfillRequest(who); }
        else { announce = { text: 'NEEDS ' + String(need).toUpperCase(), t: 0 }; shake = 4; }
      } else if (who === B && !B.asleep) popBabyWords(1);
    }
  }
  let activePointer = null, downAt = null, downPos = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // primary button only
    if (activePointer !== null) return; // one active pointer of any type; extra fingers ignored
    activePointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    downPos = { x: e.clientX, y: e.clientY };
    downAt = { lx: (e.clientX - r.left) * W / r.width, ly: (e.clientY - r.top) * H / r.height };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    // only a short, low-motion press counts as a tap (drags don't move the player)
    if (!downAt || !downPos) return;
    if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 14) { downAt = null; return; }
    const { lx, ly } = downAt;
    downAt = null;
    if (state === 'title') {
      // only taps on a character card start the game (and select that parent)
      if (ly > 96 && ly < 196 && ((lx > 282 && lx < 392) || (lx > 88 && lx < 198))) {
        chosen = (lx > 282 && lx < 392) ? 1 : 0;
        reset();
      }
    } else if (state === 'gameover' || state === 'win') {
      if (perf - stateAt > 0.8) toTitle();
    } else if (state === 'play') {
      if (chat) chat = null; // dismiss chat AND still take the tap
      tap(lx, ly);
    }
  });
  const releasePointer = (e) => { if (e.pointerId === activePointer) { activePointer = null; downAt = null; } };
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  addEventListener('blur', () => { activePointer = null; downAt = null; });

  function toTitle() { // clear the world so the title screen isn't drawn over a stale game
    setState('title');
    S.active = false; S.req = null; B.req = null; HS.req = null;
    particles = []; chat = null; announce = null;
  }

  // ---------------- touch controls ----------------
  // movement/action on touch is tap-to-move/tap-to-act (canvas pointerdown above);
  // only the drop button remains on screen (S), shown on touch devices only
  function setKey(code, down) { keys[code] = down; }
  if (typeof document !== 'undefined') {
    const btnS = document.getElementById('btnS');
    if (btnS) {
      const drop = (e) => { e.preventDefault(); if (state === 'play') dropCarry(); };
      btnS.addEventListener('touchstart', drop, { passive: false });
      btnS.addEventListener('mousedown', drop);
    }
  }

  function reset() {
    setState('play');
    elapsed = 0; happiness = BAL.start_happiness || 80;
    fulfilled = 0; expired = 0; shake = 0; flash = 0; announce = null;
    checklistFired = new Set(); wakeupDone = false; particles = []; chat = null;
    P.x = W / 2; P.y = H / 2 + 30; P.vx = 0; P.vy = 0; P.carry = null; P.face = 1; P.target = null;
    B.x = 180; B.y = 160; B.req = null; B.cooldown = (SCHED.baby_first_request_after_sec || 4); B.mood = 0; B.asleep = false; B.asleepUntil = 0; B.action = null;
    S.x = -40; S.active = false; S.req = null; S.cooldown = (SCHED.spouse_first_request_after_sec || 6); S.mood = 0; S.wx = 0; S.vx = 0; S.vy = 0; S.action = null;
    HS.req = null; HS.cooldown = 25; HS.mood = 0; HS.action = null;
    B.wx = 0; B.vx = 0; B.vy = 0; S.wx = 0; S.vx = 0; S.vy = 0;
  }

  // ---------------- requests ----------------
  function pickFrom(pool) { return pool[randi(0, pool.length - 1)]; }

  function spawnRequest(who, forcedId) {
    let w = who === 'baby' ? B : who === 'spouse' ? S : who;
    const pool = w === B ? BABY_POOL : SPOUSE_POOL;
    if (!pool.length) return;
    let entry;
    if (forcedId) {
      entry = pool.find((r) => r.id === forcedId);
    } else {
      // random picks: spouse never rolls broom (cleaning belongs to the house)
      do { entry = pickFrom(pool); } while (w !== B && !forcedId && entry.icon === 'broom' && pool.some((r) => r.icon !== 'broom'));
    }
    if (!entry) entry = pickFrom(pool);
    if (entry.icon === 'broom') {
      if (HS.req) { // house already has a cleaning request: don't reset its timer
        if (w !== HS) w.cooldown = rand(8, 14);
        return;
      }
      if (w === S) w.cooldown = rand(10, 18); // don't let the spouse reroll every frame
      w = HS;
    }
    if (w === HS) entry = SPOUSE_POOL.find((r) => r.icon === 'broom') || BABY_POOL.find((r) => r.icon === 'broom') || entry; // the house only ever needs a broom
    const ttl = entry.window_sec || rand(entry.min_sec || 14, entry.max_sec || 26);
    w.req = { entry, ttl, total: ttl };
    w.mood = 0;
    w.action = null;
  }

  function expireRequest(who) {
    const r = who.req;
    who.req = null;
    who.cooldown = rand(12, 20); // not harsher than a successful fulfill
    if (r) {
      happiness -= (r.entry.penalty || 10);
      expired++;
      flash = Math.max(flash, 0.35);
      announce = { text: 'TOO LATE! -' + (r.entry.penalty || 10), t: 0 };
    }
    if (happiness <= 0) { happiness = 0; setState('gameover'); }
  }

  function actionFor(icon) {
    if (!icon) return 'talk';
    if (icon === 'bottle' || icon === 'plate') return 'eat';
    if (icon === 'duck') return 'bath';
    if (icon === 'toy') return 'play';
    if (icon === 'diaper') return 'diaper';
    if (icon === 'broom') return 'clean';
    if (icon === 'blanket') return 'sleep';
    return 'happy';
  }

  function fulfillRequest(who) {
    const r = who.req;
    who.req = null;
    who.cooldown = rand(SCHED.cooldown_after_fulfill_sec ? SCHED.cooldown_after_fulfill_sec[0] : 12,
      SCHED.cooldown_after_fulfill_sec ? SCHED.cooldown_after_fulfill_sec[1] : 22);
    if (r) {
      happiness = clamp(happiness + (r.entry.reward || 5), 0, BAL.max_happiness || 100);
      fulfilled++;
      who.mood = 3; // action window
      who.action = actionFor(r.entry.icon);
      if (!r.entry.icon && who === S && r.entry.id === 'spouse_talk') chat = { t: 0 }; // only talk opens the chat (hug just gets hearts)
      if (who === B) popBabyWords(2); // baby says thanks
      if (who === B && r.entry.id === 'baby_sleepy') { B.asleep = true; B.asleepUntil = gameMin() + 120; B.mood = 0; } // sleeps max 2 game hours
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: who.x + rand(-8, 8), y: who.y - 20, vx: rand(-12, 12), vy: rand(-34, -16),
          life: rand(0.6, 1.2), max: 1.2, c: ['#ff7bac', '#ffd23f', '#5eead4'][randi(0, 2)], size: rand(1.5, 3),
        });
      }
      announce = { text: '+' + (r.entry.reward || 5) + ' HAPPY!', t: 0 };
    }
  }

  // ---------------- interaction ----------------
  function near(x, y, d) { return Math.hypot(P.x - x, P.y - y) < d; }

  // nearest station within reach wins (no source-order grabs between close stations like FRIDGE/STOVE)
  function nearestStation() {
    let best = null, bd = 31;
    for (const st of STATIONS) {
      const d = Math.hypot(P.x - st.x, P.y - st.y);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }

  function interact() {
    // requesters sorted by distance so overlapping characters don't block each other
    const targets = [B, S, HS]
      .filter((w) => w === B || w === HS || w.active)
      .sort((a, b) => (Math.hypot(P.x - a.x, P.y - a.y)) - (Math.hypot(P.x - b.x, P.y - b.y)));
    // 1) valid deliveries first (talk needs no item; broom goes to the house spot)
    for (const who of targets) {
      if (!who.req) continue;
      if (!near(who.x, who.y, 34)) continue;
      const need = who.req.entry.icon;
      if (!need || P.carry === need) {
        if (need) P.carry = null;
        fulfillRequest(who);
        return;
      }
    }
    // 2) stations: nearest one in reach grabs/swaps the carried item
    const st = nearestStation();
    if (st) {
      if (P.carry !== st.item) { P.carry = st.item; announce = { text: 'GOT ' + st.item.toUpperCase(), t: 0 }; }
      return;
    }
    // 3) wrong item near a requester -> hint
    for (const who of targets) {
      if (who.req && near(who.x, who.y, 34)) {
        announce = { text: 'NEEDS ' + String(who.req.entry.icon || 'TALK').toUpperCase(), t: 0 };
        shake = 4;
        return;
      }
    }
    // 4) just petting the baby -> she says something cute
    if (!B.asleep && near(B.x, B.y, 34)) popBabyWords(1);
  }

  function dropCarry() {
    if (P.carry) { announce = { text: 'DROPPED ' + P.carry.toUpperCase(), t: 0 }; P.carry = null; }
  }

  // ---------------- update ----------------
  const CHECKLIST = (L.evening_checklist) || [];

  function update(dt) {
    perf += dt;
    shake *= Math.exp(-6 * dt);
    flash *= Math.exp(-4 * dt);
    if (announce) { announce.t += dt; if (announce.t > 1.6) announce = null; }
    if (chat) { chat.t += dt; if (chat.t > CHAT_LINES.length * 0.9 + 2.5) chat = null; }
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.sway) p.x += Math.sin(perf * 3 + p.sway) * 25 * dt;
      if (p.grav) p.vy += 320 * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    // win confetti (win state included)
    if (state === 'win' && Math.random() < dt * 30) {
      particles.push({
        x: rand(0, W), y: -4, vx: rand(-20, 20), vy: rand(30, 90),
        life: rand(1.5, 3), max: 3, sway: rand(0, 6),
        c: ['#ff5d8f', '#ffd23f', '#5eead4', '#8b5cf6', '#ff9f43'][randi(0, 4)], size: rand(2, 3.5),
      });
    }
    if (state !== 'play') return;

    elapsed += dt;
    const gm = gameMin();

    // win at midnight
    if (gm >= DAY_END) { setState('win'); return; }

    // spouse arrives at 18:00 (stands clear of the door station)
    if (!S.active && gm >= SPOUSE_AT) {
      S.active = true; S.x = 110; S.y = 176; S.cooldown = (SCHED.spouse_first_request_after_sec || 6);
      announce = { text: 'SPOUSE IS HOME!', t: 0 };
    }

    // evening checklist: each task fires independently per recipient (never overwrite a pending request)
    for (const c of CHECKLIST) {
      if (checklistFired.has(c.id)) continue;
      if (gm < parseClock(c.at)) continue;
      const who = c.id === 'clean' ? HS : c.who === 'spouse' ? S : c.who === 'any' ? (S.active && !S.req ? S : B) : B;
      if (who.req) continue; // that recipient is busy; try again next frame
      if (who === B && B.asleep) { checklistFired.add(c.id); continue; } // already asleep: routine done, don't wake her
      const map = { bath: 'baby_bath', dinner: 'spouse_dinner', clean: 'spouse_clean', bedtime: 'baby_sleepy' };
      spawnRequest(who, map[c.id]);
      if (who.req) {
        checklistFired.add(c.id);
        who.req.ttl = who.req.total = c.window_sec || 20;
        announce = { text: 'ROUTINE: ' + c.id.toUpperCase(), t: 0 };
      }
    }
    // scripted wake-up around 23:30 — always fires (replaces any pending baby request)
    if (!wakeupDone && gm >= parseClock((L.wakeup_event && L.wakeup_event.at) || '23:30')) {
      wakeupDone = true;
      B.req = null;
      B.asleep = false;
      spawnRequest('baby', 'baby_sleepy');
      if (B.req) { B.req.ttl = B.req.total = (L.wakeup_event && L.wakeup_event.window_sec) || 25; B.req.entry = Object.assign({}, B.req.entry, { en: 'I woke up! tuck me in again~' }); }
      announce = { text: 'BABY WOKE UP!', t: 0 };
    }
    // natural wake after max 2 game hours of sleep
    if (B.asleep && gm >= B.asleepUntil) {
      B.asleep = false;
      B.cooldown = 3;
      announce = { text: 'BABY WOKE UP (refreshed)', t: 0 };
    }

    // player movement: tap target steers when set (and wins over held keys); otherwise arrow keys
    if (P.target) {
      if (P.target.kind === 'who') { P.target.x = P.target.ref.x; P.target.y = P.target.ref.y; } // follow moving requester
      if (perf - P.target.since > 6) P.target = null; // stall safety: never push forever
      else {
        const dx = P.target.x - P.x, dy = P.target.y - P.y;
        const d = Math.hypot(dx, dy);
        if (d < 12) {
          const t = P.target;
          P.target = null;
          P.vx = 0; P.vy = 0; // stop dead on arrival
          if (t.act) actOnTarget(t); // act on the exact entity tapped
        } else {
          P.vx += (dx / d) * 900 * dt;
          P.vy += (dy / d) * 900 * dt;
        }
      }
    }
    if (!P.target) {
      let ax = 0, ay = 0;
      if (keys.ArrowLeft) ax -= 1;
      if (keys.ArrowRight) ax += 1;
      if (keys.ArrowUp) ay -= 1;
      if (keys.ArrowDown) ay += 1;
      if (ax || ay) { const l = Math.hypot(ax, ay); P.vx += (ax / l) * 640 * dt; P.vy += (ay / l) * 640 * dt; }
    }
    const fr = Math.exp(-5.5 * dt);
    P.vx *= fr; P.vy *= fr;
    const sp = Math.hypot(P.vx, P.vy), maxv = 150;
    if (sp > maxv) { P.vx = P.vx / sp * maxv; P.vy = P.vy / sp * maxv; }
    P.x = clamp(P.x + P.vx * dt, 16, W - 16);
    P.y = clamp(P.y + P.vy * dt, 34, H - 14);
    if (P.vx < -5) P.face = -1; else if (P.vx > 5) P.face = 1;
    P.moving = sp > 12;

    // baby wander / sleep
    if (B.asleep) {
      // glide into the crib
      B.x = lerp(B.x, 182, 1 - Math.exp(-3 * dt));
      B.y = lerp(B.y, 194, 1 - Math.exp(-3 * dt));
      // Zzz animation
      if (Math.random() < dt * 2.2) {
        particles.push({
          x: B.x + rand(-4, 10), y: B.y - 14, vx: rand(2, 6), vy: rand(-16, -10),
          life: rand(0.9, 1.5), max: 1.5, z: true,
        });
      }
    } else {
      B.wx += dt;
      if (B.wx > (B.nextTurn || 1)) { B.wx = 0; B.nextTurn = rand(1, 2.5); B.vx = rand(-14, 14); B.vy = rand(-10, 10); }
      B.x = clamp(B.x + (B.vx || 0) * dt, 120, 320);
      B.y = clamp(B.y + (B.vy || 0) * dt, 110, 220);
    }

    // spouse wanders around the room
    if (S.active) {
      S.wx += dt;
      if (S.wx > (S.nextTurn || 1.2)) { S.wx = 0; S.nextTurn = rand(1.2, 3); S.vx = rand(-22, 22); S.vy = rand(-14, 14); }
      S.x = clamp(S.x + (S.vx || 0) * dt, 60, 420);
      S.y = clamp(S.y + (S.vy || 0) * dt, 100, 230);
    }

    // action particles while a character is doing something (bath = big blue splashes)
    for (const who of [B, S, HS]) {
      if (who === B && B.asleep) continue; // no action particles during a nap
      if (who.mood > 0 && Math.random() < dt * (who.action === 'bath' ? 16 : 8)) {
        const cols = { eat: '#d9a066', bath: '#7ec8ff', play: '#ffd23f', diaper: '#c9f2c7', clean: '#fff3b0', sleep: '#aab4ff', talk: '#ff7bac', happy: '#5eead4' };
        const bath = who.action === 'bath';
        particles.push({
          x: who.x + rand(-14, 14), y: who.y - rand(6, 22),
          vx: rand(-30, 30), vy: rand(-60, -20),
          life: rand(0.4, 0.9), max: 0.9, grav: bath,
          c: bath ? (Math.random() < 0.5 ? '#7ec8ff' : '#bfe6ff') : (cols[who.action] || '#fff'),
          size: bath ? rand(2, 4) : rand(1.5, 3),
        });
      }
    }

    // request timers + spawning (asleep baby makes no requests; chat pauses timers)
    for (const who of [B, S, HS]) {
      if (!who.active && who !== B && who !== HS) continue;
      if (who === B && B.asleep) continue;
      if (chat) continue;
      if (who.mood > 0) who.mood -= dt;
      if (who.req) {
        who.req.ttl -= dt;
        if (who.req.ttl <= 0) { expireRequest(who); if (state !== 'play') break; }
      } else {
        who.cooldown -= dt;
        if (who.cooldown <= 0) spawnRequest(who);
      }
    }

  }

  function parseClock(s) {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  }

  // ---------------- render ----------------
  // ---- sky through the window, driven by game time ----
  const SKY_KEYS = [ // [minute, top rgb, bottom rgb]
    [6 * 60, [255, 205, 150], [255, 236, 200]],   // dawn
    [9 * 60, [126, 200, 255], [207, 239, 255]],   // morning
    [12 * 60, [93, 180, 255], [191, 230, 255]],   // noon
    [15 * 60, [111, 183, 255], [216, 236, 255]],  // afternoon
    [17 * 60 + 30, [255, 158, 94], [255, 217, 160]], // golden hour
    [18 * 60, [255, 126, 71], [255, 179, 126]],   // sunset
    [19 * 60, [70, 60, 130], [180, 90, 120]],     // dusk
    [20 * 60, [16, 20, 60], [60, 50, 110]],       // night
    [24 * 60, [8, 10, 40], [35, 38, 80]],         // midnight
  ];
  function skyAt(gm) {
    gm = clamp(gm, 6 * 60, 24 * 60);
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
      if (gm >= a[0] && gm <= b[0]) {
        const t = (gm - a[0]) / (b[0] - a[0]);
        const top = a[1].map((v, k) => Math.round(lerp(v, b[1][k], t)));
        const bot = a[2].map((v, k) => Math.round(lerp(v, b[2][k], t)));
        const day = gm >= 6 * 60 && gm < 19 * 60; // sun sets ~19:00, moon/stars after
        return { top: 'rgb(' + top + ')', bot: 'rgb(' + bot + ')', day, t };
      }
    }
    return { top: '#0a0a28', bot: '#232650', day: false, t: 1 };
  }
  function drawWindow() {
    const wx = 192, wy = 12, ww = 96, wh = 60;
    const gm = (state === 'title') ? 10 * 60 : gameMin();
    const sky = skyAt(gm);
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
    g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
    ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
    if (!sky.day) { // stars + moon
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(perf + i * 2))) + ')';
        ctx.fillRect(wx + ((i * 37) % ww), wy + ((i * 23) % (wh - 12)), 2, 2);
      }
      const mx = wx + ww * (0.2 + 0.6 * clamp((gm - 19 * 60) / 300, 0, 1));
      ctx.fillStyle = '#f5f0d8';
      ctx.beginPath(); ctx.arc(mx, wy + 18, 7, 0, 6.29); ctx.fill();
      ctx.fillStyle = sky.bot; // crescent cutout matches the local sky
      ctx.beginPath(); ctx.arc(mx + 3, wy + 16, 6, 0, 6.29); ctx.fill();
    } else { // sun arcs across the sky over the whole day (6:00 -> 18:00)
      const dayT = clamp((gm - 6 * 60) / (12 * 60), 0, 1);
      const sx = wx + ww * dayT;
      const sy = wy + wh - 8 - Math.sin(dayT * Math.PI) * (wh - 16);
      ctx.save();
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 6.29); ctx.fill();
      ctx.restore();
    }
    // drifting clouds (dim at night)
    ctx.fillStyle = sky.day ? 'rgba(255,255,255,0.85)' : 'rgba(200,200,230,0.30)';
    for (let i = 0; i < 2; i++) {
      const cx = wx + ((i * 53 + perf * 5) % (ww + 36)) - 18;
      const cy = wy + 10 + i * 16;
      ctx.fillRect(cx, cy, 18, 5);
      ctx.fillRect(cx + 4, cy - 3, 10, 4);
    }
    ctx.restore();
    // frame + mullions
    ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 3;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();
  }

  function renderRoom() {
    // wall + floor
    ctx.fillStyle = '#f3e2c7';
    ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = '#d9b98a';
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, H * 0.55 - 2, W, 3);
    drawWindow();
    // rug
    ctx.fillStyle = 'rgba(200,90,90,0.30)';
    ctx.beginPath(); ctx.ellipse(250, 190, 110, 42, 0, 0, 6.29); ctx.fill();
    // furniture blocks
    const furn = [
      [24, 48, 60, 34, '#8a6a45'],   // fridge
      [84, 48, 50, 34, '#b8452f'],   // stove
      [410, 48, 56, 34, '#7a9e7e'],  // cabinet
      [410, 118, 56, 34, '#c98f4e'], // toybox
      [20, 132, 44, 40, '#5a6070'],  // door
      [20, 200, 44, 40, '#9aa3b2'],  // closet
      [410, 190, 56, 40, '#7fb3d5'], // bath
      [290, 224, 46, 32, '#9b7b54'],  // dresser (blanket station)
    ];
    for (const [x, y, w, h, c] of furn) {
      ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + h - 4, w, 4);
    }
    // crib: side view — solid interior, two posts, two rails, mattress, pillow, mobile
    ctx.fillStyle = '#c9b28a';
    ctx.fillRect(148, 170, 7, 36);           // left post
    ctx.fillRect(207, 174, 7, 32);           // right post
    ctx.fillStyle = '#efe0c2';
    ctx.fillRect(155, 180, 52, 26);          // solid interior (no see-through gaps)
    ctx.fillStyle = '#d9c9a8';
    ctx.fillRect(150, 198, 64, 8);           // mattress
    ctx.fillStyle = '#c9b28a';
    ctx.fillRect(155, 180, 52, 4);           // top rail
    ctx.fillRect(155, 191, 52, 4);           // mid rail
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(157, 199, 12, 7);           // pillow
    ctx.fillStyle = 'rgba(126,200,255,0.55)';
    ctx.fillRect(173, 199, 38, 7);           // blanket
    // mobile: string + star above the crib
    ctx.strokeStyle = '#a98a5a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(182, 158); ctx.lineTo(182, 168); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(179, 168, 6, 2); ctx.fillRect(180, 167, 4, 4); ctx.fillRect(181, 166, 2, 6);
  }

  function drawStation(st) {
    const pulse = 1 + Math.sin(perf * 4) * 0.08;
    drawSpr('item_' + st.item, st.x, st.y - 14, 16 * pulse);
    text(st.name, st.x, st.y + 12, 6, 'rgba(60,40,30,0.8)', 'center');
  }

  // bubble geometry: wraps text, clamps inside the canvas, stays below the HUD/announce strip, stacks on overlap
  function bubbleGeom(who, placed) {
    const r = who.req;
    if (!r) return null;
    ctx.save();
    ctx.font = FONT(7);
    const all = wrap(r.entry.en || '', 30);
    const lines = all.slice(0, 3);
    if (all.length > 3) lines[2] = lines[2].slice(0, -3) + '...';
    const koLines = wrap(r.entry.ko || '', 36).slice(0, 1);
    const tw = Math.max(10, ...lines.map((l) => ctx.measureText(l).width));
    const bw = clamp(tw + 36, 60, W - 16);
    const bh = Math.max(28, 12 + lines.length * 10) + (koLines.length ? 9 : 0);
    const x = clamp(who.x, bw / 2 + 4, W - bw / 2 - 4);
    // clamp the TOP edge below the HUD/announce strip so tall bubbles never cover it (y = bottom edge)
    const intersects = (t) => placed.some((p) =>
      Math.abs(x - p.x) < (bw + p.bw) / 2 + 4 &&
      Math.abs((t + bh / 2) - (p.y - p.bh / 2)) < (bh + p.bh) / 2 + 4);
    const fits = (t) => t >= 46 && t + bh <= H - 8 && !intersects(t);
    let top = clamp(who.y - 38 - bh, 46, Math.max(46, H - 8 - bh));
    if (!fits(top)) { // try above then below each overlapping placed bubble
      outer: for (const p of placed) {
        for (const cand of [p.y - p.bh - 6 - bh, p.y + 6]) {
          if (fits(cand)) { top = cand; break outer; }
        }
      }
    }
    top = clamp(top, 46, Math.max(46, H - 8 - bh));
    const y = top + bh;
    ctx.restore();
    const g = { x, y, bw, bh, lines, koLines };
    placed.push(g);
    return g;
  }

  function drawBubble(who, g) {
    const r = who.req;
    if (!r || !g) return;
    const { x, y, bw, bh, lines, koLines } = g;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - bw / 2, y - bh, bw, bh);
    ctx.strokeRect(x - bw / 2, y - bh, bw, bh);
    // icon + timer ring
    const icx = x - bw / 2 + 14, icy = y - bh / 2;
    if (r.entry.icon) drawSpr('item_' + r.entry.icon, icx, icy, 16);
    else { // talk: draw a speech-bubble icon
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#2b2b33';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(icx - 8, icy - 7, 16, 11); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(icx - 2, icy + 4); ctx.lineTo(icx + 2, icy + 4); ctx.lineTo(icx, icy + 9); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    const frac = clamp(r.ttl / r.total, 0, 1);
    ctx.beginPath();
    ctx.arc(icx, icy, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac > 0.5 ? '#3fa34d' : frac > 0.25 ? '#ff9f43' : '#ff3355';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // text, vertically centered
    ctx.fillStyle = '#2b2b33';
    ctx.font = FONT(7);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const ty0 = y - bh / 2 + 6;
    lines.forEach((ln, i) => ctx.fillText(ln, x - bw / 2 + 30, ty0 + i * 10 - (lines.length - 1) * 5));
    if (koLines.length) {
      ctx.font = FONT(6);
      ctx.fillStyle = 'rgba(60,50,80,0.6)';
      ctx.fillText(koLines[0], x - bw / 2 + 30, ty0 + lines.length * 10 - (lines.length - 1) * 5);
    }
    // station hint: where to pick the item (clamped inside the canvas)
    if (r.entry.icon) {
      const st = STATIONS.find((s) => s.item === r.entry.icon);
      if (st) {
        const hy = (y + 10 <= H - 2) ? y + 2 : y - bh - 9;
        text('at ' + st.name, clamp(x, 30, W - 30), hy, 6, 'rgba(60,50,80,0.75)', 'center');
      }
    }
    ctx.restore();
  }

  function drawCharacterSpr(name, x, y, size, flip) { drawSpr(name, x, y, size, flip); }

  // action icon floating above a character while they are doing something
  function drawActionIcon(who) {
    const icon = { eat: 'plate', bath: 'duck', play: 'toy', diaper: 'diaper', clean: 'broom', sleep: 'blanket', talk: null, happy: null }[who.action];
    const bob = Math.sin(perf * 6) * 2;
    if (icon) drawSpr('item_' + icon, who.x, who.y - 40 + bob, 14);
    else text('...', who.x, who.y - 44 + bob, 9, '#5a6070', 'center');
  }

  function render() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.save();
    if (shake > 0.3) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    renderRoom();
    for (const st of STATIONS) drawStation(st);
    // highlight the station that A would use right now
    const ns = (state === 'play') ? nearestStation() : null;
    if (ns) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,' + (0.6 + 0.4 * Math.sin(perf * 6)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ns.x, ns.y - 6, 15 + Math.sin(perf * 6) * 2, 0, 6.29); ctx.stroke();
      ctx.restore();
    }
    const placedBubbles = [];

    // baby (lying in the crib with Zzz while asleep; bounces + action pose when served)
    if (B.asleep) {
      drawCharacterSpr('baby_lying', B.x, B.y, 34);
    } else {
      const bounce = B.mood > 0 ? Math.abs(Math.sin(perf * 12)) * 3 : 0;
      let bName = 'baby_idle';
      if (B.mood > 0 && B.action === 'eat') bName = 'baby_eat';
      else if (B.mood > 0 && B.action === 'bath') bName = 'baby_bath'; // actually being washed
      else if (B.req) bName = B.req.ttl < 5 ? 'baby_cry' : (B.mood > 0 ? 'baby_happy' : 'baby_cry');
      else if (B.mood > 0) bName = 'baby_happy';
      drawCharacterSpr(bName, B.x, B.y - bounce, 30);
      drawBubble(B, bubbleGeom(B, placedBubbles));
      if (B.mood > 0 && B.action && B.action !== 'eat' && B.action !== 'bath') drawActionIcon(B);
    }

    // spouse (wanders; tired pose; action pose when served)
    if (S.active) {
      const bounce = S.mood > 0 ? Math.abs(Math.sin(perf * 12)) * 3 : 0;
      let sName = (chosen === 0 ? 'mom_idle' : 'dad_idle');
      if (S.req && S.req.entry.id === 'spouse_tired') sName = (chosen === 0 ? 'mom_tired' : 'dad_tired');
      if (S.mood > 0 && S.action === 'eat') sName = (chosen === 0 ? 'mom_eat' : 'dad_eat');
      drawCharacterSpr(sName, S.x, S.y - bounce, 36);
      drawBubble(S, bubbleGeom(S, placedBubbles));
      if (S.mood > 0 && S.action && S.action !== 'eat') drawActionIcon(S);
    }

    // the house: mess pile while a cleaning request is open
    if (HS.req) {
      ctx.fillStyle = 'rgba(90,70,50,0.5)';
      ctx.beginPath(); ctx.ellipse(HS.x - 14, HS.y + 6, 8, 4, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(HS.x + 12, HS.y + 10, 6, 3, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(HS.x + 2, HS.y + 2, 5, 3, 0, 0, 6.29); ctx.fill();
      drawBubble(HS, bubbleGeom(HS, placedBubbles));
    }

    // player
    if (state === 'play' || state === 'gameover' || state === 'win') {
      const pName = chosen === 0 ? (P.moving ? 'dad_walk' : 'dad_idle') : (P.moving ? 'mom_walk' : 'mom_idle');
      ctx.save();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(P.x, P.y + 20, 12, 4, 0, 0, 6.29); ctx.fill();
      ctx.restore();
      drawCharacterSpr(pName, P.x, P.y, 36, P.face < 0);
      if (P.carry) drawSpr('item_' + P.carry, P.x, P.y - 34, 16);
      if (P.target) { // move-target marker
        ctx.save();
        ctx.strokeStyle = 'rgba(94,234,212,' + (0.5 + 0.4 * Math.sin(perf * 8)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P.target.x, P.target.y, 6 + Math.sin(perf * 8) * 1.5, 0, 6.29); ctx.stroke();
        ctx.restore();
      }
    }

    // HUD: happiness bar + clock + carried (time of day is shown by the window, not by dimming)
    if (state === 'play') {
      const bw = 190, bh = 10;
      text(UI.happiness || 'FAMILY HAPPINESS', 8, 5, 7, '#3a3350');
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(8, 15, bw, bh);
      const frac = clamp(happiness / (BAL.max_happiness || 100), 0, 1);
      ctx.fillStyle = frac > 0.5 ? '#3fa34d' : frac > 0.25 ? '#ff9f43' : '#ff3355';
      ctx.fillRect(9, 16, (bw - 2) * frac, bh - 2);
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1.5;
      ctx.strokeRect(8, 15, bw, bh);
      text(fmtClock(gameMin()), W - 8, 5, 10, '#3a3350', 'right');
      if (P.carry) { text('CARRY', W - 8, 21, 6, '#3a3350', 'right'); drawSpr('item_' + P.carry, W - 30, 32, 14); }
      if (announce) text(announce.text, W / 2, 28, 9, '#ff9f43', 'center', clamp(1 - announce.t / 1.6, 0, 1)); // dedicated strip below the HUD
    }

    if (flash > 0.02) { ctx.fillStyle = 'rgba(255,40,70,' + clamp(flash, 0, 0.4) + ')'; ctx.fillRect(0, 0, W, H); }

    if (state === 'title') drawTitle();
    else if (state === 'gameover') drawGameOver();
    else if (state === 'win') drawWin();
    if (chat && state === 'play') drawChat();

    // particles on top (hearts, Zzz, confetti)
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.z) {
        text('Z', p.x, p.y, 7, '#aab4ff', 'center', clamp(p.life / p.max, 0, 1));
      } else if (p.txt) {
        text(p.txt, p.x, p.y, 7, p.c, 'center', clamp(p.life / p.max, 0, 1));
      } else {
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // chat dialog between player and spouse (talk action), lines reveal over time
  function drawChat() {
    const pw = 340, ph = 14 + CHAT_LINES.length * 16;
    const px = W / 2 - pw / 2, py = H - ph - 8;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);
    const shown = Math.min(CHAT_LINES.length, Math.floor(chat.t / 0.9) + 1);
    for (let i = 0; i < shown; i++) {
      const l = CHAT_LINES[i];
      const them = l.who === 'them';
      const name = them ? (chosen === 0 ? 'MOM' : 'DAD') : 'YOU';
      text(name, px + 8, py + 6 + i * 16, 6, them ? '#8b5cf6' : '#2ec4b6');
      text(l.en, px + 52, py + 6 + i * 16, 7, '#2b2b33');
      text(l.ko, px + 52, py + 6 + i * 16 + 8, 6, 'rgba(60,50,80,0.55)');
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,20,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(28,22,44,0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.restore();
  }

  function drawTitle() {
    panel(40, 24, W - 80, H - 48);
    text(UI.title || 'PARENTING', W / 2, 42, 24, '#ffd23f', 'center');
    text('keep your family happy until midnight', W / 2, 74, 8, '#c9c2e8', 'center');
    // dad card
    ctx.save();
    if (chosen === 0) { ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 3; ctx.strokeRect(88, 96, 110, 100); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(88, 96, 110, 100); }
    ctx.restore();
    drawCharacterSpr('dad_idle', 143, 150, 44);
    text('DAD', 143, 178, 10, chosen === 0 ? '#5eead4' : '#c9c2e8', 'center');
    // mom card
    ctx.save();
    if (chosen === 1) { ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 3; ctx.strokeRect(282, 96, 110, 100); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(282, 96, 110, 100); }
    ctx.restore();
    drawCharacterSpr('mom_idle', 337, 150, 44);
    text('MOM', 337, 178, 10, chosen === 1 ? '#5eead4' : '#c9c2e8', 'center');
    const touchMode = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches)
      || (typeof 'ontouchstart' in window !== 'undefined' && 'ontouchstart' in window)
      || (typeof location !== 'undefined' && /[?&]touch=1/.test(location.search));
    if (touchMode) {
      text('TAP a card to start', W / 2, 202, 8, '#ffffff', 'center');
      text('TAP floor: move there', W / 2, 216, 7, '#8f99ab', 'center');
      text('TAP station / family: go + grab / deliver', W / 2, 228, 7, '#8f99ab', 'center');
      text('S drops item · survive to 24:00!', W / 2, 238, 7, '#ff9f43', 'center');
    } else {
      text('< >  choose      A / click  start', W / 2, 202, 8, '#ffffff', 'center');
      text(UI.hint_grab || 'arrows move - A grabs item at a station', W / 2, 216, 7, '#8f99ab', 'center');
      text(UI.hint_deliver || 'A near a family member delivers - S drops', W / 2, 228, 7, '#8f99ab', 'center');
      text('survive to 24:00. happiness 0 = game over.', W / 2, 240, 7, '#ff9f43', 'center');
    }
  }

  function drawGameOver() {
    panel(60, 70, W - 120, H - 140);
    text('GAME OVER', W / 2, 82, 20, '#ff3355', 'center');
    const lines = wrap(UI.gameover || 'Happiness hit zero.', 36);
    let y = 116;
    for (const l of lines) { text(l, W / 2, y, 8, '#ffffff', 'center'); y += 13; }
    text('fulfilled ' + fulfilled + ' - missed ' + expired, W / 2, y + 8, 8, '#ffd23f', 'center');
    text('survived until ' + fmtClock(gameMin()), W / 2, y + 24, 8, '#c9c2e8', 'center');
    if (Math.floor(perf * 2) % 2 === 0) text('PRESS R / A', W / 2, H - 88, 9, '#5eead4', 'center');
  }

  function drawWin() {
    panel(30, 20, W - 60, H - 40);
    text('MIDNIGHT!', W / 2, 28, 18, '#ffd23f', 'center');
    // family photo
    if (familyImg.naturalWidth) {
      const fw = 190, fh = fw * familyImg.naturalHeight / familyImg.naturalWidth;
      const maxH = 110, sc = Math.min(1, maxH / fh);
      const dw = fw * sc, dh = fh * sc;
      ctx.save();
      // pixelated photo matches the pixel-art style
      ctx.drawImage(familyImg, W / 2 - dw / 2, 52, dw, dh);
      // celebration glow: pulsing golden border
      const pulse = 2 + Math.abs(Math.sin(perf * 3)) * 3;
      ctx.strokeStyle = 'rgba(255,210,63,' + (0.6 + 0.4 * Math.abs(Math.sin(perf * 3))) + ')';
      ctx.lineWidth = pulse;
      ctx.strokeRect(W / 2 - dw / 2 - 3, 52 - 3, dw + 6, dh + 6);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - dw / 2, 52, dw, dh);
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }
    const msg = UI.ending_message || '';
    const lines = wrap(msg, 30);
    let y = 170;
    for (const l of lines) { text(l, W / 2, y, 9, '#ffffff', 'center'); y += 15; }
    text('fulfilled ' + fulfilled + ' - missed ' + expired + ' - happiness ' + Math.round(happiness), W / 2, y + 4, 7, '#5eead4', 'center');
    if (Math.floor(perf * 2) % 2 === 0) text('PRESS R / A TO PLAY AGAIN', W / 2, H - 40, 8, '#5eead4', 'center');
  }

  // ---------------- fit & loop ----------------
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H) * 0.995; // fill the screen (landscape phones especially)
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  addEventListener('resize', fit);
  fit();

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug/test hooks via query string: ?auto=dad|mom&t=<elapsedSeconds>
  if (typeof location !== 'undefined' && location.search) {
    const qs = new URLSearchParams(location.search);
    if (qs.get('touch')) { const w = document.getElementById('wrap'); if (w) w.classList.add('force'); }
    if (qs.get('auto')) {
      chosen = qs.get('auto') === 'mom' ? 1 : 0;
      reset();
      if (qs.get('t')) elapsed = parseFloat(qs.get('t')) || 0;
      if (qs.get('sleep')) { spawnRequest('baby', 'baby_sleepy'); fulfillRequest(B); }
      if (qs.get('act')) { spawnRequest('baby', 'baby_' + qs.get('act')); fulfillRequest(B); B.mood = 999; }
    }
    if (qs.get('taps')) { // test-only: dispatch real pointer events at logical coords, e.g. ?taps=434,210@0.5;180,160@3
      for (const part of qs.get('taps').split(';')) {
        const [xy, at] = part.split('@');
        const [tx, ty] = xy.split(',').map(Number);
        setTimeout(() => {
          const r = canvas.getBoundingClientRect();
          const cx = r.left + tx / W * r.width, cy = r.top + ty / H * r.height;
          canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', button: 0, clientX: cx, clientY: cy, bubbles: true }));
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', button: 0, clientX: cx, clientY: cy, bubbles: true }));
        }, parseFloat(at || '0.5') * 1000);
      }
    }
    if (qs.get('debug') && typeof document !== 'undefined') {
      const d = document.createElement('div');
      d.id = 'debug';
      d.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99;color:#0f0;font:10px monospace;pointer-events:none'; // fixed: don't shift canvas layout
      document.body.appendChild(d);
      setInterval(() => {
        d.textContent = 'DBG ' + JSON.stringify({
          state, sprites: Object.keys(SPR).length, sprLoaded,
          missing: SPR_NAMES.filter((n) => !SPR[n]),
          req: B.req ? B.req.entry.id : null, carry: P.carry, happiness: Math.round(happiness),
          target: P.target ? P.target.kind : null, fulfilled,
          rect: canvas.getBoundingClientRect ? (() => { const r = canvas.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() : null,
          iw: innerWidth, ih: innerHeight,
          playerSprite: chosen === 0 ? 'dad_idle' : 'mom_idle',
          // hit-test: what element is under each station's tap point right now?
          hit: (() => {
            const r = canvas.getBoundingClientRect();
            const at = (lx, ly) => {
              const el = document.elementFromPoint(r.left + lx / W * r.width, r.top + ly / H * r.height);
              return el ? (el.id || el.className || el.tagName) : 'none';
            };
            return { bath: at(434, 210), closet: at(44, 190), dresser: at(312, 240), sBtn: at(60, 250) };
          })(),
          // do any current request bubbles intersect?
          bubblesOverlap: (() => {
            const placed = [];
            const gs = [B, S, HS].filter((w) => w.req).map((w) => bubbleGeom(w, placed)).filter(Boolean);
            for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
              const a = gs[i], b = gs[j];
              if (Math.abs(a.x - b.x) < (a.bw + b.bw) / 2 && Math.abs((a.y - a.bh / 2) - (b.y - b.bh / 2)) < (a.bh + b.bh) / 2) return true;
            }
            return false;
          })(),
        });
      }, 400);
    }
  }

  // test hooks
  globalThis.__pa = {
    get state() { return state; }, set state(v) { state = v; },
    get happiness() { return happiness; }, set happiness(v) { happiness = v; },
    get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; },
    gameMin, P, B, S, HS, STATIONS,
    reset, spawnRequest, fulfillRequest, expireRequest, interact, nearestStation, bubbleGeom, setKey, tap,
    get chosen() { return chosen; }, set chosen(v) { chosen = v; },
    get fulfilled() { return fulfilled; }, get expired() { return expired; },
    get chat() { return chat; },
    get particles() { return particles; },
    SPOUSE_POOL, BABY_POOL,
  };
})();
