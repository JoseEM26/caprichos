/**
 * Base de datos en memoria para probar la facturación con transacciones reales (rollback incluido).
 * Solo lo que usan los servicios de comprobantes: filtros simples, relaciones some/none, create/update/
 * updateMany/upsert, incremento y la secuencia atómica. No es un Prisma completo.
 */

type Fila = Record<string, any>;
type Db = Record<string, any>;

const TABLAS = ['comprobante', 'comprobanteArchivo', 'pedido', 'cobro', 'parametro', 'notificacion', 'auditoria', 'sunatResumen', 'comprobanteCambioPendiente'];
/** Relaciones que el código consulta con some/none: tabla hija y clave que apunta al padre. */
const RELACIONES: Record<string, [string, string]> = { cobros: ['cobro', 'pedido_id'], comprobante: ['comprobante', 'pedido_id'] };

function coincide(db: Db, fila: Fila, where: any = {}): boolean {
  if (where.OR && !where.OR.some((w: any) => coincide(db, fila, w))) return false;
  if (where.AND && !where.AND.every((w: any) => coincide(db, fila, w))) return false;
  for (const [k, cond] of Object.entries<any>(where)) {
    if (k === 'OR' || k === 'AND') continue;
    if (RELACIONES[k] && cond && typeof cond === 'object' && ('some' in cond || 'none' in cond)) {
      const [tabla, fk] = RELACIONES[k];
      const hijas = (db[tabla] as Fila[]).filter((h) => h[fk] === fila.id);
      if ('some' in cond && !hijas.some((h) => coincide(db, h, cond.some))) return false;
      if ('none' in cond && hijas.some((h) => coincide(db, h, cond.none))) return false;
      continue;
    }
    const v = fila[k];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ('in' in cond && !cond.in.some((x: any) => x === v)) return false;
      if ('lt' in cond && (v == null || !(v < cond.lt))) return false;
      if ('gt' in cond && (v == null || !(v > cond.gt))) return false;
      if ('lte' in cond && (v == null || !(v <= cond.lte))) return false;
      if ('gte' in cond && (v == null || !(v >= cond.gte))) return false;
      if ('not' in cond && (cond.not === null ? v == null : v === cond.not)) return false;
    } else if (cond === null) {
      if (v != null) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

/** Misma regla que ck_comprobante_numero_asignado: solo POR_EMITIR_NOCHE puede no tener serie/número. */
function verificarComprobante(nombre: string, f: Fila) {
  if (nombre === 'comprobante' && f.facturacion_estado !== 'POR_EMITIR_NOCHE' && (f.serie == null || f.numero == null || f.numero_texto == null)) {
    throw new Error('viola ck_comprobante_numero_asignado: serie/numero/numero_texto NULL fuera de POR_EMITIR_NOCHE');
  }
}

function aplicar(fila: Fila, data: any) {
  for (const [k, v] of Object.entries<any>(data ?? {})) {
    if (v && typeof v === 'object' && 'increment' in v) fila[k] = (fila[k] ?? 0) + v.increment;
    else fila[k] = v;
  }
}

function tabla(db: Db, nombre: string) {
  const filas = (): Fila[] => db[nombre];
  const buscar = (where: any) => filas().filter((f) => coincide(db, f, where));
  const incluir = (f: Fila | null, include: any) => {
    if (!f || !include) return f;
    const salida: Fila = { ...f };
    if (include.pedido) salida.pedido = db.pedido.find((p: Fila) => p.id === f.pedido_id) ?? null;
    return salida;
  };
  return {
    findUnique: async ({ where, include }: any) => incluir(filas().find((f) => coincide(db, f, where)) ?? null, include),
    findFirst: async ({ where = {}, orderBy, select }: any = {}) => {
      const r = ordenar(buscar(where), orderBy);
      return r[0] ?? null;
    },
    findMany: async ({ where = {}, orderBy, take, include }: any = {}) => {
      let r = ordenar(buscar(where), orderBy);
      if (take) r = r.slice(0, take);
      return r.map((f) => incluir(f, include));
    },
    count: async ({ where = {} }: any = {}) => buscar(where).length,
    create: async ({ data }: any) => {
      const fila: Fila = { id: BigInt(filas().length + 1), creado_en: new Date(), anulado_en: null, copias_impresas: 0, facturacion_intentos: 0, ...data };
      verificarComprobante(nombre, fila);
      filas().push(fila);
      return { ...fila };
    },
    update: async ({ where, data }: any) => {
      const fila = filas().find((f) => coincide(db, f, where));
      if (!fila) throw new Error(`${nombre}: no existe`);
      aplicar(fila, data);
      verificarComprobante(nombre, fila);
      return { ...fila };
    },
    updateMany: async ({ where, data }: any) => {
      const r = buscar(where);
      r.forEach((f) => {
        aplicar(f, data);
        verificarComprobante(nombre, f);
      });
      return { count: r.length };
    },
    deleteMany: async ({ where = {} }: any = {}) => {
      const borrar = buscar(where);
      db[nombre] = filas().filter((f) => !borrar.includes(f));
      return { count: borrar.length };
    },
    upsert: async ({ where, update, create }: any) => {
      const fila = filas().find((f) => coincide(db, f, where));
      if (fila) {
        aplicar(fila, update);
        return { ...fila };
      }
      const nueva: Fila = { ...where, ...create };
      filas().push(nueva);
      return { ...nueva };
    },
  };
}

function ordenar(filas: Fila[], orderBy: any) {
  if (!orderBy) return [...filas];
  const [campo, sentido] = Object.entries<any>(orderBy)[0];
  const f = sentido === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => {
    const x = a[campo] instanceof Date ? a[campo].getTime() : a[campo];
    const y = b[campo] instanceof Date ? b[campo].getTime() : b[campo];
    return x < y ? -f : x > y ? f : 0;
  });
}

function cliente(db: Db): any {
  const c: any = {};
  for (const t of TABLAS) c[t] = tabla(db, t);
  c.$queryRaw = async (_strings: TemplateStringsArray, ...valores: any[]) => {
    const clave = valores[0];
    db.secuencia[clave] = (db.secuencia[clave] ?? 0) + 1;
    return [{ ultimo_numero: db.secuencia[clave] }];
  };
  // Las transacciones se serializan (como el bloqueo de fila de Postgres sobre secuencia/comprobante)
  let cola: Promise<unknown> = Promise.resolve();
  c.$transaction = (fn: (tx: any) => Promise<any>) => {
    const r = cola.then(() => transaccion(fn));
    cola = r.catch(() => undefined);
    return r;
  };
  const transaccion = async (fn: (tx: any) => Promise<any>) => {
    // Trabaja sobre una copia: si la función lanza, la copia se descarta (rollback); si no, se confirma
    const borrador = structuredClone(db);
    const resultado = await fn(cliente(borrador));
    for (const k of Object.keys(borrador)) db[k] = borrador[k];
    return resultado;
  };
  return c;
}

/** Crea la base vacía (con las tablas) y el cliente de Prisma falso sobre ella. */
export function crearBaseFalsa(datos: Partial<Record<string, Fila[]>> = {}) {
  const db: Db = { secuencia: {} };
  for (const t of TABLAS) db[t] = [...(datos[t] ?? [])];
  // Por defecto, como antes del envío nocturno (emitir al cobrar); las pruebas del lote nocturno lo encienden
  if (!db.parametro.some((p: Fila) => p.clave === 'facturacion_envio_nocturno')) db.parametro.push({ clave: 'facturacion_envio_nocturno', valor: 'no' });
  return { db, prisma: cliente(db) };
}

/** Pedido de prueba: una línea de S/ 11.80 (IGV incluido), con cobros y comprobantes embebidos en la tabla. */
export function pedidoDePrueba(extra: Fila = {}): Fila {
  return {
    id: 100n,
    codigo: 'P-100',
    pago_estado: 'PAGADO',
    comprobante_tipo: 'FACTURA',
    comprobante_doc: '20601234567',
    comprobante_razon: 'Inversiones Aybar S.A.C.',
    comprobante_direccion: 'Av. Test 123',
    cliente_nombre: 'Juan Perez',
    subtotal: 11.8,
    descuento: 0,
    envio: 0,
    total: 11.8,
    lineas: [{ id: 1n, nombre: 'Frappe Oreo', cantidad: 1, precio_unit: 11.8, subtotal: 11.8 }],
    ...extra,
  };
}
