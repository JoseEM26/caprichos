import { useEffect, useState } from 'react';
import { pedidosApi, type Pedido } from './pedidosApi';

/** Situación de un pago en línea que el cliente no completó. Solo lectura: no hay cobrar, cambiar medio, revertir ni pasar a cocina. */
export function situacionSinCompletar(p: Pedido): string {
  return String(p.estado || '').toUpperCase() === 'ANULADO' ? 'Venció sin pagar' : 'Esperando pago';
}

/** Auditoría de «Tarjeta / Yape en línea» que nunca se pagaron (el servidor los separa de Caja por defecto). */
export function PagosEnLineaSinCompletar() {
  const [items, setItems] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let vivo = true;
    pedidosApi
      .listar({ abandonadosEnLinea: true, limite: 100 })
      .then((r) => {
        if (vivo) setItems(r.items ?? []);
      })
      .catch((e: any) => {
        if (vivo) setError(e?.message || 'No se pudieron cargar los pagos en línea sin completar');
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (error) return <div className="cj2-vacio" role="alert">{error}</div>;
  if (items === null) return <div className="cj2-vacio">Cargando…</div>;
  if (items.length === 0) return <div className="cj2-vacio">No hay pagos en línea sin completar.</div>;

  return (
    <section aria-label="Pagos en línea sin completar" className="cj2-lista" data-testid="pagos-en-linea-sin-completar">
      <p className="cj2-vacio">Solo lectura: el cliente no completó el pago. No pasan a cocina ni se cobran desde aquí.</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente</th>
            <th scope="col">Total</th>
            <th scope="col">Creado</th>
            <th scope="col">Situación</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={String(p.id)}>
              <td>{p.codigo}</td>
              <td>{p.cliente_nombre || '—'}</td>
              <td>S/ {Number(p.total ?? 0).toFixed(2)}</td>
              <td>{p.creado_en ? new Date(p.creado_en).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'}</td>
              <td>
                {situacionSinCompletar(p)}
                {p.motivo_anulacion ? <span className="cj2-ayuda"> · {p.motivo_anulacion}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
