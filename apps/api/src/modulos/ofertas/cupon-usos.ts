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
export function descuentoDelCupon(pedido: { descuento_detalle?: unknown; descuento?: unknown }): number {
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
  if (cupon.modo === 'ASIGNADO_PERSONAL') return usosDeCuponAsignado(prisma, cupon, camposPedido, pagina, tamano, hoy);
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

/** Lima = UTC-5 (sin horario de verano). */
const diaLima = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);

/**
 * Cupón «Lo da el mozo o cajero»: dados (cupon_emitido) frente a canjeados, por quien los dio e historial con el pedido de origen
 * (a quién se dio) y el pedido de canje. Los dados anulados por error no cuentan como dados; el pedido de canje anulado no suma soles.
 */
async function usosDeCuponAsignado(prisma: any, cupon: any, camposPedido: Record<string, boolean>, pagina: number, tamano: number, hoy: Date) {
  const todos: any[] = await prisma.cuponEmitido.findMany({
    where: { cupon_id: cupon.id },
    include: { pedidoOrigen: { select: camposPedido }, pedidoCanje: { select: camposPedido } },
  });
  const dados = todos.filter((e) => e.estado !== 'ANULADO').sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
  const canjeados = dados.filter((e) => e.estado === 'CANJEADO');
  const soles = (e: any) => (e.pedidoCanje && e.pedidoCanje.estado !== 'ANULADO' ? descuentoDelCupon(e.pedidoCanje) : 0);
  const vencidos = dados.filter((e) => e.estado === 'VENCIDO' || (e.estado === 'VIGENTE' && e.vence_en && e.vence_en < hoy)).length;
  const tope: number | null = cupon.tope_usos ?? null;

  const grupos = new Map<string, { partyId: string | null; dados: number; canjeados: number; soles: number }>();
  for (const e of dados) {
    const k = e.otorgado_por != null ? String(e.otorgado_por) : '';
    const g = grupos.get(k) ?? { partyId: k || null, dados: 0, canjeados: 0, soles: 0 };
    g.dados += 1;
    if (e.estado === 'CANJEADO') {
      g.canjeados += 1;
      g.soles = r2(g.soles + soles(e));
    }
    grupos.set(k, g);
  }
  const ids = [...grupos.values()].filter((g) => g.partyId).map((g) => BigInt(g.partyId!));
  const personas: any[] = ids.length ? await prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } }) : [];
  const nombres = new Map<string, string>(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
  const nombreDe = (id: bigint | null) => (id == null ? SIN_TRABAJADOR : (nombres.get(String(id)) ?? 'Trabajador'));
  const porTrabajador = [...grupos.values()]
    .map((g) => ({ partyId: g.partyId, nombre: g.partyId ? (nombres.get(g.partyId) ?? 'Trabajador') : SIN_TRABAJADOR, usos: g.dados, dados: g.dados, canjeados: g.canjeados, soles: g.soles }))
    .sort((a, b) => b.dados - a.dados);

  // Por día: cuántos se dieron cada día (últimos 30 días)
  const mapa = new Map<string, { usos: number; soles: number }>();
  for (let i = 29; i >= 0; i--) mapa.set(diaLima(new Date(hoy.getTime() - i * 86_400_000)), { usos: 0, soles: 0 });
  for (const e of dados) {
    const x = mapa.get(diaLima(e.creado_en));
    if (x) x.usos += 1;
  }
  for (const e of canjeados) {
    const x = e.canjeado_en ? mapa.get(diaLima(e.canjeado_en)) : undefined;
    if (x) x.soles = r2(x.soles + soles(e));
  }

  const tam = Math.min(50, Math.max(1, Math.floor(tamano) || 10));
  const totalPaginas = Math.max(1, Math.ceil(dados.length / tam));
  const pag = Math.min(totalPaginas, Math.max(1, Math.floor(pagina) || 1));
  const cliente = (p: any) => (p?.cliente_party_id != null ? { nombre: p.cliente_nombre ?? null, celular: celularEnmascarado(p.cliente_telefono) } : { nombre: null, celular: null, sinCuenta: true });
  const items = dados.slice((pag - 1) * tam, pag * tam).map((e) => ({
    fecha: e.creado_en.toISOString(),
    codigo: e.codigo as string,
    estado: (e.estado === 'VIGENTE' && e.vence_en && e.vence_en < hoy ? 'VENCIDO' : e.estado) as string,
    pedidoOrigenCodigo: (e.pedidoOrigen?.codigo ?? null) as string | null,
    otorgadoPor: e.otorgado_por != null ? nombreDe(e.otorgado_por) : null,
    cliente: cliente(e.pedidoOrigen),
    pedidoCanjeCodigo: (e.pedidoCanje?.codigo ?? null) as string | null,
    canjeadoEn: e.canjeado_en ? (e.canjeado_en as Date).toISOString() : null,
    canjeadoCanal: (e.canjeado_canal ?? null) as string | null,
    descuento: soles(e),
  }));

  return {
    cuponId: String(cupon.id),
    modo: cupon.modo as string,
    resumen: {
      usos: dados.length,
      tope,
      quedan: tope != null ? Math.max(0, tope - dados.length) : null,
      descuentoTotal: r2(canjeados.reduce((a, e) => a + soles(e), 0)),
      clientesDistintos: new Set(dados.map((e) => (e.pedidoOrigen?.cliente_party_id != null ? String(e.pedidoOrigen.cliente_party_id) : null)).filter((k) => k != null)).size,
      anulados: todos.length - dados.length,
      emitidos: dados.length,
      canjeados: canjeados.length,
      vencidos,
    },
    porTrabajador,
    porDia: [...mapa].map(([d, v]) => ({ dia: d, ...v })),
    historial: { items, total: dados.length, pagina: pag, tamano: tam, totalPaginas },
  };
}
