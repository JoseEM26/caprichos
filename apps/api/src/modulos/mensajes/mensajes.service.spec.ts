jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { MensajesService } from './mensajes.service';

describe('MensajesService', () => {
  let prisma: any;
  let auditoria: any;
  let gateway: any;
  let eventos: any;
  let service: MensajesService;

  const usuarioAdmin = { partyId: 10n, rol: 'ADMIN', debeCambiar: false };
  const usuarioOtro = { partyId: 20n, rol: 'ADMIN', debeCambiar: false };

  beforeEach(() => {
    prisma = {
      userAccount: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.party_id === 10n) return Promise.resolve({ id: 100n });
          if (where.party_id === 20n) return Promise.resolve({ id: 200n });
          return Promise.resolve(null);
        }),
      },
      conversacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            telefono: '999888777',
            party_id: 1n,
            duenio: 'PERSONA',
            urgente: true,
            estado: 'ABIERTA',
            tomado_por: 100n,
            ultima_actividad: new Date(),
            party: { persona: { nombres: 'Ana', apellidos: 'Pérez' } },
            mensajes: [
              { autor: 'CLIENTE', tipo: 'TEXTO', contenido: { texto: 'Mi pedido llegó sin salsa' }, en: new Date() },
            ],
          },
          {
            id: 2n,
            telefono: '977666555',
            party_id: 2n,
            duenio: 'PERSONA',
            urgente: false,
            estado: 'VALIDAR_PAGO',
            tomado_por: null,
            ultima_actividad: new Date(),
            party: { persona: { nombres: 'Rosa', apellidos: 'Díaz' } },
            mensajes: [
              { autor: 'CLIENTE', tipo: 'IMAGEN', contenido: { texto: '[Imagen: comprobante Yape]' }, en: new Date() },
            ],
          },
          {
            id: 3n,
            telefono: '988777666',
            party_id: null,
            duenio: 'BOT',
            urgente: false,
            estado: 'ABIERTA',
            tomado_por: null,
            ultima_actividad: new Date(),
            party: null,
            mensajes: [],
          },
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 1n) {
            return Promise.resolve({
              id: 1n,
              telefono: '999888777',
              party_id: 1n,
              duenio: 'PERSONA',
              urgente: true,
              estado: 'ABIERTA',
              tomado_por: 100n,
              ultima_actividad: new Date(),
              party: { persona: { nombres: 'Ana', apellidos: 'Pérez' } },
              tomadoPorUsuario: { party: { persona: { nombres: 'Kevin', apellidos: 'R.' } } },
            });
          }
          if (where.id === 2n) {
            return Promise.resolve({
              id: 2n,
              telefono: '977666555',
              party_id: 2n,
              duenio: 'BOT',
              urgente: false,
              estado: 'VALIDAR_PAGO',
              tomado_por: null,
              ultima_actividad: new Date(),
              party: { persona: { nombres: 'Rosa', apellidos: 'Díaz' } },
              tomadoPorUsuario: null,
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockResolvedValue({ id: 1n }),
      },
      mensajeChat: {
        findMany: jest.fn().mockResolvedValue([
          { id: 10n, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'Hola' }, en: new Date() },
          { id: 11n, autor: 'BOT', direccion: 'SALE', tipo: 'TEXTO', contenido: { texto: '¡Hola!' }, en: new Date() },
        ]),
      },
      pedido: {
        findFirst: jest.fn().mockResolvedValue({
          id: 50n,
          codigo: 'CP-0002',
          total: 34.5,
          pago_preferido: 'Yape',
          pago_metodo: 'YAPE',
          modalidad: 'DELIVERY',
          estado: 'COLA',
          lineas: [{ id: 1n, cantidad: 1, nombre: 'Frappe Oreo', tamano: 'Grande 16 oz', opciones: ['Chantilly'] }],
        }),
        update: jest.fn().mockResolvedValue({ id: 50n }),
      },
      solicitudCambio: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      parametro: {
        findUnique: jest.fn().mockResolvedValue({ clave: 'tiempo_prometido_min', valor: '25' }),
      },
      altaDemanda: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      respuestaRapida: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, titulo: 'Pedido listo', texto: 'Tu pedido ya está listo.', activo: true },
        ]),
      },
    };

    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    gateway = {
      enviarTexto: jest.fn().mockResolvedValue({ id: 'msg-1', autor: 'PERSONA', texto: 'Hola', en: new Date(), metaId: null }),
    };
    eventos = { emitirAdmin: jest.fn() };

    service = new MensajesService(prisma, auditoria, gateway, eventos);
  });

  it('listar retorna chats, conteos y filtra por texto', async () => {
    const r = await service.listar('todos', '');
    expect(r.conteos.todos).toBe(3);
    expect(r.conteos.atender).toBe(2);
    expect(r.conteos.bot).toBe(1);
    expect(r.chats.length).toBe(3);

    const filtrado = await service.listar('todos', 'Ana');
    expect(filtrado.chats.length).toBe(1);
    expect(filtrado.chats[0].nombre).toBe('Ana Pérez');
  });

  it('detalle retorna la información de la conversación y pedido asociado', async () => {
    const d = await service.detalle('1', usuarioAdmin);
    expect(d.id).toBe('1');
    expect(d.nombre).toBe('Ana Pérez');
    expect(d.estado).toBe('atencion');
    expect(d.mensajes.length).toBe(2);
    expect(d.esMio).toBe(true);
    expect(d.ocupado).toBe(false);
  });

  it('respuestasRapidas lista las plantillas activas', async () => {
    const rr = await service.respuestasRapidas();
    expect(rr.length).toBe(1);
    expect(rr[0].titulo).toBe('Pedido listo');
  });

  it('enviar rechaza mensaje vacío y exige que el chat esté libre o tomado', async () => {
    await expect(service.enviar('1', '   ', usuarioAdmin)).rejects.toThrow();

    // Otro usuario intenta escribir en chat tomado por usuarioAdmin (id 100n)
    let err: any;
    try {
      await service.enviar('1', 'Hola', usuarioOtro);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.getResponse().mensaje).toContain('Este chat lo atiende');
  });

  it('enviar exitoso llama al gateway, actualiza actividad y audita', async () => {
    const res = await service.enviar('1', 'Hola Ana, te ayudamos', usuarioAdmin);
    expect(res.id).toBe('msg-1');
    expect(gateway.enviarTexto).toHaveBeenCalledWith(1n, '999888777', 'Hola Ana, te ayudamos', 'PERSONA');
    expect(prisma.conversacion.update).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('pulir mensaje devuelve texto más formal y amable', () => {
    const p = service.pulir('1', 'ya va tu pedido', 'Ana Pérez');
    expect(p.texto).toContain('Ana');
    expect(p.texto).toMatch(/pedido|camino|preparando/i);
  });

  it('tomar chat asigna tomado_por al usuario y soltar lo libera', async () => {
    await service.tomar('2', false, usuarioAdmin);
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2n },
        data: expect.objectContaining({ tomado_por: 100n, duenio: 'PERSONA' }),
      }),
    );

    await service.soltar('1', usuarioAdmin);
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ tomado_por: null, tomado_en: null }),
      }),
    );
  });

  it('pausar y reanudar bot', async () => {
    await service.pausar('2', usuarioAdmin);
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duenio: 'PERSONA', urgente: false }),
      }),
    );

    await service.reanudar('2', usuarioAdmin);
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duenio: 'BOT', urgente: false, tomado_por: null }),
      }),
    );
  });

  it('aprobar pago cambia pedido a COORDINADO y avisa por WhatsAppGateway', async () => {
    await service.aprobarPago('2', usuarioAdmin);
    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50n },
        data: expect.objectContaining({ pago_estado: 'COORDINADO' }),
      }),
    );
    expect(gateway.enviarTexto).toHaveBeenCalledWith(
      2n,
      '977666555',
      expect.stringContaining('Pago verificado'),
      'BOT',
    );
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'ATENDIDA', duenio: 'BOT' }),
      }),
    );
  });

  it('rechazar pago avisa al cliente y vuelve a ABIERTA', async () => {
    await service.rechazarPago('2', usuarioAdmin);
    expect(gateway.enviarTexto).toHaveBeenCalledWith(
      2n,
      '977666555',
      expect.stringContaining('No pudimos verificar tu pago'),
      'BOT',
    );
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'ABIERTA', duenio: 'BOT' }),
      }),
    );
  });
});
