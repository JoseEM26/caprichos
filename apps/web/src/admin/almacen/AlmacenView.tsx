import React, { useState, useEffect, useMemo } from 'react';
import {
  almacenApi,
  MovimientoItem,
  InsumoStockItem,
} from './almacenApi';
import { ModalRegistrarMovimiento } from './ModalRegistrarMovimiento';
import { ModalRegistrarProduccion } from './ModalRegistrarProduccion';
import { ModalCerrarDia } from './ModalCerrarDia';
import { Confirmar } from '../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { usePideCodigo } from '../../comun/usePideCodigo';

export const AlmacenView: React.FC = () => {
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [insumos, setInsumos] = useState<InsumoStockItem[]>([]);
  const [buscar, setBuscar] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  // Modales
  const [modalMovAbierto, setModalMovAbierto] = useState(false);
  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);

  // Anulación
  const [movAnularId, setMovAnularId] = useState<string | null>(null);
  const [motivoAnular, setMotivoAnular] = useState('');
  const [codigoSupervisorAnular, setCodigoSupervisorAnular] = useState('');
  const pideCodigo = usePideCodigo();
  const [anulando, setAnulando] = useState(false);
  const [confirmarAnularAbierto, setConfirmarAnularAbierto] = useState(false);

  // Pedidos internos y entrega
  const [pedidosInternos, setPedidosInternos] = useState<any[]>([]);
  const [pedidoEntregarId, setPedidoEntregarId] = useState<string | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [confirmarEntregarAbierto, setConfirmarEntregarAbierto] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resMovs, resInsumos, resPeds] = await Promise.all([
        almacenApi.listarMovimientos().catch(() => ({ conteos: { todos: 0, entradas: 0, salidas: 0, mermas: 0, devoluciones: 0 }, movimientos: [] })),
        almacenApi.listarInsumos().catch(() => []),
        almacenApi.listarPedidosInternos().catch(() => []),
      ]);

      setMovimientos(resMovs.movimientos);
      setInsumos(resInsumos);
      setPedidosInternos(Array.isArray(resPeds) ? resPeds : []);
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

  const solicitarAnular = (id?: string) => {
    if (id) setMovAnularId(id);
    if (!motivoAnular.trim()) {
      setMensajeError('Debe especificar el motivo de anulación.');
      return;
    }
    if (pideCodigo && !/^\d{6}$/.test(codigoSupervisorAnular.trim())) {
      setMensajeError('El código del supervisor debe ser de 6 dígitos numéricos.');
      return;
    }
    setConfirmarAnularAbierto(true);
  };

  const ejecutarAnularMovimiento = async () => {
    if (!movAnularId || !motivoAnular.trim()) return;
    try {
      setAnulando(true);
      setMensajeError('');
      await almacenApi.anularMovimiento(
        movAnularId,
        motivoAnular.trim(),
        codigoSupervisorAnular.trim(),
      );
      setConfirmarAnularAbierto(false);
      setMovAnularId(null);
      setMotivoAnular('');
      setCodigoSupervisorAnular('');
      setMensajeExito('Movimiento anulado e invertido en stock.');
      cargarDatos();
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      setMensajeError(err.message || 'Error al anular movimiento');
    } finally {
      setAnulando(false);
    }
  };

  const solicitarEntregar = (id: string) => {
    setPedidoEntregarId(id);
    setConfirmarEntregarAbierto(true);
  };

  const ejecutarEntregar = async () => {
    if (!pedidoEntregarId) return;
    try {
      setEntregando(true);
      await almacenApi.entregarPedidoInterno(pedidoEntregarId);
      setConfirmarEntregarAbierto(false);
      setPedidoEntregarId(null);
      setMensajeExito('Pedido interno entregado: insumos trasladados a Cocina.');
      cargarDatos();
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      setMensajeError(err.message || 'Error al entregar pedido interno');
      setTimeout(() => setMensajeError(''), 5000);
    } finally {
      setEntregando(false);
    }
  };

  const pedidosPendientes = useMemo(() => {
    return pedidosInternos.filter((p) => p.estado === 'PENDIENTE');
  }, [pedidosInternos]);

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
          Gestiona existencias, traslados a cocina, mermas, devoluciones, ajustes por conteo y el cierre del día. Los ingresos se registran en Compras.
        </div>

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
            Hoy preparé...
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

      {mensajeError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgb(253, 236, 232)',
            color: 'var(--cp-rust)',
            fontWeight: 700,
            fontSize: 13,
            border: '1px solid var(--cp-rust)',
          }}
        >
          {mensajeError}
        </div>
      )}

      {/* Pedidos internos pendientes solicitados por Cocina */}
      {pedidosPendientes.length > 0 && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '2px solid var(--cp-orange)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)' }}>
              Pedidos internos de Cocina ({pedidosPendientes.length})
            </div>
            <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              Al pulsar «Ya se lo pasé», se descontará del almacén y pasará a traslado por recibir en cocina.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pedidosPendientes.map((p) => {
              const itemsList = Array.isArray(p.detalle?.items)
                ? p.detalle.items
                : Array.isArray(p.detalle)
                ? p.detalle
                : [];
              const itemsStr = itemsList.map((it: any) => `${it.cantidad} ${it.unidad || ''} ${it.insumo || ''}`).join(', ');

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--cp-sand, #F7F3EB)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: '1 1 240px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)' }}>
                      Pedido #{p.id} · {p.area || 'Cocina'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cp-navy)', marginTop: 2 }}>
                      {itemsStr || 'Insumos solicitados'}
                    </div>
                    {p.detalle?.nota && (
                      <div style={{ fontSize: 12, color: 'var(--cp-soft)', fontStyle: 'italic', marginTop: 2 }}>
                        Nota: «{p.detalle.nota}»
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => solicitarEntregar(p.id)}
                    style={{
                      minHeight: 44,
                      padding: '0 18px',
                      borderRadius: 10,
                      border: 0,
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Ya se lo pasé
                  </button>
                </div>
              );
            })}
          </div>
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
                    {pideCodigo && (
                      <CampoCodigoSupervisor
                        id="anular-movimiento-codigo"
                        valor={codigoSupervisorAnular}
                        onChange={setCodigoSupervisorAnular}
                      />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setMovAnularId(null);
                          setMotivoAnular('');
                          setCodigoSupervisorAnular('');
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
                        onClick={() => solicitarAnular(m.id)}
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

      <Confirmar
        abierto={confirmarAnularAbierto}
        titulo="¿Confirmar anulación del movimiento?"
        mensaje={`Se revertirá el movimiento en el inventario y se registrará en el historial.`}
        textoConfirmar="Sí, anular movimiento"
        alConfirmar={ejecutarAnularMovimiento}
        alCancelar={() => setConfirmarAnularAbierto(false)}
      />

      <Confirmar
        abierto={confirmarEntregarAbierto}
        titulo="¿Confirmar entrega de insumos?"
        mensaje="Al confirmar, se descontarán los insumos del stock de almacén central y quedarán registrados como traslado para que Cocina confirme su recepción."
        textoConfirmar="Sí, ya se lo pasé"
        textoNo="No, cancelar"
        cargando={entregando}
        alConfirmar={ejecutarEntregar}
        alCancelar={() => setConfirmarEntregarAbierto(false)}
      />
    </div>
  );
};
