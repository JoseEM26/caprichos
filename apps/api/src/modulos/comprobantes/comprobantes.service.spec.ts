// Mock de EventosGateway
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('ComprobantesService', () => {
  let service: ComprobantesService;
  let prismaMock: any;
  let auditoriaMock: any;
  let localServiceMock: any;
  let eventosGatewayMock: any;

  const cajeroUsuario: UsuarioAutenticado = {
    partyId: 2n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const adminUsuario: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  const fechaFija = new Date('2026-10-21T18:00:00.000Z'); // 13:00 en America/Lima

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fechaFija);

    prismaMock = {
      $queryRaw: jest.fn(),
      comprobante: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
      },
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    localServiceMock = {
      obtenerDatosLocal: jest.fn().mockResolvedValue({
        nombre: 'Caprichos',
        razon_social: 'Caprichos S.A.C.',
        ruc: '20123456789',
        direccion: 'Av. Principal 123',
      }),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    service = new ComprobantesService(
      prismaMock,
      auditoriaMock,
      localServiceMock,
      eventosGatewayMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. correlativo secuencial y atómico en emitirParaPedido', () => {
    it('genera NV01-000001 de forma atómica con UPDATE ... RETURNING', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 100n,
        comprobante_tipo: 'NOTA_VENTA',
        comprobante_doc: null,
        comprobante_razon: null,
      });

      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 1 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 10n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(100n, undefined, cajeroUsuario);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(res.serie).toBe('NV01');
      expect(res.numero).toBe(1);
      expect(res.numero_texto).toBe('NV01-000001');
      expect(res.tipo).toBe('NOTA_VENTA');
      expect(res.emision).toBe('INTERNA');
    });

    it('genera el siguiente correlativo atómico NV01-000002 en la siguiente llamada', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 101n,
        comprobante_tipo: 'NOTA_VENTA',
        comprobante_doc: null,
        comprobante_razon: null,
      });

      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 2 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 11n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(101n, undefined, cajeroUsuario);

      expect(res.numero).toBe(2);
      expect(res.numero_texto).toBe('NV01-000002');
    });
  });

  describe('2. idempotencia en emitirParaPedido', () => {
    it('si ya existe la fila del comprobante para el pedido, la devuelve sin incrementar correlativo', async () => {
      const comprobanteExistente = {
        id: 5n,
        pedido_id: 100n,
        tipo: 'BOLETA',
        serie: 'NV01',
        numero: 1,
        numero_texto: 'NV01-000001',
        documento: '12345678',
        razon_social: null,
        emision: 'POR_EMITIR',
        copias_impresas: 0,
        creado_en: fechaFija,
      };

      prismaMock.comprobante.findFirst.mockResolvedValue(comprobanteExistente);

      const res = await service.emitirParaPedido(100n);

      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
      expect(res.id).toBe('5');
      expect(res.numero_texto).toBe('NV01-000001');
      expect(res.advertencia).toBeNull();
    });
  });

  describe('3. boleta con DNI válido e inválido', () => {
    it('boleta con DNI válido (8 dígitos) se guarda como BOLETA y POR_EMITIR', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 102n,
        comprobante_tipo: 'BOLETA',
        comprobante_doc: '12345678',
        comprobante_razon: null,
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 3 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 12n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(102n);

      expect(res.tipo).toBe('BOLETA');
      expect(res.emision).toBe('POR_EMITIR');
      expect(res.documento).toBe('12345678');
      expect(res.advertencia).toBeNull();
    });

    it('boleta sin DNI es válida: se emite BOLETA POR_EMITIR sin advertencia', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 104n,
        comprobante_tipo: 'BOLETA',
        comprobante_doc: null,
        comprobante_razon: null,
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 5 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 14n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(104n);

      expect(res.tipo).toBe('BOLETA');
      expect(res.emision).toBe('POR_EMITIR');
      expect(res.advertencia).toBeNull();
    });

    it('boleta con DNI inválido no bloquea: se emite como NOTA_VENTA interna con advertencia', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 103n,
        comprobante_tipo: 'BOLETA',
        comprobante_doc: '12345', // 5 dígitos
        comprobante_razon: null,
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 4 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 13n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(103n);

      expect(res.tipo).toBe('NOTA_VENTA');
      expect(res.emision).toBe('INTERNA');
      expect(res.advertencia).toContain('Documento inválido para BOLETA');
    });
  });

  describe('4. factura con RUC de 10 dígitos rechazado (RQ-LEG-01-02)', () => {
    it('factura con RUC de 10 dígitos se rechaza y pasa a NOTA_VENTA interna con advertencia', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 104n,
        comprobante_tipo: 'FACTURA',
        comprobante_doc: '2012345678', // 10 dígitos
        comprobante_razon: 'Empresa Falsa S.A.C.',
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 5 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 14n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(104n);

      expect(res.tipo).toBe('NOTA_VENTA');
      expect(res.emision).toBe('INTERNA');
      expect(res.advertencia).toContain('Documento inválido para FACTURA');
    });

    it('factura con RUC de 11 dígitos válido y razón social se emite como FACTURA POR_EMITIR', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 105n,
        comprobante_tipo: 'FACTURA',
        comprobante_doc: '20601234567',
        comprobante_razon: 'Inversiones Aybar S.A.C.',
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 6 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 15n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(105n);

      expect(res.tipo).toBe('FACTURA');
      expect(res.emision).toBe('POR_EMITIR');
      expect(res.documento).toBe('20601234567');
      expect(res.razon_social).toBe('Inversiones Aybar S.A.C.');
      expect(res.advertencia).toBeNull();
    });
  });

  describe('5. nota de venta por defecto', () => {
    it('pedido con NOTA_VENTA por defecto emite NOTA_VENTA INTERNA', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 106n,
        comprobante_tipo: 'NOTA_VENTA',
        comprobante_doc: null,
        comprobante_razon: null,
      });
      prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: 7 }]);
      prismaMock.comprobante.create.mockImplementation((args: any) => ({
        id: 16n,
        ...args.data,
        creado_en: fechaFija,
      }));

      const res = await service.emitirParaPedido(106n);

      expect(res.tipo).toBe('NOTA_VENTA');
      expect(res.emision).toBe('INTERNA');
      expect(res.advertencia).toBeNull();
    });
  });

  describe('6. 409 PEDIDO_SIN_COBRAR en obtención para impresión', () => {
    it('lanza 409 PEDIDO_SIN_COBRAR si pago_estado no es PAGADO o cobro no existe', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 107n,
        pago_estado: 'PENDIENTE',
        cobros: [],
      });

      await expect(service.obtenerPorPedido(107n, cajeroUsuario)).rejects.toThrow(HttpException);

      try {
        await service.obtenerPorPedido(107n, cajeroUsuario);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual({
          codigo: 'PEDIDO_SIN_COBRAR',
          mensaje: 'El pedido aún no ha sido cobrado',
        });
      }
    });

    it('devuelve los datos para imprimir cuando el pedido está cobrado', async () => {
      const pedidoMock = {
        id: 108n,
        codigo: 'CP-0108',
        canal: 'CARTA',
        modalidad: 'LOCAL',
        cliente_nombre: 'Juan Perez',
        subtotal: 50,
        envio: 0,
        total: 50,
        pago_estado: 'PAGADO',
        pago_metodo: 'YAPE',
        cobros: [{
          id: 1n,
          en: fechaFija,
          anulado_en: null,
          pagos: [{ id: 1n, medio: 'YAPE', monto: 50, recibido: 50, vuelto: 0 }],
        }],
        lineas: [
          {
            id: 1n,
            nombre: 'Hamburguesa Clásica',
            cantidad: 2,
            precio_unit: 25,
            subtotal: 50,
            opcionesElegidas: [{ opcion_id: 1n, opcion_nombre: 'Sin cebolla' }],
          },
        ],
        comprobante: [{
          id: 20n,
          pedido_id: 108n,
          tipo: 'BOLETA',
          serie: 'NV01',
          numero: 10,
          numero_texto: 'NV01-000010',
          documento: '12345678',
          razon_social: null,
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
        }],
      };

      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      const res = await service.obtenerPorPedido(108n, cajeroUsuario);

      expect(res.titulo).toBe('Nota de venta NV01-000010');
      expect(res.local.nombre).toBe('Caprichos');
      expect(res.local.ruc).toBe('20123456789');
      expect(res.cliente.nombre).toBe('Juan Perez');
      expect(res.total).toBe(50);
      expect(res.aviso).toBe('Por emitir en el facturador');
      expect(res.cupones).toEqual([]);
      expect(res.detalle).toHaveLength(1);
    });
  });

  describe('6b. nunca se imprimen datos de ejemplo del local', () => {
    it('sin razón social ni RUC en el local: salen vacíos y el comprobante avisa qué falta', async () => {
      localServiceMock.obtenerDatosLocal.mockResolvedValue({ nombre: 'Caprichos', direccion: 'Jr. Real 45' });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 109n,
        codigo: 'CP-0109',
        canal: 'CARTA',
        modalidad: 'LOCAL',
        cliente_nombre: 'Ana',
        subtotal: 10,
        envio: 0,
        total: 10,
        pago_estado: 'PAGADO',
        pago_metodo: 'EFECTIVO',
        cobros: [{ id: 2n, en: fechaFija, anulado_en: null, pagos: [{ id: 2n, medio: 'EFECTIVO', monto: 10, recibido: 10, vuelto: 0 }] }],
        lineas: [],
        comprobante: [{
          id: 2n,
          pedido_id: 109n,
          tipo: 'NOTA_VENTA',
          serie: 'NV01',
          numero: 11,
          numero_texto: 'NV01-000011',
          documento: null,
          razon_social: null,
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
        }],
      });
      const res = await service.obtenerPorPedido(109n, cajeroUsuario);
      expect(res.local.razon_social).toBeNull();
      expect(res.local.ruc).toBeNull();
      expect(res.local.datos_fiscales_completos).toBe(false);
      expect(res.local.aviso_datos_fiscales).toMatch(/Falta razón social y RUC/);
      expect(JSON.stringify(res)).not.toContain('20123456789');
      expect(JSON.stringify(res)).not.toContain('Caprichos S.A.C.');
    });
  });

  describe('7. reimpresión suma copias y audita', () => {
    it('suma 1 a copias_impresas, marca «COPIA» y audita REIMPRIMIR', async () => {
      const pedidoMock = {
        id: 109n,
        codigo: 'CP-0109',
        pago_estado: 'PAGADO',
        subtotal: 30,
        envio: 0,
        total: 30,
        cobros: [{ id: 2n, en: fechaFija, anulado_en: null, pagos: [] }],
        lineas: [],
        comprobante: [{
          id: 30n,
          pedido_id: 109n,
          tipo: 'NOTA_VENTA',
          serie: 'NV01',
          numero: 25,
          numero_texto: 'NV01-000025',
          documento: null,
          razon_social: null,
          emision: 'INTERNA',
          copias_impresas: 0,
          creado_en: fechaFija,
        }],
      };

      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.comprobante.update.mockResolvedValue({
        ...pedidoMock.comprobante[0],
        copias_impresas: 1,
      });

      const res = await service.reimprimirPorPedido(109n, cajeroUsuario, '192.168.1.10');

      expect(prismaMock.comprobante.update).toHaveBeenCalledWith({
        where: { id: 30n },
        data: { copias_impresas: { increment: 1 } },
      });

      expect(res.es_copia).toBe(true);
      expect(res.copia_numero).toBe(1);
      expect(res.marca_copia).toBe('COPIA');
      expect(res.titulo).toContain('COPIA 1');

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'comprobantes',
          accion: 'REIMPRIMIR',
          entidad: 'comprobante',
          entidadId: 30n,
        }),
      );
    });
  });

  describe('8. lista por emitir pagina (más antiguas primero)', () => {
    it('devuelve estructura paginada con boletas y facturas POR_EMITIR', async () => {
      prismaMock.comprobante.count.mockResolvedValue(2);
      prismaMock.comprobante.findMany.mockResolvedValue([
        {
          id: 1n,
          pedido_id: 201n,
          tipo: 'BOLETA',
          serie: 'NV01',
          numero: 1,
          numero_texto: 'NV01-000001',
          documento: '12345678',
          razon_social: null,
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
          pedido: { id: 201n, codigo: 'CP-0201', total: 45, creado_en: fechaFija },
        },
        {
          id: 2n,
          pedido_id: 202n,
          tipo: 'FACTURA',
          serie: 'NV01',
          numero: 2,
          numero_texto: 'NV01-000002',
          documento: '20601234567',
          razon_social: 'Acme SAC',
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
          pedido: { id: 202n, codigo: 'CP-0202', total: 120, creado_en: fechaFija },
        },
      ]);

      const res = await service.listarPorEmitir({ pagina: 1, limite: 10 }, cajeroUsuario);

      expect(res.total).toBe(2);
      expect(res.pagina).toBe(1);
      expect(res.limite).toBe(10);
      expect(res.totalPaginas).toBe(1);
      expect(res.elementos).toHaveLength(2);
      expect(res.elementos[0].codigo_pedido).toBe('CP-0201');
      expect(res.elementos[0].total).toBe(45);
    });
  });

  describe('9. emitido exige referencia externa (3 o más caracteres)', () => {
    it('falla si referenciaExterna tiene menos de 3 caracteres', async () => {
      await expect(
        service.marcarEmitido(1n, { referenciaExterna: 'AB' } as any, cajeroUsuario),
      ).rejects.toThrow(BadRequestException);
    });

    it('marca EMITIDO con referencia, emitido_por, emitido_en y emite socket', async () => {
      const comprobanteMock = {
        id: 1n,
        pedido_id: 100n,
        tipo: 'BOLETA',
        serie: 'NV01',
        numero: 1,
        numero_texto: 'NV01-000001',
        emision: 'POR_EMITIR',
        pedido: { id: 100n, codigo: 'CP-0100' },
      };

      prismaMock.comprobante.findUnique.mockResolvedValue(comprobanteMock);
      prismaMock.comprobante.update.mockResolvedValue({
        ...comprobanteMock,
        emision: 'EMITIDO',
        emitido_en: fechaFija,
        emitido_por: 2n,
        referencia_externa: 'B001-000456',
      });

      const res = await service.marcarEmitido(
        1n,
        { referenciaExterna: 'B001-000456' },
        cajeroUsuario,
        '127.0.0.1',
      );

      expect(res.emision).toBe('EMITIDO');
      expect(res.referencia_externa).toBe('B001-000456');

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'comprobantes',
          accion: 'MARCAR_EMITIDO',
          entidad: 'comprobante',
        }),
      );

      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'comprobante:cambio',
        expect.objectContaining({
          emision: 'EMITIDO',
          referenciaExterna: 'B001-000456',
        }),
      );
    });

    it('un comprobante ya emitido no vuelve a POR_EMITIR (lanza 409)', async () => {
      prismaMock.comprobante.findUnique.mockResolvedValue({
        id: 1n,
        emision: 'EMITIDO',
      });

      await expect(
        service.marcarEmitido(1n, { referenciaExterna: 'B001-000456' }, cajeroUsuario),
      ).rejects.toThrow(HttpException);

      try {
        await service.marcarEmitido(1n, { referenciaExterna: 'B001-000456' }, cajeroUsuario);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual({
          codigo: 'COMPROBANTE_YA_EMITIDO',
          mensaje: 'El comprobante ya fue emitido y no puede volver a emitirse',
        });
      }
    });
  });

  describe('10. enmascarado en listas salvo para rol ADMIN', () => {
    it('enmascara DNI y RUC para rol CAJERO en listarPorEmitir', async () => {
      prismaMock.comprobante.count.mockResolvedValue(1);
      prismaMock.comprobante.findMany.mockResolvedValue([
        {
          id: 1n,
          pedido_id: 201n,
          tipo: 'BOLETA',
          serie: 'NV01',
          numero: 1,
          numero_texto: 'NV01-000001',
          documento: '12345678',
          razon_social: null,
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
          pedido: { id: 201n, codigo: 'CP-0201', total: 45, creado_en: fechaFija },
        },
      ]);

      const res = await service.listarPorEmitir({ pagina: 1, limite: 10 }, cajeroUsuario);

      expect(res.elementos[0].documento).toBe('12****78');
    });

    it('entrega DNI y RUC completos para rol ADMIN en listarPorEmitir y audita', async () => {
      prismaMock.comprobante.count.mockResolvedValue(1);
      prismaMock.comprobante.findMany.mockResolvedValue([
        {
          id: 1n,
          pedido_id: 201n,
          tipo: 'FACTURA',
          serie: 'NV01',
          numero: 1,
          numero_texto: 'NV01-000001',
          documento: '20601234567',
          razon_social: 'Acme SAC',
          emision: 'POR_EMITIR',
          copias_impresas: 0,
          creado_en: fechaFija,
          pedido: { id: 201n, codigo: 'CP-0201', total: 100, creado_en: fechaFija },
        },
      ]);

      const res = await service.listarPorEmitir({ pagina: 1, limite: 10 }, adminUsuario);

      expect(res.elementos[0].documento).toBe('20601234567');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          modulo: 'comprobantes',
          accion: 'LISTAR_POR_EMITIR_ADMIN',
        }),
      );
    });
  });
});
