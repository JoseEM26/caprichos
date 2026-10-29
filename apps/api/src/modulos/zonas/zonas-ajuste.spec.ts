import { Test } from '@nestjs/testing';
import { ajustarAVecinas, areaSolapeM2, separacionM, Punto } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ZonasService } from './zonas.service';

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
