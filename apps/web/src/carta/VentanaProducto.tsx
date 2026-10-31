import { useState } from 'react';
import { useEsMovil } from './useEsMovil';
import { alternarEleccion } from './eleccionGrupo';
import { calcularPrecioLinea } from '@caprichos/compartido';
import {
  GrupoOpcionesCarta,
  OpcionCarta,
  OpcionElegida,
  ProductoCarta,
  TamanoCarta,
  UnidadPersonalizada,
} from './tipos';
import { useCarrito } from './CarritoContext';

interface VentanaProductoProps {
  producto: ProductoCarta;
  onCerrar: () => void;
}

export function VentanaProducto({ producto, onCerrar }: VentanaProductoProps) {
  const { agregarLinea } = useCarrito();

  // Tamaño seleccionado (por defecto el primero si existen)
  const [tamanoSeleccionado, setTamanoSeleccionado] = useState<TamanoCarta | null>(
    producto.tamanos && producto.tamanos.length > 0 ? producto.tamanos[0] : null,
  );

  // Cantidad total (mínimo 1)
  const [cantidad, setCantidad] = useState(1);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const movil = useEsMovil();

  // Unidad activa para visualización si cantidad > 1 (0-indexed)
  const [unidadActivaIndex, setUnidadActivaIndex] = useState(0);

  // Estado de personalización por cada unidad (DT-62):
  // Cada elemento contiene { persona: string, opciones: OpcionElegida[] }
  const [unidades, setUnidades] = useState<UnidadPersonalizada[]>([
    { persona: '', opciones: [] },
  ]);

  // Nota general para cocina
  const [nota, setNota] = useState('');

  // Mensaje de validación visible
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Actualizar arreglo de unidades cuando cambia la cantidad
  const cambiarCantidad = (nuevaCantidad: number) => {
    if (nuevaCantidad < 1) return;
    setErrorValidacion(null);
    setCantidad(nuevaCantidad);
    setUnidades((prev) => {
      const copia = [...prev];
      if (nuevaCantidad > copia.length) {
        // Clonar la configuración de la primera unidad para las nuevas
        const baseOpciones = copia[0]?.opciones ? [...copia[0].opciones] : [];
        while (copia.length < nuevaCantidad) {
          copia.push({
            persona: '',
            opciones: [...baseOpciones],
          });
        }
      } else if (nuevaCantidad < copia.length) {
        copia.splice(nuevaCantidad);
      }
      return copia;
    });

    if (unidadActivaIndex >= nuevaCantidad) {
      setUnidadActivaIndex(nuevaCantidad - 1);
    }
  };

  // Alternar selección de una opción en una unidad específica
  const alternarOpcionEnUnidad = (
    indexUnidad: number,
    grupo: GrupoOpcionesCarta,
    opcion: OpcionCarta,
  ) => {
    setErrorValidacion(null);
    setUnidades((prev) => {
      const copia = prev.map((u, idx) => {
        if (idx !== indexUnidad) return u;

        // Elegidas de este grupo; la regla de elección (reemplazar, quitar, tope) vive en alternarEleccion
        const delGrupo = u.opciones.filter((o) => o.grupoId === grupo.id).map((o) => o.id);
        const nuevas = alternarEleccion(grupo, delGrupo, opcion.id);

        return {
          ...u,
          opciones: [
            ...u.opciones.filter((o) => o.grupoId !== grupo.id),
            ...grupo.opciones
              .filter((go) => nuevas.includes(go.id))
              .map((go): OpcionElegida => ({
                id: go.id,
                nombre: go.nombre,
                precioExtra: go.precioExtra,
                grupoId: grupo.id,
                grupoNombre: grupo.nombre,
              })),
          ],
        };
      });

      return copia;
    });
  };

  const cambiarNombrePersona = (indexUnidad: number, nombre: string) => {
    setUnidades((prev) =>
      prev.map((u, idx) => (idx === indexUnidad ? { ...u, persona: nombre } : u)),
    );
  };

  // Copiar opciones de la unidad activa a todas las demás
  const copiarOpcionesATodas = (indexOrigen: number) => {
    const origen = unidades[indexOrigen];
    if (!origen) return;
    setUnidades((prev) =>
      prev.map((u, idx) =>
        idx === indexOrigen ? u : { ...u, opciones: [...origen.opciones] },
      ),
    );
  };

  // Precio base según tamaño o precio de producto
  const precioBase = tamanoSeleccionado
    ? tamanoSeleccionado.precio
    : producto.precio;

  // Cálculo en vivo usando packages/compartido
  const calculosPorUnidad = unidades.map((u) => {
    return calcularPrecioLinea({
      precioBase,
      opciones: u.opciones,
      cantidad: 1,
    });
  });

  const precioTotalAcumulado = Number(
    calculosPorUnidad.reduce((acc, c) => acc + c.subtotal, 0).toFixed(2),
  );

  // Validación de grupos obligatorios y límites min/max
  const validarOpciones = (): string | null => {
    if (!producto.grupos || producto.grupos.length === 0) return null;

    for (let uIdx = 0; uIdx < unidades.length; uIdx++) {
      const u = unidades[uIdx];
      const sufijoUnidad = cantidad > 1 ? ` (en la unidad ${uIdx + 1})` : '';

      for (const grupo of producto.grupos) {
        const elegidasGrupo = u.opciones.filter((o) => o.grupoId === grupo.id);

        if (grupo.obligatorio && elegidasGrupo.length === 0) {
          return `El grupo "${grupo.nombre}" es obligatorio${sufijoUnidad}. Por favor selecciona una opción.`;
        }

        if (elegidasGrupo.length < grupo.minimo) {
          return `El grupo "${grupo.nombre}" requiere al menos ${grupo.minimo} opción(es)${sufijoUnidad}.`;
        }

        if (elegidasGrupo.length > grupo.maximo) {
          return `El grupo "${grupo.nombre}" permite como máximo ${grupo.maximo} opción(es)${sufijoUnidad}.`;
        }
      }
    }

    return null;
  };

  const manejarAgregar = () => {
    const error = validarOpciones();
    if (error) {
      setErrorValidacion(error);
      return;
    }

    // Si todas las unidades tienen las mismas opciones y no hay nombres diferenciados,
    // se puede mandar como 1 sola línea, o guardar las unidades completas.
    // Guardamos las unidades estructuradas para enviar al pedido en DT-62.
    const nombresPersonas = unidades.map((u) => u.persona?.trim() || '');

    agregarLinea({
      productoId: producto.id,
      nombre: producto.nombre,
      fotoUrl: producto.fotoUrl,
      tamanoId: tamanoSeleccionado?.id,
      tamanoNombre: tamanoSeleccionado?.nombre,
      precioBase,
      cantidad,
      opciones: unidades[0]?.opciones || [],
      personas: nombresPersonas,
      unidades,
      nota: nota.trim() || undefined,
      precioUnitario: calculosPorUnidad[0]?.precioUnitario || precioBase,
      subtotal: precioTotalAcumulado,
    });

    onCerrar();
  };

  const iniciales = producto.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const unidadActiva = unidades[unidadActivaIndex] || { persona: '', opciones: [] };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${producto.nombre}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(11, 44, 62, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(620px, 100%)',
          maxHeight: '92vh',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Cabecera / Imagen con botón cerrar */}
        <div style={{ position: 'relative', backgroundColor: 'var(--cp-sand)' }}>
          <button
            onClick={onCerrar}
            aria-label="Cerrar ventana de producto"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 2,
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              fontSize: '22px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {producto.fotoUrl ? (
            <button
              type="button"
              onClick={() => setFotoAmpliada(true)}
              aria-label={`Ampliar la foto de ${producto.nombre}`}
              style={{ position: 'relative', width: '100%', height: movil ? 210 : 280, border: 0, padding: 0, background: 'var(--cp-sand)', cursor: 'zoom-in', display: 'block', overflow: 'hidden' }}
            >
              <img
                src={producto.fotoUrl}
                alt=""
                aria-hidden="true"
                style={{ position: 'absolute', left: '-10%', top: '-10%', width: '120%', height: '120%', objectFit: 'cover', filter: 'blur(22px)', opacity: 0.55 }}
              />
              <img
                src={producto.fotoUrl}
                alt={producto.nombre}
                style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', margin: '0 auto' }}
              />
              <span
                aria-hidden="true"
                style={{ position: 'absolute', right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, background: 'rgba(11,44,62,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3 M11 8v6 M8 11h6" />
                </svg>
              </span>
            </button>
          ) : (
            <div
              style={{
                width: '100%',
                height: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '48px',
                color: 'var(--cp-soft)',
              }}
            >
              {iniciales}
            </div>
          )}
        </div>

        {/* Contenido scrolleable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Título, descripción y precio */}
          <div>
            <h2
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '24px',
                lineHeight: '30px',
                color: 'var(--cp-navy)',
              }}
            >
              {producto.nombre}
            </h2>
            {producto.descripcion && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '13px',
                  lineHeight: '18px',
                  color: 'var(--cp-soft)',
                }}
              >
                {producto.descripcion}
              </p>
            )}
            <div
              style={{
                marginTop: '10px',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '26px',
                color: 'var(--cp-rust)',
              }}
            >
              S/ {precioTotalAcumulado.toFixed(2)}
            </div>
          </div>

          {/* Tamaños como tarjetas si aplica */}
          {producto.tamanos && producto.tamanos.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  Tamaño
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--cp-navy)',
                    color: 'var(--cp-cream)',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                  }}
                >
                  OBLIGATORIO
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px',
                }}
              >
                {producto.tamanos.map((tam) => {
                  const estaSeleccionado = tamanoSeleccionado?.id === tam.id;
                  return (
                    <button
                      key={tam.id}
                      onClick={() => {
                        setTamanoSeleccionado(tam);
                        setErrorValidacion(null);
                      }}
                      style={{
                        minHeight: '56px',
                        borderRadius: '12px',
                        border: estaSeleccionado
                          ? '2px solid var(--cp-orange)'
                          : '1.5px solid var(--cp-line)',
                        backgroundColor: estaSeleccionado
                          ? 'var(--cp-white)'
                          : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        padding: '8px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        textAlign: 'left',
                        gap: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '7px',
                            border: '2px solid var(--cp-navy)',
                            backgroundColor: estaSeleccionado
                              ? 'var(--cp-orange)'
                              : 'transparent',
                            flex: 'none',
                          }}
                        />
                        {tam.nombre}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 800,
                          fontSize: '13px',
                          color: 'var(--cp-rust)',
                          paddingLeft: '20px',
                        }}
                      >
                        S/ {tam.precio.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cantidad selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--cp-white)',
              padding: '12px 16px',
              borderRadius: '14px',
              border: '1px solid var(--cp-line)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Cantidad
            </span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => cambiarCantidad(cantidad - 1)}
                disabled={cantidad <= 1}
                aria-label="Disminuir cantidad"
                style={{
                  width: '44px',
                  height: '44px',
                  border: 0,
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                −
              </button>
              <span
                style={{
                  minWidth: '32px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                }}
              >
                {cantidad}
              </span>
              <button
                onClick={() => cambiarCantidad(cantidad + 1)}
                aria-label="Aumentar cantidad"
                style={{
                  width: '44px',
                  height: '44px',
                  border: 0,
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '20px',
                  fontWeight: 800,
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* DT-62: Opción por unidad si cantidad > 1 */}
          {cantidad > 1 && (
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                border: '1.5px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '14px',
                    }}
                  >
                    Personaliza cada unidad (DT-62)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Elige opciones y nombre por cada vaso o porción
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copiarOpcionesATodas(unidadActivaIndex)}
                  style={{
                    minHeight: '36px',
                    padding: '0 10px',
                    border: '1px solid var(--cp-navy)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--cp-sand)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--cp-navy)',
                  }}
                >
                  Copiar a todas
                </button>
              </div>

              {/* Pestañas de unidades */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  marginBottom: '10px',
                }}
              >
                {unidades.map((u, idx) => {
                  const estaActiva = idx === unidadActivaIndex;
                  const personaLimpia = (u.persona || '').trim();
                  const label = personaLimpia
                    ? `Unidad ${idx + 1} (${personaLimpia})`
                    : `Unidad ${idx + 1}`;
                  return (
                    <button
                      key={idx}
                      onClick={() => setUnidadActivaIndex(idx)}
                      style={{
                        minHeight: '38px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: estaActiva
                          ? '1.5px solid var(--cp-orange)'
                          : '1px solid var(--cp-line)',
                        backgroundColor: estaActiva ? 'var(--cp-orange)' : 'var(--cp-sand)',
                        color: estaActiva ? '#FFFFFF' : 'var(--cp-navy)',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nombre de la persona para la unidad activa */}
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '12px',
            }}
          >
            <label
              htmlFor={`persona-unidad-${unidadActivaIndex}`}
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {cantidad > 1
                ? `¿Para quién es la Unidad ${unidadActivaIndex + 1}?`
                : '¿Para quién es?'}
            </label>
            <input
              id={`persona-unidad-${unidadActivaIndex}`}
              type="text"
              value={unidadActiva.persona}
              onChange={(e) => cambiarNombrePersona(unidadActivaIndex, e.target.value)}
              placeholder="Ej.: Lucía (vacío = se asigna tu nombre)"
              maxLength={30}
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-cream)',
                color: 'var(--cp-navy)',
                padding: '0 12px',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Grupos de opciones del producto */}
          {producto.grupos && producto.grupos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {producto.grupos.map((grupo) => {
                const seleccionadasEnGrupo = unidadActiva.opciones.filter(
                  (o) => o.grupoId === grupo.id,
                );

                const etiquetaGrupo = grupo.obligatorio
                  ? 'OBLIGATORIO'
                  : grupo.maximo > 1
                  ? `Hasta ${grupo.maximo}`
                  : 'OPCIONAL';

                return (
                  <div
                    key={grupo.id}
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '14px',
                      padding: '14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontFamily: 'var(--fuente-titulos)',
                            fontWeight: 800,
                            fontSize: '14px',
                          }}
                        >
                          {grupo.nombre}
                        </span>
                        {grupo.minimo > 1 && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--cp-soft)',
                              marginLeft: '6px',
                            }}
                          >
                            (Mínimo {grupo.minimo})
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: grupo.obligatorio
                            ? 'var(--cp-navy)'
                            : 'var(--cp-sand)',
                          color: grupo.obligatorio ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          borderRadius: '9999px',
                          padding: '2px 8px',
                        }}
                      >
                        {etiquetaGrupo}
                      </span>
                    </div>

                    {/* Chips de opciones */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {grupo.opciones.map((opcion) => {
                        const estaElegida = seleccionadasEnGrupo.some(
                          (o) => o.id === opcion.id,
                        );

                        return (
                          <button
                            key={opcion.id}
                            type="button"
                            onClick={() =>
                              alternarOpcionEnUnidad(unidadActivaIndex, grupo, opcion)
                            }
                            style={{
                              minHeight: '44px',
                              borderRadius: '9999px',
                              border: estaElegida
                                ? '2px solid var(--cp-orange)'
                                : '1.5px solid var(--cp-line)',
                              backgroundColor: estaElegida
                                ? 'var(--cp-sand)'
                                : 'var(--cp-white)',
                              color: 'var(--cp-navy)',
                              padding: '0 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: estaElegida ? 700 : 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: grupo.maximo === 1 ? '7px' : '3px',
                                border: '2px solid var(--cp-navy)',
                                backgroundColor: estaElegida
                                  ? 'var(--cp-orange)'
                                  : 'transparent',
                                flex: 'none',
                              }}
                            />
                            <span>{opcion.nombre}</span>
                            {opcion.precioExtra > 0 && (
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: 'var(--cp-rust)',
                                }}
                              >
                                +S/ {opcion.precioExtra.toFixed(2)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nota para cocina */}
          <div>
            <label
              htmlFor="nota-cocina"
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 700,
                fontSize: '14px',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Nota para cocina (opcional)
            </label>
            <input
              id="nota-cocina"
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: sin hielo, bien caliente, azúcar aparte"
              maxLength={120}
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-white)',
                color: 'var(--cp-navy)',
                padding: '0 12px',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Alerta de validación */}
          {errorValidacion && (
            <div
              role="alert"
              style={{
                backgroundColor: '#FDECEA',
                color: 'var(--cp-rust)',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: '18px',
              }}
            >
              {errorValidacion}
            </div>
          )}
        </div>

        {/* Barra inferior fija con botón de agregar */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--cp-white)',
            borderTop: '1px solid var(--cp-line)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={manejarAgregar}
            style={{
              flex: 1,
              minHeight: '48px',
              border: 0,
              borderRadius: '12px',
              backgroundColor: 'var(--cp-orange)',
              color: '#FFFFFF',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 18px',
            }}
          >
            <span>Agregar al pedido</span>
            <span>S/ {precioTotalAcumulado.toFixed(2)}</span>
          </button>
        </div>
      </div>
      {fotoAmpliada && producto.fotoUrl && (
        <div
          onClick={() => setFotoAmpliada(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,44,62,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}
        >
          <img src={producto.fotoUrl} alt={producto.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }} />
          <button
            onClick={() => setFotoAmpliada(false)}
            aria-label="Cerrar vista ampliada"
            style={{ position: 'absolute', top: 12, right: 12, width: 48, height: 48, borderRadius: 24, border: '1.5px solid var(--cp-cream)', background: 'transparent', color: 'var(--cp-cream)', fontSize: 22, fontWeight: 800 }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
