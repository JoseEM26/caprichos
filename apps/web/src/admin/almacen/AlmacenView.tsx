import React, { useState, useEffect, useMemo } from 'react';
import {
  almacenApi,
  MovimientoItem,
  InsumoStockItem,
} from './almacenApi';
import { ModalRegistrarMovimiento } from './ModalRegistrarMovimiento';
import { ModalRegistrarProduccion } from './ModalRegistrarProduccion';
import { ModalCerrarDia } from './ModalCerrarDia';

export const AlmacenView: React.FC = () => {
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [insumos, setInsumos] = useState<InsumoStockItem[]>([]);
  const [buscar, setBuscar] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState('');

  // Modales
  const [modalMovAbierto, setModalMovAbierto] = useState(false);
  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);

  // Anulación
  const [movAnularId, setMovAnularId] = useState<string | null>(null);
  const [motivoAnular, setMotivoAnular] = useState('');
  const [anulando, setAnulando] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resMovs, resInsumos] = await Promise.all([
        almacenApi.listarMovimientos().catch(() => ({ conteos: { todos: 0, entradas: 0, salidas: 0, mermas: 0, devoluciones: 0 }, movimientos: [] })),
        almacenApi.listarInsumos().catch(() => []),
      ]);

      setMovimientos(resMovs.movimientos);
      setInsumos(resInsumos);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Movimientos filtrados
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      // Filtro por tipo
      if (filtroTipo !== 'Todos' && m.tipo !== filtroTipo) {
        return false;
      }
      // Filtro por búsqueda de texto
      if (buscar.trim()) {
        const q = buscar.toLowerCase();
        const coincideInsumo = m.insumoNombre.toLowerCase().includes(q);
        const coincideDoc = m.documento.toLowerCase().includes(q);
        const coincideOrigen = m.origen.toLowerCase().includes(q);
        const coincideDestino = m.destino.toLowerCase().includes(q);
        return coincideInsumo || coincideDoc || coincideOrigen || coincideDestino;
      }
      return true;
    });
  }, [movimientos, filtroTipo, buscar]);

  // Conteos dinámicos por tipo calculados a partir de los datos reales de la BD
  const conteosPorTipo = useMemo(() => {
    const counts = {
      Todos: movimientos.length,
      ENTRADA: 0,
      SALIDA: 0,
      MERMA: 0,
      DEVOLUCION: 0,
    };
    movimientos.forEach((m) => {
      if (m.tipo === 'ENTRADA') counts.ENTRADA++;
      else if (m.tipo === 'SALIDA') counts.SALIDA++;
      else if (m.tipo === 'MERMA') counts.MERMA++;
      else if (m.tipo === 'DEVOLUCION') counts.DEVOLUCION++;
    });
    return counts;
  }, [movimientos]);

  const handleAnularMovimiento = async (id: string) => {
    if (!motivoAnular.trim()) {
      alert('Debe especificar el motivo de anulación.');
      return;
    }
    try {
      setAnulando(true);
      await almacenApi.anularMovimiento(id, motivoAnular.trim());
      setMovAnularId(null);
      setMotivoAnular('');
      setMensajeExito('Movimiento anulado e invertido en stock.');
      cargarDatos();
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Error al anular movimiento');
    } finally {
      setAnulando(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    const t = (tipo || '').toUpperCase();
    switch (t) {
      case 'ENTRADA':
        return { label: 'Entrada', bg: 'var(--cp-line)', color: 'var(--cp-navy)' };
      case 'SALIDA':
        return { label: 'Salida', bg: 'var(--cp-line)', color: 'var(--cp-navy)' };
      case 'MERMA':
        return { label: 'Merma', bg: 'rgb(253, 236, 232)', color: 'var(--cp-rust)' };
      case 'DEVOLUCION':
        return { label: 'Devolución', bg: 'var(--cp-greenbg)', color: 'var(--cp-navy)' };
      case 'VENTA':
        return { label: 'Venta', bg: 'var(--cp-sand)', color: 'var(--cp-navy)' };
      case 'ANULACION':
        return { label: 'Anulación', bg: 'var(--cp-line)', color: 'var(--cp-rust)' };
      default:
        return {
          label: tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase() : tipo,
          bg: 'var(--cp-line)',
          color: 'var(--cp-navy)',
        };
    }
  };

  const alertasBajo = useMemo(() => {
    return insumos.filter((i) => i.stockActual <= i.stockMinimo).length;
  }, [insumos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Recuadro superior: Gestionar listas */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Las listas que se eligen en este módulo (categorías, tipos u origen) se crean y se gestionan aquí mismo.
        </span>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/admin/listas-categorias';
          }}
          style={{
            minHeight: 44,
            padding: '0 16px',
            border: '1.5px solid var(--cp-navy)',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Gestionar listas
        </button>
      </div>

      {/* Banner superior de acciones */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Registra lo que entra, sale, se devuelve o se pierde. Cada movimiento actualiza el stock.
          La producción de la mañana entra como producto terminado y sus insumos salen del almacén
          (acta 02).
        </div>

        {alertasBajo > 0 && (
          <button
            type="button"
            onClick={() => {
              window.location.href = '/admin/compras';
            }}
            style={{
              alignSelf: 'flex-start',
              minHeight: 48,
              padding: '0 18px',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: 12,
              background: 'rgb(253, 236, 232)',
              color: 'var(--cp-rust)',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Stock bajo ({alertasBajo}) · pedir a proveedores
          </button>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModalMovAbierto(true)}
            style={{
              minHeight: 48,
              padding: '0 18px',
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Registrar movimiento
          </button>

          <button
            type="button"
            onClick={() => setModalProdAbierto(true)}
            style={{
              minHeight: 48,
              padding: '0 18px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Registrar la producción del día
          </button>

          <button
            type="button"
            onClick={() => setModalCierreAbierto(true)}
            style={{
              minHeight: 48,
              padding: '0 18px',
              border: '1.5px solid var(--cp-rust)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-rust)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cerrar el día (sobrantes a merma)
          </button>
        </div>
      </div>

      {mensajeExito && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--cp-greenbg)',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          ✓ {mensajeExito}
        </div>
      )}

      {cargando && (
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Cargando movimientos de almacén...
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="t-q" style={{ position: 'absolute', left: -9999 }}>
            Buscar
          </label>
          <input
            id="t-q"
            type="search"
            placeholder="Buscar por insumo o documento"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: 44,
              borderRadius: 9999,
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: 14,
            }}
          />
          <button
            type="button"
            aria-expanded={mostrarFiltros}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            style={{
              flex: '0 0 auto',
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              background: mostrarFiltros ? 'var(--cp-navy)' : 'transparent',
              color: mostrarFiltros ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filtros {filtroTipo !== 'Todos' ? `(${filtroTipo})` : ''}
          </button>
        </div>

        {mostrarFiltros && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              padding: '8px 4px',
              borderTop: '1px solid var(--cp-line)',
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setFiltroTipo('Todos')}
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--cp-navy)',
                fontSize: 12,
                fontWeight: 700,
                background: filtroTipo === 'Todos' ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === 'Todos' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Todos ({conteosPorTipo.Todos})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('ENTRADA')}
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--cp-navy)',
                fontSize: 12,
                fontWeight: 700,
                background: filtroTipo === 'ENTRADA' ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === 'ENTRADA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Entrada ({conteosPorTipo.ENTRADA})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('SALIDA')}
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--cp-navy)',
                fontSize: 12,
                fontWeight: 700,
                background: filtroTipo === 'SALIDA' ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === 'SALIDA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Salida ({conteosPorTipo.SALIDA})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('MERMA')}
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--cp-navy)',
                fontSize: 12,
                fontWeight: 700,
                background: filtroTipo === 'MERMA' ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === 'MERMA' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Merma ({conteosPorTipo.MERMA})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('DEVOLUCION')}
              style={{
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--cp-navy)',
                fontSize: 12,
                fontWeight: 700,
                background: filtroTipo === 'DEVOLUCION' ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === 'DEVOLUCION' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Devolución ({conteosPorTipo.DEVOLUCION})
            </button>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 600 }}>
          {movimientosFiltrados.length}{' '}
          {movimientosFiltrados.length === 1 ? 'resultado' : 'resultados'}
        </div>
      </div>

      {/* Rejilla de tarjetas de movimientos */}
      {movimientosFiltrados.length === 0 ? (
        <div
          style={{
            background: 'var(--cp-white)',
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
            border: '1px solid var(--cp-line)',
            color: 'var(--cp-soft)',
          }}
        >
          No hay movimientos de almacén que coincidan con la búsqueda.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: 12,
          }}
        >
          {movimientosFiltrados.map((m) => {
            const badge = getTipoBadge(m.tipo);
            const esAnulandoEste = movAnularId === m.id;

            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 12,
                  boxShadow: 'rgba(11, 44, 62, 0.1) 0px 6px 18px',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 16,
                      lineHeight: '21px',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.fechaFormateada}
                  </div>
                  <span
                    style={{
                      flex: '0 0 auto',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 9999,
                      padding: '2px 10px',
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0px, 1fr))',
                    gap: '8px 12px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Insumo
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {m.insumoNombre}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Cantidad
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {m.cantidadTexto}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Origen
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {m.origen}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Destino
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {m.destino}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Documento
                    </div>
                    <div style={{ fontSize: 13, lineHeight: '18px', overflowWrap: 'anywhere' }}>
                      {m.documento}
                    </div>
                  </div>
                </div>

                {esAnulandoEste ? (
                  <div
                    style={{
                      background: 'rgb(253, 236, 232)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Motivo de anulación..."
                      value={motivoAnular}
                      onChange={(e) => setMotivoAnular(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 32,
                        borderRadius: 6,
                        border: '1px solid var(--cp-rust)',
                        padding: '0 8px',
                        fontSize: 12,
                        background: 'var(--cp-white)',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setMovAnularId(null);
                          setMotivoAnular('');
                        }}
                        style={{
                          border: 0,
                          background: 'transparent',
                          fontSize: 11,
                          cursor: 'pointer',
                          color: 'var(--cp-soft)',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAnularMovimiento(m.id)}
                        disabled={anulando}
                        style={{
                          border: 0,
                          borderRadius: 6,
                          background: 'var(--cp-rust)',
                          color: 'var(--cp-white)',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        {anulando ? 'Anulando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    {m.esAnulable && !['VENTA', 'ANULACION'].includes(m.tipo?.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={() => setMovAnularId(m.id)}
                        style={{
                          flex: '1 1 0%',
                          minHeight: 44,
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: 12,
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Anular
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <ModalRegistrarMovimiento
        abierto={modalMovAbierto}
        alCerrar={() => setModalMovAbierto(false)}
        alGuardar={() => {
          cargarDatos();
          setMensajeExito('Movimiento registrado en almacén.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
        insumos={insumos}
      />

      <ModalRegistrarProduccion
        abierto={modalProdAbierto}
        alCerrar={() => setModalProdAbierto(false)}
        alGuardar={() => {
          cargarDatos();
          setMensajeExito('Producción del día registrada.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
      />

      <ModalCerrarDia
        abierto={modalCierreAbierto}
        alCerrar={() => setModalCierreAbierto(false)}
        alGuardar={() => {
          cargarDatos();
          setMensajeExito('Cierre del día completado con éxito.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
      />
    </div>
  );
};
