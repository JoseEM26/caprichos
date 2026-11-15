import { IconoMedioPago } from '../../comun/IconoMedioPago';
import type { CulqiTurno, OperacionCulqi } from './cierreApi';
import { soles } from './cuadre.util';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });

/** Lista de operaciones Culqi (pedido, medio, monto, hora y n.º de operación) con la nota de dónde se verifican. */
export function OperacionesCulqi({ operaciones }: { operaciones: OperacionCulqi[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="dc-tabla" data-testid="operaciones-culqi">
        <thead>
          <tr><th>Pedido</th><th>Medio</th><th>Monto</th><th>Hora</th><th>N.º de operación</th></tr>
        </thead>
        <tbody>
          {operaciones.map((o, i) => (
            <tr key={`${o.pedidoId}-${o.medio}-${i}`}>
              <td>{o.pedidoCodigo}</td>
              <td>{o.medio === 'YAPE' ? 'Yape' : 'Tarjeta'}</td>
              <td>{soles(o.monto)}</td>
              <td>{hora(o.en)}</td>
              <td><code style={{ wordBreak: 'break-all' }}>{o.operacion ?? 'Sin dato'}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
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
      {culqi.operaciones && culqi.operaciones.length > 0 && <OperacionesCulqi operaciones={culqi.operaciones} />}
    </section>
  );
}
