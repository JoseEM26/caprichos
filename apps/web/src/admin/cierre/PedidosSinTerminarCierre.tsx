import { useState } from 'react';
import { ModalAnular } from '../pedidos/ModalAnular';
import { pedidosApi } from '../pedidos/pedidosApi';
import { ErrorApi } from '../../comun/api';
import type { PendienteCobro } from './cierreApi';
import './pendientes-cierre.css';

export const MOTIVO_SIN_TERMINAR_MIN = 10;

const ETIQUETA_ESTADO: Record<string, string> = {
  COLA: 'En cola',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
};
const PUEDE_ANULAR = ['COLA', 'PREPARANDO', 'LISTO'];
const ENLACE = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;

/** Entregar tiene sentido solo al final del camino: Listo (no delivery) o En camino (delivery) */
const puedeEntregar = (p: PendienteCobro) => (p.modalidad === 'DELIVERY' ? p.estado === 'EN_CAMINO' : p.estado === 'LISTO');

const soles = (v: number) => `S/ ${Number(v || 0).toFixed(2)}`;

export interface PedidosSinTerminarCierreProps {
  pedidos: PendienteCobro[];
  setPedidos: (lista: PendienteCobro[]) => void;
  alCambiar: () => void;
  esAdmin?: boolean;
  motivo?: string;
  alJustificar?: (motivo: string) => void;
}

/**
 * Pedidos de cualquier día que no están Entregados ni Anulados (aunque estén pagados): impiden cerrar la caja.
 * Cada uno se entrega o se anula; el administrador puede cerrar escribiendo un motivo (queda auditado).
 */
export function PedidosSinTerminarCierre({ pedidos, setPedidos, alCambiar, esAdmin = false, motivo = '', alJustificar }: PedidosSinTerminarCierreProps) {
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [anular, setAnular] = useState<PendienteCobro | null>(null);

  const quitar = (id: number) => setPedidos(pedidos.filter((p) => p.id !== id));

  const entregar = async (p: PendienteCobro) => {
    setError('');
    setOcupado(p.id);
    try {
      await pedidosApi.cambiarEstado(p.id, 'ENTREGADO');
      quitar(p.id);
      alCambiar();
    } catch (err: unknown) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo marcar como entregado.');
    } finally {
      setOcupado(null);
    }
  };

  if (pedidos.length === 0) return null;

  return (
    <section className="pdc-panel" aria-label="Pedidos sin terminar" data-testid="pedidos-sin-terminar">
      <div className="pdc-titulo">Pedidos sin terminar: impiden cerrar la caja</div>
      <p style={{ margin: 0, fontSize: 12 }}>
        Estos pedidos no están entregados ni anulados, aunque ya estén pagados. Entrégalos o anúlalos.
      </p>
      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      <div className="pdc-lista">
        {pedidos.map((p) => (
          <div className="pdc-fila" key={p.id}>
            <span className="pdc-codigo">{p.codigo}</span>
            <span className={p.clienteNombre ? 'pdc-cliente' : 'pdc-cliente pdc-sin-nombre'}>{p.clienteNombre || 'Sin nombre'}</span>
            <span className="pdc-meta">
              <span>{p.modalidad}</span>
              <span>{ETIQUETA_ESTADO[p.estado] ?? p.estado}</span>
              <span>{p.pagoEstado === 'PAGADO' ? 'Pagado' : 'Sin pagar'}</span>
            </span>
            <span className="pdc-total">{soles(p.total)}</span>
            <span className="pdc-acciones">
              <a className="pdc-boton pdc-boton-secundario" style={ENLACE} href={`/admin/caja?pedido=${p.id}`}>
                Ver pedido
              </a>
              {p.modalidad === 'DELIVERY' && (
                <a className="pdc-boton pdc-boton-secundario" style={ENLACE} href="/admin/repartos">
                  Ir a Repartos
                </a>
              )}
              {puedeEntregar(p) && (
                <button type="button" className="pdc-boton pdc-boton-primario" disabled={ocupado === p.id} onClick={() => entregar(p)}>
                  Entregar
                </button>
              )}
              {PUEDE_ANULAR.includes(p.estado) && (
                <button type="button" className="pdc-boton pdc-boton-peligro" onClick={() => setAnular(p)}>
                  Anular con motivo
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {esAdmin && alJustificar && (
        <div className="pdc-justificar" role="group" aria-label="Justificar pedidos sin terminar">
          {motivo ? (
            <>
              <span>Justificación para cerrar: <b>{motivo}</b></span>
              <button type="button" className="pdc-boton pdc-boton-secundario" onClick={() => alJustificar('')}>
                Quitar justificación
              </button>
            </>
          ) : (
            <>
              <label>
                Cerrar con estos pedidos sin terminar (motivo, mínimo {MOTIVO_SIN_TERMINAR_MIN} letras)
                <input type="text" value={borrador} maxLength={300} onChange={(e) => setBorrador(e.target.value)} />
              </label>
              <button
                type="button"
                className="pdc-boton pdc-boton-oscuro"
                disabled={borrador.trim().length < MOTIVO_SIN_TERMINAR_MIN}
                onClick={() => alJustificar(borrador.trim())}
              >
                Justificar sin terminar y permitir el cierre
              </button>
            </>
          )}
        </div>
      )}

      {anular && (
        <ModalAnular
          pedidoId={anular.id}
          codigoPedido={anular.codigo}
          alCerrar={() => setAnular(null)}
          alAnularExitoso={() => {
            quitar(anular.id);
            setAnular(null);
            alCambiar();
          }}
        />
      )}
    </section>
  );
}
