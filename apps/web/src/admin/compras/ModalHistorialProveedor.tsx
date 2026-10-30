import React, { useState, useEffect } from 'react';
import { comprasApi, ProveedorItem, CompraItem } from './comprasApi';

interface ModalHistorialProveedorProps {
  abierto: boolean;
  alCerrar: () => void;
  proveedor: ProveedorItem | null;
}

export const ModalHistorialProveedor: React.FC<ModalHistorialProveedorProps> = ({
  abierto,
  alCerrar,
  proveedor,
}) => {
  const [compras, setCompras] = useState<CompraItem[]>([]);
  const [totalCompras, setTotalCompras] = useState(0);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (abierto && proveedor) {
      setCargando(true);
      comprasApi
        .obtenerHistorialProveedor(proveedor.id)
        .then((res) => {
          setCompras(res.compras || []);
          setTotalCompras(res.totalCompras || 0);
        })
        .catch(() => {
          setCompras([]);
          setTotalCompras(0);
        })
        .finally(() => setCargando(false));
    }
  }, [abierto, proveedor]);

  if (!abierto || !proveedor) return null;

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
        aria-label="Historial del proveedor"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(640px, calc(100% - 24px))',
          maxHeight: '85vh',
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
              {proveedor.nombreComercial || proveedor.razonSocial}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              RUC: {proveedor.ruc || 'Sin RUC'} · {proveedor.telefono ? `Tel: ${proveedor.telefono}` : 'Sin teléfono'}
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

        <div
          style={{
            background: 'var(--cp-cream)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Total acumulado en compras</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
              s/ {totalCompras.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {compras.length} {compras.length === 1 ? 'compra registrada' : 'compras registradas'}
          </div>
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--cp-soft)' }}>
            Cargando historial...
          </div>
        ) : compras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--cp-soft)' }}>
            No hay compras registradas para este proveedor.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {compras.map((c) => (
              <div
                key={c.id}
                style={{
                  border: '1px solid var(--cp-line)',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--cp-white)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {c.comprobanteTipo} {c.comprobanteNumero}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                    {c.fechaEmision} · {c.condicion} {c.condicion === 'CREDITO' ? `(${c.diasCredito} días)` : ''}
                  </div>
                  {c.insumosResumen && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>{c.insumosResumen}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15 }}>
                    s/ {c.montoTotal.toFixed(2)}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        c.estado === 'RECIBIDO'
                          ? 'var(--cp-greenbg)'
                          : c.estado === 'PENDIENTE'
                          ? 'rgb(255, 241, 201)'
                          : 'var(--cp-line)',
                      color: 'var(--cp-navy)',
                      marginTop: 4,
                    }}
                  >
                    {c.estado === 'RECIBIDO' ? 'Recibida' : c.estado === 'PENDIENTE' ? 'Por recibir' : 'Anulada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={alCerrar}
            style={{
              minHeight: 40,
              padding: '0 18px',
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
    </>
  );
};
