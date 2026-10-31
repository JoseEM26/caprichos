import { useState, useEffect, useCallback } from 'react';
import { MovimientoItem, InsumoItem, LugarStockItem } from './tipos';
import { stockApi } from './stockApi';
import { ModalMovimiento } from './ModalMovimiento';
import { Paginacion } from '../../comun/Paginacion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';

import { formatearUnidad, qty1 } from './formato';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

interface MovimientosTabProps {
  insumos: InsumoItem[];
  lugares: LugarStockItem[];
}

export function MovimientosTab({ insumos, lugares }: MovimientosTabProps) {
  const [items, setItems] = useState<MovimientoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(12);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Modal registrar movimiento
  const [modalMovimientoAbierto, setModalMovimientoAbierto] = useState(false);

  const cargarMovimientos = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await stockApi.listarMovimientos({
        insumo: busqueda || undefined,
        tipo: filtroTipo || undefined,
        pagina,
        limite,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPaginas(res.totalPaginas);
    } catch (err: any) {
      setError(err.message || 'Error al cargar movimientos de stock');
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroTipo, pagina, limite]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const handleGuardarMovimiento = async (datos: any) => {
    await stockApi.registrarMovimiento(datos);
    await cargarMovimientos();
  };

  const tipoChips = [
    { id: '', label: 'Todos' },
    { id: 'ENTRADA', label: 'Entradas' },
    { id: 'SALIDA', label: 'Salidas' },
    { id: 'MERMA', label: 'Mermas' },
    { id: 'TRASLADO', label: 'Traslados' },
    { id: 'DEVOLUCION', label: 'Devoluciones' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Caja superior de acciones idéntica a Almacén en el mockup */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Registra lo que entra, sale, se devuelve o se pierde. Cada movimiento actualiza el stock. La producción de la mañana entra como producto terminado y sus insumos salen del almacén (acta 02).
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModalMovimientoAbierto(true)}
            style={{
              minHeight: '48px',
              padding: '0 18px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Registrar movimiento
          </button>
          <button
            type="button"
            onClick={() => alert('Función de producción del día: los insumos salen del almacén y el producto terminado entra al stock.')}
            style={{
              minHeight: '48px',
              padding: '0 18px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Registrar la producción del día
          </button>
          <button
            type="button"
            onClick={() => alert('Cerrar el día: los sobrantes no consumidos se envían a merma.')}
            style={{
              minHeight: '48px',
              padding: '0 18px',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--cp-rust)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cerrar el día (sobrantes a merma)
          </button>
        </div>
      </div>

      {/* Buscador y filtros idénticos al mockup */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por insumo o documento"
            style={{
              flex: '1',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: '14px',
            }}
          />
          <button
            type="button"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            style={{
              flex: 'none',
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: mostrarFiltros ? 'var(--cp-navy)' : 'transparent',
              color: mostrarFiltros ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              gap: '6px',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            Filtros
          </button>
        </div>

        {mostrarFiltros && (
          <BarraFiltros style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '8px' }}>
            <FiltroCombo
              etiqueta="Tipo de movimiento"
              valor={filtroTipo}
              valorPorDefecto=""
              opciones={tipoChips.map((c) => ({ valor: c.id, etiqueta: c.label }))}
              alCambiar={setFiltroTipo}
            />
          </BarraFiltros>
        )}
      </div>

      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        {total} resultados
      </div>

      {/* Cuadrícula de tarjetas de movimientos idéntica a Almacén en el mockup */}
      {cargando ? (
        <Cargando mensaje="Cargando movimientos..." />
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarMovimientos} />
      ) : items.length === 0 ? (
        <EstadoVacio
          titulo="Sin movimientos registrados"
          mensaje="No se encontraron movimientos con los filtros seleccionados."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {items.map((m) => {
            let chipBg = 'var(--cp-sand)';
            if (m.tipo === 'ENTRADA') chipBg = '#D9EFE2';
            if (m.tipo === 'SALIDA') chipBg = '#FBE9DF';
            if (m.tipo === 'MERMA' || m.tipo === 'ANULACION') chipBg = '#FDE2E2';

            return (
              <div
                key={m.id}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <b style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '15px' }}>{m.en}</b>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: chipBg,
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {m.tipo}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', gap: '8px' }}>
                  <span>
                    <span style={{ color: 'var(--cp-soft)' }}>Insumo: </span>
                    <b>{m.insumoNombre}</b>
                  </span>
                  <span>
                    <span style={{ color: 'var(--cp-soft)' }}>Cant: </span>
                    <b>{qty1(m.cantidad)} {formatearUnidad(m.unidadAlmacen || '')}</b>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--cp-soft)' }}>
                  <span>Lugar: {m.lugarNombre}</span>
                  {m.por && <span>Por: {m.por}</span>}
                </div>

                {m.nota && (
                  <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontWeight: 600 }}>
                    Nota: {m.nota}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <Paginacion
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          alCambiarPagina={(p) => setPagina(p)}
        />
      )}

      {/* Modal Registrar Movimiento */}
      {modalMovimientoAbierto && (
        <ModalMovimiento
          insumos={insumos}
          lugares={lugares}
          alCerrar={() => setModalMovimientoAbierto(false)}
          alGuardar={handleGuardarMovimiento}
        />
      )}
    </div>
  );
}
