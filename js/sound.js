// Tiny WebAudio synth — no asset files, enabled only when user toggles on.
(function () {
  const S = window.SFX = { enabled: false, ctx: null };

  function ensure() {
    if (!S.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      S.ctx = new AC();
    }
    if (S.ctx.state === 'suspended') S.ctx.resume();
    return S.ctx;
  }

  function blip(freq, dur, type, gain) {
    if (!S.enabled) return;
    const ctx = ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  S.eat = () => blip(680, 0.09, 'square', 0.09);
  S.die = () => { blip(220, 0.18, 'sawtooth', 0.10); setTimeout(() => blip(140, 0.22, 'sawtooth', 0.08), 90); };
  S.turn = () => blip(520, 0.04, 'triangle', 0.05);
  S.tick = () => blip(900, 0.03, 'sine', 0.03);
})();
