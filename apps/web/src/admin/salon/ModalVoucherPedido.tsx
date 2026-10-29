import { useEffect, useState } from 'react';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { medioDigitalVoucher } from '../pedidos/mediosPago';
import type { PlanPagoItem } from '../pedidos/planPago';
import { vouchersApi } from '../vouchers/vouchersApi';
import type { MiPedido } from './tipos';
import './mis-pedidos-voucher.css';

export interface ModalVoucherPedidoProps {
  /** montoDigital: la parte del plan que lleva voucher (sin él, se muestra el total del medio). */
  pedido: Pick<MiPedido, 'id' | 'codigo' | 'pagoMetodo' | 'puedeCambiarVoucher'> & { montoDigital?: number; plan?: Array<{ medio: string; monto: number }> };
  /** Un voucher por medio digital del plan: este es el medio de esta captura y su monto. */
  medioVoucher?: 'YAPE' | 'PLIN' | 'TRANSFERENCIA';
  montoMedio?: number;
  alCerrar: () => void;
  /** Deja el pedido sin voucher por ahora (botón «Subir después»). Solo se muestra si se pasa. */
  alSubirDespues?: () => void;
  /** Una foto legible ya quedó ligada al pedido: la pantalla vuelve a leer la lista. */
  alGuardado?: () => void;
}

/** Ventana para subir la foto del voucher de un pedido digital del mozo. */
export function ModalVoucherPedido({
  pedido,
  medioVoucher,
  montoMedio,
  alCerrar,
  alSubirDespues,
  alGuardado,
}: ModalVoucherPedidoProps) {
  const medio = medioVoucher ?? medioDigitalVoucher(pedido.pagoMetodo);
  const monto = montoMedio ?? pedido.montoDigital;
  // Antes de la foto se guarda el plan: el servidor compara la captura contra el monto de SU medio
  const guardarPlan = async () => {
    if (pedido.plan && pedido.plan.length > 0) await vouchersApi.guardarPlanPago(pedido.id, pedido.plan as PlanPagoItem[]);
  };
  const nombreMedio = medio === 'YAPE' ? 'Yape' : medio === 'PLIN' ? 'Plin' : 'Transferencia';
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [alCerrar]);

  if (!medio) return null;

  const idTitulo = `mpv-titulo-${pedido.id}`;

  return (
    <div className="mpv-overlay" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="mpv-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mpv-cabeza">
          <h2 id={idTitulo}>Voucher del pedido {pedido.codigo}</h2>
        </header>

        <div className="mpv-cuerpo">
          {monto != null && (
            <p className="mpv-ayuda">
              Voucher de {nombreMedio} por S/ {monto.toFixed(2)}
            </p>
          )}
          <SubirVoucherMozo
            pedidoId={pedido.id}
            medio={medio}
            antesDeSubir={guardarPlan}
            quitable={pedido.puedeCambiarVoucher !== false}
            alQuitado={() => {
              setGuardado(false);
              alGuardado?.();
            }}
            opcional
            alVoucherValido={(info) => {
              if (!info.legible) return;
              setGuardado(true);
              alGuardado?.();
            }}
          />
          {guardado ? (
            <p role="status" className="mpv-exito">
              Voucher guardado: se lee bien y ya queda ligado al pedido {pedido.codigo}.
            </p>
          ) : (
            <p className="mpv-ayuda">Si la foto no se lee, toma otra.</p>
          )}
        </div>

        <footer className="mpv-pie">
          {!guardado && alSubirDespues && (
            <button type="button" className="mpv-secundario" onClick={alSubirDespues}>
              Subir después
            </button>
          )}
          <button type="button" className="mpv-cerrar" onClick={alCerrar}>
            {guardado ? 'Listo' : 'Cerrar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
