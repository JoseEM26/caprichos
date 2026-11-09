jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { MensajesService } from './mensajes.service';

describe('Mensajes: no se escribe al número propio ni a bloqueados', () => {
  const usuario = { partyId: 10n, rol: 'ADMIN', debeCambiar: false };
  const conv = (telefono: string) => ({
    id: 1n, telefono, party_id: null, duenio: 'PERSONA', urgente: false, estado: 'ABIERTA', tomado_por: 100n,
    ultima_actividad: new Date(), party: null, mensajes: [], identificador_tipo: 'TELEFONO',
  });
  const montar = (telefono: string, motivo: string | null) => {
    const prisma: any = {
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 100n }) },
      conversacion: { findUnique: jest.fn().mockResolvedValue(conv(telefono)), update: jest.fn() },
    };
    const gateway: any = { enviarTexto: jest.fn(), enviarPlantilla: jest.fn(), enviarImagen: jest.fn() };
    const numeros: any = { motivoOmision: jest.fn().mockResolvedValue(motivo) };
    const service = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, undefined, undefined, undefined, undefined, undefined, undefined, numeros);
    return { service, gateway };
  };

  it('número propio: 400 claro y no llama al gateway', async () => {
    const { service, gateway } = montar('977123456', 'DESTINO_NUMERO_PROPIO');
    await expect(service.enviar('1', 'hola', usuario as any)).rejects.toMatchObject({
      status: 400,
      response: { codigo: 'NUMERO_PROPIO', mensaje: 'Ese número es del propio negocio: no se le envía nada' },
    });
    await expect(service.reabrirConPlantilla('1', usuario as any)).rejects.toMatchObject({ status: 400 });
    expect(gateway.enviarTexto).not.toHaveBeenCalled();
    expect(gateway.enviarPlantilla).not.toHaveBeenCalled();
  });

  it('número bloqueado: 400 «Número bloqueado»', async () => {
    const { service, gateway } = montar('955111222', 'DESTINO_BLOQUEADO');
    await expect(service.enviar('1', 'hola', usuario as any)).rejects.toMatchObject({
      status: 400,
      response: { codigo: 'NUMERO_BLOQUEADO' },
    });
    expect(gateway.enviarTexto).not.toHaveBeenCalled();
  });
});
