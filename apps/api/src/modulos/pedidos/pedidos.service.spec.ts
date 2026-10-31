// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
// party-puntos.service importa clientes.service (@nestjs/jwt, ESM): en las pruebas basta con un doble
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { ZonasService } from '../zonas/zonas.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { PuntosService } from '../clientes/puntos.service';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import { PartyPuntosService } from '../clientes/party-puntos.service';
import { PagoPlanService } from './pago-plan.service';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { generarTokenSeguimiento } from './seguimiento.tokens';

describe('PedidosService', () => {
  let service: PedidosService;
  let prismaMock: any;
  let localServiceMock: any;
  let zonasServiceMock: any;
  let eventosGatewayMock: any;
  let ofertasServiceMock: any;
  let puntosServiceMock: any;
  let direccionesMock: any;
  let partyPuntosMock: any;

  const mockProductoCafe = {
    id: 1n,
    nombre: 'Americano',
    precio: 10.0,
    oculto: false,
    agotado_hasta: null,
    categoria_id: 1n,
    categoria: {
      id: 1n,
      nombre: 'Bebidas Calientes',
      area_id: 1n,
      area: { id: 1n, nombre: 'Barra', tipo: 'BEBIDA' },
    },
    tamanos: [
      {
        id: 10n,
        producto_id: 1n,
        tamano_valor_id: 100n,
        precio: 12.0,
        tamano_valor: { id: 100n, nombre: '12 oz' },
      },
    ],
    grupos: [
      {
        grupo_id: 20n,
        grupo: {
          id: 20n,
          nombre: 'Tipo de Leche',
          obligatorio: true,
          minimo: 1,
          maximo: 1,
          activo: true,
          opciones: [
            {
              id: 200n,
              grupo_id: 20n,
              valor_id: 300n,
              precio_extra: 2.0,
              activo: true,
              agotado_hasta: null,
              valor: { id: 300n, nombre: 'Leche de Almendras' },
            },
          ],
        },
      },
    ],
  };

  const pedidoBaseDto: CrearPedidoDto = {
    cliente: {
      nombre: 'Juan Perez',
      telefono: '987654321',
    },
    modalidad: 'DELIVERY',
    entrega: {
      direccion: 'Av. Las Palmeras 123',
      referencia: 'Frente al parque',
      lat: -12.046374,
      lng: -77.042793,
      origen: 'GPS',
    },
    lineas: [
      {
        productoId: 1,
        tamanoId: 10,
        cantidad: 2,
        opciones: [200],
        nota: 'Sin azúcar',
        personas: ['Juan', 'Maria'],
      },
    ],
    pago: {
      metodo: 'YAPE',
    },
    comprobante: {
      tipo: 'BOLETA',
      dni: '12345678',
    },
  };

  beforeEach(async () => {
    prismaMock = {
      partyRole: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
      pedido: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      pedidoLinea: {
        create: jest.fn().mockResolvedValue({ id: 50n }),
      },
      pedidoPagoPlan: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      pedidoLineaOpcion: {
        create: jest.fn().mockResolvedValue({ id: 500n }),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
      },
      producto: {
        findMany: jest.fn().mockResolvedValue([mockProductoCafe]),
      },
      parametro: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.clave === 'envio_gratis_monto') {
            return Promise.resolve({ clave: 'envio_gratis_monto', valor: 70 });
          }
          if (where.clave === 'pedido_minimo') {
            return Promise.resolve({ clave: 'pedido_minimo', valor: 0 });
          }
          return Promise.resolve(null);
        }),
      },
      secuenciaPedido: {
        upsert: jest.fn().mockResolvedValue({ ultimo: 1 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: 1n }]),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    localServiceMock = {
      obtenerEstadoCarta: jest.fn().mockResolvedValue({
        abierta: true,
        motivo: 'OK',
        texto: 'Abierto',
      }),
    };

    zonasServiceMock = {
      detectar: jest.fn().mockResolvedValue({
        zonaId: 2n,
        codigo: 'Z3',
        tarifa: 5.0,
      }),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    puntosServiceMock = {
      obtenerSaldo: jest.fn().mockResolvedValue(0),
      canjear: jest.fn().mockResolvedValue({ puntosCanjeados: 0, saldoRestante: 0 }),
    };

    ofertasServiceMock = {
      calcularDescuentosParaPedido: jest.fn().mockResolvedValue({
        descuentoTotal: 0,
        ofertaId: null,
        cuponId: null,
        cuponEmitidoId: null,
        detalles: [],
      }),
      emitirCuponesParaPedido: jest.fn().mockResolvedValue([]),
      validarEleccionesCombo: jest.fn().mockResolvedValue(''),
    };

    direccionesMock = {
      resolverPartyPorTelefono: jest.fn().mockResolvedValue(null),
      datosCuentaActiva: jest.fn().mockResolvedValue(null),
      registrarUso: jest.fn().mockResolvedValue({ id: '1' }),
    };

    partyPuntosMock = {
      resolverOCrear: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PartyPuntosService, useValue: partyPuntosMock },
        { provide: DireccionesClienteService, useValue: direccionesMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: LocalService, useValue: localServiceMock },
        { provide: ZonasService, useValue: zonasServiceMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: OfertasService, useValue: ofertasServiceMock },
        { provide: PuntosService, useValue: puntosServiceMock },
        PagoPlanService,
      ],
    }).compile();

    service = module.get<PedidosService>(PedidosService);
  });

  describe('crear', () => {
    it('1. pedido válido de delivery con zona', async () => {
      // Precio base = 12, extra = 2 -> unit = 14, cant = 2 -> subtotal = 28
      // Envio = 5.0 -> total = 33.0
      prismaMock.pedido.create.mockResolvedValue({
        id: 100n,
        codigo: 'CP-W001',
        estado: 'COLA',
        subtotal: 28.0,
        envio: 5.0,
        total: 33.0,
      });

      const res = await service.crear(pedidoBaseDto, 'idemp-key-1');

      expect(res).toBeDefined();
      expect(res.id).toBe('100');
      expect(res.codigo).toBe('CP-W001');
      expect(res.estado).toBe('COLA');
      expect(res.subtotal).toBe(28.0);
      expect(res.envio).toBe(5.0);
      expect(res.total).toBe(33.0);
      expect(res.mensaje).toBe('Un asesor te escribirá para coordinar el pago');
      expect(res.seguimientoToken).toBe(generarTokenSeguimiento(100n));

      expect(zonasServiceMock.detectar).toHaveBeenCalledWith(
        pedidoBaseDto.entrega!.lat,
        pedidoBaseDto.entrega!.lng,
      );

      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:nuevo',
        expect.objectContaining({
          id: '100',
          codigo: 'CP-W001',
          estado: 'COLA',
        }),
      );
    });

    describe('pago dividido (plan)', () => {
      // Delivery con total 33.0 (subtotal 28 + envío 5)
      const conPlan = (plan: any, extraPago: Record<string, unknown> = {}): CrearPedidoDto => ({
        ...pedidoBaseDto,
        pago: { metodo: 'EFECTIVO', plan, ...extraPago } as any,
      });

      beforeEach(() => {
        prismaMock.pedido.create.mockResolvedValue({
          id: 100n,
          codigo: 'CP-W001',
          estado: 'COLA',
          subtotal: 28.0,
          envio: 5.0,
          total: 33.0,
        });
      });

      it('guarda un renglón por medio y el digital queda como pago_metodo', async () => {
        await service.crear(
          conPlan([
            { medio: 'EFECTIVO', monto: 13 },
            { medio: 'YAPE', monto: 20 },
          ], { pagaCon: 20 }),
          'idemp-plan-1',
        );

        expect(prismaMock.pedidoPagoPlan.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({ pedido_id: 100n, medio: 'EFECTIVO', orden: 0 }),
            expect.objectContaining({ pedido_id: 100n, medio: 'YAPE', orden: 1 }),
          ],
        });
        const data = prismaMock.pedido.create.mock.calls[0][0].data;
        expect(data.pago_metodo).toBe('YAPE');
        expect(data.pago_preferido).toBe('YAPE');
        expect(Number(data.paga_con)).toBe(20);
      });

      it('rechaza un plan cuya suma no iguala el total y no crea el pedido', async () => {
        await expect(
          service.crear(
            conPlan([
              { medio: 'EFECTIVO', monto: 10 },
              { medio: 'YAPE', monto: 20 },
            ]),
            'idemp-plan-2',
          ),
        ).rejects.toMatchObject({ response: { codigo: 'PLAN_PAGO_NO_CUADRA' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('compara el pagaCon contra la parte en efectivo, no contra el total', async () => {
        await expect(
          service.crear(
            conPlan([
              { medio: 'EFECTIVO', monto: 13 },
              { medio: 'YAPE', monto: 20 },
            ], { pagaCon: 10 }),
            'idemp-plan-3',
          ),
        ).rejects.toMatchObject({ response: { codigo: 'PAGO_INSUFICIENTE' } });
      });

      it('sin plan se comporta como antes: no crea renglones y usa pago.metodo', async () => {
        await service.crear(
          { ...pedidoBaseDto, pago: { metodo: 'YAPE' } },
          'idemp-plan-4',
        );

        expect(prismaMock.pedidoPagoPlan.createMany).not.toHaveBeenCalled();
        const data = prismaMock.pedido.create.mock.calls[0][0].data;
        expect(data.pago_metodo).toBe('YAPE');
      });
    });

    it('2. envío gratis cuando subtotal supera envio_gratis_monto (modo estrictamente mayor)', async () => {
      // 6 unidades de 14 = 84 (> 70)
      const pedidoDto: CrearPedidoDto = {
        ...pedidoBaseDto,
        lineas: [
          {
            ...pedidoBaseDto.lineas[0],
            cantidad: 6,
          },
        ],
      };

      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 101n,
          codigo: 'CP-W002',
          estado: 'COLA',
          subtotal: Number(data.subtotal),
          envio: data.envio !== null ? Number(data.envio) : null,
          total: Number(data.total),
        });
      });

      const res = await service.crear(pedidoDto, 'idemp-key-gratis');

      expect(res.subtotal).toBe(84.0);
      expect(res.envio).toBe(0); // Envío gratis
      expect(res.total).toBe(84.0);
    });

    it('4. modo desde: el monto exacto ya da envío gratis', async () => {
      prismaMock.parametro.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.clave === 'envio_gratis_monto'
            ? { clave: where.clave, valor: 70 }
            : where.clave === 'envio_gratis_modo'
              ? { clave: where.clave, valor: 'desde' }
              : null,
        ),
      );
      // 5 unidades de 14 = 70 (exacto)
      const pedidoDto: CrearPedidoDto = {
        ...pedidoBaseDto,
        lineas: [{ ...pedidoBaseDto.lineas[0], cantidad: 5 }],
      };
      prismaMock.pedido.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 102n, codigo: 'CP-W004', estado: 'COLA', subtotal: Number(data.subtotal), envio: Number(data.envio), total: Number(data.total) }),
      );

      const res = await service.crear(pedidoDto, 'idemp-key-desde');

      expect(res.subtotal).toBe(70);
      expect(res.envio).toBe(0);
    });

    it('5. modo mas_de (por defecto): el monto exacto NO es gratis y paga la tarifa de zona', async () => {
      // 5 unidades de 14 = 70 (exacto); la zona Z3 cobra 5.00
      const pedidoDto: CrearPedidoDto = {
        ...pedidoBaseDto,
        lineas: [{ ...pedidoBaseDto.lineas[0], cantidad: 5 }],
      };
      prismaMock.pedido.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 103n, codigo: 'CP-W005', estado: 'COLA', subtotal: Number(data.subtotal), envio: Number(data.envio), total: Number(data.total) }),
      );

      const res = await service.crear(pedidoDto, 'idemp-key-masde');

      expect(res.envio).toBe(5);
      expect(res.total).toBe(75);
    });

    it('3. fuera de cobertura -> 409 FUERA_DE_COBERTURA', async () => {
      zonasServiceMock.detectar.mockResolvedValue(null);

      await expect(
        service.crear(pedidoBaseDto, 'idemp-fuera-cobertura'),
      ).rejects.toThrow(HttpException);

      try {
        await service.crear(pedidoBaseDto, 'idemp-fuera-cobertura');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'FUERA_DE_COBERTURA',
          }),
        );
      }
    });

    it('4. producto agotado -> 409 PRODUCTO_AGOTADO con el nombre', async () => {
      const prodAgotado = {
        ...mockProductoCafe,
        agotado_hasta: new Date(Date.now() + 1000 * 60 * 60), // agotado por 1 hora más
      };
      prismaMock.producto.findMany.mockResolvedValue([prodAgotado]);

      await expect(
        service.crear(pedidoBaseDto, 'idemp-prod-agotado'),
      ).rejects.toThrow(HttpException);

      try {
        await service.crear(pedidoBaseDto, 'idemp-prod-agotado');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'PRODUCTO_AGOTADO',
            mensaje: expect.stringContaining('Americano'),
          }),
        );
      }
    });

    it('5. grupo obligatorio incompleto -> 400 OPCIONES_INVALIDAS con el grupo', async () => {
      const pedidoSinOpcionObligatoria: CrearPedidoDto = {
        ...pedidoBaseDto,
        lineas: [
          {
            productoId: 1,
            tamanoId: 10,
            cantidad: 1,
            opciones: [], // Grupo Tipo de Leche es obligatorio pero no se envió
          },
        ],
      };

      await expect(
        service.crear(pedidoSinOpcionObligatoria, 'idemp-sin-opc'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.crear(pedidoSinOpcionObligatoria, 'idemp-sin-opc');
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: expect.stringContaining('Tipo de Leche'),
          }),
        );
      }
    });

    it('6. Idempotency-Key repetida devuelve el mismo pedido sin crear otro', async () => {
      const pedidoYaRegistrado = {
        id: 77n,
        codigo: 'CP-W077',
        estado: 'COLA',
        subtotal: 28.0,
        envio: 5.0,
        total: 33.0,
      };

      prismaMock.pedido.findUnique.mockResolvedValue(pedidoYaRegistrado);

      const res = await service.crear(pedidoBaseDto, 'idemp-repetida');

      expect(res.id).toBe('77');
      expect(res.codigo).toBe('CP-W077');
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('7. factura sin ruc o incompleta -> 400 FACTURA_DATOS_INCOMPLETOS', async () => {
      const pedidoFacturaInvalida: CrearPedidoDto = {
        ...pedidoBaseDto,
        comprobante: {
          tipo: 'FACTURA',
          ruc: '123', // RUC no tiene 11 dígitos
          razonSocial: '',
        },
      };

      await expect(
        service.crear(pedidoFacturaInvalida, 'idemp-factura-mala'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.crear(pedidoFacturaInvalida, 'idemp-factura-mala');
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'FACTURA_DATOS_INCOMPLETOS',
          }),
        );
      }
    });

    it('8. carta cerrada -> 409 CARTA_CERRADA con su texto', async () => {
      localServiceMock.obtenerEstadoCarta.mockResolvedValue({
        abierta: false,
        motivo: 'HORARIO',
        texto: 'Abrimos hoy a las 14:00',
      });

      await expect(
        service.crear(pedidoBaseDto, 'idemp-carta-cerrada'),
      ).rejects.toThrow(HttpException);

      try {
        await service.crear(pedidoBaseDto, 'idemp-carta-cerrada');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'CARTA_CERRADA',
            mensaje: 'Abrimos hoy a las 14:00',
          }),
        );
      }
    });

    it('9. el precio enviado por el cliente se ignora por completo', async () => {
      // Cliente intenta mandar precio 0.01 y subtotal 0.01 en la línea
      const pedidoConPrecioManipulado: CrearPedidoDto = {
        ...pedidoBaseDto,
        lineas: [
          {
            ...pedidoBaseDto.lineas[0],
            precio: 0.01,
          },
        ],
      };

      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 105n,
          codigo: 'CP-W005',
          estado: 'COLA',
          subtotal: Number(data.subtotal),
          envio: Number(data.envio),
          total: Number(data.total),
        });
      });

      const res = await service.crear(pedidoConPrecioManipulado, 'idemp-manipulado');

      // Servidor calcula 12 (tamaño) + 2 (leche) = 14 por 2 unidades = 28.0 (ignora 0.01)
      expect(res.subtotal).toBe(28.0);
      expect(res.total).toBe(33.0);
    });

    it('10. aplica descuento con cuponCodigo y calcula total = subtotal - descuento + envio en el servidor', async () => {
      // Subtotal = 28, Envio = 5. Con cupón S/ 5 de descuento: Descuento = 5, Total = 28 - 5 + 5 = 28
      ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValueOnce({
        descuentoTotal: 5.0,
        ofertaId: null,
        cuponId: '10',
        cuponEmitidoId: null,
        detalles: [
          {
            tipo: 'CUPON',
            nombre: 'Cupón BIENVENIDO5',
            descuentoTipo: 'MONTO',
            descuentoValor: 5.0,
            montoDescontado: 5.0,
          },
        ],
      });

      let pedidoCreadoData: any = null;
      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        pedidoCreadoData = data;
        return Promise.resolve({
          id: 101n,
          codigo: 'CP-W002',
          estado: 'COLA',
          subtotal: data.subtotal,
          descuento: data.descuento,
          envio: data.envio,
          total: data.total,
        });
      });
      prismaMock.cupon = { update: jest.fn().mockResolvedValue({}) };
      prismaMock.cuponCanjeCompartido = { create: jest.fn().mockResolvedValue({}) };

      const res = await service.crear(
        { ...pedidoBaseDto, cuponCodigo: 'BIENVENIDO5' },
        'idemp-cupon-valido',
      );

      expect(ofertasServiceMock.calcularDescuentosParaPedido).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 28.0,
          cuponCodigo: 'BIENVENIDO5',
        }),
      );
      expect(pedidoCreadoData.descuento.toNumber()).toBe(5.0);
      expect(pedidoCreadoData.total.toNumber()).toBe(28.0);
      expect(pedidoCreadoData.cupon_id).toBe(10n);
      expect(res.subtotal).toBe(28.0);
      expect(res.descuento).toBe(5.0);
      expect(res.total).toBe(28.0);
    });

    describe('combo con parte fija y reemplazos', () => {
      const dtoCombo = (): CrearPedidoDto => ({
        ...pedidoBaseDto,
        lineas: [{ ...pedidoBaseDto.lineas[0], ofertaId: 3, comboElecciones: [{ parteId: 100, productoId: 7 }] }],
      });

      it('devuelve 409 COMBO_PARTE_NO_DISPONIBLE si la elección no está disponible y no crea el pedido', async () => {
        ofertasServiceMock.validarEleccionesCombo.mockRejectedValueOnce(
          new HttpException({ codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'x' }, HttpStatus.CONFLICT),
        );
        await expect(service.crear(dtoCombo(), 'idemp-combo-409')).rejects.toMatchObject({
          response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE' },
          status: 409,
        });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('guarda en la nota de la línea el producto realmente elegido', async () => {
        ofertasServiceMock.validarEleccionesCombo.mockResolvedValueOnce('Combo Dúo · Empanada (en lugar de Club Sandwich)');
        prismaMock.pedido.create.mockResolvedValue({ id: 120n, codigo: 'CP-W120', estado: 'COLA', subtotal: 28, envio: 5, total: 33 });
        await service.crear(dtoCombo(), 'idemp-combo-ok');
        expect(ofertasServiceMock.validarEleccionesCombo).toHaveBeenCalledWith(3, [{ parteId: 100, productoId: 7 }]);
        expect(prismaMock.pedidoLinea.create.mock.calls[0][0].data.nota).toBe(
          'Combo Dúo · Empanada (en lugar de Club Sandwich) · Sin azúcar',
        );
      });
    });

    describe('canje de puntos (DT-55)', () => {
      beforeEach(() => {
        direccionesMock.datosCuentaActiva.mockResolvedValue({ nombre: 'Ana', telefono: '987654321' });
      });

      it('un party de puntos sin cuenta activa no puede canjear: PUNTOS_REQUIEREN_CUENTA', async () => {
        direccionesMock.datosCuentaActiva.mockResolvedValue(null);
        puntosServiceMock.obtenerSaldo.mockResolvedValue(50);

        const err = await service
          .crear({ ...pedidoBaseDto, puntosCanje: 10 }, 'idemp-canje-sin-cuenta', { canal: 'CARTA', clientePartyId: 300n })
          .catch((e) => e);

        expect(err.getResponse()).toMatchObject({ codigo: 'PUNTOS_REQUIEREN_CUENTA' });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        expect(puntosServiceMock.canjear).not.toHaveBeenCalled();
      });

      it('rechaza un canje mayor al monto elegible con TOPE_CANJE_EXCEDIDO', async () => {
        // Subtotal = 28 sin descuento: elegible = 28. Canje de 30 excede el monto de productos
        puntosServiceMock.obtenerSaldo.mockResolvedValue(50);

        const err = await service
          .crear({ ...pedidoBaseDto, puntosCanje: 30 }, 'idemp-canje-tope', { clientePartyId: 200n })
          .catch((e) => e);

        expect(err.getResponse()).toMatchObject({ codigo: 'TOPE_CANJE_EXCEDIDO' });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        expect(puntosServiceMock.canjear).not.toHaveBeenCalled();
      });

      it('acepta un canje menor al monto elegible y descuenta el total', async () => {
        puntosServiceMock.obtenerSaldo.mockResolvedValue(50);
        prismaMock.pedido.create.mockResolvedValue({
          id: 101n,
          codigo: 'CP-W003',
          estado: 'COLA',
          subtotal: 28.0,
          envio: 5.0,
          total: 33.0,
        });

        await service.crear({ ...pedidoBaseDto, puntosCanje: 10 }, 'idemp-canje-ok', { clientePartyId: 200n });

        expect(puntosServiceMock.canjear).toHaveBeenCalledWith(200n, 10, 101n);
        const ultimoUpdate = prismaMock.pedido.update.mock.calls.at(-1)[0];
        expect(ultimoUpdate.data.total.toNumber()).toBe(23.0);
      });
    });

    it('falta cabecera Idempotency-Key -> 400 CLAVE_REQUERIDA', async () => {
      await expect(service.crear(pedidoBaseDto, '')).rejects.toThrow(
        BadRequestException,
      );

      try {
        await service.crear(pedidoBaseDto, undefined);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'CLAVE_REQUERIDA',
          }),
        );
      }
    });

    describe('origen MOZO', () => {
      it('crea pedido con canal MOZO, omite chequeo de carta cerrada y no exige cliente ni teléfono', async () => {
        // Carta cerrada
        localServiceMock.obtenerEstadoCarta.mockResolvedValue({
          abierta: false,
          motivo: 'FUERA_HORARIO',
          texto: 'Local cerrado',
        });

        const pedidoMozoDto: any = {
          modalidad: 'MESA',
          lineas: pedidoBaseDto.lineas,
          pago: { metodo: 'EFECTIVO' },
        };

        let pedidoCreadoData: any = null;
        prismaMock.pedido.create.mockImplementation(({ data }: any) => {
          pedidoCreadoData = data;
          return Promise.resolve({
            id: 200n,
            codigo: 'CP-W099',
            estado: 'COLA',
            subtotal: Number(data.subtotal),
            envio: 0,
            total: Number(data.total),
          });
        });

        let callbackEjecutado = false;
        const res = await service.crear(pedidoMozoDto, 'idemp-mozo-1', {
          canal: 'MOZO',
          usuarioPartyId: 55n,
          mesasIds: [3n],
          mesaNombre: 'Mesa 3',
          enTransaccion: async () => {
            callbackEjecutado = true;
          },
        });

        expect(res.codigo).toBe('CP-W099');
        expect(res.estado).toBe('COLA');
        expect(res.mensaje).toBe('Pedido enviado a cocina');
        expect(callbackEjecutado).toBe(true);
        expect(pedidoCreadoData.canal).toBe('MOZO');
        expect(pedidoCreadoData.party_id).toBe(55n);
        expect(pedidoCreadoData.mesa_nombre).toBe('Mesa 3');
        expect(pedidoCreadoData.cliente_nombre).toBe('Mesa 3');
        expect(pedidoCreadoData.cliente_telefono).toBeNull();
      });

      it('acepta un medio digital (YAPE, PLIN, TRANSFERENCIA) para llevar desde el canal MOZO', async () => {
        for (const metodo of ['YAPE', 'PLIN', 'TRANSFERENCIA'] as const) {
          let pedidoCreadoData: any = null;
          prismaMock.pedido.create.mockImplementation(({ data }: any) => {
            pedidoCreadoData = data;
            return Promise.resolve({
              id: 300n,
              codigo: 'CP-W300',
              estado: 'COLA',
              subtotal: Number(data.subtotal),
              envio: null,
              total: Number(data.total),
            });
          });

          const res = await service.crear(
            { ...pedidoBaseDto, modalidad: 'RECOGER', pago: { metodo } } as any,
            `idemp-mozo-${metodo}`,
            { canal: 'MOZO', usuarioPartyId: 55n },
          );

          expect(res.codigo).toBe('CP-W300');
          expect(pedidoCreadoData.canal).toBe('MOZO');
          expect(pedidoCreadoData.pago_metodo).toBe(metodo);
          expect(pedidoCreadoData.pago_estado).toBe('PENDIENTE');
        }
      });
    });
  });

  describe('aviso de pedido recibido al cliente (carta)', () => {
    let avisar: jest.Mock;

    beforeEach(() => {
      avisar = jest.fn().mockResolvedValue({ estado: 'SIMULADO' });
      (service as any).avisosPedidoService = { avisar, despertar: jest.fn() };
      prismaMock.pedido.create.mockResolvedValue({
        id: 100n,
        codigo: 'CP-W001',
        estado: 'COLA',
        subtotal: 28.0,
        envio: 5.0,
        total: 33.0,
      });
    });

    const esperarFondo = () => new Promise((r) => setImmediate(r));

    it('pedido de la carta: dispara el aviso RECIBIDO después de crear, sin frenar la respuesta', async () => {
      const res = await service.crear(pedidoBaseDto, 'idemp-recibido-1');

      expect(res.id).toBe('100');
      await esperarFondo();
      expect(avisar).toHaveBeenCalledTimes(1);
      expect(avisar).toHaveBeenCalledWith(100n, 'RECIBIDO', {}, expect.anything());
    });

    it('pedido de mozo no dispara el aviso de la carta', async () => {
      await service.crear(pedidoBaseDto, 'idemp-recibido-mozo', { canal: 'MOZO' });

      await esperarFondo();
      expect(avisar).not.toHaveBeenCalled();
    });

    it('pedido del chatbot (canal WHATSAPP) no dispara el aviso de la carta', async () => {
      await service.crear(pedidoBaseDto, 'idemp-recibido-wa', { canal: 'WHATSAPP' });

      await esperarFondo();
      expect(avisar).not.toHaveBeenCalled();
    });

    it('el aviso va dentro de la transacción del pedido: si no se puede encolar, el pedido no se crea', async () => {
      avisar.mockRejectedValueOnce(new Error('BD caída al encolar'));

      await expect(service.crear(pedidoBaseDto, 'idemp-recibido-fallo')).rejects.toThrow('BD caída al encolar');
      expect(avisar).toHaveBeenCalledWith(expect.anything(), 'RECIBIDO', {}, expect.anything());
    });

    it('repetir la misma Idempotency-Key no vuelve a avisar', async () => {
      await service.crear(pedidoBaseDto, 'idemp-recibido-repetida');
      prismaMock.pedido.findUnique.mockResolvedValueOnce({
        id: 100n,
        codigo: 'CP-W001',
        estado: 'COLA',
        subtotal: 28,
        descuento: 0,
        envio: 5,
        total: 33,
      });

      await service.crear(pedidoBaseDto, 'idemp-recibido-repetida');

      await esperarFondo();
      expect(avisar).toHaveBeenCalledTimes(1);
    });
  });

  describe('cliente identificado y direcciones de delivery', () => {
    const crearPedidoCapturado = () => {
      const capturado: { data?: any } = {};
      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        capturado.data = data;
        return Promise.resolve({
          id: 300n,
          codigo: 'CP-W300',
          estado: 'COLA',
          subtotal: Number(data.subtotal),
          descuento: 0,
          envio: data.envio !== null ? Number(data.envio) : null,
          total: Number(data.total),
        });
      });
      return capturado;
    };

    it('MOZO con celular de cliente con cuenta: guarda cliente_party_id, deja party_id del mozo y registra la dirección', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(77n);

      await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678' } as any, 'idemp-dni-1', {
        canal: 'MOZO',
        usuarioPartyId: 55n,
      });

      expect(direccionesMock.resolverPartyPorTelefono).toHaveBeenCalledWith('912345678');
      expect(capturado.data.cliente_party_id).toBe(77n);
      expect(capturado.data.party_id).toBe(55n);
      expect(direccionesMock.registrarUso).toHaveBeenCalledWith(
        77n,
        expect.objectContaining({ direccion: 'Av. Las Palmeras 123', referencia: 'Frente al parque' }),
        'MOZO',
        prismaMock,
      );
    });

    it('MOZO con celular sin cuenta: falla con CLIENTE_NO_ENCONTRADO y no crea el pedido', async () => {
      crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(null);

      await expect(
        service.crear({ ...pedidoBaseDto, clienteTelefono: '987654321' } as any, 'idemp-dni-2', {
          canal: 'MOZO',
          usuarioPartyId: 55n,
        }),
      ).rejects.toMatchObject({ response: { codigo: 'CLIENTE_NO_ENCONTRADO' } });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('MOZO sin celular (invitado): cliente_party_id queda null y no registra dirección', async () => {
      const capturado = crearPedidoCapturado();

      await service.crear(pedidoBaseDto, 'idemp-dni-3', { canal: 'MOZO', usuarioPartyId: 55n });

      expect(capturado.data.cliente_party_id).toBeNull();
      expect(direccionesMock.resolverPartyPorTelefono).not.toHaveBeenCalled();
      expect(direccionesMock.registrarUso).not.toHaveBeenCalled();
    });

    it('MOZO con celular en pedido para recoger: guarda el cliente pero no registra dirección', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(77n);

      await service.crear({ ...pedidoBaseDto, modalidad: 'RECOGER', entrega: undefined, clienteTelefono: '912345678' } as any, 'idemp-dni-4', {
        canal: 'MOZO',
        usuarioPartyId: 55n,
      });

      expect(capturado.data.cliente_party_id).toBe(77n);
      expect(direccionesMock.registrarUso).not.toHaveBeenCalled();
    });

    it('MOZO: el cupón compartido y el descuento se evalúan con el cliente identificado, no con el mozo', async () => {
      crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(77n);

      await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678' } as any, 'idemp-dni-5', {
        canal: 'MOZO',
        usuarioPartyId: 55n,
      });

      expect(ofertasServiceMock.calcularDescuentosParaPedido).toHaveBeenCalledWith(
        expect.objectContaining({ clientePartyId: 77n }),
      );
    });

    it('carta con sesión de cliente: guarda cliente_party_id y registra la dirección como CARTA', async () => {
      const capturado = crearPedidoCapturado();

      await service.crear(pedidoBaseDto, 'idemp-carta-1', { canal: 'CARTA', clientePartyId: 88n });

      expect(capturado.data.cliente_party_id).toBe(88n);
      expect(capturado.data.party_id).toBe(88n);
      expect(direccionesMock.registrarUso).toHaveBeenCalledWith(88n, expect.any(Object), 'CARTA', prismaMock);
    });

    it('carta sin sesión: invitado, y un clienteDni enviado desde la carta se ignora', async () => {
      const capturado = crearPedidoCapturado();

      await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678' } as any, 'idemp-carta-2', { canal: 'CARTA' });

      expect(capturado.data.cliente_party_id).toBeNull();
      expect(direccionesMock.resolverPartyPorTelefono).not.toHaveBeenCalled();
      expect(direccionesMock.registrarUso).not.toHaveBeenCalled();
    });

    it('MOZO con clientePartyId de cliente con cuenta: guarda cliente_party_id y toma nombre y teléfono de la cuenta', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.datosCuentaActiva.mockResolvedValue({ nombre: 'Ana Quispe', telefono: '987654321' });

      await service.crear({ ...pedidoBaseDto, clientePartyId: '77', cliente: { nombre: '', telefono: '' } } as any, 'idemp-pid-1', {
        canal: 'MOZO',
        usuarioPartyId: 55n,
      });

      expect(direccionesMock.datosCuentaActiva).toHaveBeenCalledWith(77n);
      expect(capturado.data.cliente_party_id).toBe(77n);
      expect(capturado.data.party_id).toBe(55n);
      expect(capturado.data.cliente_nombre).toBe('Ana Quispe');
      expect(capturado.data.cliente_telefono).toBe('987654321');
    });

    it('MOZO con clientePartyId sin cuenta activa: falla con CLIENTE_NO_ENCONTRADO y no crea el pedido', async () => {
      crearPedidoCapturado();
      direccionesMock.datosCuentaActiva.mockResolvedValue(null);

      await expect(
        service.crear({ ...pedidoBaseDto, clientePartyId: '999' } as any, 'idemp-pid-2', {
          canal: 'MOZO',
          usuarioPartyId: 55n,
        }),
      ).rejects.toMatchObject({ response: { codigo: 'CLIENTE_NO_ENCONTRADO' } });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('carta con clientePartyId enviado en el cuerpo: se ignora (cliente_party_id null)', async () => {
      const capturado = crearPedidoCapturado();

      await service.crear({ ...pedidoBaseDto, clientePartyId: '77' } as any, 'idemp-pid-3', { canal: 'CARTA' });

      expect(capturado.data.cliente_party_id).toBeNull();
      expect(direccionesMock.datosCuentaActiva).not.toHaveBeenCalled();
    });

    it('MOZO con clienteDni y clientePartyId: gana el DNI', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(77n);

      await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678', clientePartyId: '88' } as any, 'idemp-pid-4', {
        canal: 'MOZO',
        usuarioPartyId: 55n,
      });

      expect(capturado.data.cliente_party_id).toBe(77n);
      expect(direccionesMock.datosCuentaActiva).not.toHaveBeenCalledWith(88n);
    });

    it('WhatsApp: identifica al cliente por el teléfono de quien escribe y registra la dirección como WHATSAPP', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(99n);

      await service.crear(pedidoBaseDto, 'idemp-wa-1', { canal: 'WHATSAPP', telefonoRemitente: '987654321' });

      expect(direccionesMock.resolverPartyPorTelefono).toHaveBeenCalledWith('987654321');
      expect(capturado.data.cliente_party_id).toBe(99n);
      expect(direccionesMock.registrarUso).toHaveBeenCalledWith(99n, expect.any(Object), 'WHATSAPP', prismaMock);
    });

    it('WhatsApp: la cuenta elegida por el cliente gana sobre la del teléfono', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(99n);
      direccionesMock.datosCuentaActiva.mockResolvedValue({ nombre: 'Ana', telefono: null });

      await service.crear(pedidoBaseDto, 'idemp-wa-2', { canal: 'WHATSAPP', clientePartyId: '123', telefonoRemitente: '987654321' });

      expect(capturado.data.cliente_party_id).toBe(123n);
      expect(direccionesMock.resolverPartyPorTelefono).not.toHaveBeenCalled();
    });

    it('WhatsApp: una cuenta sin rol CLIENTE vigente se ignora y el pedido queda como invitado', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.datosCuentaActiva.mockResolvedValue({ nombre: 'Ana', telefono: null });
      prismaMock.partyRole.findFirst.mockResolvedValue(null);

      await service.crear(pedidoBaseDto, 'idemp-wa-3', { canal: 'WHATSAPP', clientePartyId: '123' });

      expect(capturado.data.cliente_party_id ?? null).toBeNull();
    });

    it('WhatsApp: «No, gracias» es invitado de verdad: no busca ninguna cuenta por teléfono', async () => {
      const capturado = crearPedidoCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValue(99n);

      await service.crear(pedidoBaseDto, 'idemp-wa-4', { canal: 'WHATSAPP', telefonoRemitente: '987654321', sinCuentaCliente: true });

      expect(direccionesMock.resolverPartyPorTelefono).not.toHaveBeenCalled();
      expect(capturado.data.cliente_party_id ?? null).toBeNull();
    });
  });

  describe('celular sin cuenta suma puntos y regla del invitado', () => {
    const crearCapturado = () => {
      const capturado: { data?: any } = {};
      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        capturado.data = data;
        return Promise.resolve({
          id: 310n,
          codigo: 'CP-W310',
          estado: 'COLA',
          subtotal: Number(data.subtotal),
          descuento: 0,
          envio: data.envio !== null ? Number(data.envio) : null,
          total: Number(data.total),
        });
      });
      return capturado;
    };
    const conParametro = (clave: string, valor: string | null) => {
      const base = prismaMock.parametro.findUnique.getMockImplementation();
      prismaMock.parametro.findUnique.mockImplementation(({ where }: any) =>
        where.clave === clave ? Promise.resolve(valor === null ? null : { clave, valor }) : base({ where }),
      );
    };

    beforeEach(() => {
      partyPuntosMock.resolverOCrear.mockResolvedValue(300n);
    });

    it('CARTA sin sesión con celular: el pedido queda en el party de puntos de ese celular', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-pp-carta', undefined);
      expect(partyPuntosMock.resolverOCrear).toHaveBeenCalledWith('987654321');
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    it('WhatsApp con teléfono de quien escribe: usa el party de puntos', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-pp-wa', { canal: 'WHATSAPP', telefonoRemitente: '987654321' });
      expect(partyPuntosMock.resolverOCrear).toHaveBeenCalledWith('987654321');
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    it('WhatsApp «No, gracias» (sinCuentaCliente) no crea ni busca party de puntos', async () => {
      crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-pp-wa-no', { canal: 'WHATSAPP', telefonoRemitente: '987654321', sinCuentaCliente: true });
      expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalled();
    });

    it('MOZO con celular sin cuenta: usa el party de puntos en vez de CLIENTE_NO_ENCONTRADO', async () => {
      const capturado = crearCapturado();
      await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678' } as any, 'idemp-pp-mozo', { canal: 'MOZO', mesaNombre: 'Mesa 2' });
      expect(partyPuntosMock.resolverOCrear).toHaveBeenCalledWith('912345678');
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    it('MOZO con celular que no se puede usar (inválido o desactivado): CLIENTE_NO_ENCONTRADO', async () => {
      partyPuntosMock.resolverOCrear.mockResolvedValue(null);
      const err = await service
        .crear({ ...pedidoBaseDto, clienteTelefono: '912345678' } as any, 'idemp-pp-mozo-no', { canal: 'MOZO', mesaNombre: 'Mesa 2' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CLIENTE_NO_ENCONTRADO' });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('CELULAR_REQUERIDO: carta sin sesión, sin celular y con invitado apagado (sin parámetro)', async () => {
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-celular-off', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toEqual({
        codigo: 'CELULAR_REQUERIDO',
        mensaje: 'Escribe tu celular para hacer tu pedido y sumar puntos',
      });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('CELULAR_REQUERIDO: el placeholder 999999999 cuenta como sin celular', async () => {
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '999999999' } } as any, 'idemp-celular-relleno', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CELULAR_REQUERIDO' });
    });

    it('invitado apagado (valor «no») también exige celular', async () => {
      conParametro('carta_invitado_activo', 'no');
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-celular-no', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CELULAR_REQUERIDO' });
    });

    it('invitado encendido: pide sin celular, queda como invitado (sin party de puntos)', async () => {
      conParametro('carta_invitado_activo', 'si');
      const capturado = crearCapturado();
      await service.crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-invitado-on', { canal: 'CARTA' });
      expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalled();
      expect(capturado.data.cliente_party_id).toBeNull();
      expect(capturado.data.cliente_telefono).toBeNull();
    });

    it('invitado apagado con celular válido: pide y suma puntos', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-celular-ok', { canal: 'CARTA' });
      expect(capturado.data.cliente_party_id).toBe(300n);
    });
  });
});
