import { CartaLocalController } from './carta-local.controller';

describe('GET /carta/programar-horas: caché de 30 s', () => {
  it('apagado responde sin días; la segunda llamada usa la caché y a los 30 s se renueva', async () => {
    let valor = 'no';
    const prisma: any = { parametro: { findMany: jest.fn(async () => [{ clave: 'pedidos_programados_fuera_horario', valor }]) } };
    const local: any = { horasProgramables: jest.fn(async () => ({ diasMax: 7, dias: [{ fecha: '2027-03-01', horas: [] }] })) };
    const c = new CartaLocalController(local, prisma);
    expect(await c.programarHoras()).toEqual({ habilitado: false, diasMax: 0, dias: [] });
    expect(local.horasProgramables).not.toHaveBeenCalled();

    // dentro de los 30 s no se vuelve a consultar aunque el parámetro cambie
    valor = 'si';
    await c.programarHoras();
    expect(prisma.parametro.findMany).toHaveBeenCalledTimes(1);

    const ahora = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(ahora + 31_000);
    expect(await c.programarHoras()).toMatchObject({ habilitado: true, diasMax: 7 });
    expect(prisma.parametro.findMany).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });
});
