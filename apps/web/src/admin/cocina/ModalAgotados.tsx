import { useEffect, useState, useMemo } from 'react';
import type { AgotadoItem, DuracionAgotado, ItemCartaBuscable } from './cocinaTipos';
import {
  agotarElemento,
  buscarItemsDeCarta,
  listarAgotados,
  reactivarAgotado,
} from './cocinaApi';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { useSesion } from '../../comun/sesion';

export interface ModalAgotadosProps {
  abierto: boolean;
  alCerrar: () => void;
}

export function ModalAgotados({ abierto, alCerrar }: ModalAgotadosProps) {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [itemsCarta, setItemsCarta] = useState<ItemCartaBuscable[]>([]);
  const [agotadosVigentes, setAgotadosVigentes] = useState<AgotadoItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para confirmación de Agotar
  const [itemParaAgotar, setItemParaAgotar] = useState<{
    item: ItemCartaBuscable;
    duracion: DuracionAgotado;
  } | null>(null);
  const [guardandoAgotado, setGuardandoAgotado] = useState(false);

  // Estado para confirmación de Reactivar
  const [itemParaReactivar, setItemParaReactivar] = useState<AgotadoItem | null>(null);
  const [guardandoReactivar, setGuardandoReactivar] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [carta, agotados] = await Promise.all([
        buscarItemsDeCarta(),
        listarAgotados(),
      ]);
      setItemsCarta(carta);
      setAgotadosVigentes(agotados);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar carta o agotados');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      setTerminoBusqueda('');
      cargarDatos();
    }
  }, [abierto]);

  // Filtrado reactivo de items de carta
  const resultadosBusqueda = useMemo(() => {
    const q = terminoBusqueda.trim().toLowerCase();
    if (q.length < 2) return [];

    return itemsCarta
      .filter(
        (it) =>
          it.nombre.toLowerCase().includes(q) ||
          it.subtitulo.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [terminoBusqueda, itemsCarta]);

  // Manejador para confirmar Agotar
  const ejecutarAgotar = async () => {
    if (!itemParaAgotar) return;
    try {
      setGuardandoAgotado(true);
      await agotarElemento({
        tipo: itemParaAgotar.item.tipo,
        id: itemParaAgotar.item.id,
        duracion: itemParaAgotar.duracion,
      });
      setItemParaAgotar(null);
      // Recargar lista de agotados
      const actualizados = await listarAgotados();
      setAgotadosVigentes(actualizados);
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar como agotado');
      setItemParaAgotar(null);
    } finally {
      setGuardandoAgotado(false);
    }
  };

  // Manejador para confirmar Reactivar
  const ejecutarReactivar = async () => {
    if (!itemParaReactivar) return;
    try {
      setGuardandoReactivar(true);
      await reactivarAgotado(itemParaReactivar.id);
      setItemParaReactivar(null);
      // Recargar lista de agotados
      const actualizados = await listarAgotados();
      setAgotadosVigentes(actualizados);
    } catch (err: any) {
      setError(err?.message || 'No se pudo reactivar el elemento');
      setItemParaReactivar(null);
    } finally {
      setGuardandoReactivar(false);
    }
  };

  if (!abierto) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11, 44, 62, 0.6)',
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
          aria-label="Se acabó algo"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '680px',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            background: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera modal */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '22px',
                  color: 'var(--cp-navy)',
                  margin: 0,
                }}
              >
                Se acabó algo
              </h2>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                }}
              >
                Se apaga ahora en la carta y el chatbot y vuelve solo mañana.
                Escribe al menos 2 letras.
              </p>
            </div>

            <button
              onClick={alCerrar}
              aria-label="Cerrar"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '20px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {error && <EstadoError mensaje={error} alReintentar={cargarDatos} />}

          {/* Campo buscador */}
          <div>
            <label
              htmlFor="buscar-agotado-input"
              style={{
                fontWeight: 700,
                fontSize: '13px',
                display: 'block',
                marginBottom: '4px',
                color: 'var(--cp-navy)',
              }}
            >
              Buscar producto, sabor u opción
            </label>
            <input
              id="buscar-agotado-input"
              type="text"
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              placeholder="Ej.: lúcuma, chocolate, jamón, dona"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-navy)',
                background: 'var(--cp-white)',
                padding: '0 12px',
                fontFamily: 'inherit',
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            />
          </div>

          {/* Resultados de búsqueda */}
          {terminoBusqueda.trim().length >= 2 && resultadosBusqueda.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              No se encontró ningún producto, sabor u opción con ese nombre.
            </div>
          )}

          {resultadosBusqueda.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {resultadosBusqueda.map((item) => (
                <div
                  key={`${item.tipo}-${item.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '10px',
                    background: 'var(--cp-white)',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>
                      {item.nombre}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {item.subtitulo}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <Boton
                      variante="peligro"
                      onClick={() =>
                        setItemParaAgotar({ item, duracion: 'HOY' })
                      }
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: 'var(--cp-rust)',
                        color: 'var(--cp-white)',
                        border: 'none',
                      }}
                    >
                      Agotar hoy
                    </Boton>

                    {/* DT-85 / RQ-COC-03-05: Solo para rol ADMIN */}
                    {esAdmin && (
                      <Boton
                        variante="secundario"
                        data-testid="boton-hasta-reactivar"
                        onClick={() =>
                          setItemParaAgotar({
                            item,
                            duracion: 'HASTA_REACTIVAR',
                          })
                        }
                        style={{
                          minHeight: '44px',
                          padding: '0 12px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        Hasta que se reactive
                      </Boton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de agotados vigentes */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '4px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            >
              Agotados ahora ({agotadosVigentes.length})
            </div>

            {cargando && <Cargando mensaje="Cargando disponibilidad..." />}

            {!cargando && agotadosVigentes.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                Nada agotado por el momento.
              </div>
            )}

            {!cargando && agotadosVigentes.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {agotadosVigentes.map((ag) => {
                  const nombre =
                    ag.productoNombre ||
                    ag.saborNombre ||
                    ag.opcionNombre ||
                    `Item #${ag.id}`;
                  const tipoTexto = ag.tipo;
                  const duracionTexto =
                    ag.alcance === 'HOY'
                      ? 'Agotado por hoy'
                      : 'Agotado hasta que se reactive';

                  return (
                    <div
                      key={ag.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        borderBottom: '1px solid var(--cp-line)',
                        paddingBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>
                          {nombre}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--cp-rust)' }}>
                          {tipoTexto} · {duracionTexto}
                        </span>
                      </div>

                      <Boton
                        variante="secundario"
                        onClick={() => setItemParaReactivar(ag)}
                        style={{
                          minHeight: '44px',
                          padding: '0 14px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        Volver a ofrecer
                      </Boton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón cerrar modal */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Boton
              variante="secundario"
              onClick={alCerrar}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
              }}
            >
              Cerrar
            </Boton>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para Agotar */}
      <Confirmar
        abierto={Boolean(itemParaAgotar)}
        titulo="¿Marcar como agotado?"
        mensaje={
          itemParaAgotar
            ? `¿Deseas marcar "${itemParaAgotar.item.nombre}" como ${
                itemParaAgotar.duracion === 'HOY'
                  ? 'agotado por hoy (volverá mañana automáticamente)'
                  : 'agotado hasta que un administrador lo reactive'
              }? Se apagará al momento en la carta y el chatbot.`
            : ''
        }
        textoSi="Sí, agotar"
        textoNo="No, cancelar"
        peligro
        cargando={guardandoAgotado}
        alConfirmar={ejecutarAgotar}
        alCancelar={() => setItemParaAgotar(null)}
      />

      {/* Modal de confirmación para Reactivar */}
      <Confirmar
        abierto={Boolean(itemParaReactivar)}
        titulo="¿Volver a ofrecer?"
        mensaje={
          itemParaReactivar
            ? `¿Deseas volver a ofrecer "${
                itemParaReactivar.productoNombre ||
                itemParaReactivar.saborNombre ||
                itemParaReactivar.opcionNombre ||
                'este producto'
              }"? Volverá a estar disponible de inmediato en la carta y el chatbot.`
            : ''
        }
        textoSi="Sí, volver a ofrecer"
        textoNo="No, mantener agotado"
        cargando={guardandoReactivar}
        alConfirmar={ejecutarReactivar}
        alCancelar={() => setItemParaReactivar(null)}
      />
    </>
  );
}
