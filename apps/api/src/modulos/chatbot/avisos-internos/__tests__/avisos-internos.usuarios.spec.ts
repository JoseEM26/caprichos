jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AvisosInternosService } from '../avisos-internos.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { AuditoriaService } from '../../../auditoria/auditoria.service';
import { ConfiguracionService } from '../../../configuracion/configuracion.service';
import { Ventana24hService } from '../../servicios/ventana-24h.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';

describe('AvisosInternosService - Fuente de Destinatarios y Autorización Dinámica (Contrato Sección 1)', () => {
  let service: AvisosInternosService;
  let prismaMock: any;
  let redisMock: any;
  let configServiceMock: any;
  let configuracionServiceMock: any;
  let auditoriaServiceMock: any;
  let ventana24hServiceMock: any;
  let mensajeriaMock: any;
  let eventosGatewayMock: any;

  beforeEach(async () => {
    prismaMock = {
      userAccount: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 999n }),
      },
      whatsappMensaje: {
        create: jest.fn().mockResolvedValue({ id: 101n }),
      },
      pedido: {
        findUnique: jest.fn(),
      },
    };

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue('OK'),
      }),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue('51900000001, 51900000002'),
    };

    configuracionServiceMock = {
      obtener: jest.fn().mockResolvedValue(true),
    };

    auditoriaServiceMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    ventana24hServiceMock = {
      esVentanaAbierta: jest.fn().mockResolvedValue(true),
    };

    mensajeriaMock = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO', waMessageId: 'msg_btn_1' }),
      enviarPlantilla: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO', waMessageId: 'msg_tmpl_1' }),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvisosInternosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ConfiguracionService, useValue: configuracionServiceMock },
        { provide: AuditoriaService, useValue: auditoriaServiceMock },
        { provide: Ventana24hService, useValue: ventana24hServiceMock },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mensajeriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
      ],
    }).compile();

    service = module.get<AvisosInternosService>(AvisosInternosService);
  });

  describe('1. Resolución de destinatarios desde UserAccount', () => {
    it('obtiene números de usuarios activos, rol ADMIN, alertas activas y confirmadas', async () => {
      prismaMock.userAccount.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            contactos: [
              { tipo: 'WHATSAPP', valor: '977503006', principal: true, activo: true },
            ],
          },
        },
        {
          id: 2n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            contactos: [
              { tipo: 'WHATSAPP', valor: '+51 988888888', principal: true, activo: true },
            ],
          },
        },
      ]);

      const destinatarios = await service.obtenerDestinatariosAlertas();
      expect(destinatarios).toEqual(['51977503006', '51988888888']);
      expect(prismaMock.userAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
            rol: { in: ['ADMIN'] },
            alertas_whatsapp: true,
            alertas_whatsapp_confirmado_en: { not: null },
          }),
        }),
      );
    });

    it('si NINGÚN usuario cumple las condiciones, recurre a ADMIN_WHATSAPP_NUMBERS como respaldo con advertencia', async () => {
      // 0 usuarios en BD cumplen las condiciones
      prismaMock.userAccount.findMany.mockResolvedValueOnce([]);

      const destinatarios = await service.obtenerDestinatariosAlertas();
      // Retorna la lista de respaldo configurada en ADMIN_WHATSAPP_NUMBERS
      expect(destinatarios).toEqual(['51900000001', '51900000002']);
    });
  });

  describe('2. Validación dinámica de autorización para operar botones', () => {
    it('permite actuar a un usuario ACTIVO, con rol ADMIN y alertas confirmadas', async () => {
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 1n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            contactos: [{ tipo: 'WHATSAPP', valor: '977503006', activo: true }],
          },
        },
      ]);

      const autorizado = await service.esTelefonoAutorizado('51977503006');
      expect(autorizado).toBe(true);
    });

    it('invalida al instante si el usuario se desactiva o se le retira la casilla', async () => {
      // Usuario desmarcó la casilla o fue desactivado: findMany devuelve vacío
      prismaMock.userAccount.findMany.mockResolvedValueOnce([]);

      // Si el número no está en ADMIN_WHATSAPP_NUMBERS de respaldo tampoco:
      const autorizado = await service.esTelefonoAutorizado('51999999999');
      expect(autorizado).toBe(false);
    });
  });

  describe('3. Confirmación de alertas por WhatsApp (botón "Sí, soy yo")', () => {
    it('procesa el payload alr_conf_X, actualiza fecha de confirmación y responde al usuario', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 5n,
        rol: 'ADMIN',
        activo: true,
        party: {
          persona: { nombres: 'Kevin' },
          contactos: [{ tipo: 'WHATSAPP', valor: '977503006' }],
        },
      });

      const res = await service.procesarAccionEquipo('51977503006', 'alr_conf_5');
      expect(res.procesado).toBe(true);
      expect(res.mensaje).toContain('Alertas de WhatsApp confirmadas');

      // Actualiza en base de datos
      expect(prismaMock.userAccount.update).toHaveBeenCalledWith({
        where: { id: 5n },
        data: expect.objectContaining({
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: expect.any(Date),
        }),
      });

      // Envía mensaje de confirmación a WhatsApp
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51977503006',
        expect.stringContaining('Alertas de WhatsApp confirmadas'),
      );

      // Audita la acción
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CONFIRMAR_ALERTAS_WHATSAPP_BOT',
          entidadId: 5n,
        }),
      );
    });
  });

  describe('4. Envío general de alertas y respaldo en campana', () => {
    it('envía alerta a administradores y emite siempre a la campana del panel', async () => {
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 1n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            contactos: [{ tipo: 'WHATSAPP', valor: '977503006', principal: true, activo: true }],
          },
        },
      ]);

      const res = await service.enviarAvisoAdmin(
        'Voucher sin revisar (5 min)',
        'Cliente esperando validación de pago en WhatsApp',
        '/admin/mensajes',
      );

      expect(res.enviosExitosos).toBe(1);

      // Respaldo en tabla notificacion y websocket
      expect(prismaMock.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ALERTA_INTERNA',
            rol_destino: 'ADMIN',
            titulo: 'Voucher sin revisar (5 min)',
            enlace: '/admin/mensajes',
          }),
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'notificaciones:nueva',
        expect.objectContaining({ titulo: 'Voucher sin revisar (5 min)' }),
      );
    });

    it('utiliza plantilla aviso_interno cuando la ventana de 24h está cerrada', async () => {
      prismaMock.userAccount.findMany.mockResolvedValue([
        {
          id: 1n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            contactos: [{ tipo: 'WHATSAPP', valor: '977503006', principal: true, activo: true }],
          },
        },
      ]);

      // Ventana cerrada
      ventana24hServiceMock.esVentanaAbierta.mockResolvedValueOnce(false);

      await service.enviarAvisoAdmin(
        'Alerta de Stock: Harina (AGOTADO)',
        'Stock actual: 0.00 KG',
        '/admin/stock',
      );

      expect(mensajeriaMock.enviarPlantilla).toHaveBeenCalledWith(
        '51977503006',
        'aviso_interno',
        'es',
        expect.arrayContaining(['Alerta de Stock: Harina (AGOTADO)']),
      );
    });
  });
});
