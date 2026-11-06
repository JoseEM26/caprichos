jest.mock('../../../ofertas/envio-gratis-promo', () => ({
  calcularEnvioDelivery: jest.fn(),
}));

import { calcularEnvioDelivery } from '../../../ofertas/envio-gratis-promo';
import { vistaPreviaPedidoBot, vistaPreviaUbicacionBot } from '../vista-previa-pedido.util';

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

describe('vistaPreviaUbicacionBot (ubicación antes del carrito)', () => {
  beforeEach(() => mockEnvio.mockReset());

  it('el envío de la zona con las reglas del servidor, con subtotal 0', async () => {
    mockEnvio.mockResolvedValue({ envio: 5, promo: null });
    const vista = await vistaPreviaUbicacionBot({} as any, 5);
    expect(mockEnvio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ subtotal: 0, tarifaZona: 5, canal: 'WHATSAPP' }));
    expect(vista).toEqual({ subtotal: 0, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false });
  });

  it('con la promo de envío gratis queda en 0', async () => {
    mockEnvio.mockResolvedValue({ envio: 0, promo: { id: '5', nombre: 'Envío gratis', hasta: null, compraMinima: null } });
    const vista = await vistaPreviaUbicacionBot({} as any, 5);
    expect(vista.envioGratis).toBe(true);
  });

  it('sin zona conocida el envío queda por calcular', async () => {
    const vista = await vistaPreviaUbicacionBot({} as any, null);
    expect(vista.envio).toBeNull();
    expect(mockEnvio).not.toHaveBeenCalled();
  });
});
