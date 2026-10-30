import { useEffect, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { HistorialVoucher } from '../salon/HistorialVoucher';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { vouchersApi } from '../vouchers/vouchersApi';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { BannerVouchersIaPausa } from '../vouchers/BannerVouchersIaPausa';
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
  const [aviso, setAviso] = useState('');
  useEventos('vouchers:actualizado', (d?: { pedidoIds?: Array<string | number>; motivo?: string; origen?: string }) => {
    setRecarga((n) => n + 1);
    const esMio = !!d?.pedidoIds?.some((i) => String(i) === String(pedidoId));
    if (esMio && (d?.motivo === 'subido' || d?.motivo === 'reemplazado')) {
      setAviso(d.origen === 'WHATSAPP' ? 'Llegó el voucher por WhatsApp' : 'Se actualizó el voucher de este pedido');
    }
  });
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 6000);
    return () => clearTimeout(t);
  }, [aviso]);
  // Reemplazo tardío (Caja/Admin): motivo obligatorio y confirmación; el anterior queda en el historial
  const [reemplazando, setReemplazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [medioCambio, setMedioCambio] = useState<'YAPE' | 'PLIN' | 'TRANSFERENCIA'>('YAPE');
  const [confirmando, setConfirmando] = useState(false);
  const [subiendoCambio, setSubiendoCambio] = useState(false);

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
      <BannerVouchersIaPausa />
      {aviso && (
        <div role="status" data-testid="aviso-voucher" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)', background: '#E6F5EA', border: '1px solid #9BD3AB', borderRadius: 8, padding: '4px 10px' }}>
          {aviso}
        </div>
      )}
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>
        Comprobantes del pedido ({vouchers.length})
      </div>
      <HistorialVoucher pedidoId={pedidoId} />
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
      {!reemplazando ? (
        <button type="button" onClick={() => setReemplazando(true)} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700 }}>
          Reemplazar voucher
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            Medio{' '}
            <select value={medioCambio} onChange={(e) => setMedioCambio(e.target.value as typeof medioCambio)}>
              <option value="YAPE">Yape</option>
              <option value="PLIN">Plin</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </label>
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Motivo del cambio (mínimo 5 caracteres)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </label>
          {!subiendoCambio && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={motivo.trim().length < 5} onClick={() => setConfirmando(true)}>
                Continuar
              </button>
              <button type="button" onClick={() => { setReemplazando(false); setMotivo(''); }}>
                Cancelar
              </button>
            </div>
          )}
          {subiendoCambio && (
            <SubirVoucherMozo
              pedidoId={pedidoId}
              medio={medioCambio}
              motivoCambio={motivo.trim()}
              alVoucherValido={() => undefined}
              alRespuesta={() => {
                setSubiendoCambio(false);
                setReemplazando(false);
                setMotivo('');
                setRecarga((n) => n + 1);
              }}
            />
          )}
        </div>
      )}
      <Confirmar
        abierto={confirmando}
        titulo="Reemplazar el voucher"
        mensaje="El voucher vigente queda en el historial como reemplazado. Después elige la nueva foto."
        textoSi="Sí, reemplazar"
        textoNo="No"
        alConfirmar={() => {
          setConfirmando(false);
          setSubiendoCambio(true);
        }}
        alCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
