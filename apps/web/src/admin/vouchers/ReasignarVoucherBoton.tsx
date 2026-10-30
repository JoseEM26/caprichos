import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';

export interface DestinoReasignacion {
  id: string;
  codigo: string;
  total: number;
  medio: string;
  creadoEn: string;
}

interface RespuestaDestinos {
  voucherId: string;
  pedidoActual: { id: string; codigo: string } | null;
  bloqueado: boolean;
  destinos: DestinoReasignacion[];
}

/**
 * Caja mueve un voucher a otro pedido del mismo cliente con pago pendiente (Sí/No).
 * No aprueba el pago: solo cambia a qué pedido pertenece el comprobante.
 */
export function ReasignarVoucherBoton({
  voucherId,
  onReasignado,
}: {
  voucherId: string | number;
  onReasignado?: () => void;
}) {
  let puede = false;
  try {
    const sesion = useSesion();
    puede = Boolean(sesion?.tiene?.('vouchers/ver')) && Boolean(sesion?.tiene?.('caja/ver'));
  } catch {
    puede = false;
  }

  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<RespuestaDestinos | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    setCargando(true);
    setError(null);
    api
      .get<RespuestaDestinos>(`/admin/vouchers/${voucherId}/destinos`)
      .then((r) => {
        if (activo) setDatos(r);
      })
      .catch((err) => {
        if (activo) setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los pedidos');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [abierto, voucherId]);

  if (!puede) return null;

  const destino = datos?.destinos.find((d) => d.id === elegido) ?? null;

  const ejecutar = async () => {
    if (!destino) return;
    setCargando(true);
    try {
      await api.post(`/admin/vouchers/${voucherId}/reasignar`, { pedidoId: destino.id });
      setConfirmando(false);
      setAbierto(false);
      setElegido(null);
      onReasignado?.();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo reasignar el voucher');
      setConfirmando(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={() => {
          setDatos(null);
          setElegido(null);
          setAbierto(true);
        }}
        style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--cp-line, #E3D6C6)', background: 'var(--cp-white, #FFFFFF)', fontWeight: 700, cursor: 'pointer' }}
      >
        Reasignar a otro pedido
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" aria-label="Reasignar voucher" style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--cp-white, #FFFFFF)' }}>
          <div style={{ fontWeight: 800 }}>
            Mover el voucher{datos?.pedidoActual ? ` de ${datos.pedidoActual.codigo}` : ''} a otro pedido
          </div>
          {cargando && <div>Cargando pedidos...</div>}
          {error && <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 600 }}>{error}</div>}
          {datos?.bloqueado && (
            <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 600 }}>
              Este voucher ya aprobó un pago; no se puede mover.
            </div>
          )}
          {datos && !datos.bloqueado && datos.destinos.length === 0 && (
            <div>No hay otro pedido de este cliente que espere pago digital.</div>
          )}
          {datos && !datos.bloqueado &&
            datos.destinos.map((d) => (
              <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 40 }}>
                <input type="radio" name="destino-voucher" checked={elegido === d.id} onChange={() => setElegido(d.id)} />
                <span>
                  <b>{d.codigo}</b> · S/ {d.total.toFixed(2)} · {d.medio}
                </span>
              </label>
            ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAbierto(false)} style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: 0, background: '#F0F2F5', fontWeight: 700 }}>
              Cerrar
            </button>
            <button
              type="button"
              disabled={!destino || cargando}
              onClick={() => setConfirmando(true)}
              style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-white, #FFFFFF)', fontWeight: 700 }}
            >
              Mover voucher
            </button>
          </div>
        </div>
      )}

      <Confirmar
        abierto={confirmando}
        titulo="¿Mover el voucher?"
        mensaje={`¿Confirmas mover el voucher${datos?.pedidoActual ? ` de ${datos.pedidoActual.codigo}` : ''} a ${destino?.codigo ?? 'el pedido elegido'}? Solo se mueve el comprobante: el pago se aprueba aparte.`}
        textoSi="Sí, mover voucher"
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
