"use strict";

// Square-wave beeps modelled on the Game & Watch piezo sounds: [start s, end s, Hz].
const SOUNDS = {
  move: [[0, 0.055, 900]],
  push: [[0, 0.035, 600], [0.035, 0.07, 450]],
  clock: [[0, 0.06, 1700]],
  score: [[0, 0.025, 2100]],
  levelStart: [[0, 0.055, 800], [0.12, 0.181, 900], [0.246, 0.306, 1100], [0.371, 0.431, 1300], [0.496, 0.556, 1600], [0.622, 0.682, 1900]],
  levelEnd: [[0, 0.055, 2000], [0.12, 0.181, 1700], [0.246, 0.306, 1400], [0.371, 0.431, 1200], [0.496, 0.556, 1000], [0.622, 0.682, 800]],
  boom: [[0, 0.12, 600], [0.246, 0.371, 600], [0.496, 0.622, 500], [0.747, 0.867, 600], [0.997, 1.118, 600], [1.248, 1.368, 600]],
  bonusStart: [
    [0, 0.06, 1100], [0.06, 0.12, 800], [0.12, 0.181, 1100], [0.181, 0.246, 800], [0.311, 0.371, 1300], [0.371, 0.431, 1100],
    [0.431, 0.496, 1300], [0.496, 0.556, 1100], [0.622, 0.747, 1400], [0.747, 0.807, 1600], [0.807, 0.867, 1300], [0.947, 0.997, 1200],
    [0.997, 1.058, 1000], [1.058, 1.123, 1200], [1.123, 1.183, 1000], [1.248, 1.308, 1500], [1.308, 1.433, 1300], [1.433, 1.494, 1200],
    [1.559, 1.619, 2000], [1.619, 1.684, 1500], [1.684, 1.744, 2000], [1.749, 1.804, 1500],
  ],
  bonusMove: [[0, 0.055, 800], [0.12, 0.181, 800], [0.246, 0.491, 1100]],
  bonusClear: [
    [0, 0.246, 900], [0.246, 0.366, 1200], [0.496, 0.617, 1400], [0.747, 0.992, 900], [0.992, 1.118, 1200], [1.248, 1.368, 1600],
    [1.494, 1.744, 1000], [1.744, 1.864, 1400], [1.995, 2.115, 1800], [2.245, 2.305, 1900], [2.305, 2.365, 1200], [2.371, 2.431, 1900],
    [2.431, 2.491, 1200], [2.491, 2.556, 1900], [2.556, 2.616, 1200], [2.621, 2.681, 1900], [2.681, 2.741, 1200], [2.741, 2.806, 1800],
    [2.806, 2.867, 1200],
  ],
  gameOver: [
    [0, 0.181, 1100], [0.181, 0.241, 1300], [0.311, 0.366, 1300], [0.431, 0.677, 1200], [0.807, 1.118, 1600], [1.118, 1.178, 1100],
    [1.178, 1.243, 1800], [1.243, 1.303, 1100], [1.308, 1.368, 1800], [1.368, 1.428, 1100], [1.433, 1.494, 1800], [1.494, 1.554, 1100],
    [1.559, 1.619, 1800], [1.619, 1.679, 1100], [1.684, 1.744, 1800], [1.744, 1.804, 1100], [1.804, 1.864, 1800], [1.869, 1.93, 1100],
  ],
};

const Sound = (() => {
  const VOLUME = 0.05;
  let ctx = null;
  let muted = localStorage.getItem("bombsweeper.muted") === "1";

  // Browsers only allow audio after a user gesture; on Android that is pointerup/touchend, not pointerdown.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  }

  function play(name) {
    if (muted || !ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.005;
    for (const [a, b, f] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t0 + a);
      gain.gain.linearRampToValueAtTime(VOLUME, t0 + a + 0.003);
      gain.gain.setValueAtTime(VOLUME, t0 + b - 0.003);
      gain.gain.linearRampToValueAtTime(0, t0 + b);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + a);
      osc.stop(t0 + b + 0.01);
    }
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem("bombsweeper.muted", muted ? "1" : "0");
    return muted;
  }

  for (const ev of ["pointerdown", "pointerup", "touchend", "keydown"]) {
    document.addEventListener(ev, unlock, { passive: true });
  }
  return { play, toggle, isMuted: () => muted };
})();
