import { Prisma } from '@prisma/client';
import {
  ANONIMIZAR, BORRAR_CUENTAS, CONSERVAR, FK_PARTY_DESVINCULADAS, FK_PARTY_PERSONAL, PREFIJOS_REDIS,
} from '../clasificacion-tablas';
import { FRASE_CONFIRMACION, esMarcaProduccion, validarDestinos } from '../guardas';
import { Db, RedisLike, limpiarRedis, main } from '../saneamiento-clientes-dni';

// URLs de prueba armadas por partes: no son credenciales reales
const url = (host: string, base: string, extra = '') => ['postgresql', '://', 'usuario', ':', 'clave', '@', host, '/', base, extra].join('');

const modelos = Prisma.dmmf.datamodel.models;
const tabla = (nombre: string) => {
  const m = modelos.find((x) => x.name === nombre)!;
  return m.dbName ?? m.name;
};
const TABLAS = modelos.map((m) => m.dbName ?? m.name);
const fks: Array<{ de: string; a: string; col: string }> = modelos.flatMap((m) =>
  m.fields
    .filter((f) => f.relationFromFields && f.relationFromFields.length)
    .map((f) => ({ de: m.dbName ?? m.name, a: tabla(f.type), col: f.relationFromFields![0] })),
);
const ANON = Object.keys(ANONIMIZAR);

describe('clasificación de tablas', () => {
  it('cada tabla del esquema está en exactamente un grupo', () => {
    const todas = [...BORRAR_CUENTAS, ...ANON, ...CONSERVAR];
    expect(todas.filter((t, i) => todas.indexOf(t) !== i)).toEqual([]);
    expect(TABLAS.filter((t) => !todas.includes(t))).toEqual([]);
    expect(todas.filter((t) => !TABLAS.includes(t))).toEqual([]);
  });

  it('se conservan recetas, almacén, bot, caja, personal y permisos', () => {
    for (const t of [
      'receta', 'receta_linea', 'insumo', 'stock', 'compra', 'mensaje_chat', 'whatsapp_mensaje',
      'saliente_whatsapp', 'ia_consumo', 'respuesta_rapida', 'caja', 'cobro', 'voucher_pago', 'archivo',
      'encuesta', 'reserva', 'auditoria', 'user_account', 'rol', 'permiso', 'rol_permiso', 'producto',
    ]) {
      expect(CONSERVAR).toContain(t);
    }
  });

  it('las columnas a anonimizar existen en el esquema', () => {
    for (const [t, reglas] of Object.entries(ANONIMIZAR)) {
      const m = modelos.find((x) => (x.dbName ?? x.name) === t)!;
      const cols = m.fields.map((f) => f.dbName ?? f.name);
      for (const r of reglas) for (const c of Object.keys(r.columnas)) expect(cols).toContain(c);
    }
  });

  it('toda FK a party desde fuera de las cuentas está desvinculada o es de personal', () => {
    const fuera = fks.filter((f) => f.a === 'party' && !BORRAR_CUENTAS.includes(f.de)).map((f) => `${f.de}.${f.col}`);
    expect([...fuera].sort()).toEqual([...FK_PARTY_DESVINCULADAS, ...FK_PARTY_PERSONAL].sort());
    const anonimizadas = ANON.flatMap((t) => ANONIMIZAR[t].flatMap((r) => Object.keys(r.columnas).map((c) => `${t}.${c}`)));
    for (const d of FK_PARTY_DESVINCULADAS) expect(anonimizadas).toContain(d);
  });

  it('nada fuera de las cuentas depende de ellas salvo el personal (party_role)', () => {
    const malos = fks.filter((f) => BORRAR_CUENTAS.includes(f.a) && f.a !== 'party' && !BORRAR_CUENTAS.includes(f.de));
    expect(malos.map((f) => `${f.de}>${f.a}`).sort()).toEqual(['employee_detail>party_role', 'supplier_detail>party_role']);
  });

  it('el orden de borrado pone las hijas antes que el padre', () => {
    for (const f of fks.filter((x) => BORRAR_CUENTAS.includes(x.de) && BORRAR_CUENTAS.includes(x.a) && x.de !== x.a)) {
      expect(BORRAR_CUENTAS.indexOf(f.de)).toBeLessThan(BORRAR_CUENTAS.indexOf(f.a));
    }
  });

  it('el patrón de DNI es de 8 dígitos y no alcanza RUC de 11', () => {
    const dni = new RegExp(ANONIMIZAR.pedido[0].donde.match(/'(\^.*\$)'/)![1]);
    expect(dni.test('12345678')).toBe(true);
    expect(dni.test('20123456789')).toBe(false);
    expect(ANONIMIZAR.reclamo[0].donde).toMatch(/\{11\}/);
  });
});

