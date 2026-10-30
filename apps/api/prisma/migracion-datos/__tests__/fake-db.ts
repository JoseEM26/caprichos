/**
 * Doble en memoria de Prisma para probar exportar/importar sin base. Solo lo que usa el motor:
 * SELECT * de cada tabla, findMany/create/update/updateMany por delegado y $transaction.
 * No es un Prisma real: no valida tipos ni restricciones, solo cuenta escrituras.
 */
import { Prisma } from '@prisma/client';

type Fila = Record<string, any>;

const modelos = Prisma.dmmf.datamodel.models;
/** nombre de delegado (camelCase del modelo) -> nombre de tabla */
const tablaDeDelegado = new Map(modelos.map((m) => [m.name.charAt(0).toLowerCase() + m.name.slice(1), m.dbName ?? m.name]));
const tieneId = (tabla: string) => !!modelos.find((m) => (m.dbName ?? m.name) === tabla)?.fields.some((f) => f.name === 'id');

export class FakeDb {
  tablas: Record<string, Fila[]> = {};
  contadores: Record<string, number> = {};
  escrituras = 0;
  migracion: string | null;

  constructor(init: Record<string, Fila[]> = {}, migracion: string | null = '20261118100000_desactivar_extras_bebidas') {
    this.migracion = migracion;
    for (const [t, filas] of Object.entries(init)) this.tablas[t] = filas.map((f) => ({ ...f }));
  }

  private filas(t: string): Fila[] {
    this.tablas[t] ??= [];
    return this.tablas[t];
  }

  private nuevoId(t: string): number {
    this.contadores[t] = (this.contadores[t] ?? 0) + 1;
    return this.contadores[t];
  }

  private delegado(nombre: string) {
    const t = tablaDeDelegado.get(nombre);
    if (!t) throw new Error(`delegado desconocido en FakeDb: ${nombre}`);
    return {
      findMany: async () => this.filas(t).map((f) => ({ ...f })),
      create: async ({ data }: { data: Fila }) => {
        const fila = { ...data };
        if (tieneId(t) && fila.id === undefined) fila.id = this.nuevoId(t);
        this.filas(t).push(fila);
        this.escrituras++;
        return { ...fila };
      },
      update: async ({ where, data }: { where: Fila; data: Fila }) => {
        const f = this.filas(t).find((x) => Object.entries(where).every(([k, v]) => String(x[k]) === String(v)));
        if (!f) throw new Error(`update sin fila en ${t}`);
        Object.assign(f, data);
        this.escrituras++;
        return { ...f };
      },
      updateMany: async ({ where, data }: { where: Fila; data: Fila }) => {
        if (!Object.keys(where).length) throw new Error(`updateMany sin condición en ${t}`);
        let n = 0;
        for (const f of this.filas(t)) {
          if (Object.entries(where).every(([k, v]) => String(f[k]) === String(v))) { Object.assign(f, data); n++; }
        }
        this.escrituras += n;
        return { count: n };
      },
    };
  }

  /** Proxy: db.party, db.userAccount, db.auditoria... */
  get delegados(): Record<string, any> {
    return new Proxy({}, {
      get: (_o, nombre: string) => {
        if (nombre === 'auditoria') return this.delegado('auditoria');
        return this.delegado(String(nombre));
      },
    });
  }

  async $queryRawUnsafe(sql: string): Promise<any[]> {
    if (sql.includes('_prisma_migrations')) return this.migracion ? [{ migration_name: this.migracion }] : [];
    const m = /FROM "(\w+)"/.exec(sql);
    if (!m) throw new Error(`SQL no soportado en FakeDb: ${sql}`);
    return this.filas(m[1]).map((f) => ({ ...f }));
  }

  async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn(this.proxy());
  }

  /** Cliente tipo Prisma: delegados como propiedades + $queryRawUnsafe/$transaction. */
  proxy(): any {
    const self = this;
    return new Proxy({}, {
      get(_o, nombre: string | symbol) {
        if (nombre === '$queryRawUnsafe') return (sql: string) => self.$queryRawUnsafe(sql);
        if (nombre === '$transaction') return (fn: (tx: any) => Promise<any>) => self.$transaction(fn);
        if (typeof nombre !== 'string') return undefined;
        return self.delegado(nombre);
      },
    });
  }
}
