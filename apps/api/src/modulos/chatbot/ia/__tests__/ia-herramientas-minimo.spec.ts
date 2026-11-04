jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { IaHerramientasService } from '../ia-herramientas.service';

/** La IA informa el pedido mínimo solo si está configurado: sin parámetro no inventa ningún monto. */
describe('IA herramienta de envío: pedido mínimo', () => {
  const servicioCon = (valorMinimo: unknown) => {
    const prisma: any = {
      parametro: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.clave === 'pedido_minimo' && valorMinimo !== undefined ? { valor: valorMinimo } : null,
        ),
      },
      zonaReparto: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new IaHerramientasService(prisma);
  };

  it('sin pedido_minimo configurado devuelve pedidoMinimo null (no 15)', async () => {
    const res = await servicioCon(undefined).costoYZonaDeEnvio();
    expect(res.pedidoMinimo).toBeNull();
  });

  it('con pedido_minimo en 0 tampoco hay mínimo', async () => {
    const res = await servicioCon(0).costoYZonaDeEnvio('Campoy');
    expect(res.pedidoMinimo).toBeNull();
  });

  it('con pedido_minimo configurado lo informa como número', async () => {
    const res = await servicioCon(20).costoYZonaDeEnvio();
    expect(res.pedidoMinimo).toBe(20);
  });
});
