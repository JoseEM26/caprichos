import { useEffect, useState } from 'react';
import { CapturasPlanDigital } from '../../pedidos/CapturasPlanDigital';
import { textoConfirmaSinCaptura } from '../../pedidos/mediosPago';
import { nombreMedio, type PlanPagoItem } from '../../pedidos/planPago';
import { vouchersApi } from '../../vouchers/vouchersApi';
import '../mis-pedidos-voucher.css';
import '../paso-pago-pedido.css';

export interface ModalCapturasPedidoProps {
  pedido: { id: string; codigo: string };
  /** Lo que entrega el cliente por cada medio (venta + propina). Una captura por cada medio digital. */
  plan: PlanPagoItem[];
  /**
   * «Pagar ahora»: al tocar «Registrar pago» se cobra (Caja) o se deja «pagado por mozo, por verificar» (mozo).
   * Sin esta función solo se suben las capturas y el pago lo registra otra persona más tarde.
   */
  registrarPago?: (confirmaSinCaptura: boolean) => Promise<void>;
  /** Error de un intento previo de registrar el pago (el pedido ya está en cocina): se muestra para reintentar. */
  errorInicial?: string;
  /** Cierra sin registrar el pago (las capturas quedan pendientes en Mis pedidos). */
  alTerminar: () => void;
}

/**
 * Capturas por medio digital justo después de crear el pedido (hace falta su número para subirlas).
 * Cada medio digital pide la suya; todas son opcionales: sin ellas se confirma con la casilla «ya hablé con el
 * cliente y pagó» (misma regla que la precuenta).
 */
export function ModalCapturasPedido({ pedido, plan, registrarPago, errorInicial, alTerminar }: ModalCapturasPedidoProps) {
  const [faltan, setFaltan] = useState<string[]>([]);
  const [planGuardado, setPlanGuardado] = useState(false);
  const [sinCaptura, setSinCaptura] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState<string | null>(errorInicial ?? null);

  // Antes de la primera captura el servidor debe conocer el plan: compara cada foto contra el monto de SU medio
  useEffect(() => {
    let vigente = true;
    vouchersApi
      .guardarPlanPago(pedido.id, plan)
      .catch((e: any) => vigente && setError(e?.message || 'No se pudo guardar el plan de pago'))
      .finally(() => vigente && setPlanGuardado(true));
    return () => {
      vigente = false;
    };
  }, [pedido.id, plan]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !registrando) alTerminar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alTerminar, registrando]);

  const registrar = async () => {
    if (!registrarPago || registrando) return;
    setRegistrando(true);
    setError(null);
    try {
      await registrarPago(faltan.length > 0 && sinCaptura);
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar el pago. Inténtalo de nuevo.');
      setRegistrando(false);
    }
  };

  const idTitulo = `cap-titulo-${pedido.id}`;
  const puedeRegistrar = planGuardado && (faltan.length === 0 || sinCaptura);

  return (
    <div className="mpv-overlay" onClick={() => !registrando && alTerminar()}>
      <div role="dialog" aria-modal="true" aria-labelledby={idTitulo} className="mpv-panel" onClick={(e) => e.stopPropagation()}>
        <header className="mpv-cabeza">
          <h2 id={idTitulo}>Capturas del pedido {pedido.codigo}</h2>
        </header>
        <div className="mpv-cuerpo np2-capturas">
          <p className="mpv-ayuda">
            Sube la captura de cada medio digital:{' '}
            {plan
              .filter((f) => f.medio !== 'EFECTIVO' && f.medio !== 'TARJETA')
              .map((f) => `${nombreMedio(f.medio)} S/ ${f.monto.toFixed(2)}`)
              .join(' · ')}
            . Son opcionales: puedes subirlas después.
          </p>
          {planGuardado && <CapturasPlanDigital pedidoId={pedido.id} planPago={plan} alCambiar={setFaltan} />}
          {registrarPago && faltan.length > 0 && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={sinCaptura}
                onChange={(e) => setSinCaptura(e.target.checked)}
                style={{ width: 22, height: 22, flex: 'none' }}
              />
              {textoConfirmaSinCaptura(faltan.join(' + '))}
            </label>
          )}
          {error && (
            <p role="alert" className="np2-error">
              {error}
            </p>
          )}
        </div>
        <footer className="mpv-pie">
          <button type="button" className="mpv-secundario" onClick={alTerminar} disabled={registrando}>
            {registrarPago ? 'Registrar el pago después' : 'Subir después'}
          </button>
          {registrarPago ? (
            <button type="button" className="mpv-cerrar" onClick={registrar} disabled={!puedeRegistrar || registrando}>
              {registrando ? 'Registrando…' : 'Registrar pago'}
            </button>
          ) : (
            <button type="button" className="mpv-cerrar" onClick={alTerminar}>
              {faltan.length === 0 ? 'Listo' : 'Cerrar'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
