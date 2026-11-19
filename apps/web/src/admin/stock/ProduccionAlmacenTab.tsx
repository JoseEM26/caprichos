import { useState, useEffect, useCallback } from 'react';
import { InsumoItem, LugarStockItem } from './tipos';
import { stockApi } from './stockApi';
import { ModalMovimiento } from './ModalMovimiento';
import { ModalRegistrarProduccion } from '../almacen/ModalRegistrarProduccion';
import { ModalCerrarDia } from '../almacen/ModalCerrarDia';
import { ExistenciasTab } from './ExistenciasTab';
import { MovimientosTab } from './MovimientosTab';

interface ProduccionAlmacenTabProps {
  insumos: InsumoItem[];
  lugares: LugarStockItem[];
  onActualizar?: () => void;
}

export function ProduccionAlmacenTab({
  insumos,
  lugares,
  onActualizar,
}: ProduccionAlmacenTabProps) {
  // Modal de producción simple ("Hoy preparé...")
  const [modalProduccionAbierto, setModalProduccionAbierto] = useState(false);

  // Modal de movimiento general con tipo configurable
  const [modalMovimientoAbierto, setModalMovimientoAbierto] = useState(false);
  const [tipoMovimientoInicial, setTipoMovimientoInicial] = useState<
    'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'TRASLADO' | 'AJUSTE'
  >('SALIDA');

  // Cierre del día: el mismo flujo con conteo de almacén (cierre-dia)
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);

  // Pedidos de cocina y barra al almacén (requisiciones/solicitudes)
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);

  const cargarPedidos = useCallback(async () => {
    // Por el momento no hay tabla separada de requisiciones internas, se inicializa vacío
    // Cualquier solicitud pendiente se listará aquí dinámicamente
    setPedidosPendientes([]);
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const abrirModalConTipo = (
    tipo: 'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'TRASLADO' | 'AJUSTE',
  ) => {
    setTipoMovimientoInicial(tipo);
    setModalMovimientoAbierto(true);
  };

  const handleGuardarMovimiento = async (datos: any) => {
    await stockApi.registrarMovimiento(datos);
    if (onActualizar) {
      onActualizar();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Texto descriptivo idéntico al mockup */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Aquí se registra lo que pasa con el stock: lo que se produce, lo que la cocina le pide al almacén y lo que se pierde. Cada cosa tiene su botón.
      </div>

      {/* 3 Tarjetas de acción superiores idénticas a Admin.dc.html (líneas 1121-1125) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' }}>
        {/* Tarjeta 1: Producir */}
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex' }}>
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Producir
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                Donas, galletas, pan o gelatina: baja la materia prima y suma el producto.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setModalProduccionAbierto(true)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Registrar producción
              </button>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Pedir al almacén */}
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex' }}>
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Pedir al almacén
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                La cocina o la barra pide insumos; el almacén los entrega.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => abrirModalConTipo('TRASLADO')}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Pedir al almacén
              </button>
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Pérdidas y cierre */}
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex' }}>
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Pérdidas y cierre
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                Lo que se cayó o se malogró, y lo que sobra al cerrar.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => abrirModalConTipo('MERMA')}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Registrar merma
              </button>
              <button
                type="button"
                onClick={() => abrirModalConTipo('MERMA')}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Merma de varios productos
              </button>
              <button
                type="button"
                onClick={() => setModalCierreAbierto(true)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cerrar el día (sobrantes a merma)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bloque: Pedidos de cocina y barra al almacén (líneas 1126-1128 del mockup) */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ fontWeight: 800 }}>Pedidos de cocina y barra al almacén</div>
        {pedidosPendientes.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>No hay pedidos.</div>
        ) : (
          pedidosPendientes.map((r, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--cp-line)',
                borderRadius: '10px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                <b>{r.titulo}</b>
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#fbe9df',
                  }}
                >
                  {r.estado}
                </span>
              </div>
              <div style={{ fontSize: '13px' }}>{r.lineas}</div>
            </div>
          ))
        )}
      </div>

      {/* Subsección: Existencias por lugar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
          Existencias por lugar físico
        </div>
        <ExistenciasTab />
      </div>

      {/* Subsección: Movimientos e historial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
          Historial de movimientos
        </div>
        <MovimientosTab insumos={insumos} lugares={lugares} />
      </div>

      {/* Modal de producción "Hoy preparé..." */}
      {modalProduccionAbierto && (
        <ModalRegistrarProduccion
          abierto={modalProduccionAbierto}
          alCerrar={() => setModalProduccionAbierto(false)}
          alGuardar={() => {
            if (onActualizar) onActualizar();
          }}
        />
      )}

      {/* Modal de movimiento para las acciones Producir, Pedir al almacén, Merma */}
      {modalMovimientoAbierto && (
        <ModalMovimiento
          insumos={insumos}
          lugares={lugares}
          tipoInicial={tipoMovimientoInicial}
          alCerrar={() => setModalMovimientoAbierto(false)}
          alGuardar={handleGuardarMovimiento}
        />
      )}

      {/* Cierre del día con conteo (cierre-dia): registra merma y diferencias contra el saldo real */}
      {modalCierreAbierto && (
        <ModalCerrarDia
          abierto={modalCierreAbierto}
          alCerrar={() => setModalCierreAbierto(false)}
          alGuardar={() => {
            if (onActualizar) onActualizar();
          }}
        />
      )}
    </div>
  );
}
