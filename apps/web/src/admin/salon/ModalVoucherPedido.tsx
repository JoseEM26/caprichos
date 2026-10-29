import { useEffect, useState } from 'react';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { medioDigitalVoucher } from '../pedidos/mediosPago';
import type { MiPedido } from './tipos';
import './mis-pedidos-voucher.css';

export interface ModalVoucherPedidoProps {
  /** montoDigital: la parte del plan que lleva voucher (sin él, se muestra el total del medio). */
  pedido: Pick<MiPedido, 'id' | 'codigo' | 'pagoMetodo'> & { montoDigital?: number };
  alCerrar: () => void;
  /** Deja el pedido sin voucher por ahora (botón «Subir después»). Solo se muestra si se pasa. */
  alSubirDespues?: () => void;
  /** Una foto legible ya quedó ligada al pedido: la pantalla vuelve a leer la lista. */
  alGuardado?: () => void;
}

/** Ventana para subir la foto del voucher de un pedido digital del mozo. */
export function ModalVoucherPedido({ pedido, alCerrar, alSubirDespues, alGuardado }: ModalVoucherPedidoProps) {
  const medio = medioDigitalVoucher(pedido.pagoMetodo);
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
          {pedido.montoDigital != null && (
            <p className="mpv-ayuda">
              Voucher de {nombreMedio} por S/ {pedido.montoDigital.toFixed(2)}
            </p>
          )}
          <SubirVoucherMozo
            pedidoId={pedido.id}
            medio={medio}
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
