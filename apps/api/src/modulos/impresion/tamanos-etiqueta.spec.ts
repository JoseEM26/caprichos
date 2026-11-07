import { readFileSync } from 'fs';
import { join } from 'path';
import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { ImpresionService } from './impresion.service';
import { construirEtiquetaGeneral } from './constructor-etiquetas';
import { aplicaSegunReglas } from './ruteo-impresion';
import { leerTamanosEtiqueta } from './reglas-impresion';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const CLAVES = [
  'impresion_etiqueta_bebida_ancho_mm',
  'impresion_etiqueta_bebida_alto_mm',
  'impresion_etiqueta_general_ancho_mm',
  'impresion_etiqueta_general_alto_mm',
];

describe('migración 20270108100000_tamanos_etiquetas', () => {
  const sql = readFileSync(join(__dirname, '../../../prisma/migrations/20270108100000_tamanos_etiquetas/migration.sql'), 'utf8');

  it('siembra bebida 76 x 38 y general 100 x 100, idempotente y sin pisar lo configurado', () => {
    const valor = (clave: string) => new RegExp(`'${clave}', '(\\d+)'::jsonb\\) ON CONFLICT \\("clave"\\) DO NOTHING;`).exec(sql)?.[1];
    expect(CLAVES.map(valor)).toEqual(['76', '38', '100', '100']);
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|DO UPDATE/i);
  });
});

describe('leerTamanosEtiqueta', () => {
  const prisma = (filas: Array<{ clave: string; valor: unknown }>) => ({ parametro: { findMany: jest.fn().mockResolvedValue(filas) } }) as any;

  it('sin filas o con la base caída: 76 x 38 y 100 x 100', async () => {
    const esperado = { bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 100, altoMm: 100 } };
    expect(await leerTamanosEtiqueta(prisma([]))).toEqual(esperado);
    expect(await leerTamanosEtiqueta({ parametro: { findMany: jest.fn().mockRejectedValue(new Error('x')) } } as any)).toEqual(esperado);
  });

  it('respeta los valores válidos y descarta los inválidos', async () => {
    const t = await leerTamanosEtiqueta(
      prisma([
        { clave: CLAVES[0], valor: 100 },
        { clave: CLAVES[1], valor: 100 },
        { clave: CLAVES[2], valor: 5 },
        { clave: CLAVES[3], valor: '80' },
      ]),
    );
    expect(t).toEqual({ bebida: { anchoMm: 100, altoMm: 100 }, general: { anchoMm: 100, altoMm: 100 } });
  });
});

describe('validación de los parámetros de tamaño', () => {
  const adminAuth: any = { partyId: 1n, roles: ['ADMIN'], permisos: [] };
  let service: ConfiguracionService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = { parametro: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) } };
    service = new ConfiguracionService(prismaMock, { registrar: jest.fn().mockResolvedValue(undefined) } as any);
  });

  it.each(CLAVES)('%s: acepta enteros de 30 a 200 mm', async (clave) => {
    await service.actualizar(clave, 30, adminAuth);
    await service.actualizar(clave, 200, adminAuth);
    expect(prismaMock.parametro.upsert).toHaveBeenCalledTimes(2);
  });

  it.each(CLAVES)('%s: rechaza 29, 201, decimales, texto y negativos', async (clave) => {
    for (const malo of [29, 201, 50.5, '50', -5, 0]) {
      await expect(service.actualizar(clave, malo as any, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
    }
    expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();
  });
});

describe('qué stickers salen según la modalidad', () => {
  it('el general solo sale en llevar, recoger y delivery; nunca en mesa o local', () => {
    const r = REGLAS_IMPRESION_DEFECTO;
    for (const m of ['DELIVERY', 'RECOGER', 'LLEVAR']) expect(aplicaSegunReglas('ETIQUETA_GENERAL', m, r)).toBe(true);
    for (const m of ['MESA', 'LOCAL']) expect(aplicaSegunReglas('ETIQUETA_GENERAL', m, r)).toBe(false);
  });

  it('bebida y área: solo delivery, recoger y llevar; en mesa o local ningún sticker', () => {
    const r = { ...REGLAS_IMPRESION_DEFECTO, areaActivo: true };
    for (const t of ['ETIQUETA_BEBIDA', 'ETIQUETA_AREA']) {
      for (const m of ['DELIVERY', 'RECOGER', 'LLEVAR']) expect(aplicaSegunReglas(t, m, r)).toBe(true);
      for (const m of ['MESA', 'LOCAL']) expect(aplicaSegunReglas(t, m, r)).toBe(false);
    }
  });
});

