(() => {
  "use strict";

  const CD = window.GAME_CD;
  const SFX = window.SFX || null;
  const VH = 320;
  const GROUND_Y = 262;
  const GRAV = 900;
  const JUMP_V = 330;
  const WALK = 92;
  const MS = 1.15;
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const canvas = $("game-canvas");
  const ctx = canvas.getContext("2d");
  const mini = $("minimap");
  const mctx = mini.getContext("2d");

  const A = { FR: null, SEQ: null, sheets: {}, strips: {}, meta: null, fx: {}, icons: [], avatar: null };
  const DEFS = {};
  let ppu = 1, viewW = 568, dpr = 1;

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
  }
  function loadImageRetry(src, tries) {
    tries = tries || 3;
    return loadImage(src).catch((e) => { if (tries <= 1) throw e; return new Promise((r) => setTimeout(r, 250)).then(() => loadImageRetry(src, tries - 1)); });
  }

  async function loadAssets() {
    const [main, skill, hokage, json, meta, avatar] = await Promise.all([
      loadImage("assets/Minato.png"), loadImage("assets/Minato_Skill.png"), loadImage("assets/HokageMinato.png"),
      fetch("assets/minato_frames.json").then((r) => r.json()),
      fetch("assets/chars/chars.json").then((r) => r.json()),
      loadImage("assets/Minato_avator.png"),
    ]);
    A.sheets = { main, skill, hokage };
    A.FR = json.frames; A.SEQ = json.seq; A.meta = meta; A.avatar = avatar;
    const jobs = [];
    for (const id of Object.keys(meta.chars)) {
      A.strips[id] = {};
      for (const an of Object.keys(meta.chars[id].anims)) {
        jobs.push(loadImage(`assets/chars/${id}_${an}.png`).then((im) => { A.strips[id][an] = im; }));
      }
    }
    for (const n of Object.keys(meta.effects)) jobs.push(loadImage(`assets/chars/effect_${n}.png`).then((im) => { A.fx[n] = im; }));
    for (let i = 1; i <= 5; i++) jobs.push(loadImageRetry(`assets/Minato_skill${i}.png`).then((im) => { A.icons[i] = im; }).catch(() => { A.icons[i] = null; }));
    await Promise.all(jobs);
    buildDefs();
  }

  const HIT_KIND = { n_hit: "n", c_hit: "c", f_hit: "f", f2_hit: "f", b_hit: "b", bl_hit: "b", ab_hit: "b", l_hit: "b", o_hit: "b", o2_hit: "b", ac_hit: "ac" };
  const STRIP_FPS = { idle: 8, walk: 10, run: 12, jump: 12, hurt: 10, death: 8, attack1: 13, attack2: 13, attack3: 13 };

  function countBoxes(list) { let n = 0; for (const it of list) for (const e of it.ev || []) if (e[0] === "setAttackBox") n++; return Math.max(1, n); }

  function buildDefs() {
    for (const c of CD.chars) {
      const d = { id: c.id, name: c.name, maxHp: c.hp * 5, speed: c.speed, reach: c.reach, h: c.h, isMinato: c.id === "Minato", exclusive: !!c.exclusive };
      if (d.isMinato) {
        d.halfW = 14; d.boxH = 80;
        d.boxes = {};
        for (const k of ["NAttack", "Skill01", "Skill02", "Skill03", "Skill04", "Skill05"]) d.boxes[k] = countBoxes(A.SEQ[k]);
        d.nSkills = 5;
      } else {
        const m = A.meta.chars[c.id];
        d.fs = m.fs; d.pivotX = m.pivotX; d.pivotY = m.pivotY; d.scale = c.h / m.bodyH;
        d.halfW = Math.max(11, m.bodyW * d.scale * 0.5); d.boxH = c.h;
        d.frames = buildStripFrames(d, m);
        d.nSkills = 3;
      }
      DEFS[c.id] = d;
    }
  }

  function buildStripFrames(d, m) {
    const has = (a) => !!m.anims[a];
    const arr = (a, extra) => { const o = []; for (let i = 0; i < m.anims[a].n; i++) o.push(Object.assign({ a, i, ev: [] }, extra || {})); return o; };
    const F = {};
    F.Idle = arr("idle"); F.Walk = arr(has("run") ? "run" : "walk");

    if (has("jump")) F.Float = arr("jump");
    else { const w = arr(has("run") ? "run" : "walk"); F.Float = [w[Math.floor(w.length / 2)]]; }
    F.Hurt = arr("hurt"); F.AirHurt = arr("hurt");
    F.KnockDown = arr("death").slice(0, Math.max(2, m.anims.death.n - 1)).concat(arr("death").slice(-1));
    F.Dead = arr("death");
    const segs = [];
    const nat = [];
    for (const a of ["attack1", "attack2", "attack3"]) {
      if (!has(a)) continue;
      const s = arr(a);
      s[Math.floor(s.length * 0.55)].ev.push(["setAttackBox", a === "attack3" || !has("attack3") && a === "attack2" ? "b_hit" : "n_hit"]);
      nat.push(...s); segs.push(nat.length);
    }
    F.NAttack = nat; d.segEnds = segs.slice(0, -1);
    const a1 = arr("attack1");
    const a2 = has("attack2") ? arr("attack2") : arr("attack1");
    const a3 = has("attack3") ? arr("attack3") : arr("attack1");

    a1[Math.floor(a1.length * 0.45)].ev.push(["spawnThorn", ""]);

    a2[Math.floor(a2.length * 0.4)].ev.push(["spawnFire", ""]);

    a3[0].ev.push(["setCharge", "620"], ["spawnSmoke", ""]);
    d.box3 = Math.max(1, a3.length - 1);
    a3.forEach((it, k) => { if (k >= 1) it.ev.push(["setAttackBox", k === a3.length - 1 ? "b_hit" : "c_hit"], ["spawnBurst", ""]); });
    F.Skill01 = a1; F.Skill02 = a2; F.Skill03 = a3;
    return F;
  }

  function getList(f, st) { return f.def.isMinato ? A.SEQ[st] : f.def.frames[st]; }
  function stateFps(f, st, it) {
    if (f.def.isMinato) return CD.minato.fps[st] || 10;
    if (it && it.a) return STRIP_FPS[it.a] || 10;
    return 10;
  }

  function minatoRect(fr) {
    const w = fr.w * MS, h = fr.h * MS, ssH = fr.ss[1] * MS;
    return { dx: fr.ox * MS - w / 2, dy: -h / 2 - fr.oy * MS - ssH / 2, w, h };
  }
  function drawMinatoFrame(name, x, y, facing, alpha) {
    const fr = A.FR[name]; if (!fr) return;
    const r = minatoRect(fr), img = A.sheets[fr.s];
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, y); if (facing < 0) ctx.scale(-1, 1);
    if (fr.r) { ctx.translate(r.dx, r.dy + r.h); ctx.rotate(-Math.PI / 2); ctx.drawImage(img, fr.x, fr.y, fr.h, fr.w, 0, 0, r.h, r.w); }
    else ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, r.dx, r.dy, r.w, r.h);
    ctx.restore();
  }
  function drawStripFrame(d, it, x, y, facing, alpha, sizeMul) {
    const img = A.strips[d.id][it.a]; if (!img) return;
    const s = d.scale * (sizeMul || 1);
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, y); if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, it.i * d.fs, 0, d.fs, d.fs, -d.pivotX * s, -d.pivotY * s, d.fs * s, d.fs * s);
    ctx.restore();
  }
  function drawFighter(f) {
    const list = getList(f, f.state); if (!list || !list.length) return;
    const it = list[Math.min(f.idx, list.length - 1)];
    const alpha = f.inv > 0 && f.stun <= 0 && !f.dead ? 0.55 : (f.dead ? clamp(f.deadT > 1.2 && f.isMinion ? 1 - (f.deadT - 1.2) * 2 : 1, 0, 1) : 1);
    if (f.def.isMinato) drawMinatoFrame(it.f, f.x, f.y, f.facing, alpha);
    else drawStripFrame(f.def, it, f.x, f.y, f.facing, alpha, f.sizeMul);
  }

  const G = {
    scene: "loading", mode: "battle", diff: "normal", size: 2,
    fighters: [], structs: [], projs: [], zones: [], fxs: [], texts: [],
    cam: { x: 0 }, worldW: 1000, t: 0, time: 0, running: false, paused: false,
    kills: [0, 0], round: 1, wins: [0, 0], roundState: "play", roundT: 0,
    wave: 0, waveLeft: 0, spawnT: 0, score: 0, minionT: 0, humans: [], ended: false, bannerT: 0,
    lastCfg: null,
  };
  const keys = Object.create(null);
  let joyX = 0, joyActive = false;

  const L = {
    mode: "battle", size: 2, diff: "normal",
    teamA: [{ c: "Minato", k: "P1" }, { c: "Shinobi", k: "CPU" }, { c: "Samurai", k: "CPU" }],
    teamB: [{ c: "Fighter", k: "CPU" }, { c: "Woodcutter", k: "CPU" }, { c: "GraveRobber", k: "CPU" }],
  };
  let pickTarget = null;

  function slotCount() { return L.mode === "versus" ? 1 : L.mode === "rush" ? 2 : L.size; }

  function avatarInto(cv, id) {
    const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
    if (id === "Minato") {
      const im = A.avatar, s = Math.min(cv.width / im.width, cv.height / im.height);
      c.drawImage(im, (cv.width - im.width * s) / 2, (cv.height - im.height * s) / 2, im.width * s, im.height * s);
      return;
    }
    const m = A.meta.chars[id], img = A.strips[id].idle, d = DEFS[id];
    const s = Math.min(cv.height / (m.bodyH + 6), 3) ;
    const w = m.fs * s;
    c.drawImage(img, 0, 0, m.fs, m.fs, cv.width / 2 - m.pivotX * s, cv.height - 2 - m.pivotY * s, w, w);
  }
  function makeAvatar(id, cls) { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 40; if (cls) cv.className = cls; avatarInto(cv, id); return cv; }

  function renderLobby() {
    const n = slotCount();
    $("lobby-title").textContent = L.mode === "battle" ? "Battle" : L.mode === "versus" ? "Versus" : "Rush";
    const sz = $("opt-size"); sz.innerHTML = "";
    if (L.mode === "battle") for (const v of [2, 3]) sz.appendChild(chip(v + " vs " + v, L.size === v, () => { L.size = v; renderLobby(); }));
    const df = $("opt-diff"); df.innerHTML = "";
    for (const v of ["easy", "normal", "hard"]) df.appendChild(chip(v, L.diff === v, () => { L.diff = v; renderLobby(); }));
    fillTeam($("team-a"), L.teamA, n, "A");
    $("team-b").style.display = L.mode === "rush" ? "none" : "";
    fillTeam($("team-b"), L.teamB, n, "B");
    $("team-a").querySelector("h3").textContent = L.mode === "rush" ? "Pemain" : "Tim 1";
    $("lobby-hint").textContent = L.mode === "rush" ? "Lawan: monster dan ninja, wave tanpa henti." :
      L.mode === "battle" ? "Hancurkan turret, lalu base lawan. Minion muncul tiap 20 detik." : "Best of 3, 60 detik per ronde.";
  }
  function chip(t, on, fn) { const b = document.createElement("button"); b.className = "chip" + (on ? " on" : ""); b.textContent = t; b.onclick = fn; return b; }
  function fillTeam(el, arr, n, side) {
    const box = el.querySelector(".slots"); box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const s = arr[i]; const d = DEFS[s.c];
      const row = document.createElement("div"); row.className = "slot";
      row.appendChild(makeAvatar(s.c));
      const pk = document.createElement("button"); pk.className = "pick";
      pk.innerHTML = d.name + "<small>" + (d.exclusive ? "Exclusive" : "") + "</small>";
      pk.onclick = () => openPicker(arr, i);
      const ct = document.createElement("button"); ct.className = "ctrl " + s.k.toLowerCase(); ct.textContent = s.k;
      ct.onclick = () => cycleCtrl(arr, i);
      row.append(pk, ct); box.appendChild(row);
    }
  }
  function allSlots() { const n = slotCount(); return [...L.teamA.slice(0, n), ...(L.mode === "rush" ? [] : L.teamB.slice(0, n))]; }
  function cycleCtrl(arr, i) {
    const order = ["CPU", "P1", "P2"];
    const cur = arr[i].k; const next = order[(order.indexOf(cur) + 1) % 3];
    if (next !== "CPU") for (const s of allSlots()) if (s.k === next) s.k = "CPU";
    arr[i].k = next; ensureP1(); renderLobby();
  }
  function ensureP1() {
    const sl = allSlots();
    if (!sl.some((s) => s.k === "P1")) L.teamA[0].k = "P1";
  }
  function openPicker(arr, i) {
    pickTarget = { arr, i };
    const g = $("picker-grid"); g.innerHTML = "";
    for (const c of CD.chars) {
      const b = document.createElement("button"); b.className = "pick-card" + (arr[i].c === c.id ? " on" : "");
      b.appendChild(makeAvatar(c.id)); const sp = document.createElement("span"); sp.textContent = c.name; b.appendChild(sp);
      if (c.exclusive) { const e = document.createElement("em"); e.textContent = "EXCLUSIVE"; b.appendChild(e); }
      b.onclick = () => { arr[i].c = c.id; $("picker").classList.add("hidden"); renderLobby(); };
      g.appendChild(b);
    }
    $("picker").classList.remove("hidden");
  }

  let uid = 1;
  function makeFighter(id, team, ctrl, x, opt) {
    opt = opt || {};
    const def = DEFS[id];
    const f = {
      uid: uid++, def, team, ctrl, x, y: GROUND_Y, vx: 0, vy: 0, facing: team === 0 ? 1 : -1, air: false,
      hp: opt.hp || def.maxHp, maxHp: opt.hp || def.maxHp, mp: 100, state: "Idle", idx: 0, timer: 0,
      locked: false, stun: 0, inv: 0, armor: false, dead: false, deadT: 0, respawn: 0, kills: 0, deaths: 0,
      cd: [0, 0, 0, 0, 0, 0], isMinion: !!opt.minion, dmgMul: opt.dmgMul || 1, spd: def.speed * (opt.spd || 1),
      sizeMul: opt.scale || 1, dashCd: 0, dashT: 0, dashDir: 1, skillLockout: 0, stillT: 0,
      atkHeld: false, wantAtk: false, inp: { l: false, r: false, j: false, atk: false }, tele: 0,
      ai: { t: rand(0, 0.4), aggr: true, hold: 1, atkT: 0, pause: 0, skill: false, jump: false }, name: def.name,
      sfx: false, tier: opt.tier || null, home: x,
    };
    f.sfx = def.isMinato;
    return f;
  }
  function isHuman(f) { return f.ctrl === "P1" || f.ctrl === "P2"; }

  function setState(f, st, force) {
    if (!force && f.state === st) return;
    f.state = st; f.idx = 0; f.timer = 0;
    if (f.sfx && SFX && (st === "NAttack" || /^Skill/.test(st))) SFX.stopVoice();
    if (f.sfx && SFX) { SFX.resetAnimSounds(f.uid); SFX.onFrame(st, 0, f.uid); }
    enterFrame(f, 0);
  }

  function frameDur(f, list, i) {
    const it = list[i]; let d = 1 / stateFps(f, f.state, it);
    if (it.ev) for (const e of it.ev) if (e[0] === "setDelay") d += parseFloat(e[1]) * 0.005;
    return Math.max(0.02, d);
  }

  function skillCfg(f, n) {
    if (f.def.isMinato) return CD.minato.skills[n];
    return CD.generic.skills[n];
  }

  function enterFrame(f, i) {
    const list = getList(f, f.state); if (!list || !list[i]) return;
    const it = list[i];
    if (!it.ev) return;
    for (const e of it.ev) {
      const t = e[0], v = e[1];
      if (t === "setAttackBox") doAttackBox(f, HIT_KIND[v] || "n");
      else if (t === "setMove") f.vx += f.facing * parseFloat(v) * 8;
      else if (t === "setCharge" || t === "setChargeB") f.vx += f.facing * parseFloat(v) * 0.5;
      else if (t === "setCommand") {
        if (v === "findTarget") f.tele = 1;
        else if (v === "setTransport" && f.tele) transport(f);
        else if (v === "setInvicible") f.inv = 9;
        else if (v === "reInvicible") f.inv = 0.05;
      } else if (t === "setBullet" && v === "KN") spawnProj(f, { kind: "kunai", vx: 340, dmg: 14, life: 0.9, r: 6 });
      else if (t === "spawnFire") spawnProj(f, { kind: "fire", vx: 230, dmg: skillCfg(f, 2).damage, life: 1.3, r: 12, hk: "b" });
      else if (t === "spawnThorn") spawnThorn(f);
      else if (t === "spawnSmoke") G.fxs.push({ type: "sprite", n: 9, x: f.x, y: f.y - 2, t: 0, life: 0.55, s: 1.1, flip: f.facing });
      else if (t === "spawnBurst") G.fxs.push({ type: "sprite", n: 10, x: f.x + f.facing * f.def.reach * 0.7, y: f.y - f.def.boxH * 0.5, t: 0, life: 0.4, s: 1.3, flip: f.facing });
    }
  }

  function transport(f) {
    let best = null, bd = 300;
    for (const t of enemiesOf(f, true)) { if (t.kind) continue; const d = Math.abs(t.x - f.x); if (d < bd) { bd = d; best = t; } }
    if (best) { f.x = clamp(best.x - f.facing * 34, 20, G.worldW - 20); f.facing = best.x >= f.x ? 1 : -1; f.tele = 0; poof(f.x, f.y - 20); }
  }
  function poof(x, y) { G.fxs.push({ type: "ring", x, y, t: 0, life: 0.3, r: 28, c: "#ffffff" }); }

  function enemiesOf(f, incFighters) {
    const out = [];
    for (const t of G.fighters) if (t.team !== f.team && !t.dead) out.push(t);
    for (const s of G.structs) if (s.team !== f.team && s.hp > 0) out.push(s);
    return out;
  }
  function targetBox(t) {
    if (t.kind) return { x0: t.x - t.w / 2, x1: t.x + t.w / 2, y0: GROUND_Y - t.h, y1: GROUND_Y };
    const m = t.sizeMul || 1;
    return { x0: t.x - t.def.halfW * m, x1: t.x + t.def.halfW * m, y0: t.y - t.def.boxH * m, y1: t.y };
  }
  function attackRect(f, clampCfg) {
    let lx0, lx1, ly0, ly1;
    if (f.def.isMinato) {
      const list = getList(f, f.state), it = list[Math.min(f.idx, list.length - 1)], fr = A.FR[it.f];
      if (!fr) return null;
      const r = minatoRect(fr);
      lx0 = Math.max(r.dx, -clampCfg.back); lx1 = Math.min(r.dx + r.w, clampCfg.reach);
      ly0 = r.dy; ly1 = r.dy + r.h;
      if (lx1 <= lx0) return null;
      ly0 = Math.max(ly0, -150); ly1 = Math.min(ly1, 12);
    } else {
      const m = f.sizeMul || 1;
      lx0 = -clampCfg.back; lx1 = clampCfg.reach; ly0 = -f.def.boxH * m * 0.95; ly1 = -f.def.boxH * m * 0.05;
    }
    const x0 = f.facing > 0 ? f.x + lx0 : f.x - lx1, x1 = f.facing > 0 ? f.x + lx1 : f.x - lx0;
    return { x0, x1, y0: f.y + ly0, y1: f.y + ly1 };
  }
  function actionCfg(f) {
    const st = f.state;
    if (st === "NAttack") {
      if (f.def.isMinato) return { dmg: CD.minato.basic.damage / f.def.boxes.NAttack, reach: CD.minato.basic.reach, back: CD.minato.basic.back };
      return { dmg: CD.generic.basic.damage, reach: f.def.reach, back: 6 };
    }
    const n = parseInt(st.slice(-2), 10);
    if (f.def.isMinato) { const c = CD.minato.skills[n]; return { dmg: c.damage / f.def.boxes[st], reach: c.reach, back: c.back }; }
    const c = CD.generic.skills[n];
    return { dmg: c.damage / (n === 3 ? f.def.box3 : 3), reach: f.def.reach + 8, back: 6 };
  }
  function doAttackBox(f, kind) {
    const cfg = actionCfg(f);
    const r = attackRect(f, cfg); if (!r) return;
    hitRect(f, r, cfg.dmg * f.dmgMul, kind);
  }
  function hitRect(f, r, dmg, kind) {
    let any = false;
    for (const t of enemiesOf(f)) {
      const b = targetBox(t);
      if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
      if (!t.kind && t.inv > 0) continue;
      damage(f, t, dmg, kind, r); any = true;
    }
    return any;
  }
  let hitAlt = 0;
  function damage(att, t, dmg, kind, r) {
    if (t.kind) {
      if (t.kind === "base" && t.locked) { floatText(t.x, GROUND_Y - t.h, "LOCK", "#9aa0aa"); return; }
      t.hp = Math.max(0, t.hp - dmg * 0.7);
      spark(t.x + rand(-10, 10), GROUND_Y - rand(10, t.h));
      floatText(t.x, GROUND_Y - t.h - 6, Math.round(dmg * 0.7), "#f0b429");
      if (t.hp <= 0) structDown(t, att);
      if (att && att.def && att.def.isMinato) sfxHit(kind);
      return;
    }
    t.hp -= dmg;
    const dir = att ? (t.x >= att.x ? 1 : -1) : 1;
    spark(t.x, t.y - t.def.boxH * 0.55);
    floatText(t.x, t.y - t.def.boxH - 4, Math.round(dmg), t.team === 0 ? "#ff8a8a" : "#ffffff");
    if (att && att.def && att.def.isMinato) sfxHit(kind);
    if (t.hp <= 0) { killFighter(t, att); return; }
    if (t.armor) return;
    const skillLock = /^Skill/.test(t.state);
    if (kind === "b") {
      if (skillLock && t.inv > 0) return;
      t.vx = dir * 150; t.vy = -140; t.air = true; t.stun = 0.72; t.locked = true; t.wantAtk = false;
      t.facing = -dir; setState(t, "KnockDown", true); t.inv = 1.0;
    } else if (kind === "f") {
      if (skillLock) return;
      t.vx = dir * 40; t.vy = -240; t.air = true; t.stun = 0.55; t.locked = true; t.facing = -dir; setState(t, "Float", true);
    } else if (kind === "ac") {
      if (skillLock) return;
      t.vx = dir * 14; if (t.air) t.vy = Math.min(t.vy, -30); t.stun = Math.max(t.stun, 0.22); t.locked = true;
      if (t.state !== "AirHurt") setState(t, t.air ? "AirHurt" : "Hurt", true);
    } else {
      if (skillLock) return;
      t.vx = dir * (kind === "c" ? 16 : 44); t.stun = Math.max(t.stun, kind === "c" ? 0.2 : 0.3); t.locked = true; t.facing = -dir;
      t.wantAtk = false;
      if (t.state !== "Hurt") setState(t, t.air ? "AirHurt" : "Hurt", true);
    }
  }
  function sfxHit(kind) {
    if (!SFX || !SFX.play) return;
    if (kind === "n" || kind === "c") SFX.play(hitAlt++ % 2 ? "Minato/fx/HS1.ogg" : "Minato/fx/HS3.ogg", 0.5);
    else SFX.play("Minato/fx/HS2.ogg", 0.6);
  }
  function spark(x, y) { G.fxs.push({ type: "ring", x, y, t: 0, life: 0.25, r: 16, c: "#ffd54a" }); }
  function floatText(x, y, s, c) { G.texts.push({ x, y, s: String(s), c, t: 0 }); }

  function killFighter(f, killer) {
    f.dead = true; f.deadT = 0; f.hp = 0; f.locked = true; f.stun = 0; f.deaths++;
    setState(f, "Dead", true);
    if (!f.isMinion && killer && !killer.kind) { killer.kills++; }
    if (!f.isMinion || G.mode === "rush") {
      if (G.mode === "rush") { if (f.team === 1) { G.score += CD.rush.score[f.tier || "monster"] || 10; G.waveLeft = Math.max(0, G.waveLeft - 1); } }
      else if (killer) G.kills[killer.team] = (G.kills[killer.team] || 0) + (f.isMinion ? 0 : 1);
    }
    if (G.mode === "battle" && !f.isMinion) f.respawn = CD.battle.respawnBase + f.deaths * CD.battle.respawnPerDeath;
    if (SFX && SFX.play) SFX.play("Minato/fx/poof.ogg", 0.5);
  }

  function structDown(s, att) {
    s.dead = true;
    for (let i = 0; i < 8; i++) G.fxs.push({ type: "ring", x: s.x + rand(-s.w / 2, s.w / 2), y: GROUND_Y - rand(6, s.h), t: -i * 0.06, life: 0.4, r: 26, c: "#ff9f43" });
    G.texts.push({ x: s.x, y: GROUND_Y - s.h - 14, s: s.kind === "base" ? "BASE HANCUR" : "TURRET HANCUR", c: "#ffffff", t: 0, long: true });
    if (SFX && SFX.play) SFX.play("Minato/fx/fx5_2.ogg", 0.7);
    if (s.kind === "base") endMatch(s.team === 0 ? 1 : 0, "Base hancur");
    else { const b = G.structs.find((x) => x.kind === "base" && x.team === s.team); if (b && !G.structs.some((x) => x.kind === "turret" && x.team === s.team && x.hp > 0)) b.locked = false; }
  }

  function spawnProj(f, o) {
    G.projs.push(Object.assign({ x: f.x + f.facing * 14, y: f.y - f.def.boxH * 0.55, vx: 0, vy: 0, team: f.team, owner: f, life: 1, r: 8, dmg: 10, hk: "n", t: 0 }, o, { vx: (o.vx || 0) * f.facing }));
  }
  function spawnThorn(f) {
    const c = skillCfg(f, 1);
    for (let k = 0; k < 3; k++) G.zones.push({ x: f.x + f.facing * (44 + k * 34), team: f.team, owner: f, t: -k * 0.13, life: 0.6, dmg: c.damage / 3, hit: false, y: f.y });
  }

  function makeStructs(cfgW) {
    G.structs = [];
    const B = CD.battle, W = cfgW;
    const mk = (kind, team, x, hp, w, h) => ({ kind, team, x, hp, maxHp: hp, w, h, cd: rand(0, 1), dead: false, locked: false, y: GROUND_Y });
    G.structs.push(mk("base", 0, 150, B.baseHp, 80, 92), mk("base", 1, W - 150, B.baseHp, 80, 92));
    for (const tx of [560, 880]) G.structs.push(mk("turret", 0, tx, B.turretHp, 30, 74));
    for (const tx of [W - 560, W - 880]) G.structs.push(mk("turret", 1, tx, B.turretHp, 30, 74));
    for (const b of G.structs) if (b.kind === "base") b.locked = true;
  }
  function updateStructs(dt) {
    const B = CD.battle;
    for (const s of G.structs) {
      if (s.kind !== "turret" || s.hp <= 0) continue;
      s.cd -= dt;
      if (s.cd > 0) continue;
      let best = null, bd = B.turretRange;
      for (const t of G.fighters) {
        if (t.team === s.team || t.dead) continue;
        const d = Math.abs(t.x - s.x); if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        s.cd = B.turretRate;
        const ty = best.y - best.def.boxH * 0.5, sy = GROUND_Y - s.h + 6;
        const dx = best.x - s.x, dy = ty - sy, L = Math.hypot(dx, dy) || 1, sp = 300;
        G.projs.push({ x: s.x, y: sy, vx: dx / L * sp, vy: dy / L * sp, team: s.team, owner: null, life: 1.2, r: 7, dmg: best.isMinion ? B.turretDmg * 1.6 : B.turretDmg, hk: "n", kind: "bolt", t: 0 });
      }
    }
  }
  function updateProjs(dt) {
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const p = G.projs[i]; p.t += dt; p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      let hit = false;
      if (p.life > 0) {
        const pr = { x0: p.x - p.r, x1: p.x + p.r, y0: p.y - p.r, y1: p.y + p.r };
        const fake = { team: p.team };
        for (const t of G.fighters) {
          if (t.team === p.team || t.dead || t.inv > 0) continue;
          const b = targetBox(t);
          if (pr.x1 < b.x0 || pr.x0 > b.x1 || pr.y1 < b.y0 || pr.y0 > b.y1) continue;
          damage(p.owner || { x: p.x - Math.sign(p.vx) * 5, team: p.team }, t, p.dmg, p.hk, pr); hit = true; break;
        }
        if (!hit && p.kind !== "bolt") for (const s of G.structs) {
          if (s.team === p.team || s.hp <= 0) continue;
          const b = targetBox(s);
          if (pr.x1 >= b.x0 && pr.x0 <= b.x1 && pr.y1 >= b.y0 && pr.y0 <= b.y1) { damage(p.owner, s, p.dmg, p.hk, pr); hit = true; break; }
        }
      }
      if (hit || p.life <= 0 || p.x < -40 || p.x > G.worldW + 40 || p.y > GROUND_Y + 10) { if (hit) spark(p.x, p.y); G.projs.splice(i, 1); }
    }
    for (let i = G.zones.length - 1; i >= 0; i--) {
      const z = G.zones[i]; z.t += dt;
      if (z.t > 0.1 && !z.hit) { z.hit = true; hitRect(z.owner, { x0: z.x - 16, x1: z.x + 16, y0: GROUND_Y - 70, y1: GROUND_Y }, z.dmg, "f"); }
      if (z.t > z.life) G.zones.splice(i, 1);
    }
  }

  function readInput(f) {
    const i = f.inp;
    const two = G.humans.length > 1;
    if (f.ctrl === "P1") {
      i.l = !!(keys.KeyA || (!two && keys.ArrowLeft)) || joyX < -0.3;
      i.r = !!(keys.KeyD || (!two && keys.ArrowRight)) || joyX > 0.3;
      i.j = !!(keys.KeyW || keys.KeyK && !two || (!two && keys.ArrowUp)) || i.jt;
      i.atk = !!(keys.KeyZ || keys.Space || keys.KeyF || (!two && keys.KeyJ)) || i.at;
    } else {
      i.l = !!(keys.KeyJ || keys.ArrowLeft); i.r = !!(keys.KeyL || keys.ArrowRight);
      i.j = !!(keys.KeyI || keys.ArrowUp); i.atk = !!(keys.KeyK || keys.Enter || keys.Slash);
    }
    return i;
  }

  const P1_SK = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, KeyX: 1, KeyC: 2, KeyV: 3 };
  const P2_SK = { Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4, Minus: 5, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5 };
  function humanOf(ctrl) { return G.fighters.find((f) => f.ctrl === ctrl); }
  window.addEventListener("keydown", (e) => {
    if (keys[e.code] && e.repeat) { if (e.code === "Space") e.preventDefault(); return; }
    keys[e.code] = true;
    if (!G.running || G.paused) return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    const p1 = humanOf("P1"), p2 = humanOf("P2");
    if (p1 && P1_SK[e.code]) doSkill(p1, P1_SK[e.code]);
    if (p2 && P2_SK[e.code]) doSkill(p2, P2_SK[e.code]);
    if (p1 && e.code === "KeyE") tryDash(p1);
    if (p2 && e.code === "KeyU") tryDash(p2);
    if (SFX) SFX.unlock();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  function canAct(f) { return !f.locked && f.stun <= 0 && !f.dead; }
  const DASH_SPEED = 460, DASH_TIME = 0.16, DASH_CD = 0.7;
  function tryDash(f) {
    if (!f || G.paused || !canAct(f) || f.dashCd > 0) return;
    const inp = f.inp;
    let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (!dir) dir = f.facing;
    f.dashDir = dir; f.dashT = DASH_TIME; f.dashCd = DASH_CD; f.inv = Math.max(f.inv, 0.14);
    f.facing = dir; f.vy = f.air ? 0 : f.vy;
    poof(f.x - dir * 10, f.y - f.def.boxH * (f.sizeMul || 1) * 0.5);
  }
  function tryAttack(f) {
    if (f.dead || f.stun > 0) return;
    if (f.state === "NAttack") { f.wantAtk = true; return; }
    if (f.locked) return;
    f.locked = true; f.wantAtk = false; f.vx *= 0.3;
    setState(f, "NAttack", true);
  }
  function doSkill(f, n) {
    if (!f || f.dead || f.stun > 0 || G.paused) return false;
    if (f.locked && f.state !== "NAttack") return false;
    if (n > f.def.nSkills) return false;
    const c = skillCfg(f, n); if (!c) return false;
    if (f.cd[n] > 0 || f.mp < c.mp) return false;
    f.mp -= c.mp; f.cd[n] = c.cooldown;
    f.locked = true; f.wantAtk = false; f.vx *= 0.1; f.armor = true;
    const st = "Skill0" + n;
    if (f.def.isMinato || f.def.frames[st]) setState(f, st, true);
    return true;
  }
  function finishState(f) {
    const st = f.state;
    f.armor = false;
    if (st === "Dead") { f.idx = getList(f, "Dead").length - 1; return; }
    if (st === "KnockDown") { f.locked = false; f.stun = 0; f.inv = Math.max(f.inv, 0.5); setState(f, f.air ? "Float" : "Idle", true); return; }
    if (st === "Hurt" || st === "AirHurt" || st === "Float") { if (f.stun > 0) { f.idx = getList(f, st).length - 1; return; } }
    f.locked = false; f.tele = 0; if (f.inv > 3) f.inv = 0;
    setState(f, f.air ? "Float" : "Idle", true);
  }

  function stepAnim(f, dt) {
    const list = getList(f, f.state); if (!list || !list.length) return;
    f.timer += dt;
    let guard = 0;
    while (guard++ < 8 && f.timer >= frameDur(f, list, Math.min(f.idx, list.length - 1))) {
      f.timer -= frameDur(f, list, Math.min(f.idx, list.length - 1));
      f.idx++;
      if (f.state === "NAttack") {
        const ends = f.def.isMinato ? CD.minato.basic.segmentEnds : f.def.segEnds || [];
        const atEnd = f.idx >= list.length;
        if (atEnd || ends.includes(f.idx)) {
          if (f.wantAtk || f.inp.atk || f.ai.atkOn) {
            f.wantAtk = false;
            if (atEnd) { f.idx = 0; if (f.sfx && SFX) { SFX.resetAnimSounds(f.uid); SFX.onFrame("NAttack", 0, f.uid); } }
          } else { f.locked = false; setState(f, f.air ? "Float" : "Idle", true); return; }
        }
      } else if (f.idx >= list.length) {
        const loop = f.state === "Idle" || f.state === "Walk";
        if (loop) f.idx = 0;
        else if (f.state === "Float") f.idx = list.length - 1;
        else { finishState(f); return; }
      }
      enterFrame(f, f.idx);
      if (f.sfx && SFX && f.state !== "Idle" && f.state !== "Walk") SFX.onFrame(f.state, f.idx, f.uid);
      if (f.state !== "Idle" && f.dead && f.state === "Dead") break;
    }
  }

  function nearestEnemy(f, maxD, fightersOnly) {
    let best = null, bd = maxD;
    for (const t of G.fighters) { if (t.team === f.team || t.dead) continue; if (fightersOnly && t.isMinion) continue; const d = Math.abs(t.x - f.x); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  function objective(f) {
    let best = null, bd = 1e9;
    for (const s of G.structs) { if (s.team === f.team || s.hp <= 0 || (s.kind === "base" && s.locked)) continue; const d = Math.abs(s.x - f.x); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function aiThink(f, dt) {
    const cfg = CD.ai[G.diff] || CD.ai.normal, a = f.ai, inp = f.inp;
    inp.l = inp.r = inp.j = false; f.ai.atkOn = false;
    a.t -= dt;
    if (a.t <= 0) {
      const react = f.isMinion ? [0.3, 0.6] : cfg.react;
      a.t = rand(react[0], react[1]); a.aggr = f.isMinion ? true : Math.random() < cfg.aggression;
      a.hold = rand(cfg.hold[0], cfg.hold[1]); a.skill = !f.isMinion && Math.random() < cfg.skill; a.jump = Math.random() < 0.07;
    }
    if (G.mode === "rush" && f.team === 1) a.aggr = true;
    let tgt = nearestEnemy(f, f.isMinion ? 130 : 260, false), tx = null, tdist = 999, isStruct = false;
    if (tgt) { tx = tgt.x; tdist = Math.abs(tx - f.x); }
    else if (G.mode === "battle") {
      const o = objective(f);
      if (o) { tx = o.x; tdist = Math.abs(tx - f.x); isStruct = true; }
    } else if (G.mode === "rush" && f.team === 1) {
      const p = nearestEnemy(f, 2000, true); if (p) { tx = p.x; tdist = Math.abs(tx - f.x); tgt = p; }
    } else { const p = nearestEnemy(f, 2000, false); if (p) { tx = p.x; tdist = Math.abs(tx - f.x); tgt = p; } }
    if (tx === null) return inp;
    const reach = f.def.reach * (isStruct ? 1.0 : 0.85);
    const structNear = G.mode === "battle" && !isStruct && objective(f) && Math.abs(objective(f).x - f.x) < reach + 20;
    const lowHp = !f.isMinion && G.mode === "battle" && f.hp < f.maxHp * 0.25;
    if (lowHp) { const home = f.team === 0 ? 150 : G.worldW - 150; if (f.x > home + 20) inp.l = home < f.x; if (f.x < home - 20) inp.r = true; if (f.x > home + 20) inp.l = true; inp.r = f.x < home - 20; }
    else if (tdist > reach) { if (tx > f.x) inp.r = true; else inp.l = true; }
    else if (!a.aggr && tdist < reach * 0.5) { if (tx > f.x) inp.l = true; else inp.r = true; }
    if (!lowHp && tdist <= reach + 6) {
      if (tx !== f.x) f.facing = tx > f.x ? 1 : -1;
      a.atkT -= dt;
      if (a.aggr || isStruct) {
        if (a.pause > 0) a.pause -= dt;
        else { a.atkT += 0; f.ai.atkOn = true; inp.atk = true; a.holdLeft = (a.holdLeft == null ? a.hold : a.holdLeft) - dt; if (a.holdLeft <= 0) { a.pause = rand(0.25, 0.7); a.holdLeft = null; } }
      }
    }
    if (a.skill && !f.locked && f.stun <= 0 && !f.isMinion && f.skillLockout <= 0) {
      const opts = [];
      for (let n = 1; n <= f.def.nSkills; n++) {
        const c = skillCfg(f, n); if (!c || f.cd[n] > 0 || f.mp < c.mp) continue;
        const rng = f.def.isMinato ? c.range : (n === 2 ? 220 : n === 3 ? 130 : 110);
        if (tdist <= rng && tdist > 24) opts.push(n);
      }
      if (opts.length) { f.facing = tx > f.x ? 1 : -1; if (doSkill(f, rnd(opts))) { a.skill = false; f.skillLockout = rand(1.6, 2.4); } }
    }
    if (a.jump && !f.air && f.stun <= 0 && !f.locked) { inp.j = true; a.jump = false; }
    if (inp.l || inp.r) if (!inp.atk && f.state !== "NAttack") f.facing = inp.r ? 1 : -1;
    return inp;
  }

  function updateFighter(f, dt) {
    if (f.dead) {
      f.deadT += dt; stepAnim(f, dt);
      f.vx *= 0.9; f.x += f.vx * dt; f.vy += GRAV * dt; f.y = Math.min(GROUND_Y, f.y + f.vy * dt); if (f.y >= GROUND_Y) f.vy = 0;
      if (f.isMinion || (G.mode === "rush" && f.team === 1)) { if (f.deadT > 1.6) f.remove = true; }
      else if (G.mode === "battle") { f.respawn -= dt; if (f.respawn <= 0) respawnFighter(f); }
      return;
    }
    f.mp = Math.min(100, f.mp + 6 * dt);
    for (let n = 1; n <= 5; n++) if (f.cd[n] > 0) f.cd[n] = Math.max(0, f.cd[n] - dt);
    if (f.dashCd > 0) f.dashCd = Math.max(0, f.dashCd - dt);
    if (f.skillLockout > 0) f.skillLockout = Math.max(0, f.skillLockout - dt);
    if (f.inv > 0) f.inv -= dt;
    if (f.stun > 0) { f.stun -= dt; if (f.stun <= 0) { f.stun = 0; f.inv = Math.max(f.inv, 0.6); if (f.state === "Hurt" || f.state === "AirHurt" || f.state === "Float") { f.locked = false; setState(f, f.air ? "Float" : "Idle", true); } } }
    if (!f.isMinion) {
      const still = f.state === "Idle" && !f.locked && f.stun <= 0 && !f.air && Math.abs(f.vx) < 1;
      if (still && f.hp < f.maxHp) {
        f.stillT += dt;
        if (f.stillT >= 2) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.2); f.stillT = 0; floatText(f.x, f.y - f.def.boxH * (f.sizeMul || 1) - 14, "+HP", "#3ecf4a"); }
      } else f.stillT = 0;
    }
    if (G.mode === "battle" && !f.isMinion) {
      const home = f.team === 0 ? 150 : G.worldW - 150;
      if (Math.abs(f.x - home) < 90) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.08 * dt); f.mp = Math.min(100, f.mp + 12 * dt); }
    }
    const inp = f.ctrl === "AI" ? aiThink(f, dt) : readInput(f);
    const free = canAct(f);
    if (free) {
      if (f.dashT > 0) {
        f.dashT -= dt; f.vx = f.dashDir * DASH_SPEED;
      } else {
        const mv = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
        if (mv) { f.vx = mv * WALK * f.spd; f.facing = mv; } else f.vx = 0;
      }
      if (inp.j && !f.air) { f.vy = -JUMP_V; f.air = true; }
      if (inp.atk) tryAttack(f);
      if (!f.locked) {
        if (f.air) { if (f.state !== "Float") setState(f, "Float", true); }
        else if (Math.abs(f.vx) > 8) setState(f, "Walk"); else setState(f, "Idle");
      }
    } else if (f.state === "NAttack") { f.vx *= Math.pow(0.02, dt); if (inp.l || inp.r) { const m = inp.r ? 1 : -1; if (!inp.atk) f.facing = m; } if (inp.atk) f.wantAtk = true; }
    else f.vx *= Math.pow(0.03, dt);
    if (inp.atk) f.atkHeld = true; else f.atkHeld = false;
    f.vy += GRAV * dt; f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y >= GROUND_Y) {
      f.y = GROUND_Y; f.vy = 0;
      if (f.air) { f.air = false; if (!f.locked && f.stun <= 0) setState(f, "Idle", true); }
    } else f.air = true;
    f.x = clamp(f.x, 20, G.worldW - 20);
    if (f.state === "Float" && f.locked && f.stun > 0 && !f.air) { f.stun = Math.min(f.stun, 0.1); }
    stepAnim(f, dt);
  }
  function respawnFighter(f) {
    f.dead = false; f.deadT = 0; f.hp = f.maxHp; f.mp = 100; f.locked = false; f.stun = 0; f.inv = 2; f.armor = false;
    f.x = f.team === 0 ? 190 + rand(0, 40) : G.worldW - 190 - rand(0, 40); f.y = GROUND_Y; f.vx = f.vy = 0; f.facing = f.team === 0 ? 1 : -1;
    setState(f, "Idle", true); poof(f.x, f.y - 30);
  }

  function baseX(team) { return team === 0 ? 190 : G.worldW - 190; }
  function reset() { G.fighters = []; G.structs = []; G.projs = []; G.zones = []; G.fxs = []; G.texts = []; G.humans = []; G.kills = [0, 0]; G.ended = false; G.time = 0; G.score = 0; G.wave = 0; G.minionT = 6; G.roundState = "play"; }

  function startMatch(fromRestart) {
    const mode = L.mode, n = slotCount();
    G.mode = mode; G.diff = L.diff; G.size = L.size;
    reset(); document.body.classList.add("playing");
    if (mode === "battle") { G.worldW = CD.battle.worldW; makeStructs(G.worldW); }
    else G.worldW = Math.max(viewW, 560);
    if (mode === "versus") { G.wins = [0, 0]; G.round = 1; }
    const A_ = L.teamA.slice(0, n), B_ = L.teamB.slice(0, n);
    A_.forEach((s, i) => spawnSlot(s, 0, i, n));
    if (mode !== "rush") B_.forEach((s, i) => spawnSlot(s, 1, i, n));
    G.humans = G.fighters.filter(isHuman);
    G.cam.x = 0;
    if (mode === "rush") { G.wave = 0; nextWave(); }
    bindHud(); setScene("play");
    showBanner(mode === "versus" ? "ROUND 1" : mode === "rush" ? "RUSH" : "BATTLE", 1400);
    G.running = true; G.paused = false;
    if (SFX) SFX.resetVoice && SFX.resetVoice();
  }
  function spawnSlot(s, team, i, n) {
    let x;
    if (G.mode === "battle") x = baseX(team) + (team === 0 ? 1 : -1) * (i * 26);
    else x = team === 0 ? G.worldW * 0.3 - i * 40 : G.worldW * 0.7 + i * 40;
    const f = makeFighter(s.c, team, s.k === "CPU" ? "AI" : s.k, x);
    G.fighters.push(f);
  }

  function nextWave() {
    G.wave++; const w = G.wave;
    G.waveLeft = 3 + w * 2; G.spawnLeft = G.waveLeft; G.spawnT = 1.2;
    showBanner("WAVE " + w, 1300);
    if (w > 1) for (const f of G.fighters) if (f.team === 0 && !f.dead) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * CD.rush.healPerWave);
  }
  function spawnRush() {
    const w = G.wave;
    let tier = "monster";
    const r = Math.random();
    if (w >= 5 && r < 0.18) tier = "elite"; else if (w >= 3 && r < 0.45) tier = "mid";
    else if (w >= 2 && r < 0.25) tier = "mid";
    const id = rnd(CD.rush.tiers[tier]);
    const side = Math.random() < 0.5 ? 0 : 1;
    const x = side ? G.worldW - 30 : 30;
    const hpMul = 0.55 + w * 0.06;
    const f = makeFighter(id, 1, "AI", x, { tier, hp: Math.round(DEFS[id].maxHp * hpMul * (tier === "elite" ? 1.1 : 0.7)), dmgMul: 0.45 + w * 0.04, spd: 0.75 + Math.min(w, 8) * 0.03 });
    f.isRushEnemy = true;
    f.name = DEFS[id].name; G.fighters.push(f);
  }

  const MINION_CAP = 4;
  const MINION_SCALE = 0.62;
  function spawnMinions() {
    const B = CD.battle, ids = ["DudeMonster", "OwletMonster", "PinkMonster"];
    for (let t = 0; t < 2; t++) {
      const alive = G.fighters.filter((f) => f.isMinion && f.team === t && !f.dead).length;
      const n = Math.max(0, Math.min(B.minionCount, MINION_CAP - alive));
      for (let i = 0; i < n; i++) {
        const f = makeFighter(rnd(ids), t, "AI", baseX(t) + (t === 0 ? 1 : -1) * (40 + i * 20), { minion: true, hp: B.minionHp, dmgMul: B.minionDmg / 8, scale: MINION_SCALE });
        f.spd *= 0.8; f.name = "Minion"; G.fighters.push(f);
      }
    }
  }

  function humansAlive() { return G.humans.some((h) => !h.dead); }
  function teamAlive(t) { return G.fighters.some((f) => f.team === t && !f.dead && !f.isMinion); }

  function endMatch(winTeam, why) {
    if (G.ended) return; G.ended = true;
    G.running = true;
    const p1 = humanOf("P1");
    let title = "", sub = why || "";
    if (G.mode === "rush") { title = "GAME OVER"; sub = "Wave " + G.wave + " · Skor " + G.score + best("rush", G.score); }
    else {
      const won = winTeam === (p1 ? p1.team : 0);
      title = winTeam < 0 ? "SERI" : (won ? "MENANG" : "KALAH");
      if (G.mode === "versus" && G.humans.length > 1) title = "TIM " + (winTeam + 1) + " MENANG";
      sub += (sub ? " · " : "") + "Kill " + G.kills[0] + " : " + G.kills[1];
    }
    setTimeout(() => { $("result-title").textContent = title; $("result-sub").textContent = sub; $("result").classList.remove("hidden"); G.paused = true; }, 1300);
    showBanner(G.mode === "rush" ? "KO" : title, 1300);
  }
  function best(k, v) {
    try { const key = "minato_best_" + k, o = parseInt(localStorage.getItem(key) || "0", 10); if (v > o) { localStorage.setItem(key, String(v)); return o ? " · Rekor baru" : ""; } return " · Rekor " + o; } catch (_) { return ""; }
  }

  function updateMode(dt) {
    G.time += dt;
    if (G.mode === "battle") {
      G.minionT -= dt; if (G.minionT <= 0) { G.minionT = CD.battle.minionEvery; spawnMinions(); }
      updateStructs(dt);
      if (!G.ended && G.time > CD.battle.time) {
        const cnt = (t) => G.structs.filter((s) => s.team !== t && s.hp <= 0).length;
        const a = cnt(0), b = cnt(1);
        endMatch(a > b ? 0 : b > a ? 1 : G.kills[0] > G.kills[1] ? 0 : G.kills[1] > G.kills[0] ? 1 : -1, "Waktu habis");
      }
    } else if (G.mode === "versus") {
      if (G.roundState === "play") {
        if (!teamAlive(0) || !teamAlive(1) || G.time > CD.versus.time) {
          const a0 = teamAlive(0), a1 = teamAlive(1);
          let w = -1;
          if (a0 && !a1) w = 0; else if (a1 && !a0) w = 1;
          else if (a0 && a1) { const h = (t) => G.fighters.filter((f) => f.team === t).reduce((s, f) => s + f.hp, 0); w = h(0) > h(1) ? 0 : h(1) > h(0) ? 1 : -1; }
          if (w >= 0) G.wins[w]++;
          G.roundState = "end"; G.roundT = 1.8;
          showBanner(w < 0 ? "SERI" : "KO", 1400);
          if (G.wins[0] >= 2 || G.wins[1] >= 2 || G.round >= CD.versus.rounds) endMatch(G.wins[0] > G.wins[1] ? 0 : G.wins[1] > G.wins[0] ? 1 : -1, G.wins[0] + " - " + G.wins[1]);
        }
      } else if (G.roundState === "end" && !G.ended) {
        G.roundT -= dt;
        if (G.roundT <= 0) newRound();
      }
    } else if (G.mode === "rush") {
      if (G.spawnLeft > 0) { G.spawnT -= dt; const alive = G.fighters.filter((f) => f.team === 1 && !f.dead).length; if (G.spawnT <= 0 && alive < 4 + Math.min(G.wave, 5)) { G.spawnT = Math.max(0.5, 1.6 - G.wave * 0.08); G.spawnLeft--; spawnRush(); } }
      else if (G.waveLeft <= 0 && !G.ended) nextWave();
      if (!G.ended && !humansAlive()) endMatch(1, "");
    }
  }
  function newRound() {
    G.round++; G.time = 0; G.roundState = "play"; G.projs = []; G.zones = [];
    G.fighters.forEach((f, i) => { f.dead = false; f.hp = f.maxHp; f.mp = 100; f.locked = false; f.stun = 0; f.inv = 0.5; f.armor = false; f.y = GROUND_Y; f.vx = f.vy = 0; f.cd = [0, 0, 0, 0, 0, 0];
      f.x = f.team === 0 ? G.worldW * 0.3 : G.worldW * 0.7; f.facing = f.team === 0 ? 1 : -1; setState(f, "Idle", true); });
    showBanner("ROUND " + G.round, 1200);
  }

  function update(dt) {
    if (!G.running || G.paused) return;
    for (const f of G.fighters) updateFighter(f, dt);
    for (let i = G.fighters.length - 1; i >= 0; i--) if (G.fighters[i].remove) G.fighters.splice(i, 1);
    updateProjs(dt);
    updateMode(dt);
    for (let i = G.fxs.length - 1; i >= 0; i--) { const e = G.fxs[i]; e.t += dt; if (e.t >= e.life) G.fxs.splice(i, 1); }
    for (let i = G.texts.length - 1; i >= 0; i--) { const e = G.texts[i]; e.t += dt; if (e.t > (e.long ? 1.6 : 0.8)) G.texts.splice(i, 1); }

    const hs = G.humans.filter((h) => !h.dead);
    if (G.worldW > viewW + 4) {
      let cx = hs.length ? hs.reduce((s, h) => s + h.x, 0) / hs.length : G.cam.x + viewW / 2;
      const target = clamp(cx - viewW / 2, 0, G.worldW - viewW);
      G.cam.x += (target - G.cam.x) * Math.min(1, dt * 6);
    } else G.cam.x = 0;
    updateHud();
  }

  function hillPath(cx, off, amp1, amp2, freq1, freq2, baseH) {
    ctx.beginPath(); ctx.moveTo(cx, GROUND_Y);
    for (let x = 0; x <= viewW + 60; x += 30) {
      const wx = x + cx + off;
      const h = baseH + amp1 * Math.sin(wx * freq1) + amp2 * Math.sin(wx * freq2 + 1.7);
      ctx.lineTo(cx + x, GROUND_Y - h);
    }
    ctx.lineTo(cx + viewW + 60, GROUND_Y); ctx.closePath();
  }
  function drawBackground() {
    const cx = G.cam.x, hd = settings.quality !== "low";
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, "#0d1324"); sky.addColorStop(0.55, "#1a2340"); sky.addColorStop(1, "#2c3a5e");
    ctx.fillStyle = sky; ctx.fillRect(cx, 0, viewW, GROUND_Y);
    if (hd) {
      const moonX = cx * 0.05 + 420, moonY = 58;
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "#eef2ff";
      ctx.beginPath(); ctx.arc(moonX % (viewW + 300) - 60, moonY, 22, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = "#0d1324";
      ctx.beginPath(); ctx.arc((moonX % (viewW + 300) - 60) + 8, moonY - 5, 22, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 0; i < 26; i++) {
        const sx = (i * 137 - cx * 0.08) % (viewW + 40);
        const sy = (i * 53) % 150 + 10;
        ctx.globalAlpha = 0.3 + ((i * 29) % 70) / 100;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    hillPath(cx, cx * -0.12, 30, 14, 0.006, 0.02, 150);
    ctx.fillStyle = "#141b30"; ctx.fill();
    hillPath(cx, cx * -0.3, 36, 18, 0.009, 0.023, 108);
    ctx.fillStyle = "#1c2440"; ctx.fill();
    hillPath(cx, cx * -0.55, 38, 22, 0.011, 0.027, 70);
    ctx.fillStyle = "#283457"; ctx.fill();
    if (hd) {
      ctx.fillStyle = "rgba(10,14,28,.55)";
      for (let x = Math.floor((cx * 0.8) / 70) * 70; x < cx + viewW + 70; x += 70) {
        const wx = x - cx * 0.8, bob = 6 * Math.sin(wx * 0.05);
        const bh = 20 + ((Math.floor(x / 70) * 37) % 18) + bob;
        ctx.beginPath(); ctx.ellipse(x, GROUND_Y - bh * 0.3, 16, bh, 0, 0, 7); ctx.fill();
      }
    }
    const ground = ctx.createLinearGradient(0, GROUND_Y, 0, VH);
    ground.addColorStop(0, "#352616"); ground.addColorStop(1, "#1c140b");
    ctx.fillStyle = ground; ctx.fillRect(cx, GROUND_Y, viewW, VH - GROUND_Y);
    ctx.fillStyle = "#4a3620"; ctx.fillRect(cx, GROUND_Y, viewW, 4);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = Math.floor(cx / 80) * 80; x < cx + viewW + 80; x += 80) ctx.fillRect(x, GROUND_Y + 14, 40, 2);
    if (hd) {
      for (let x = Math.floor(cx / 46) * 46; x < cx + viewW + 46; x += 46) {
        const seed = Math.floor(x / 46);
        ctx.fillStyle = seed % 3 === 0 ? "rgba(120,160,90,.25)" : "rgba(0,0,0,.18)";
        const yy = GROUND_Y + 6 + (seed % 4) * 9;
        ctx.beginPath(); ctx.ellipse(x + (seed % 13), yy, 10, 3, 0, 0, 7); ctx.fill();
      }
    }
  }
  function drawStruct(s) {
    const t1 = s.team === 0 ? "#3b82c4" : "#d64545";
    const x = s.x, y = GROUND_Y;
    ctx.save();
    if (s.hp <= 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = "#3a3a3a"; ctx.fillRect(x - s.w / 2, y - 12, s.w, 12); ctx.restore(); return; }
    if (s.kind === "turret") {
      ctx.fillStyle = "#4a4d57"; ctx.fillRect(x - 13, y - 56, 26, 56);
      ctx.fillStyle = "#5c606c"; ctx.fillRect(x - 17, y - 66, 34, 12);
      ctx.fillStyle = t1; ctx.fillRect(x - 9, y - s.h, 18, 10);
      ctx.fillStyle = "#222"; ctx.fillRect(x - 3, y - 36, 6, 14);
    } else {
      ctx.fillStyle = "#4a4d57"; ctx.fillRect(x - 40, y - 62, 80, 62);
      ctx.fillStyle = "#5c606c"; ctx.fillRect(x - 46, y - 74, 92, 12);
      ctx.fillStyle = t1; ctx.fillRect(x - 12, y - 92, 24, 18);
      ctx.fillStyle = s.locked ? "#8a8f9a" : "#222"; ctx.fillRect(x - 10, y - 34, 20, 34);
    }
    ctx.restore();
    const bw = s.kind === "base" ? 70 : 40;
    ctx.fillStyle = "#000a"; ctx.fillRect(x - bw / 2, y - s.h - 10, bw, 5);
    ctx.fillStyle = t1; ctx.fillRect(x - bw / 2, y - s.h - 10, bw * s.hp / s.maxHp, 5);
  }
  function drawBars(f) {
    if (f.dead) return;
    const frac = clamp(f.hp / f.maxHp, 0, 1);
    if (f.isMinion) {

      const bw = 15, bh = 2, y = f.y - f.def.boxH * (f.sizeMul || 1) - 6;
      ctx.fillStyle = "#7a2020"; ctx.fillRect(f.x - bw / 2, y, bw, bh);
      ctx.fillStyle = "#3ecf4a"; ctx.fillRect(f.x - bw / 2, y, bw * frac, bh);
      return;
    }
    const bw = 34, bh = 4, y = f.y - f.def.boxH * (f.sizeMul || 1) - 10;
    ctx.fillStyle = "#000a"; ctx.fillRect(f.x - bw / 2, y, bw, bh);
    ctx.fillStyle = f.team === 0 ? "#3b82c4" : "#d64545";
    ctx.fillRect(f.x - bw / 2, y, bw * frac, bh);
    if (!(G.mode === "rush" && f.team === 1)) {
      ctx.fillStyle = "#fff"; ctx.font = "8px system-ui,sans-serif"; ctx.textAlign = "center";
      const tag = f.ctrl === "P1" ? "P1" : f.ctrl === "P2" ? "P2" : f.name;
      ctx.fillText(tag, f.x, y - 4);
    }
  }
  function drawFx() {
    for (const e of G.fxs) {
      if (e.t < 0) continue;
      const p = e.t / e.life;
      if (e.type === "ring") { ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = e.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + p * e.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      else if (e.type === "sprite") {
        const img = A.fx[e.n], nf = A.meta.effects[e.n], i = Math.min(nf - 1, Math.floor(p * nf)), s = e.s;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.flip < 0 ? -s : s, s); ctx.drawImage(img, i * 72, 0, 72, 72, -36, -64, 72, 72); ctx.restore();
      }
    }
    for (const z of G.zones) {
      if (z.t < 0) continue;
      const nf = A.meta.effects[1], i = Math.min(nf - 1, Math.floor(z.t / z.life * nf));
      ctx.drawImage(A.fx[1], i * 72, 0, 72, 72, z.x - 40, GROUND_Y - 68, 80, 80);
    }
    for (const p of G.projs) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.kind === "fire") { const nf = A.meta.effects[6], i = Math.floor(p.t * 14) % nf; if (p.vx < 0) ctx.scale(-1, 1); ctx.drawImage(A.fx[6], i * 72, 0, 72, 72, -22, -38, 44, 44); }
      else if (p.kind === "kunai") { ctx.rotate(p.t * 20); ctx.fillStyle = "#ddd"; ctx.fillRect(-6, -1.5, 12, 3); }
      else { ctx.fillStyle = p.team === 0 ? "#7ec4ff" : "#ff8a8a"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.textAlign = "center";
    for (const t of G.texts) {
      const p = t.t / (t.long ? 1.6 : 0.8);
      ctx.save(); ctx.globalAlpha = 1 - p * p; ctx.fillStyle = t.c; ctx.font = (t.long ? "bold 12px" : "bold 10px") + " system-ui,sans-serif";
      ctx.fillText(t.s, t.x, t.y - p * 24); ctx.restore();
    }
  }
  function drawMini() {
    if (G.mode !== "battle") { mini.style.display = "none"; return; }
    mini.style.display = "block";
    const W = mini.width, H = mini.height, sx = W / G.worldW;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = "#1c2030"; mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = "#3d2e1f"; mctx.fillRect(0, H - 8, W, 8);
    for (const s of G.structs) {
      mctx.fillStyle = s.hp <= 0 ? "#444" : s.team === 0 ? "#3b82c4" : "#d64545";
      const w = s.kind === "base" ? 12 : 6, h = s.kind === "base" ? 16 : 11;
      mctx.fillRect(s.x * sx - w / 2, H - 8 - h, w, h);
    }
    for (const f of G.fighters) {
      if (f.dead) continue;
      mctx.fillStyle = f.team === 0 ? "#7ec4ff" : "#ff8a8a";
      const r = f.isMinion ? 1.5 : isHuman(f) ? 4 : 3;
      mctx.beginPath(); mctx.arc(f.x * sx, H - 12, r, 0, 7); mctx.fill();
      if (isHuman(f)) { mctx.strokeStyle = "#f0b429"; mctx.lineWidth = 1; mctx.stroke(); }
    }
    mctx.strokeStyle = "#fff"; mctx.lineWidth = 1; mctx.strokeRect(G.cam.x * sx, 1, viewW * sx, H - 2);
  }
  function drawReflections() {
    const op = settings.reflectOpacity;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.translate(0, GROUND_Y * 2);
    ctx.scale(1, -1);
    for (const f of G.fighters) {
      if (f.dead) continue;
      drawFighter(f);
    }
    for (const e of G.fxs) {
      if (e.type !== "sprite" || e.t < 0) continue;
      const p = e.t / e.life, img = A.fx[e.n], nf = A.meta.effects[e.n], i = Math.min(nf - 1, Math.floor(p * nf));
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.flip < 0 ? -e.s : e.s, e.s); ctx.drawImage(img, i * 72, 0, 72, 72, -36, -64, 72, 72); ctx.restore();
    }
    ctx.restore();
  }
  let frameAlpha = 1;
  function draw() {
    ctx.setTransform(dpr * ppu, 0, 0, dpr * ppu, 0, 0);
    ctx.imageSmoothingEnabled = !!settings.upscale;
    ctx.save(); ctx.translate(-G.cam.x, 0);
    drawBackground();
    if (settings.reflection) drawReflections();
    for (const s of G.structs) drawStruct(s);
    const order = G.fighters.slice().sort((a, b) => (a.dead ? -1 : 0) - (b.dead ? -1 : 0));
    const snap = [];
    for (const f of order) {
      const ox = f.x, oy = f.y;
      if (settings.frameGen && f.rx != null) { f.x = f.rx + (ox - f.rx) * frameAlpha; f.y = f.ry + (oy - f.ry) * frameAlpha; }
      if (settings.shadow) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(f.x, GROUND_Y + 2, f.def.halfW * 1.2, 4, 0, 0, 7); ctx.fill(); }
      drawFighter(f);
      snap.push([f, ox, oy]);
    }
    for (const f of G.fighters) drawBars(f);
    drawFx();
    for (const [f, ox, oy] of snap) { f.x = ox; f.y = oy; }
    ctx.restore();
    drawMini();
  }

  let hudP1 = null, hudP2 = null;
  function bindHud() {
    hudP1 = humanOf("P1") || G.fighters[0]; hudP2 = humanOf("P2");
    $("p1-name").textContent = "P1 · " + hudP1.name;
    avatarInto($("p1-avatar"), hudP1.def.id);
    $("p2-panel").classList.toggle("hidden", !hudP2);
    if (hudP2) { $("p2-name").textContent = "P2 · " + hudP2.name; avatarInto($("p2-avatar"), hudP2.def.id); }
    const row = $("skill-row"); row.innerHTML = "";
    for (let n = 1; n <= hudP1.def.nSkills; n++) {
      const s = document.createElement("div"); s.className = "skill-slot"; s.dataset.n = n;
      const addGlyph = () => { const g = document.createElement("div"); g.className = "glyph"; g.textContent = "S" + n; s.appendChild(g); };
      if (hudP1.def.isMinato && A.icons[n]) {
        const im = document.createElement("img"); im.alt = ""; im.onerror = () => { im.remove(); addGlyph(); }; im.src = A.icons[n].src; s.appendChild(im);
      } else addGlyph();
      const k = document.createElement("span"); k.className = "key"; k.textContent = n; s.appendChild(k);
      const cd = document.createElement("div"); cd.className = "cd"; s.appendChild(cd);
      const press = (e) => { e.preventDefault(); if (G.running && !G.paused) doSkill(hudP1, n); };
      s.addEventListener("click", press); s.addEventListener("touchend", press, { passive: false });
      row.appendChild(s);
    }
    for (let n = 1; n <= 5; n++) {
      const btn = $("btn-skill" + n);
      btn.classList.toggle("off", n > hudP1.def.nSkills);
      btn.style.backgroundImage = (hudP1.def.isMinato && A.icons[n]) ? `url(${A.icons[n].src})` : "none";
    }
    $("btn-voice").style.display = hudP1.def.isMinato ? "" : "none";
    $("score-sub").textContent = "";
  }
  function updateHud() {
    const p = hudP1; if (!p) return;
    $("p1-hp").style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + "%"; $("p1-mp").style.width = p.mp + "%";
    if (hudP2) { $("p2-hp").style.width = clamp(hudP2.hp / hudP2.maxHp, 0, 1) * 100 + "%"; $("p2-mp").style.width = hudP2.mp + "%"; }
    document.querySelectorAll(".skill-slot").forEach((s) => {
      const n = +s.dataset.n, cd = p.cd[n], c = skillCfg(p, n), cdEl = s.querySelector(".cd");
      if (cd > 0) { cdEl.style.display = "flex"; cdEl.textContent = Math.ceil(cd); } else cdEl.style.display = "none";
      s.classList.toggle("off", cd <= 0 && p.mp < c.mp);
    });
    for (let n = 1; n <= p.def.nSkills; n++) {
      const btn = $("btn-skill" + n), cd = p.cd[n], c = skillCfg(p, n), num = btn.querySelector(".cdnum");
      num.textContent = cd > 0 ? Math.ceil(cd) : "";
      btn.classList.toggle("off", n > p.def.nSkills || (cd <= 0 && p.mp < c.mp));
    }
    let a, b, sub = "";
    if (G.mode === "battle") {
      a = G.kills[0]; b = G.kills[1];
      const tl = (t) => G.structs.filter((s) => s.team === t && s.kind === "turret" && s.hp > 0).length;
      const mm = Math.max(0, Math.ceil(CD.battle.time - G.time)), m = Math.floor(mm / 60), ss = String(mm % 60).padStart(2, "0");
      sub = "Turret " + tl(0) + " – " + tl(1) + " · " + m + ":" + ss + (p.dead ? " · respawn " + Math.ceil(p.respawn) : "");
    } else if (G.mode === "versus") {
      a = G.wins[0]; b = G.wins[1]; sub = "Ronde " + G.round + " · " + Math.max(0, Math.ceil(CD.versus.time - G.time)) + "s";
    } else { a = G.score; b = G.wave; sub = "Skor · Wave"; }
    $("score-a").textContent = a; $("score-b").textContent = b; $("score-sub").textContent = sub;
  }
  let bannerTO = 0;
  function showBanner(t, ms) { const b = $("banner"); b.textContent = t; b.classList.add("show"); clearTimeout(bannerTO); bannerTO = setTimeout(() => b.classList.remove("show"), ms || 1200); }

  function setScene(s) {
    G.scene = s;
    for (const id of ["menu", "lobby", "result", "loading", "hudcfg", "settings"]) $(id).classList.toggle("hidden", id !== s);
    $("hud").classList.toggle("hidden", s !== "play");
    document.body.classList.toggle("playing", s === "play");
    if (s !== "play") { G.running = false; $("banner").classList.remove("show"); }
  }

  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  async function toggleFs() {
    try {
      if (isFs()) { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) await document.webkitExitFullscreen(); }
      else { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); }
    } catch (_) {}
    $("btn-fullscreen").textContent = isFs() ? "Exit FS" : "Fullscreen";
  }
  function setAppSizeVar() {

    const w = window.innerWidth, h = window.innerHeight;
    document.documentElement.style.setProperty("--app-width", w + "px");
    document.documentElement.style.setProperty("--app-height", h + "px");
    return { w, h };
  }
  function resize() {
    const cap = settings.quality === "low" ? 1 : 2;
    let extra = settings.quality === "low" ? 0.72 : 1;
    if (settings.upscale) extra *= 0.6;
    dpr = Math.min(window.devicePixelRatio || 1, cap) * extra;
    const { w, h } = setAppSizeVar();
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    ppu = h / VH; viewW = w / ppu;
    if (G.mode !== "battle" && G.scene === "play") G.worldW = Math.max(viewW, 560);
  }

  function kickControlsRepaint() {
    const el = $("mobile-controls"); if (!el) return;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = "";
  }
  function onFsChange() {
    $("btn-fullscreen").textContent = isFs() ? "Exit FS" : "Fullscreen";
    resize(); kickControlsRepaint();

    [80, 250, 500, 900].forEach((ms) => setTimeout(() => { resize(); kickControlsRepaint(); }, ms));
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => { resize(); kickControlsRepaint(); });
  }

  function bindHold(id, down, up) {
    const el = $(id); if (!el) return;
    const d = (e) => { e.preventDefault(); el.classList.add("pressed"); down && down(); };
    const u = (e) => { e.preventDefault(); el.classList.remove("pressed"); up && up(); };
    el.addEventListener("touchstart", d, { passive: false }); el.addEventListener("touchend", u, { passive: false });
    el.addEventListener("touchcancel", u, { passive: false }); el.addEventListener("mousedown", d);
    el.addEventListener("mouseup", u); el.addEventListener("mouseleave", u);
  }
  function p1() { return humanOf("P1"); }
  bindHold("btn-attack", () => { const f = p1(); if (f) f.inp.at = true; }, () => { const f = p1(); if (f) f.inp.at = false; });
  bindHold("btn-dash", () => { const f = p1(); if (f && G.running && !G.paused) tryDash(f); });
  bindHold("btn-jump", () => { const f = p1(); if (f) f.inp.jt = true; }, () => { const f = p1(); if (f) f.inp.jt = false; });
  for (let n = 1; n <= 5; n++) bindHold("btn-skill" + n, () => { const f = p1(); if (f && G.running && !G.paused) doSkill(f, n); });
  (function joystick() {
    const base = $("joystick-base"), stick = $("joystick-stick"); let act = false, rect = null; const R = 34;
    const pos = (e) => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
    function mv(e) { if (!act) return; e.preventDefault(); const p = pos(e); let dx = p.x - (rect.left + rect.width / 2), dy = p.y - (rect.top + rect.height / 2); const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } stick.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))"; joyX = dx / R; }
    function st(e) { e.preventDefault(); act = true; joyActive = true; rect = base.getBoundingClientRect(); mv(e); }
    function en(e) { if (!act) return; e.preventDefault(); act = false; joyActive = false; joyX = 0; stick.style.transform = "translate(-50%, -50%)"; }
    base.addEventListener("touchstart", st, { passive: false }); base.addEventListener("touchmove", mv, { passive: false });
    base.addEventListener("touchend", en, { passive: false }); base.addEventListener("touchcancel", en, { passive: false });
    base.addEventListener("mousedown", st); window.addEventListener("mousemove", mv); window.addEventListener("mouseup", en);
  })();
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch-device");

  const SETTINGS_DEFAULT = { quality: "hd", showFps: false, shadow: true, reflection: false, reflectOpacity: 0.22, upscale: false, frameGen: false };
  function loadSettings() {
    try { return Object.assign({}, SETTINGS_DEFAULT, JSON.parse(localStorage.getItem("minato_settings") || "{}")); }
    catch (_) { return Object.assign({}, SETTINGS_DEFAULT); }
  }
  function saveSettings(c) { try { localStorage.setItem("minato_settings", JSON.stringify(c)); } catch (_) {} }
  let settings = loadSettings();
  function bindSettingsUI() {
    document.querySelectorAll("#opt-quality .chip").forEach((c) => c.classList.toggle("on", c.dataset.q === settings.quality));
    document.querySelectorAll("#opt-fps .chip").forEach((c) => c.classList.toggle("on", (+c.dataset.v === 1) === settings.showFps));
    document.querySelectorAll("#opt-shadow .chip").forEach((c) => c.classList.toggle("on", (+c.dataset.v === 1) === settings.shadow));
    document.querySelectorAll("#opt-reflect .chip").forEach((c) => c.classList.toggle("on", (+c.dataset.v === 1) === settings.reflection));
    document.querySelectorAll("#opt-upscale .chip").forEach((c) => c.classList.toggle("on", (+c.dataset.v === 1) === settings.upscale));
    document.querySelectorAll("#opt-framegen .chip").forEach((c) => c.classList.toggle("on", (+c.dataset.v === 1) === settings.frameGen));
    $("opt-reflect-op").value = settings.reflectOpacity;
    $("opt-reflect-op-v").textContent = Math.round(settings.reflectOpacity * 100) + "%";
    $("opt-reflect-op-row").style.display = settings.reflection ? "" : "none";
    document.querySelectorAll("#opt-quality .chip").forEach((c) => { c.onclick = () => { settings.quality = c.dataset.q; bindSettingsUI(); saveSettings(settings); resize(); }; });
    document.querySelectorAll("#opt-fps .chip").forEach((c) => { c.onclick = () => { settings.showFps = +c.dataset.v === 1; bindSettingsUI(); saveSettings(settings); $("fps-counter").classList.toggle("hidden", !settings.showFps); }; });
    document.querySelectorAll("#opt-shadow .chip").forEach((c) => { c.onclick = () => { settings.shadow = +c.dataset.v === 1; if (settings.shadow) settings.reflection = false; bindSettingsUI(); saveSettings(settings); }; });
    document.querySelectorAll("#opt-reflect .chip").forEach((c) => { c.onclick = () => { settings.reflection = +c.dataset.v === 1; if (settings.reflection) settings.shadow = false; bindSettingsUI(); saveSettings(settings); }; });
    document.querySelectorAll("#opt-upscale .chip").forEach((c) => { c.onclick = () => { settings.upscale = +c.dataset.v === 1; bindSettingsUI(); saveSettings(settings); resize(); }; });
    document.querySelectorAll("#opt-framegen .chip").forEach((c) => { c.onclick = () => { settings.frameGen = +c.dataset.v === 1; bindSettingsUI(); saveSettings(settings); }; });
    $("opt-reflect-op").oninput = () => { settings.reflectOpacity = +$("opt-reflect-op").value; $("opt-reflect-op-v").textContent = Math.round(settings.reflectOpacity * 100) + "%"; saveSettings(settings); };
  }
  const HUD_DEFAULT = { scale: 1, opacity: 1, side: "left", bottom: 16 };
  function loadHudCfg() {
    try { return Object.assign({}, HUD_DEFAULT, JSON.parse(localStorage.getItem("minato_hudcfg") || "{}")); }
    catch (_) { return Object.assign({}, HUD_DEFAULT); }
  }
  function saveHudCfg(c) { try { localStorage.setItem("minato_hudcfg", JSON.stringify(c)); } catch (_) {} }
  let hudCfg = loadHudCfg();
  function applyHudCfg() {
    const r = document.documentElement.style;
    r.setProperty("--hud-scale", hudCfg.scale);
    r.setProperty("--hud-opacity", hudCfg.opacity);
    r.setProperty("--hud-bottom", hudCfg.bottom + "px");
    document.body.classList.toggle("hud-side-right", hudCfg.side === "right");
  }
  function bindHudCfgUI() {
    const sc = $("hcfg-scale"), op = $("hcfg-opacity"), bt = $("hcfg-bottom");
    sc.value = hudCfg.scale; op.value = hudCfg.opacity; bt.value = hudCfg.bottom;
    $("hcfg-scale-v").textContent = Math.round(hudCfg.scale * 100) + "%";
    $("hcfg-opacity-v").textContent = Math.round(hudCfg.opacity * 100) + "%";
    $("hcfg-bottom-v").textContent = hudCfg.bottom + "px";
    document.querySelectorAll("#hcfg-side .chip").forEach((c) => c.classList.toggle("on", c.dataset.side === hudCfg.side));
    sc.oninput = () => { hudCfg.scale = +sc.value; $("hcfg-scale-v").textContent = Math.round(hudCfg.scale * 100) + "%"; applyHudCfg(); saveHudCfg(hudCfg); };
    op.oninput = () => { hudCfg.opacity = +op.value; $("hcfg-opacity-v").textContent = Math.round(hudCfg.opacity * 100) + "%"; applyHudCfg(); saveHudCfg(hudCfg); };
    bt.oninput = () => { hudCfg.bottom = +bt.value; $("hcfg-bottom-v").textContent = hudCfg.bottom + "px"; applyHudCfg(); saveHudCfg(hudCfg); };
    document.querySelectorAll("#hcfg-side .chip").forEach((c) => { c.onclick = () => { hudCfg.side = c.dataset.side; bindHudCfgUI(); applyHudCfg(); saveHudCfg(hudCfg); }; });
    $("hcfg-reset").onclick = () => { hudCfg = Object.assign({}, HUD_DEFAULT); bindHudCfgUI(); applyHudCfg(); saveHudCfg(hudCfg); };
  }
  function wire() {
    document.querySelectorAll("#menu [data-mode]").forEach((b) => b.addEventListener("click", () => {
      if (SFX) SFX.unlock();
      L.mode = b.dataset.mode; if (L.mode === "battle" && L.size < 2) L.size = 2;
      ensureP1(); renderLobby(); setScene("lobby");
    }));
    $("btn-hudcfg").onclick = () => { bindHudCfgUI(); setScene("hudcfg"); };
    $("hudcfg-back").onclick = () => setScene("menu");
    $("btn-settings").onclick = () => { bindSettingsUI(); setScene("settings"); };
    $("settings-back").onclick = () => setScene("menu");
    $("lobby-back").onclick = () => setScene("menu");
    $("lobby-start").onclick = () => { if (SFX) SFX.unlock(); ensureP1(); G.lastCfg = true; startMatch(); if (!isFs()) toggleFs(); };
    $("picker-close").onclick = () => $("picker").classList.add("hidden");
    $("picker").addEventListener("click", (e) => { if (e.target.id === "picker") $("picker").classList.add("hidden"); });
    $("result-again").onclick = () => { $("result").classList.add("hidden"); startMatch(); };
    $("result-lobby").onclick = () => { $("result").classList.add("hidden"); G.running = false; setScene("lobby"); };
    $("btn-menu").onclick = () => { G.running = false; G.paused = true; setScene("lobby"); };
    $("btn-fullscreen").onclick = toggleFs;
    const snd = $("btn-sound");
    snd.onclick = () => { if (!SFX) return; SFX.unlock(); SFX.mute(!SFX.isMuted()); snd.textContent = SFX.isMuted() ? "Muted" : "Sound"; };
    const bv = $("btn-voice");
    const fire = (e) => { if (e) e.preventDefault(); if (SFX) { SFX.unlock(); SFX.voice(); } };
    bv.addEventListener("click", fire); bv.addEventListener("touchend", fire, { passive: false });
  }

  let last = 0, fpsT = 0, fpsN = 0, accumulator = 0;
  const FIXED_DT = 1 / 60;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000) || 0.016; last = ts;
    if (G.scene === "play") {
      if (settings.frameGen) {
        for (const f of G.fighters) { f.rx = f.x; f.ry = f.y; }
        accumulator = Math.min(accumulator + dt, FIXED_DT * 5);
        let steps = 0;
        while (accumulator >= FIXED_DT && steps < 5) { update(FIXED_DT); accumulator -= FIXED_DT; steps++; }
        frameAlpha = accumulator / FIXED_DT;
      } else {
        accumulator = 0;
        update(dt);
        frameAlpha = 1;
      }
      draw();
    }
    if (settings.showFps) {
      fpsN++; fpsT += dt;
      if (fpsT >= 0.5) { $("fps-counter").textContent = Math.round(fpsN / fpsT) + " FPS"; fpsT = 0; fpsN = 0; }
    }
    requestAnimationFrame(loop);
  }

  wire(); resize(); applyHudCfg();
  $("fps-counter").classList.toggle("hidden", !settings.showFps);
  window.__G = G;
  window.__dbg = { L, startMatch, update, draw, DEFS, doSkill };
  loadAssets().then(() => { renderLobby(); setScene("menu"); requestAnimationFrame(loop); })
    .catch((e) => { console.error(e); $("loading").innerHTML = "<p>Gagal load assets.</p>"; });
})();