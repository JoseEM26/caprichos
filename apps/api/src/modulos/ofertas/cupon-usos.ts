import { NotFoundException } from '@nestjs/common';
import { descuentosDePedido } from '@caprichos/compartido';

const r2 = (n: number) => Math.round(n * 100) / 100;
const SIN_TRABAJADOR = 'Sin trabajador (carta o canje antiguo)';

/** Celular peruano de 9 dígitos como 9•••••321; cualquier otra cosa (BSUID, relleno) no se muestra. */
export function celularEnmascarado(telefono: string | null | undefined): string | null {
  const nacional = String(telefono ?? '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  if (!/^9\d{8}$/.test(nacional) || nacional === '999999999') return null;
  return `${nacional[0]}•••••${nacional.slice(-3)}`;
}

interface FilaUso {
  fecha: Date;
  pedidoCodigo: string;
  canal: string | null;
  aplicadoPor: bigint | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  clienteCuenta: boolean;
  clienteKey: string | null;
  total: number;
  descuento: number;
  anulado: boolean;
}

/** Descuento que dio ESTE cupón en el pedido: su línea CUPON del detalle; si no la hay, el descuento del pedido. */
function descuentoDelCupon(pedido: { descuento_detalle?: unknown; descuento?: unknown }): number {
  const cupones = descuentosDePedido({ descuento_detalle: pedido.descuento_detalle }).filter((d) => d.tipo === 'CUPON');
  return cupones.length > 0 ? cupones.reduce((a, d) => a + d.monto, 0) : r2(Number(pedido.descuento ?? 0));
}

/**
 * Usos de un cupón (resumen, por trabajador, por día y lista paginada).
 * COMPARTIDO sale de cupon_canje_compartido; UNICO_COMPROBANTE, de los códigos emitidos (cupon_emitido) y su pedido de canje.
 * ponytail: se lee todo el cupón y se agrega en memoria (un cupón tiene cientos de usos, no millones); si crece, agregar en SQL.
 */
export async function usosDeCupon(prisma: any, idCupon: string, pagina = 1, tamano = 10, hoy = new Date()) {
  let id: bigint;
  try {
    id = BigInt(idCupon);
  } catch {
    throw new NotFoundException({ codigo: 'CUPON_NO_ENCONTRADO', mensaje: 'No se encontró el cupón' });
  }
  const cupon = await prisma.cupon.findUnique({ where: { id } });
  if (!cupon) throw new NotFoundException({ codigo: 'CUPON_NO_ENCONTRADO', mensaje: 'No se encontró el cupón' });

  const camposPedido = { codigo: true, canal: true, estado: true, total: true, descuento: true, descuento_detalle: true, cliente_nombre: true, cliente_telefono: true, cliente_party_id: true };
  const filas: FilaUso[] = [];
  let emision: { emitidos: number; canjeados: number; vencidos: number; anulados: number } | null = null;

  const aFila = (fecha: Date, p: any, canal: string | null, aplicadoPor: bigint | null): FilaUso => ({
    fecha,
    pedidoCodigo: p.codigo,
    canal,
    aplicadoPor,
    clienteNombre: p.cliente_nombre ?? null,
    clienteTelefono: p.cliente_telefono ?? null,
    clienteCuenta: p.cliente_party_id != null,
    clienteKey: p.cliente_party_id != null ? String(p.cliente_party_id) : null,
    total: r2(Number(p.total ?? 0)),
    descuento: descuentoDelCupon(p),
    anulado: p.estado === 'ANULADO',
  });

  if (cupon.modo === 'UNICO_COMPROBANTE') {
    const emitidos: any[] = await prisma.cuponEmitido.findMany({ where: { cupon_id: id }, include: { pedidoCanje: { select: camposPedido } } });
    emision = {
      emitidos: emitidos.length,
      canjeados: emitidos.filter((e) => e.estado === 'CANJEADO').length,
      vencidos: emitidos.filter((e) => e.estado === 'VENCIDO' || (e.estado === 'VIGENTE' && e.vence_en && e.vence_en < hoy)).length,
      anulados: emitidos.filter((e) => e.estado === 'ANULADO').length,
    };
    for (const e of emitidos) {
      if (e.estado === 'CANJEADO' && e.pedidoCanje) filas.push(aFila(e.canjeado_en ?? e.creado_en, e.pedidoCanje, e.pedidoCanje.canal ?? null, null));
    }
  } else {
    const canjes: any[] = await prisma.cuponCanjeCompartido.findMany({ where: { cupon_id: id }, include: { pedido: { select: camposPedido } } });
    for (const c of canjes) filas.push(aFila(c.en, c.pedido, c.canal ?? null, c.aplicado_por ?? null));
  }
  filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const vigentes = filas.filter((f) => !f.anulado);
  const usos = filas.length;
  const tope: number | null = cupon.tope_usos ?? null;
  const descuentoTotal = r2(vigentes.reduce((a, f) => a + f.descuento, 0));
  const clientes = new Set(filas.map((f) => f.clienteKey).filter((k): k is string => k != null));

  // Por trabajador (los anulados cuentan como uso pero no suman soles)
  const grupos = new Map<string, { partyId: string | null; usos: number; soles: number }>();
  for (const f of filas) {
    const k = f.aplicadoPor != null ? String(f.aplicadoPor) : '';
    const g = grupos.get(k) ?? { partyId: k || null, usos: 0, soles: 0 };
    g.usos += 1;
    if (!f.anulado) g.soles = r2(g.soles + f.descuento);
    grupos.set(k, g);
  }
  const ids = [...grupos.values()].filter((g) => g.partyId).map((g) => BigInt(g.partyId!));
  const personas: any[] = ids.length ? await prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } }) : [];
  const nombres = new Map<string, string>(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
  const nombreDe = (partyId: bigint | null) => (partyId == null ? SIN_TRABAJADOR : (nombres.get(String(partyId)) ?? 'Trabajador'));
  const porTrabajador = [...grupos.values()]
    .map((g) => ({ partyId: g.partyId, nombre: g.partyId ? (nombres.get(g.partyId) ?? 'Trabajador') : SIN_TRABAJADOR, usos: g.usos, soles: g.soles }))
    .sort((a, b) => b.usos - a.usos);

  // Por día: últimos 30 días (hora de Lima), con los días vacíos en cero
  const dia = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  const porDiaMapa = new Map<string, { usos: number; soles: number }>();
  for (let i = 29; i >= 0; i--) porDiaMapa.set(dia(new Date(hoy.getTime() - i * 86_400_000)), { usos: 0, soles: 0 });
  for (const f of filas) {
    const x = porDiaMapa.get(dia(f.fecha));
    if (!x) continue;
    x.usos += 1;
    if (!f.anulado) x.soles = r2(x.soles + f.descuento);
  }
  const porDia = [...porDiaMapa].map(([d, v]) => ({ dia: d, ...v }));

  const tam = Math.min(50, Math.max(1, Math.floor(tamano) || 10));
  const totalPaginas = Math.max(1, Math.ceil(filas.length / tam));
  const pag = Math.min(totalPaginas, Math.max(1, Math.floor(pagina) || 1));
  const items = filas.slice((pag - 1) * tam, pag * tam).map((f) => ({
    fecha: f.fecha.toISOString(),
    pedidoCodigo: f.pedidoCodigo,
    canal: f.canal,
    aplicadoPor: f.aplicadoPor != null ? nombreDe(f.aplicadoPor) : null,
    cliente: f.clienteCuenta ? { nombre: f.clienteNombre, celular: celularEnmascarado(f.clienteTelefono) } : { nombre: null, celular: null, sinCuenta: true },
    totalPedido: f.total,
    descuento: f.descuento,
    anulado: f.anulado,
  }));

  return {
    cuponId: String(id),
    modo: cupon.modo as string,
    resumen: { usos, tope, quedan: tope != null ? Math.max(0, tope - usos) : null, descuentoTotal, clientesDistintos: clientes.size, anulados: filas.length - vigentes.length, ...(emision ?? {}) },
    porTrabajador,
    porDia,
    historial: { items, total: filas.length, pagina: pag, tamano: tam, totalPaginas },
  };
}
