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

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AccesoGuard } from '../../../acceso/acceso.guard';
import { ChatbotConfiguracionService } from '../chatbot-configuracion.service';
import { ChatbotConfiguracionController } from '../chatbot-configuracion.controller';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { AuditoriaService } from '../../../auditoria/auditoria.service';
import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { ActualizarAntiSpamDto } from '../dto/chatbot-configuracion.dto';
import { TEXTOS_BOT_DEFECTO, LIMITE_CUERPO_TEXTO } from '../chatbot-configuracion.tipos';

describe('ChatbotConfiguracionService y Controller (Ola 4, Agente I)', () => {
  let service: ChatbotConfiguracionService;
  let controller: ChatbotConfiguracionController;
  let prisma: any;
  let redis: any;
  let auditoria: any;

  const mockRedisClient = {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    exists: jest.fn().mockResolvedValue(0), // bloqueo por spam: sin bloqueo vigente
  };

  const mockUsuario = {
    id: BigInt(1),
    partyId: BigInt(10),
    username: 'admin',
    rol: 'ADMIN',
    roles: ['ADMIN'],
    permisos: ['configuracion/ver', 'configuracion/editar'],
  };

  beforeEach(async () => {
    prisma = {
      parametro: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      conversacion: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      mensajeChat: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      clienteWhatsappConsentimiento: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      pedido: {
        findMany: jest.fn(),
      },
    };

    redis = {
      obtenerCliente: jest.fn().mockReturnValue(mockRedisClient),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotConfiguracionController],
      providers: [
        ChatbotConfiguracionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<ChatbotConfiguracionService>(ChatbotConfiguracionService);
    controller = module.get<ChatbotConfiguracionController>(ChatbotConfiguracionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Obtención de Configuración', () => {
    it('devuelve valores por defecto si no existen parámetros en la base de datos', async () => {
      prisma.parametro.findMany.mockResolvedValue([]);

      const config = await service.obtenerConfiguracion();

      expect(config.textos.chatbot_texto_bienvenida).toBe(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida);
      expect(config.textos.chatbot_texto_despedida).toBe(TEXTOS_BOT_DEFECTO.chatbot_texto_despedida);
      expect(config.funciones.pedido).toBe(true);
      expect(config.funciones.pago).toBe(true);
      expect(config.funciones.reservas).toBe(true);
      expect(config.funciones.cambios).toBe(true);
      expect(config.funciones.ia).toBe(false);
      expect(config.funciones.promociones).toBe(true);
      expect(config.antiSpam.maxPorMinuto).toBe(10);
      expect(config.antiSpam.maxPorHora).toBe(60);
      expect(config.privacidad.diasRetencion).toBe(90);
    });

    it('devuelve valores configurados en la base de datos cuando existen', async () => {
      prisma.parametro.findMany.mockResolvedValue([
        { clave: 'chatbot_texto_bienvenida', valor: '¡Hola bienvenido a Caprichos! ☕' },
        { clave: 'chatbot_funcion_ia', valor: 'si' },
        { clave: 'chatbot_ia_activo', valor: 'si' },
        { clave: 'chatbot_funcion_reservas', valor: 'no' },
        { clave: 'chatbot_antispam_max_minuto', valor: 5 },
        { clave: 'chatbot_retencion_dias', valor: 60 },
      ]);

      const config = await service.obtenerConfiguracion();

      expect(config.textos.chatbot_texto_bienvenida).toBe('¡Hola bienvenido a Caprichos! ☕');
      expect(config.funciones.ia).toBe(true);
      expect(config.funciones.reservas).toBe(false);
      expect(config.antiSpam.maxPorMinuto).toBe(5);
      expect(config.privacidad.diasRetencion).toBe(60);
    });
  });

  describe('2. Textos editables y límites de WhatsApp', () => {
    it('permite actualizar textos válidos y audita el cambio', async () => {
      prisma.parametro.findMany.mockResolvedValue([]);
      prisma.parametro.upsert.mockResolvedValue({});

      const nuevoTexto = '¡Hola! Bienvenidos a Caprichos en Campoy ☕🍓 ¿Qué se te antoja hoy?';
      await service.actualizarTextos(
        { chatbot_texto_bienvenida: nuevoTexto },
        mockUsuario as any,
        '192.168.1.1',
      );

      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'chatbot_texto_bienvenida' },
        update: { valor: nuevoTexto },
        create: { clave: 'chatbot_texto_bienvenida', valor: nuevoTexto },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'chatbot_configuracion',
          accion: 'TEXTOS_BOT_ACTUALIZADOS',
          partyId: BigInt(10),
          ip: '192.168.1.1',
        }),
      );
    });

    it('rechaza textos que exceden el límite de 1024 caracteres de WhatsApp', async () => {
      const textoGigante = 'A'.repeat(LIMITE_CUERPO_TEXTO + 1);

      await expect(
        service.actualizarTextos(
          { chatbot_texto_bienvenida: textoGigante },
          mockUsuario as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza textos vacíos o solo espacios', async () => {
      await expect(
        service.actualizarTextos(
          { chatbot_texto_bienvenida: '   ' },
          mockUsuario as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('restablece un texto al valor por defecto y audita el restablecimiento', async () => {
      prisma.parametro.findUnique.mockResolvedValue({
        clave: 'chatbot_texto_bienvenida',
        valor: 'Texto previo modificado',
      });
      prisma.parametro.upsert.mockResolvedValue({});

      const res = await service.restablecerTexto(
        'chatbot_texto_bienvenida',
        mockUsuario as any,
        '127.0.0.1',
      );

      expect(res.clave).toBe('chatbot_texto_bienvenida');
      expect(res.valor).toBe(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          accion: 'TEXTO_BOT_RESTABLECIDO',
        }),
      );
    });

    it('falla al restablecer si la clave es desconocida', async () => {
      await expect(
        service.restablecerTexto('clave_inexistente', mockUsuario as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Interruptores por función', () => {
    it('actualiza los interruptores de función con valores "si"/"no" y audita', async () => {
      prisma.parametro.findMany.mockResolvedValue([]);
      prisma.parametro.upsert.mockResolvedValue({});

      await service.actualizarFunciones(
        { pedido: true, reservas: false, ia: true },
        mockUsuario as any,
        '10.0.0.1',
      );

      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'chatbot_funcion_pedido' },
        update: { valor: 'si' },
        create: { clave: 'chatbot_funcion_pedido', valor: 'si' },
      });

      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'chatbot_funcion_reservas' },
        update: { valor: 'no' },
        create: { clave: 'chatbot_funcion_reservas', valor: 'no' },
      });

      expect(prisma.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'chatbot_ia_activo' },
        update: { valor: 'si' },
        create: { clave: 'chatbot_ia_activo', valor: 'si' },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          accion: 'FUNCIONES_BOT_ACTUALIZADAS',
        }),
      );
    });
  });

  describe('4. Límite de mensajes por teléfono y Anti-Spam (Redis)',
    () => {
      it('permite el mensaje si el cliente está dentro de los límites', async () => {
        prisma.parametro.findMany.mockResolvedValue([]);
        mockRedisClient.incr.mockResolvedValueOnce(3); // Minuto: 3 <= 10
        mockRedisClient.incr.mockResolvedValueOnce(15); // Hora: 15 <= 60

        const res = await service.verificarAntiSpam('51999888777');

        expect(res.permitido).toBe(true);
        expect(res.enviarAvisoSpam).toBe(false);
      });

      it('cuando supera el límite por minuto, envía respuesta amable UNA SOLA VEZ', async () => {
        prisma.parametro.findMany.mockResolvedValue([]);
        mockRedisClient.incr.mockResolvedValueOnce(11); // Minuto: 11 > 10
        mockRedisClient.incr.mockResolvedValueOnce(20);
        mockRedisClient.get.mockResolvedValueOnce(null); // No se le ha avisado aún

        const res = await service.verificarAntiSpam('51999888777');

        expect(res.permitido).toBe(false);
        expect(res.enviarAvisoSpam).toBe(true);
        expect(res.mensajeAviso).toContain('varios mensajes');
        expect(res.mensajeAviso).toContain('☕');
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          expect.stringContaining('chatbot:antispam:aviso:'),
          '1',
          'EX',
          60,
        );
      });

      it('si continúa enviando mensajes mientras está limitado, permanece en SILENCIO', async () => {
        prisma.parametro.findMany.mockResolvedValue([]);
        mockRedisClient.incr.mockResolvedValueOnce(15); // Minuto excedido
        mockRedisClient.incr.mockResolvedValueOnce(25);
        mockRedisClient.get.mockResolvedValueOnce('1'); // Ya se le avisó previamente

        const res = await service.verificarAntiSpam('51999888777');

        expect(res.permitido).toBe(false);
        expect(res.enviarAvisoSpam).toBe(false); // SILENCIO
        expect(mockRedisClient.set).not.toHaveBeenCalled();
      });

      it('permite actualizar los límites de minuto y hora en la base de datos', async () => {
        prisma.parametro.findMany.mockResolvedValue([]);
        prisma.parametro.upsert.mockResolvedValue({});

        const res = await service.actualizarAntiSpam(
          { maxPorMinuto: 8, maxPorHora: 45 },
          mockUsuario as any,
        );

        expect(res.maxPorMinuto).toBe(8);
        expect(res.maxPorHora).toBe(45);
        expect(auditoria.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'ANTISPAM_ACTUALIZADO',
          }),
        );
      });
    },
  );

  describe('5. Privacidad Ley 29733 (Retención, Anonimización, Exportación y Baja)', () => {
    it('actualiza el plazo de retención en días y audita', async () => {
      prisma.parametro.findMany.mockResolvedValue([]);
      prisma.parametro.upsert.mockResolvedValue({});

      const res = await service.actualizarRetencion(
        { diasRetencion: 120 },
        mockUsuario as any,
      );

      expect(res.diasRetencion).toBe(120);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'RETENCION_PRIVACIDAD_ACTUALIZADA',
        }),
      );
    });

    it('ejecuta anonimización de mensajes antiguos sin eliminarlos', async () => {
      prisma.parametro.findMany.mockResolvedValue([
        { clave: 'chatbot_retencion_dias', valor: 90 },
      ]);

      prisma.mensajeChat.findMany.mockResolvedValue([
        { id: BigInt(101), contenido: { texto: 'Mensaje antiguo del cliente' } },
        { id: BigInt(102), contenido: { texto: '[Mensaje anonimizado por política de retención Ley 29733]' } }, // Ya anonimizado
        { id: BigInt(103), contenido: { texto: 'Otro mensaje antiguo' } },
      ]);
      prisma.mensajeChat.update.mockResolvedValue({});

      const res = await service.ejecutarAnonimizacionRetencion(mockUsuario as any, '10.0.0.1');

      expect(res.anonimizados).toBe(2); // 101 y 103
      expect(prisma.mensajeChat.update).toHaveBeenCalledTimes(2);
      expect(prisma.mensajeChat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contenido: expect.objectContaining({
              texto: '[Mensaje anonimizado por política de retención Ley 29733]',
              anonimizado: true,
            }),
          }),
        }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ANONIMIZACION_RETENCION',
        }),
      );
    });

    it('exporta datos del cliente enmascarando teléfonos completos', async () => {
      prisma.conversacion.findFirst.mockResolvedValue({
        id: BigInt(5),
        telefono: '+51987654321',
        nombre_contacto: 'Ana Quispe',
        duenio: 'BOT',
        estado: 'ABIERTA',
        ultima_actividad: new Date(),
        mensajes: [
          { en: new Date(), direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', contenido: { texto: 'Hola' } },
        ],
      });
      prisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({
        acepta: true,
        origen: 'POR_DEFECTO',
        en: new Date(),
      });
      prisma.pedido.findMany.mockResolvedValue([
        { codigo: 'CP-0110', modalidad: 'DELIVERY', estado: 'ENTREGADO', total: 45.5, creado_en: new Date() },
      ]);

      const res = await service.exportarDatosCliente('987654321', mockUsuario as any);

      // El teléfono completo NUNCA debe estar en el resultado
      expect(res.identificadorEnmascarado).toBe('+51 9*** ***21');
      expect(res.nombreContacto).toBe('Ana Quispe');
      expect(res.totalMensajes).toBe(1);
      expect(res.totalPedidos).toBe(1);
      expect(JSON.stringify(res)).not.toContain('987654321');

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          accion: 'EXPORTAR_DATOS_CLIENTE',
          despues: { identificador: '+51 9*** ***21' },
        }),
      );
    });

    it('da de baja a un cliente: revoca consentimiento y anonimiza mensajes sin borrar', async () => {
      prisma.clienteWhatsappConsentimiento.upsert.mockResolvedValue({});
      prisma.conversacion.findFirst.mockResolvedValue({
        id: BigInt(22),
        telefono: '987654321',
      });
      prisma.conversacion.update.mockResolvedValue({});
      prisma.mensajeChat.updateMany.mockResolvedValue({ count: 8 });

      const res = await service.darDeBajaCliente('987654321', 'Solicitud formal ARCO', mockUsuario as any);

      expect(res.exito).toBe(true);
      expect(res.identificador).toBe('+51 9*** ***21');
      expect(prisma.clienteWhatsappConsentimiento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ acepta: false, origen: 'ADMIN_BAJA' }),
        }),
      );
      expect(prisma.conversacion.update).toHaveBeenCalledWith({
        where: { id: BigInt(22) },
        data: {
          nombre_contacto: '[Anonimizado]',
          flujo: {},
          duenio: 'BOT',
        },
      });
      expect(prisma.mensajeChat.updateMany).toHaveBeenCalledWith({
        where: { conversacion_id: BigInt(22) },
        data: expect.objectContaining({
          contenido: expect.objectContaining({
            texto: '[Anonimizado por solicitud de baja Ley 29733]',
          }),
        }),
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          accion: 'BAJA_CLIENTE',
          despues: expect.objectContaining({
            identificador: '+51 9*** ***21',
            motivo: 'Solicitud formal ARCO',
            mensajesAnonimizados: 8,
          }),
        }),
      );
    });
  });

  describe('6. Controller Endpoints', () => {
    it('GET /admin/chatbot/configuracion delega al service', async () => {
      jest.spyOn(service, 'obtenerConfiguracion').mockResolvedValue({} as any);
      await controller.obtenerConfiguracion();
      expect(service.obtenerConfiguracion).toHaveBeenCalled();
    });

    it('PUT /admin/chatbot/configuracion/textos delega al service con ip y usuario', async () => {
      jest.spyOn(service, 'actualizarTextos').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.actualizarTextos({ chatbot_texto_despedida: 'Adios ☕' }, req);
      expect(service.actualizarTextos).toHaveBeenCalledWith(
        { chatbot_texto_despedida: 'Adios ☕' },
        mockUsuario,
        '127.0.0.1',
      );
    });

    it('POST /admin/chatbot/configuracion/textos/restablecer delega al service', async () => {
      jest.spyOn(service, 'restablecerTexto').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.restablecerTexto({ clave: 'chatbot_texto_despedida' }, req);
      expect(service.restablecerTexto).toHaveBeenCalledWith(
        'chatbot_texto_despedida',
        mockUsuario,
        '127.0.0.1',
      );
    });

    it('PUT /admin/chatbot/configuracion/funciones delega al service', async () => {
      jest.spyOn(service, 'actualizarFunciones').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.actualizarFunciones({ pedido: false }, req);
      expect(service.actualizarFunciones).toHaveBeenCalledWith({ pedido: false }, mockUsuario, '127.0.0.1');
    });

    it('PUT /admin/chatbot/configuracion/anti-spam delega al service', async () => {
      jest.spyOn(service, 'actualizarAntiSpam').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.actualizarAntiSpam({ maxPorMinuto: 12, maxPorHora: 80 }, req);
      expect(service.actualizarAntiSpam).toHaveBeenCalledWith({ maxPorMinuto: 12, maxPorHora: 80 }, mockUsuario, '127.0.0.1');
    });

    it('PUT /admin/chatbot/configuracion/retencion delega al service', async () => {
      jest.spyOn(service, 'actualizarRetencion').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.actualizarRetencion({ diasRetencion: 180 }, req);
      expect(service.actualizarRetencion).toHaveBeenCalledWith({ diasRetencion: 180 }, mockUsuario, '127.0.0.1');
    });

    it('POST /admin/chatbot/configuracion/retencion/ejecutar delega al service', async () => {
      jest.spyOn(service, 'ejecutarAnonimizacionRetencion').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.ejecutarAnonimizacionRetencion(req);
      expect(service.ejecutarAnonimizacionRetencion).toHaveBeenCalledWith(mockUsuario, '127.0.0.1');
    });

    it('GET /admin/chatbot/configuracion/privacidad/exportar delega al service', async () => {
      jest.spyOn(service, 'exportarDatosCliente').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.exportarDatosCliente({ identificador: '987654321' }, req);
      expect(service.exportarDatosCliente).toHaveBeenCalledWith('987654321', mockUsuario, '127.0.0.1');
    });

    it('POST /admin/chatbot/configuracion/privacidad/baja delega al service', async () => {
      jest.spyOn(service, 'darDeBajaCliente').mockResolvedValue({} as any);
      const req = { usuario: mockUsuario, ip: '127.0.0.1' };
      await controller.darDeBajaCliente({ identificador: '987654321', motivo: 'Baja solicitada' }, req);
      expect(service.darDeBajaCliente).toHaveBeenCalledWith('987654321', 'Baja solicitada', mockUsuario, '127.0.0.1');
    });
  });

  describe('7. Prueba de contrato de API: GET /admin/chatbot/configuracion', () => {
    it('fija la forma exacta del objeto devuelto por GET /admin/chatbot/configuracion (claves exactas)', async () => {
      prisma.parametro.findMany.mockResolvedValue([]);

      const respuesta = await controller.obtenerConfiguracion();

      // 1. Claves de primer nivel exactas
      const clavesPrimerNivel = Object.keys(respuesta).sort();
      expect(clavesPrimerNivel).toEqual(
        ['antiSpam', 'funciones', 'privacidad', 'textos', 'textosDefecto'].sort(),
      );

      // Verificación negativa contra divergencias pasadas
      expect((respuesta as any).retencion).toBeUndefined();
      expect((respuesta as any).consumoIa).toBeUndefined();
      expect((respuesta as any).textosPorDefecto).toBeUndefined();

      // 2. Claves de textos exactas (8 claves reales)
      const clavesTextosEsperadas = [
        'chatbot_texto_bienvenida',
        'chatbot_texto_despedida',
        'chatbot_texto_pase_persona',
        'chatbot_texto_fuera_horario',
        'chatbot_texto_no_entiendo',
        'chatbot_texto_no_entiendo_derivacion',
        'chatbot_texto_indicacion_pago',
        'chatbot_texto_envio_gratis',
        'chatbot_texto_aviso_stock',
      ].sort();

      expect(Object.keys(respuesta.textos).sort()).toEqual(clavesTextosEsperadas);
      expect(Object.keys(respuesta.textosDefecto).sort()).toEqual(clavesTextosEsperadas);

      // Verificación negativa contra claves cortas no integradas
      expect((respuesta.textos as any).bienvenida).toBeUndefined();
      expect((respuesta.textos as any).despedida).toBeUndefined();

      // 3. Claves de funciones exactas (6 interruptores)
      const clavesFuncionesEsperadas = [
        'pedido',
        'pago',
        'reservas',
        'cambios',
        'ia',
        'promociones',
      ].sort();
      expect(Object.keys(respuesta.funciones).sort()).toEqual(clavesFuncionesEsperadas);

      // 4. Claves de antiSpam exactas
      expect(Object.keys(respuesta.antiSpam).sort()).toEqual(
        ['maxPorHora', 'maxPorMinuto'].sort(),
      );
      expect((respuesta.antiSpam as any).limiteMinuto).toBeUndefined();
      expect((respuesta.antiSpam as any).limiteHora).toBeUndefined();

      // 5. Claves de privacidad exactas
      expect(Object.keys(respuesta.privacidad).sort()).toEqual(['diasRetencion']);
    });
  });
  describe('DTO anti-spam (compatibilidad con rangos de Protección contra spam)', () => {
    const errores = (minuto: number, hora: number) => {
      const d = Object.assign(new ActualizarAntiSpamDto(), { maxPorMinuto: minuto, maxPorHora: hora });
      return validateSync(d).map((e) => e.property);
    };
    it('acepta los rangos 3-60 y 10-600', () => {
      expect(errores(3, 10)).toEqual([]);
      expect(errores(60, 600)).toEqual([]);
    });
    it('rechaza fuera de rango', () => {
      expect(errores(2, 100)).toEqual(['maxPorMinuto']);
      expect(errores(10, 9)).toEqual(['maxPorHora']);
      expect(errores(10, 601)).toEqual(['maxPorHora']);
    });
  });
});
