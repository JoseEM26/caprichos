jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { PrismaService } from '../../comun/prisma/prisma.service';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesNocturnoService } from './comprobantes-nocturno.service';

/**
 * Contra un Postgres REAL con todas las migraciones (ck_comprobante_numero_asignado incluido).
 * Se omite sin TEST_DATABASE_URL (y esa misma URL debe ir en DATABASE_URL). Borra las tablas de comprobantes: solo una base de pruebas.
 * Ej.: DATABASE_URL=$U TEST_DATABASE_URL=$U npx jest comprobantes-nocturno.integracion
 */
const URL = process.env.TEST_DATABASE_URL;
(URL ? describe : describe.skip)('envío nocturno contra Postgres real', () => {
  let prisma: PrismaService;
  let nocturno: ComprobantesNocturnoService;
  let comprobantes: ComprobantesService;

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== URL) throw new Error('DATABASE_URL debe ser igual a TEST_DATABASE_URL');
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.$executeRawUnsafe(`TRUNCATE comprobante, pedido, secuencia_comprobante, parametro, comprobante_cambio_pendiente RESTART IDENTITY CASCADE`);
    await prisma.parametro.create({ data: { clave: 'facturacion_envio_nocturno', valor: 'si' } as any });
    const auditoria = { registrar: async () => undefined } as any;
    comprobantes = new ComprobantesService(prisma, auditoria);
    nocturno = new ComprobantesNocturnoService(prisma, comprobantes, auditoria);
  });
  afterAll(async () => prisma?.$disconnect());

  const pedido = (codigo: string, estado = 'ENTREGADO') =>
    prisma.pedido.create({ data: { codigo, modalidad: 'MESA', estado, pago_estado: 'PAGADO', subtotal: 10, total: 10, comprobante_tipo: 'BOLETA' } as any });
  const espera = (pedido_id: bigint, tipo = 'BOLETA') =>
    prisma.comprobante.create({ data: { pedido_id, tipo, documento: tipo === 'FACTURA' ? '20601234567' : null, razon_social: tipo === 'FACTURA' ? 'Aybar SAC' : null, facturacion_estado: 'POR_EMITIR_NOCHE', emisor: 'SIMULADO', simulado: true } });

  it('la secuencia vieja viola el CHECK; emitirLote emite sin huecos (con una carrera perdida) y es idempotente', async () => {
    const p1 = await pedido('P1'), p2 = await pedido('P2'), p3 = await pedido('P3'), p4 = await pedido('P4', 'ANULADO'), p5 = await pedido('P5');
    const c1 = await espera(p1.id), c2 = await espera(p2.id), c3 = await espera(p3.id), c4 = await espera(p4.id), c5 = await espera(p5.id, 'FACTURA');

    // Secuencia ANTERIOR: reclamar y luego numerar; el primer UPDATE ya viola el CHECK
    let errorViejo = '';
    await prisma
      .$transaction(async (tx: any) => {
        await tx.comprobante.updateMany({ where: { id: c1.id, facturacion_estado: 'POR_EMITIR_NOCHE' }, data: { facturacion_estado: 'PENDIENTE_ENVIO' } });
      })
      .catch((e: any) => (errorViejo = String(e?.message ?? e)));
    console.log('ERROR REAL DE LA SECUENCIA ANTERIOR:', errorViejo.split('\n').filter(Boolean).slice(-3).join(' | '));
    expect(errorViejo).toMatch(/ck_comprobante_numero_asignado/);

    // c2 se anula justo entre la lectura y el reclamo: el correlativo tomado debe revertirse (sin hueco)
    const original = comprobantes.leerConfigFacturacion.bind(comprobantes);
    let carrera = false;
    jest.spyOn(comprobantes, 'leerConfigFacturacion').mockImplementation(async (...a: any[]) => {
      const cfg = await original(...(a as []));
      if (carrera) {
        carrera = false;
        await prisma.comprobante.update({ where: { id: c2.id }, data: { anulado_en: new Date(), anulado_motivo: 'carrera de prueba' } });
      }
      return cfg;
    });
    const emitirFila = (id: bigint) => (nocturno as any).emitirFila(id);
    expect(await emitirFila(c1.id)).toBe(true);
    carrera = true;
    expect(await emitirFila(c2.id)).toBe(false);

    const r = await nocturno.emitirLote(new Date(), true);
    console.log('emitirLote #1', JSON.stringify(r));
    const filas = await prisma.comprobante.findMany({ orderBy: { id: 'asc' } });
    console.log(JSON.stringify(filas.map((f) => ({ id: Number(f.id), tipo: f.tipo, serie: f.serie, numero: f.numero, texto: f.numero_texto, estado: f.facturacion_estado, anulado: !!f.anulado_en }))));
    const sec = await prisma.$queryRaw<any[]>`SELECT serie, ultimo_numero FROM secuencia_comprobante ORDER BY serie`;
    console.log('secuencia', JSON.stringify(sec));

    expect(r).toMatchObject({ emitidos: 2, fallidos: 0 });
    const por = Object.fromEntries(filas.map((f) => [Number(f.id), f]));
    expect(por[Number(c1.id)].numero_texto).toBe('B002-000001');
    expect(por[Number(c3.id)].numero_texto).toBe('B002-000002'); // sin hueco: el tomado por c2 se revirtió
    expect(por[Number(c5.id)].numero_texto).toBe('F002-000001');
    expect(por[Number(c2.id)]).toMatchObject({ serie: null, numero: null, numero_texto: null });
    expect(por[Number(c4.id)].numero_texto).toBeNull();
    expect(por[Number(c4.id)].anulado_en).not.toBeNull();
    expect(filas.filter((f) => f.facturacion_estado === 'POR_EMITIR_NOCHE' && !f.anulado_en)).toHaveLength(0);
    expect(sec.map((s) => ({ serie: s.serie, ultimo_numero: Number(s.ultimo_numero) }))).toEqual([{ serie: 'B002', ultimo_numero: 2 }, { serie: 'F002', ultimo_numero: 1 }]);

    const r2 = await nocturno.emitirLote(new Date(), true);
    console.log('emitirLote #2', JSON.stringify(r2));
    expect(r2).toMatchObject({ emitidos: 0, fallidos: 0 });
  });
});
