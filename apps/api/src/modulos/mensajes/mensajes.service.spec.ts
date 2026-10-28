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
        findMany: jest.fn().mockResolvedValue([
          { id: 10n, autor: 'CLIENTE', direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'Hola' }, en: new Date() },
          { id: 11n, autor: 'BOT', direccion: 'SALE', tipo: 'TEXTO', contenido: { texto: '¡Hola!' }, en: new Date() },
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
    expect(r.chats[2].nombre).toBe('+51 9*** ***66');

    // Chat 4 sin teléfono muestra perfil de usuario de WhatsApp con prefijo Usuario de WhatsApp
    expect(r.chats[3].nombre).toBe('Usuario de WhatsApp (Usuario Sin Fono)');
    expect(r.chats[3].identificador_tipo).toBe('USUARIO_WA');
    expect(r.chats[3].telefono).toBe('***');

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
    // La foto del chat (sin pedido) queda enlazada al pedido aprobado como prueba
    // Solo las fotos de este chat hechas desde que se abrió el pedido (no las de pedidos anteriores)
    expect(prisma.voucherPago.updateMany).toHaveBeenCalledWith({
      where: { conversacion_id: 2n, pedido_id: null, creado_en: { gte: expect.any(Date) } },
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
  });
});
