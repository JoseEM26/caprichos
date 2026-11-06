jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  })),
  JwtModule: {
    registerAsync: jest.fn().mockReturnValue({
      module: class MockJwtModule {},
    }),
  },
}));

import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { RepartosChatService, HORAS_CHAT_TRAS_ENTREGA } from './repartos-chat.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('RepartosChatService: chat de WhatsApp de un pedido del repartidor', () => {
  const repartidor: UsuarioAutenticado = { partyId: 1001n, rol: 'REPARTIDOR', debeCambiar: false };
  const ajeno: UsuarioAutenticado = { partyId: 1002n, rol: 'REPARTIDOR', debeCambiar: false };
  const hace = (min: number) => new Date(Date.now() - min * 60_000);
  let pedido: any;
  let prisma: any;
  let mensajes: any;
  let auditoria: any;
  let ventana: any;
  let servicio: RepartosChatService;

  beforeEach(() => {
    pedido = {
      id: 7n, codigo: 'P-7', estado: 'EN_CAMINO', anulado_en: null, entregado_en: null,
      repartidor_party_id: 1001n, cliente_telefono: '987654321', cliente_nombre: 'Ana', party_id: null,
      creado_en: hace(30),
    };
    prisma = {
      pedido: { findUnique: jest.fn(async () => pedido) },
      conversacion: {
        findFirst: jest.fn(async () => ({ id: 50n, telefono: '51987654321', nombre_contacto: 'Ana Q.', tomado_por: null, ultima_actividad: new Date() })),
      },
      mensajeChat: {
        findMany: jest.fn(async () => [
          { id: 2n, autor: 'BOT', tipo: 'TEXTO', contenido: { texto: 'Tu pedido sale ya' }, en: hace(10) },
          { id: 1n, autor: 'CLIENTE', tipo: 'IMAGEN', contenido: {}, en: hace(20) },
        ]),
      },
    };
    mensajes = { enviar: jest.fn(async () => ({ id: 'm-9' })) };
    auditoria = { registrar: jest.fn(async () => undefined) };
    ventana = { esVentanaAbierta: jest.fn(async () => true) };
    servicio = new RepartosChatService(prisma, mensajes, auditoria, ventana);
  });

  it('rechaza a un repartidor que no tiene el pedido asignado (403)', async () => {
    await expect(servicio.obtenerChat('7', ajeno)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.enviar('7', 'hola', ajeno)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mensajes.enviar).not.toHaveBeenCalled();
  });

  it('rechaza un pedido entregado hace más de 2 horas (403)', async () => {
    pedido.estado = 'ENTREGADO';
    pedido.entregado_en = hace(HORAS_CHAT_TRAS_ENTREGA * 60 + 5);
    await expect(servicio.obtenerChat('7', repartidor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.enviar('7', 'hola', repartidor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sigue abierto si se entregó hace menos de 2 horas', async () => {
    pedido.estado = 'ENTREGADO';
    pedido.entregado_en = hace(30);
    const r = await servicio.obtenerChat('7', repartidor);
    expect(r.disponible).toBe(true);
  });

  it('solo trae mensajes de esa conversación desde que se creó el pedido', async () => {
    await servicio.obtenerChat('7', repartidor);
    const filtro = prisma.mensajeChat.findMany.mock.calls[0][0];
    expect(filtro.where.conversacion_id).toBe(50n);
    expect(filtro.where.en).toEqual({ gte: pedido.creado_en });
  });

  it('enmascara el teléfono y marca mensajes del cliente y del local', async () => {
    const r: any = await servicio.obtenerChat('7', repartidor);
    expect(r.cliente.telefono).not.toContain('987654321');
    expect(r.mensajes.map((m: any) => m.de)).toEqual(['cliente', 'local']);
    expect(r.mensajes[0].texto).toBe('[imagen]');
  });

  it('sin conversación de WhatsApp vinculable, dice que el cliente no tiene chat', async () => {
    prisma.conversacion.findFirst.mockResolvedValueOnce(null);
    const r = await servicio.obtenerChat('7', repartidor);
    expect(r).toEqual({ disponible: false, motivo: 'Este cliente no tiene chat' });
  });

  it('envía por MensajesService a la conversación del pedido y audita con el pedido', async () => {
    const r = await servicio.enviar('7', 'Ya llegamos', repartidor, '10.0.0.1');
    expect(r).toEqual({ id: 'm-9' });
    expect(mensajes.enviar).toHaveBeenCalledWith('50', 'Ya llegamos', repartidor, '10.0.0.1');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'repartos', accion: 'CHAT_ENVIAR', entidad: 'pedido', entidadId: 7n, partyId: 1001n }),
    );
  });

  it('con la ventana de 24 h cerrada no envía y explica que el local debe escribir', async () => {
    mensajes.enviar.mockRejectedValueOnce(new HttpException({ codigo: 'VENTANA_CERRADA', mensaje: 'plantillas' }, 409));
    const err = await servicio.enviar('7', 'hola', repartidor).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().mensaje).toMatch(/Pasaron 24 h sin respuesta del cliente; el local debe escribirle/);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('no envía si el local está atendiendo el chat', async () => {
    prisma.conversacion.findFirst.mockResolvedValueOnce({ id: 50n, telefono: '51987654321', tomado_por: 3n });
    await expect(servicio.enviar('7', 'hola', repartidor)).rejects.toBeInstanceOf(ConflictException);
    expect(mensajes.enviar).not.toHaveBeenCalled();
  });
});
