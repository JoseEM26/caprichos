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
      caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }), findFirst: jest.fn().mockResolvedValue(null) },
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
          {
            id: 4n,
            telefono: 'wa-user:usr_meta_999',
            identificador_tipo: 'USUARIO_WA',
            nombre_contacto: 'Usuario Sin Fono',
            nombre_editado: false,
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
              nombre_contacto: 'Ana Perfil WA',
              nombre_editado: false,
              flujo: { nombre_perfil_wa: 'Ana Perfil WA' },
              identificador_tipo: 'TELEFONO',
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
              nombre_contacto: null,
              nombre_editado: false,
              flujo: {},
              identificador_tipo: 'TELEFONO',
              ultima_actividad: new Date(),
              party: { persona: { nombres: 'Rosa', apellidos: 'Díaz' } },
              tomadoPorUsuario: null,
            });
          }
          if (where.id === 4n) {
            return Promise.resolve({
              id: 4n,
              telefono: 'wa-user:usr_meta_999',
              identificador_tipo: 'USUARIO_WA',
              nombre_contacto: 'Usuario Sin Fono',
              nombre_editado: false,
              flujo: { nombre_perfil_wa: 'Usuario Sin Fono' },
              party_id: null,
              duenio: 'PERSONA',
              tomado_por: 100n,
              urgente: false,
              estado: 'ABIERTA',
              ultima_actividad: new Date(),
              party: null,
            });
          }
          if (where.id === 5n) {
            return Promise.resolve({
              id: 5n,
              telefono: '',
              identificador_tipo: 'USUARIO_WA',
              nombre_contacto: null,
              nombre_editado: false,
              flujo: {},
              party_id: null,
              duenio: 'PERSONA',
              tomado_por: 100n,
              urgente: false,
              estado: 'ABIERTA',
              ultima_actividad: new Date(),
              party: null,
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1n, ...data })),
      },
      mensajeChat: {
        findFirst: jest.fn().mockResolvedValue(null),
        // la base devuelve el más nuevo primero (orderBy id desc); el servicio los entrega en orden cronológico
        findMany: jest.fn().mockResolvedValue([
          { id: 11n, autor: 'BOT', direccion: 'SALE', tipo: 'TEXTO', contenido: { texto: '¡Hola!' }, en: new Date() },
          { id: 10n, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'Hola' }, en: new Date() },
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 500n) {
            return Promise.resolve({
              id: 500n,
              conversacion_id: 1n,
              direccion: 'SALE',
              autor: 'PERSONA',
              tipo: 'TEXTO',
              contenido: { texto: 'Texto que falló', estado: 'FALLIDO', errorCodigo: 'DESTINATARIO_NO_VERIFICADO' },
              en: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 500n, ...data })),
      },
      mensajeReparto: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
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
      voucherPago: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

  it('listar retorna chats, conteos y filtra por texto con nombres según jerarquía', async () => {
    const r = await service.listar('todos', '');
    expect(r.conteos.todos).toBe(4);
    expect(r.conteos.atender).toBe(2);
    expect(r.conteos.bot).toBe(2);
    expect(r.chats.length).toBe(4);

    // Chat 3 sin party muestra teléfono enmascarado (+51 9*** ***66)
    expect(r.chats.find((c) => c.id === '3')!.nombre).toBe('+51 9*** ***66');

    // Chat 4 sin teléfono muestra perfil de usuario de WhatsApp con prefijo Usuario de WhatsApp
    expect(r.chats.find((c) => c.id === '4')!.nombre).toBe('Usuario de WhatsApp (Usuario Sin Fono)');
    expect(r.chats.find((c) => c.id === '4')!.identificador_tipo).toBe('USUARIO_WA');
    expect(r.chats.find((c) => c.id === '4')!.telefono).toBe('***');

    const filtrado = await service.listar('todos', 'Ana');
    expect(filtrado.chats.length).toBe(1);
    expect(filtrado.chats[0].nombre).toBe('Ana Pérez');
  });

  describe('bloqueo por spam (fuente: Redis con TTL)', () => {
    const redisCon = (valores: Record<string, [string | null, number]>) => ({
      obtenerCliente: () => ({
        pipeline: () => {
          const cmds: Array<() => [null, unknown]> = [];
          const p: any = {
            get: (k: string) => cmds.push(() => [null, valores[k]?.[0] ?? null]),
            pttl: (k: string) => cmds.push(() => [null, valores[k]?.[1] ?? -2]),
            exec: async () => cmds.map((c) => c()),
          };
          return p;
        },
      }),
    });

    it('listar expone bloqueoSpam activo con hastaEn y reincidente, y lo cuenta', async () => {
      const redis: any = redisCon({ 'chatbot:spam:bloqueo:999888777': ['R', 600_000] });
      service = new MensajesService(prisma, auditoria, gateway, eventos, undefined, redis);
      const r = await service.listar('todos', '');
      const bloqueado = r.chats.find((c) => c.id === '1')!;
      expect(bloqueado.bloqueoSpam).toMatchObject({ activo: true, reincidente: true });
      expect(new Date(bloqueado.bloqueoSpam!.hastaEn!).getTime()).toBeGreaterThan(Date.now() + 500_000);
      expect(r.chats.find((c) => c.id === '2')!.bloqueoSpam).toEqual({ activo: false, hastaEn: null, reincidente: false });
      expect(r.conteos.bloqueadosSpam).toBe(1);
    });

    it('si Redis falla, bloqueoSpam es null y no se limpia ninguna marca', async () => {
      const redis: any = { obtenerCliente: () => ({ pipeline: () => { throw new Error('ECONNREFUSED'); } }) };
      prisma.conversacion.updateMany = jest.fn();
      service = new MensajesService(prisma, auditoria, gateway, eventos, undefined, redis);
      const r = await service.listar('todos', '');
      expect(r.chats.every((c) => c.bloqueoSpam === null)).toBe(true);
      expect(prisma.conversacion.updateMany).not.toHaveBeenCalled();
    });

    it('si el bloqueo caducó, limpia la marca motivo_derivacion y ya no manda', async () => {
      prisma.conversacion.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.conversacion.findMany.mockResolvedValueOnce([
        { id: 7n, telefono: '955444333', duenio: 'BOT', urgente: false, estado: 'ABIERTA', tomado_por: null, motivo_derivacion: 'BLOQUEADO_SPAM', ultima_actividad: new Date(), party: null, mensajes: [] },
      ]);
      service = new MensajesService(prisma, auditoria, gateway, eventos, undefined, redisCon({}) as any);
      const r = await service.listar('todos', '');
      expect(r.chats[0].bloqueoSpam?.activo).toBe(false);
      expect(prisma.conversacion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { motivo_derivacion: null } }),
      );
    });
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

  it('detalle incluye informacion del voucher para quien tiene permiso vouchers/ver', async () => {
    prisma.voucherPago.findFirst.mockResolvedValueOnce({
      id: 77n,
      semaforo: 'CONFIABLE',
      motivos: ['Datos conformes'],
      extraido: { legible: true, monto: 34.5 },
      medio: 'YAPE',
    });

    const d = await service.detalle('1', usuarioAdmin);
    expect(d.voucher).toBeDefined();
    expect(d.voucher.id).toBe('77');
    expect(d.voucher.semaforo).toBe('CONFIABLE');
    expect(d.voucher.medio).toBe('YAPE');
    expect(d.voucher.pedidoTotal).toBe('34.5');
  });

  it('detalle no incluye voucher si el usuario no tiene permiso vouchers/ver', async () => {
    prisma.voucherPago.findFirst.mockResolvedValueOnce({
      id: 77n,
      semaforo: 'CONFIABLE',
    });

    const usuarioCocina = { partyId: 30n, rol: 'COCINA', debeCambiar: false };
    const d = await service.detalle('1', usuarioCocina);
    expect(d.voucher).toBeNull();
  });

  it('detalle entrega la ubicación del cliente tal cual (lat, lng, dirección y aproximada)', async () => {
    const ubicacion = { lat: -12.07, lng: -77.04, nombre: 'Casa', direccion: 'Av. Brasil 1234', direccionAprox: 'Jesús María, Lima' };
    prisma.mensajeChat.findMany.mockResolvedValueOnce([
      { id: 13n, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'Hola' }, en: new Date() },
      { id: 12n, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'Av. Brasil 1234', ubicacion }, en: new Date() },
    ]);
    const d = await service.detalle('1', usuarioAdmin);
    expect(d.mensajes[0]).toMatchObject({ texto: 'Av. Brasil 1234', ubicacion });
    expect(d.mensajes[1].ubicacion).toBeNull();
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

  it('enviar conserva íntegros los emojis (ZWJ, bandera, tono) hasta el gateway', async () => {
    const t = 'Gracias 👩‍🍳🇵🇪👍🏽🍩❤️';
    await service.enviar('1', `  ${t}  `, usuarioAdmin);
    expect(gateway.enviarTexto).toHaveBeenCalledWith(1n, '999888777', t, 'PERSONA');
  });

  it('el DTO acepta emojis y pulir no los pierde', async () => {
    const { validate } = await import('class-validator');
    const { TextoDto } = await import('./dto/mensajes.dto');
    const d = Object.assign(new TextoDto(), { texto: 'Hola 👩‍🍳🇵🇪 gracias 🍩' });
    expect(await validate(d)).toHaveLength(0);
    expect(service.pulir('1', 'hola gracias 👩‍🍳🍩', 'Ana').texto).toContain('👩‍🍳🍩');
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

  it('aprobar pago con la caja cerrada -> CAJA_CERRADA y no cambia el pedido', async () => {
    prisma.caja.findUnique.mockResolvedValueOnce(null);
    await expect(service.aprobarPago('2', usuarioAdmin)).rejects.toMatchObject({
      response: { codigo: 'CAJA_CERRADA' },
    });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('aprobar pago de un delivery sin ubicación -> 409 DELIVERY_SIN_UBICACION y no cambia el pedido', async () => {
    prisma.pedido.findUnique = jest.fn().mockResolvedValue({ modalidad: 'DELIVERY', entrega_lat: null, entrega_lng: null, zona_id: null });
    await expect(service.aprobarPago('2', usuarioAdmin)).rejects.toMatchObject({
      response: { codigo: 'DELIVERY_SIN_UBICACION' },
    });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('aprobar pago cambia pedido a COORDINADO y avisa por WhatsAppGateway', async () => {
    await service.aprobarPago('2', usuarioAdmin);
    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50n },
        data: expect.objectContaining({ pago_estado: 'COORDINADO' }),
      }),
    );
    // La foto del chat (sin pedido) queda enlazada al pedido aprobado como prueba
    // Solo las fotos de este chat hechas desde que se abrió el pedido (no las de pedidos anteriores)
    expect(prisma.voucherPago.updateMany).toHaveBeenCalledWith({
      where: { conversacion_id: 2n, pedido_id: null, reemplazado_en: null, creado_en: { gte: expect.any(Date) } },
      data: { pedido_id: 50n },
    });
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

  describe('Responder a usuario identificado por BSUID (USUARIO_WA)', () => {
    it('permite enviar mensaje a contacto USUARIO_WA con su BSUID', async () => {
      gateway.enviarTexto.mockResolvedValueOnce({
        id: 'msg-bsuid-ok',
        autor: 'PERSONA',
        texto: 'Hola contacto BSUID',
        en: new Date(),
        metaId: 'wamid.bsuid.1',
        estado: 'ENVIADO',
      });

      const res = await service.enviar('4', 'Hola contacto BSUID', usuarioAdmin);
      expect(res.id).toBe('msg-bsuid-ok');
      expect(gateway.enviarTexto).toHaveBeenCalledWith(
        4n,
        'wa-user:usr_meta_999',
        'Hola contacto BSUID',
        'PERSONA',
      );
    });

    it('bloquea el envío solo si no hay ningún identificador (vacío)', async () => {
      await expect(service.enviar('5', 'Hola', usuarioAdmin)).rejects.toMatchObject({
        response: {
          codigo: 'CONTACTO_SIN_IDENTIFICADOR',
          mensaje: 'Este contacto no tiene ningun identificador: no se puede responder',
        },
      });
      expect(gateway.enviarTexto).not.toHaveBeenCalled();
    });
  });

  describe('editarNombre', () => {
    it('actualiza el nombre de contacto, establece nombre_editado=true, audita sin teléfono completo y emite socket', async () => {
      const res = await service.editarNombre('1', { nombre: 'Don Pepe Café' }, usuarioAdmin, '192.168.1.50');

      expect(res.ok).toBe(true);
      expect(prisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1n },
          data: {
            nombre_contacto: 'Don Pepe Café',
            nombre_editado: true,
          },
        }),
      );

      // Verificación estricta de auditoría: NUNCA teléfono completo
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'mensajes',
          accion: 'EDITAR_NOMBRE_CONTACTO',
          entidad: 'conversacion',
          entidadId: 1n,
          despues: {
            nombre_contacto: 'Don Pepe Café',
            nombre_editado: true,
            identificador_tipo: 'TELEFONO',
          },
        }),
      );

      const llamadaAuditoria = auditoria.registrar.mock.calls[0][0];
      const jsonAuditoria = JSON.stringify(llamadaAuditoria, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
      expect(jsonAuditoria).not.toContain('999888777'); // NUNCA teléfono completo

      expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '1' });
    });

    it('con revertir=true restaura el nombre original de WhatsApp y nombre_editado=false', async () => {
      const res = await service.editarNombre('1', { revertir: true }, usuarioAdmin);

      expect(res.ok).toBe(true);
      expect(prisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1n },
          data: {
            nombre_contacto: 'Ana Perfil WA',
            nombre_editado: false,
          },
        }),
      );

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'REVERTIR_NOMBRE_CONTACTO',
          despues: {
            nombre_contacto: 'Ana Perfil WA',
            nombre_editado: false,
            identificador_tipo: 'TELEFONO',
          },
        }),
      );
    });

    it('rechaza nombres inválidos: menores a 2 caracteres, mayores a 60 caracteres o solo espacios', async () => {
      await expect(service.editarNombre('1', { nombre: 'A' }, usuarioAdmin)).rejects.toMatchObject({
        response: { codigo: 'NOMBRE_INVALIDO' },
      });

      await expect(service.editarNombre('1', { nombre: '   ' }, usuarioAdmin)).rejects.toMatchObject({
        response: { codigo: 'NOMBRE_INVALIDO' },
      });

      await expect(service.editarNombre('1', { nombre: 'X'.repeat(61) }, usuarioAdmin)).rejects.toMatchObject({
        response: { codigo: 'NOMBRE_INVALIDO' },
      });
    });
  });

  describe('Control de ventana de 24 horas', () => {
    let ventana24h: any;

    beforeEach(() => {
      ventana24h = {
        esVentanaAbierta: jest.fn().mockResolvedValue(true),
      };
      service = new MensajesService(prisma, auditoria, gateway, eventos, ventana24h);
    });

    it('permite enviar texto libre cuando la ventana está abierta', async () => {
      ventana24h.esVentanaAbierta.mockResolvedValue(true);
      const res = await service.enviar('1', 'Hola cliente dentro de 24h', usuarioAdmin);
      expect(res.id).toBe('msg-1');
      expect(ventana24h.esVentanaAbierta).toHaveBeenCalledWith('999888777', 1n);
      expect(gateway.enviarTexto).toHaveBeenCalled();
    });

    it('rechaza texto libre con 409 VENTANA_CERRADA cuando pasaron más de 24 horas', async () => {
      ventana24h.esVentanaAbierta.mockResolvedValue(false);
      let errorCapturado: any;
      try {
        await service.enviar('1', 'Hola cliente fuera de 24h', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado).toBeDefined();
      expect(errorCapturado.getStatus()).toBe(409);
      expect(errorCapturado.getResponse()).toEqual({
        codigo: 'VENTANA_CERRADA',
        mensaje:
          'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
        plantillaReapertura: 'caprichos_reabrir_conversacion',
      });
      expect(gateway.enviarTexto).not.toHaveBeenCalled();
    });

    it('reabrirConPlantilla envía la plantilla caprichos_reabrir_conversacion y audita', async () => {
      gateway.enviarPlantilla = jest.fn().mockResolvedValue({
        id: 'msg-plantilla-1',
        autor: 'PERSONA',
        texto: '[Plantilla: caprichos_reabrir_conversacion]',
        metaId: 'wamid.123',
        estado: 'ENVIADO',
      });

      const res = await service.reabrirConPlantilla('1', usuarioAdmin, '192.168.1.10');
      expect(res.ok).toBe(true);
      expect(gateway.enviarPlantilla).toHaveBeenCalledWith(
        1n,
        '999888777',
        'caprichos_reabrir_conversacion',
        ['Ana Perfil WA'],
        'PERSONA',
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ENVIAR_PLANTILLA_REAPERTURA',
          entidad: 'conversacion',
          entidadId: 1n,
        }),
      );
    });
  });

  describe('Reabrir con plantilla: no repetir (cada una cuesta en Meta)', () => {
    const montarPlantilla = (previa: Date | null) => {
      prisma.mensajeChat.findFirst = jest.fn().mockResolvedValue(previa ? { en: previa } : null);
      gateway.enviarPlantilla = jest.fn().mockResolvedValue({ id: 'm2', autor: 'PERSONA', texto: 'x', metaId: 'w', estado: 'ENVIADO' });
    };

    it('otra plantilla dentro de 60 min: 409 PLANTILLA_RECIENTE con la hora y no envía', async () => {
      const antes = new Date(Date.now() - 10 * 60 * 1000);
      montarPlantilla(antes);
      await expect(service.reabrirConPlantilla('1', usuarioAdmin)).rejects.toMatchObject({
        status: 409,
        response: { codigo: 'PLANTILLA_RECIENTE', enviadaEn: antes.toISOString() },
      });
      expect(gateway.enviarPlantilla).not.toHaveBeenCalled();
    });

    it('con forzar envía igual y deja constancia en la auditoría', async () => {
      montarPlantilla(new Date());
      const res = await service.reabrirConPlantilla('1', usuarioAdmin, '1.1.1.1', true);
      expect(res.ok).toBe(true);
      expect(gateway.enviarPlantilla).toHaveBeenCalledTimes(1);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ENVIAR_PLANTILLA_REAPERTURA', despues: expect.objectContaining({ forzado: true }) }),
      );
    });

    it('sin plantilla reciente envía normal (la consulta mira solo la última hora)', async () => {
      montarPlantilla(null);
      await service.reabrirConPlantilla('1', usuarioAdmin);
      const donde = prisma.mensajeChat.findFirst.mock.calls[0][0].where;
      expect(donde).toMatchObject({ conversacion_id: 1n, tipo: 'PLANTILLA', direccion: 'SALE' });
      expect(gateway.enviarPlantilla).toHaveBeenCalledTimes(1);
    });
  });

  describe('Límite de tasa por usuario (20 mensajes/minuto)', () => {
    let redisClient: any;
    let redisService: any;

    beforeEach(() => {
      redisClient = {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      };
      redisService = {
        obtenerCliente: jest.fn().mockReturnValue(redisClient),
      };
      service = new MensajesService(prisma, auditoria, gateway, eventos, undefined, redisService);
    });

    it('permite el envío e incrementa el contador cuando no supera 20 mensajes', async () => {
      redisClient.incr.mockResolvedValue(5);

      const res = await service.enviar('1', 'Mensaje dentro del límite', usuarioAdmin);
      expect(res.id).toBe('msg-1');
      expect(redisClient.incr).toHaveBeenCalledWith('ratelimit:mensajes:usuario:10');
    });

    it('bloquea con 429 LIMITE_ENVIO cuando el usuario supera 20 mensajes en el minuto', async () => {
      redisClient.incr.mockResolvedValue(21);

      let errorCapturado: any;
      try {
        await service.enviar('1', 'Mensaje bloqueado por tasa', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado).toBeDefined();
      expect(errorCapturado.getStatus()).toBe(429);
      expect(errorCapturado.getResponse().codigo).toBe('LIMITE_ENVIO');
      expect(errorCapturado.getResponse().mensaje).toContain('Superaste el limite de 20 mensajes por minuto');
      expect(gateway.enviarTexto).not.toHaveBeenCalled();
    });
  });

  describe('Reintentar mensaje fallido', () => {
    beforeEach(() => {
      prisma.mensajeChat.findFirst = jest.fn().mockImplementation(({ where }) => {
        if (where.id === 500n && where.conversacion_id === 1n) {
          return Promise.resolve({
            id: 500n,
            conversacion_id: 1n,
            direccion: 'SALE',
            autor: 'PERSONA',
            tipo: 'TEXTO',
            contenido: { texto: 'Texto que falló', estado: 'FALLIDO', errorCodigo: 'DESTINATARIO_NO_VERIFICADO' },
            en: new Date(),
          });
        }
        return Promise.resolve(null);
      });
      service = new MensajesService(prisma, auditoria, gateway, eventos);
    });

    it('reintenta con éxito y actualiza el mensaje anterior', async () => {
      gateway.enviarTexto.mockResolvedValue({
        id: 'msg-reintento-ok',
        autor: 'PERSONA',
        texto: 'Texto que falló',
        metaId: 'wamid.retry.123',
        estado: 'ENVIADO',
      });

      const res = await service.reintentarMensaje('1', '500', usuarioAdmin);
      expect(res.ok).toBe(true);
      expect(res.id).toBe('500');
      expect(gateway.enviarTexto).toHaveBeenCalledWith(1n, '999888777', 'Texto que falló', 'PERSONA');
      expect(prisma.mensajeChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 500n },
          data: expect.objectContaining({
            meta_id: 'wamid.retry.123',
          }),
        }),
      );
    });

    it('falla con 404 si el mensaje no existe en la conversación', async () => {
      await expect(service.reintentarMensaje('1', '99999', usuarioAdmin)).rejects.toMatchObject({
        response: { codigo: 'MENSAJE_NO_ENCONTRADO' },
      });
    });
  });

  describe('Mapeo de errores de Meta en el envío', () => {
    it('mapea DESTINATARIO_NO_VERIFICADO a mensaje comprensible en español sin secretos', async () => {
      gateway.enviarTexto.mockResolvedValue({
        id: 'msg-fallido',
        autor: 'PERSONA',
        texto: 'Hola',
        metaId: null,
        estado: 'FALLIDO',
        errorCodigo: 'DESTINATARIO_NO_VERIFICADO',
        errorDetalle: 'Recipient phone number not in allowed list',
      });

      let errorCapturado: any;
      try {
        await service.enviar('1', 'Hola', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado).toBeDefined();
      expect(errorCapturado.getStatus()).toBe(400);
      expect(errorCapturado.getResponse().codigo).toBe('DESTINATARIO_NO_VERIFICADO');
      expect(errorCapturado.getResponse().mensaje).toBe('Este numero no esta autorizado en el numero de prueba de Meta');
    });

    it('mapea TOKEN_VENCIDO a mensaje claro para el usuario', async () => {
      gateway.enviarTexto.mockResolvedValue({
        id: 'msg-fallido-token',
        autor: 'PERSONA',
        texto: 'Hola',
        metaId: null,
        estado: 'FALLIDO',
        errorCodigo: 'TOKEN_VENCIDO',
      });

      let errorCapturado: any;
      try {
        await service.enviar('1', 'Hola', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado).toBeDefined();
      expect(errorCapturado.getStatus()).toBe(400);
      expect(errorCapturado.getResponse().codigo).toBe('TOKEN_VENCIDO');
      expect(errorCapturado.getResponse().mensaje).toBe('El acceso a WhatsApp vencio: avisa a quien administra la cuenta');
    });

    it('mapea BSUID_NO_PERMITIDO a mensaje claro y sin secretos técnicos', async () => {
      gateway.enviarTexto.mockResolvedValue({
        id: 'msg-fallido-bsuid',
        autor: 'PERSONA',
        texto: 'Hola',
        metaId: null,
        estado: 'FALLIDO',
        errorCodigo: 'BSUID_NO_PERMITIDO',
        errorDetalle: 'Invalid recipient format for BSUID parameter 100',
      });

      let errorCapturado: any;
      try {
        await service.enviar('1', 'Hola', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado).toBeDefined();
      expect(errorCapturado.getStatus()).toBe(400);
      expect(errorCapturado.getResponse().codigo).toBe('BSUID_NO_PERMITIDO');
      expect(errorCapturado.getResponse().mensaje).toBe(
        'Meta no permite escribir a este contacto por su identificador. Pidele su numero de celular.',
      );
    });

    it('mapea los códigos de plantilla de Meta a su causa y acción, sin el genérico «no esta aprobada»', async () => {
      gateway.enviarTexto.mockResolvedValue({
        id: 'msg-plantilla',
        autor: 'PERSONA',
        texto: 'Hola',
        metaId: null,
        estado: 'FALLIDO',
        errorCodigo: 'PLANTILLA_FORMATO_VARIABLE',
        errorDetalle: '[132012] Parameter format does not match format in the created template',
      });

      let errorCapturado: any;
      try {
        await service.enviar('1', 'Hola', usuarioAdmin);
      } catch (e) {
        errorCapturado = e;
      }

      expect(errorCapturado.getResponse().codigo).toBe('PLANTILLA_FORMATO_VARIABLE');
      expect(errorCapturado.getResponse().mensaje).toContain('formato que Meta no admite');
      expect(errorCapturado.getResponse().mensaje).not.toContain('no esta aprobada');
    });
  });

  describe('Detalle técnico de un envío fallido (solo ADMIN)', () => {
    const fallido = {
      id: 40n,
      autor: 'PERSONA',
      direccion: 'SALE',
      tipo: 'TEXTO',
      contenido: { estado: 'FALLIDO', errorCodigo: 'PLANTILLA_FORMATO_VARIABLE', errorDetalle: '[132012] Parameter format does not match' },
      en: new Date(),
    };

    it('ADMIN ve el código de Meta y el texto original; el resto solo la causa amigable', async () => {
      prisma.mensajeChat.findMany.mockResolvedValueOnce([fallido]);
      const admin = await service.detalle('1', usuarioAdmin);
      expect(admin.mensajes[0]).toMatchObject({
        estado: 'FALLIDO',
        errorCodigo: 'PLANTILLA_FORMATO_VARIABLE',
        metaCodigo: '132012',
        errorDetalle: 'Parameter format does not match',
      });
      expect(admin.mensajes[0].motivoFallo).toContain('formato que Meta no admite');

      prisma.mensajeChat.findMany.mockResolvedValueOnce([fallido]);
      const cocina = await service.detalle('1', { partyId: 30n, rol: 'COCINA', debeCambiar: false });
      expect(cocina.mensajes[0]).toMatchObject({ errorCodigo: null, errorDetalle: null, metaCodigo: null });
      expect(cocina.mensajes[0].motivoFallo).toContain('formato que Meta no admite');
    });
  });

  describe('Historial paginado y envío idempotente', () => {
    const fila = (id: bigint) => ({ id, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: `m${id}` }, en: new Date() });

    it('detalle pide una página (limite + 1, más nuevo primero) y la entrega en orden cronológico', async () => {
      const limite = MensajesService.PAGINA_MENSAJES;
      // la base devuelve limite + 1 filas, de la 100 hacia abajo: sobra una = hay más anteriores
      prisma.mensajeChat.findMany.mockResolvedValueOnce(Array.from({ length: limite + 1 }, (_, i) => fila(BigInt(100 - i))));
      const d: any = await service.detalle('1', usuarioAdmin);
      const args = prisma.mensajeChat.findMany.mock.calls[0][0];
      expect(args).toMatchObject({ orderBy: { id: 'desc' }, take: limite + 1, where: { conversacion_id: 1n } });
      expect(d.mensajes).toHaveLength(limite);
      expect(d.hayMasAnteriores).toBe(true);
      const ids = d.mensajes.map((m: any) => BigInt(m.id));
      expect(ids[ids.length - 1]).toBe(100n);
      expect([...ids].sort((a, b) => Number(a - b))).toEqual(ids); // ascendente: orden de lectura
    });

    it('con pocos mensajes no hay más anteriores y la forma de la respuesta no cambia', async () => {
      const d: any = await service.detalle('1', usuarioAdmin);
      expect(d.hayMasAnteriores).toBe(false);
      expect(d.mensajes.map((m: any) => m.id)).toEqual(['10', '11']);
      expect(Object.keys(d.mensajes[0])).toEqual(
        expect.arrayContaining(['id', 'autor', 'saliente', 'imagen', 'imagenId', 'texto', 'plantilla', 'audioId', 'documento', 'ubicacion', 'hora', 'fecha', 'estado', 'motivoFallo']),
      );
    });

    it('mensajesAnteriores usa el cursor, no recalcula pedido ni voucher y devuelve solo mensajes + hayMasAnteriores', async () => {
      prisma.mensajeChat.findMany.mockResolvedValueOnce([fila(9n), fila(8n)]);
      const r: any = await service.mensajesAnteriores('1', '10', usuarioAdmin);
      expect(prisma.mensajeChat.findMany.mock.calls[0][0].where).toMatchObject({ conversacion_id: 1n, id: { lt: 10n } });
      expect(r.mensajes.map((m: any) => m.id)).toEqual(['8', '9']);
      expect(r.hayMasAnteriores).toBe(false);
      expect(Object.keys(r).sort()).toEqual(['hayMasAnteriores', 'mensajes']);
      expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
      await expect(service.mensajesAnteriores('1', 'abc', usuarioAdmin)).rejects.toMatchObject({ status: 400 });
    });

    describe('idCliente (idempotencia del envío)', () => {
      let redisClient: any;
      beforeEach(() => {
        const vistos = new Set<string>();
        redisClient = {
          incr: jest.fn().mockResolvedValue(1),
          expire: jest.fn().mockResolvedValue(1),
          // SET ... NX: 'OK' la primera vez, null si ya existía
          set: jest.fn().mockImplementation(async (k: string) => (vistos.has(k) ? null : (vistos.add(k), 'OK'))),
        };
        service = new MensajesService(prisma, auditoria, gateway, eventos, undefined, { obtenerCliente: () => redisClient } as any);
      });

      it('el mismo idCliente dos veces escribe UNA sola vez al cliente', async () => {
        const a = await service.enviar('1', 'Hola', usuarioAdmin, undefined, 'tmp-1');
        const b: any = await service.enviar('1', 'Hola', usuarioAdmin, undefined, 'tmp-1');
        expect(a).toEqual({ id: 'msg-1' });
        expect(b).toEqual({ id: '', duplicado: true });
        expect(gateway.enviarTexto).toHaveBeenCalledTimes(1);
      });

      it('idCliente distintos envían los dos; sin idCliente se comporta como siempre', async () => {
        await service.enviar('1', 'Uno', usuarioAdmin, undefined, 'tmp-1');
        await service.enviar('1', 'Dos', usuarioAdmin, undefined, 'tmp-2');
        await service.enviar('1', 'Tres', usuarioAdmin);
        expect(gateway.enviarTexto).toHaveBeenCalledTimes(3);
      });

      it('un envío rechazado por validación no consume el idCliente (se puede reintentar con el mismo)', async () => {
        await expect(service.enviar('1', '   ', usuarioAdmin, undefined, 'tmp-9')).rejects.toThrow();
        expect(redisClient.set).not.toHaveBeenCalled();
      });
    });
  });
});
