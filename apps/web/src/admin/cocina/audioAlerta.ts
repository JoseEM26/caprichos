const CLAVE_SILENCIO_COCINA = 'caprichos_cocina_silenciado';

export function estaSilenciado(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(CLAVE_SILENCIO_COCINA) === 'true';
  } catch {
    return false;
  }
}

export function setSilenciado(silenciado: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAVE_SILENCIO_COCINA, silenciado ? 'true' : 'false');
  } catch {
    // localStorage no disponible
  }
}

/**
 * Reproduce el tono sonoro de aviso para nuevos pedidos en cocina (Web Audio API)
 * a menos que el sonido esté silenciado por el usuario.
 */
export function reproducirCampanaCocina(forzar = false): void {
  if (!forzar && estaSilenciado()) return;

  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignorar si el navegador bloquea autoplay sin interacción previa
      });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Doble tono armónico nítido para cocina
    osc.frequency.setValueAtTime(784, ctx.currentTime); // Sol5
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12); // Do6

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch {
    // Fallback silencioso si Web Audio API falla
  }
}
