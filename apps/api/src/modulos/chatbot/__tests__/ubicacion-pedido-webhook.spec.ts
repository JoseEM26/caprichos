jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { UBICACION_PEDIDO_PUERTO } from '../puerto/ubicacion-pedido.puerto';

describe('ubicación de WhatsApp de un cliente con delivery activo (webhook)', () => {
  const crear = (recibir: jest.Mock) => {
    const svc: any = Object.create(WhatsappWebhookService.prototype);
    svc.logger = { error: jest.fn() };
    svc.moduleRef = { get: jest.fn((token: string) => { expect(token).toBe(UBICACION_PEDIDO_PUERTO); return { recibir }; }) };
    return svc;
  };
  const ub = { lat: -12.05, lng: -77.04 };

  it('la entrega al puerto y, si la atendió, el bot no la procesa', async () => {
    const recibir = jest.fn().mockResolvedValue({ atendida: true });
    expect(await crear(recibir).atenderUbicacionDePedido({ flujo: { estado: 'MENU' } }, ub, '51987654321')).toBe(true);
    expect(recibir).toHaveBeenCalledWith(expect.objectContaining({ telefono: '51987654321', lat: -12.05 }));
  });

  it('si el cliente arma un pedido en el bot (PEDIDO_*), no interviene', async () => {
    const recibir = jest.fn();
    expect(await crear(recibir).atenderUbicacionDePedido({ flujo: { estado: 'PEDIDO_UBICACION' } }, ub, '51987654321')).toBe(false);
    expect(recibir).not.toHaveBeenCalled();
  });

  it('sin ubicación válida o con error del puerto: false y el motor sigue', async () => {
    expect(await crear(jest.fn()).atenderUbicacionDePedido({ flujo: {} }, null, '51987654321')).toBe(false);
    expect(await crear(jest.fn().mockRejectedValue(new Error('x'))).atenderUbicacionDePedido({ flujo: {} }, ub, '51987654321')).toBe(false);
  });
});
