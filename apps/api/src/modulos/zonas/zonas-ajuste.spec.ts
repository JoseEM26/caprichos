import { Test } from '@nestjs/testing';
import { ajustarAVecinas, areaM2, areaSolapeM2, separacionM, Punto } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ZonasService } from './zonas.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

const KX = 111320 * Math.cos((-12 * Math.PI) / 180);
const KY = 110574;
const rect = (x0: number, y0: number, x1: number, y1: number): Punto[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [-12 + y / KY, -77 + x / KX] as Punto);

describe('ajustarAVecinas y rechazo de solape en editarPoligono', () => {
  let service: ZonasService;
  let prisma: any;
  let auditoria: any;
  const filaZ2 = { id: BigInt(2), codigo: 'Z2', tarifa: 3, activa: true, poligono: rect(0, 0, 100, 100) };
  const filaZ3 = { id: BigInt(3), codigo: 'Z3', tarifa: 4, activa: true, poligono: rect(106, 0, 200, 100) };

  beforeEach(async () => {
    prisma = {
      zonaReparto: {
        findMany: jest.fn().mockResolvedValue([filaZ2, filaZ3]),
        findUnique: jest.fn().mockResolvedValue(filaZ3),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...filaZ3, codigo: where.codigo, poligono: data.poligono })),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 15 }) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const m = await Test.createTestingModule({
      providers: [ZonasService, { provide: PrismaService, useValue: prisma }, { provide: AuditoriaService, useValue: auditoria }],
    }).compile();
    service = m.get(ZonasService);
  });

  it('snap a vértice cierra el hueco y es idempotente', () => {
    const r = ajustarAVecinas(filaZ3.poligono, [filaZ2.poligono], 15);
    expect(r.resumen.verticesAjustados).toBe(2);
    expect(separacionM(r.poligono, filaZ2.poligono)).toBeLessThan(0.01);
    expect(ajustarAVecinas(r.poligono, [filaZ2.poligono], 15).cambio).toBe(false);
  });

  it('recorta un solape pequeño y no cambia un polígono ya correcto', () => {
    const r = ajustarAVecinas(rect(97, 0, 200, 100), [filaZ2.poligono], 2);
    expect(r.resumen.areaRecortadaM2).toBeGreaterThan(250);
    expect(areaSolapeM2(r.poligono, filaZ2.poligono)).toBeLessThan(0.5);
    expect(ajustarAVecinas(rect(100, 0, 200, 100), [filaZ2.poligono], 15).cambio).toBe(false);
  });

  it('solape grande -> 409 ZONA_SOLAPADA con el detalle de la zona', async () => {
    await expect(service.editarPoligono('Z3', { poligono: rect(50, 0, 200, 100) })).rejects.toMatchObject({
      status: 409,
      response: { codigo: 'ZONA_SOLAPADA', detalle: [{ zonaId: '2', nombre: 'Z2', areaM2: expect.any(Number) }] },
    });
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('contenida totalmente -> 409', async () => {
    await expect(service.editarPoligono('Z3', { poligono: rect(20, 20, 40, 40) })).rejects.toMatchObject({ status: 409 });
  });

  it('bordes compartidos no son solape: guarda', async () => {
    const r = await service.editarPoligono('Z3', { poligono: rect(100, 0, 200, 100) });
    expect(r.ajuste?.areaRecortadaM2).toBe(0);
    expect(prisma.zonaReparto.update).toHaveBeenCalled();
  });

  it('el servidor siempre pega: un hueco fino se cierra y queda auditado con motivo', async () => {
    await service.editarPoligono('Z3', { poligono: rect(106, 0, 200, 100), motivo: 'Pegado automático' });
    const guardado = prisma.zonaReparto.update.mock.calls[0][0].data.poligono as Punto[];
    expect(separacionM(guardado, filaZ2.poligono)).toBeLessThan(0.01);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ despues: expect.objectContaining({ motivo: 'Pegado automático' }) }),
    );
  });

  it('solape bajo la tolerancia (menos de 1 m2) se recorta sin rechazar', async () => {
    // 0,005 m de solape sobre 100 m de lado = 0,5 m2
    await expect(service.editarPoligono('Z3', { poligono: rect(99.995, 0, 200, 100) })).resolves.toBeDefined();
  });

  it('normalizar: vista previa no guarda; confirmar guarda con historial', async () => {
    const prev = await service.normalizarZonas(false);
    expect(prev.zonas.some((z) => z.cambia)).toBe(true);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
    await service.normalizarZonas(true);
    expect(prisma.zonaReparto.update).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ despues: expect.objectContaining({ motivo: 'Pegado automático' }) }),
    );
  });

  it('el diagnóstico lista el hueco fino', async () => {
    const d = await service.diagnosticoCobertura();
    expect(d.huecos).toEqual([{ zonaA: 'Z2', zonaB: 'Z3', metros: 6, fino: true }]);
  });
});

