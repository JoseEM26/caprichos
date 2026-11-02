import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { ErrorApi } from '../../../comun/api';
import { despacharPedido } from '../../cocina/cocinaApi';
import { ProgresoPedido } from '../ProgresoPedido';
import { salonApi } from '../api';
import type { MesaSalon, ProductoProgreso } from '../tipos';
import { ModalForzarLiberarMesa } from './ModalForzarLiberarMesa';
import { nombreMesaSalon } from './CambioDeMesa';

export interface VistaPreviaMesaProps {
  mesa: MesaSalon;
  /** Permiso mesas/liberar: muestra «Forzar liberación» */
  puedeForzar: boolean;
  alCerrar: () => void;
  /** Omitidos en Nuevo pedido: solo quedan Forzar liberación y Cerrar */
  alAbrirCuenta?: (mesa: MesaSalon) => void;
  alCambiarMesa?: (mesa: MesaSalon) => void;
  /** Tras forzar la liberación: el padre recarga el salón */
  alCambiar: () => void;
  /** Permiso cocina/despachar: muestra «Despachar» por producto listo y «Despachar todo lo listo» */
  puedeDespachar?: boolean;
}

/** Un producto con unidades listas que aún no salieron (con su línea para despachar). */
interface ListoParaEntregar extends ProductoProgreso {
  lineaId: string;
  pendientes: number;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Minutos desde que se tomó el pedido (0 si no se sabe). */
function minutosDesde(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Vista previa de una mesa ocupada (mantener 2 s en el croquis): quién, cuánto, qué pidió y qué falta.
 * Desde aquí se abre la cuenta, se cambia de mesa y, con permiso, se fuerza la liberación.
 */
export function VistaPreviaMesa({
  mesa,
  puedeForzar,
  alCerrar,
  alAbrirCuenta,
  alCambiarMesa,
  alCambiar,
  puedeDespachar = false,
}: VistaPreviaMesaProps) {
  const [forzando, setForzando] = useState(false);
  // Despacho (Sí/No, irreversible): una línea con sus unidades, o todo lo listo (sin línea)
  const [despachoPendiente, setDespachoPendiente] = useState<{ linea?: ListoParaEntregar } | null>(null);
  const [despachando, setDespachando] = useState(false);
  const [errorDespacho, setErrorDespacho] = useState<string | null>(null);
  const pedido = mesa.pedido;
  const listos: ListoParaEntregar[] = (pedido?.progreso?.areas ?? []).flatMap((a) =>
    (a.productos ?? [])
      .filter((p): p is ProductoProgreso & { lineaId: string } => !!p.lineaId)
      .map((p) => ({ ...p, pendientes: Math.max(0, (p.listas ?? 0) - (p.despachadas ?? 0)) }))
      .filter((p) => p.pendientes > 0),
  );

  const confirmarDespacho = async () => {
    if (!pedido) return;
    const linea = despachoPendiente?.linea;
    setDespachando(true);
    setErrorDespacho(null);
    try {
      await despacharPedido(
        pedido.id,
        linea ? [{ lineaId: linea.lineaId, unidades: linea.pendientes }] : undefined,
      );
      setDespachoPendiente(null);
      alCambiar();
    } catch (err) {
      setErrorDespacho(err instanceof ErrorApi ? err.message : 'No se pudo despachar');
      setDespachoPendiente(null);
    } finally {
      setDespachando(false);
    }
  };
  const nombre = nombreMesaSalon(mesa);
  const mins = minutosDesde(pedido?.creadoEn);
  const cliente = pedido?.cliente || null;
  const mozo = pedido?.mozo || null;

  return (
    <>
      <div
        className="salon-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 84,
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
          aria-label={`Vista previa de ${nombre}`}
          className="salon-panel"
          style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--cp-line)' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
              }}
            >
              {nombre}
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
              {cliente ?? mozo ?? 'Sin nombre'}
              {mozo && cliente ? ` · Mozo: ${mozo}` : ''}
              {mins !== null ? ` · Pidió hace ${mins} min` : ''}
            </div>
          </div>

          <div style={{ padding: '14px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pedido?.progreso && <ProgresoPedido progreso={pedido.progreso} modalidad="MESA" variante="completo" />}

            {puedeDespachar && listos.length > 0 && (
              <div
                data-testid="vista-previa-despachar"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--cp-line)', paddingTop: '10px' }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cp-navy)' }}>Listo para entregar</div>
                {listos.map((p) => (
                  <div key={p.lineaId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, fontSize: '14px', color: 'var(--cp-navy)' }}>
                      {`${p.pendientes} × ${p.nombre}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDespachoPendiente({ linea: p })}
                      aria-label={`Despachar ${p.pendientes} de ${p.nombre}`}
                      style={{
                        minHeight: '44px',
                        minWidth: '44px',
                        padding: '0 12px',
                        border: 0,
                        borderRadius: '10px',
                        background: 'var(--cp-navy)',
                        color: 'var(--cp-white)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Despachar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDespachoPendiente({})}
                  style={{
                    minHeight: '44px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '12px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Despachar todo lo listo
                </button>
              </div>
            )}
            {errorDespacho && (
              <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                {errorDespacho}
              </div>
            )}

            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--cp-navy)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(pedido?.lineas ?? []).map((l, i) => (
                <li key={i}>
                  <strong>
                    {l.cantidad} x {l.nombre}
                  </strong>
                  {(l.detalle || (l.opciones && l.opciones.length > 0)) && (
                    <span style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>
                      {' '}
                      {[l.detalle, ...(l.opciones ?? [])].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-navy)' }}>
              Total {soles(Number(pedido?.total ?? 0))}
            </div>
            {pedido?.codigo && <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Pedido {pedido.codigo}</div>}
          </div>

          <div
            style={{
              padding: '12px 22px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              background: 'var(--cp-cream)',
            }}
          >
            {alAbrirCuenta && (
              <Boton variante="primario" onClick={() => alAbrirCuenta(mesa)} disabled={!pedido}>
                Abrir cuenta
              </Boton>
            )}
            {alCambiarMesa && (
              <Boton variante="secundario" onClick={() => alCambiarMesa(mesa)} disabled={!pedido}>
                Cambiar de mesa
              </Boton>
            )}
            {puedeForzar && (
              <Boton variante="peligro" onClick={() => setForzando(true)}>
                Forzar liberación
              </Boton>
            )}
            <Boton variante="texto" onClick={alCerrar}>
              Cerrar
            </Boton>
          </div>
        </div>
      </div>

      <Confirmar
        abierto={!!despachoPendiente}
        titulo="Despachar"
        mensaje={
          despachoPendiente?.linea
            ? `Se despachan ${despachoPendiente.linea.pendientes} de ${despachoPendiente.linea.nombre}. No se puede deshacer. ¿Despachar?`
            : 'Se despacha todo lo listo de esta mesa. No se puede deshacer. ¿Despachar?'
        }
        textoConfirmar="Sí, despachar"
        textoNo="No"
        cargando={despachando}
        alConfirmar={confirmarDespacho}
        alCancelar={() => setDespachoPendiente(null)}
      />

      {forzando && (
        <ModalForzarLiberarMesa
          mesa={mesa}
          alCerrar={() => setForzando(false)}
          alForzar={async (mesaId, motivo) => {
            await salonApi.liberarMesaManual(mesaId, motivo, true);
            setForzando(false);
            alCerrar();
            alCambiar();
          }}
        />
      )}
    </>
  );
}
