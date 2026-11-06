import { useEffect, useId, useRef, useState } from 'react';
import { pedidosApi, Pedido } from '../pedidos/pedidosApi';

export const LIMITE_PEDIDOS = 12;

const ESTADOS: Record<string, string> = {
  COLA: 'En cola',
  PREPARANDO: 'Preparando',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};
const soles = (n: unknown) => `S/ ${Number(n ?? 0).toFixed(2)}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const quien = (p: Pedido) => p.cliente_nombre || p.mesa_nombre || 'Sin nombre';

interface Props {
  seleccionado: Pedido | null;
  alElegir: (p: Pedido | null) => void;
  /** Muestra (o limpia) un error de carga en el modal */
  alError: (mensaje: string | null) => void;
}

/** Combobox de pedidos: recientes al enfocar, filtra por código, cliente o mesa (máx. 12). */
export function SelectorPedidoCortesia({ seleccionado, alElegir, alError }: Props) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const idLista = useId();
  const peticion = useRef(0);

  useEffect(() => {
    if (!abierto) return;
    const n = ++peticion.current;
    const t = setTimeout(
      async () => {
        setCargando(true);
        try {
          const r = await pedidosApi.listar({ limite: LIMITE_PEDIDOS, ...(q.trim() ? { buscar: q.trim() } : {}) });
          if (n !== peticion.current) return;
          setItems((r.items ?? []).slice(0, LIMITE_PEDIDOS));
          setActivo(-1);
          alError(null);
        } catch (err: any) {
          if (n === peticion.current) alError(err?.mensaje || 'No se pudo cargar la lista de pedidos.');
        } finally {
          if (n === peticion.current) setCargando(false);
        }
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [q, abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (p: Pedido) => {
    alElegir(p);
    setAbierto(false);
    setDetalleId(null);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return setAbierto(true);
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActivo((a) => (items.length === 0 ? -1 : (a + d + items.length) % items.length));
    } else if (e.key === 'Enter' && abierto && activo >= 0 && items[activo]) {
      e.preventDefault();
      elegir(items[activo]);
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  };

  if (seleccionado) {
    return (
      <div className="cpx-elegido">
        <span>
          Pedido <b>{seleccionado.codigo}</b> · {quien(seleccionado)} · {hora(seleccionado.creado_en)}
        </span>
        <button type="button" className="cpx-link" onClick={() => alElegir(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="cpx-selector" onKeyDown={teclas}>
      <input
        className="cpx-input"
        role="combobox"
        aria-label="Pedido de referencia"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={activo >= 0 && items[activo] ? `${idLista}-${items[activo].id}` : undefined}
        placeholder="Busca por código (CP-…), cliente o mesa"
        value={q}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && (
        <div id={idLista} role="listbox" aria-label="Pedidos" className="cpx-lista">
          {cargando && items.length === 0 && <p className="cpx-vacio">Buscando…</p>}
          {!cargando && items.length === 0 && <p className="cpx-vacio">No encontramos pedidos con ese dato.</p>}
          {items.map((p, i) => (
            <div key={p.id}>
              <div className="cpx-par">
                <div
                  id={`${idLista}-${p.id}`}
                  role="option"
                  aria-selected={i === activo}
                  tabIndex={-1}
                  className={`cpx-fila cpx-pedido${i === activo ? ' cpx-activa' : ''}`}
                  onClick={() => elegir(p)}
                >
                  <b>{p.codigo}</b>
                  <span>{quien(p)}</span>
                  <small>
                    {hora(p.creado_en)} · {p.modalidad} · {ESTADOS[p.estado] ?? p.estado} · {soles(p.total)}
                  </small>
                </div>
                <button
                  type="button"
                  className="cpx-ojo"
                  aria-label={`Ver detalle de ${p.codigo}`}
                  aria-expanded={detalleId === p.id}
                  onClick={() => setDetalleId(detalleId === p.id ? null : p.id)}
                >
                  👁
                </button>
              </div>
              {detalleId === p.id && (
                <div className="cpx-detalle" role="region" aria-label={`Detalle de ${p.codigo}`}>
                  <ul>
                    {(p.lineas ?? []).map((l) => (
                      <li key={l.id}>
                        {l.cantidad} × {l.nombre}
                        {l.tamano ? ` (${l.tamano})` : ''} · {soles(l.subtotal)}
                      </li>
                    ))}
                  </ul>
                  <div>
                    Total {soles(p.total)} · {ESTADOS[p.estado] ?? p.estado} · Pago {p.pago_estado ?? 'sin dato'}
                    {p.pago_metodo ? ` (${p.pago_metodo})` : ''}
                  </div>
                  <div>
                    Atendió: {p.cobroMozo?.mozo ?? `canal ${p.canal}`} · {hora(p.creado_en)}
                  </div>
                </div>
              )}
            </div>
          ))}
          {items.length >= LIMITE_PEDIDOS && <p className="cpx-nota">Mostrando los {LIMITE_PEDIDOS} más recientes; escribe para afinar</p>}
        </div>
      )}
    </div>
  );
}
