(() => {
  "use strict";

  const BASE = "sfx/";

  const TIMELINE = {
    NAttack: {
      1: ["Minato/fx/fxn1.ogg"],
      9: ["Minato/fx/fxn2.ogg", "Minato/n1.ogg"],
      15: ["Minato/fx/HS1.ogg"],
      20: ["Minato/fx/HS3.ogg"],
      24: ["Minato/fx/fxn4.ogg", "Minato/n2.ogg"],
      29: ["Minato/fx/fxn5.ogg"],
      31: ["Minato/fx/fxn3.ogg"],
      34: ["Minato/fx/HS1.ogg"],
      39: ["Minato/fx/HS3.ogg"],
      42: ["Minato/fx/fxn6.ogg", "Minato/n3.ogg"],
    },
    Skill01: {
      0: ["Minato/fx/fxn5.ogg"],
      1: ["Minato/1_1.ogg"],
      5: ["Minato/fx/fxn3.ogg"],
      6: ["Minato/fx/fxn3.ogg", "Minato/fx/fx1_1.ogg"],
      7: ["Minato/fx/HS1.ogg"],
      9: ["Minato/fx/fx2_2.ogg", "Minato/fx/fx1_3.ogg", "Minato/fx/HS1.ogg"],
      12: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      14: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg", "Minato/1_2.ogg"],
      17: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      20: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      21: ["Minato/fx/fx2_2.ogg"],
      22: ["Minato/fx/HS3.ogg"],
      24: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      26: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      28: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      30: ["Minato/fx/fx2_2.ogg", "Minato/fx/HS3.ogg"],
      31: ["Minato/fx/fx2_2.ogg"],
      33: ["Minato/fx/HS3.ogg", "Minato/fx/fx1_3.ogg", "Minato/1_3.ogg"],
      38: ["Minato/fx/HS3.ogg"],
      40: ["Minato/fx/fx1_3.ogg"],
      41: ["Minato/1_4.ogg"],
      50: ["Minato/fx/fxn3.ogg", "Minato/fx/fx1_1.ogg"],
    },
    Skill02: {
      0: ["Minato/fx/fx2_1.ogg"],
      2: ["Minato/2_1.ogg"],
      5: ["Minato/2_2.ogg"],
      6: ["Minato/fx/fx2_2.ogg"],
      8: ["Minato/fx/fx2_2.ogg"],
      10: ["Minato/fx/fx2_2.ogg"],
      12: ["Minato/fx/fx2_2.ogg"],
      14: ["Minato/fx/fx2_2.ogg"],
      15: ["Minato/fx/fx2_3.ogg"],
      16: ["Minato/fx/fx1_1.ogg"],
    },
    Skill03: {
      0: ["Minato/fx/HS3.ogg", "Minato/3_1.ogg"],
      6: ["Minato/fx/HS1.ogg"],
      8: ["Minato/fx/fx1_3.ogg"],
      11: ["Minato/fx/HS3.ogg"],
      12: ["Minato/n2.ogg"],
      16: ["Minato/fx/fx1_3.ogg"],
      17: ["Minato/fx/HS1.ogg"],
      18: ["Minato/fx/fx3_1.ogg", "Minato/n4.ogg"],
      20: ["Minato/fx/fx3_2.ogg", "Minato/1_4.ogg"],
      21: ["Minato/fx/HS3.ogg"],
      23: ["Minato/fx/HS1.ogg"],
      24: ["Minato/fx/fx3_3.ogg"],
    },
    Skill04: {
      2: ["Minato/fx/HS1.ogg"],
      3: ["Minato/4_1.ogg"],
      4: ["Minato/fx/HS3.ogg"],
      5: ["Minato/fx/fx2_1.ogg"],
      8: ["Minato/4_2.ogg"],
      11: ["Minato/fx/fx5_2.ogg"],
      13: ["Minato/fx/fx2_1.ogg", "Minato/fx/fx4_1.ogg"],
    },
    Skill05: {
      0: ["Minato/fx/fx1_1.ogg"],
      2: ["Minato/5_1.ogg"],
      7: ["Minato/fx/fxn3.ogg"],
      10: ["Minato/fx/poof.ogg"],
      15: ["Minato/fx/HS1.ogg"],
      16: ["Minato/fx/HS2.ogg"],
      19: ["Minato/fx/HS1.ogg"],
      20: ["Minato/fx/fx1_1.ogg"],
      21: ["Minato/5_2.ogg"],
      22: ["Minato/fx/HS1.ogg"],
      23: ["Minato/fx/HS3.ogg"],
      25: ["Minato/fx/fx5_1.ogg"],
      37: ["Minato/fx/fx2_1.ogg", "Minato/fx/fx5_2.ogg"],
      44: ["Minato/5_3.ogg"],
    },
  };

  const pools = Object.create(null);
  const POOL_SIZE = 4;
  let unlocked = false;
  let muted = false;
  let voicePlaying = false;
  let voiceAudio = null;
  let playedByFighter = Object.create(null);

  const VOICE_RE = /^Minato\/(?:\d+_\d+|n\d+)\.ogg$/;
  let currentVoiceEl = null;

  function makeAudio(path) {
    const a = new Audio(BASE + path);
    a.preload = "auto";
    a.playsInline = true;
    return a;
  }

  function ensurePool(path) {
    if (pools[path]) return pools[path];
    const arr = [];
    for (let i = 0; i < POOL_SIZE; i++) arr.push(makeAudio(path));
    pools[path] = arr;
    return arr;
  }

  function allPaths() {
    const s = new Set(["Minato.ogg"]);
    Object.keys(TIMELINE).forEach((act) => {
      Object.keys(TIMELINE[act]).forEach((fi) => {
        TIMELINE[act][fi].forEach((p) => s.add(p));
      });
    });
    return [...s];
  }

  function preloadAll() {
    allPaths().forEach((path) => {
      ensurePool(path).forEach((a) => {
        try {
          a.load();
        } catch (_) {}
      });
    });
    voiceAudio = makeAudio("Minato.ogg");
    try {
      voiceAudio.load();
    } catch (_) {}
  }

  function play(path, vol) {
    if (muted || !path || !unlocked) return;
    const pool = ensurePool(path);
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) a = pool[0];
    try {
      if (VOICE_RE.test(path)) {

        if (currentVoiceEl && currentVoiceEl !== a && !currentVoiceEl.paused) { currentVoiceEl.pause(); currentVoiceEl.currentTime = 0; }
        currentVoiceEl = a;
      }
      a.pause();
      a.currentTime = 0;
      a.volume = vol == null ? 0.7 : vol;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    preloadAll();
    try {
      const a = ensurePool("Minato/fx/fxn1.ogg")[0];
      a.volume = 0.001;
      const p = a.play();
      if (p && p.then)
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 0.7;
        }).catch(() => {});
    } catch (_) {}
  }

  function updateVoiceBtn() {
    const btn = document.getElementById("btn-voice");
    if (!btn) return;
    if (voicePlaying) {
      btn.classList.add("disabled");
      btn.setAttribute("disabled", "disabled");
    } else {
      btn.classList.remove("disabled");
      btn.removeAttribute("disabled");
    }
  }

  function stopVoice() {
    if (currentVoiceEl && !currentVoiceEl.paused) { currentVoiceEl.pause(); currentVoiceEl.currentTime = 0; }
  }
  window.SFX = {
    unlock,
    play,
    stopVoice,
    mute(v) {
      muted = !!v;
    },
    isMuted() {
      return muted;
    },
    isVoiceBusy() {
      return voicePlaying;
    },

    resetAnimSounds(id) {
      id = id == null ? "_" : id;
      playedByFighter[id] = Object.create(null);
    },

    onFrame(state, frameIdx, id) {
      id = id == null ? "_" : id;
      const table = TIMELINE[state];
      if (!table) return;
      const list = table[frameIdx];
      if (!list || !list.length) return;
      const played = playedByFighter[id] || (playedByFighter[id] = Object.create(null));
      const key = state + ":" + frameIdx;
      if (played[key]) return;
      played[key] = true;
      list.forEach((path) => play(path, 0.7));
    },

    voice() {
      if (muted || !unlocked || voicePlaying) return false;
      if (!voiceAudio) voiceAudio = makeAudio("Minato.ogg");
      try {
        voicePlaying = true;
        updateVoiceBtn();
        voiceAudio.pause();
        voiceAudio.currentTime = 0;
        voiceAudio.volume = 0.8;
        const onEnd = () => {
          voicePlaying = false;
          voiceAudio.removeEventListener("ended", onEnd);
          updateVoiceBtn();
        };
        voiceAudio.addEventListener("ended", onEnd);
        voiceAudio.addEventListener(
          "error",
          () => {
            voicePlaying = false;
            updateVoiceBtn();
          },
          { once: true }
        );
        const p = voiceAudio.play();
        if (p && p.catch)
          p.catch(() => {
            voicePlaying = false;
            updateVoiceBtn();
          });
        setTimeout(() => {
          if (voicePlaying && voiceAudio.paused) {
            voicePlaying = false;
            updateVoiceBtn();
          }
        }, 5000);
        return true;
      } catch (_) {
        voicePlaying = false;
        updateVoiceBtn();
        return false;
      }
    },

    attack() {},
    attackSwing() {},
    attackHit() {},
    skill() {},
    skillFx() {},
    hit() {},
    tick() {},
    resetVoice() {
      voicePlaying = false;
      updateVoiceBtn();
    },
  };
})();