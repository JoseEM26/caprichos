import { BadRequestException } from '@nestjs/common';
import { EncuestasEstadisticaService } from './encuestas-estadistica.service';

describe('EncuestasEstadisticaService', () => {
  let service: EncuestasEstadisticaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      encuestaPosventa: {
        count: jest.fn().mockResolvedValue(10),
        groupBy: jest.fn(async ({ by }: any) =>
          by[0] === 'motivo_codigo'
            ? [
                { motivo_codigo: 'DEMORA', _count: { _all: 2 } },
                { motivo_codigo: 'OTRO', _count: { _all: 1 } },
              ]
            : [
                { puntaje: 5, _count: { _all: 3 } },
                { puntaje: 4, _count: { _all: 1 } },
                { puntaje: 1, _count: { _all: 2 } },
              ],
        ),
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(7),
            pedido_id: BigInt(70),
            enviada_en: new Date('2026-10-20T15:00:00Z'),
            respondida_en: new Date('2026-10-20T16:00:00Z'),
            puntaje: 1,
            comentario: 'Llegó frío',
            motivo_codigo: 'OTRO',
            motivo_texto: 'Llegó frío',
            pedido: { codigo: 'CP-7', cliente_nombre: 'Ana', modalidad: 'DELIVERY', canal: 'WHATSAPP' },
          },
        ]),
      },
      quejaWhatsapp: {
        findMany: jest.fn().mockResolvedValue([{ id: BigInt(99), pedido_id: BigInt(70) }]),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ dia: '2026-10-20', respondidas: 6, promedio: 3.333 }])
        .mockResolvedValueOnce([
          { modalidad: 'DELIVERY', respondidas: 4, promedio: 2.5 },
          { modalidad: 'MESA', respondidas: 2, promedio: 5 },
        ]),
    };
    service = new EncuestasEstadisticaService(prisma);
  });

  it('calcula resumen y distribución 1..5 desde la agrupación', async () => {
    const r = await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-29' });

    expect(r.distribucion).toEqual([
      { puntaje: 1, cantidad: 2 },
      { puntaje: 2, cantidad: 0 },
      { puntaje: 3, cantidad: 0 },
      { puntaje: 4, cantidad: 1 },
      { puntaje: 5, cantidad: 3 },
    ]);
    expect(r.resumen).toEqual({
      enviadas: 10,
      respondidas: 6,
      tasaRespuesta: 60,
      promedio: 3.5,
      satisfechos: 66.7,
      insatisfechos: 33.3,
    });
  });

  it('devuelve un día por cada fecha del rango, con cero donde no hubo respuestas', async () => {
    const r = await service.obtenerEstadisticas({ desde: '2026-10-19', hasta: '2026-10-21' });
    expect(r.tendencia).toEqual([
      { dia: '2026-10-19', promedio: null, respondidas: 0 },
      { dia: '2026-10-20', promedio: 3.3, respondidas: 6 },
      { dia: '2026-10-21', promedio: null, respondidas: 0 },
    ]);
  });

  it('aplica el filtro de puntaje a la lista, no a la distribución', async () => {
    await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-29', puntaje: 1 });
    const argsLista = prisma.encuestaPosventa.findMany.mock.calls[0][0];
    const argsGroup = prisma.encuestaPosventa.groupBy.mock.calls.find((c: any) => c[0].by[0] === 'puntaje')[0];
    expect(argsLista.where.puntaje).toBe(1);
    expect(argsGroup.where.puntaje).toEqual({ not: null });
  });

  it('pagina con skip/take y enlaza la queja del pedido sin exponer teléfono', async () => {
    const r = await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-29', pagina: 2, limite: 8 });
    const args = prisma.encuestaPosventa.findMany.mock.calls[0][0];
    expect(args.skip).toBe(8);
    expect(args.take).toBe(8);
    expect(r.items[0]).toEqual({
      id: '7',
      fecha: '2026-10-20T16:00:00.000Z',
      puntaje: 1,
      comentario: 'Llegó frío',
      motivo: 'Llegó frío',
      pedidoCodigo: 'CP-7',
      clienteNombre: 'Ana',
      modalidad: 'DELIVERY',
      canal: 'WHATSAPP',
      quejaId: '99',
    });
    expect(JSON.stringify(r)).not.toMatch(/telefono|cliente_telefono/);
    expect(r.totalPaginas).toBe(2);
  });

  it('ordena modalidades en orden fijo y hace una sola consulta por bloque', async () => {
    const r = await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-29' });
    expect(r.porModalidad.map((m) => m.modalidad)).toEqual(['MESA', 'DELIVERY']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.encuestaPosventa.groupBy).toHaveBeenCalledTimes(2); // puntajes y motivos
  });

  it('cuenta por motivo (siempre las seis filas)', async () => {
    const r = await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-29' });
    expect(r.porMotivo.map((m) => [m.codigo, m.cantidad])).toEqual([
      ['DEMORA', 2], ['MAL_ESTADO', 0], ['INCOMPLETO', 0], ['ATENCION', 0], ['PRECIO', 0], ['OTRO', 1],
    ]);
  });

  it('rechaza rangos invertidos y fechas inválidas', async () => {
    await expect(service.obtenerEstadisticas({ desde: '2026-10-29', hasta: '2026-10-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.obtenerEstadisticas({ desde: '2026-13-45', hasta: '2026-10-01' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('responde nulos y listas vacías sin datos', async () => {
    prisma.encuestaPosventa.count.mockResolvedValue(0);
    prisma.encuestaPosventa.groupBy.mockResolvedValue([]);
    prisma.encuestaPosventa.findMany.mockResolvedValue([]);
    prisma.encuestaPosventa.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
    const r = await service.obtenerEstadisticas({ desde: '2026-10-01', hasta: '2026-10-02' });
    expect(r.resumen).toEqual({
      enviadas: 0,
      respondidas: 0,
      tasaRespuesta: null,
      promedio: null,
      satisfechos: null,
      insatisfechos: null,
    });
    expect(r.items).toEqual([]);
    expect(prisma.quejaWhatsapp.findMany).not.toHaveBeenCalled();
  });
});
