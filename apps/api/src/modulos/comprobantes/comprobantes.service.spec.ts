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

  /** Pedido mínimo cuadrado: una línea de S/ 11.80 con IGV (total = subtotal - descuento + envío). */
  function pedidoEmision(extra: Record<string, unknown> = {}) {
    return {
      id: 100n,
      comprobante_tipo: 'BOLETA',
      comprobante_doc: null,
      comprobante_razon: null,
      comprobante_direccion: null,
      cliente_nombre: 'Juan Perez',
      subtotal: 11.8,
      descuento: 0,
      envio: 0,
      total: 11.8,
      lineas: [{ nombre: 'Frappe Oreo', cantidad: 1, precio_unit: 11.8, subtotal: 11.8 }],
      ...extra,
    };
  }

  /** Fila de comprobante que el mock guarda en create, releída en findUnique y actualizada en update. */
  function prepararEmision(pedido: any, ultimoNumero: number) {
    let fila: any = null;
    prismaMock.pedido.findUnique.mockResolvedValue(pedido);
    prismaMock.$queryRaw.mockResolvedValue([{ ultimo_numero: ultimoNumero }]);
    prismaMock.comprobante.findFirst.mockResolvedValue(null);
    prismaMock.comprobante.create.mockImplementation(async (args: any) => {
      fila = { id: 50n, creado_en: fechaFija, copias_impresas: 0, facturacion_intentos: 0, ...args.data, pedido };
      return fila;
    });
    prismaMock.comprobante.findUnique.mockImplementation(async () => fila);
    prismaMock.comprobante.update.mockImplementation(async (args: any) => {
      fila = { ...fila, ...args.data };
      return fila;
    });
  }

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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
      },
      // Estas pruebas cubren el camino «emitir al cobrar» (envío nocturno apagado)
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => (where.clave === 'facturacion_envio_nocturno' ? { valor: 'no' } : null)),
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
    it('genera B002-000001 de forma atómica con UPDATE ... RETURNING', async () => {
      prepararEmision(pedidoEmision({ id: 100n }), 1);

      const res = await service.emitirParaPedido(100n);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(res.serie).toBe('B002');
      expect(res.numero).toBe(1);
      expect(res.numero_texto).toBe('B002-000001');
      expect(res.tipo).toBe('BOLETA');
    });

    it('genera el siguiente correlativo atómico B002-000002 en la siguiente llamada', async () => {
      prepararEmision(pedidoEmision({ id: 101n }), 2);

      const res = await service.emitirParaPedido(101n);

      expect(res.numero).toBe(2);
      expect(res.numero_texto).toBe('B002-000002');
    });
  });

  describe('0. comprobante simple: ticket interno, no emite ni va a SUNAT', () => {
    it('SIMPLE devuelve null: no consume correlativo, no crea fila ni deja pendiente de envío', async () => {
      prepararEmision(pedidoEmision({ id: 120n, comprobante_tipo: 'SIMPLE' }), 1);

      const res = await service.emitirParaPedido(120n);

      expect(res).toBeNull();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
    });

    it('BOLETA y FACTURA sí crean la fila PENDIENTE_ENVIO para SUNAT', async () => {
      prepararEmision(pedidoEmision({ id: 121n }), 1);
      const boleta = await service.emitirParaPedido(121n);
      expect(boleta.tipo).toBe('BOLETA');
      expect(prismaMock.comprobante.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ facturacion_estado: 'PENDIENTE_ENVIO' }) }),
      );
    });
  });

  describe('3. boleta con DNI válido e inválido', () => {


    it('boleta con DNI inválido se rechaza al emitir: nunca sale como nota de venta', async () => {
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

      await expect(service.emitirParaPedido(103n)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_DATOS_FALTANTES' } });
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
    });
  });

  describe('4. factura con RUC de 10 dígitos rechazado (RQ-LEG-01-02)', () => {
    it('factura con RUC de 10 dígitos se rechaza al emitir, sin nota de venta', async () => {
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

      await expect(service.emitirParaPedido(104n)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_DATOS_FALTANTES' } });
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
    });

  });

  describe('3b. boleta y factura en modo simulado (sin red)', () => {
    it('boleta con DNI válido (8 dígitos) se emite con el emisor simulado y queda EMITIDO con serie B002', async () => {
      const pedido = pedidoEmision({ comprobante_tipo: 'BOLETA', comprobante_doc: '12345678' });
      prepararEmision(pedido, 3);

      const res = await service.emitirParaPedido(102n);

      expect(res.tipo).toBe('BOLETA');
      expect(res.serie).toBe('B002');
      expect(res.numero_texto).toBe('B002-000003');
      expect(res.emision).toBe('EMITIDO');
      expect(res.facturacion_estado).toBe('EMITIDO_SUNAT');
      expect(res.simulado).toBe(true);
      expect(res.documento).toBe('12345678');
      expect(res.advertencia).toBeNull();
    });

    it('boleta sin DNI es válida (hasta S/ 700): se emite BOLETA sin advertencia', async () => {
      const pedido = pedidoEmision({ comprobante_tipo: 'BOLETA', comprobante_doc: null });
      prepararEmision(pedido, 5);

      const res = await service.emitirParaPedido(104n);

      expect(res.tipo).toBe('BOLETA');
      expect(res.emision).toBe('EMITIDO');
      expect(res.advertencia).toBeNull();
    });

    it('boleta sin DNI por más de S/ 700 no se emite: la exige el cobro, no sale como nota de venta', async () => {
      const pedido = pedidoEmision({ comprobante_tipo: 'BOLETA', comprobante_doc: null, total: 720, subtotal: 720 });
      prepararEmision(pedido, 7);

      await expect(service.emitirParaPedido(104n)).rejects.toMatchObject({ response: { mensaje: expect.stringContaining('mayor a S/ 700') } });
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
    });

    it('factura con RUC de 11 dígitos válido y razón social se emite con serie F002', async () => {
      const pedido = pedidoEmision({
        comprobante_tipo: 'FACTURA',
        comprobante_doc: '20601234567',
        comprobante_razon: 'Inversiones Aybar S.A.C.',
      });
      prepararEmision(pedido, 6);

      const res = await service.emitirParaPedido(105n);

      expect(res.tipo).toBe('FACTURA');
      expect(res.serie).toBe('F002');
      expect(res.numero_texto).toBe('F002-000006');
      expect(res.emision).toBe('EMITIDO');
      expect(res.documento).toBe('20601234567');
      expect(res.razon_social).toBe('Inversiones Aybar S.A.C.');
      expect(res.advertencia).toBeNull();
    });
  });

  describe('5. la nota de venta no es comprobante', () => {
    it('un pedido sin boleta ni factura no se emite: 400 COMPROBANTE_OBLIGATORIO', async () => {
      prismaMock.comprobante.findFirst.mockResolvedValue(null);
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 106n,
        comprobante_tipo: 'NOTA_VENTA',
        comprobante_doc: null,
        comprobante_razon: null,
      });

      await expect(service.emitirParaPedido(106n)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_OBLIGATORIO' } });
      expect(prismaMock.comprobante.create).not.toHaveBeenCalled();
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

  describe('8b. lista por emitir con filtros en el servidor', () => {
    const fila = (id: bigint, tipo: string, razon: string | null, cod: string) => ({
      id, pedido_id: id + 100n, tipo, serie: 'NV01', numero: Number(id), numero_texto: `NV01-00000${id}`,
      documento: '12345678', razon_social: razon, emision: 'POR_EMITIR', copias_impresas: 0, creado_en: fechaFija,
      pedido: { id: id + 100n, codigo: cod, total: 10, creado_en: fechaFija },
    });

    it('buscar ignora tildes y el total y la paginación salen del filtro', async () => {
      prismaMock.comprobante.findMany.mockResolvedValue([
        fila(1n, 'BOLETA', 'José Peña', 'CP-1'),
        fila(2n, 'BOLETA', 'Ana', 'CP-2'),
        fila(3n, 'BOLETA', 'Josefina', 'CP-3'),
      ]);
      const res = await service.listarPorEmitir({ pagina: 1, limite: 1, buscar: 'jose' }, cajeroUsuario);
      expect(res.total).toBe(2);
      expect(res.totalPaginas).toBe(2);
      expect(res.elementos).toHaveLength(1);
      const p2 = await service.listarPorEmitir({ pagina: 2, limite: 1, buscar: 'JOSE' }, cajeroUsuario);
      expect(p2.elementos[0].razon_social).toBe('Josefina');
    });

    it('tipo viaja al where de Prisma', async () => {
      prismaMock.comprobante.count.mockResolvedValue(0);
      prismaMock.comprobante.findMany.mockResolvedValue([]);
      await service.listarPorEmitir({ pagina: 1, limite: 10, tipo: 'FACTURA' }, cajeroUsuario);
      expect(prismaMock.comprobante.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tipo: 'FACTURA', emision: 'POR_EMITIR' }),
      });
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
