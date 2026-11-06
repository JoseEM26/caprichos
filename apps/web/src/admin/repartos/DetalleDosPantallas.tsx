import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, TouchEvent } from 'react';
import type { ResumenRepartidor } from './repartosApi';
import { contadoresVivos, pasosDeTiempo, type TiemposPedido } from './tiemposReparto';
import { nombreMedioCobro, textoPlan } from './cambioCobroApi';

export type PantallaDetalle = 'pedido' | 'tiempos';

const soles = (monto: number | string | null | undefined) => `S/ ${Number(monto || 0).toFixed(2)}`;

/** Reloj que se actualiza cada 15 s para los contadores en vivo. */
export function useAhora(cadaMs = 15000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ahora;
}

/**
 * Las dos pantallas del detalle del repartidor dentro del mismo panel: pestañas «Pedido» / «Tiempos» con puntos,
 * y se cambia tocando o deslizando de lado.
 */
export function DosPantallas({
  pantalla,
  alCambiar,
  pedido,
  tiempos,
}: {
  pantalla: PantallaDetalle;
  alCambiar: (p: PantallaDetalle) => void;
  pedido: ReactNode;
  tiempos: ReactNode;
}) {
  const inicioX = useRef<number | null>(null);
  const alIniciar = (e: TouchEvent) => {
    inicioX.current = e.touches[0]?.clientX ?? null;
  };
  const alTerminar = (e: TouchEvent) => {
    if (inicioX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? inicioX.current) - inicioX.current;
    inicioX.current = null;
    if (dx < -60 && pantalla === 'pedido') alCambiar('tiempos');
    if (dx > 60 && pantalla === 'tiempos') alCambiar('pedido');
  };
  const pestana = (id: PantallaDetalle): CSSProperties => ({
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    border: 'none',
    fontWeight: 800,
    fontSize: 14,
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: pantalla === id ? 'var(--cp-navy)' : 'var(--cp-sand)',
    color: pantalla === id ? 'var(--cp-white)' : 'var(--cp-navy)',
  });
  return (
    <div onTouchStart={alIniciar} onTouchEnd={alTerminar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="tablist" aria-label="Pantallas del pedido" style={{ display: 'flex', gap: 6 }}>
        <button type="button" role="tab" aria-selected={pantalla === 'pedido'} data-testid="pestana-pedido" onClick={() => alCambiar('pedido')} style={pestana('pedido')}>
          Pedido
        </button>
        <button type="button" role="tab" aria-selected={pantalla === 'tiempos'} data-testid="pestana-tiempos" onClick={() => alCambiar('tiempos')} style={pestana('tiempos')}>
          Tiempos
        </button>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        {(['pedido', 'tiempos'] as const).map((id) => (
          <span key={id} style={{ width: 8, height: 8, borderRadius: 9999, background: pantalla === id ? 'var(--cp-navy)' : 'var(--cp-line)' }} />
        ))}
      </div>
      {pantalla === 'pedido' ? (
        <section data-testid="pantalla-pedido" aria-label="Pedido" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedido}
          <button type="button" data-testid="ver-tiempos" onClick={() => alCambiar('tiempos')} style={enlaceGrande}>
            Ver tiempos ›
          </button>
        </section>
      ) : (
        <section data-testid="pantalla-tiempos" aria-label="Tiempos" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiempos}
          <button type="button" data-testid="volver-pedido" onClick={() => alCambiar('pedido')} style={enlaceGrande}>
            ‹ Volver
          </button>
        </section>
      )}
    </div>
  );
}

const enlaceGrande: CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: 15,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

