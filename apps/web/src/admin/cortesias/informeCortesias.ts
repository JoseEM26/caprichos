import type { ResumenInformeCortesias } from './cortesiasApi';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Convierte el informe de cortesías en las tablas que usa Informes: primero el resumen por motivo, producto y
 * quién la dio, y después el listado detallado. Cada sección lleva un encabezado en la primera columna.
 */
export function filasInformeCortesias(res: ResumenInformeCortesias): {
  kpis: { n: string; v: string }[];
  cols: string[];
  rows: (string | number)[][];
} {
  const rows: (string | number)[][] = [];
  const seccion = (titulo: string) => rows.push([`▸ ${titulo}`, '', '', '', '', '']);

  seccion('Por motivo');
  for (const m of res.porMotivo) rows.push([m.motivo, m.unidades, soles(m.valorLista), m.registros, '', '']);
  seccion('Por producto');
  for (const p of res.porProducto) rows.push([p.producto, p.unidades, soles(p.valorLista), p.registros, '', '']);
  seccion('Por quién la dio');
  for (const q of res.porQuien) rows.push([q.nombre, q.unidades, soles(q.valorLista), q.registros, '', '']);
  seccion('Detalle');
  for (const d of res.detalle) {
    const fecha = new Date(d.creadoEn).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
    const producto = d.sabor ? `${d.producto} (${d.sabor})` : d.producto;
    rows.push([
      `${fecha} · ${producto}`,
      d.cantidad,
      soles(d.valorLista),
      `${d.motivoEtiqueta}${d.nota ? ` — ${d.nota}` : ''}`,
      d.pedido ?? (d.pedidoReferencia ? `Ref. ${d.pedidoReferencia}` : '—'),
      d.dadaPor + (d.autorizadaPor ? ` (autoriza ${d.autorizadaPor})` : ''),
    ]);
  }

  return {
    kpis: [
      { n: 'Cortesías', v: String(res.resumen.registros) },
      { n: 'Unidades regaladas', v: String(res.resumen.unidades) },
      { n: 'Valor de lista regalado', v: soles(res.resumen.valorLista) },
    ],
    cols: ['Concepto', 'Cantidad', 'Valor de lista', 'Motivo / Registros', 'Pedido', 'Quién la dio'],
    rows,
  };
}