describe('guardas', () => {
  const dbLocal = url('localhost:5442', 'caprichos', '?schema=public');
  it('local solo en localhost:5442; demo solo host postgres con base demo; nunca prod', () => {
    expect(() => validarDestinos('local', dbLocal, 'redis://localhost:6389')).not.toThrow();
    expect(() => validarDestinos('local', url('localhost:5432', 'caprichos'))).toThrow();
    expect(() => validarDestinos('local', url('db.ejemplo.com:5442', 'caprichos'))).toThrow();
    expect(() => validarDestinos('local', url('localhost:5442', 'caprichos_prod'))).toThrow(/PRODUCCI/);
    expect(() => validarDestinos('demo', url('postgres:5432', 'caprichos_demo'), 'redis://:x@redis:6379')).not.toThrow();
    expect(() => validarDestinos('demo', url('postgres:5432', 'caprichos_prod'))).toThrow();
    expect(() => validarDestinos('demo', dbLocal)).toThrow();
    expect(() => validarDestinos('local', dbLocal, 'redis://redis:6379')).toThrow();
  });
  it('reconoce la marca de producción', () => {
    expect(esMarcaProduccion('"PRODUCCION"')).toBe(true);
    expect(esMarcaProduccion('produccion')).toBe(true);
    expect(esMarcaProduccion('DEMO')).toBe(false);
  });
});

function dbFalsa(opts: { marca?: string; emitidos?: number } = {}) {
  const sqls: string[] = [];
  const base = {
    async $queryRawUnsafe(sql: string) {
      sqls.push(sql);
      if (/FROM "parametro"/.test(sql)) return opts.marca ? [{ valor: opts.marca }] : [];
      if (/FROM "comprobante" WHERE "emision"/.test(sql)) return [{ n: opts.emitidos ?? 0 }];
      if (/information_schema/.test(sql)) return [{ table_name: 'nota_x', column_name: 'texto' }];
      return [{ n: 2 }];
    },
    async $executeRawUnsafe(sql: string) { sqls.push(sql); return 0; },
    async $disconnect() { /* nada */ },
  };
  const db = { ...base, $transaction: async (fn: (t: typeof base) => Promise<unknown>) => fn(base) } as unknown as Db;
  return { db, sqls };
}

const ENV = { ENTORNO_DATOS: 'local', DATABASE_URL: url('localhost:5442', 'caprichos', '?schema=public') };
const CONF = `--confirmar=${FRASE_CONFIRMACION}`;
const ESCRIBE = /^\s*(TRUNCATE|DELETE|INSERT|UPDATE|ALTER|CREATE|DROP)\b/i;
const run = (argv: string[], env: NodeJS.ProcessEnv, db: Db) =>
  main(argv, env, { db, redis: null, log: () => undefined });

