import { ZonasService } from './zonas.service';
import { diagnosticarCobertura, poligonosSeSolapan } from './zonas.util';

// Cuadrado [lat, lng] con esquina inferior izquierda en (lat0, lng0). 0.01° ≈ 1.1 km, escala de zona de reparto
const cuadro = (lat0: number, lng0: number, lado = 0.01): [number, number][] => [
  [lat0, lng0],
  [lat0, lng0 + lado],
  [lat0 + lado, lng0 + lado],
  [lat0 + lado, lng0],
];

describe('solape entre polígonos', () => {
  it('detecta solape real y no marca bordes compartidos', () => {
    expect(poligonosSeSolapan(cuadro(0, 0), cuadro(0.005, 0.005))).toBe(true);
    expect(poligonosSeSolapan(cuadro(0, 0), cuadro(0, 0.01))).toBe(false);
    expect(poligonosSeSolapan(cuadro(0, 0), cuadro(0.05, 0.05))).toBe(false);
  });

  it('detecta un polígono contenido dentro de otro', () => {
    expect(poligonosSeSolapan(cuadro(0, 0, 0.05), cuadro(0.02, 0.02, 0.01))).toBe(true);
  });

  it('una franja de trazo de ~1 m entre zonas vecinas no es solape', () => {
    expect(poligonosSeSolapan(cuadro(0, 0), cuadro(0, 0.01 - 0.00001))).toBe(false);
  });

  it('detecta polígonos idénticos', () => {
    expect(poligonosSeSolapan(cuadro(0, 0), cuadro(0, 0))).toBe(true);
  });
});

describe('diagnóstico de cobertura', () => {
  it('sin solapes ni inválidas no reporta nada (los huecos no son error)', () => {
    const r = diagnosticarCobertura([
      { codigo: 'Z2', activa: true, poligono: cuadro(0, 0) },
      { codigo: 'Z3', activa: true, poligono: cuadro(0, 0.01) },
      { codigo: 'Z9', activa: true, poligono: cuadro(0.1, 0.1) },
    ]);
    expect(r).toEqual({ solapes: [], invalidas: [] });
  });

  it('gana la zona de menor código, aunque se listen en otro orden', () => {
    const r = diagnosticarCobertura([
      { codigo: 'Z5', activa: true, poligono: cuadro(0.005, 0.005) },
      { codigo: 'Z2', activa: true, poligono: cuadro(0, 0) },
    ]);
    expect(r.solapes).toEqual([{ ganadora: 'Z2', perdedora: 'Z5' }]);
  });

  it('ignora las zonas inactivas en los solapes', () => {
    const r = diagnosticarCobertura([
      { codigo: 'Z2', activa: true, poligono: cuadro(0, 0) },
      { codigo: 'Z3', activa: false, poligono: cuadro(0.005, 0.005) },
    ]);
    expect(r.solapes).toEqual([]);
  });

  it('marca polígonos inválidos: menos de 3 puntos y autointersección', () => {
    const r = diagnosticarCobertura([
      { codigo: 'Z1', activa: true, poligono: [[0, 0], [1, 1]] },
      {
        codigo: 'Z4',
        activa: false,
        // reloj de arena: las aristas se cruzan
        poligono: [[0, 0], [1, 1], [0, 1], [1, 0]],
      },
    ]);
    expect(r.invalidas.map((x) => x.codigo)).toEqual(['Z1', 'Z4']);
    expect(r.invalidas[0]).toMatchObject({ codigo: 'Z1', activa: true });
    expect(r.invalidas[1]).toMatchObject({ codigo: 'Z4', activa: false });
    expect(r.solapes).toEqual([]);
  });
});

describe('ZonasService: diagnóstico, historial y solo pedidos nuevos', () => {
  const zonaZ3 = { id: 3n, codigo: 'Z3', tarifa: 3, activa: true, poligono: cuadro(0, 0) };
  const fechaAuditoria = new Date();

  function crearServicio(zonas: any[]) {
    const prisma: any = {
      zonaReparto: {
        findMany: jest.fn().mockResolvedValue(zonas),
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(zonas.find((z) => z.codigo === where.codigo) ?? null)),
        update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ ...zonas.find((z) => z.codigo === where.codigo), ...data })),
      },
      auditoria: {
        findMany: jest.fn().mockResolvedValue([
          { id: 9n, accion: 'EDITAR_TARIFA', en: fechaAuditoria, party_id: 1n, antes: { codigo: 'Z3', tarifa: 3 }, despues: { codigo: 'Z3', tarifa: 4 } },
        ]),
      },
      pedido: { update: jest.fn() },
    };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { service: new ZonasService(prisma, auditoria), prisma, auditoria };
  }

  it('diagnosticoCobertura usa el mismo criterio de solape y de invalidez', async () => {
    const { service } = crearServicio([
      zonaZ3,
      { id: 2n, codigo: 'Z2', tarifa: 2, activa: true, poligono: cuadro(0.005, 0.005) },
    ]);
    const r = await service.diagnosticoCobertura();
    expect(r.solapes).toEqual([{ ganadora: 'Z2', perdedora: 'Z3' }]);
    expect(r.invalidas).toEqual([]);
  });

  it('historialZona lee la auditoría de la zona, con quién, antes y después', async () => {
    const { service, prisma } = crearServicio([zonaZ3]);
    const filas = await service.historialZona('Z3');
    expect(prisma.auditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { modulo: 'zonas', entidad: 'zona_reparto', entidad_id: 3n },
        orderBy: { en: 'desc' },
      }),
    );
    expect(filas).toEqual([
      {
        id: '9',
        accion: 'EDITAR_TARIFA',
        en: fechaAuditoria.toISOString(),
        partyId: '1',
        antes: { codigo: 'Z3', tarifa: 3 },
        despues: { codigo: 'Z3', tarifa: 4 },
      },
    ]);
  });

  it('historialZona de una zona inexistente responde ZONA_NO_ENCONTRADA', async () => {
    const { service } = crearServicio([zonaZ3]);
    await expect(service.historialZona('Z99')).rejects.toMatchObject({ response: { codigo: 'ZONA_NO_ENCONTRADA' } });
  });

  it('editar la tarifa de una zona no escribe en pedidos ya creados', async () => {
    const { service, prisma } = crearServicio([zonaZ3]);
    await service.editarTarifa('Z3', { tarifa: 4 } as any);
    expect(prisma.zonaReparto.update).toHaveBeenCalledTimes(1);
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });
});
