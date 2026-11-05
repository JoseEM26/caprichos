jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';

describe('Ejecutor: a qué cuenta suma un pedido de WhatsApp', () => {
  const servicio: any = new EjecutorConversacionService(
    {} as any, {} as any, {} as any, {} as any, {} as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  );

  it('el pedido del bot suma SIEMPRE al celular de quien escribe, nunca a otro número', () => {
    expect(servicio.origenPedidoWhatsapp({ telefono: '51987654321' })).toEqual({
      canal: 'WHATSAPP',
      telefonoRemitente: '51987654321',
      telefonoPuntos: '51987654321',
    });
  });
});
