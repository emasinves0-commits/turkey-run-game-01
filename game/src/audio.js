// All sound is synthesised with the Web Audio API — no audio files, nothing over the network.
// Every effect is a short envelope on an oscillator or a burst of filtered noise.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let alarmTimer = 0;

  function ensureContext() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 0.5, delay = 0 }) {
    if (!ensureContext() || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noise({ seconds = 0.2, volume = 0.4, from = 1200, to = 300, delay = 0 }) {
    if (!ensureContext() || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + seconds + 0.05);
  }

  // The turkey's gobble: three fast low blips.
  function gobble() {
    tone({ type: 'square', from: 220, to: 160, seconds: 0.09, volume: 0.35 });
    tone({ type: 'square', from: 200, to: 140, seconds: 0.09, volume: 0.35, delay: 0.09 });
    tone({ type: 'square', from: 240, to: 120, seconds: 0.14, volume: 0.4, delay: 0.18 });
  }

  return {
    unlock() {
      ensureContext();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    jump(double) {
      tone({ type: 'square', from: double ? 520 : 380, to: double ? 780 : 620, seconds: 0.14, volume: 0.3 });
    },
    slide() {
      noise({ seconds: 0.16, volume: 0.2, from: 900, to: 250 });
    },
    corn() {
      tone({ from: 880, seconds: 0.09, volume: 0.35 });
      tone({ from: 1318, seconds: 0.14, volume: 0.3, delay: 0.07 });
    },
    feather() {
      tone({ from: 660, seconds: 0.1, volume: 0.3 });
      tone({ from: 880, seconds: 0.1, volume: 0.3, delay: 0.08 });
      tone({ from: 1108, seconds: 0.16, volume: 0.3, delay: 0.16 });
    },
    // FEATHER BURST (v2): a rising whoosh + a chirp.
    burst() {
      noise({ seconds: 0.3, volume: 0.35, from: 600, to: 3200 });
      tone({ from: 880, to: 1560, seconds: 0.18, volume: 0.3 });
    },
    nearMiss() {
      tone({ type: 'triangle', from: 1400, to: 900, seconds: 0.12, volume: 0.25 });
    },
    knifeThrow() {
      noise({ seconds: 0.3, volume: 0.22, from: 2400, to: 500 });
    },
    ovenWhoosh() {
      noise({ seconds: 0.5, volume: 0.3, from: 500, to: 1800 });
    },
    hit() {
      noise({ seconds: 0.25, volume: 0.5, from: 700, to: 120 });
      tone({ type: 'sawtooth', from: 160, to: 60, seconds: 0.3, volume: 0.4 });
      gobble();
    },
    hide() {
      tone({ type: 'triangle', from: 300, to: 500, seconds: 0.2, volume: 0.25 });
    },
    found() {
      tone({ type: 'square', from: 700, to: 900, seconds: 0.12, volume: 0.3 });
    },
    stage() {
      tone({ from: 523, seconds: 0.12, volume: 0.3 });
      tone({ from: 659, seconds: 0.12, volume: 0.3, delay: 0.1 });
      tone({ from: 784, seconds: 0.2, volume: 0.3, delay: 0.2 });
    },
    click() {
      tone({ from: 700, seconds: 0.06, volume: 0.25 });
    },
    caught() {
      tone({ type: 'sawtooth', from: 392, to: 370, seconds: 0.3, volume: 0.35 });
      tone({ type: 'sawtooth', from: 370, to: 311, seconds: 0.3, volume: 0.35, delay: 0.28 });
      tone({ type: 'sawtooth', from: 311, to: 233, seconds: 0.55, volume: 0.4, delay: 0.56 });
      gobble();
    },
    escaped() {
      const notes = [523, 659, 784, 1046, 784, 1046];
      notes.forEach((note, i) => tone({ from: note, seconds: 0.18, volume: 0.32, delay: i * 0.11 }));
    },
    // A short two-tone alarm while the farmer is about to grab the turkey.
    // Call every frame; it paces itself.
    alarm(dt) {
      alarmTimer -= dt;
      if (alarmTimer > 0) return;
      alarmTimer = 0.55;
      tone({ type: 'square', from: 980, seconds: 0.09, volume: 0.16 });
      tone({ type: 'square', from: 740, seconds: 0.09, volume: 0.16, delay: 0.12 });
    },
  };
}