describe('sticker general de delivery', () => {
  const base: any = { codigo: 'CP-1', creado_en: new Date(), canal: 'BOT', cliente_nombre: 'Ana', lineas: [], entrega_direccion: ' Av. Larga 123 ', cliente_telefono: '987654321' };

  it('delivery lleva dirección y celular; recoger y mesa no', () => {
    expect(construirEtiquetaGeneral({ ...base, modalidad: 'DELIVERY' })).toMatchObject({ direccion: 'Av. Larga 123', telefono: '987654321' });
    expect(construirEtiquetaGeneral({ ...base, modalidad: 'RECOGER' })).not.toHaveProperty('direccion');
    expect(construirEtiquetaGeneral({ ...base, modalidad: 'MESA', mesa_nombre: '3' })).not.toHaveProperty('telefono');
  });
});

describe('ImpresionService: tamaño al entregar el trabajo y modalidades al encolar', () => {
  let service: ImpresionService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      printJob: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findMany: jest.fn(), upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(1) },
      deviceKey: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      areaCocina: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      $queryRaw: jest.fn(),
    };
    service = new ImpresionService(prismaMock, { registrar: jest.fn() } as any);
  });

  it('un trabajo viejo en cola sale con el tamaño vigente de los parámetros', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 1n }, { id: 2n }, { id: 3n }]);
    prismaMock.printJob.findMany.mockResolvedValue([
      { id: 1n, tipo: 'ETIQUETA_GENERAL', payload: { codigo: 'A' }, copia: false, intentos: 0 },
      { id: 2n, tipo: 'ETIQUETA_BEBIDA', payload: { codigo: 'B' }, copia: false, intentos: 0 },
      { id: 3n, tipo: 'ETIQUETA_AREA', payload: { codigo: 'C' }, copia: false, intentos: 0 },
    ]);
    prismaMock.parametro.findMany.mockResolvedValue([
      { clave: CLAVES[0], valor: 100 },
      { clave: CLAVES[1], valor: 60 },
    ]);
    const { trabajos } = await service.tomarTrabajos(5, 1n);
    expect(trabajos[0].payload).toMatchObject({ codigo: 'A', tamanoMm: { anchoMm: 100, altoMm: 100 } });
    expect(trabajos[1].payload).toMatchObject({ codigo: 'B', tamanoMm: { anchoMm: 100, altoMm: 60 } });
    expect(trabajos[2].payload).toEqual({ codigo: 'C' }); // el área no lleva tamaño propio
  });

  const pedido = (modalidad: string) => ({
    id: 7n, codigo: 'CP-7', modalidad, mesa_nombre: modalidad === 'MESA' ? '2' : null, cliente_nombre: 'Luis', canal: 'CAJA', creado_en: new Date(),
    lineas: [{ id: 1n, cantidad: 1, nombre: 'Latte', area: { nombre: 'Bebidas' }, opciones: [] }],
  });
  const claves = () => prismaMock.printJob.upsert.mock.calls.map((c: any) => c[0].where.clave_idempotencia as string);

  it('MESA: no encola ningún sticker (ni general, ni vaso)', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(pedido('MESA'));
    await service.encolarEtiquetasPedido(7n);
    expect(claves().filter((c: string) => c.includes('ETIQUETA'))).toEqual([]);
  });

  it.each(['DELIVERY', 'RECOGER'])('%s: encola el sticker general y el vaso', async (m) => {
    prismaMock.pedido.findUnique.mockResolvedValue(pedido(m));
    await service.encolarEtiquetasPedido(7n);
    expect(claves()).toEqual(expect.arrayContaining(['7-ETIQUETA_GENERAL', '7-ETIQUETA_BEBIDA-1']));
  });
});
