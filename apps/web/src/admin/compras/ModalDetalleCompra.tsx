import React, { useState } from 'react';
import { comprasApi, CompraItem } from './comprasApi';

interface ModalDetalleCompraProps {
  abierto: boolean;
  alCerrar: () => void;
  compra: CompraItem | null;
  alActualizar: () => void;
}

export const ModalDetalleCompra: React.FC<ModalDetalleCompraProps> = ({
  abierto,
  alCerrar,
  compra,
  alActualizar,
}) => {
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [motivoAnular, setMotivoAnular] = useState('');
  const [mostrandoAnular, setMostrandoAnular] = useState(false);

  if (!abierto || !compra) return null;

  const handleMarcarPagada = async () => {
    try {
      setCargando(true);
      setErrorMsg('');
      await comprasApi.marcarPagada(compra.id);
      alActualizar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al marcar compra como pagada.');
    } finally {
      setCargando(false);
    }
  };

  const handleAnular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoAnular.trim()) {
      setErrorMsg('Debe ingresar el motivo de anulación.');
      return;
    }
    try {
      setCargando(true);
      setErrorMsg('');
      await comprasApi.anularCompra(compra.id, motivoAnular.trim());
      alActualizar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al anular compra.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de compra"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(640px, calc(100% - 24px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--cp-white)',
          borderRadius: 16,
          boxShadow: 'rgba(11, 44, 62, 0.25) 0px 10px 30px',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--cp-navy)',
          fontFamily: '"Open Sans", system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              {compra.comprobanteTipo} {compra.comprobanteNumero}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Proveedor: <b>{compra.proveedorNombre}</b>
            </div>
          </div>
          <button
            onClick={alCerrar}
            style={{
              border: 0,
              background: 'transparent',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--cp-soft)',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgb(253, 236, 232)',
              color: 'var(--cp-rust)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div style={{ background: 'var(--cp-cream)', padding: 10, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--cp-soft)' }}>Fecha emisión</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{compra.fechaEmision}</div>
          </div>
          <div style={{ background: 'var(--cp-cream)', padding: 10, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--cp-soft)' }}>Condición</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {compra.condicion} {compra.condicion === 'CREDITO' ? `(${compra.diasCredito}d)` : ''}
            </div>
          </div>
          <div style={{ background: 'var(--cp-cream)', padding: 10, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--cp-soft)' }}>Estado recepción</div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                background:
                  compra.estado === 'RECIBIDO'
                    ? 'var(--cp-greenbg)'
                    : compra.estado === 'PENDIENTE'
                    ? 'rgb(255, 241, 201)'
                    : 'var(--cp-line)',
                color: 'var(--cp-navy)',
                marginTop: 2,
              }}
            >
              {compra.estado === 'RECIBIDO' ? 'Recibida' : compra.estado === 'PENDIENTE' ? 'Por recibir' : 'Anulada'}
            </span>
          </div>
          <div style={{ background: 'var(--cp-cream)', padding: 10, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--cp-soft)' }}>Estado de pago</div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                background: compra.estadoPago === 'PAGADA' ? 'var(--cp-greenbg)' : 'rgb(255, 241, 201)',
                color: 'var(--cp-navy)',
                marginTop: 2,
              }}
            >
              {compra.estadoPago === 'PAGADA' ? 'Pagada' : 'Pendiente'}
            </span>
          </div>
        </div>

        {/* Tabla de líneas */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Insumos incluidos</div>
          <div style={{ border: '1px solid var(--cp-line)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--cp-cream)', textAlign: 'left', borderBottom: '1px solid var(--cp-line)' }}>
                  <th style={{ padding: '8px 12px' }}>Insumo</th>
                  <th style={{ padding: '8px 12px' }}>Cantidad</th>
                  <th style={{ padding: '8px 12px' }}>Costo unit.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {compra.lineas.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--cp-line)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.insumoNombre}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {l.cantidadCompra} {l.unidad}
                    </td>
                    <td style={{ padding: '8px 12px' }}>s/ {l.costoUnit.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                      s/ {(l.subtotal ?? ((l.cantidadCompra || 0) * l.costoUnit)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totales */}
        <div style={{ alignSelf: 'flex-end', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            Subtotal: s/ {compra.subtotal.toFixed(2)} · IGV: s/ {compra.igv.toFixed(2)}
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, marginTop: 4 }}>
            Total: s/ {compra.montoTotal.toFixed(2)}
          </div>
        </div>

        {/* Panel de Anulación */}
        {mostrandoAnular && (
          <form
            onSubmit={handleAnular}
            style={{
              background: 'rgb(253, 236, 232)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
              ¿Está seguro de anular esta compra? Se revertirán las entradas de stock en Almacén.
            </div>
            <input
              type="text"
              placeholder="Escriba el motivo de anulación..."
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 38,
                borderRadius: 6,
                border: '1px solid var(--cp-rust)',
                padding: '0 8px',
                background: 'var(--cp-white)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMostrandoAnular(false)}
                style={{
                  minHeight: 36,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid var(--cp-soft)',
                  background: 'transparent',
                  color: 'var(--cp-soft)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                style={{
                  minHeight: 36,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: 0,
                  background: 'var(--cp-rust)',
                  color: 'var(--cp-white)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {cargando ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </form>
        )}

        {/* Botones de acción */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--cp-line)',
            paddingTop: 14,
          }}
        >
          <div>
            {compra.estado !== 'ANULADA' && !mostrandoAnular && (
              <button
                type="button"
                onClick={() => setMostrandoAnular(true)}
                style={{
                  minHeight: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--cp-rust)',
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Anular compra
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {compra.estado !== 'ANULADA' && compra.estadoPago !== 'PAGADA' && (
              <button
                type="button"
                onClick={handleMarcarPagada}
                disabled={cargando}
                style={{
                  minHeight: 40,
                  padding: '0 16px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Marcar como pagada
              </button>
            )}
            <button
              type="button"
              onClick={alCerrar}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
