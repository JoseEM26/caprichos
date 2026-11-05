jest.mock('../../../ofertas/envio-gratis-promo', () => ({
  calcularEnvioDelivery: jest.fn(),
}));

import { calcularEnvioDelivery } from '../../../ofertas/envio-gratis-promo';
import { vistaPreviaPedidoBot } from '../vista-previa-pedido.util';

const mockEnvio = calcularEnvioDelivery as jest.Mock;

const pedidoDelivery = (): any => ({
  estadoInterno: 'PEDIDO_CATEGORIAS',
  modalidad: 'DELIVERY',
  items: [
    {
      lineaId: 'l1',
      productoId: '10',
      productoNombre: 'Clásica',
      categoriaId: '3',
      categoriaNombre: 'Hamburguesas',
      cantidad: 2,
      precioUnitario: 20,
      subtotal: 40,
      opciones: [],
      noSumaBeneficios: false,
    },
  ],
});

describe('vistaPreviaPedidoBot', () => {
  beforeEach(() => mockEnvio.mockReset());

  it('usa el descuento del servidor para el canal WhatsApp y el envío de calcularEnvioDelivery', async () => {
    const ofertasService: any = {
      calcularDescuentosParaPedido: jest.fn().mockResolvedValue({
        descuentoTotal: 4,
        detalles: [{ nombre: 'Martes 2x1' }],
      }),
    };
    mockEnvio.mockResolvedValue({ envio: 0, promo: { id: '5', nombre: 'Envío gratis', hasta: null, compraMinima: null } });

    const vista = await vistaPreviaPedidoBot({ prisma: {} as any, ofertasService }, pedidoDelivery(), 5);

    expect(ofertasService.calcularDescuentosParaPedido).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 40, canal: 'WHATSAPP' }),
    );
    expect(mockEnvio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ subtotal: 40, tarifaZona: 5, canal: 'WHATSAPP' }));
    expect(vista).toEqual({ subtotal: 40, descuento: 4, descuentoNombre: 'Martes 2x1', envio: 0, envioGratis: true });
  });

  it('sin zona conocida el envío queda por calcular y no se llama al cálculo de envío', async () => {
    const ofertasService: any = { calcularDescuentosParaPedido: jest.fn().mockResolvedValue({ descuentoTotal: 0, detalles: [] }) };
    const vista = await vistaPreviaPedidoBot({ prisma: {} as any, ofertasService }, pedidoDelivery(), null);
    expect(vista?.envio).toBeNull();
    expect(vista?.envioGratis).toBe(false);
    expect(mockEnvio).not.toHaveBeenCalled();
  });

  it('para recoger no hay envío', async () => {
    const ofertasService: any = { calcularDescuentosParaPedido: jest.fn().mockResolvedValue({ descuentoTotal: 0, detalles: [] }) };
    const pedido = { ...pedidoDelivery(), modalidad: 'RECOGER' };
    const vista = await vistaPreviaPedidoBot({ prisma: {} as any, ofertasService }, pedido, 5);
    expect(vista?.envio).toBe(0);
    expect(vista?.envioGratis).toBe(false);
    expect(mockEnvio).not.toHaveBeenCalled();
  });

  it('sin carrito no hay vista previa', async () => {
    const vista = await vistaPreviaPedidoBot({ prisma: {} as any }, { ...pedidoDelivery(), items: [] }, 5);
    expect(vista).toBeNull();
  });
});
