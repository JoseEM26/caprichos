import { useCallback, useEffect, useState } from 'react';
import { pedidosApi, type PedidoProgramado } from './pedidosApi';
import { textoProgramado } from '../salon/componentes/paraCuando';

export interface PanelProgramadosProps {
  /** Permiso de cambiar pedidos (pedidos/cambiar_estado): sin él no hay botón «Pasar a cocina ahora». */
  puedePasar: boolean;
  alActualizar: () => void;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Lista «Programados»: pedidos para otro día que aún no entran a cocina ni a reparto. Pasan solos a su hora de aviso;
 * aquí se ve lo adelantado y el saldo, y se pueden pasar a cocina antes de tiempo.
 */
export function PanelProgramados({ puedePasar, alActualizar }: PanelProgramadosProps) {
  const [lista, setLista] = useState<PedidoProgramado[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setLista(await pedidosApi.listarProgramados());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los pedidos programados');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pasarAhora = async (p: PedidoProgramado) => {
    try {
      await pedidosApi.cambiarEstado(p.id, 'COLA');
      await cargar();
      alActualizar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo pasar el pedido a cocina');
    }
  };

  return (
    <section aria-label="Pedidos programados" data-testid="panel-programados">
      <h2>Programados</h2>
      {error && <p role="alert">{error}</p>}
      {lista === null && !error && <p>Cargando…</p>}
      {lista?.length === 0 && <p>No hay pedidos programados.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {(lista ?? []).map((p) => (
          <li key={p.id} data-testid="fila-programado" style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: 10 }}>
            <strong>{p.codigo}</strong> · {p.clienteNombre ?? 'Cliente'} · {p.modalidad === 'DELIVERY' ? 'Delivery' : p.modalidad === 'MESA' ? 'Comer en local' : 'Recoger'}
            <div>Para {textoProgramado(p.programadoPara)}</div>
            <div>
              Total {soles(p.total)} · Adelanto {soles(p.adelanto)} · Saldo {soles(p.saldo)}
            </div>
            {puedePasar && (
              <button type="button" onClick={() => void pasarAhora(p)}>
                Pasar a cocina ahora
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
