/** Sonido ambiente generado en el navegador (sin archivos): murmullo del salón, campana, caja y cafetera. */
export interface Sonido {
  activar: (on: boolean) => boolean;
  murmullo: (personas: number) => void;
  campana: () => void;
  caja: () => void;
  cafetera: () => void;
  moto: () => void;
  cerrar: () => void;
}

export function crearSonido(): Sonido {
  let ctx: AudioContext | null = null;
  let activo = false;
  let ganancia: GainNode | null = null;
  const usable = () => (activo && ctx ? ctx : null);

  function ruido(seg: number, marron = true) {
    const c = ctx!, b = c.createBuffer(1, Math.floor(c.sampleRate * seg), c.sampleRate), d = b.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (marron) { ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.5; } else d[i] = w; }
    return b;
  }
  function tono(frec: number, ini: number, dur: number, vol: number, tipo: OscillatorType = 'sine') {
    const c = usable(); if (!c) return;
    const t0 = c.currentTime + ini, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.value = frec;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    activar(on) {
      if (on && !ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        const src = ctx.createBufferSource(); src.buffer = ruido(6); src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
        const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 300; f2.gain.value = 6;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f).connect(f2).connect(g).connect(ctx.destination); src.start();
        ganancia = g;
      }
      activo = on;
      if (ctx) { if (on) void ctx.resume(); else void ctx.suspend(); }
      return true;
    },
    murmullo(personas) {
      const c = usable(); if (!c || !ganancia) return;
      ganancia.gain.setTargetAtTime(Math.min(0.32, 0.04 + personas * 0.018), c.currentTime, 1.5);
    },
    campana() { tono(1568, 0, 1.1, 0.16); tono(2093, 0.12, 1.3, 0.12); tono(3136, 0.12, 0.6, 0.04); },
    caja() { tono(1318, 0, 0.12, 0.07, 'triangle'); tono(1760, 0.09, 0.25, 0.07, 'triangle'); },
    cafetera() {
      const c = usable(); if (!c) return;
      const src = c.createBufferSource(); src.buffer = ruido(1.8, false);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.8;
      const g = c.createGain(), t0 = c.currentTime;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.25); g.gain.linearRampToValueAtTime(0.035, t0 + 1.3); g.gain.linearRampToValueAtTime(0, t0 + 1.8);
      src.connect(f).connect(g).connect(c.destination); src.start();
    },
    moto() {
      const c = usable(); if (!c) return;
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t0); o.frequency.linearRampToValueAtTime(95, t0 + 1.2); o.frequency.linearRampToValueAtTime(70, t0 + 2.8);
      f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.2); g.gain.linearRampToValueAtTime(0, t0 + 3);
      o.connect(f).connect(g).connect(c.destination); o.start(t0); o.stop(t0 + 3.1);
    },
    cerrar() { activo = false; void ctx?.close().catch(() => undefined); ctx = null; },
  };
}
