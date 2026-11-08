import { textoMesa } from './InsigniaModalidad';

/**
 * Parte el nombre de la mesa en «MESA 12» (siempre completo) y un resto opcional («TERRAZA», «+ 5 + 6»).
 * «En espera de mesa» va entero como principal.
 */
export function etiquetaMesa(nombre?: string | null): { principal: string; resto: string | null; espera: boolean; completo: string } {
  const t = textoMesa(nombre);
  if (/^EN ESPERA/.test(t)) return { principal: t, resto: null, espera: true, completo: t };
  const m = /^(MESA\s+\S+)\s*(.*)$/.exec(t);
  if (!m) return { principal: t, resto: null, espera: false, completo: t };
  const resto = m[2].replace(/^[-–·,:]\s*/, '').trim();
  return { principal: m[1], resto: resto || null, espera: false, completo: t };
}

/** Insignia propia de la mesa: nunca se recorta (ni con puntos suspensivos); lo largo pasa a una 2.ª línea. */
export function InsigniaMesa({ mesaNombre, grande = false }: { mesaNombre?: string | null; grande?: boolean }) {
  if (!String(mesaNombre || '').trim()) return null;
  const e = etiquetaMesa(mesaNombre);
  return (
    <span
      className={`ins-mesa${grande ? ' ins-mesa--grande' : ''}${e.espera ? ' ins-mesa--espera' : ''}`}
      data-testid="insignia-mesa"
      aria-label={e.completo}
    >
      <span className="ins-mesa-num">{e.principal}</span>
      {e.resto && <span className="ins-mesa-resto">{e.resto}</span>}
    </span>
  );
}