describe('script', () => {
  it('se niega sin confirmación literal, sin ENTORNO_DATOS o con producción, sin tocar la base', async () => {
    const { db, sqls } = dbFalsa();
    await expect(run([], ENV, db)).rejects.toThrow(/confirmar/);
    await expect(run(['--confirmar=sanear clientes dni'], ENV, db)).rejects.toThrow(/confirmar/);
    await expect(run([CONF], { ...ENV, ENTORNO_DATOS: undefined }, db)).rejects.toThrow(/ENTORNO_DATOS/);
    await expect(run([CONF], { ...ENV, ENTORNO_DATOS: 'produccion' }, db)).rejects.toThrow(/ENTORNO_DATOS/);
    await expect(run([CONF], { ...ENV, DATABASE_URL: url('vps.ejemplo.com:5432', 'caprichos') }, db)).rejects.toThrow();
    expect(sqls).toEqual([]);
  });

  it('el simulacro (por defecto) cuenta, informa y no escribe', async () => {
    const { db, sqls } = dbFalsa();
    const r = await run([CONF], ENV, db);
    expect(r.modo).toBe('SIMULACRO');
    expect(r.borrar).toHaveProperty('party_identifier');
    expect(r.anonimizar).toHaveProperty(['pedido.comprobante_doc']);
    expect(r.conservar).toHaveProperty('receta');
    expect(r.hallazgos).toEqual({ 'nota_x.texto': 2 });
    expect(sqls.filter((s) => ESCRIBE.test(s))).toEqual([]);
    expect(sqls[0]).toMatch(/READ ONLY/);
  });

  it('exige respaldo o --sin-respaldo para ejecutar', async () => {
    const { db } = dbFalsa();
    await expect(run([CONF, '--ejecutar'], ENV, db)).rejects.toThrow(/respaldo/);
  });

  it('aborta si la base está marcada PRODUCCION o hay comprobantes emitidos, antes de escribir', async () => {
    for (const o of [{ marca: '"PRODUCCION"' }, { emitidos: 1 }]) {
      const { db, sqls } = dbFalsa(o);
      await expect(run([CONF, '--ejecutar', '--sin-respaldo'], ENV, db)).rejects.toThrow();
      expect(sqls.filter((s) => ESCRIBE.test(s))).toEqual([]);
    }
  });

  it('ejecución: anonimiza, luego borra hijas antes que party; solo toca tablas declaradas; deja auditoría', async () => {
    const { db, sqls } = dbFalsa();
    await run([CONF, '--ejecutar', '--sin-respaldo'], ENV, db);
    const escritas = sqls.filter((s) => ESCRIBE.test(s));
    expect(escritas.join('\n')).not.toMatch(/CASCADE|TRUNCATE/i);
    const idx = (re: RegExp) => escritas.findIndex((s) => re.test(s));
    expect(idx(/^UPDATE "pedido"/)).toBeLessThan(idx(/^DELETE FROM "party_identifier"/));
    expect(idx(/^UPDATE "conversacion"/)).toBeLessThan(idx(/^DELETE FROM "party" /));
    expect(idx(/^DELETE FROM "customer_detail"/)).toBeLessThan(idx(/^DELETE FROM "party_role"/));
    expect(idx(/^DELETE FROM "party_role"/)).toBeLessThan(idx(/^DELETE FROM "party" /));
    expect(escritas[escritas.length - 1]).toMatch(/SANEAMIENTO_CLIENTES_DNI/);
    const blancos = escritas.map((s) => s.match(/^(?:DELETE FROM|UPDATE|INSERT INTO)\s+"(\w+)"/)![1]);
    const permitidas = [...BORRAR_CUENTAS, ...ANON, 'auditoria'];
    for (const t of blancos) expect(permitidas).toContain(t);
    expect(blancos).not.toContain('user_account');
    // Las conversaciones solo se desvinculan: nunca se borran ni se toca el teléfono
    expect(escritas.filter((s) => /"conversacion"/.test(s)).every((s) => /^UPDATE "conversacion" SET "party_id" = NULL/.test(s))).toBe(true);
    // Los DELETE siempre llevan filtro de clientes (nunca borrado total)
    for (const s of escritas.filter((x) => /^DELETE/.test(x))) expect(s).toMatch(/WHERE/);
  });
});

describe('redis', () => {
  it('no hay claves de cliente en Redis hoy: ningún prefijo general (bull/chatbot/idemp)', () => {
    expect(PREFIJOS_REDIS.filter((p) => /^(bull|chatbot|idemp)/.test(p))).toEqual([]);
  });
  it('recorre solo los prefijos dados con SCAN y borra lo encontrado', async () => {
    const claves = ['cp_cliente:1', 'chatbot:spam:1', 'lock:x'];
    const borradas: string[] = [];
    const redis: RedisLike = {
      async scan(_c, _m, patron) {
        return ['0', claves.filter((k) => k.startsWith(String(patron).replace('*', '')))];
      },
      async unlink(...k) { borradas.push(...k); return k.length; },
      async quit() { return 'OK'; },
    };
    expect(await limpiarRedis(redis, false, ['cp_cliente:*'])).toEqual({ 'cp_cliente:*': 1 });
    expect(borradas).toEqual([]);
    await limpiarRedis(redis, true, ['cp_cliente:*']);
    expect(borradas).toEqual(['cp_cliente:1']);
  });
});
