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

describe('AvisosInternosService (Ola 4, Agente H: Avisos Internos al Equipo)', () => {
  let service: AvisosInternosService;
  let prismaMock: any;
  let redisMock: any;
  let configServiceMock: any;
  let configuracionServiceMock: any;
  let auditoriaServiceMock: any;
  let ventana24hServiceMock: any;
  let mensajeriaMock: any;
  let eventosGatewayMock: any;

  const redisStore = new Map<string, string>();

  beforeEach(async () => {
    redisStore.clear();

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue({
        set: jest.fn().mockImplementation((key: string, val: string, mode?: string, ttl?: number, nx?: string) => {
          if (nx === 'NX' && redisStore.has(key)) {
            return Promise.resolve(null);
          }
          redisStore.set(key, val);
          return Promise.resolve('OK');
        }),
        get: jest.fn().mockImplementation((key: string) => Promise.resolve(redisStore.get(key) || null)),
      }),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string, def?: any) => {
        if (key === 'ADMIN_WHATSAPP_NUMBERS') {
          return '51900000001, 51900000002';
        }
        return def;
      }),
    };

    configuracionServiceMock = {
      obtener: jest.fn().mockImplementation((key: string) => {
        if (key === 'chatbot_avisos_equipo_activo') {
          return 'si';
        }
        return null;
      }),
    };

    auditoriaServiceMock = {
      registrar: jest.fn().mockResolvedValue({ id: 1n }),
    };

    ventana24hServiceMock = {
      esVentanaAbierta: jest.fn().mockResolvedValue(true),
    };

    mensajeriaMock = {
      enviarBotones: jest.fn().mockResolvedValue({
        exito: true,
        estado: 'ENVIADO',
        waMessageId: 'wamid.test.123',
      }),
      enviarPlantilla: jest.fn().mockResolvedValue({
        exito: true,
        estado: 'ENVIADO',
        waMessageId: 'wamid.test.tpl.456',
      }),
      enviarTexto: jest.fn().mockResolvedValue({
        exito: true,
        estado: 'ENVIADO',
        waMessageId: 'wamid.test.txt.789',
      }),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    prismaMock = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          id: 101n,
          codigo: 'CP-W001',
          canal: 'WHATSAPP',
          modalidad: 'DELIVERY',
          cliente_nombre: 'Ana Pérez',
          cliente_telefono: '51988888888',
          total: 45.5,
          entrega_direccion: 'Av. Larco 123',
          entrega_referencia: 'Edificio blanco',
          creado_en: new Date(),
          lineas: [
            { nombre: 'Frappe Oreo', cantidad: 2, tamano: 'Grande', nota: null },
          ],
        }),
      },
      insumo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 55n,
          nombre: 'Leche Evaporada',
          unidad_almacen: 'UND',
          minimo: 10,
          lugarConsumo: { nombre: 'Almacén Central' },
          stocks: [{ cantidad: 0 }],
        }),
      },
      producto: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10n,
          nombre: 'Torta de Chocolate',
        }),
      },
      whatsappMensaje: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
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

  describe('Lectura segura de ADMIN_WHATSAPP_NUMBERS y configuración', () => {
    it('obtiene y normaliza la lista de teléfonos del equipo sin exponer el valor en crudo', () => {
      const numeros = service.obtenerNumerosEquipo();
      expect(numeros).toEqual(['51900000001', '51900000002']);
    });

    it('devuelve array vacío si ADMIN_WHATSAPP_NUMBERS está vacío o indefinido', () => {
      configServiceMock.get.mockReturnValueOnce('');
      const numeros = service.obtenerNumerosEquipo();
      expect(numeros).toEqual([]);
    });

    it('evalúa correctamente el estado del interruptor de configuración (chatbot_avisos_equipo_activo)', async () => {
      expect(await service.estanAvisosActivos()).toBe(true);

      configuracionServiceMock.obtener.mockResolvedValueOnce('no');
      expect(await service.estanAvisosActivos()).toBe(false);

      configuracionServiceMock.obtener.mockResolvedValueOnce(null);
      expect(await service.estanAvisosActivos()).toBe(false);
    });
  });

  describe('Avisos de Pedido Nuevo (Cualquier Canal)', () => {
    it('omite el aviso si el interruptor en configuración está apagado', async () => {
      configuracionServiceMock.obtener.mockResolvedValueOnce('no');
      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(true);
      expect(resultado.motivo).toBe('DESACTIVADO');
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalled();
    });

    it('omite el aviso si no hay números de equipo configurados en ADMIN_WHATSAPP_NUMBERS', async () => {
      configServiceMock.get.mockReturnValueOnce('');
      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(true);
      expect(resultado.motivo).toBe('SIN_NUMEROS');
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalled();
    });

    it('envía mensaje interactivo con botones cuando la ventana de 24h está abierta', async () => {
      ventana24hServiceMock.esVentanaAbierta.mockResolvedValue(true);

      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(resultado.detalles[0].modo).toBe('VENTANA_24H');
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledTimes(2);

      // Verifica que no se envió por plantilla
      expect(mensajeriaMock.enviarPlantilla).not.toHaveBeenCalled();

      // Verifica auditoría registrada
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'WHATSAPP_AVISO_EQUIPO_PEDIDO',
          entidad: 'pedido',
          entidadId: 101n,
        }),
      );

      // Verifica registro en tabla whatsapp_mensaje
      expect(prismaMock.whatsappMensaje.create).toHaveBeenCalled();
    });

    it('envía plantilla aprobada caprichos_equipo_nuevo_pedido cuando la ventana de 24h está cerrada', async () => {
      ventana24hServiceMock.esVentanaAbierta.mockResolvedValue(false);

      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(resultado.detalles[0].modo).toBe('PLANTILLA');
      expect(mensajeriaMock.enviarPlantilla).toHaveBeenCalledWith(
        expect.any(String),
        'caprichos_equipo_nuevo_pedido',
        'es',
        ['CP-W001', 'DELIVERY - Ana Pérez', '45.50'],
        expect.objectContaining({ pedidoId: 101n }),
      );
    });

    it('garantiza idempotencia estricta: un aviso por pedido y destino', async () => {
      // Primer envío: exitoso
      const res1 = await service.notificarNuevoPedido(101n);
      expect(res1.enviosExitosos).toBe(2);

      // Segundo envío: debe omitirse por clave existente en Redis
      const res2 = await service.notificarNuevoPedido(101n);
      expect(res2.detalles[0].modo).toBe('OMITIDO_IDEMPOTENTE');
      expect(res2.detalles[1].modo).toBe('OMITIDO_IDEMPOTENTE');

      // Solo se llamó al adaptador de WhatsApp en el primer intento (2 destinatarios = 2 llamadas)
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledTimes(2);
    });

    it('maneja fallos temporales de conexión con reintentos acotados sin bloquear el pedido', async () => {
      mensajeriaMock.enviarBotones
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ exito: true, estado: 'ENVIADO', waMessageId: 'wamid.retry.ok' });

      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(false);
      // El primer destinatario reintentó y tuvo éxito
      expect(resultado.detalles[0].exito).toBe(true);
    });
  });

  describe('Avisos de Almacén (Insumos Agotados y Por Pedir)', () => {
    it('notifica insumo agotado a los números del equipo con botones si la ventana está abierta', async () => {
      ventana24hServiceMock.esVentanaAbierta.mockResolvedValue(true);

      const resultado = await service.notificarInsumoAgotado(55n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(resultado.detalles[0].modo).toBe('VENTANA_24H');
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Insumo Agotado'),
        expect.arrayContaining([expect.objectContaining({ id: 'alm_ok_55' })]),
      );

      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'WHATSAPP_AVISO_EQUIPO_ALMACEN',
          entidad: 'insumo',
        }),
      );
    });

    it('notifica insumo por pedir (bajo stock) fuera de ventana usando plantilla caprichos_equipo_alerta_almacen', async () => {
      ventana24hServiceMock.esVentanaAbierta.mockResolvedValue(false);
      prismaMock.insumo.findUnique.mockResolvedValueOnce({
        id: 55n,
        nombre: 'Café Grano',
        unidad_almacen: 'KG',
        minimo: 5,
        stocks: [{ cantidad: 3.5 }],
      });

      const resultado = await service.notificarInsumoBajoStock(55n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.detalles[0].modo).toBe('PLANTILLA');
      expect(mensajeriaMock.enviarPlantilla).toHaveBeenCalledWith(
        expect.any(String),
        'caprichos_equipo_alerta_almacen',
        'es',
        ['Café Grano', 'Por pedir', '3.50 KG'],
      );
    });

    it('aplica idempotencia diaria en alertas de almacén para no saturar al equipo', async () => {
      await service.notificarInsumoAgotado(55n);
      const res2 = await service.notificarInsumoAgotado(55n);

      expect(res2.detalles[0].modo).toBe('OMITIDO_IDEMPOTENTE');
      expect(res2.detalles[1].modo).toBe('OMITIDO_IDEMPOTENTE');
    });

    it('notifica cuando un producto de carta se agota manualmente', async () => {
      const resultado = await service.notificarElementoAgotado('PRODUCTO', 10n);
      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(mensajeriaMock.enviarBotones).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Torta de Chocolate'),
        expect.any(Array),
      );
    });
  });

  describe('Procesamiento de Acciones del Equipo desde WhatsApp', () => {
    it('ignora acciones enviadas por números no autorizados', async () => {
      const res = await service.procesarAccionEquipo('51999999999', 'ped_apr_101');
      expect(res.procesado).toBe(false);
      expect(eventosGatewayMock.emitirAdmin).not.toHaveBeenCalled();
    });

    it('procesa la aprobación ped_apr_ de un pedido por un miembro autorizado del equipo', async () => {
      const res = await service.procesarAccionEquipo('51900000001', 'ped_apr_101');

      expect(res.procesado).toBe(true);
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({
          codigo: 'CP-W001',
          accion: 'APROBADO',
          porEquipoWa: true,
        }),
      );

      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51900000001',
        expect.stringContaining('Comanda confirmada'),
      );

      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PEDIDO_APROBADO_DESDE_WHATSAPP',
          entidad: 'pedido',
        }),
      );
    });

    it('procesa el rechazo ped_rec_ de un pedido por un miembro autorizado del equipo', async () => {
      const res = await service.procesarAccionEquipo('51900000002', 'ped_rec_101');

      expect(res.procesado).toBe(true);
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({
          codigo: 'CP-W001',
          accion: 'RECHAZADO',
          porEquipoWa: true,
        }),
      );

      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51900000002',
        expect.stringContaining('Comanda rechazada'),
      );
    });

    it('procesa la confirmación de lectura de alerta de almacén alm_ok_', async () => {
      const res = await service.procesarAccionEquipo('51900000001', 'alm_ok_55');
      expect(res.procesado).toBe(true);
      expect(mensajeriaMock.enviarTexto).toHaveBeenCalledWith(
        '51900000001',
        expect.stringContaining('Alerta de almacén confirmada'),
      );
    });
  });
});
