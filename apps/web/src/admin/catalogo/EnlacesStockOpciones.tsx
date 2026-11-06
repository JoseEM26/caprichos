import React, { useEffect, useState } from 'react';
import { catalogoApi, RequisitosOpcionAdmin } from './catalogoApi';

interface FilaReq { productoId: string; saborId: string | null; cantidad: number }

/**
 * Enlace de cada opción con el stock real: qué producto (y sabor, si es por sabor) consume y cuántas unidades.
 * Ejemplo: «2 Donas» = 2 de DONAS ARTESANALES; «Crema pastelera» = 1 del sabor Crema pastelera de las donas.
 * Sin filas, la opción solo depende de «agotado» (como antes).
 */
export function EnlacesStockOpciones({ opciones }: { opciones: Array<{ id: string; nombre: string }> }) {
  const [opcionId, setOpcionId] = useState(opciones[0]?.id ?? '');
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
    <section className="eo-stock-opciones" aria-label="Enlace de opciones con el stock" style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px' }}>Stock de cada opción</h4>
      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        Si una opción consume stock (p. ej. «2 Donas»), indica qué producto y cuántas unidades. Si no hay saldo, la opción queda agotada en la carta y en WhatsApp.
      </p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Opción
        <select value={opcionId} onChange={(e) => setOpcionId(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
      </label>

      {filas.map((f, i) => {
        const prod = productos.find((p) => p.id === f.productoId);
        return (
          <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <label>
              Producto
              <select aria-label={`Producto del requisito ${i + 1}`} value={f.productoId}
                onChange={(e) => cambiarFila(i, { productoId: e.target.value, saborId: null })}>
                <option value="">Elige…</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label>
              Sabor (opcional)
              <select aria-label={`Sabor del requisito ${i + 1}`} value={f.saborId ?? ''} disabled={!prod || prod.sabores.length === 0}
                onChange={(e) => cambiarFila(i, { saborId: e.target.value || null })}>
                <option value="">Todo el producto</option>
                {(prod?.sabores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label>
              Cantidad
              <input aria-label={`Cantidad del requisito ${i + 1}`} type="number" min={1} max={99} value={f.cantidad}
                onChange={(e) => cambiarFila(i, { cantidad: Math.floor(Number(e.target.value)) || 1 })} style={{ width: 70 }} />
            </label>
            <button type="button" onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}>Quitar</button>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => setFilas((prev) => [...prev, { productoId: '', saborId: null, cantidad: 1 }])}>
          Agregar stock
        </button>
        <button type="button" disabled={guardando || !datos} onClick={guardar}>Guardar stock de la opción</button>
      </div>
      {error && <div role="alert" style={{ color: 'var(--cp-rust, #b00)', marginTop: 6 }}>{error}</div>}
      {aviso && <div role="status" style={{ marginTop: 6 }}>{aviso}</div>}
    </section>
  );
}
