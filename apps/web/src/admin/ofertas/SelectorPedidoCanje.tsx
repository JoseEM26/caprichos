import { useEffect, useState } from 'react';
import { pedidosApi } from '../pedidos/pedidosApi';
import { parametrosDeRango, rangoHoy } from '../pedidos/filtroDias';
import { normalizarBusqueda } from '../../comun/normalizarBusqueda';

export interface PedidoElegible {
  id: string;
  codigo: string;
  /** Mesa o nombre del cliente */
  quien: string;
  total: number;
  estado: string;
}

const soles = (n: number) => `S/ ${Number(n).toFixed(2)}`;
const NO_ELEGIBLES = new Set(['ANULADO', 'RECHAZADO']);

/** Pedidos de hoy a los que aún se puede aplicar un cupón: ni anulados ni cobrados. */
export const esElegible = (p: { estado?: string | null; pago_estado?: string | null; pagoEstado?: string | null; cobroMozo?: unknown }) =>
  !NO_ELEGIBLES.has(String(p.estado ?? '')) && String(p.pago_estado ?? p.pagoEstado ?? '').toUpperCase() !== 'PAGADO' && !p.cobroMozo;

interface Props {
  /** Si viene (mozo), se busca entre estos; si no, se piden los pedidos de hoy al servidor (Caja). */
  candidatos?: PedidoElegible[];
  elegido: PedidoElegible | null;
  alElegir: (p: PedidoElegible) => void;
}

/** Paso «¿A qué pedido?»: busca por código, mesa o nombre entre los pedidos de hoy. */
export function SelectorPedidoCanje({ candidatos, elegido, alElegir }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PedidoElegible[]>(candidatos ?? []);
  const [cargando, setCargando] = useState(!candidatos);
  const [error, setError] = useState('');

  useEffect(() => {
    if (candidatos) return;
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await pedidosApi.listar({ ...parametrosDeRango(rangoHoy()), limite: 40, ...(q.trim() ? { buscar: q.trim() } : {}) });
        if (!vigente) return;
        setItems(
          (r.items ?? []).filter(esElegible).map((p) => ({ id: String(p.id), codigo: p.codigo, quien: p.mesa_nombre || p.cliente_nombre || 'Sin nombre', total: Number(p.total ?? 0), estado: String(p.estado) })),
        );
        setError('');
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar los pedidos de hoy');
      } finally {
        if (vigente) setCargando(false);
      }
    }, q ? 250 : 0);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, candidatos]);

  const nq = normalizarBusqueda(q);
  const visibles = (candidatos ? items.filter((p) => !nq || normalizarBusqueda(`${p.codigo} ${p.quien}`).includes(nq)) : items).slice(0, 30);

  return (
    <>
      <input
        type="search"
        aria-label="Buscar pedido"
        placeholder="Código, mesa o nombre"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 12, border: '1.5px solid var(--cp-line, #E3D6C6)', font: 'inherit' }}
      />
      {error && <div role="alert" className="mpp-error">{error}</div>}
      {cargando && <p role="status">Buscando…</p>}
      {!cargando && visibles.length === 0 && <p>No hay pedidos de hoy sin cobrar con ese dato.</p>}
      <ul role="listbox" aria-label="Pedidos de hoy" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {visibles.map((p) => (
          <li key={p.id} role="option" aria-selected={elegido?.id === p.id}>
            <button
              type="button"
              onClick={() => alElegir(p)}
              style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: '6px 12px', borderRadius: 12, border: `2px solid ${elegido?.id === p.id ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`, background: 'var(--cp-white, #fff)', font: 'inherit', cursor: 'pointer' }}
            >
              <b>{p.codigo}</b> · {p.quien} · {soles(p.total)}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
