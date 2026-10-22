import { useEffect, useState, useMemo } from 'react';
import type { AgotadoItem, DuracionAgotado, ItemCartaBuscable } from './cocinaTipos';
import {
  agotarElemento,
  buscarItemsDeCarta,
  listarAgotados,
  reactivarAgotado,
} from './cocinaApi';
import { Confirmar } from '../../comun/Confirmar';
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
  const [, setItemsCarta] = useState<ItemCartaBuscable[]>([]);
  const [itemsCartaFiltrar, setItemsCartaFiltrar] = useState<ItemCartaBuscable[]>([]);
  const [agotadosVigentes, setAgotadosVigentes] = useState<AgotadoItem[]>([]);
  const [, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemParaAgotar, setItemParaAgotar] = useState<{
    item: ItemCartaBuscable;
    duracion: DuracionAgotado;
  } | null>(null);
  const [, setGuardandoAgotado] = useState(false);

  const [itemParaReactivar, setItemParaReactivar] = useState<AgotadoItem | null>(null);
  const [, setGuardandoReactivar] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [carta, agotados] = await Promise.all([
        buscarItemsDeCarta(),
        listarAgotados(),
      ]);
      setItemsCarta(carta);
      setItemsCartaFiltrar(carta);
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

  const resultadosBusqueda = useMemo(() => {
    const q = terminoBusqueda.trim().toLowerCase();
    if (q.length < 2) return [];

    return itemsCartaFiltrar
      .filter(
        (it) =>
          it.nombre.toLowerCase().includes(q) ||
          it.subtitulo.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [terminoBusqueda, itemsCartaFiltrar]);

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
      const actualizados = await listarAgotados();
      setAgotadosVigentes(actualizados);
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar como agotado');
      setItemParaAgotar(null);
    } finally {
      setGuardandoAgotado(false);
    }
  };

  const ejecutarReactivar = async () => {
    if (!itemParaReactivar) return;
    try {
      setGuardandoReactivar(true);
      await reactivarAgotado(itemParaReactivar.id);
      setItemParaReactivar(null);
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
        aria-label="Se acabó algo"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--cp-navy)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '27px',
            }}
          >
            Se acabó algo
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

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Se apaga ahora en la carta y el chatbot y vuelve solo mañana. Escribe al
          menos 2 letras.
        </div>

        {error && <EstadoError mensaje={error} alReintentar={cargarDatos} />}

        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
          <label
            htmlFor="buscar-producto-input"
            style={{
              fontWeight: 700,
              fontSize: '13px',
              display: 'block',
              marginBottom: '4px',
              color: 'var(--cp-navy)',
            }}
          >
            Buscar producto
          </label>
          <input
            id="buscar-producto-input"
            type="text"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            placeholder="Ej.: lúcuma, club, dona"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '42px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 10px',
              fontFamily: 'inherit',
              fontSize: '14px',
              color: 'var(--cp-navy)',
            }}
          />
        </div>

        {terminoBusqueda.trim().length >= 2 && resultadosBusqueda.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            No se encontró nada.
          </div>
        )}

        {resultadosBusqueda.map((it) => (
          <div
            key={`${it.tipo}-${it.id}`}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid var(--cp-line)',
              borderRadius: '10px',
              background: 'var(--cp-white)',
              padding: '8px 10px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '14px' }}>
              <b>{it.nombre}</b> · {it.categoriaNombre || it.subtitulo}
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() =>
                  setItemParaAgotar({ item: it, duracion: 'HOY' })
                }
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: 0,
                  background: 'var(--cp-rust)',
                  color: 'var(--cp-white)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Agotar hoy
              </button>

              {esAdmin && (
                <button
                  type="button"
                  data-testid="boton-hasta-reactivar"
                  onClick={() =>
                    setItemParaAgotar({
                      item: it,
                      duracion: 'HASTA_REACTIVAR',
                    })
                  }
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-rust)',
                    background: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Agotar hasta reactivar
                </button>
              )}
            </div>
          </div>
        ))}

        <div
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
          <div style={{ fontWeight: 800 }}>Agotados ahora</div>
          {agotadosVigentes.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Nada agotado.
            </div>
          ) : (
            agotadosVigentes.map((ag) => {
              const nom =
                ag.nombre ||
                ag.productoNombre ||
                ag.saborNombre ||
                ag.opcionNombre ||
                'Elemento';
              return (
                <div
                  key={ag.id}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid var(--cp-sand)',
                    paddingBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>
                    <b>{nom}</b> ·{' '}
                    {ag.duracion === 'HOY' ? 'por hoy' : 'hasta reactivar'}
                    {ag.activado_por ? ` (${ag.activado_por})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemParaReactivar(ag)}
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
                    Volver a ofrecer
                  </button>
                </div>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={alCerrar}
          style={{
            minHeight: '52px',
            borderRadius: '12px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '15px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>

      <Confirmar
        abierto={!!itemParaAgotar}
        titulo={`¿Agotar "${itemParaAgotar?.item.nombre}"?`}
        mensaje={
          itemParaAgotar?.duracion === 'HOY'
            ? 'Dejará de ofrecerse de inmediato en la carta y el chatbot. Volverá a estar disponible automáticamente mañana.'
            : 'Dejará de ofrecerse de inmediato en la carta y el chatbot hasta que un administrador lo vuelva a activar manualmente.'
        }
        textoConfirmar="Sí, marcar agotado"
        textoNo="No, cancelar"
        alConfirmar={ejecutarAgotar}
        alCancelar={() => setItemParaAgotar(null)}
      />

      <Confirmar
        abierto={!!itemParaReactivar}
        titulo={`¿Volver a ofrecer "${
          itemParaReactivar?.nombre ||
          itemParaReactivar?.productoNombre ||
          itemParaReactivar?.saborNombre ||
          itemParaReactivar?.opcionNombre ||
          ''
        }"?`}
        mensaje="Volverá a aparecer inmediatamente en la carta y el chatbot."
        textoConfirmar="Sí, reactivar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarReactivar}
        alCancelar={() => setItemParaReactivar(null)}
      />
    </>
  );
}
