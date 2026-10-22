import { useState } from 'react';
import type { HistorialComanda } from './cocinaTipos';
import { devolverComanda } from './cocinaApi';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';

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
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '--:--';
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
      aria-label="Historial del día en cocina"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Lo despejado hoy en {nombreAreaActual || 'esta área'}, con la hora en que
        llegó y en que se despejó. Si se despejó por error, devuélvelo a la
        pantalla.
      </div>

      {error && <EstadoError mensaje={error} alReintentar={alReintentar} />}
      {errorAccion && <EstadoError mensaje={errorAccion} />}

      {historial.length === 0 ? (
        <EstadoVacio
          titulo="Sin pedidos despejados"
          mensaje="Todavía no se despejó ninguna comanda hoy en esta área."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {historial.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minWidth: '240px',
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '16px',
                    color: 'var(--cp-navy)',
                    minWidth: '90px',
                  }}
                >
                  {item.ticket || item.codigo}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                    {item.lineas.map((l, idx) => (
                      <span key={l.id || idx}>
                        <b>{l.cantidad}×</b> {l.nombre}
                        {idx < item.lineas.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Llegó: {formatearHora(item.llego_en)} · Despejado:{' '}
                    {formatearHora(item.despejada_en)} ({item.tiempoPreparacionMin}{' '}
                    min de preparación)
                    {item.areaNombre && ` · ${item.areaNombre}`}
                  </div>
                </div>
              </div>

              <Boton
                variante="secundario"
                onClick={() => setComandaParaDevolver(item)}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                Devolver a la pantalla
              </Boton>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación para Devolver comanda */}
      <Confirmar
        abierto={Boolean(comandaParaDevolver)}
        titulo={`¿Devolver comanda ${comandaParaDevolver?.ticket || comandaParaDevolver?.codigo} a la pantalla?`}
        mensaje="Volverá a aparecer como pendiente en la pantalla de cocina. Si el pedido ya estaba en estado listo, regresará a cocina."
        textoSi="Sí, devolver"
        textoNo="No, cancelar"
        peligro
        cargando={devolviendo}
        alConfirmar={ejecutarDevolucion}
        alCancelar={() => setComandaParaDevolver(null)}
      />
    </section>
  );
}
