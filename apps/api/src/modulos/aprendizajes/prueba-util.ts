/** Prisma y Redis de mentira (en memoria) para las pruebas del aprendizaje. */
export function crearPrisma(opts: { chats?: any[]; parametros?: Record<string, unknown>; dias?: string[] } = {}) {
  const noches: any[] = [];
  const props: any[] = [];
  const conocimientos: any[] = [];
  const notifs: any[] = [];
  const params = new Map<string, unknown>(Object.entries(opts.parametros ?? {}));
  let nid = 1;
  let pid = 1;
  let cid = 1;
  const porFecha = (w: any) => noches.find((n) => n.fecha.getTime() === w.fecha.getTime());
  const prisma: any = {
    _noches: noches, _props: props, _conocimientos: conocimientos, _notifs: notifs, _params: params,
    parametro: {
      findMany: async () => [...params].map(([clave, valor]) => ({ clave, valor })),
      findUnique: async ({ where }: any) => (params.has(where.clave) ? { clave: where.clave, valor: params.get(where.clave) } : null),
      upsert: async ({ where, update, create }: any) => { params.set(where.clave, (params.has(where.clave) ? update : create).valor); },
    },
    conversacion: { findMany: jest.fn(async () => opts.chats ?? []) },
    aprendizajeNoche: {
      findUnique: async ({ where }: any) => porFecha(where) ?? null,
      findMany: async () => [...noches].sort((a, b) => b.fecha - a.fecha),
      count: async ({ where }: any) => noches.filter((n) => n.estado === where.estado && where.fecha.in.some((d: Date) => d.getTime() === n.fecha.getTime())).length,
      create: async ({ data }: any) => {
        const n = { id: BigInt(nid++), chats_leidos: 0, descartados_fuera_tema: 0, propuestas: 0, tokens_entrada: 0, tokens_salida: 0, usd_estimado: '0', error: null, creado_en: new Date(), terminado_en: null, ...data };
        noches.push(n);
        return n;
      },
      update: async ({ where, data }: any) => { const n = noches.find((x) => x.id === where.id); Object.assign(n, data); return n; },
    },
    aprendizajePropuesto: {
      findMany: async ({ where }: any) => props.filter((p) => !where?.estado || p.estado === where.estado),
      count: async () => props.filter((p) => p.estado === 'PENDIENTE').length,
      findUnique: async ({ where }: any) => props.find((p) => p.id === where.id) ?? null,
      create: async ({ data }: any) => { const p = { id: BigInt(pid++), estado: 'PENDIENTE', creado_en: new Date(), ...data }; props.push(p); return p; },
      update: async ({ where, data }: any) => { const p = props.find((x) => x.id === where.id); Object.assign(p, data); return p; },
    },
    conocimientoBot: {
      findMany: async () => conocimientos.filter((c) => c.estado === 'VIGENTE'),
      findUnique: async ({ where }: any) => conocimientos.find((c) => c.id === where.id) ?? null,
      aggregate: async () => ({ _max: { version: conocimientos.reduce((m, c) => Math.max(m, c.version), 0) || null } }),
      create: async ({ data }: any) => { const c = { id: BigInt(cid++), estado: 'VIGENTE', ...data }; conocimientos.push(c); return c; },
      update: async ({ where, data }: any) => { const c = conocimientos.find((x) => x.id === where.id); Object.assign(c, data); return c; },
    },
    notificacion: { create: async ({ data }: any) => { const n = { id: BigInt(notifs.length + 1), ...data }; notifs.push(n); return n; } },
    $queryRaw: jest.fn(async () => (opts.dias ?? []).map((d) => ({ d }))),
    $transaction: async (fn: any) => fn(prisma),
  };
  return prisma;
}

export const crearRedis = () => {
  const claves = new Set<string>();
  const cliente = {
    set: async (k: string, _v: string, _px: string, _ms: number, _nx: string) => (claves.has(k) ? null : (claves.add(k), 'OK')),
    eval: async (_s: string, _n: number, k: string) => { claves.delete(k); return 1; },
    del: async (k: string) => { claves.delete(k); },
  };
  return { obtenerCliente: () => cliente, _claves: claves } as any;
};

export const chatFalso = (id: number, textos: Array<[string, string]>, nombre = 'Rosa') => ({
  id: BigInt(id), nombre_contacto: nombre, party: null,
  mensajes: textos.map(([autor, texto]) => ({ autor, contenido: { texto } })),
});
