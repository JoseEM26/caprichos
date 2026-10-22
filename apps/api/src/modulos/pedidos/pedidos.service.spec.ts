// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
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
import { CrearPedidoDto } from './dto/crear-pedido.dto';

describe('PedidosService', () => {
  let service: PedidosService;
  let prismaMock: any;
  let localServiceMock: any;
  let zonasServiceMock: any;
  let eventosGatewayMock: any;

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
      pedido: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      pedidoLinea: {
        create: jest.fn().mockResolvedValue({ id: 50n }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LocalService, useValue: localServiceMock },
        { provide: ZonasService, useValue: zonasServiceMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
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
    });
  });
});
