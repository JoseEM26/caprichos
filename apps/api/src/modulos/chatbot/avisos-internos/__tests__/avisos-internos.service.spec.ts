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
import { CruceStock } from '../../../stock/alertas-stock';


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

  describe('Avisos de Almacén (cruces de stock de insumos y productos agotados)', () => {
    const cruce = (over: Partial<CruceStock> = {}): CruceStock => ({
      insumoId: 55n,
      nombre: 'Leche Evaporada',
      unidad: 'UND',
      minimo: 10,
      total: 0,
      tipo: 'AGOTADO' as const,
      lugarNombre: 'Almacén Central',
      marca: '1700000000001',
      ...over,
    });

    beforeEach(() => {
      outboxMock.encolar.mockClear();
      auditoriaServiceMock.registrar.mockClear();
      prismaMock.notificacion = { create: jest.fn().mockResolvedValue({ id: 9n }) };
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'si' });
    });

    it('con el control de almacén apagado no avisa ningún cruce (ni WhatsApp, ni correo, ni campanita)', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'no' });

      const avisados = await service.avisarCruces([cruce(), cruce({ insumoId: 56n, tipo: 'POR_PEDIR', marca: '2' })]);

      expect(avisados).toBe(0);
      expect(outboxMock.encolar).not.toHaveBeenCalled();
      expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
    });

    it('un solo cruce: un WhatsApp por número con la clave por ID, tipo, día de Lima y marca', async () => {
      const avisados = await service.avisarCruces([cruce({ total: 30, tipo: 'POR_PEDIR' })]);

      expect(avisados).toBe(1);
      expect(outboxMock.encolar).toHaveBeenCalledTimes(2);
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          origen: 'EQUIPO_ALERTA_ALMACEN',
          clave: expect.stringMatching(/^almacen:55:POR_PEDIR:\d{4}-\d{2}-\d{2}:1700000000001:/),
        }),
        undefined,
      );
    });

    it('el aviso muestra el saldo TOTAL que decidió el cruce (no el de un solo lugar)', async () => {
      await service.avisarCruces([cruce({ total: 30, tipo: 'POR_PEDIR' })]);

      const texto = outboxMock.encolar.mock.calls[0][0].carga.textoLibre as string;
      expect(texto).toContain('Insumo por pedir');
      expect(texto).toContain('30.00');
    });

    it('un cruce AGOTADO queda con su propia campanita (tipo STOCK_BAJO, para roles de almacén)', async () => {
      await service.avisarCruces([cruce()]);

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'STOCK_BAJO', rol_destino: null, enlace: '/admin/stock' }),
      });
    });

    it('varios cruces a la vez salen como UN resumen por número, no uno por insumo', async () => {
      const avisados = await service.avisarCruces([
        cruce(),
        cruce({ insumoId: 56n, nombre: 'Café Grano', tipo: 'POR_PEDIR', total: 3, marca: '2' }),
        cruce({ insumoId: 57n, nombre: 'Azúcar', tipo: 'AGOTADO', total: -1, marca: '3' }),
      ]);

      expect(avisados).toBe(3);
      expect(outboxMock.encolar).toHaveBeenCalledTimes(2); // dos números del equipo, un mensaje cada uno
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          origen: 'EQUIPO_ALERTA_ALMACEN',
          carga: expect.objectContaining({
            textoLibre: expect.stringContaining('Café Grano'),
            plantillaClave: 'EQUIPO_ALERTA_ALMACEN',
          }),
        }),
        undefined,
      );
      expect(prismaMock.notificacion.create).toHaveBeenCalledTimes(1);
    });

    it('un producto de carta agotado usa clave propia (no choca con un insumo del mismo ID)', async () => {
      await service.notificarElementoAgotado('PRODUCTO', 10n);

      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({ clave: expect.stringMatching(/^carta:PRODUCTO:10:\d{4}-\d{2}-\d{2}:/) }),
        undefined,
      );
    });

    it('con el control apagado, un producto agotado a mano tampoco avisa al equipo', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'stock_control_activo', valor: 'no' });

      const resultado = await service.notificarElementoAgotado('PRODUCTO', 10n);

      expect(resultado).toMatchObject({ omitido: true, motivo: 'DESACTIVADO' });
      expect(outboxMock.encolar).not.toHaveBeenCalled();
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
