import { BadRequestException, NotFoundException } from '@nestjs/common';
import { fechaLimaHoy } from '../stock/producto-controlado';

/** Grupos que ofrece el modal (chips). */
export const GRUPOS_HISTORIAL = ['subidas', 'pedidos', 'mermas', 'ajustes'] as const;
export const POR_PAGINA_HISTORIAL = 50;
// ponytail: se leen en memoria todos los movimientos del producto desde el inicio del rango (tope 5000) para calcular el
// saldo corrido hacia atrás; si un producto llegara a más, habría que guardar el saldo en cada movimiento.
const TOPE = 5000;
const MAX_DIAS = 31;

type Categoria = 'APERTURA' | 'SUBIDA' | 'PEDIDO' | 'DEVOLUCION' | 'MERMA' | 'AJUSTE' | 'TRASPASO' | 'CIERRE';
const GRUPO_DE: Record<Categoria, (typeof GRUPOS_HISTORIAL)[number]> = {
  SUBIDA: 'subidas',
  PEDIDO: 'pedidos',
  DEVOLUCION: 'pedidos',
  MERMA: 'mermas',
  CIERRE: 'mermas',
  APERTURA: 'ajustes',
  AJUSTE: 'ajustes',
  TRASPASO: 'ajustes',
};

const SALIDAS = new Set(['VENTA', 'CORTESIA', 'SALIDA', 'TRASLADO_SALIDA', 'PRODUCCION_CONSUMO']);
const ENTRADAS = new Set(['ENTRADA', 'PRODUCCION_ALTA', 'DEVOLUCION', 'TRASLADO_ENTRADA']);

/** Cantidad con signo: las ventas se guardan en positivo y descuentan; mermas, ajustes y anulaciones se guardan ya con su signo. */
export function cantidadConSigno(tipo: string, cantidad: number): number {
  if (SALIDAS.has(tipo)) return -Math.abs(cantidad);
  if (ENTRADAS.has(tipo)) return Math.abs(cantidad);
  return cantidad;
}

export function categoriaDe(tipo: string, nota: string | null, pedidoId: bigint | null): Categoria {
  if (tipo === 'VENTA' || tipo === 'CORTESIA') return 'PEDIDO';
  if (tipo === 'ANULACION' || tipo === 'DEVOLUCION') return pedidoId ? 'DEVOLUCION' : 'AJUSTE';
  if (tipo === 'MERMA') return nota?.startsWith('Cierre del día') ? 'CIERRE' : 'MERMA';
  if (tipo === 'TRASLADO_ENTRADA' || tipo === 'TRASLADO_SALIDA') return 'TRASPASO';
  if (ENTRADAS.has(tipo)) return 'SUBIDA';
  if (tipo === 'AJUSTE' && nota === 'Apertura del día') return 'APERTURA';
  return 'AJUSTE';
}

const ETIQUETA: Record<Categoria, string> = {
  APERTURA: 'Conteo de apertura',
  SUBIDA: 'Subida',
  PEDIDO: 'Pedido descontó',
  DEVOLUCION: 'Devolución por anulación',
  MERMA: 'Merma',
  AJUSTE: 'Ajuste',
  TRASPASO: 'Traspaso',
  CIERRE: 'Cierre del día',
};

const diaSiguiente = (d: string) => new Date(new Date(`${d}T00:00:00.000Z`).getTime() + 86400000).toISOString().slice(0, 10);
const inicioDia = (d: string) => new Date(`${d}T05:00:00.000Z`); // medianoche de Lima (UTC-5, sin horario de verano)
const validarFecha = (d: string, campo: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: `La fecha ${campo} no es válida (AAAA-MM-DD)` });
  }
};
const horaLima = (d: Date) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const redondeo = (n: number) => Math.round(n * 1000) / 1000;
/** Solo nombre de pila: el historial no necesita más datos del cliente. */
const pila = (n?: string | null) => n?.trim().split(/\s+/)[0] || null;

export interface ConsultaHistorial {
  desde?: string;
  hasta?: string;
  sabor?: string;
  tipo?: string;
  pagina?: number | string;
}

function parsearId(txt: string, entidad: string): bigint {
  try {
    return BigInt(txt);
  } catch {
    throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: `El identificador de ${entidad} no es válido` });
  }
}

