jest.mock('../clientes/clientes.service', () => ({ ClientesService: class {} }));
jest.mock('./pedidos.service', () => ({ PedidosService: class {} }));
jest.mock('../carta-eventos', () => ({ CartaEventosService: class {} }));
jest.mock('../impresion/impresion.service', () => ({ ImpresionService: class {} }));
import { PedidosController } from './pedidos.controller';

// Decisión del dueño (16/11): el pedido web que entra a cocina imprime sus stickers sin esperar a Caja
describe('carta: el pedido web imprime sus stickers al entrar a cocina', () => {
  const armar = (estado: string, falla = false) => {
    const pedidosService = { crear: jest.fn().mockResolvedValue({ id: '10', codigo: 'P-0010', estado }) };
    const clientesService = { clienteDesdeRequest: jest.fn().mockResolvedValue(null) };
    const cartaEventos = { enlazarPedido: jest.fn().mockResolvedValue(undefined) };
    const impresion = {
      encolarEtiquetasPedido: falla ? jest.fn().mockRejectedValue(new Error('sin impresora')) : jest.fn().mockResolvedValue(undefined),
    };
    const c = new PedidosController(pedidosService as any, clientesService as any, cartaEventos as any, impresion as any);
    return { c, impresion };
  };

  it('pedido en COLA: encola los stickers', async () => {
    const { c, impresion } = armar('COLA');
    await c.crear({} as any, 'k', {} as any);
    expect(impresion.encolarEtiquetasPedido).toHaveBeenCalledWith('10');
  });

  it('pedido programado: no imprime hoy', async () => {
    const { c, impresion } = armar('PROGRAMADO');
    await c.crear({} as any, 'k', {} as any);
    expect(impresion.encolarEtiquetasPedido).not.toHaveBeenCalled();
  });

  it('si la impresión falla, el pedido igual se crea', async () => {
    const { c } = armar('COLA', true);
    await expect(c.crear({} as any, 'k', {} as any)).resolves.toMatchObject({ codigo: 'P-0010' });
  });
});
