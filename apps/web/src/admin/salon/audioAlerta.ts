/**
 * Reproduce un tono de aviso cuando un pedido de salón está LISTO (Web Audio API).
 * Respeta las restricciones del navegador si no ha habido interacción previa.
 */
export function reproducirAvisoListo(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignorar si el navegador aún no permite audio
      });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Dos tonos ascendentes armónicos estilo timbre de mesa lista
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Re5
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.14); // La5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.28); // Re6

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.56);
  } catch {
    // Si Web Audio API no está disponible
  }
}