export async function historialProducto(prisma: any, productoIdTxt: string, q: ConsultaHistorial, ahora = new Date()) {
  const productoId = parsearId(productoIdTxt, 'producto');
  const hoy = fechaLimaHoy(ahora);
  const desde = q.desde || hoy;
  const hasta = q.hasta || desde;
  validarFecha(desde, 'desde');
  validarFecha(hasta, 'hasta');
  if (hasta < desde) throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: 'La fecha «hasta» es anterior a «desde»' });
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 >= MAX_DIAS) {
    throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: `El rango máximo es de ${MAX_DIAS} días` });
  }
  if (q.tipo && !(GRUPOS_HISTORIAL as readonly string[]).includes(q.tipo)) {
    throw new BadRequestException({ codigo: 'TIPO_INVALIDO', mensaje: 'Tipo de movimiento no válido' });
  }
  const saborId = q.sabor ? parsearId(q.sabor, 'sabor') : null;

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, nombre: true, sabores: { select: { id: true, nombre: true, activo: true }, orderBy: { nombre: 'asc' } } },
  });
  if (!producto) throw new NotFoundException({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: `Producto ${productoIdTxt} no encontrado` });
  if (saborId !== null && !producto.sabores.some((s: any) => s.id === saborId)) {
    throw new BadRequestException({ codigo: 'SABORES_INVALIDOS', mensaje: 'El sabor no pertenece a ese producto' });
  }

  const ini = inicioDia(desde);
  const fin = inicioDia(diaSiguiente(hasta));
  const alcanceSabores: bigint[] = saborId !== null ? [saborId] : producto.sabores.map((s: any) => s.id as bigint);

  // Pocas consultas, sin N+1: movimientos (con pedido y sabor), saldos actuales y conteos; luego personas y tandas.
  const [movs, filasStock, filasSabor, conteos] = await Promise.all([
    prisma.movimientoStock.findMany({
      where: { producto_id: productoId, en: { gte: ini }, ...(saborId !== null ? { sabor_id: saborId } : {}) },
      include: {
        sabor: { select: { nombre: true } },
        pedido: { select: { id: true, codigo: true, estado: true, modalidad: true, cliente_nombre: true } },
      },
      orderBy: [{ en: 'asc' }, { id: 'asc' }],
      take: TOPE,
    }),
    saborId !== null ? Promise.resolve([]) : prisma.stock.findMany({ where: { producto_id: productoId }, select: { cantidad: true } }),
    alcanceSabores.length ? prisma.stockSabor.findMany({ where: { sabor_id: { in: alcanceSabores } }, select: { cantidad: true } }) : Promise.resolve([]),
    prisma.conteoApertura.findMany({
      where: {
        producto_id: productoId,
        fecha: { gte: new Date(`${desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) },
        ...(saborId !== null ? { sabor_id: saborId } : {}),
      },
      select: { fecha: true, cantidad: true, en: true },
    }),
  ]);
  const idsPersonas = [...new Set<bigint>(movs.map((m: any) => m.por as bigint))];
  const idsProduccion = [...new Set<bigint>(movs.filter((m: any) => m.produccion_id).map((m: any) => m.produccion_id as bigint))];
  const [personas, producciones] = await Promise.all([
    idsPersonas.length ? prisma.person.findMany({ where: { party_id: { in: idsPersonas } }, select: { party_id: true, nombres: true, apellidos: true } }) : [],
    idsProduccion.length ? prisma.produccion.findMany({ where: { id: { in: idsProduccion } }, select: { id: true, tandas: true, anulado_en: true } }) : [],
  ]);
  const quien = new Map<string, string>(personas.map((p: any) => [p.party_id.toString(), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
  const tanda = new Map<string, any>(producciones.map((p: any) => [p.id.toString(), p]));

  const actual = redondeo([...filasStock, ...filasSabor].reduce((a: number, f: any) => a + Number(f.cantidad), 0));

  // Saldo corrido hacia atrás desde la existencia actual: el saldo tras el último movimiento ES la existencia.
  const firmadas: number[] = movs.map((m: any) => cantidadConSigno(m.tipo, Number(m.cantidad)));
  const despues: number[] = new Array(movs.length);
  let corrido = actual;
  for (let i = movs.length - 1; i >= 0; i--) {
    despues[i] = redondeo(corrido);
    corrido -= firmadas[i];
  }
  // Todos los movimientos son >= inicio del rango: lo que queda es el saldo a las 00:00 de Lima del primer día.
  const inicio = redondeo(corrido);

  const devuelto = new Map<string, number>();
  movs.forEach((m: any, i: number) => {
    if (m.movimiento_anulado_id) {
      const k = m.movimiento_anulado_id.toString();
      devuelto.set(k, (devuelto.get(k) ?? 0) + Math.abs(firmadas[i]));
    }
  });

  const resumen = { inicio, subido: 0, vendido: 0, mermas: 0, ajustes: 0, saldo: inicio, diferencia: 0, cuadra: true };
  const eventos: any[] = [];
  movs.forEach((m: any, i: number) => {
    if (m.en >= fin) return; // posteriores al rango: solo sirven para el saldo corrido
    const cat = categoriaDe(m.tipo, m.nota, m.pedido_id);
    const c = firmadas[i];
    if (cat === 'SUBIDA') resumen.subido += c;
    else if (cat === 'PEDIDO' || cat === 'DEVOLUCION') resumen.vendido += c; // la devolución lo reduce
    else if (cat === 'MERMA' || cat === 'CIERRE') resumen.mermas += c;
    else resumen.ajustes += c;
    resumen.saldo = despues[i];
    const origen: Record<string, unknown> = {};
    if (m.pedido) {
      origen.pedido = {
        id: m.pedido.id.toString(),
        codigo: m.pedido.codigo,
        estado: m.pedido.estado,
        modalidad: m.pedido.modalidad,
        cliente: pila(m.pedido.cliente_nombre),
        enlace: `/admin/caja?pedido=${m.pedido.id}`,
        anulado: m.pedido.estado === 'ANULADO',
        devuelto: devuelto.get(m.id.toString()) || null,
      };
    }
    let detalle: string | null = null;
    if (cat === 'SUBIDA') {
      const t = m.produccion_id ? tanda.get(m.produccion_id.toString()) : null;
      detalle = t ? `Tanda #${t.id} · ${Number(t.tandas)} tanda(s)${t.anulado_en ? ' · anulada' : ''}` : m.nota ?? null;
    } else if (cat === 'MERMA') detalle = (m.nota ?? '').split(' · ').slice(1).join(' · ') || m.nota;
    else if (cat !== 'PEDIDO' && cat !== 'DEVOLUCION') detalle = m.nota ?? null;
    eventos.push({
      id: m.id.toString(),
      categoria: cat,
      grupo: GRUPO_DE[cat],
      etiqueta: m.tipo === 'CORTESIA' ? 'Cortesía' : ETIQUETA[cat],
      cantidad: redondeo(c),
      saldoAntes: redondeo(despues[i] - c),
      saldoDespues: despues[i],
      fecha: fechaLimaHoy(m.en),
      hora: horaLima(m.en),
      en: m.en.toISOString(),
      sabor: m.sabor?.nombre ?? null,
      saborId: m.sabor_id?.toString() ?? null,
      por: quien.get(m.por.toString()) ?? null,
      detalle,
      // Un pedido sin pedido_id (movimiento antiguo) se muestra honestamente como «origen no registrado»
      origenRegistrado: cat === 'PEDIDO' || cat === 'DEVOLUCION' ? !!m.pedido : true,
      ...origen,
    });
  });
  for (const k of ['subido', 'vendido', 'mermas', 'ajustes', 'saldo'] as const) resumen[k] = redondeo(resumen[k]);

  // Cuadre: el conteo de apertura del último día con conteo fija la existencia en ese instante (conteo.en); el saldo
  // corrido a esa hora debe coincidir. Margen de 2 s porque movimiento y conteo no se escriben en el mismo milisegundo.
  // ponytail: con varios sabores se compara contra la suma de sus conteos; una venta en esos 2 s daría un falso aviso.
  if (conteos.length) {
    const claveDia = (c: any) => c.fecha.toISOString().slice(0, 10);
    const ultimo = conteos.map(claveDia).sort().pop()!;
    const lista = conteos.filter((c: any) => claveDia(c) === ultimo);
    const esperado = redondeo(lista.reduce((a: number, c: any) => a + Number(c.cantidad), 0));
    const corte = Math.max(...lista.map((c: any) => c.en.getTime())) + 2000;
    let al = inicio;
    for (let i = 0; i < movs.length && movs[i].en.getTime() <= corte; i++) al = despues[i];
    resumen.diferencia = redondeo(al - esperado);
    resumen.cuadra = resumen.diferencia === 0;
  }

  const filtrados = q.tipo ? eventos.filter((e) => e.grupo === q.tipo) : eventos;
  const pagina = Math.max(1, Math.floor(Number(q.pagina) || 1));
  // Más reciente primero; el saldo de cada evento sigue siendo el de su hora.
  const orden = filtrados.slice().reverse();
  return {
    producto: {
      id: producto.id.toString(),
      nombre: producto.nombre,
      sabores: producto.sabores.filter((s: any) => s.activo).map((s: any) => ({ id: s.id.toString(), nombre: s.nombre })),
    },
    desde,
    hasta,
    sabor: saborId?.toString() ?? null,
    resumen,
    existenciaActual: actual,
    truncado: movs.length >= TOPE,
    pagina,
    porPagina: POR_PAGINA_HISTORIAL,
    total: filtrados.length,
    eventos: orden.slice((pagina - 1) * POR_PAGINA_HISTORIAL, pagina * POR_PAGINA_HISTORIAL),
  };
}