/** Pantalla 2: contadores en vivo y línea de tiempo con la hora y los minutos de cada paso. */
export function PantallaTiempos({ tiempos }: { tiempos: TiemposPedido }) {
  const ahora = useAhora();
  const contadores = contadoresVivos(tiempos, ahora);
  const pasos = pasosDeTiempo(tiempos);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {contadores.map((c) => (
          <div
            key={c.id}
            data-testid={`contador-${c.id}`}
            style={{ border: `2px solid ${c.colorHex}`, borderRadius: 12, padding: '8px 10px', background: 'var(--cp-white)' }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>{c.titulo}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.colorHex, lineHeight: '30px' }}>{c.minutos} min</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: c.colorHex }}>
              {c.etiqueta}
              {c.maximo != null ? ` · máx. ${c.maximo} min` : ''}
              {c.detenido ? ' · detenido' : ''}
            </div>
          </div>
        ))}
      </div>
      <ol data-testid="linea-tiempo" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pasos.map((p) => (
          <li
            key={p.id}
            data-testid={`paso-${p.id}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, background: p.en ? 'var(--cp-white)' : 'transparent', border: '1px solid var(--cp-line)', opacity: p.en ? 1 : 0.55, fontSize: 14 }}
          >
            <span style={{ fontWeight: 700 }}>{p.texto}</span>
            <span style={{ fontWeight: 800, textAlign: 'right' }}>
              {p.hora ? `${p.hora}${p.minDesdePedido != null ? ` · ${p.minDesdePedido} min` : ''}` : 'Pendiente'}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

const fila: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 };

const COLOR_VOUCHER: Record<string, string> = { VALIDADO: 'var(--cp-green)', PENDIENTE: 'var(--cp-orange)', ILEGIBLE: 'var(--cp-rust)' };
const TEXTO_VOUCHER: Record<string, string> = { VALIDADO: 'validado', PENDIENTE: 'pendiente de validar', ILEGIBLE: 'ilegible (no cuenta)' };

/** Cobro detallado: pagado o falta cobrar, medio y plan, monto, efectivo a cobrar, paga con y vuelto, capturas y cortesías. */
export function CobroDetallado({ cobro, nota }: { cobro: NonNullable<ResumenRepartidor['cobro']>; nota?: string | null }) {
  const pagado = cobro.estado === 'PAGADO';
  return (
    <div
      data-testid="cobro-detallado"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, border: `2px solid ${pagado ? 'var(--cp-green)' : 'var(--cp-rust)'}`, background: pagado ? '#E8F5E9' : '#FFF4E5' }}
    >
      <div style={{ ...fila, alignItems: 'center' }}>
        <strong style={{ fontSize: 16, color: pagado ? 'var(--cp-green)' : 'var(--cp-rust)' }}>{pagado ? 'Pagado' : 'Falta cobrar'}</strong>
        <strong style={{ fontSize: 18 }}>{soles(cobro.total_cobrable)}</strong>
      </div>
      <div style={fila}>
        <span>{cobro.mixto ? 'Pago mixto' : 'Medio'}</span>
        <strong style={{ textAlign: 'right' }}>{cobro.mixto ? textoPlan(cobro.plan) : nombreMedioCobro(cobro.plan[0]?.medio ?? cobro.medio ?? '')}</strong>
      </div>
      {cobro.propina > 0 && (
        <div style={fila}>
          <span>Incluye propina</span>
          <strong>{soles(cobro.propina)}</strong>
        </div>
      )}
      {!pagado && cobro.efectivo_cobrar > 0 && (
        <>
          <div style={fila}>
            <span>Cobrar en efectivo</span>
            <strong>{soles(cobro.efectivo_cobrar)}</strong>
          </div>
          <div style={fila}>
            <span>Paga con</span>
            <strong>{cobro.paga_con != null ? soles(cobro.paga_con) : 'Sin dato: pregunta con cuánto paga'}</strong>
          </div>
          {cobro.paga_con != null && (
            <div style={fila}>
              <span>Vuelto a llevar</span>
              <strong>{cobro.vuelto > 0 ? soles(cobro.vuelto) : 'Monto exacto'}</strong>
            </div>
          )}
        </>
      )}
      {!pagado && cobro.efectivo_cobrar === 0 && !cobro.plan.some((f) => f.medio === 'TARJETA') && (
        <div style={{ fontSize: 13, fontWeight: 700 }}>No cobres efectivo: el pago es digital.</div>
      )}
      {cobro.vouchers.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {cobro.vouchers.map((v) => (
            <li key={v.id} style={{ color: COLOR_VOUCHER[v.estado] }}>
              Captura {v.medio ?? ''}: <strong>{TEXTO_VOUCHER[v.estado]}</strong>
            </li>
          ))}
        </ul>
      ) : (
        cobro.plan.some((f) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio)) && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-orange)' }}>Sin captura todavía</div>
      )}
      {cobro.cortesias.length > 0 && (
        <div style={{ fontSize: 13 }}>
          <strong>Cortesías: </strong>
          {cobro.cortesias.map((c) => `${c.cantidad} x ${c.nombre}`).join(', ')}
        </div>
      )}
      {nota && (
        <div style={{ fontSize: 13 }}>
          <strong>Nota del cliente: </strong>
          {nota}
        </div>
      )}
    </div>
  );
}
