import { useState } from 'react';
import type { EventoPedido, FichaCortesia, TipoEventoPedido } from './pedidosApi';

/** Cuántos eventos se ven sin pulsar «Ver todo». */
export const EVENTOS_VISIBLES = 5;

const COLORES: Record<TipoEventoPedido, { etiqueta: string; fondo: string; texto: string }> = {
  cortesia: { etiqueta: 'Cortesía', fondo: '#FDEBD9', texto: '#8A3F06' },
  edicion: { etiqueta: 'Edición', fondo: '#E3EEF8', texto: '#0B2C3E' },
  cobro: { etiqueta: 'Cobro', fondo: '#DDF1E4', texto: '#17603A' },
  anulacion: { etiqueta: 'Anulación', fondo: '#F9DEDE', texto: '#9B1C1C' },
  estado: { etiqueta: 'Estado', fondo: '#ECEBF7', texto: '#3B3A8C' },
  otro: { etiqueta: 'Otro', fondo: '#EEEEEE', texto: '#333333' },
};

export interface EventoAgrupado {
  clave: string;
  tipo: TipoEventoPedido;
  titulo: string;
  detalle: string | null;
  en: string;
  por: string | null;
  /** Eventos del mismo tipo, de la misma persona y del mismo minuto que se juntan en una sola línea. */
  cantidad: number;
  /** Todo el detalle de cada evento agrupado (no se pierde nada al agrupar). */
  items: { titulo: string; detalle: string | null }[];
}

const minuto = (iso: string) => iso.slice(0, 16);

export function horaCorta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
}

export function fechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
}

/** Junta cortesías (y otros eventos repetidos) del mismo tipo, persona y minuto: «Cortesía · 2 productos · por Ana, 14:32». */
export function agruparEventos(eventos: EventoPedido[]): EventoAgrupado[] {
  const salida: EventoAgrupado[] = [];
  for (const e of eventos) {
    const previo = salida[salida.length - 1];
    const mismoGrupo =
      previo && previo.tipo === e.tipo && previo.por === e.por && minuto(previo.en) === minuto(e.en) && (e.tipo === 'cortesia' || previo.items[0].titulo === e.titulo);
    if (mismoGrupo) {
      previo.cantidad += 1;
      previo.items.push({ titulo: e.titulo, detalle: e.detalle });
      continue;
    }
    salida.push({ clave: e.id, tipo: e.tipo, titulo: e.titulo, detalle: e.detalle, en: e.en, por: e.por, cantidad: 1, items: [{ titulo: e.titulo, detalle: e.detalle }] });
  }
  return salida;
}

function tituloAgrupado(g: EventoAgrupado): string {
  if (g.cantidad === 1) return g.titulo;
  return g.tipo === 'cortesia' ? `Cortesía · ${g.cantidad} productos` : `${g.titulo} · ${g.cantidad} veces`;
}

/** Insignia pequeña en la línea del producto; el ⓘ muestra quién, cuándo y por qué al tocarlo. */
export function InsigniaCortesia({ cortesia }: { cortesia?: FichaCortesia | null }) {
  const [abierta, setAbierta] = useState(false);
  const valor = Number(cortesia?.valor_lista ?? 0);
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          data-testid="insignia-cortesia"
          style={{ background: COLORES.cortesia.fondo, color: COLORES.cortesia.texto, borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}
        >
          🎁 Cortesía
        </span>
        <button
          type="button"
          aria-label="Ver quién dio la cortesía"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
          style={{ minWidth: 36, minHeight: 36, borderRadius: 9999, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: COLORES.cortesia.texto }}
        >
          ⓘ
        </button>
      </span>
      {abierta && (
        <span role="status" style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', lineHeight: 1.5, background: '#FFF8F0', border: '1px solid #F0D5B8', borderRadius: 10, padding: '8px 12px', maxWidth: 260, whiteSpace: 'normal' }}>
          <span style={{ display: 'block' }}>Dada por {cortesia?.dada_por ?? 'quien la registró'}{cortesia?.creado_en ? ` · ${fechaHoraCorta(cortesia.creado_en)}` : ''}</span>
          <span style={{ display: 'block' }}>Motivo: {cortesia?.motivo_etiqueta ?? cortesia?.motivo ?? 'sin dato'}{cortesia?.nota ? ` (${cortesia.nota})` : ''}</span>
          <span style={{ display: 'block' }}>Valor de lista: S/ {valor.toFixed(2)}</span>
        </span>
      )}
    </span>
  );
}

/** Una sola sección plegable al final del pedido, cerrada por defecto: hora, qué pasó y quién. */
export function HistorialAuditoria({ eventos }: { eventos?: EventoPedido[] }) {
  const [abierto, setAbierto] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const grupos = agruparEventos(eventos ?? []);
  if (grupos.length === 0) return null;
  const visibles = verTodo ? grupos : grupos.slice(0, EVENTOS_VISIBLES);
  return (
    <section className="cj-card" aria-label="Historial y auditoría">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}
      >
        <span>Historial y auditoría <span style={{ fontWeight: 600, color: 'var(--cp-soft, #2C4C5D)' }}>({grupos.length})</span></span>
        <span aria-hidden>{abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        <>
          <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibles.map((g) => {
              const c = COLORES[g.tipo];
              return (
                <li key={g.clave} style={{ display: 'grid', gridTemplateColumns: '56px auto 1fr', gap: 12, alignItems: 'start', fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>{horaCorta(g.en)}</span>
                  <span style={{ background: c.fondo, color: c.texto, borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{c.etiqueta}</span>
                  <span>
                    <span style={{ fontWeight: 700 }}>{tituloAgrupado(g)}</span>
                    {g.por ? <span style={{ color: 'var(--cp-soft, #2C4C5D)' }}> · por {g.por}</span> : null}
                    {g.items.map((it, i) =>
                      it.detalle ? (
                        <span key={i} style={{ display: 'block', fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                          {g.cantidad > 1 ? `${it.titulo.replace(/^Cortesía: /, '')} — ` : ''}
                          {it.detalle}
                        </span>
                      ) : g.cantidad > 1 ? (
                        <span key={i} style={{ display: 'block', fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>{it.titulo.replace(/^Cortesía: /, '')}</span>
                      ) : null,
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {grupos.length > EVENTOS_VISIBLES && (
            <button
              type="button"
              onClick={() => setVerTodo((v) => !v)}
              style={{ marginTop: 12, minHeight: 44, padding: '0 16px', borderRadius: 9999, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: 'transparent', fontWeight: 800, cursor: 'pointer' }}
            >
              {verTodo ? 'Ver menos' : `Ver todo (${grupos.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
