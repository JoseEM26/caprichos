import { useEffect, useMemo, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { vouchersApi } from '../vouchers/vouchersApi';
import type { VoucherPagoItem } from '../vouchers/tipos';
import { digitalesDelPlan, faltanCapturas } from './mediosPago';
import { nombreMedio } from './planPago';

export interface CapturasPlanDigitalProps {
  pedidoId: string | number;
  planPago: ReadonlyArray<{ medio: string; monto: string | number }>;
  /** Avisa a quien cobra los medios digitales que todavía no tienen captura (lista vacía = todo cubierto). */
  alCambiar: (faltan: string[]) => void;
}

/**
 * Una captura por cada medio digital del plan (pago dividido). Cada fila dice si la captura ya está
 * subida o falta, y ofrece subirla para ese medio. Todas son opcionales: sin ellas el pago queda «sin captura».
 */
export function CapturasPlanDigital({ pedidoId, planPago, alCambiar }: CapturasPlanDigitalProps) {
  const [vouchers, setVouchers] = useState<VoucherPagoItem[] | null>(null);
  const [recarga, setRecarga] = useState(0);
  useEventos('vouchers:actualizado', () => setRecarga((n) => n + 1));

  const medios = useMemo(() => digitalesDelPlan(planPago), [planPago]);

  useEffect(() => {
    let activo = true;
    vouchersApi
      .listarVouchers({ pedidoId, estado: 'todos' })
      .then((items) => {
        if (activo) setVouchers(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (activo) setVouchers([]);
      });
    return () => {
      activo = false;
    };
  }, [pedidoId, recarga]);

  // Hasta cargar, todos cuentan como faltantes: no se cobra con una lista incompleta
  const faltan = useMemo(() => faltanCapturas(medios, vouchers ?? []), [medios, vouchers]);
  const faltanClave = faltan.join(',');
  useEffect(() => {
    alCambiar(faltan);
    // alCambiar cambia en cada render del padre: solo se avisa cuando cambia la lista
  }, [faltanClave]);

  if (vouchers === null) {
    return <div style={{ fontSize: 12, color: 'var(--cp-ink-soft, #6B5E55)' }}>Cargando capturas…</div>;
  }

  return (
    <div data-testid="capturas-plan-digital" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {medios.map((m) => {
        const monto = planPago
          .filter((f) => f.medio.toUpperCase() === m)
          .reduce((acc, f) => acc + Number(f.monto), 0);
        const listo = !faltan.includes(m);
        return (
          <div
            key={m}
            data-testid={`captura-${m.toLowerCase()}`}
            style={{
              border: '1.5px solid var(--cp-line, #E3D6C6)',
              borderRadius: 10,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <span>
                {nombreMedio(m)} S/ {monto.toFixed(2)}
              </span>
              <span style={{ color: listo ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
                {listo ? 'captura subida' : 'falta'}
              </span>
            </div>
            {!listo && (
              <SubirVoucherMozo
                pedidoId={pedidoId}
                medio={m}
                alVoucherValido={() => undefined}
                alRespuesta={() => setRecarga((n) => n + 1)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
