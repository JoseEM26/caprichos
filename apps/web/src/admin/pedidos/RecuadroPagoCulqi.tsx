import { useState } from 'react';
import { IconoMedioPago } from '../../comun/IconoMedioPago';
import type { PagoOnlineResumen } from './pedidosApi';

const PANEL_CULQI = 'https://panel.culqi.com/';
const ESTADO: Record<PagoOnlineResumen['estado'], string> = { APROBADO: 'Aprobado', DEVUELTO_PARCIAL: 'Devuelto parcial', DEVUELTO: 'Devuelto' };

const horaLima = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/** «Yape» o «Visa ···1111» (sin marca: «Tarjeta ···1111»). */
export function medioDelPagoCulqi(p: Pick<PagoOnlineResumen, 'medio' | 'marca' | 'ultimos4'>): string {
  if (String(p.medio).toUpperCase() === 'YAPE') return 'Yape';
  return `${p.marca || 'Tarjeta'}${p.ultimos4 ? ` ···${p.ultimos4}` : ''}`;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pedido pagado en línea por Culqi: recuadro con el medio, monto, hora de Lima, número de operación (copiable) y
 * estado. Este pago no lleva voucher ni «falta captura»: la prueba es la operación en CulqiPanel, no el Yape del local.
 */
export function RecuadroPagoCulqi({ pago }: { pago: PagoOnlineResumen }) {
  const [copiado, setCopiado] = useState(false);
  const copiarOperacion = async () => {
    setCopiado(await copiar(pago.cargoId));
    setTimeout(() => setCopiado(false), 2000);
  };
  const colorEstado = pago.estado === 'APROBADO' ? '#1F5C33' : 'var(--cp-rust, #B2500F)';
  return (
    <section
      className="dp-sec"
      aria-label="Pagado en línea por Culqi"
      data-testid="recuadro-culqi"
      style={{ border: '1.5px solid #1F5C33', borderRadius: 12, padding: 12, background: '#F1FAF3' }}
    >
      <h3 className="dp-sec-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconoMedioPago medio="PAGO_EN_LINEA" tamano={22} ariaHidden />
        <span>Pagado en línea por Culqi ✓</span>
      </h3>
      <div className="dp-fila">
        <span>Medio</span>
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconoMedioPago medio={String(pago.medio || 'TARJETA')} tamano={18} ariaHidden />
          <span>{medioDelPagoCulqi(pago)}</span>
        </strong>
      </div>
      <div className="dp-fila">
        <span>Monto</span>
        <strong>S/ {pago.monto.toFixed(2)}</strong>
      </div>
      {pago.aprobadoEn && (
        <div className="dp-fila">
          <span>Hora (Lima)</span>
          <strong>{horaLima(pago.aprobadoEn)}</strong>
        </div>
      )}
      <div className="dp-fila">
        <span>Estado</span>
        <strong style={{ color: colorEstado }} data-testid="estado-culqi">
          {ESTADO[pago.estado]}
          {pago.devuelto > 0 ? ` · S/ ${pago.devuelto.toFixed(2)}` : ''}
        </strong>
      </div>
      <div className="dp-fila" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span>N.º de operación</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <code data-testid="operacion-culqi" style={{ fontSize: 13, wordBreak: 'break-all' }}>{pago.cargoId}</code>
          <button type="button" className="cj2-btn" style={{ minHeight: 44 }} onClick={copiarOperacion} aria-label="Copiar número de operación">
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </span>
      </div>
      <div className="dp-fila" style={{ flexWrap: 'wrap', gap: 8 }}>
        <a
          href={PANEL_CULQI}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void copiar(pago.cargoId)}
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 700 }}
        >
          Ver en Culqi
        </a>
        <span style={{ fontSize: 12 }}>Se abre el panel de Culqi y se copia el número de operación para buscarlo ahí.</span>
      </div>
      {pago.modo === 'SIMULADO' && <p style={{ fontSize: 12, margin: '4px 0 0' }}>Pago de prueba (simulado): no hay operación real en Culqi.</p>}
    </section>
  );
}
