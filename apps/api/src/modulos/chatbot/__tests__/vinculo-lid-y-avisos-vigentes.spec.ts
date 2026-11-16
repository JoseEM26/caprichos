jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import { normalizarMensajeEvolution, paresLidCelular } from '../evolution/evolution-mensaje.util';
import { EvolutionWebhookService } from '../evolution/evolution-webhook.service';

describe('A: vínculo LID ↔ celular', () => {
  it('remoteJidAlt junto al LID entrega el LID para vincular', () => {
    const n = normalizarMensajeEvolution({
      key: { id: 'A1', remoteJid: '1234567890123@lid', remoteJidAlt: '51987654321@s.whatsapp.net', fromMe: false },
      message: { conversation: 'hola' },
    });
    expect(n.ok && n.lid).toBe('1234567890123');
    expect(n.ok && n.msg.from).toBe('51987654321');
  });

  it('contacts.update con lid y jid produce el par; sin uno de los dos, nada', () => {
    expect(paresLidCelular({ id: '111@lid', jid: '51987654321@s.whatsapp.net' })).toEqual([{ lid: '111', celular: '51987654321' }]);
    expect(paresLidCelular({ id: '111@lid' })).toEqual([]);
  });

  const montar = (delLid: any, delTel: any) => {
    const prisma: any = {
      conversacion: {
        findUnique: jest.fn(async ({ where }: any) => (where.telefono.startsWith('wa-user:') ? delLid : delTel)),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const svc = new WhatsappWebhookService({ get: (_k: string, d?: any) => d } as unknown as ConfigService, prisma, {} as any, {} as any, { emitirAdmin: jest.fn() } as any);
    return { svc, prisma };
  };

  it('si no existe chat con el celular, el chat del LID pasa a ser el del celular', async () => {
    const { svc, prisma } = montar({ id: 4n, celular_vinculado: null }, null);
    expect(await svc.vincularLidConCelular('111', '51987654321')).toBe(true);
    expect(prisma.conversacion.update.mock.calls[0][0].data).toMatchObject({ telefono: '51987654321', identificador_tipo: 'TELEFONO' });
  });

  it('si ya existen ambos chats, el del LID guarda el celular vinculado (una sola vez)', async () => {
    const { svc, prisma } = montar({ id: 4n, celular_vinculado: null }, { id: 8n });
    expect(await svc.vincularLidConCelular('111', '51987654321')).toBe(true);
    expect(prisma.conversacion.update.mock.calls[0][0].data).toEqual({ celular_vinculado: '987654321' });
    const otra = montar({ id: 4n, celular_vinculado: '987654321' }, { id: 8n });
    expect(await otra.svc.vincularLidConCelular('111', '51987654321')).toBe(false);
  });

  it('sin chat del LID no hace nada', async () => {
    const { svc, prisma } = montar(null, null);
    expect(await svc.vincularLidConCelular('111', '51987654321')).toBe(false);
    expect(prisma.conversacion.update).not.toHaveBeenCalled();
  });

  it('el webhook de Evolution vincula con contacts.update y con un mensaje que trae remoteJidAlt', async () => {
    const web = { vincularLidConCelular: jest.fn().mockResolvedValue(true), procesarPayload: jest.fn() };
    const svc = new EvolutionWebhookService(new ConfigService({}), {} as any, { obtener: jest.fn().mockResolvedValue(null), borrar: jest.fn() } as any, web as any);
    await svc.procesar({ event: 'contacts.update', data: [{ id: '111@lid', jid: '51987654321@s.whatsapp.net' }] });
    expect(web.vincularLidConCelular).toHaveBeenCalledWith('111', '51987654321');
    web.vincularLidConCelular.mockClear();
    await svc.procesar({ event: 'messages.upsert', data: { key: { id: 'M', remoteJid: '222@lid', remoteJidAlt: '51911111111@s.whatsapp.net', fromMe: false }, message: { conversation: 'hola' } } });
    expect(web.vincularLidConCelular).toHaveBeenCalledWith('222', '51911111111');
  });
});

describe('C: avisos de pago vigentes', () => {
  const armar = (pedido: any) => {
    const prisma: any = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido) },
      salienteWhatsapp: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const svc = new OutboxWhatsappService(prisma, {} as any, {} as any);
    const fila: any = { id: 1n, pedido_id: 9n, origen: 'RECORDATORIO_PAGO', carga: { etapa: 'RECORDATORIO_PAGO', textoLibre: 'falta pagar' } };
    return { svc, prisma, fila };
  };

  it.each([
    ['pagado', { estado: 'LISTO', pago_estado: 'PAGADO' }],
    ['anulado', { estado: 'ANULADO', pago_estado: 'PENDIENTE' }],
    ['entregado', { estado: 'ENTREGADO', pago_estado: 'PENDIENTE' }],
  ])('recordatorio de pago de un pedido %s: se descarta con motivo y no se envía', async (_n, pedido) => {
    const { svc, prisma, fila } = armar(pedido);
    const r = await (svc as any).enviarFila(fila, 't');
    expect(r).toBe('OMITIDO');
    const data = prisma.salienteWhatsapp.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ estado: 'DESCARTADO' });
    expect(data.motivo_descarte).toMatch(/falta pagar/);
  });

  it('pedido aún pendiente: no se descarta', async () => {
    const { svc, fila } = armar({ estado: 'NUEVO', pago_estado: 'PENDIENTE' });
    expect(await (svc as any).motivoObsoleto(fila, fila.carga)).toBeNull();
  });
});
