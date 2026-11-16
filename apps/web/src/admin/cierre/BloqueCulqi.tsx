import { IconoMedioPago } from '../../comun/IconoMedioPago';
import type { ComisionCulqiTurno, CulqiTurno, OperacionCulqi } from './cierreApi';
import { soles } from './cuadre.util';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });

/** Lista de operaciones Culqi (pedido, medio, monto, hora y n.º de operación) con la nota de dónde se verifican. */
const NOMBRE_MEDIO: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'efectivo', TARJETA: 'Tarjeta' };

/** Estado de la operación en Culqi; «Devuelto por fuera» = el dinero sigue en Culqi y salió del medio del local. */
export function estadoOperacionCulqi(o: OperacionCulqi): string {
  if (o.estado === 'DEVUELTO_FUERA') return `Devuelto por fuera (${(o.devueltoPor ?? []).map((m) => NOMBRE_MEDIO[m] ?? m).join(', ')} del local)`;
  if (o.estado === 'DEVUELTO_CULQI') return 'Devuelto por Culqi';
  if (o.estado === 'ANULADO') return 'Cobro anulado, sin devolver';
  return 'Cobrado';
}

export function OperacionesCulqi({ operaciones }: { operaciones: OperacionCulqi[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="dc-tabla" data-testid="operaciones-culqi">
        <thead>
          <tr><th>Pedido</th><th>Medio</th><th>Monto</th><th>Hora</th><th>N.º de operación</th><th>Estado</th><th>Comisión</th></tr>
        </thead>
        <tbody>
          {operaciones.map((o, i) => (
            <tr key={`${o.pedidoId}-${o.medio}-${i}`}>
              <td>{o.pedidoCodigo}</td>
              <td>{o.medio === 'YAPE' ? 'Yape' : 'Tarjeta'}</td>
              <td>{soles(o.monto)}</td>
              <td>{hora(o.en)}</td>
              <td><code style={{ wordBreak: 'break-all' }}>{o.operacion ?? 'Sin dato'}</code></td>
              <td data-testid="estado-operacion-culqi">{estadoOperacionCulqi(o)}</td>
              <td>{o.comision == null ? 'Por confirmar' : soles(o.comision)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** «Comisión de la pasarela (la asume el local)»: apartado propio; no es faltante ni cambia el efectivo esperado ni el Yape manual. */
export function ComisionPasarela({ comision }: { comision: ComisionCulqiTurno }) {
  if (!comision || comision.pagos === 0) return null;
  return (
    <div data-testid="comision-pasarela" style={{ marginTop: 12, borderTop: '1px dashed var(--cp-line)', paddingTop: 8 }}>
      <h4 className="cc-h3" style={{ fontSize: '1rem' }}>Comisión de la pasarela (la asume el local)</h4>
      <div className="cc-dig"><div className="cc-dig-nom">Cobrado bruto (sin devueltos)</div><div className="cc-dig-sis"><b>{soles(comision.bruto)}</b></div></div>
      <div className="cc-dig" data-testid="comision-total">
        <div className="cc-dig-nom">Comisión de {comision.pagos - comision.porConfirmar} de {comision.pagos} pagos</div>
        <div className="cc-dig-sis"><b>- {soles(comision.total)}</b></div>
      </div>
      {comision.total > 0 && (
        <div className="cc-peq" data-testid="comision-detalle">
          Variable (%) {soles(comision.variable)} · fijo {soles(comision.fijo)} · IGV {soles(comision.igv)}
          {comision.estimadas > 0 ? ` · ${comision.estimadas} estimada${comision.estimadas === 1 ? '' : 's'} con la tarifa configurada` : ''}
        </div>
      )}
      <div className="cc-dig" data-testid="comision-neto"><div className="cc-dig-nom"><strong>Neto que deposita Culqi</strong></div><div className="cc-dig-sis"><b>{soles(comision.neto)}</b></div></div>
      {comision.porConfirmar > 0 && (
        <p className="cc-peq" data-testid="comision-por-confirmar" style={{ color: 'var(--cp-rust)' }}>
          {comision.porConfirmar} pago{comision.porConfirmar === 1 ? '' : 's'} con comisión por confirmar: configura la tarifa en Configuración › Parámetros o revísala en CulqiPanel.
        </p>
      )}
      <p className="cc-peq">Culqi descuenta su comisión antes de depositar. El cliente no la paga: la asume el local. No es faltante y no cambia el efectivo esperado ni el cuadre del Yape manual.</p>
    </div>
  );
}

/**
 * «Pagos en línea (Culqi)» del cuadre: ese dinero llega a la cuenta de Culqi, no al Yape ni al POS del local, así que
 * no se compara con tu app: su visto es el del sistema y se verifica en CulqiPanel.
 */
export function BloqueCulqi({ culqi }: { culqi: CulqiTurno }) {
  const filas = [
    { medio: 'YAPE', nombre: 'Yape por Culqi', monto: culqi.yape, devuelto: culqi.devueltoYape, hay: culqi.cobradoYape > 0 },
    { medio: 'TARJETA', nombre: 'Tarjeta por Culqi', monto: culqi.tarjeta, devuelto: culqi.devueltoTarjeta, hay: culqi.cobradoTarjeta > 0 },
  ];
  return (
    <section className="cc-card" aria-label="Pagos en línea (Culqi)" data-testid="bloque-culqi">
      <h3 className="cc-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconoMedioPago medio="PAGO_EN_LINEA" tamano={22} ariaHidden />
        <span>Pagos en línea (Culqi)</span>
      </h3>
      <p className="cc-peq">Se verifica en CulqiPanel, no en el Yape del local.</p>
      {filas.filter((f) => f.hay).map((f) => (
        <div key={f.medio} className="cc-dig" data-testid={`culqi-${f.medio.toLowerCase()}`}>
          <div className="cc-dig-nom" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconoMedioPago medio={f.medio} tamano={22} ariaHidden />
            <span>{f.nombre}</span>
          </div>
          <div className="cc-dig-sis">
            Sistema <b>{soles(f.monto)}</b>
            {f.devuelto > 0 ? <small> (devuelto {soles(f.devuelto)})</small> : null}
          </div>
          <div className="cc-dig-dif">Visto = sistema ✓</div>
        </div>
      ))}
      <div className="cc-dig" data-testid="culqi-total">
        <div className="cc-dig-nom"><strong>Total Culqi</strong></div>
        <div className="cc-dig-sis"><b>{soles(culqi.total)}</b></div>
      </div>
      {culqi.comision && <ComisionPasarela comision={culqi.comision} />}
      {culqi.operaciones && culqi.operaciones.length > 0 && <OperacionesCulqi operaciones={culqi.operaciones} />}
    </section>
  );
}
