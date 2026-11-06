import { useState } from 'react';
import type { HistorialComanda } from './cocinaTipos';
import { devolverComanda } from './cocinaApi';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';
import { NumeroDia } from './TiempoEspera';

export interface HistorialViewProps {
  historial: HistorialComanda[];
  nombreAreaActual: string;
  alDevolverExito: () => void;
  error?: string | null;
  alReintentar?: () => void;
}

export function HistorialView({
  historial,
  nombreAreaActual,
  alDevolverExito,
  error,
  alReintentar,
}: HistorialViewProps) {
  const [comandaParaDevolver, setComandaParaDevolver] =
    useState<HistorialComanda | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const formatearHora = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  const ejecutarDevolucion = async () => {
    if (!comandaParaDevolver) return;
    try {
      setDevolviendo(true);
      setErrorAccion(null);
      await devolverComanda(
        comandaParaDevolver.pedidoId,
        comandaParaDevolver.areaId,
      );
      setComandaParaDevolver(null);
      alDevolverExito();
    } catch (err: any) {
      setErrorAccion(err?.message || 'No se pudo devolver la comanda');
      setComandaParaDevolver(null);
    } finally {
      setDevolviendo(false);
    }
  };

  return (
    <section
      aria-label="Despejadas hoy en cocina"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Lo que cocina ya despejó hoy en {nombreAreaActual || 'esta área'}, con la
        hora en que llegó y en que se despejó. Aquí no hay nada que aceptar: el
        pedido pasa a listo cuando todas sus áreas despejan y el mozo o reparto
        lo recoge. Si se despejó por error, devuélvelo a la pantalla.
      </div>

      {error && <EstadoError mensaje={error} alReintentar={alReintentar} />}
      {errorAccion && <EstadoError mensaje={errorAccion} />}

      {historial.length === 0 ? (
        <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '16px 0' }}>
          Todavía no se despejó nada hoy.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {historial.map((h) => {
            const itemsStr =
              h.lineas && h.lineas.length > 0
                ? h.lineas
                    .map((l) => `${l.cantidad}× ${l.nombre}`)
                    .join(', ')
                : 'Pedido';

            const horaLlego = formatearHora(h.llego_en);
            const horaDespejo = formatearHora(h.despejada_en);
            const minsPrep =
              h.tiempoPreparacionMin !== undefined
                ? ` (${h.tiempoPreparacionMin} min de preparación)`
                : '';

            return (
              <div
                key={h.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1.5px solid var(--cp-line)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(11, 44, 62, 0.04)',
                }}
              >
                <NumeroDia numero={h.numeroDia} />
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    minWidth: '90px',
                    fontSize: '16px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  {h.ticket || h.codigo}
                </span>

                <span
                  style={{
                    flex: '1 1 240px',
                    minWidth: 0,
                    fontSize: '13px',
                    lineHeight: '1.4',
                    color: 'var(--cp-navy)',
                  }}
                >
                  <strong style={{ fontWeight: 700 }}>{itemsStr}</strong>
                  {h.areaNombre ? ` · ${h.areaNombre}` : ''}
                  <br />
                  <span style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>
                    Llegó {horaLlego} · despejado {horaDespejo}
                    {minsPrep}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setComandaParaDevolver(h)}
                  disabled={devolviendo}
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
                  Devolver a la pantalla
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Confirmar
        abierto={!!comandaParaDevolver}
        titulo={`¿Devolver comanda ${
          comandaParaDevolver?.ticket || comandaParaDevolver?.codigo
        } a la pantalla?`}
        mensaje={`Vuelve a aparecer en ${
          comandaParaDevolver?.areaNombre || 'cocina'
        } como pendiente en su lugar por hora de llegada. Úsalo si se despejó por error.`}
        textoConfirmar="Sí, devolver"
        textoNo="No, cancelar"
        alConfirmar={ejecucionDevolucionWrapper}
        alCancelar={() => setComandaParaDevolver(null)}
      />
    </section>
  );

  function ejecucionDevolucionWrapper() {
    ejecutarDevolucion();
  }
}
