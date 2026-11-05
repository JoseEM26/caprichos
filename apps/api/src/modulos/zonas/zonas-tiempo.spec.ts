import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ZonasService } from './zonas.service';
import { EditarTiempoDto } from './dto/editar-tiempo.dto';

/** Cuadrado de prueba alrededor de (-12, -77): la zona Z3 cubre el punto (-12, -77). */
const cuadrado = [
  [-11.9, -77.1],
  [-11.9, -76.9],
  [-12.1, -76.9],
  [-12.1, -77.1],
];

function construir(zonas: any[] = []) {
  const prisma: any = {
    zonaReparto: {
      findUnique: jest.fn(async ({ where }: any) => zonas.find((z) => z.codigo === where.codigo) ?? null),
      findMany: jest.fn(async () => zonas),
      update: jest.fn(async ({ where, data }: any) => {
        const z = zonas.find((x) => x.codigo === where.codigo);
        return { ...z, ...data };
      }),
    },
    parametro: { findUnique: jest.fn(async () => null) },
    oferta: { findMany: jest.fn(async () => []) },
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  return { servicio: new ZonasService(prisma, auditoria), prisma, auditoria };
}

const z3 = (extra: Record<string, unknown> = {}) => ({
  id: 3n,
  codigo: 'Z3',
  tarifa: 3,
  activa: true,
  poligono: cuadrado,
  minutos_min: 15,
  minutos_max: 20,
  ...extra,
});

describe('DTO EditarTiempoDto', () => {
  const valida = (body: Record<string, unknown>) =>
    validateSync(plainToInstance(EditarTiempoDto, body)).length;

  it('acepta enteros de 5 a 120', () => {
    expect(valida({ minutosMin: 5, minutosMax: 120 })).toBe(0);
  });
  it('rechaza menos de 5, más de 120 y decimales', () => {
    expect(valida({ minutosMin: 4, minutosMax: 20 })).toBeGreaterThan(0);
    expect(valida({ minutosMin: 10, minutosMax: 121 })).toBeGreaterThan(0);
    expect(valida({ minutosMin: 10.5, minutosMax: 20 })).toBeGreaterThan(0);
  });
});

describe('ZonasService.editarTiempo', () => {
  it('rechaza mínimo mayor que máximo con TIEMPO_INVALIDO y no escribe', async () => {
    const { servicio, prisma } = construir([z3()]);
    await expect(servicio.editarTiempo('Z3', { minutosMin: 25, minutosMax: 20 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
  });

  it('zona inexistente -> 404', async () => {
    const { servicio } = construir([]);
    await expect(servicio.editarTiempo('Z9', { minutosMin: 10, minutosMax: 15 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('guarda, audita EDITAR_TIEMPO con antes y después, e invalida la caché', async () => {
    const { servicio, prisma, auditoria } = construir([z3()]);
    // Carga la caché con la zona vieja
    await servicio.consultarEnvio(-12, -77);
    expect((servicio as any).cacheZonasActivas).not.toBeNull();

    const res = await servicio.editarTiempo('Z3', { minutosMin: 18, minutosMax: 25 }, { partyId: 9n } as any, '1.2.3.4');

    expect(prisma.zonaReparto.update).toHaveBeenCalledWith({
      where: { codigo: 'Z3' },
      data: { minutos_min: 18, minutos_max: 25 },
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'EDITAR_TIEMPO',
        modulo: 'zonas',
        antes: { codigo: 'Z3', minutosMin: 15, minutosMax: 20 },
        despues: { codigo: 'Z3', minutosMin: 18, minutosMax: 25 },
      }),
    );
    expect(res.minutosMin).toBe(18);
    expect((servicio as any).cacheZonasActivas).toBeNull();
  });
});

describe('minutos en las lecturas', () => {
  it('GET /admin/zonas (listar) devuelve minutosMin y minutosMax', async () => {
    const { servicio } = construir([z3()]);
    const [item] = await servicio.listarZonasAdmin();
    expect(item.minutosMin).toBe(15);
    expect(item.minutosMax).toBe(20);
  });

  it('GET /carta/envio devuelve minutos {min,max} de la zona; null si la zona no los tiene', async () => {
    const con = construir([z3()]);
    expect((await con.servicio.consultarEnvio(-12, -77)).minutos).toEqual({ min: 15, max: 20 });
    const sin = construir([z3({ minutos_min: null, minutos_max: null })]);
    expect((await sin.servicio.consultarEnvio(-12, -77)).minutos).toBeNull();
  });
});
