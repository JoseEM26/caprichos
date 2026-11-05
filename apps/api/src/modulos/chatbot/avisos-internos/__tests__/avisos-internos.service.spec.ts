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
import { OutboxWhatsappService } from '../../servicios/outbox-whatsapp.service';


const outboxMock = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), limpiar: jest.fn(), resumen: jest.fn() };

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
      parametro: {
        // «Control de almacén» encendido por defecto; cada prueba puede cambiarlo
        findUnique: jest.fn().mockResolvedValue({ clave: 'stock_control_activo', valor: 'si' }),
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
        { provide: OutboxWhatsappService, useValue: outboxMock },
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

    it('encola un aviso con botones por número del equipo (ventana y plantilla se deciden al enviar)', async () => {
      outboxMock.encolar.mockClear();
      const resultado = await service.notificarNuevoPedido(101n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(resultado.detalles[0].modo).toBe('ENCOLADO');
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'TEXTO',
          origen: 'EQUIPO_NUEVO_PEDIDO',
          clave: expect.stringMatching(/^equipo-nuevo-pedido:101:/),
          carga: expect.objectContaining({ plantillaClave: 'EQUIPO_NUEVO_PEDIDO', botones: expect.any(Array) }),
        }),
        undefined,
      );
      // Ningún envío directo: el outbox envía después
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalled();
    });

    it('la plantilla del equipo lleva código, modalidad y total (el envío elige la plantilla si la ventana está cerrada)', async () => {
      outboxMock.encolar.mockClear();
      await service.notificarNuevoPedido(101n);
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          carga: expect.objectContaining({
            plantillaClave: 'EQUIPO_NUEVO_PEDIDO',
            variablesPlantilla: ['CP-W001', 'DELIVERY - Ana Pérez', '45.50'],
          }),
        }),
        undefined,
      );
    });

    it('garantiza idempotencia estricta: la clave por pedido y número evita el segundo aviso', async () => {
      outboxMock.encolar
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      const res1 = await service.notificarNuevoPedido(101n);
      expect(res1.enviosExitosos).toBe(2);

      const res2 = await service.notificarNuevoPedido(101n);
      expect(res2.detalles[0].modo).toBe('OMITIDO_IDEMPOTENTE');
      expect(res2.detalles[1].modo).toBe('OMITIDO_IDEMPOTENTE');
    });
  });

  describe('Avisos de Almacén (Insumos Agotados y Por Pedir)', () => {
    it('con el control de almacén apagado no crea aviso de insumo agotado ni de bajo stock', async () => {
      outboxMock.encolar.mockClear();
      auditoriaServiceMock.registrar.mockClear();
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'no' });

      const agotado = await service.notificarInsumoAgotado(55n);
      const bajo = await service.notificarInsumoBajoStock(55n);

      expect(agotado).toMatchObject({ omitido: true, motivo: 'DESACTIVADO', enviosExitosos: 0 });
      expect(bajo).toMatchObject({ omitido: true, motivo: 'DESACTIVADO', enviosExitosos: 0 });
      expect(prismaMock.insumo.findUnique).not.toHaveBeenCalled();
      expect(outboxMock.encolar).not.toHaveBeenCalled();
      expect(auditoriaServiceMock.registrar).not.toHaveBeenCalled();

      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'si' });
    });

    it('con el control de almacén encendido sí crea el aviso de insumo agotado', async () => {
      outboxMock.encolar.mockClear();
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'si' });

      const resultado = await service.notificarInsumoAgotado(55n);

      expect(resultado.omitido).toBe(false);
      expect(outboxMock.encolar).toHaveBeenCalled();
    });

    it('encola la alerta de insumo agotado con botones para cada número del equipo', async () => {
      outboxMock.encolar.mockClear();
      const resultado = await service.notificarInsumoAgotado(55n);

      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          origen: 'EQUIPO_ALERTA_ALMACEN',
          clave: expect.stringMatching(/^almacen:55:AGOTADO:\d{4}-\d{2}-\d{2}:/),
          carga: expect.objectContaining({
            textoLibre: expect.stringContaining('Insumo Agotado'),
            botones: expect.arrayContaining([expect.objectContaining({ id: 'alm_ok_55' })]),
          }),
        }),
        undefined,
      );
      expect(auditoriaServiceMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'WHATSAPP_AVISO_EQUIPO_ALMACEN', entidad: 'insumo' }),
      );
    });

    it('encola la alerta de bajo stock con la plantilla de almacén como respaldo', async () => {
      outboxMock.encolar.mockClear();
      prismaMock.insumo.findUnique.mockResolvedValueOnce({
        id: 55n,
        nombre: 'Café Grano',
        unidad_almacen: 'KG',
        minimo: 5,
        stocks: [{ cantidad: 3.5 }],
      });

      const resultado = await service.notificarInsumoBajoStock(55n);

      expect(resultado.omitido).toBe(false);
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          carga: expect.objectContaining({
            plantillaClave: 'EQUIPO_ALERTA_ALMACEN',
            variablesPlantilla: ['Café Grano', 'Por pedir', '3.50 KG'],
          }),
        }),
        undefined,
      );
    });

    it('aplica idempotencia diaria en alertas de almacén para no saturar al equipo', async () => {
      outboxMock.encolar
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);
      await service.notificarInsumoAgotado(55n);
      const res2 = await service.notificarInsumoAgotado(55n);

      expect(res2.detalles[0].modo).toBe('OMITIDO_IDEMPOTENTE');
      expect(res2.detalles[1].modo).toBe('OMITIDO_IDEMPOTENTE');
    });

    it('encola la alerta cuando un producto de carta se agota manualmente', async () => {
      outboxMock.encolar.mockClear();
      const resultado = await service.notificarElementoAgotado('PRODUCTO', 10n);
      expect(resultado.omitido).toBe(false);
      expect(resultado.enviosExitosos).toBe(2);
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          carga: expect.objectContaining({ textoLibre: expect.stringContaining('Torta de Chocolate') }),
        }),
        undefined,
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
