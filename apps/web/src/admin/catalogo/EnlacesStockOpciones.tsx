import { useEffect, useState } from 'react';
import { catalogoApi, RequisitosOpcionAdmin } from './catalogoApi';

interface FilaReq { productoId: string; saborId: string | null; cantidad: number }

/**
 * Enlace de cada opción con el stock real: qué producto (y sabor, si es por sabor) consume y cuántas unidades.
 * Ejemplo: «2 Donas» = 2 de DONAS ARTESANALES; «Crema pastelera» = 1 del sabor Crema pastelera de las donas.
 * Sin filas, la opción solo depende de «agotado» (como antes).
 */
export function EnlacesStockOpciones({ opciones }: { opciones: Array<{ id: string; nombre: string }> }) {
  const [elegida, setOpcionId] = useState('');
  const [buscar, setBuscar] = useState('');
  // Si la elegida ya no existe (o aún no se eligió, p. ej. los grupos cargaron después), vale la primera.
  const opcionId = opciones.some((o) => o.id === elegida) ? elegida : opciones[0]?.id ?? '';
  const visibles = opciones.filter((o) => o.id === opcionId || o.nombre.toLowerCase().includes(buscar.trim().toLowerCase()));
  const [datos, setDatos] = useState<RequisitosOpcionAdmin | null>(null);
  const [filas, setFilas] = useState<FilaReq[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!opcionId) return;
    let vivo = true;
    setError('');
    setAviso('');
    catalogoApi
      .requisitosOpcion(opcionId)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setFilas(d.requisitos.map((r) => ({ productoId: r.productoId, saborId: r.saborId, cantidad: r.cantidad })));
      })
      .catch(() => vivo && setError('No se pudo cargar el stock de esta opción.'));
    return () => {
      vivo = false;
    };
  }, [opcionId]);

  if (opciones.length === 0) return null;

  const productos = datos?.productos ?? [];
  const cambiarFila = (i: number, cambio: Partial<FilaReq>) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambio } : f)));

  const guardar = async () => {
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      const d = await catalogoApi.guardarRequisitosOpcion(opcionId, filas.filter((f) => f.productoId));
      setDatos(d);
      setAviso('Enlace de stock guardado.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el enlace de stock.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="eo-stock-opciones" aria-label="Enlace de opciones con el stock">
      <div className="eo-micro">
        Si una opción consume stock (p. ej. «2 Donas»), indica qué producto y cuántas unidades. Sin saldo, la opción queda agotada en la carta y en WhatsApp.
      </div>
      <div className="eo-stock-selector">
        <input className="eo-input" type="search" aria-label="Buscar opción" placeholder="Buscar opción…" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} />
        <label className="eo-stock-opcion">
          <span>Opción</span>
          <select className="eo-input" value={opcionId} onChange={(e) => setOpcionId(e.target.value)}>
            {visibles.map((o) => (
              <option key={o.id} value={o.id}>{o.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {filas.length === 0 && <div className="eo-micro">Esta opción no consume stock: solo depende de «agotado».</div>}
      <div className="eo-opciones">
        {filas.map((f, i) => {
          const prod = productos.find((p) => p.id === f.productoId);
          return (
            <div key={i} className="eo-req">
              <select className="eo-input" aria-label={`Producto del requisito ${i + 1}`} value={f.productoId}
                onChange={(e) => cambiarFila(i, { productoId: e.target.value, saborId: null })}>
                <option value="">Producto…</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <select className="eo-input" aria-label={`Sabor del requisito ${i + 1}`} value={f.saborId ?? ''} disabled={!prod || prod.sabores.length === 0}
                onChange={(e) => cambiarFila(i, { saborId: e.target.value || null })}>
                <option value="">Todo el producto</option>
                {(prod?.sabores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <input className="eo-input eo-corto" aria-label={`Cantidad del requisito ${i + 1}`} type="number" min={1} max={99} value={f.cantidad}
                onChange={(e) => cambiarFila(i, { cantidad: Math.floor(Number(e.target.value)) || 1 })} />
              <button type="button" className="eo-btn eo-mini" onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}>Quitar</button>
            </div>
          );
        })}
      </div>

      <div className="eo-acciones-fila">
        <button type="button" className="eo-btn" onClick={() => setFilas((prev) => [...prev, { productoId: '', saborId: null, cantidad: 1 }])}>
          Agregar stock
        </button>
        <button type="button" className="eo-btn principal" disabled={guardando || !datos} onClick={guardar}>Guardar stock de la opción</button>
      </div>
      {error && <div role="alert" className="eo-error">{error}</div>}
      {aviso && <div role="status" className="eo-micro">{aviso}</div>}
    </section>
  );
}