describe('normalizar con conflictos de solape entre zonas activas', () => {
  // Z2 (id 2, S/ 3) y Z5 (id 5, S/ 7) se solapan en una franja de 10 m x 100 m = 1000 m²
  const filaZ2 = { id: BigInt(2), codigo: 'Z2', tarifa: 3, activa: true, poligono: rect(0, 0, 100, 100) };
  const filaZ5 = { id: BigInt(5), codigo: 'Z5', tarifa: 7, activa: true, poligono: rect(90, 0, 200, 100) };
  let service: ZonasService;
  let prisma: any;
  let auditoria: any;

  const armar = async (filas: any[]) => {
    prisma = {
      zonaReparto: {
        findMany: jest.fn().mockResolvedValue(filas),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ codigo: where.codigo, poligono: data.poligono })),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 15 }) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const m = await Test.createTestingModule({
      providers: [ZonasService, { provide: PrismaService, useValue: prisma }, { provide: AuditoriaService, useValue: auditoria }],
    }).compile();
    service = m.get(ZonasService);
  };
  const guardadoDe = (codigo: string) => prisma.zonaReparto.update.mock.calls.find((c: any[]) => c[0].where.codigo === codigo)?.[0].data.poligono as Punto[];

  beforeEach(() => armar([filaZ2, filaZ5]));

  it('la vista previa lista el conflicto con nombres, tarifas, área y GeoJSON del solape', async () => {
    const r = await service.normalizarZonas(false);
    expect(r.conflictos).toHaveLength(1);
    const c = r.conflictos[0];
    expect(c).toMatchObject({ zonaAId: '2', zonaBId: '5', nombreA: 'Z2', nombreB: 'Z5', tarifaA: 3, tarifaB: 7 });
    expect(c.areaM2).toBeCloseTo(1000, 0);
    expect(c.poligonoSolape.type).toBe('MultiPolygon');
    // GeoJSON va en [lng, lat]: el solape está entre x=90 y x=100 m, lng cerca de -77
    const [lng, lat] = c.poligonoSolape.coordinates[0][0][0];
    expect(lng).toBeCloseTo(-77 + 95 / (111320 * Math.cos((-12 * Math.PI) / 180)), 4);
    expect(lat).toBeCloseTo(-12, 4);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('confirmar sin decisiones -> 400 DECISION_REQUERIDA con los pares pendientes, sin escribir', async () => {
    await expect(service.normalizarZonas(true)).rejects.toMatchObject({
      status: 400,
      response: {
        codigo: 'DECISION_REQUERIDA',
        pendientes: [{ zonaAId: '2', zonaBId: '5', nombreA: 'Z2', nombreB: 'Z5' }],
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('decisión que se queda con Z2: Z5 pierde el solape y Z2 no cambia', async () => {
    await service.normalizarZonas(true, undefined, undefined, [{ zonaAId: '2', zonaBId: '5', conserva: '2' }]);
    expect(prisma.zonaReparto.update).toHaveBeenCalledTimes(1);
    const z5 = guardadoDe('Z5')!;
    expect(areaM2(z5)).toBeCloseTo(10000, 0);
    expect(areaSolapeM2(z5, filaZ2.poligono)).toBeLessThan(0.5);
  });

  it('decisión que se queda con Z5: Z2 pierde el solape', async () => {
    await service.normalizarZonas(true, undefined, undefined, [{ zonaAId: '5', zonaBId: '2', conserva: '5' }]);
    expect(areaM2(guardadoDe('Z2')!)).toBeCloseTo(9000, 0);
    expect(guardadoDe('Z5')).toBeUndefined();
  });

  it('la auditoría de cada zona lleva motivo «Pegado automático» y la decisión tomada', async () => {
    await service.normalizarZonas(true, { partyId: BigInt(1), rol: 'ADMIN', debeCambiar: false }, '10.0.0.1', [
      { zonaAId: '2', zonaBId: '5', conserva: '2' },
    ]);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidadId: BigInt(5),
        despues: expect.objectContaining({
          motivo: 'Pegado automático',
          decisiones: [expect.stringContaining('conserva Z2 el área compartida con Z5')],
        }),
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
  });

  it('el resumen por zona dice cuánto área pierde cada una', async () => {
    const r = await service.normalizarZonas(false, undefined, undefined, [{ zonaAId: '2', zonaBId: '5', conserva: '2' }]);
    const z5 = r.zonas.find((z) => z.codigo === 'Z5')!;
    expect(z5).toMatchObject({ cambia: true, areaAntesM2: 11000, areaDespuesM2: 10000 });
    expect(r.zonas.find((z) => z.codigo === 'Z2')!.cambia).toBe(false);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('transaccional: si la transacción falla no se audita nada', async () => {
    prisma.$transaction.mockImplementationOnce(async (fn: any) => {
      await fn(prisma);
      throw new Error('fallo al confirmar');
    });
    await expect(
      service.normalizarZonas(true, undefined, undefined, [{ zonaAId: '2', zonaBId: '5', conserva: '2' }]),
    ).rejects.toThrow('fallo al confirmar');
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('idempotencia: tras aplicar, una nueva confirmación no encuentra conflictos ni cambios', async () => {
    await service.normalizarZonas(true, undefined, undefined, [{ zonaAId: '2', zonaBId: '5', conserva: '2' }]);
    const z5 = guardadoDe('Z5')!;
    await armar([filaZ2, { ...filaZ5, poligono: z5 }]);
    const r = await service.normalizarZonas(true);
    expect(r.conflictos).toEqual([]);
    expect(r.zonas.some((z) => z.cambia)).toBe(false);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('decisión con una zona que no es parte del par -> 400 DECISION_INVALIDA', async () => {
    await expect(
      service.normalizarZonas(false, undefined, undefined, [{ zonaAId: '2', zonaBId: '5', conserva: '9' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una zona dentro de otra no se puede recortar sin hueco -> 409 ZONA_NO_RECORTABLE', async () => {
    await armar([
      { id: BigInt(2), codigo: 'Z2', tarifa: 3, activa: true, poligono: rect(0, 0, 300, 300) },
      { id: BigInt(6), codigo: 'Z6', tarifa: 5, activa: true, poligono: rect(100, 100, 150, 150) },
    ]);
    await expect(
      service.normalizarZonas(true, undefined, undefined, [{ zonaAId: '2', zonaBId: '6', conserva: '6' }]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });
});

