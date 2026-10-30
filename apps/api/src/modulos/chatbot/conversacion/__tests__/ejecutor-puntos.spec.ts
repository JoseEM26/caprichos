jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';

describe('Ejecutor: a qué cuenta suma un pedido de WhatsApp', () => {
  const cuentaPorTelefono = jest.fn();
  const crearMensaje = jest.fn().mockResolvedValue({});
  const servicio: any = new EjecutorConversacionService(
    { mensajeChat: { create: crearMensaje } } as any,
    {} as any, {} as any, {} as any, {} as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    { cuentaPorTelefono } as any,
  );
  const conv = { telefono: '51987654321' };
  beforeEach(() => jest.clearAllMocks());

  it('sin decisión de puntos: rige la resolución automática por teléfono', async () => {
    expect(await servicio.origenPedidoWhatsapp(undefined, conv)).toEqual({ canal: 'WHATSAPP', telefonoRemitente: '51987654321' });
  });

  it('TELEFONO_PROPIO: se vuelve a resolver por el número de quien escribe, no por lo guardado', async () => {
    cuentaPorTelefono.mockResolvedValue({ partyId: 7n });
    const o = await servicio.origenPedidoWhatsapp({ modo: 'TELEFONO_PROPIO', partyId: '999' }, conv);
    expect(o.clientePartyId).toBe(7n);
    expect(cuentaPorTelefono).toHaveBeenCalledWith('51987654321');
  });

  it('TELEFONO_PROPIO sin cuenta (ya no existe): invitado', async () => {
    cuentaPorTelefono.mockResolvedValue(null);
    expect((await servicio.origenPedidoWhatsapp({ modo: 'TELEFONO_PROPIO' }, conv)).sinCuentaCliente).toBe(true);
  });

  it('TELEFONO_DICTADO: lleva la cuenta elegida y no el teléfono', async () => {
    const o = await servicio.origenPedidoWhatsapp({ modo: 'TELEFONO_DICTADO', partyId: '9' }, conv);
    expect(o).toMatchObject({ clientePartyId: '9', telefonoRemitente: undefined });
  });

  it('NINGUNO: invitado de verdad', async () => {
    const o = await servicio.origenPedidoWhatsapp({ modo: 'NINGUNO' }, conv);
    expect(o).toMatchObject({ sinCuentaCliente: true, telefonoRemitente: undefined });
  });

  it('registra en el chat qué cuenta se eligió y cómo', async () => {
    await servicio.registrarEleccionPuntos(5n, { modo: 'TELEFONO_DICTADO', partyId: '9' }, 'CP-W030');
    const data = crearMensaje.mock.calls[0][0].data;
    expect(data.tipo).toBe('SISTEMA');
    expect(data.contenido.puntos).toEqual({ modo: 'TELEFONO_DICTADO', partyId: '9', pedido: 'CP-W030' });
    expect(data.contenido.texto).toContain('TELEFONO_DICTADO');
  });
});
