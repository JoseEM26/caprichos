/**
 * Reproduce un tono de aviso cuando entra un pedido nuevo (Web Audio API),
 * respetando las restricciones de reproducción del navegador.
 */
export function reproducirCampana(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignorar si el navegador aún no ha tenido interacción de usuario
      });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Dos tonos rápidos armónicos (estilo campana de pedido)
    osc.frequency.setValueAtTime(880, ctx.currentTime); // La5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // Re6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Si el navegador no permite audio o Web Audio API no está disponible
  }
}
