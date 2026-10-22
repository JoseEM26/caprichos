import React, { useState, useEffect, useMemo } from 'react';
import {
  comprasApi,
  ComprasResumen,
  ProveedorItem,
  InsumoParaPedir,
  CompraItem,
} from './comprasApi';
import { ModalRegistrarCompra } from './ModalRegistrarCompra';
import { ModalProveedor } from './ModalProveedor';
import { ModalHistorialProveedor } from './ModalHistorialProveedor';
import { ModalDetalleCompra } from './ModalDetalleCompra';

export const ComprasView: React.FC = () => {
  // Pestaña activa: 'pedir' | 'compras' | 'proveedores'
  const [tabActiva, setTabActiva] = useState<'pedir' | 'compras' | 'proveedores'>('compras');

  // Datos
  const [resumen, setResumen] = useState<ComprasResumen | null>(null);
  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [compras, setCompras] = useState<CompraItem[]>([]);
  const [insumosPedir, setInsumosPedir] = useState<InsumoParaPedir[]>([]);
  const [incluirRegulares, setIncluirRegulares] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState('');

  // Filtro compras por proveedor
  const [filtroProveedor, setFiltroProveedor] = useState('');

  // Modales
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [modalProveedorAbierto, setModalProveedorAbierto] = useState(false);
  const [proveedorAEditar, setProveedorAEditar] = useState<ProveedorItem | null>(null);
  const [proveedorHistorial, setProveedorHistorial] = useState<ProveedorItem | null>(null);
  const [compraDetalle, setCompraDetalle] = useState<CompraItem | null>(null);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resResumen, resProvs, resCompras, resInsumos] = await Promise.all([
        comprasApi.obtenerResumen().catch(() => null),
        comprasApi.listarProveedores().catch(() => []),
        comprasApi.listarCompras().catch(() => []),
        comprasApi.listarInsumosParaPedir(incluirRegulares).catch(() => []),
      ]);

      if (resResumen) setResumen(resResumen);
      setProveedores(resProvs);
      setCompras(resCompras);
      setInsumosPedir(resInsumos);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [incluirRegulares]);

  // Lista para pedir agrupada por proveedor
  const gruposParaPedir = useMemo(() => {
    const grupos: Record<string, { proveedor: ProveedorItem | null; insumos: InsumoParaPedir[] }> = {};

    insumosPedir.forEach((ins) => {
      const provId = ins.proveedorId || 'sin-proveedor';
      if (!grupos[provId]) {
        const prov = proveedores.find((p) => p.id === provId) || null;
        grupos[provId] = { proveedor: prov, insumos: [] };
      }
      grupos[provId].insumos.push(ins);
    });

    return Object.values(grupos);
  }, [insumosPedir, proveedores]);

  // Compras filtradas
  const comprasFiltradas = useMemo(() => {
    if (!filtroProveedor) return compras;
    return compras.filter(
      (c) =>
        c.proveedorId === filtroProveedor ||
        (Boolean(c.proveedorNombre) && c.proveedorNombre.toLowerCase() === filtroProveedor.toLowerCase()),
    );
  }, [compras, filtroProveedor]);

  // Total sin anuladas
  const totalSinAnuladas = useMemo(() => {
    return comprasFiltradas
      .filter((c) => c.estado !== 'Anulada' && c.estado?.toUpperCase() !== 'ANULADA' && !c.anuladaEn)
      .reduce((acc, c) => acc + c.montoTotal, 0);
  }, [comprasFiltradas]);

  // Enlace y mensaje WhatsApp para pedir
  const armarWhatsappUrl = (prov: ProveedorItem | null, items: InsumoParaPedir[]) => {
    const tel = prov?.telefono ? prov.telefono.replace(/\D/g, '') : '';
    const numFinal = tel.startsWith('51') ? tel : `51${tel}`;
    const lineas = items.map(
      (it) => `• ${it.nombre}: ${it.cantidadSugerida} ${it.unidadCompra || it.unidadAlmacen}`,
    );
    const mensaje = `Hola ${prov?.nombreComercial || prov?.razonSocial || 'estimado proveedor'}, le escribimos de Caprichos para realizar el siguiente pedido:\n\n${lineas.join('\n')}\n\nQuedamos atentos a la confirmación y fecha de entrega. ¡Muchas gracias!`;
    return `https://wa.me/${numFinal}?text=${encodeURIComponent(mensaje)}`;
  };

  const handleCrearPedidoProveedor = async (provId: string, items: InsumoParaPedir[]) => {
    try {
      await comprasApi.crearPedidoProveedor({
        proveedorPartyId: provId,
        lineas: items.map((i) => ({
          insumoId: i.id,
          cantidadCompra: i.cantidadSugerida,
        })),
      });
      setMensajeExito('Pedido registrado como pendiente.');
      cargarDatos();
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Error al crear pedido a proveedor');
    }
  };

  const handleToggleEstadoProveedor = async (p: ProveedorItem) => {
    try {
      await comprasApi.cambiarEstadoProveedor(p.id, !p.activo);
      cargarDatos();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  // Proveedores que tienen al menos una compra registrada para los chips de filtro
  const proveedoresConCompras = useMemo(() => {
    const nombres = new Set(compras.map((c) => c.proveedorNombre).filter(Boolean));
    return Array.from(nombres);
  }, [compras]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mensaje explicativo */}
      <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
        El camino de una compra: <b>1.</b> pedir a los proveedores lo que falta, <b>2.</b> cuando
        llega, tocar «Recibir» y registrar costos (el stock sube y queda la entrada en Almacén),{' '}
        <b>3.</b> marcar como pagada si fue a crédito.
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
          Cargando datos de compras...
        </div>
      )}

      {/* 4 KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Pedidos por recibir</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            {resumen?.pedidosPorRecibir ?? 0}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Por pagar a proveedores</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            s/ {(resumen?.porPagar ?? 0).toFixed(2)}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Comprado este mes</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            s/ {(resumen?.compradoMes ?? 0).toFixed(2)}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Lista para pedir</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
            {resumen?.listaPedir ?? insumosPedir.length}{' '}
            {(resumen?.listaPedir ?? insumosPedir.length) === 1 ? 'insumo' : 'insumos'}
          </div>
        </div>
      </div>

      {/* Fila de pestañas y botón Registrar compra */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTabActiva('pedir')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: 12,
              background: tabActiva === 'pedir' ? 'var(--cp-navy)' : 'transparent',
              color: tabActiva === 'pedir' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Pedir a proveedores {insumosPedir.length > 0 ? `(${insumosPedir.length})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('compras')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: 12,
              background: tabActiva === 'compras' ? 'var(--cp-navy)' : 'transparent',
              color: tabActiva === 'compras' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Compras
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('proveedores')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: 12,
              background: tabActiva === 'proveedores' ? 'var(--cp-navy)' : 'transparent',
              color: tabActiva === 'proveedores' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Proveedores
          </button>
        </div>

        <button
          type="button"
          onClick={() => setModalCompraAbierto(true)}
          style={{
            minHeight: 44,
            padding: '0 16px',
            border: 0,
            borderRadius: 9999,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + Registrar compra
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: PEDIR A PROVEEDORES */}
      {tabActiva === 'pedir' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Chips de filtro bajo / regular */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Mostrar:</span>
            <button
              type="button"
              onClick={() => setIncluirRegulares(false)}
              style={{
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                background: !incluirRegulares ? 'var(--cp-navy)' : 'transparent',
                color: !incluirRegulares ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Solo lo que está bajo el mínimo
            </button>
            <button
              type="button"
              onClick={() => setIncluirRegulares(true)}
              style={{
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                background: incluirRegulares ? 'var(--cp-navy)' : 'transparent',
                color: incluirRegulares ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              También lo que está regular
            </button>
          </div>

          {gruposParaPedir.length === 0 ? (
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
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Todos los insumos tienen stock suficiente
              </div>
              <div style={{ fontSize: 13 }}>
                No hay insumos por debajo del mínimo en este momento.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {gruposParaPedir.map((g, idx) => {
                const prov = g.proveedor;
                const tieneTel = !!prov?.telefono;
                const waUrl = armarWhatsappUrl(prov, g.insumos);

                return (
                  <div
                    key={prov ? prov.id : `prov-${idx}`}
                    style={{
                      background: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: 14,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
                          {prov ? prov.nombreComercial || prov.razonSocial : 'Insumos sin proveedor asignado'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                          {tieneTel ? `WhatsApp: ${prov?.telefono}` : '⚠ Sin teléfono registrado'}
                          {prov?.diasCredito ? ` · Crédito ${prov.diasCredito} días` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {tieneTel && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              minHeight: 40,
                              padding: '0 14px',
                              borderRadius: 9999,
                              background: '#25D366',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: 13,
                              textDecoration: 'none',
                            }}
                          >
                            Pedir por WhatsApp ↗
                          </a>
                        )}
                        {prov && (
                          <button
                            type="button"
                            onClick={() => handleCrearPedidoProveedor(prov.id, g.insumos)}
                            style={{
                              minHeight: 40,
                              padding: '0 14px',
                              borderRadius: 9999,
                              border: '1.5px solid var(--cp-navy)',
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Registrar pedido pendiente
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--cp-line)', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--cp-cream)', textAlign: 'left', borderBottom: '1px solid var(--cp-line)' }}>
                            <th style={{ padding: '8px 12px' }}>Insumo</th>
                            <th style={{ padding: '8px 12px' }}>Stock actual</th>
                            <th style={{ padding: '8px 12px' }}>Mínimo</th>
                            <th style={{ padding: '8px 12px' }}>A pedir sugerido</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Costo aprox.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.insumos.map((it) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--cp-line)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.nombre}</td>
                              <td style={{ padding: '8px 12px' }}>
                                {it.stockActual} {it.unidadAlmacen}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {it.stockMinimo} {it.unidadAlmacen}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                                {it.cantidadSugerida} {it.unidadCompra || it.unidadAlmacen}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                s/ {(it.cantidadSugerida * it.costoUnitario).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: COMPRAS */}
      {tabActiva === 'compras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Proveedor</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFiltroProveedor('')}
              style={{
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                background: !filtroProveedor ? 'var(--cp-navy)' : 'transparent',
                color: !filtroProveedor ? 'var(--cp-cream)' : 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Todos
            </button>
            {proveedoresConCompras.map((nombre) => {
              const activo = filtroProveedor.toLowerCase() === (nombre || '').toLowerCase();
              return (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setFiltroProveedor(nombre)}
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 12,
                    background: activo ? 'var(--cp-navy)' : 'transparent',
                    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    cursor: 'pointer',
                  }}
                >
                  {nombre}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
            {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'compra' : 'compras'} · total sin
            anuladas s/ {totalSinAnuladas.toFixed(2)}
          </div>

          {comprasFiltradas.length === 0 ? (
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
              No hay compras registradas con el filtro seleccionado.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 10,
              }}
            >
              {comprasFiltradas.map((c) => {
                const esAnulada =
                  c.estado === 'Anulada' ||
                  c.estado?.toUpperCase() === 'ANULADA' ||
                  Boolean(c.anuladaEn);
                const esPorRecibir =
                  !esAnulada &&
                  (c.esPedidoPorRecibir ||
                    c.estado === 'Por recibir' ||
                    c.estado?.toUpperCase() === 'PENDIENTE');
                const esPagada =
                  !esAnulada &&
                  !esPorRecibir &&
                  (c.estado === 'Pagada' || c.estadoPago === 'Pagada');

                const txtBadge = esAnulada
                  ? 'Anulada'
                  : esPorRecibir
                  ? 'Por recibir'
                  : esPagada
                  ? 'Pagada'
                  : 'Recibida';

                const bgBadge = esAnulada
                  ? 'var(--cp-line)'
                  : esPorRecibir
                  ? 'rgb(255, 241, 201)'
                  : esPagada
                  ? '#E0F2FE'
                  : 'var(--cp-greenbg)';

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompraDetalle(c)}
                    style={{
                      background: 'var(--cp-white)',
                      borderRadius: 14,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      color: 'var(--cp-navy)',
                      cursor: 'pointer',
                      border: '1px solid var(--cp-line)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <b>
                        {c.id} · {c.proveedorNombre}
                      </b>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 9999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: c.stBg || bgBadge,
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {txtBadge}
                      </span>
                    </div>

                    <div style={{ fontSize: 13 }}>
                      {c.fechaEmision} · {c.insumosResumen || 'Varios insumos'}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                      {c.comprobanteTipo} · {c.estadoPago} ·{' '}
                      <b>s/ {c.montoTotal.toFixed(2)}</b>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 3: PROVEEDORES */}
      {tabActiva === 'proveedores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Directorio de proveedores registrados para compras e insumos.
            </div>
            <button
              type="button"
              onClick={() => {
                setProveedorAEditar(null);
                setModalProveedorAbierto(true);
              }}
              style={{
                minHeight: 40,
                padding: '0 16px',
                borderRadius: 9999,
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Nuevo proveedor
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {proveedores.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  opacity: p.activo ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
                      {p.nombreComercial || p.razonSocial}
                    </div>
                    {p.nombreComercial && p.nombreComercial !== p.razonSocial && (
                      <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{p.razonSocial}</div>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: p.activo ? 'var(--cp-greenbg)' : 'var(--cp-line)',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <span style={{ color: 'var(--cp-soft)' }}>RUC:</span> {p.ruc || 'Sin RUC'}
                  </div>
                  <div>
                    <span style={{ color: 'var(--cp-soft)' }}>Tel / WhatsApp:</span>{' '}
                    {p.telefono || 'Sin teléfono'}
                  </div>
                  <div>
                    <span style={{ color: 'var(--cp-soft)' }}>Condición:</span>{' '}
                    {p.diasCredito > 0 ? `Crédito (${p.diasCredito} días)` : 'Contado'}
                  </div>
                  {p.cuentaPago && (
                    <div>
                      <span style={{ color: 'var(--cp-soft)' }}>Cuenta pago:</span> {p.cuentaPago}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    borderTop: '1px solid var(--cp-line)',
                    paddingTop: 10,
                    marginTop: 'auto',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setProveedorAEditar(p);
                      setModalProveedorAbierto(true);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 36,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setProveedorHistorial(p)}
                    style={{
                      flex: 1,
                      minHeight: 36,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Historial
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleEstadoProveedor(p)}
                    style={{
                      minHeight: 36,
                      padding: '0 8px',
                      border: '1px solid var(--cp-line)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--cp-soft)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modales */}
      <ModalRegistrarCompra
        abierto={modalCompraAbierto}
        alCerrar={() => setModalCompraAbierto(false)}
        alGuardar={() => {
          cargarDatos();
          setMensajeExito('Compra registrada exitosamente.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
        proveedores={proveedores.filter((p) => p.activo)}
        insumos={insumosPedir}
      />

      <ModalProveedor
        abierto={modalProveedorAbierto}
        alCerrar={() => {
          setModalProveedorAbierto(false);
          setProveedorAEditar(null);
        }}
        alGuardar={() => {
          cargarDatos();
          setMensajeExito('Proveedor guardado exitosamente.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
        proveedorEditar={proveedorAEditar}
      />

      <ModalHistorialProveedor
        abierto={!!proveedorHistorial}
        alCerrar={() => setProveedorHistorial(null)}
        proveedor={proveedorHistorial}
      />

      <ModalDetalleCompra
        abierto={!!compraDetalle}
        alCerrar={() => setCompraDetalle(null)}
        compra={compraDetalle}
        alActualizar={() => {
          cargarDatos();
          setMensajeExito('Compra actualizada exitosamente.');
          setTimeout(() => setMensajeExito(''), 4000);
        }}
      />
    </div>
  );
};
