jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../../../comun/redis/candado.util', () => ({
  adquirirCandado: jest.fn().mockResolvedValue({ adquirido: true, token: 'token-test', fallback: false }),
  liberarCandado: jest.fn().mockResolvedValue(true),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AlertasEsperaService } from '../alertas-espera.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { AvisosInternosService } from '../avisos-internos.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';
import { adquirirCandado } from '../../../../comun/redis/candado.util';
import { OutboxWhatsappService } from '../../servicios/outbox-whatsapp.service';


const outboxMock = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), limpiar: jest.fn(), resumen: jest.fn() };

describe('AlertasEsperaService (Contrato Secciones 2, 3 y 4)', () => {
  let service: AlertasEsperaService;
  let prismaMock: any;
  let redisMock: any;
  let avisosInternosMock: any;
  let mensajeriaMock: any;
  let eventosGatewayMock: any;

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.clave === 'stock_control_activo' ? { clave: where.clave, valor: 'si' } : null),
        ),
        findMany: jest.fn().mockResolvedValue([
          { clave: 'alerta_voucher_min_1', valor: 5 },
          { clave: 'alerta_voucher_min_2', valor: 15 },
          { clave: 'espera_cliente_aviso_min', valor: 10 },
          { clave: 'chat_tomado_liberar_min', valor: 10 },
          { clave: 'alerta_pedido_sin_confirmar_min', valor: 5 },
        ]),
      },
      conversacion: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      insumo: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      printJob: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      mensajeChat: {
        create: jest.fn().mockResolvedValue({}),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue('OK'),
      }),
    };

    avisosInternosMock = {
      enviarAvisoAdmin: jest.fn().mockResolvedValue({ enviosExitosos: 1 }),
      emitirAvisoCampana: jest.fn().mockResolvedValue(undefined),
    };

    mensajeriaMock = {
      enviarBotones: jest.fn().mockResolvedValue({ exito: true }),
      enviarTexto: jest.fn().mockResolvedValue({ exito: true }),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertasEsperaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: AvisosInternosService, useValue: avisosInternosMock },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mensajeriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: OutboxWhatsappService, useValue: outboxMock },
      ],
    }).compile();

    service = module.get<AlertasEsperaService>(AlertasEsperaService);
  });

  afterEach(() => {
    service.detener();
    jest.clearAllMocks();
  });

  describe('Lectura dinámica de umbrales (Sección 4)', () => {
    it('lee los 5 parámetros de configuración en cada ciclo', async () => {
      const umbrales = await service.obtenerUmbrales();
      expect(umbrales.alertaVoucherMin1).toBe(5);
      expect(umbrales.alertaVoucherMin2).toBe(15);
      expect(umbrales.esperaClienteAvisoMin).toBe(10);
      expect(umbrales.chatTomadoLiberarMin).toBe(10);
      expect(umbrales.alertaPedidoSinConfirmarMin).toBe(5);
    });
  });

  describe('2.a) Alertas de Voucher sin revisar (5 min y 15 min con urgente)', () => {
    it('a los 6 minutos no avisa todavía (umbral único de 30 min)', async () => {
      const ahora = new Date('2026-10-27T12:06:00Z');
      const timestampCaptura = new Date('2026-10-27T12:00:00Z').getTime(); // 6 min de espera

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.estado === 'VALIDAR_PAGO') {
          return Promise.resolve([
            {
              id: 101n,
              telefono: '51987654321',
              nombre_contacto: 'Ana Cliente',
              estado: 'VALIDAR_PAGO',
              urgente: false,
              flujo: { pago: { capturasEnviadas: 1, timestampUltimoVoucher: timestampCaptura } },
              mensajes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      expect(res.alertasVoucherEnviadas).toBe(0);
      expect(avisosInternosMock.enviarAvisoAdmin).not.toHaveBeenCalled();
      expect(prismaMock.conversacion.update).not.toHaveBeenCalled();
    });

    it('a los 30 minutos marca el chat como urgente y avisa por correo', async () => {
      const ahora = new Date('2026-10-27T12:31:00Z');
      const timestampCaptura = new Date('2026-10-27T12:00:00Z').getTime(); // 31 min de espera

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.estado === 'VALIDAR_PAGO') {
          return Promise.resolve([
            {
              id: 101n,
              telefono: '51987654321',
              nombre_contacto: 'Ana Cliente',
              estado: 'VALIDAR_PAGO',
              urgente: false,
              flujo: { pago: { capturasEnviadas: 1, timestampUltimoVoucher: timestampCaptura } },
              mensajes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      expect(res.alertasVoucherEnviadas).toBe(1);

      // Marca la conversación urgente en base de datos
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith({
        where: { id: 101n },
        data: { urgente: true },
      });

      // Emite socket a consola administrativa
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizar', {
        id: '101',
        urgente: true,
      });

      // Envía aviso urgente
      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledWith(
        'Voucher sin revisar (30 min)',
        expect.stringContaining('URGENTE'),
        '/admin/mensajes',
        undefined,
        expect.stringContaining('idemp:alerta:voucher:30m:101:1'),
        { correo: true },
      );
    });
  });

  describe('3) Manejo de la espera del cliente a los 10 minutos', () => {
    it('envía mensaje único con botones al cliente tras 10 min de espera', async () => {
      const ahora = new Date('2026-10-27T12:11:00Z');
      const timestampCaptura = new Date('2026-10-27T12:00:00Z').getTime(); // 11 min de espera

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.estado === 'VALIDAR_PAGO') {
          return Promise.resolve([
            {
              id: 101n,
              telefono: '51987654321',
              nombre_contacto: 'Carlos',
              estado: 'VALIDAR_PAGO',
              urgente: false,
              flujo: { pago: { capturasEnviadas: 1, timestampUltimoVoucher: timestampCaptura } },
              mensajes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      expect(res.avisosEsperaClienteEnviados).toBe(1);

      // El mensaje al cliente se encola en el outbox con sus 3 botones (el envío sale del lote)
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          telefono: '51987654321',
          tipo: 'TEXTO',
          origen: 'ESPERA',
          carga: expect.objectContaining({
            textoLibre: expect.stringContaining('Seguimos revisando tu pago'),
            botones: [
              { id: 'btn_esp_carta', titulo: 'Ver la carta' },
              { id: 'btn_esp_esperar', titulo: 'Seguir esperando' },
              { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
            ],
          }),
        }),
      );
      expect(mensajeriaMock.enviarBotones).not.toHaveBeenCalled();
    });
  });

  describe('3) Chat tomado y abandonado vs EXCEPCIÓN VALIDAR_PAGO', () => {
    it('libera chat normal al bot tras 10 min sin respuesta humana y avisa por campana', async () => {
      const ahora = new Date('2026-10-27T12:15:00Z');
      const tomadoEn = new Date('2026-10-27T12:00:00Z'); // 15 min sin mensaje

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.tomado_por) {
          return Promise.resolve([
            {
              id: 202n,
              telefono: '51911111111',
              duenio: 'PERSONA',
              estado: 'ABIERTA',
              tomado_por: 5n,
              tomado_en: tomadoEn,
              tomadoPorUsuario: { id: 5n, party_id: 50n },
              mensajes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      expect(res.chatsLiberados).toBe(1);

      // Se libera al bot
      expect(prismaMock.conversacion.update).toHaveBeenCalledWith({
        where: { id: 202n },
        data: expect.objectContaining({
          duenio: 'BOT',
          tomado_por: null,
          tomado_en: null,
        }),
      });

      // Avisa por campana a la persona que lo tenía
      expect(avisosInternosMock.emitirAvisoCampana).toHaveBeenCalledWith(
        'Chat liberado por inactividad',
        expect.stringContaining('fue liberado al bot'),
        '/admin/mensajes',
        50n,
      );
    });

    it('EXCEPCIÓN CRÍTICA: conversación en VALIDAR_PAGO NUNCA se libera al bot', async () => {
      const ahora = new Date('2026-10-27T12:20:00Z');
      const tomadoEn = new Date('2026-10-27T12:00:00Z'); // 20 min inactivo

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.tomado_por) {
          return Promise.resolve([
            {
              id: 303n,
              telefono: '51922222222',
              duenio: 'PERSONA',
              estado: 'VALIDAR_PAGO', // EXCEPCIÓN: pago por revisar
              tomado_por: 8n,
              tomado_en: tomadoEn,
              tomadoPorUsuario: { id: 8n, party_id: 80n },
              mensajes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      // NUNCA se libera al bot
      expect(res.chatsLiberados).toBe(0);
      expect(prismaMock.conversacion.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 303n },
          data: expect.objectContaining({ duenio: 'BOT' }),
        }),
      );
    });
  });

  describe('2.b, 2.c, 2.d: Alertas adicionales de la sección 2', () => {
    it('2.b: alerta si cliente espera persona por más de 5 minutos', async () => {
      const ahora = new Date('2026-10-27T12:08:00Z');
      const mensajeCliente = new Date('2026-10-27T12:01:00Z'); // 7 min esperando

      prismaMock.conversacion.findMany.mockImplementation(({ where }: any) => {
        if (where?.duenio === 'PERSONA') {
          return Promise.resolve([
            {
              id: 404n,
              telefono: '51933333333',
              nombre_contacto: 'Lucía',
              duenio: 'PERSONA',
              estado: 'ABIERTA',
              mensajes: [{ direccion: 'ENTRA', autor: 'CLIENTE', en: mensajeCliente }],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.ejecutarCiclo(ahora);
      expect(res.alertasPersonaEnviadas).toBe(1);
      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledWith(
        'Chat esperando asesor (7 min)',
        expect.stringContaining('Lucía'),
        '/admin/mensajes',
        undefined,
        expect.any(String),
      );
    });

    it('2.c: alerta por correo si pedido nuevo en Caja no se confirma en 30 minutos', async () => {
      const ahora = new Date('2026-10-27T12:40:00Z');
      const creadoEn = new Date('2026-10-27T12:02:00Z'); // 38 min

      prismaMock.pedido.findMany.mockResolvedValueOnce([
        {
          id: 505n,
          codigo: 'CP-0505',
          modalidad: 'DELIVERY',
          cliente_nombre: 'Pedro',
          estado: 'COLA',
          pago_estado: 'PENDIENTE',
          creado_en: creadoEn,
        },
      ]);

      const res = await service.ejecutarCiclo(ahora);
      expect(res.alertasCajaEnviadas).toBe(1);
      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledWith(
        'Pedido CP-0505 sin confirmar (38 min)',
        expect.stringContaining('Pedro'),
        '/admin/caja',
        expect.any(Array),
        expect.stringContaining('idemp:alerta:pedido:caja:505'),
        { correo: true },
      );
    });

    it('2.d: con el control de almacén apagado no hay alerta de stock (ni se consultan insumos)', async () => {
      const ahora = new Date('2026-10-27T12:00:00Z');
      prismaMock.parametro.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({ clave: where.clave, valor: where.clave === 'stock_control_activo' ? 'no' : 1 }),
      );
      prismaMock.insumo.findMany.mockResolvedValueOnce([
        { id: 606n, nombre: 'Queso Cheddar', minimo: 5, unidad_almacen: 'KG', stocks: [{ cantidad: 0 }] },
      ]);

      const res = await service.ejecutarCiclo(ahora);

      expect(res.alertasStockEnviadas).toBe(0);
      expect(prismaMock.insumo.findMany).not.toHaveBeenCalled();
      const avisos = avisosInternosMock.enviarAvisoAdmin.mock.calls.map((c: any[]) => String(c[0]));
      expect(avisos.some((t: string) => t.startsWith('Alerta de Stock'))).toBe(false);
    });

    it('2.d: alerta de stock bajo una vez al día por insumo y de falla de impresora', async () => {
      const ahora = new Date('2026-10-27T12:00:00Z');

      prismaMock.insumo.findMany.mockResolvedValueOnce([
        {
          id: 606n,
          nombre: 'Queso Cheddar',
          minimo: 5,
          unidad_almacen: 'KG',
          stocks: [{ cantidad: 2 }], // stock 2 <= minimo 5
        },
      ]);

      prismaMock.printJob.findMany.mockResolvedValueOnce([
        {
          id: 707n,
          tipo: 'ETIQUETA_GENERAL',
          estado: 'FALLIDO',
          error: 'Papel atascado',
          creado_en: new Date('2026-10-27T11:45:00Z'),
        },
      ]);

      const res = await service.ejecutarCiclo(ahora);
      expect(res.alertasStockEnviadas).toBe(1);
      expect(res.alertasImpresoraEnviadas).toBe(1);

      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledWith(
        'Alerta de Stock: Queso Cheddar (POR_PEDIR)',
        expect.stringContaining('2.00 KG'),
        '/admin/stock',
        undefined,
        'almacen:Queso Cheddar:POR_PEDIR:2026-10-27',
        { correo: true },
      );

      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledWith(
        'Falla de Impresora: Trabajo #707',
        expect.stringContaining('Papel atascado'),
        '/admin/configuracion',
        undefined,
        expect.stringContaining('idemp:alerta:impresora:707'),
        { correo: true },
      );
    });

    it('candado distribuido bloquea ciclos concurrentes en réplicas secundarias', async () => {
      (adquirirCandado as jest.Mock).mockResolvedValueOnce({ adquirido: false, fallback: false });
      const res = await service.ejecutarCiclo();
      expect(res.bloqueadoPorOtraInstancia).toBe(true);
    });
  });

  describe('2.e: etiquetas en cola sin agente de impresión', () => {
    const ahora = new Date('2026-10-27T12:00:00Z');

    it('avisa una sola vez por tanda cuando pasa el umbral y el agente no está', async () => {
      prismaMock.parametro.findUnique = jest.fn().mockResolvedValue({ clave: 'impresion_alerta_min', valor: 1 });
      prismaMock.printJob.findFirst = jest.fn().mockResolvedValue({ id: 55n });
      prismaMock.printJob.count = jest.fn().mockResolvedValue(3);
      prismaMock.deviceKey = { findFirst: jest.fn().mockResolvedValue(null) };
      const setRedis = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
      redisMock.obtenerCliente.mockReturnValue({ set: setRedis });

      const primera = await (service as any).avisarEtiquetasSinAgente(ahora);
      const segunda = await (service as any).avisarEtiquetasSinAgente(ahora);

      expect(primera).toBe(1);
      expect(segunda).toBe(0);
      expect(avisosInternosMock.enviarAvisoAdmin).toHaveBeenCalledTimes(1);
      const [titulo, detalle, enlace] = avisosInternosMock.enviarAvisoAdmin.mock.calls[0];
      expect(titulo).toBe('Etiquetas sin imprimir');
      expect(detalle).toContain('3 etiqueta(s)');
      expect(enlace).toBe('/admin/caja');
      expect(setRedis.mock.calls[0][0]).toBe('idemp:impresion:sin-agente:55');
    });

    it('no avisa si el agente está conectado con la impresora lista', async () => {
      prismaMock.parametro.findUnique = jest.fn().mockResolvedValue({ clave: 'impresion_alerta_min', valor: 1 });
      prismaMock.printJob.findFirst = jest.fn().mockResolvedValue({ id: 55n });
      prismaMock.deviceKey = {
        findFirst: jest.fn().mockResolvedValue({ ultimo_latido: ahora, latido_impresora: 'lista' }),
      };

      const res = await (service as any).avisarEtiquetasSinAgente(ahora);

      expect(res).toBe(0);
      expect(avisosInternosMock.enviarAvisoAdmin).not.toHaveBeenCalled();
    });
  });
});
