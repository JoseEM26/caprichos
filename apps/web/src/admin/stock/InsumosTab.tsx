import { comoLista } from '../../comun/comoLista';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { InsumoItem, LugarStockItem } from './tipos';
import { stockApi } from './stockApi';
import { ModalInsumo } from './ModalInsumo';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { formatearUnidad, qty1 } from './formato';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

interface InsumosTabProps {
  lugares: LugarStockItem[];
}

export function InsumosTab({ lugares }: InsumosTabProps) {
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtro chip: todos, agotados, bajo, regular, suficiente
  const [filtroChip, setFiltroChip] = useState<'todos' | 'agotados' | 'bajo' | 'regular' | 'suficiente'>('todos');

  // Alertas por correo
  const [mailOn, setMailOn] = useState(true);

  // Orden de compra por WhatsApp
  const [ordenCompra, setOrdenCompra] = useState<{
    titulo: string;
    para: string;
    mensaje: string;
    enlaceWa: string;
  } | null>(null);

  // Modales
  const [modalInsumoAbierto, setModalInsumoAbierto] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<InsumoItem | null>(null);

  const cargarInsumos = useCallback(async () => {
    try {
      setError(null);
      const datos = await stockApi.listarInsumos();
      setInsumos(comoLista<InsumoItem>(datos));
    } catch (err: any) {
      setError(err.message || 'Error al cargar insumos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarInsumos();
  }, [cargarInsumos]);

  const abrirNuevoInsumo = () => {
    setInsumoSeleccionado(null);
    setModalInsumoAbierto(true);
  };

  const abrirFicha = (insumo: InsumoItem) => {
    setInsumoSeleccionado(insumo);
    setModalInsumoAbierto(true);
  };

  const handleGuardarInsumo = async (datos: any) => {
    if (insumoSeleccionado) {
      await stockApi.actualizarInsumo(insumoSeleccionado.id, datos);
    } else {
      await stockApi.crearInsumo(datos);
    }
    await cargarInsumos();
  };

  const insumosAgotados = insumos.filter((i) => i.stock_total <= 0);
  const insumosBajos = insumos.filter((i) => i.stock_total > 0 && i.stock_total <= i.minimo);
  const insumosRegulares = insumos.filter(
    (i) => i.stock_total > i.minimo && i.intermedio != null && i.stock_total <= i.intermedio,
  );
  const insumosSuficientes = insumos.filter((i) => {
    const umbral = i.intermedio != null ? i.intermedio : i.minimo;
    return i.stock_total > umbral;
  });

  const insumosOrdenados = useMemo(() => {
    const filtrados = insumos.filter((i) => {
      if (filtroChip === 'agotados') return i.stock_total <= 0;
      if (filtroChip === 'bajo') return i.stock_total > 0 && i.stock_total <= i.minimo;
      if (filtroChip === 'regular')
        return i.stock_total > i.minimo && i.intermedio != null && i.stock_total <= i.intermedio;
      if (filtroChip === 'suficiente') {
        const umbral = i.intermedio != null ? i.intermedio : i.minimo;
        return i.stock_total > umbral;
      }
      return true;
    });

    const ordenUrgencia: Record<string, number> = {
      rojo: 0,
      naranja: 1,
      verde: 2,
    };

    return filtrados.sort((a, b) => {
      const urga = a.stock_total <= 0 ? -1 : (ordenUrgencia[a.semaforo] ?? 2);
      const urgb = b.stock_total <= 0 ? -1 : (ordenUrgencia[b.semaforo] ?? 2);
      if (urga !== urgb) return urga - urgb;
      const pcta = a.maximo > 0 ? a.stock_total / a.maximo : 0;
      const pctb = b.maximo > 0 ? b.stock_total / b.maximo : 0;
      return pcta - pctb;
    });
  }, [insumos, filtroChip]);

  const pedirLoQueFalta = () => {
    const faltantes = insumos.filter((i) => i.stock_total <= (i.intermedio || i.minimo));
    if (faltantes.length === 0) {
      alert('Todos los insumos tienen stock suficiente.');
      return;
    }

    const lineas = faltantes.map((i) => {
      const falta = Math.max(0, i.maximo - i.stock_total);
      return `• ${i.nombre}: pedir ${qty1(falta)} ${formatearUnidad(i.unidad_almacen)}`;
    });

    const texto = `Hola, este es el pedido de insumos para Caprichos:\n\n${lineas.join('\n')}\n\nPor favor confirmar recepción. Gracias.`;
    setOrdenCompra({
      titulo: `Pedido de ${faltantes.length} insumos faltantes`,
      para: 'Proveedores asignados',
      mensaje: texto,
      enlaceWa: `https://wa.me/?text=${encodeURIComponent(texto)}`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Texto explicativo exacto del mockup */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Cada barra muestra qué tan lleno está el insumo frente a su máximo; las marcas son el mínimo (oscura) y el medio. Palabras: Agotado, Por acabarse, Poco, Bien y Lleno. El stock baja solo con cada pedido aceptado, según la receta.
      </div>

      {/* Barra de filtros MOSTRAR y botones de acción idéntica al mockup */}
      <BarraFiltros style={{ justifyContent: 'space-between' }}>
        <FiltroCombo
          etiqueta="Mostrar"
          valor={filtroChip}
          valorPorDefecto="todos"
          opciones={[
            { valor: 'todos', etiqueta: 'Todos', cantidad: insumos.length },
            { valor: 'agotados', etiqueta: 'Agotados', cantidad: insumosAgotados.length },
            { valor: 'bajo', etiqueta: 'Stock bajo', cantidad: insumosBajos.length },
            { valor: 'regular', etiqueta: 'Regular', cantidad: insumosRegulares.length },
            { valor: 'suficiente', etiqueta: 'Suficiente', cantidad: insumosSuficientes.length },
          ]}
          alCambiar={(v) => setFiltroChip(v as typeof filtroChip)}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={abrirNuevoInsumo}
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
            + Nuevo insumo
          </button>

          <button
            type="button"
            onClick={pedirLoQueFalta}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Pedir lo que falta a los proveedores
          </button>
        </div>
      </BarraFiltros>

      {/* Alertas por correo */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--cp-soft)' }}>
        <span style={{ fontWeight: 700 }}>Alertas por correo</span>
        <button
          type="button"
          onClick={() => setMailOn(!mailOn)}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: mailOn ? 'var(--cp-navy)' : 'transparent',
            color: mailOn ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {mailOn ? 'Activadas' : 'Apagadas'}
        </button>
      </div>

      {/* Orden de compra lista para WhatsApp si se generó */}
      {ordenCompra && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '2px solid var(--cp-orange)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
            {ordenCompra.titulo}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Para: {ordenCompra.para}. Mensaje listo para WhatsApp:
          </div>
          <div
            style={{
              whiteSpace: 'pre-line',
              background: 'var(--cp-cream)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '14px',
            }}
          >
            {ordenCompra.mensaje}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={ordenCompra.enlaceWa}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                minHeight: '48px',
                padding: '0 18px',
                boxSizing: 'border-box',
                borderRadius: '12px',
                background: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
              }}
            >
              Abrir en WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setOrdenCompra(null)}
              style={{
                minHeight: '48px',
                padding: '0 18px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tarjeta contenedora de Insumos idéntica al mockup */}
      {cargando ? (
        <Cargando mensaje="Cargando insumos..." />
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarInsumos} />
      ) : insumosOrdenados.length === 0 ? (
        <EstadoVacio
          titulo="No se encontraron insumos"
          mensaje="Ningún insumo coincide con el filtro seleccionado."
        />
      ) : (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', overflow: 'hidden', flex: 'none' }}>
          <div
            style={{
              padding: '12px 16px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              borderBottom: '1px solid var(--cp-line)',
            }}
          >
            Insumos
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {insumosOrdenados.map((ins) => {
              const u = formatearUnidad(ins.unidad_almacen);
              const max = ins.maximo > 0 ? ins.maximo : 1;
              const tickMin = Math.min(100, Math.max(0, (ins.minimo / max) * 100));
              const tickMid =
                ins.intermedio != null ? Math.min(100, Math.max(0, (ins.intermedio / max) * 100)) : 50;
              const pct = Math.min(100, Math.max(0, ins.porcentaje_llenado));

              // Colores de barra e insignia idénticos al mockup
              let pillBg = '#D9EFE2';
              let pillFg = '#155724';
              let barColor = '#2F7D4F';

              if (ins.stock_total <= 0) {
                pillBg = '#FDE2E2';
                pillFg = 'var(--cp-rust)';
                barColor = 'var(--cp-rust)';
              } else if (ins.stock_total <= ins.minimo) {
                pillBg = '#FBE9DF';
                pillFg = 'var(--cp-rust)';
                barColor = 'var(--cp-rust)';
              } else if (ins.intermedio != null && ins.stock_total <= ins.intermedio) {
                pillBg = '#FFF3CD';
                pillFg = '#856404';
                barColor = 'var(--cp-orange)';
              }

              // Saldo en almacén central
              const saldoAlmacen =
                ins.stock_por_lugar?.find((s) => s.lugarNombre.toLowerCase().includes('almacén'))?.cantidad ??
                ins.stock_total;

              // Saldo en área de preparación (Barra / Cocina)
              const saldoArea =
                ins.stock_por_lugar?.find((s) => !s.lugarNombre.toLowerCase().includes('almacén') && s.cantidad > 0);

              const provTexto = [
                ins.proveedor_a ? `Proveedor A: ${ins.proveedor_a}` : '',
                ins.proveedor_b ? `B: ${ins.proveedor_b}` : '',
                ins.proveedor_c ? `C: ${ins.proveedor_c}` : '',
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={ins.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--cp-sand)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>{ins.nombre}</span>
                    <span
                      style={{
                        padding: '2px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 800,
                        background: pillBg,
                        color: pillFg,
                      }}
                    >
                      {ins.estado}
                    </span>
                  </div>

                  {/* Barra de progreso táctil con marcas de mínimo y medio */}
                  <div
                    style={{
                      position: 'relative',
                      height: '16px',
                      borderRadius: '8px',
                      background: 'var(--cp-sand)',
                      overflow: 'hidden',
                    }}
                    role="img"
                    aria-label={`${ins.nombre}: ${ins.estado}, ${pct} % del máximo`}
                  >
                    <div style={{ height: '16px', width: `${pct}%`, background: barColor, borderRadius: '8px' }} />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${tickMin}%`,
                        width: '2px',
                        background: 'rgba(11,44,62,0.55)',
                      }}
                      title={`Mínimo: ${ins.minimo}`}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${tickMid}%`,
                        width: '2px',
                        background: 'rgba(11,44,62,0.3)',
                      }}
                      title={`Medio: ${ins.intermedio ?? '-'}`}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <span>
                      <b>En almacén: {qty1(saldoAlmacen)} {u}</b>{' '}
                      <span style={{ color: 'var(--cp-soft)' }}>
                        de {qty1(ins.maximo)} {u} · {pct} %
                      </span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      Alerta desde {qty1(ins.minimo)} · medio {qty1(ins.intermedio)}
                    </span>
                  </div>

                  {saldoArea && (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                      En {saldoArea.lugarNombre}: {qty1(saldoArea.cantidad)} {u}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ flex: '1 1 200px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {provTexto || 'Sin proveedores asignados'}
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirFicha(ins)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        background: 'transparent',
                        color: 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      Ficha y unidades
                    </button>
                    {(ins.stock_total <= ins.minimo || ins.semaforo === 'rojo') && (
                      <button
                        type="button"
                        onClick={pedirLoQueFalta}
                        style={{
                          minHeight: '44px',
                          padding: '0 12px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Agregar a pedir a proveedores
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Ficha del Insumo / Nuevo Insumo */}
      {modalInsumoAbierto && (
        <ModalInsumo
          insumo={insumoSeleccionado}
          lugares={lugares}
          alCerrar={() => setModalInsumoAbierto(false)}
          alGuardar={handleGuardarInsumo}
        />
      )}
    </div>
  );
}
