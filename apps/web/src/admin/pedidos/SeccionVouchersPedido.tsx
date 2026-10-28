import { useEffect, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { vouchersApi } from '../vouchers/vouchersApi';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import type { VoucherPagoItem } from '../vouchers/tipos';

export interface SeccionVouchersPedidoProps {
  pedidoId: string | number;
  /** Cambia cuando el pedido cambia (p. ej. tras cobrar) para volver a leer las fotos. */
  recargarClave?: string | number | null;
  total?: number | string | null;
  medio?: string | null;
  /** Avisa a quien la usa (p. ej. ModalConfirmarPago) con los vouchers leídos del pedido. */
  alCargar?: (vouchers: VoucherPagoItem[]) => void;
}

/**
 * Fotos de comprobante enlazadas a un pedido (cualquier origen: mozo, caja, WhatsApp, carta).
 * El servidor exige vouchers/ver (CAJERO, ADMIN): sin permiso responde 403 y la sección no se muestra.
 */
export function SeccionVouchersPedido({ pedidoId, recargarClave, total, medio, alCargar }: SeccionVouchersPedidoProps) {
  const [vouchers, setVouchers] = useState<VoucherPagoItem[]>([]);
  // Sube cada vez que un voucher se mueve (aquí o desde Mensajes): vuelve a leer las fotos del pedido
  const [recarga, setRecarga] = useState(0);
  useEventos('vouchers:actualizado', () => setRecarga((n) => n + 1));

  useEffect(() => {
    let activo = true;
    vouchersApi
      .listarVouchers({ pedidoId, estado: 'todos' })
      .then((items) => {
        if (!activo) return;
        const lista = Array.isArray(items) ? items : [];
        setVouchers(lista);
        alCargar?.(lista);
      })
      .catch(() => {
        if (!activo) return;
        setVouchers([]);
        alCargar?.([]);
      });
    return () => {
      activo = false;
    };
    // alCargar no entra en las dependencias: cambia en cada render del padre y no debe re-leer.
  }, [pedidoId, recargarClave, recarga]);

  if (vouchers.length === 0) return null;

  return (
    <div
      data-testid="seccion-vouchers-pedido"
      style={{
        border: '1.5px solid var(--cp-line, #E3D6C6)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--cp-white, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>
        Comprobantes del pedido ({vouchers.length})
      </div>
      {vouchers.map((v) => (
        <div key={String(v.id)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FotoAmpliable archivoId={v.archivoId} />
          <TarjetaLecturaVoucher
            voucher={{
              id: v.id,
              semaforo: v.semaforo,
              motivos: v.motivos,
              extraido: v.extraido,
              medio: v.medio ?? medio ?? null,
            }}
            pedido={{ total: total ?? null, medio: medio ?? null }}
            puedeVer
          />
          <ReasignarVoucherBoton voucherId={v.id} onReasignado={() => setRecarga((n) => n + 1)} />
        </div>
      ))}
    </div>
  );
}
