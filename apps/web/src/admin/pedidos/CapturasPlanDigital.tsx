import { useEffect, useMemo, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { vouchersApi } from '../vouchers/vouchersApi';
import type { VoucherPagoItem } from '../vouchers/tipos';
import { digitalesDelPlan, faltanCapturas } from './mediosPago';
import { nombreMedio } from './planPago';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';

export interface CapturasPlanDigitalProps {
  pedidoId: string | number;
  planPago: ReadonlyArray<{ medio: string; monto: string | number }>;
  /** Avisa a quien cobra los medios digitales que todavía no tienen captura (lista vacía = todo cubierto). */
  alCambiar: (faltan: string[]) => void;
}

/**
 * Una captura por cada medio digital del plan (pago dividido). Cada fila dice si la captura ya está
 * subida o falta, y ofrece subirla para ese medio. El servidor exige lo mismo (VOUCHER_REQUERIDO.faltan).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

const MOTIVO_MINIMO_SIN_VOUCHER = 5;

/** Excepción «sin voucher»: motivo escrito + código rotativo del supervisor (queda auditado). */
export function ExcepcionSinVoucher({
  motivo,
  onMotivo,
  pin,
  onPin,
  alVolver,
}: {
  motivo: string;
  onMotivo: (v: string) => void;
  pin: string;
  onPin: (v: string) => void;
  alVolver: () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
        Cobro sin foto: solo con motivo escrito y el código del supervisor. Queda auditado.
      </div>
      <label htmlFor="motivo-sin-voucher" style={{ fontWeight: 700, fontSize: 13 }}>
        Motivo (mínimo {MOTIVO_MINIMO_SIN_VOUCHER} letras)
      </label>
      <textarea
        id="motivo-sin-voucher"
        data-testid="motivo-sin-voucher"
        rows={2}
        value={motivo}
        onChange={(e) => onMotivo(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 10,
          border: '1.5px solid var(--cp-line, #E3D6C6)',
          background: 'var(--cp-white, #FFFFFF)',
          padding: 10,
          fontSize: 14,
          fontFamily: 'inherit',
        }}
      />
      <CampoCodigoSupervisor valor={pin} onChange={onPin} />
      <button
        type="button"
        onClick={alVolver}
        style={{
          minHeight: 44,
          border: '1.5px solid var(--cp-navy, #0B2C3E)',
          borderRadius: 10,
          background: 'transparent',
          color: 'var(--cp-navy, #0B2C3E)',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Volver a pedir la foto
      </button>
    </>
  );
}
