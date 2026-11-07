// Follows the music as it plays, for the effects that respond to it: the visualizer's pulse and the flicker on the
// visualizer's swatches and the tier list's cards. Off for reduced motion, where connect does nothing.
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function liveAudio(player) {
  let audioCtx = null, analyser;
  let bassAvg = 0;   // bass, slow average: a beat is bass rising above it
  let beatAvg = 0;   // slow average of beat, so the flicker centers on the base color

  const live = {
    bins: null,      // the latest frequency levels, 0-255
    bassLevel: 0,    // bass, following quickly
    loudness: 0,     // overall level
    beat: 0,         // jumps on a beat and decays between beats

    // Routes the player through an analyser the first time something plays
    connect() {
      if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
      if (REDUCED_MOTION) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = .75;
        audioCtx.createMediaElementSource(player).connect(analyser);
        analyser.connect(audioCtx.destination);
        live.bins = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) { audioCtx = null; }
    },

    connected: () => !!audioCtx,

    // How many Hz each frequency bin covers
    binHz: () => audioCtx.sampleRate / analyser.fftSize,

    // Mean level (0–1) of the frequency bins between lo and hi Hz
    bandLevel(lo, hi) {
      const first = Math.max(1, Math.round(lo / live.binHz())), last = Math.min(live.bins.length - 1, Math.round(hi / live.binHz()));
      let sum = 0;
      for (let i = first; i <= last; i++) sum += live.bins[i];
      return last >= first ? sum / (last - first + 1) / 255 : 0;
    },

    // Takes a new reading; call once per frame
    update() {
      analyser.getByteFrequencyData(live.bins);
      const bass = live.bandLevel(30, 160);
      live.bassLevel += (bass - live.bassLevel) * .35;
      live.loudness += (live.bandLevel(30, 8000) - live.loudness) * .2;
      bassAvg += (bass - bassAvg) * .04;
      live.beat = Math.max(Math.min(1, Math.max(0, (bass - bassAvg) * 10)), live.beat * .8);
    },

    // The flicker: a brightness that swings both ways around the base color, lighter on a beat and darker in the lull
    // after it. The beat is measured against its own slow average, so the flash centers on the base color.
    // Beats are short spikes with long lulls, so the dark side swings more gently to keep the two balanced.
    flickerFilter() {
      beatAvg += (live.beat - beatAvg) * .03;
      const swing = live.beat - beatAvg;
      const brightness = Math.min(1.5, Math.max(.45, 1 + (swing > 0 ? 1 : .9) * swing));
      return `brightness(${brightness.toFixed(3)})`;
    },

    reset() {
      live.bassLevel = live.loudness = live.beat = bassAvg = beatAvg = 0;
    },
  };
  return live;
}
