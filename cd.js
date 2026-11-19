window.GAME_CD = {

  minato: {
    basic: { damage: 78, reach: 62, back: 8, segmentEnds: [5, 15, 24, 31, 41], fps: 16 },
    skills: {
      1: { name: "Skill 1", anim: "Skill01", cooldown: 8,  mp: 20, damage: 120, reach: 210, back: 210, range: 190 },
      2: { name: "Skill 2", anim: "Skill02", cooldown: 7,  mp: 20, damage: 95,  reach: 170, back: 20,  range: 170 },
      3: { name: "Skill 3", anim: "Skill03", cooldown: 9,  mp: 25, damage: 110, reach: 190, back: 190, range: 200 },
      4: { name: "Skill 4", anim: "Skill04", cooldown: 12, mp: 35, damage: 120, reach: 200, back: 200, range: 240 },
      5: { name: "Skill 5", anim: "Skill05", cooldown: 16, mp: 45, damage: 190, reach: 240, back: 240, range: 260 },
    },
    fps: { Idle: 8, Walk: 12, Float: 8, Hurt: 8, AirHurt: 6, KnockDown: 8, Dead: 6,
           NAttack: 16, Skill01: 14, Skill02: 12, Skill03: 14, Skill04: 12, Skill05: 12 },
  },

  generic: {
    basic: { damage: 8 },
    skills: {
      1: { name: "Thorn", cooldown: 7, mp: 15, damage: 26 },
      2: { name: "Fire",  cooldown: 6, mp: 20, damage: 30 },
      3: { name: "Dash",  cooldown: 9, mp: 25, damage: 34 },
    },
  },

  chars: [
    { id: "Minato",       name: "Minato",     hp: 120, speed: 1.05, reach: 62, h: 85, exclusive: true },
    { id: "Shinobi",      name: "Shinobi",    hp: 105, speed: 1.15, reach: 50, h: 84 },
    { id: "Samurai",      name: "Samurai",    hp: 110, speed: 1.0,  reach: 64, h: 88 },
    { id: "Fighter",      name: "Fighter",    hp: 115, speed: 1.05, reach: 48, h: 86 },
    { id: "Woodcutter",   name: "Woodcutter", hp: 135, speed: 0.85, reach: 44, h: 70 },
    { id: "GraveRobber",  name: "Robber",     hp: 100, speed: 1.05, reach: 40, h: 66 },
    { id: "SteamMan",     name: "Steamman",   hp: 105, speed: 1.0,  reach: 40, h: 68 },
    { id: "DudeMonster",  name: "Dude",       hp: 90,  speed: 1.0,  reach: 34, h: 54 },
    { id: "OwletMonster", name: "Owlet",      hp: 90,  speed: 1.1,  reach: 34, h: 54 },
    { id: "PinkMonster",  name: "Pink",       hp: 90,  speed: 0.95, reach: 34, h: 54 },
  ],

  ai: {
    easy:   { react: [0.55, 0.95], aggression: 0.45, skill: 0.07, hold: [0.3, 0.7] },
    normal: { react: [0.25, 0.55], aggression: 0.70, skill: 0.16, hold: [0.6, 1.2] },
    hard:   { react: [0.10, 0.28], aggression: 0.90, skill: 0.28, hold: [1.0, 1.8] },
  },

  versus: { rounds: 3, time: 60 },

  battle: {
    worldW: 2400,
    turretHp: 700, turretRange: 175, turretDmg: 22, turretRate: 1.4,
    baseHp: 1500,
    minionEvery: 20, minionCount: 3, minionHp: 90, minionDmg: 3.5,
    respawnBase: 4, respawnPerDeath: 1.5,
    time: 360,
  },

  rush: {
    healPerWave: 0.3,
    tiers: {
      monster: ["DudeMonster", "OwletMonster", "PinkMonster"],
      mid:     ["Woodcutter", "GraveRobber", "SteamMan"],
      elite:   ["Shinobi", "Samurai", "Fighter"],
    },
    score: { monster: 10, mid: 15, elite: 40 },
  },
};