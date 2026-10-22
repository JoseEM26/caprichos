import { useEffect, useState, useMemo } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { Cargando } from '../../../comun/Cargando';
import { CategoriaCarta, ProductoCarta, OpcionCarta as OpcionProducto } from '../../../carta/tipos';
import { MesaSalon, PisoSalon } from '../tipos';
import { VentanaOpcionesProducto, ProductoConfigurado } from './VentanaOpcionesProducto';
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

export interface LineaPedidoMesa {
  id: string;
  productoId: string | number;
  nombre: string;
  tamanoId?: string | number;
  tamanoNombre?: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  opciones: OpcionProducto[];
  unidades?: Array<{ persona?: string; opciones?: OpcionProducto[] }>;
  nota?: string;
  personas?: string[];
}

export function ModalNuevoPedidoMesa({
  abierto,
  alCerrar,
  pisos = [],
  mesaPreseleccionadaId,
  mesasPreseleccionadasIds = [],
  reservaIdPreseleccionada,
  alExitoPedido,
  alRefrescarMesas,
}: ModalNuevoPedidoMesaProps) {
  if (!abierto) return null;

  const todasLasMesasIniciales = useMemo(() => {
    const list: string[] = [];
    if (mesaPreseleccionadaId) list.push(mesaPreseleccionadaId);
    if (mesasPreseleccionadasIds && mesasPreseleccionadasIds.length > 0) {
      mesasPreseleccionadasIds.forEach((id) => {
        if (!list.includes(id)) list.push(id);
      });
    }
    return list;
  }, [mesaPreseleccionadaId, mesasPreseleccionadasIds]);

  // Pasos: 'modal' | 'floor' | 'plan' | 'cli' | 'items'
  const [paso, setPaso] = useState<'modal' | 'floor' | 'plan' | 'cli' | 'items'>(
    todasLasMesasIniciales.length > 0 ? 'items' : 'plan',
  );

  // Modalidad: 'local' | 'llevar' | 'delivery'
  const [modalidad, setModalidad] = useState<'local' | 'llevar' | 'delivery'>('local');

  // Modo en plano: 'one' (Tomar pedido) | 'join' (Juntar mesas) | 'free' (Liberar)
  const [modoPlano, setModoPlano] = useState<'one' | 'join' | 'free'>('one');

  // Mesas seleccionadas
  const [mesasSeleccionadas, setMesasSeleccionadas] = useState<string[]>(todasLasMesasIniciales);

  // Pisos activos
  const pisosActivos = useMemo(() => pisos.filter((p) => p.activo !== false), [pisos]);
  const [pisoActivoId, setPisoActivoId] = useState<string>(
    pisosActivos[0]?.id || pisos[0]?.id || '1',
  );

  // Datos cliente (para llevar o delivery)
  const [cliNombre, setCliNombre] = useState('');
  const [cliTelefono, setCliTelefono] = useState('');

  // Carta y productos
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargandoCarta, setCargandoCarta] = useState(false);
  const [errorCarta, setErrorCarta] = useState<string | null>(null);
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [conImagenes, setConImagenes] = useState(true);

  // Ventana de opciones del producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoCarta | null>(null);

  // Carrito de líneas de pedido
  const [lineas, setLineas] = useState<LineaPedidoMesa[]>([]);

  // Cupón
  const [cuponInput, setCuponInput] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; descuento: number } | null>(
    null,
  );
  const [cuponError, setCuponError] = useState<string | null>(null);

  // Nota general para cocina
  const notaGeneral = '';

  // Diálogo de confirmación
  const [confirmarEnviar, setConfirmarEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Modal Liberar mesa
  const [mesaParaLiberar, setMesaParaLiberar] = useState<MesaSalon | null>(null);

  // Cargar carta al montar
  useEffect(() => {
    let cancel = false;
    async function cargar() {
      setCargandoCarta(true);
      setErrorCarta(null);
      try {
        const res = await salonApi.obtenerCarta();
        if (!cancel && res?.categorias) {
          setCategorias(res.categorias);
        }
      } catch (err: any) {
        if (!cancel) {
          setErrorCarta(err?.message || 'Error al cargar la carta');
        }
      } finally {
        if (!cancel) setCargandoCarta(false);
      }
    }
    cargar();
    return () => {
      cancel = true;
    };
  }, []);

  // Mesas del piso actual
  const pisoActual = pisos.find((p) => p.id === pisoActivoId) || pisos[0];
  const mesasPiso = pisoActual?.mesas || [];

  // Todas las mesas
  const todasLasMesas = useMemo(() => pisos.flatMap((p) => p.mesas || []), [pisos]);

  // Nombres de mesas seleccionadas
  const textoMesas = useMemo(() => {
    if (mesasSeleccionadas.length === 0) return 'Sin mesa';
    return todasLasMesas
      .filter((m) => mesasSeleccionadas.includes(m.id))
      .map((m) => m.nombre || `Mesa ${m.numero}`)
      .join(' + ');
  }, [mesasSeleccionadas, todasLasMesas]);

  // Asientos totales de mesas seleccionadas
  const asientosSeleccionados = useMemo(() => {
    return todasLasMesas
      .filter((m) => mesasSeleccionadas.includes(m.id))
      .reduce((acc, m) => acc + (Number(m.asientos) || 4), 0);
  }, [mesasSeleccionadas, todasLasMesas]);

  // Manejar clic en mesa en el plano
  const handleClicMesa = (mesa: MesaSalon) => {
    if (modoPlano === 'free') {
      if (mesa.estado === 'OCUPADA') {
        setMesaParaLiberar(mesa);
      }
      return;
    }

    if (mesa.estado === 'OCUPADA') {
      return;
    }

    if (modoPlano === 'one') {
      setMesasSeleccionadas([mesa.id]);
    } else {
      // Juntar varias mesas
      setMesasSeleccionadas((prev) => {
        if (prev.includes(mesa.id)) {
          return prev.filter((id) => id !== mesa.id);
        }
        return [...prev, mesa.id];
      });
    }
  };

  // Agregar producto desde VentanaOpcionesProducto
  const handleAgregarProductoConfigurado = (config: ProductoConfigurado) => {
    const nuevaLinea: LineaPedidoMesa = {
      id: `${config.producto.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productoId: config.producto.id,
      nombre: config.producto.nombre,
      tamanoId: config.tamano ? config.tamano.id : undefined,
      tamanoNombre: config.tamano ? config.tamano.nombre : undefined,
      cantidad: config.cantidad,
      precioUnitario: config.precioUnitario,
      precioTotal: config.precioTotal,
      opciones: config.opcionesGlobales,
      unidades: config.unidades.map((u) => ({
        persona: u.nombreVaso,
        opciones: u.opciones,
      })),
      nota: config.nota,
      personas: config.unidades.map((u) => u.nombreVaso).filter(Boolean),
    };

    setLineas((prev) => [...prev, nuevaLinea]);
  };

  // Stepper de línea de carrito
  const actualizarCantidadLinea = (id: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((lin) => {
          if (lin.id === id) {
            const nuevaCantidad = lin.cantidad + delta;
            if (nuevaCantidad <= 0) return null;
            return {
              ...lin,
              cantidad: nuevaCantidad,
              precioTotal: lin.precioUnitario * nuevaCantidad,
            };
          }
          return lin;
        })
        .filter(Boolean) as LineaPedidoMesa[],
    );
  };

  // Quitar línea
  const quitarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  // Subtotal, Descuentos y Total
  const subtotal = useMemo(() => {
    return lineas.reduce((acc, l) => acc + l.precioTotal, 0);
  }, [lineas]);

  const descuento = useMemo(() => {
    if (cuponAplicado) return cuponAplicado.descuento;
    return 0;
  }, [cuponAplicado]);

  const total = Math.max(0, subtotal - descuento);

  // Aplicar cupón
  const handleAplicarCupon = () => {
    const cod = cuponInput.trim().toUpperCase();
    if (!cod) {
      setCuponError('Escribe el código del cupón.');
      return;
    }
    if (cod === 'DESCUENTO10' || cod === 'PROMO10') {
      const d = Math.round(subtotal * 0.1 * 100) / 100;
      setCuponAplicado({ codigo: cod, descuento: d });
      setCuponError(null);
    } else {
      setCuponError('Ese cupón no existe o está vencido.');
    }
  };

  // Enviar pedido a cocina
  const handleEnviarPedido = async () => {
    if (mesasSeleccionadas.length === 0 || lineas.length === 0) {
      setErrorEnvio('Debe seleccionar al menos una mesa y un producto.');
      setConfirmarEnviar(false);
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mozo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payloadLineas = lineas.map((lin) => {
        const opcionesIds = (lin.opciones || []).map((o) => o.id);
        const personas = lin.unidades?.map((u) => u.persona || '').filter(Boolean);
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
          nota: notaGeneral.trim() || undefined,
          reservaId: reservaIdPreseleccionada,
        },
        idempotencyKey,
      );

      setConfirmarEnviar(false);
      alExitoPedido?.(res);
      await alRefrescarMesas?.();
      alCerrar();
    } catch (err: any) {
      setConfirmarEnviar(false);
      if (err?.codigo === 'MESA_OCUPADA') {
        setErrorEnvio(
          err.message ||
            'La mesa ya está ocupada por otro pedido. Se actualizó el estado de las mesas.',
        );
        await alRefrescarMesas?.();
        setMesasSeleccionadas([]);
        setPaso('plan');
      } else {
        setErrorEnvio(err?.message || 'Error al enviar el pedido a cocina.');
      }
    } finally {
      setEnviando(false);
    }
  };

  // Productos filtrados para la carta
  const productosFiltrados = useMemo(() => {
    let prods: ProductoCarta[] = [];
    if (categoriaActivaId === 'todas') {
      prods = categorias.flatMap((c) => c.productos || []);
    } else {
      const cat = categorias.find((c) => c.id === categoriaActivaId);
      prods = cat?.productos || [];
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q),
      );
    }
    return prods;
  }, [categorias, categoriaActivaId, busqueda]);

  // Título del modal según paso
  const tituloPaso = useMemo(() => {
    if (paso === 'modal') return '¿Qué vas a hacer?';
    if (paso === 'floor') return 'Elige el piso';
    if (paso === 'plan') {
      return (
        'Elige la mesa' +
        (pisosActivos.length > 1 ? ` · ${pisoActual?.nombre || 'Piso 1'}` : '')
      );
    }
    if (paso === 'cli') {
      return modalidad === 'delivery'
        ? 'Delivery: datos del cliente'
        : 'Para llevar: datos del cliente';
    }
    if (paso === 'items') {
      return modalidad === 'local'
        ? `${textoMesas}${pisosActivos.length > 1 ? ` · ${pisoActual?.nombre || 'Piso 1'}` : ''}`
        : `${modalidad === 'delivery' ? 'Delivery' : 'Para llevar'} · ${cliNombre || 'Cliente'}`;
    }
    return '';
  }, [paso, modalidad, pisosActivos, pisoActual, textoMesas, cliNombre]);

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo pedido de mesa"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Fondo oscurecido */}
        <div
          onClick={alCerrar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
            background: 'rgba(11, 44, 62, 0.55)',
          }}
        />

        {/* Contenedor Modal */}
        <div
          style={{
            position: 'relative',
            zIndex: 60,
            width: 'min(1120px, calc(100% - 24px))',
            maxHeight: 'calc(100% - 24px)',
            overflowY: 'auto',
            background: 'var(--cp-cream)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Barra superior con volver y cerrar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  if (paso === 'items') {
                    setPaso(modalidad === 'local' ? 'plan' : 'cli');
                  } else if (paso === 'cli' || paso === 'plan') {
                    if (todasLasMesasIniciales.length > 0) {
                      alCerrar();
                    } else {
                      setPaso('modal');
                    }
                  } else if (paso === 'floor') {
                    setPaso('modal');
                  } else {
                    alCerrar();
                  }
                }}
                aria-label="Volver"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '20px',
                  lineHeight: '26px',
                  color: 'var(--cp-navy)',
                }}
              >
                Nuevo pedido · {tituloPaso}
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
              }}
            >
              ×
            </button>
          </div>

          {/* Error de envío global si hay */}
          {errorEnvio && (
            <div
              role="alert"
              style={{
                background: '#FDECE8',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-rust)',
              }}
            >
              {errorEnvio}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 1: MODALIDAD (¿Qué vas a hacer?)                         */}
          {/* ============================================================= */}
          {paso === 'modal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: 'var(--cp-soft)',
                }}
              >
                PARA UN CLIENTE
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setModalidad('local');
                    if (pisosActivos.length > 1) {
                      setPaso('floor');
                    } else {
                      setPaso('plan');
                    }
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    En el local (mesa)
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Elige el piso y la mesa
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalidad('llevar');
                    setPaso('cli');
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    Para llevar
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Sin mesa: nombre y teléfono
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalidad('delivery');
                    setPaso('cli');
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    Delivery
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Nombre, teléfono y ubicación
                  </span>
                </button>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: 'var(--cp-soft)',
                  marginTop: '6px',
                }}
              >
                PARA EL EQUIPO
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalidad('local');
                  setPaso('plan');
                }}
                style={{
                  minHeight: '64px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '14px',
                  background: 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  padding: '8px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '16px',
                  }}
                >
                  Pedido del personal
                </span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  Elige quién compra; el descuento de personal se aplica al cobrar a crédito
                </span>
              </button>
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 2: ELEGIR PISO (si hay > 1)                              */}
          {/* ============================================================= */}
          {paso === 'floor' && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {pisosActivos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setPisoActivoId(f.id);
                    setPaso('plan');
                  }}
                  style={{
                    flex: '1 1 200px',
                    minHeight: '96px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '22px',
                    }}
                  >
                    {f.nombre}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                    {(f.mesas || []).filter((m) => m.activo).length} mesas
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 3: PLANO Y MESAS                                         */}
          {/* ============================================================= */}
          {paso === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Modos: Tomar pedido, Juntar mesas, Liberar */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Modo
                </span>
                {[
                  { id: 'one', n: 'Tomar pedido' },
                  { id: 'join', n: 'Juntar varias mesas' },
                  { id: 'free', n: 'Liberar o marcar mesa' },
                ].map((m) => {
                  const on = modoPlano === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModoPlano(m.id as any);
                        if (m.id === 'one') {
                          setMesasSeleccionadas((prev) => prev.slice(0, 1));
                        }
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: on ? 'var(--cp-navy)' : 'transparent',
                        color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {m.n}
                    </button>
                  );
                })}
              </div>

              {/* Selector de piso si hay más de 1 */}
              {pisosActivos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pisosActivos.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPisoActivoId(f.id)}
                      style={{
                        minHeight: '44px',
                        padding: '0 16px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: pisoActivoId === f.id ? 'var(--cp-navy)' : 'transparent',
                        color: pisoActivoId === f.id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Leyenda */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                  color: 'var(--cp-soft)',
                }}
              >
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: 'var(--cp-greenbg)',
                      border: '1.5px solid var(--cp-ok)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Libre
                </span>
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: '#F6C9A5',
                      border: '1.5px solid var(--cp-orange)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Ocupada ahora
                </span>
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: '#F9E0B5',
                      border: '1.5px solid var(--cp-gold)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Reservada (R)
                </span>
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: '#0B2C3E',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Elegida
                </span>
              </div>

              {/* Cuadrícula interactiva de mesas */}
              <div
                style={{
                  maxWidth: '100%',
                  overflowX: 'auto',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '10px',
                  background: 'var(--cp-white)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {mesasPiso.map((m) => {
                    const elegida = mesasSeleccionadas.includes(m.id);
                    const ocupada = m.estado === 'OCUPADA';
                    const reservada = !!m.reserva;

                    let bg = 'var(--cp-white)';
                    let fg = 'var(--cp-navy)';
                    let bd = 'var(--cp-ok)';

                    if (elegida) {
                      bg = 'var(--cp-navy)';
                      fg = 'var(--cp-cream)';
                      bd = 'var(--cp-navy)';
                    } else if (ocupada) {
                      bg = '#F6C9A5';
                      bd = 'var(--cp-orange)';
                    } else if (reservada) {
                      bg = '#F9E0B5';
                      bd = 'var(--cp-gold)';
                    } else {
                      bg = 'var(--cp-greenbg)';
                      bd = 'var(--cp-ok)';
                    }

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleClicMesa(m)}
                        style={{
                          minHeight: '74px',
                          borderRadius: '12px',
                          border: `2px solid ${bd}`,
                          background: bg,
                          color: fg,
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        <span style={{ fontSize: '15px' }}>
                          {m.nombre || `Mesa ${m.numero}`}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>
                          {m.asientos || 4} pers.
                        </span>
                        {reservada && !elegida && (
                          <span style={{ fontSize: '11px', color: 'var(--cp-rust)' }}>
                            (R: {m.reserva?.hora || 'Res.'})
                          </span>
                        )}
                        {ocupada && !elegida && (
                          <span style={{ fontSize: '10px', color: 'var(--cp-rust)' }}>
                            Ocupada
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Barra inferior de confirmación de mesas */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  borderTop: '1px solid var(--cp-line)',
                  paddingTop: '10px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  {mesasSeleccionadas.length > 0
                    ? `Mesas elegidas: ${textoMesas} · ${asientosSeleccionados} asientos`
                    : 'Toca una mesa para seleccionarla'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {mesasSeleccionadas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMesasSeleccionadas([])}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'transparent',
                        color: 'var(--cp-soft)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Limpiar
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={mesasSeleccionadas.length === 0}
                    onClick={() => setPaso('items')}
                    aria-label="Continuar a la carta"
                    style={{
                      minHeight: '48px',
                      padding: '0 20px',
                      borderRadius: '12px',
                      border: 0,
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '15px',
                      opacity: mesasSeleccionadas.length > 0 ? 1 : 0.5,
                      cursor: mesasSeleccionadas.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Continuar a la carta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 4: DATOS CLIENTE (Para llevar / Delivery)                */}
          {/* ============================================================= */}
          {paso === 'cli' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Nombre del cliente
                </label>
                <input
                  type="text"
                  value={cliNombre}
                  onChange={(e) => setCliNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  value={cliTelefono}
                  onChange={(e) => setCliTelefono(e.target.value)}
                  placeholder="987 654 321"
                  style={{
                    width: '100%',
                    minHeight: '46px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 12px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <button
                type="button"
                disabled={!cliNombre.trim()}
                onClick={() => setPaso('items')}
                style={{
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '15px',
                  marginTop: '8px',
                  opacity: cliNombre.trim() ? 1 : 0.5,
                  cursor: cliNombre.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Continuar a la carta
              </button>
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 5: ITEMS Y CARTA PÚBLICA                                 */}
          {/* ============================================================= */}
          {paso === 'items' && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'flex-start',
              }}
            >
              {/* IZQUIERDA: Catálogo de productos */}
              <div
                style={{
                  flex: '3 1 520px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Categorías en tira horizontal */}
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
                      minHeight: '40px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background:
                        categoriaActivaId === 'todas' ? 'var(--cp-navy)' : 'transparent',
                      color:
                        categoriaActivaId === 'todas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Todos
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaActivaId(c.id)}
                      style={{
                        flex: 'none',
                        minHeight: '40px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background:
                          categoriaActivaId === c.id ? 'var(--cp-navy)' : 'transparent',
                        color:
                          categoriaActivaId === c.id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>

                {/* Buscador y toggle con/sin imagen */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto"
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 16px',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setConImagenes(!conImagenes)}
                    style={{
                      flex: 'none',
                      minHeight: '40px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background: conImagenes ? 'var(--cp-navy)' : 'transparent',
                      color: conImagenes ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {conImagenes ? 'Con imagen' : 'Sin imagen'}
                  </button>
                </div>

                {/* Grilla de productos */}
                {cargandoCarta ? (
                  <Cargando mensaje="Cargando productos..." pantallaCompleta={false} />
                ) : errorCarta ? (
                  <div style={{ padding: '16px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                    {errorCarta}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: conImagenes
                        ? 'repeat(auto-fill, minmax(150px, 1fr))'
                        : 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '10px',
                      maxHeight: '52vh',
                      overflowY: 'auto',
                      padding: '4px',
                    }}
                  >
                    {productosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProductoSeleccionado(p)}
                        style={{
                          background: 'var(--cp-white)',
                          border: '1px solid var(--cp-line)',
                          borderRadius: '12px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {conImagenes && p.fotoUrl && (
                          <img
                            src={p.fotoUrl}
                            alt={p.nombre}
                            style={{
                              width: '100%',
                              height: '90px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                            }}
                          />
                        )}
                        <div
                          style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 800,
                            fontSize: '14px',
                            lineHeight: '18px',
                          }}
                        >
                          {p.nombre}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          {(p.tamanos || []).length > 0 ? 'Desde ' : ''}S/{' '}
                          {Number(p.precio || 0).toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DERECHA: Carrito del pedido */}
              <div
                style={{
                  flex: '2 1 340px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: 'var(--cp-white)',
                  border: '1.5px solid var(--cp-line)',
                  borderRadius: '14px',
                  padding: '14px',
                }}
              >
                {/* Cabecera del carrito: Mesa / Cambiar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--cp-line)',
                    paddingBottom: '8px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                    {modalidad === 'local' ? `Mesa: ${textoMesas}` : `Pedido: ${cliNombre}`}
                  </div>
                  {modalidad === 'local' && (
                    <button
                      type="button"
                      onClick={() => setPaso('plan')}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--cp-orange)',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar mesa
                    </button>
                  )}
                </div>

                {/* Lista de líneas */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {lineas.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Aún no agregas productos. Toca un producto de la izquierda para configurarlo.
                    </div>
                  ) : (
                    lineas.map((lin) => (
                      <div
                        key={lin.id}
                        style={{
                          border: '1px solid var(--cp-line)',
                          borderRadius: '10px',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          background: 'var(--cp-cream)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: '14px',
                          }}
                        >
                          <span>
                            {lin.cantidad} x {lin.nombre}
                          </span>
                          <span>S/ {lin.precioTotal.toFixed(2)}</span>
                        </div>
                        {lin.tamanoNombre && (
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                            {lin.tamanoNombre}
                          </div>
                        )}
                        {(lin.personas || []).length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                            Para: {lin.personas?.join(', ')}
                          </div>
                        )}
                        {lin.nota && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)' }}>
                            Nota: {lin.nota}
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, -1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '14px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              −
                            </button>
                            <span style={{ fontWeight: 800, fontSize: '13px' }}>
                              {lin.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '14px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarLinea(lin.id)}
                            style={{
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
                    ))
                  )}
                </div>

                {/* Cupón */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={cuponInput}
                    onChange={(e) => setCuponInput(e.target.value)}
                    placeholder="Código de cupón (opcional)"
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAplicarCupon}
                    style={{
                      minHeight: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Aplicar
                  </button>
                </div>
                {cuponError && (
                  <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                    {cuponError}
                  </div>
                )}
                {cuponAplicado && (
                  <div style={{ fontSize: '12px', color: 'var(--cp-green)', fontWeight: 700 }}>
                    Cupón {cuponAplicado.codigo} aplicado: - S/{' '}
                    {cuponAplicado.descuento.toFixed(2)}
                  </div>
                )}

                {/* Totales */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    borderTop: '1px solid var(--cp-line)',
                    paddingTop: '8px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>S/ {subtotal.toFixed(2)}</span>
                  </div>
                  {descuento > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                      }}
                    >
                      <span>Descuento</span>
                      <span>- S/ {descuento.toFixed(2)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '16px',
                      borderTop: '1px dashed var(--cp-line)',
                      paddingTop: '6px',
                    }}
                  >
                    <span>Total</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botón Enviar a cocina */}
                <button
                  type="button"
                  disabled={lineas.length === 0 || mesasSeleccionadas.length === 0}
                  onClick={() => setConfirmarEnviar(true)}
                  aria-label="Enviar directo a cocina"
                  style={{
                    minHeight: '52px',
                    border: 0,
                    borderRadius: '12px',
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '15px',
                    opacity: lineas.length > 0 && mesasSeleccionadas.length > 0 ? 1 : 0.5,
                    cursor:
                      lineas.length > 0 && mesasSeleccionadas.length > 0
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  Enviar directo a cocina · S/ {total.toFixed(2)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ventana de Opciones de Producto */}
      {productoSeleccionado && (
        <VentanaOpcionesProducto
          producto={productoSeleccionado}
          alCerrar={() => setProductoSeleccionado(null)}
          alAgregar={handleAgregarProductoConfigurado}
        />
      )}

      {/* Diálogo Confirmar Enviar Pedido */}
      <Confirmar
        abierto={confirmarEnviar}
        titulo="¿Enviar pedido directo a cocina?"
        mensaje={`Se enviarán los productos para la mesa ${textoMesas}. Comenzará su preparación en cocina y se descontará el stock.`}
        textoConfirmar="Sí, enviar comanda"
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={handleEnviarPedido}
        alCancelar={() => setConfirmarEnviar(false)}
      />

      {/* Modal Liberar Mesa si se activa en modo free */}
      {mesaParaLiberar && (
        <ModalLiberarMesa
          abierto={true}
          mesa={mesaParaLiberar}
          alCerrar={() => setMesaParaLiberar(null)}
          alLiberar={async (_mesaId: string, motivo: string) => {
            await salonApi.liberarMesaManual(mesaParaLiberar.id, motivo);
            setMesaParaLiberar(null);
            await alRefrescarMesas?.();
          }}
        />
      )}
    </>
  );
}
