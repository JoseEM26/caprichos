import { useEffect, useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { Cargando } from '../../../comun/Cargando';
import { EstadoVacio } from '../../../comun/EstadoVacio';
import { EstadoError } from '../../../comun/EstadoError';
import { CategoriaCarta, ProductoCarta } from '../../../carta/tipos';
import { CarritoProvider, useCarrito } from '../../../carta/CarritoContext';
import { VentanaProducto } from '../../../carta/VentanaProducto';
import { MesaSalon, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';
import { ModalLiberarMesa } from './ModalLiberarMesa';
import { salonApi } from '../api';

export interface ModalNuevoPedidoMesaProps {
  abierto: boolean;
  alCerrar: () => void;
  pisos: PisoSalon[];
  mesaPreseleccionadaId?: string;
  mesasPreseleccionadasIds?: string[];
  reservaIdPreseleccionada?: string;
  alExitoPedido?: (pedido: any) => void;
  alRefrescarMesas?: () => Promise<void>;
}

/**
 * Contenido interno envuelto en CarritoProvider para reutilizar
 * directamente VentanaProducto de la carta pública.
 */
function ContenidoPedidoMesa({
  alCerrar,
  pisos,
  mesasPreseleccionadasIds = [],
  reservaIdPreseleccionada,
  alExitoPedido,
  alRefrescarMesas,
}: {
  alCerrar: () => void;
  pisos: PisoSalon[];
  mesasPreseleccionadasIds: string[];
  reservaIdPreseleccionada?: string;
  alExitoPedido?: (pedido: any) => void;
  alRefrescarMesas?: () => Promise<void>;
}) {
  const { lineas, actualizarCantidad, eliminarLinea, limpiarCarrito, subtotal } =
    useCarrito();

  // Paso: 'mesas' (elegir mesa) o 'carta' (armar pedido)
  const [paso, setPaso] = useState<'mesas' | 'carta'>(
    mesasPreseleccionadasIds.length > 0 ? 'carta' : 'mesas',
  );

  // Mesas seleccionadas para el pedido
  const [mesasSeleccionadas, setMesasSeleccionadas] = useState<string[]>(
    mesasPreseleccionadasIds,
  );

  // Piso activo para el selector y mini plano
  const pisosActivos = pisos.filter((p) => p.activo !== false);
  const [pisoSeleccionadoId, setPisoSeleccionadoId] = useState<string>(
    pisosActivos[0]?.id || pisos[0]?.id || '1',
  );

  // Vista de plano en paso mesas
  const [mostrarPlanoEnPasoMesas, setMostrarPlanoEnPasoMesas] = useState(true);

  // Estado de la carta pública
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todas');
  const [busquedaCarta, setBusquedaCarta] = useState('');
  const [conImagenes, setConImagenes] = useState(true);
  const [productoEnVentana, setProductoEnVentana] =
    useState<ProductoCarta | null>(null);
  const [cargandoCarta, setCargandoCarta] = useState(false);
  const [errorCarta, setErrorCarta] = useState<string | null>(null);

  // Nota general para cocina
  const [notaCocina, setNotaCocina] = useState('');

  // Confirmación de envío
  const [confirmarEnviar, setConfirmarEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Modal para liberar mesa ocupada
  const [mesaParaLiberar, setMesaParaLiberar] = useState<MesaSalon | null>(null);
  const [errorLiberar, setErrorLiberar] = useState<string | null>(null);

  // Todas las mesas de los pisos activos
  const todasLasMesas = pisos.flatMap((p) =>
    (p.mesas || []).map((m) => ({
      ...m,
      pisoNombre: p.nombre,
    })),
  );

  const mesasLibres = todasLasMesas.filter(
    (m) => m.activo && m.estado === 'LIBRE',
  );
  const mesasOcupadas = todasLasMesas.filter(
    (m) => m.activo && m.estado === 'OCUPADA',
  );

  // Cargar catálogo de carta pública
  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargandoCarta(true);
      setErrorCarta(null);
      try {
        const res = await salonApi.obtenerCarta();
        if (activo) {
          setCategorias(res.categorias || []);
        }
      } catch (err: any) {
        if (activo) {
          setErrorCarta(
            err?.message || 'No fue posible cargar el catálogo de la carta.',
          );
        }
      } finally {
        if (activo) {
          setCargandoCarta(false);
        }
      }
    }
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Alternar selección de mesa (permite juntar varias mesas: RN-CAP-108)
  const alternarMesa = (mesa: MesaSalon) => {
    if (mesa.estado === 'OCUPADA') return;
    setMesasSeleccionadas((prev) => {
      if (prev.includes(mesa.id)) {
        return prev.filter((id) => id !== mesa.id);
      }
      return [...prev, mesa.id];
    });
  };

  // Nombres formateados de mesas seleccionadas
  const textoMesasElegidas = todasLasMesas
    .filter((m) => mesasSeleccionadas.includes(m.id))
    .map((m) => m.nombre || `Mesa ${m.numero}`)
    .join(', ');

  // Filtrado de productos de la carta
  const productosFiltrados = (() => {
    let prods: ProductoCarta[] = [];
    if (categoriaActivaId === 'todas') {
      prods = categorias.flatMap((c) => c.productos || []);
    } else {
      const cat = categorias.find((c) => c.id === categoriaActivaId);
      prods = cat?.productos || [];
    }

    if (busquedaCarta.trim()) {
      const q = busquedaCarta.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q),
      );
    }
    return prods;
  })();

  // Enviar pedido a cocina
  const ejecutarEnviarPedido = async () => {
    if (mesasSeleccionadas.length === 0 || lineas.length === 0) {
      setErrorEnvio('Debe seleccionar al menos una mesa y un producto.');
      setConfirmarEnviar(false);
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    // Clave de idempotencia única por cada intento
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mozo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payloadLineas = lineas.map((lin) => {
        const opcionesIds = (lin.opciones || []).map((o) => o.id);
        const personas = lin.unidades
          ?.map((u) => u.persona || '')
          .filter(Boolean);
        return {
          productoId: lin.productoId,
          tamanoId: lin.tamanoId,
          cantidad: lin.cantidad,
          opciones: opcionesIds,
          nota: lin.nota,
          personas: personas && personas.length > 0 ? personas : lin.personas,
        };
      });

      const res = await salonApi.abrirPedidoMesa(
        {
          mesas: mesasSeleccionadas,
          lineas: payloadLineas,
          nota: notaCocina.trim() || undefined,
          reservaId: reservaIdPreseleccionada,
        },
        idempotencyKey,
      );

      limpiarCarrito();
      setConfirmarEnviar(false);
      alExitoPedido?.(res);
      await alRefrescarMesas?.();
      alCerrar();
    } catch (err: any) {
      setConfirmarEnviar(false);
      if (err?.codigo === 'MESA_OCUPADA') {
        setErrorEnvio(
          err.message ||
            'Una o más mesas ya están ocupadas por otro mozo o pedido. Se actualizó el estado de las mesas.',
        );
        // Refrescar inmediatamente el estado de las mesas
        await alRefrescarMesas?.();
        // Quitar las mesas ocupadas de la selección
        setMesasSeleccionadas([]);
        setPaso('mesas');
      } else {
        setErrorEnvio(
          err?.message || 'Ocurrió un error al enviar el pedido a cocina.',
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  // Liberar mesa a mano
  const handleLiberarMesa = async (mesaId: string, motivo: string) => {
    setErrorLiberar(null);
    try {
      await salonApi.liberarMesaManual(mesaId, motivo);
      await alRefrescarMesas?.();
    } catch (err: any) {
      if (err?.codigo === 'PEDIDO_EN_COCINA') {
        setErrorLiberar(
          'El pedido sigue activo en cocina. Debe anularlo antes de liberar la mesa.',
        );
      } else {
        setErrorLiberar(err?.message || 'Error al liberar la mesa.');
      }
      throw err;
    }
  };

  // Marcar entregado en mesa para pedidos LISTOS
  const [confirmarEntregado, setConfirmarEntregado] = useState<{
    pedidoId: string;
    mesaNombre: string;
  } | null>(null);

  const ejecutarMarcarEntregado = async () => {
    if (!confirmarEntregado) return;
    try {
      await salonApi.marcarEntregadoMesa(confirmarEntregado.pedidoId);
      await alRefrescarMesas?.();
      setConfirmarEntregado(null);
    } catch (err: any) {
      setErrorEnvio(err?.message || 'Error al marcar como entregado en mesa.');
    }
  };

  const pisoActual =
    pisos.find((p) => p.id === pisoSeleccionadoId) || pisos[0];

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 75,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo pedido de mesa"
          style={{
            width: '100%',
            maxWidth: '1060px',
            maxHeight: '94vh',
            background: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera superior fija */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--cp-white)',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {paso === 'carta' && (
                <button
                  type="button"
                  onClick={() => setPaso('mesas')}
                  aria-label="Volver a elegir mesa"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  &larr;
                </button>
              )}
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Nuevo pedido de mesa
                  {mesasSeleccionadas.length > 0 && ` · ${textoMesasElegidas}`}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {paso === 'mesas'
                    ? 'Paso 1: Elige una o varias mesas libres'
                    : 'Paso 2: Agrega productos con sus opciones'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar pedido"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              x
            </button>
          </div>

          {/* Banner de error de envío */}
          {errorEnvio && (
            <div
              role="alert"
              style={{
                padding: '10px 16px',
                background: '#FBEDE9',
                borderBottom: '1.5px solid var(--cp-rust)',
                color: 'var(--cp-rust)',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{errorEnvio}</span>
              <button
                type="button"
                onClick={() => setErrorEnvio(null)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                x
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* PASO 1: SELECCIÓN DE MESAS                                         */}
          {/* ================================================================= */}
          {paso === 'mesas' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Barra de selector de piso si hay más de 1 piso */}
              {pisosActivos.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                    Piso:
                  </span>
                  {pisosActivos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPisoSeleccionadoId(p.id)}
                      style={{
                        minHeight: '44px',
                        padding: '0 16px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background:
                          p.id === pisoSeleccionadoId
                            ? 'var(--cp-navy)'
                            : 'var(--cp-white)',
                        color:
                          p.id === pisoSeleccionadoId
                            ? 'var(--cp-cream)'
                            : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Botones de MESAS LIBRES */}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    Mesas libres ({mesasLibres.length})
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Puedes elegir varias mesas juntas para un grupo
                  </span>
                </div>

                {mesasLibres.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '8px 0' }}>
                    No hay mesas libres en este momento. Puedes liberar una mesa ocupada a mano.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {mesasLibres.map((m) => {
                      const estaElegida = mesasSeleccionadas.includes(m.id);
                      const tieneReserva = !!m.reserva;
                      const nombreMostrar =
                        pisosActivos.length > 1
                          ? `${m.nombre || `Mesa ${m.numero}`} (${m.pisoNombre})`
                          : m.nombre || `Mesa ${m.numero}`;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => alternarMesa(m)}
                          style={{
                            minHeight: '44px',
                            minWidth: '90px',
                            padding: '0 14px',
                            borderRadius: '12px',
                            border: `2px solid ${
                              estaElegida
                                ? 'var(--cp-navy)'
                                : tieneReserva
                                ? 'var(--cp-gold)'
                                : 'var(--cp-ok)'
                            }`,
                            background: estaElegida
                              ? 'var(--cp-navy)'
                              : tieneReserva
                              ? '#FFF8E6'
                              : 'var(--cp-greenbg)',
                            color: estaElegida ? 'var(--cp-cream)' : 'var(--cp-navy)',
                            fontWeight: 800,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            position: 'relative',
                          }}
                        >
                          <span>{nombreMostrar}</span>
                          <span style={{ fontSize: '11px', opacity: 0.85 }}>
                            ({m.asientos || 4} as.)
                          </span>
                          {tieneReserva && (
                            <span
                              title={`Reservada para ${m.reserva?.nombre} (${m.reserva?.personas} p.) - La marca R no bloquea la mesa`}
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '9px',
                                background: 'var(--cp-gold)',
                                color: 'var(--cp-navy)',
                                fontSize: '10px',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              R
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botón para alternar vista en plano */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setMostrarPlanoEnPasoMesas(!mostrarPlanoEnPasoMesas)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {mostrarPlanoEnPasoMesas
                    ? 'Ocultar plano gráfico'
                    : 'Ver y tocar mesas en el plano'}
                </button>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                  <span>● Verde: Libre</span>
                  <span>● Naranja: Ocupada</span>
                  <span>● R: Reservada (aviso, no bloquea)</span>
                </div>
              </div>

              {/* Plano interactivo para elegir mesa con el dedo */}
              {mostrarPlanoEnPasoMesas && pisoActual && (
                <div
                  style={{
                    background: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '14px',
                    padding: '10px',
                  }}
                >
                  <CuadriculaPlano
                    columnas={
                      pisoActual.cuadriculaAncho ||
                      pisoActual.cuadricula_ancho ||
                      20
                    }
                    filas={
                      pisoActual.cuadriculaAlto ||
                      pisoActual.cuadricula_alto ||
                      12
                    }
                    // GET /admin/salon/mesas trae solo las mesas (con x, y, ancho y alto): se dibujan como elementos
                    elementos={pisoActual.elementos && pisoActual.elementos.length ? pisoActual.elementos : ((pisoActual.mesas || []) as any[])}
                    mesasSalon={pisoActual.mesas || []}
                    mesasSeleccionadasIds={mesasSeleccionadas}
                    onSeleccionarMesaSalon={alternarMesa}
                    modoSalon={true}
                  />
                </div>
              )}

              {/* Mesas OCUPADAS visibles con código y mozo, y opción de liberar a mano */}
              {mesasOcupadas.length > 0 && (
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
                  <span
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '14px',
                      color: 'var(--cp-rust)',
                    }}
                  >
                    Mesas ocupadas actualmente ({mesasOcupadas.length})
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {mesasOcupadas.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          border: '1.5px solid var(--cp-line)',
                          borderLeft: '5px solid var(--cp-orange)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          background: 'var(--cp-cream)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px' }}>
                            {m.nombre || `Mesa ${m.numero}`}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                            {m.pedidoCodigo ? `Pedido ${m.pedidoCodigo}` : 'Ocupada'}
                            {m.mozo ? ` · ${m.mozo}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Boton
                            type="button"
                            variante="secundario"
                            tamano="pequeno"
                            onClick={() => {
                              setErrorLiberar(null);
                              setMesaParaLiberar(m);
                            }}
                          >
                            Liberar
                          </Boton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* PASO 2: CATÁLOGO DE LA CARTA Y ARMADO DE LÍNEAS                     */}
          {/* ================================================================= */}
          {paso === 'carta' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Barra de mesa elegida con botón "Cambiar mesa" */}
              <div
                style={{
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  padding: '10px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                    }}
                  >
                    Pedido para: {textoMesasElegidas || 'Sin mesa elegida'}
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.85 }}>
                    ({lineas.reduce((acc, l) => acc + l.cantidad, 0)} productos)
                  </span>
                </div>
                <Boton
                  type="button"
                  variante="secundario"
                  tamano="pequeno"
                  onClick={() => setPaso('mesas')}
                  style={{
                    borderColor: 'var(--cp-cream)',
                    color: 'var(--cp-cream)',
                  }}
                >
                  Cambiar mesa
                </Boton>
              </div>

              {/* Contenido dividido: Catálogo a la izquierda, comanda a la derecha */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '16px 20px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Lado izquierdo: Buscador, filtros de categorías y productos */}
                <div
                  style={{
                    flex: '2 1 420px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Buscador y toggle con/sin imágenes */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <input
                      type="search"
                      value={busquedaCarta}
                      onChange={(e) => setBusquedaCarta(e.target.value)}
                      placeholder="Buscar producto en la carta..."
                      style={{
                        flex: '1 1 200px',
                        minHeight: '44px',
                        boxSizing: 'border-box',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        padding: '0 16px',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setConImagenes(!conImagenes)}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: conImagenes
                          ? 'var(--cp-navy)'
                          : 'var(--cp-white)',
                        color: conImagenes
                          ? 'var(--cp-cream)'
                          : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {conImagenes ? 'Con imágenes' : 'Sin imágenes'}
                    </button>
                  </div>

                  {/* Chips de categorías */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCategoriaActivaId('todas')}
                      style={{
                        flex: 'none',
                        minHeight: '44px',
                        padding: '0 16px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background:
                          categoriaActivaId === 'todas'
                            ? 'var(--cp-navy)'
                            : 'var(--cp-white)',
                        color:
                          categoriaActivaId === 'todas'
                            ? 'var(--cp-cream)'
                            : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Todas
                    </button>
                    {categorias.map((cat) => {
                      const estaActiva = categoriaActivaId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoriaActivaId(cat.id)}
                          style={{
                            flex: 'none',
                            minHeight: '44px',
                            padding: '0 16px',
                            borderRadius: '9999px',
                            border: '1.5px solid var(--cp-navy)',
                            background: estaActiva
                              ? 'var(--cp-navy)'
                              : 'var(--cp-white)',
                            color: estaActiva
                              ? 'var(--cp-cream)'
                              : 'var(--cp-navy)',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          {cat.nombre}
                        </button>
                      );
                    })}
                  </div>

                  {/* Grid de productos */}
                  {cargandoCarta ? (
                    <Cargando mensaje="Cargando catálogo..." />
                  ) : errorCarta ? (
                    <EstadoError
                      titulo="Error al cargar la carta"
                      mensaje={errorCarta}
                    />
                  ) : productosFiltrados.length === 0 ? (
                    <EstadoVacio
                      titulo="No hay productos"
                      descripcion="No se encontraron productos en esta categoría o búsqueda."
                    />
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: conImagenes
                          ? 'repeat(auto-fill, minmax(180px, 1fr))'
                          : 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {productosFiltrados.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => setProductoEnVentana(prod)}
                          style={{
                            textAlign: 'left',
                            background: 'var(--cp-white)',
                            border: '1.5px solid var(--cp-line)',
                            borderRadius: '14px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            cursor: 'pointer',
                            minHeight: conImagenes ? '180px' : '72px',
                          }}
                        >
                          {conImagenes && prod.fotoUrl && (
                            <img
                              src={prod.fotoUrl}
                              alt={prod.nombre}
                              style={{
                                width: '100%',
                                aspectRatio: '4/3',
                                objectFit: 'cover',
                                borderRadius: '10px',
                                background: 'var(--cp-sand)',
                              }}
                            />
                          )}
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                            {prod.nombre}
                          </div>
                          {prod.descripcion && (
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--cp-soft)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {prod.descripcion}
                            </div>
                          )}
                          <div
                            style={{
                              marginTop: 'auto',
                              fontWeight: 800,
                              color: 'var(--cp-rust)',
                              fontSize: '14px',
                            }}
                          >
                            S/ {prod.precio.toFixed(2)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lado derecho: Comanda del pedido */}
                <div
                  style={{
                    flex: '1 1 300px',
                    minWidth: '280px',
                    background: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 4px 14px rgba(11, 44, 62, 0.05)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                      borderBottom: '1px solid var(--cp-line)',
                      paddingBottom: '8px',
                    }}
                  >
                    Detalle del pedido
                  </div>

                  {lineas.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '16px 0' }}>
                      Toca un producto de la izquierda para configurar sus opciones y agregarlo a la comanda.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        maxHeight: '340px',
                        overflowY: 'auto',
                      }}
                    >
                      {lineas.map((lin) => (
                        <div
                          key={lin.id}
                          style={{
                            borderBottom: '1px solid var(--cp-line)',
                            paddingBottom: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}>
                              {lin.nombre}
                            </span>
                            <span style={{ fontWeight: 800, color: 'var(--cp-rust)', fontSize: '13px' }}>
                              S/ {lin.subtotal.toFixed(2)}
                            </span>
                          </div>

                          {lin.tamanoNombre && (
                            <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                              Tamaño: {lin.tamanoNombre}
                            </div>
                          )}

                          {lin.opciones && lin.opciones.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                              {lin.opciones.map((o) => o.nombre).join(', ')}
                            </div>
                          )}

                          {lin.nota && (
                            <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                              Nota: {lin.nota}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(lin.id, -1)}
                              aria-label={`Quitar uno de ${lin.nombre}`}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '16px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                color: 'var(--cp-navy)',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 800 }}>
                              {lin.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidad(lin.id, 1)}
                              aria-label={`Agregar uno de ${lin.nombre}`}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '16px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                color: 'var(--cp-navy)',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarLinea(lin.id)}
                              style={{
                                marginLeft: 'auto',
                                border: 0,
                                background: 'transparent',
                                color: 'var(--cp-rust)',
                                fontSize: '12px',
                                fontWeight: 700,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nota general para cocina */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <label
                      htmlFor="nota-general-cocina"
                      style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}
                    >
                      Nota general para la comanda (opcional)
                    </label>
                    <input
                      id="nota-general-cocina"
                      type="text"
                      value={notaCocina}
                      onChange={(e) => setNotaCocina(e.target.value)}
                      placeholder="Ej.: mesa junta, servir todo junto..."
                      maxLength={100}
                      style={{
                        minHeight: '44px',
                        boxSizing: 'border-box',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-cream)',
                        padding: '0 12px',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  {/* Total y botón de enviar directo a cocina */}
                  <div
                    style={{
                      borderTop: '1.5px solid var(--cp-line)',
                      paddingTop: '10px',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>Total</span>
                    <span
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '20px',
                        color: 'var(--cp-rust)',
                      }}
                    >
                      S/ {subtotal.toFixed(2)}
                    </span>
                  </div>

                  <Boton
                    type="button"
                    variante="primario"
                    disabled={lineas.length === 0 || mesasSeleccionadas.length === 0}
                    onClick={() => setConfirmarEnviar(true)}
                    style={{ minHeight: '48px', width: '100%' }}
                  >
                    Enviar directo a cocina
                  </Boton>
                </div>
              </div>
            </div>
          )}

          {/* Barra inferior fija en Paso 1 (Mesas) */}
          {paso === 'mesas' && (
            <div
              style={{
                padding: '12px 20px',
                background: 'var(--cp-white)',
                borderTop: '1px solid var(--cp-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                {mesasSeleccionadas.length === 0 ? (
                  <span style={{ color: 'var(--cp-soft)' }}>
                    Toca una o varias mesas libres arriba para continuar.
                  </span>
                ) : (
                  <span>
                    <b>Seleccionadas:</b> {textoMesasElegidas}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Boton type="button" variante="secundario" onClick={alCerrar}>
                  Cancelar
                </Boton>
                <Boton
                  type="button"
                  variante="primario"
                  disabled={mesasSeleccionadas.length === 0}
                  onClick={() => setPaso('carta')}
                >
                  Continuar a la carta
                </Boton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ventana de personalización de producto (REUTILIZADA DE LA CARTA PÚBLICA) */}
      {productoEnVentana && (
        <VentanaProducto
          producto={productoEnVentana}
          onCerrar={() => setProductoEnVentana(null)}
        />
      )}

      {/* Confirmación obligatoria Sí/No antes de enviar el pedido */}
      <Confirmar
        abierto={confirmarEnviar}
        titulo="¿Enviar pedido directo a cocina?"
        mensaje={`Se abrirá el pedido para ${textoMesasElegidas} con ${lineas.reduce(
          (acc, l) => acc + l.cantidad,
          0,
        )} producto(s) por un total de S/ ${subtotal.toFixed(
          2,
        )}. La comanda se enviará al instante a cocina.`}
        textoSi="Sí, enviar comanda"
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={ejecutarEnviarPedido}
        alCancelar={() => setConfirmarEnviar(false)}
      />

      {/* Modal para liberar mesa a mano */}
      {mesaParaLiberar && (
        <ModalLiberarMesa
          abierto={true}
          mesa={mesaParaLiberar}
          alCerrar={() => setMesaParaLiberar(null)}
          alLiberar={handleLiberarMesa}
          error={errorLiberar}
          alLimpiarError={() => setErrorLiberar(null)}
        />
      )}

      {/* Confirmar entregado en mesa para pedidos LISTOS */}
      {confirmarEntregado && (
        <Confirmar
          abierto={true}
          titulo="¿Marcar entregado en mesa?"
          mensaje={`¿Confirmas que el pedido ${confirmarEntregado.pedidoId} ya fue servido en ${confirmarEntregado.mesaNombre}?`}
          textoSi="Sí, entregado en mesa"
          textoNo="No, cancelar"
          alConfirmar={ejecutarMarcarEntregado}
          alCancelar={() => setConfirmarEntregado(null)}
        />
      )}
    </>
  );
}

/**
 * Componente exportado con proveedor de carrito aislado para mozo.
 */
export function ModalNuevoPedidoMesa(props: ModalNuevoPedidoMesaProps) {
  if (!props.abierto) return null;

  return (
    <CarritoProvider>
      <ContenidoPedidoMesa
        alCerrar={props.alCerrar}
        pisos={props.pisos}
        mesasPreseleccionadasIds={
          props.mesasPreseleccionadasIds ||
          (props.mesaPreseleccionadaId ? [props.mesaPreseleccionadaId] : [])
        }
        reservaIdPreseleccionada={props.reservaIdPreseleccionada}
        alExitoPedido={props.alExitoPedido}
        alRefrescarMesas={props.alRefrescarMesas}
      />
    </CarritoProvider>
  );
}
