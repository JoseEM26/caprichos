import { useEffect, useState, useMemo } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { api } from '../../comun/api';
import type {
  InsumoExistenciaCocina,
  PedidoInternoItem,
  TrasladoItem,
} from './cocinaTipos';
import {
  confirmarRecepcionTraslado,
  listarPedidosInternos,
  listarTraslados,
  obtenerExistenciasParaPedir,
  pedirInsumosAlmacen,
} from './cocinaApi';

export interface ModalPedirAlmacenProps {
  abierto: boolean;
  alCerrar: () => void;
  alEnviar?: (datos: {
    items: { insumo: string; cantidad: number; unidad: string; insumoId?: string | number }[];
    nota: string;
  }) => Promise<void> | void;
}

export function ModalPedirAlmacen({
  abierto,
  alCerrar,
  alEnviar,
}: ModalPedirAlmacenProps) {
  // Pestaña activa: 'pedir' o 'seguimiento'
  const [tab, setTab] = useState<'pedir' | 'seguimiento'>('pedir');

  // Existencias de insumos (Cocina y Almacén)
  const [insumos, setInsumos] = useState<InsumoExistenciaCocina[]>([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');

  // Cantidades elegidas por insumoId
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [nota, setNota] = useState('');

  // Seguimiento de pedidos y traslados
  const [pedidosInternos, setPedidosInternos] = useState<PedidoInternoItem[]>([]);
  const [traslados, setTraslados] = useState<TrasladoItem[]>([]);
  const [cargandoSeguimiento, setCargandoSeguimiento] = useState(false);

  // Recepción de traslado
  const [trasladoParaRecibir, setTrasladoParaRecibir] = useState<TrasladoItem | null>(null);
  const [cantidadRecibidaReal, setCantidadRecibidaReal] = useState<string>('');
  const [confirmandoRecepcion, setConfirmandoRecepcion] = useState(false);
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false);

  // Confirmación de envío de pedido
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const cargarExistencias = async () => {
    try {
      setCargandoInsumos(true);
      setMensajeError('');
      const data = await obtenerExistenciasParaPedir().catch(async () => {
        // Fallback a /admin/stock/insumos si el nuevo endpoint no respondiese
        const fallback = await api.get<any[]>('/admin/stock/insumos').catch(() => []);
        return (fallback || []).map((f: any) => ({
          insumoId: String(f.id),
          nombre: f.nombre,
          unidad: f.unidad_almacen || f.unidad || 'unid',
          stockCocina: Number(f.stockCocina ?? f.stockActual ?? 0),
          stockMinimo: Number(f.minimo ?? f.stockMinimo ?? 0),
          stockAlmacen: Number(f.stockAlmacen ?? f.stock_total ?? 0),
        }));
      });
      setInsumos(data || []);
    } catch {
      setMensajeError('No se pudieron cargar las existencias de cocina y almacén.');
    } finally {
      setCargandoInsumos(false);
    }
  };

  const cargarSeguimiento = async () => {
    try {
      setCargandoSeguimiento(true);
      const [peds, tras] = await Promise.all([
        listarPedidosInternos().catch(() => []),
        listarTraslados().catch(() => []),
      ]);
      setPedidosInternos(peds || []);
      setTraslados(tras || []);
    } catch {
      // Silencioso en recarga secundaria
    } finally {
      setCargandoSeguimiento(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      setTab('pedir');
      setCantidades({});
      setNota('');
      setMensajeError('');
      setMensajeExito('');
      setFiltroTexto('');
      cargarExistencias();
      cargarSeguimiento();
    }
  }, [abierto]);

  // Ordenar primero lo que más falta (menor ratio stockCocina / stockMinimo)
  const insumosOrdenados = useMemo(() => {
    const copia = [...insumos];
    copia.sort((a, b) => {
      const minA = a.stockMinimo > 0 ? a.stockMinimo : 1;
      const minB = b.stockMinimo > 0 ? b.stockMinimo : 1;
      const ratioA = a.stockCocina / minA;
      const ratioB = b.stockCocina / minB;
      if (ratioA !== ratioB) {
        return ratioA - ratioB;
      }
      return a.nombre.localeCompare(b.nombre);
    });

    if (!filtroTexto.trim()) return copia;
    const q = filtroTexto.toLowerCase();
    return copia.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [insumos, filtroTexto]);

  // Modificar cantidad con botones - y +
  const cambiarCantidad = (insumoId: string, delta: number) => {
    setCantidades((prev) => {
      const actual = prev[insumoId] || 0;
      const nuevo = Math.max(0, actual + delta);
      if (nuevo === 0) {
        const resto = { ...prev };
        delete resto[insumoId];
        return resto;
      }
      return { ...prev, [insumoId]: nuevo };
    });
    setMensajeError('');
  };

  const fijarCantidadDirecta = (insumoId: string, val: string) => {
    const clean = val.replace(/[^0-9.,]/g, '').replace(/([.,])(?=.*[.,])/g, '');
    const num = parseFloat(clean.replace(',', '.'));
    setCantidades((prev) => {
      if (isNaN(num) || num <= 0) {
        const resto = { ...prev };
        delete resto[insumoId];
        return resto;
      }
      return { ...prev, [insumoId]: num };
    });
    setMensajeError('');
  };

  // Cantidad total de insumos seleccionados
  const itemsSeleccionados = useMemo(() => {
    const seleccion: Array<{
      insumoId: string;
      insumo: string;
      cantidad: number;
      unidad: string;
    }> = [];
    Object.entries(cantidades).forEach(([id, q]) => {
      if (q > 0) {
        const ins = insumos.find((x) => x.insumoId === id);
        if (ins) {
          seleccion.push({
            insumoId: id,
            insumo: ins.nombre,
            cantidad: q,
            unidad: ins.unidad,
          });
        }
      }
    });
    return seleccion;
  }, [cantidades, insumos]);

  // Validar y confirmar pedido
  const handleValidarEnvio = () => {
    setMensajeError('');
    if (itemsSeleccionados.length === 0) {
      setMensajeError('Elige al menos un insumo con cantidad mayor a cero.');
      return;
    }
    setConfirmandoEnvio(true);
  };

  const ejecutarEnvio = async () => {
    try {
      setEnviando(true);
      setMensajeError('');

      if (alEnviar) {
        await alEnviar({
          items: itemsSeleccionados,
          nota: nota.trim(),
        });
      } else {
        await pedirInsumosAlmacen({
          items: itemsSeleccionados,
          nota: nota.trim(),
          area: 'Salados',
        });
      }

      setConfirmandoEnvio(false);
      setCantidades({});
      setNota('');
      setMensajeExito('Pedido enviado con éxito al almacén.');
      await cargarSeguimiento();
      setTab('seguimiento');
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      setMensajeError(err?.message || 'Error al enviar pedido al almacén.');
      setConfirmandoEnvio(false);
    } finally {
      setEnviando(false);
    }
  };

  // Abrir confirmación de recepción de traslado
  const abrirRecepcion = (tras: TrasladoItem) => {
    setTrasladoParaRecibir(tras);
    setCantidadRecibidaReal(String(tras.enviado));
  };

  const handleValidarRecepcion = () => {
    if (!trasladoParaRecibir) return;
    const q = parseFloat(cantidadRecibidaReal.replace(',', '.'));
    if (isNaN(q) || q < 0) {
      setMensajeError('Escribe una cantidad recibida válida (mayor o igual a cero).');
      return;
    }
    setConfirmandoRecepcion(true);
  };

  const ejecutarConfirmarRecepcion = async () => {
    if (!trasladoParaRecibir) return;
    try {
      setGuardandoRecepcion(true);
      setMensajeError('');
      const q = parseFloat(cantidadRecibidaReal.replace(',', '.'));
      await confirmarRecepcionTraslado(trasladoParaRecibir.id, q);
      setConfirmandoRecepcion(false);
      setTrasladoParaRecibir(null);
      setMensajeExito('Recepción confirmada. El stock de cocina fue actualizado.');
      await Promise.all([cargarExistencias(), cargarSeguimiento()]);
      setTimeout(() => setMensajeExito(''), 4000);
    } catch (err: any) {
      setMensajeError(err?.message || 'Error al confirmar la recepción.');
      setConfirmandoRecepcion(false);
    } finally {
      setGuardandoRecepcion(false);
    }
  };

  // Unir pedidos internos y traslados para el seguimiento en 3 estados
  const listaSeguimiento = useMemo(() => {
    const items: Array<{
      id: string;
      tipo: 'pedido' | 'traslado';
      titulo: string;
      itemsTexto: string;
      estadoEtiqueta: 'Enviado al almacén' | 'Almacén ya lo entregó' | 'Recibido';
      estadoColor: string;
      estadoBg: string;
      enviadoEn: string;
      trasladoRef?: TrasladoItem;
    }> = [];

    // Traslados asociados a Cocina
    traslados.forEach((t) => {
      const esCocina = !t.destino || t.destino.toLowerCase().includes('cocina');
      if (!esCocina) return;

      if (t.estado === 'POR_RECIBIR') {
        items.push({
          id: `t-${t.id}`,
          tipo: 'traslado',
          titulo: `${t.insumoNombre} · Enviado: ${t.enviado}`,
          itemsTexto: `${t.enviado} de ${t.insumoNombre}`,
          estadoEtiqueta: 'Almacén ya lo entregó',
          estadoColor: 'var(--cp-navy)',
          estadoBg: '#FEF3C7', // Ámbar suave
          enviadoEn: t.enviadoEn,
          trasladoRef: t,
        });
      } else if (t.estado === 'RECIBIDO') {
        const difTexto =
          t.diferencia && t.diferencia > 0
            ? ` (diferencia: ${t.diferencia} faltante)`
            : '';
        items.push({
          id: `t-${t.id}`,
          tipo: 'traslado',
          titulo: `${t.insumoNombre} · Recibido: ${t.recibido ?? t.enviado}`,
          itemsTexto: `${t.recibido ?? t.enviado} de ${t.insumoNombre}${difTexto}`,
          estadoEtiqueta: 'Recibido',
          estadoColor: '#166534',
          estadoBg: '#DCFCE7', // Verde suave
          enviadoEn: t.enviadoEn,
        });
      }
    });

    // Pedidos internos pendientes (aún no entregados por almacén)
    pedidosInternos.forEach((p) => {
      if (p.estado === 'PENDIENTE') {
        const itemsResumen = (p.detalle?.items || [])
          .map((i) => `${i.cantidad} ${i.unidad || ''} ${i.insumo}`)
          .join(', ');
        items.push({
          id: `p-${p.id}`,
          tipo: 'pedido',
          titulo: `Pedido interno #${p.id}`,
          itemsTexto: itemsResumen || 'Insumos varios',
          estadoEtiqueta: 'Enviado al almacén',
          estadoColor: '#B45309',
          estadoBg: '#FEF3C7',
          enviadoEn: p.en,
        });
      }
    });

    return items;
  }, [pedidosInternos, traslados]);

  const conteoPorRecibir = useMemo(() => {
    return traslados.filter(
      (t) =>
        t.estado === 'POR_RECIBIR' &&
        (!t.destino || t.destino.toLowerCase().includes('cocina')),
    ).length;
  }, [traslados]);

  if (!abierto) return null;

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11, 44, 62, 0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pedir al almacén"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(940px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FFFDF8)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--cp-navy, #0B2C3D)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                lineHeight: '27px',
              }}
            >
              Pedir al almacén
            </div>
            {/* Aclaración obligatoria solicitada por el usuario */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-orange, #E67929)',
                marginTop: '4px',
                lineHeight: '18px',
              }}
            >
              Cocina pide, Almacén entrega, Cocina confirma que recibió.
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              flex: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Notificaciones */}
        {mensajeError && (
          <div
            role="alert"
            style={{
              background: '#FEE2E2',
              border: '1.5px solid #EF4444',
              color: '#991B1B',
              borderRadius: '10px',
              padding: '12px 14px',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {mensajeError}
          </div>
        )}

        {mensajeExito && (
          <div
            role="status"
            style={{
              background: '#DCFCE7',
              border: '1.5px solid #22C55E',
              color: '#166534',
              borderRadius: '10px',
              padding: '12px 14px',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            ✓ {mensajeExito}
          </div>
        )}

        {/* Pestañas: Pedir insumos / Seguimiento */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--cp-line)' }}>
          <button
            type="button"
            onClick={() => setTab('pedir')}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              border: 0,
              borderBottom: tab === 'pedir' ? '3px solid var(--cp-orange)' : '3px solid transparent',
              background: 'transparent',
              color: tab === 'pedir' ? 'var(--cp-navy)' : 'var(--cp-soft)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Pedir insumos {itemsSeleccionados.length > 0 ? `(${itemsSeleccionados.length})` : ''}
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('seguimiento');
              cargarSeguimiento();
            }}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              border: 0,
              borderBottom: tab === 'seguimiento' ? '3px solid var(--cp-orange)' : '3px solid transparent',
              background: 'transparent',
              color: tab === 'seguimiento' ? 'var(--cp-navy)' : 'var(--cp-soft)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Seguimiento de pedidos</span>
            {conteoPorRecibir > 0 && (
              <span
                style={{
                  background: 'var(--cp-rust)',
                  color: 'var(--cp-white)',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}
              >
                {conteoPorRecibir} por recibir
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: PEDIR INSUMOS */}
        {tab === 'pedir' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Buscador de insumos */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Filtrar insumo..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                style={{
                  flex: 1,
                  minHeight: '42px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  color: 'var(--cp-navy)',
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
                {insumosOrdenados.length} insumos
              </span>
            </div>

            {cargandoInsumos ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
                Cargando existencias de cocina y almacén...
              </div>
            ) : insumosOrdenados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
                No se encontraron insumos.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {insumosOrdenados.map((ins) => {
                  const tieneStockAlmacen = ins.stockAlmacen > 0;
                  const esBajo = ins.stockCocina < ins.stockMinimo;
                  const esCerca = !esBajo && ins.stockCocina < ins.stockMinimo * 1.5;
                  const tieneDeSobra = ins.stockMinimo > 0 && ins.stockCocina >= ins.stockMinimo * 2;

                  // Barra de porcentaje (base 100% en 1.5 * minimo)
                  const barraMax = Math.max(ins.stockMinimo * 1.5, ins.stockCocina, 1);
                  const pct = Math.min(100, Math.round((ins.stockCocina / barraMax) * 100));

                  // Color de la barra
                  const colorBarra = esBajo ? '#EF4444' : esCerca ? '#F59E0B' : '#22C55E';
                  const cantActual = cantidades[ins.insumoId] || 0;

                  return (
                    <div
                      key={ins.insumoId}
                      style={{
                        background: 'var(--cp-white)',
                        border: `1.5px solid ${cantActual > 0 ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                        borderRadius: '14px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        opacity: tieneStockAlmacen ? 1 : 0.55,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      {/* Línea superior: Nombre + Avisos + Control de cantidad */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: '1 1 200px' }}>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                            {ins.nombre}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                            Almacén tiene {ins.stockAlmacen} {ins.unidad}
                          </div>
                        </div>

                        {/* Avisos */}
                        {!tieneStockAlmacen && (
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: 'var(--cp-rust)',
                              background: '#FEE2E2',
                              padding: '4px 10px',
                              borderRadius: '6px',
                            }}
                          >
                            Sin stock en almacén · Pídelo a Compras
                          </div>
                        )}

                        {tieneStockAlmacen && tieneDeSobra && (
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#166534',
                              background: '#DCFCE7',
                              padding: '4px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Aún tienes suficiente
                          </div>
                        )}

                        {/* Selector de cantidad con botones - y + */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={!tieneStockAlmacen || cantActual <= 0}
                            onClick={() => cambiarCantidad(ins.insumoId, -1)}
                            aria-label={`Reducir ${ins.nombre}`}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-line)',
                              background: 'var(--cp-sand)',
                              color: 'var(--cp-navy)',
                              fontWeight: 800,
                              fontSize: '18px',
                              cursor: tieneStockAlmacen && cantActual > 0 ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            -
                          </button>

                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!tieneStockAlmacen}
                            value={cantActual > 0 ? cantActual : ''}
                            onChange={(e) => fijarCantidadDirecta(ins.insumoId, e.target.value)}
                            placeholder="0"
                            aria-label={`Cantidad a pedir de ${ins.nombre}`}
                            style={{
                              width: '60px',
                              height: '38px',
                              textAlign: 'center',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-line)',
                              background: tieneStockAlmacen ? 'var(--cp-white)' : 'var(--cp-sand)',
                              fontWeight: 800,
                              fontSize: '14px',
                              color: 'var(--cp-navy)',
                            }}
                          />

                          <button
                            type="button"
                            disabled={!tieneStockAlmacen}
                            onClick={() => cambiarCantidad(ins.insumoId, 1)}
                            aria-label={`Aumentar ${ins.nombre}`}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-line)',
                              background: 'var(--cp-sand)',
                              color: 'var(--cp-navy)',
                              fontWeight: 800,
                              fontSize: '18px',
                              cursor: tieneStockAlmacen ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Barra de porcentaje de stock en Cocina */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: esBajo ? 'var(--cp-rust)' : 'var(--cp-navy)',
                          }}
                        >
                          <span>
                            Cocina: {ins.stockCocina} {ins.unidad}
                            {esBajo ? ' (Bajo el mínimo)' : esCerca ? ' (Cerca del mínimo)' : ' (Buen nivel)'}
                          </span>
                          <span style={{ color: 'var(--cp-soft)' }}>
                            Mínimo: {ins.stockMinimo} {ins.unidad}
                          </span>
                        </div>

                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: 'var(--cp-sand, #F7F3EB)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: colorBarra,
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nota opcional y Confirmación */}
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <label
                htmlFor="nota-pedido-almacen"
                style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}
              >
                Nota para el almacén (opcional)
              </label>
              <input
                id="nota-pedido-almacen"
                type="text"
                placeholder="Ej. Urgente para turno tarde, insumos para masa..."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                style={{
                  minHeight: '40px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-cream)',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  color: 'var(--cp-navy)',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '4px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Total a pedir: {itemsSeleccionados.length} {itemsSeleccionados.length === 1 ? 'insumo' : 'insumos'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={alCerrar}
                    style={{
                      minHeight: '44px',
                      padding: '0 16px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'transparent',
                      color: 'var(--cp-soft)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    disabled={itemsSeleccionados.length === 0}
                    onClick={handleValidarEnvio}
                    style={{
                      minHeight: '44px',
                      padding: '0 20px',
                      borderRadius: '10px',
                      border: 0,
                      background: itemsSeleccionados.length > 0 ? 'var(--cp-orange)' : 'var(--cp-line)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: itemsSeleccionados.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Enviar pedido a almacén
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEGUIMIENTO DE PEDIDOS (3 ESTADOS) */}
        {tab === 'seguimiento' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Explicación de los 3 estados */}
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <span style={{ color: 'var(--cp-soft)' }}>Flujo de 3 pasos:</span>
              <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309' }}>
                1. Enviado al almacén
              </span>
              <span>→</span>
              <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: 'var(--cp-navy)' }}>
                2. Almacén ya lo entregó
              </span>
              <span>→</span>
              <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#DCFCE7', color: '#166534' }}>
                3. Recibido
              </span>
            </div>

            {cargandoSeguimiento ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
                Cargando estado de pedidos...
              </div>
            ) : listaSeguimiento.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: 'var(--cp-soft)',
                  background: 'var(--cp-white)',
                  borderRadius: '14px',
                  border: '1px solid var(--cp-line)',
                  fontSize: '13px',
                }}
              >
                No hay pedidos recientes ni traslados por recibir.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {listaSeguimiento.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 240px' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                        {item.titulo}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                        {item.itemsTexto}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          background: item.estadoBg,
                          color: item.estadoColor,
                        }}
                      >
                        {item.estadoEtiqueta}
                      </span>

                      {/* Botón para confirmar recepción si almacén ya lo entregó */}
                      {item.estadoEtiqueta === 'Almacén ya lo entregó' && item.trasladoRef && (
                        <button
                          type="button"
                          onClick={() => abrirRecepcion(item.trasladoRef!)}
                          style={{
                            minHeight: '40px',
                            padding: '0 14px',
                            borderRadius: '10px',
                            border: 0,
                            background: '#22C55E',
                            color: 'var(--cp-white)',
                            fontWeight: 800,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Confirmar recibido
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para ingresar cantidad real recibida (recepción parcial permitida) */}
      {trasladoParaRecibir && (
        <>
          <div
            onClick={() => setTrasladoParaRecibir(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              background: 'rgba(11, 44, 62, 0.65)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar recepción de insumo"
            style={{
              position: 'fixed',
              zIndex: 90,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(480px, calc(100% - 24px))',
              background: 'var(--cp-white)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              color: 'var(--cp-navy)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '18px' }}>
              Confirmar lo que recibiste
            </div>

            <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
              Insumo: <b>{trasladoParaRecibir.insumoNombre}</b>
              <br />
              Almacén envió: <b>{trasladoParaRecibir.enviado}</b>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="cantidad-recibida-input"
                style={{ fontSize: '13px', fontWeight: 700 }}
              >
                Cantidad que realmente llegó a Cocina
              </label>
              <input
                id="cantidad-recibida-input"
                type="text"
                inputMode="decimal"
                value={cantidadRecibidaReal}
                onChange={(e) => setCantidadRecibidaReal(e.target.value)}
                style={{
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            {/* Cálculo de diferencia en recepción parcial */}
            {(() => {
              const enviadoNum = Number(trasladoParaRecibir.enviado);
              const recibidoNum = parseFloat(cantidadRecibidaReal.replace(',', '.')) || 0;
              const dif = enviadoNum - recibidoNum;
              if (dif > 0) {
                return (
                  <div
                    style={{
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      color: '#92400E',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Diferencia: {dif.toFixed(2)} faltante(s). Se registrará como recepción parcial.
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setTrasladoParaRecibir(null)}
                style={{
                  minHeight: '42px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleValidarRecepcion}
                style={{
                  minHeight: '42px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 0,
                  background: '#22C55E',
                  color: 'var(--cp-white)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Recibido
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmar Envío de Pedido */}
      <Confirmar
        abierto={confirmandoEnvio}
        titulo="¿Confirmar pedido al almacén?"
        mensaje={`Se solicitarán ${itemsSeleccionados.length} insumo(s) al almacén central.`}
        textoConfirmar="Sí, enviar pedido"
        textoNo="No, cancelar"
        cargando={enviando}
        alConfirmar={ejecutarEnvio}
        alCancelar={() => setConfirmandoEnvio(false)}
      />

      {/* Confirmar Recepción de Traslado */}
      <Confirmar
        abierto={confirmandoRecepcion}
        titulo="¿Confirmar recepción de insumos?"
        mensaje={`Se registrará la llegada de ${cantidadRecibidaReal} de ${trasladoParaRecibir?.insumoNombre || ''} en Cocina.`}
        textoConfirmar="Sí, confirmar recibido"
        textoNo="No, cancelar"
        cargando={guardandoRecepcion}
        alConfirmar={ejecutarConfirmarRecepcion}
        alCancelar={() => setConfirmandoRecepcion(false)}
      />
    </>
  );
}
