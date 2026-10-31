import { useEffect, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { HistorialVoucher } from '../salon/HistorialVoucher';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';
import { vouchersApi } from '../vouchers/vouchersApi';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { BannerVouchersIaPausa } from '../vouchers/BannerVouchersIaPausa';
import { Boton } from '../../comun/Boton';
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
  // Reemplazo tardío (Caja/Admin): se elige el medio y la foto; el motivo se pregunta UNA vez, junto al «Antes/Nuevo»
  // (SubirVoucherMozo). El anterior queda en el historial como reemplazado.
  const [reemplazando, setReemplazando] = useState(false);
  const [medioCambio, setMedioCambio] = useState<'YAPE' | 'PLIN' | 'TRANSFERENCIA' | null>(null);

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
        <Boton
          variante="secundario"
          onClick={() => {
            const m = String(vouchers[0]?.medio ?? medio ?? 'YAPE').toUpperCase();
            setMedioCambio(m.includes('PLIN') ? 'PLIN' : m.includes('TRANSF') ? 'TRANSFERENCIA' : 'YAPE');
            setReemplazando(true);
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Reemplazar voucher
        </Boton>
      ) : (
        <div
          data-testid="reemplazo-voucher"
          style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1.5px solid var(--cp-orange, #E67929)', background: 'var(--cp-cream, #FFF4E6)', borderRadius: 14, padding: 12 }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>Cambiar el voucher</div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #2C4C5D)' }}>
            Elige el medio y la foto correcta. Antes de guardar verás el voucher anterior junto al nuevo y escribirás el motivo una sola vez.
          </div>
          <div role="group" aria-label="Medio del voucher" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['YAPE', 'PLIN', 'TRANSFERENCIA'] as const).map((m) => {
              const activo = medioCambio === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setMedioCambio(m)}
                  style={{
                    minHeight: 44,
                    padding: '6px 16px',
                    borderRadius: 999,
                    border: `1.5px solid ${activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-line, #E3D6C6)'}`,
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-white, #FFFFFF)',
                    color: activo ? 'var(--cp-white, #FFFFFF)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'YAPE' ? 'Yape' : m === 'PLIN' ? 'Plin' : 'Transferencia'}
                </button>
              );
            })}
          </div>
          {medioCambio && (
            <SubirVoucherMozo
              key={medioCambio}
              cambioDirecto
              pedidoId={pedidoId}
              medio={medioCambio}
              alVoucherValido={() => undefined}
              alRespuesta={() => {
                setReemplazando(false);
                setRecarga((n) => n + 1);
              }}
            />
          )}
          <Boton variante="secundario" onClick={() => setReemplazando(false)} style={{ alignSelf: 'flex-start' }}>
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  );
}
