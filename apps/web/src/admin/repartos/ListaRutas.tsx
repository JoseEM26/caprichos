import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { RutaHistorial, EstadoFinalPedido } from './repartosApi';

/** Hora HH:mm en Lima de una marca de tiempo ISO; vacío si no hay. */
export function horaLima(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
}

export const TEXTO_ESTADO_FINAL: Record<EstadoFinalPedido, string> = {
  ENTREGADO: 'Entregado',
  NO_ENTREGADO: 'No entregado',
  ANULADO: 'Anulado',
};

const boton: CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 12,
  fontFamily: 'var(--fuente-titulos), Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};

/**
 * Rutas por tarjeta plegable: horario, entregados/fallidos y sus pedidos en orden. Solo lectura.
 * Con `alDibujar` cada ruta ofrece verla en el mapa; con `conRepartidor` muestra quién la hizo (caja/admin).
 */
export function ListaRutas({
  rutas,
  alDibujar,
  conRepartidor = false,
}: {
  rutas: RutaHistorial[];
  alDibujar?: (r: RutaHistorial) => void;
  conRepartidor?: boolean;
}) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  if (rutas.length === 0) {
    return (
      <div data-testid="rutas-vacio" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>
        No hay rutas en este periodo.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Montserrat, sans-serif', color: 'var(--cp-navy)' }}>
      {rutas.map((r) => {
        const abierta = abiertas.has(r.id);
        return (
          <article key={r.id} data-testid={`ruta-${r.id}`} style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, background: 'var(--cp-white)' }}>
            <button
              type="button"
              aria-expanded={abierta}
              data-testid={`ruta-cabecera-${r.id}`}
              onClick={() => alternar(r.id)}
              style={{ width: '100%', minHeight: 56, padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'inherit' }}
            >
              <strong style={{ fontSize: 15 }}>
                {horaLima(r.iniciadaEn)} – {r.terminadaEn ? horaLima(r.terminadaEn) : 'en curso'}
                {conRepartidor ? ` · ${r.repartidorNombre}` : ''}
              </strong>
              <span style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 700 }}>
                {r.entregados} {r.entregados === 1 ? 'entregado' : 'entregados'}
                {r.fallidos > 0 ? `, ${r.fallidos} no ${r.fallidos === 1 ? 'entregado' : 'entregados'}` : ''}
                {` · ${r.totalPedidos} ${r.totalPedidos === 1 ? 'pedido' : 'pedidos'} · ${r.distanciaKm.toFixed(1)} km`}
              </span>
            </button>
            {abierta && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  {r.pedidos.map((p) => (
                    <li key={p.id} data-testid={`ruta-pedido-${p.id}`}>
                      <strong>{p.codigo}</strong> {p.clienteNombre ?? ''}
                      {' · '}
                      <span style={{ fontWeight: 700, color: p.estadoFinal === 'ENTREGADO' ? 'var(--cp-green)' : p.estadoFinal ? 'var(--cp-rust)' : 'var(--cp-soft)' }}>
                        {p.estadoFinal ? TEXTO_ESTADO_FINAL[p.estadoFinal] : 'Pendiente'}
                        {p.horaFinal ? ` ${horaLima(p.horaFinal)}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
                {alDibujar && (
                  <button
                    type="button"
                    data-testid={`btn-dibujar-ruta-${r.id}`}
                    onClick={() => alDibujar(r)}
                    style={{ ...boton, alignSelf: 'flex-start', border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)' }}
                  >
                    Ver en el mapa
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
