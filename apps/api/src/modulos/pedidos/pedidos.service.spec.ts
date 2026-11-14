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
import { PedidosService, enmascararDireccion } from './pedidos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { ZonasService } from '../zonas/zonas.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { PuntosService } from '../clientes/puntos.service';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import { PartyPuntosService } from '../clientes/party-puntos.service';
import { FacturacionClienteService } from '../clientes/facturacion-cliente.service';
import { PagoPlanService } from './pago-plan.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
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
  let redisMock: any;
  let auditoriaMock: any;
  let facturacionMock: any;

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
      cumpleanos: '1990-03-14',
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
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
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
        // La consulta de productos que controlan stock (descuento al crear) no devuelve nada en estos casos
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where?.controla_stock ? [] : [mockProductoCafe]),
        ),
      },
      oferta: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      parametro: {
        findMany: jest.fn().mockResolvedValue([]),
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
      // mismo contrato que LocalService.exigirLocalAbierto: 409 CARTA_CERRADA si el estado no es abierto
      exigirLocalAbierto: jest.fn().mockImplementation(async () => {
        const e = await localServiceMock.obtenerEstadoCarta();
        if (!e.abierta) {
          throw new HttpException({ codigo: 'CARTA_CERRADA', mensaje: e.texto }, HttpStatus.CONFLICT);
        }
        return e;
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
      resolverPartesCombo: jest.fn().mockResolvedValue({ nota: '', partes: [] }),
    };

    direccionesMock = {
      resolverPartyPorTelefono: jest.fn().mockResolvedValue(null),
      datosCuentaActiva: jest.fn().mockResolvedValue(null),
      registrarUso: jest.fn().mockResolvedValue({ id: '1' }),
    };

    partyPuntosMock = {
      resolverOCrear: jest.fn().mockResolvedValue(null),
      completarDatos: jest.fn().mockResolvedValue(undefined),
    };

    redisMock = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) };

    auditoriaMock = { registrar: jest.fn().mockResolvedValue(undefined) };
    facturacionMock = { asignarSiFalta: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: FacturacionClienteService, useValue: facturacionMock },
        { provide: RedisService, useValue: { obtenerCliente: () => redisMock } },
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

    describe('pedido programado (solo Caja y mozo)', () => {
      const manana = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dtoRecoger: CrearPedidoDto = { ...pedidoBaseDto, modalidad: 'RECOGER', entrega: undefined, pago: { metodo: 'EFECTIVO', pagaCon: 100 } };
      const creado = (estado: string) => ({ id: 300n, codigo: 'CP-W300', estado, subtotal: 28.0, envio: null, total: 28.0, programado_para: manana(), canal: 'CAJA', modalidad: 'RECOGER' });

      it('Caja lo crea PROGRAMADO: no entra a cocina hoy (sin pasa_cocina_en) y guarda la fecha pactada', async () => {
        prismaMock.pedido.create.mockResolvedValue(creado('PROGRAMADO'));
        const fecha = manana();
        const res = await service.crear(dtoRecoger, 'prog-1', { canal: 'CAJA', usuarioPartyId: 7n, programadoPara: fecha });
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(data.estado).toBe('PROGRAMADO');
        expect(data.pasa_cocina_en).toBeNull();
        expect(data.programado_para).toEqual(fecha);
        expect(res.estado).toBe('PROGRAMADO');
        expect(prismaMock.pedidoEstadoHistorial.create.mock.calls.at(-1)[0].data.estado_nuevo).toBe('PROGRAMADO');
      });

      it('sin programadoPara nace COLA y llega a cocina de inmediato (como siempre)', async () => {
        prismaMock.pedido.create.mockResolvedValue(creado('COLA'));
        await service.crear(dtoRecoger, 'prog-2', { canal: 'CAJA', usuarioPartyId: 7n });
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(data.estado).toBe('COLA');
        expect(data.pasa_cocina_en).toBeInstanceOf(Date);
        expect(data.programado_para).toBeNull();
      });

      it('carta, WhatsApp y bot no pueden programar: 403 y no se crea nada', async () => {
        for (const canal of ['CARTA', 'WHATSAPP', 'BOT'] as const) {
          await expect(service.crear(dtoRecoger, `prog-${canal}`, { canal, programadoPara: manana() })).rejects.toMatchObject({
            response: { codigo: 'PROGRAMAR_SIN_PERMISO' },
          });
        }
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('rechaza una fecha pasada o más lejos del tope (7 días por defecto)', async () => {
        await expect(service.crear(dtoRecoger, 'prog-3', { canal: 'CAJA', programadoPara: new Date(Date.now() - 60_000) })).rejects.toMatchObject({ response: { codigo: 'PROGRAMADO_EN_EL_PASADO' } });
        await expect(service.crear(dtoRecoger, 'prog-4', { canal: 'CAJA', programadoPara: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000) })).rejects.toMatchObject({ response: { codigo: 'PROGRAMADO_MUY_LEJOS' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('el adelanto entra a la caja de HOY en la misma transacción y borra el plan declarado', async () => {
        prismaMock.pedido.create.mockResolvedValue(creado('PROGRAMADO'));
        prismaMock.caja = { findUnique: jest.fn().mockResolvedValue({ id: 5n, estado: 'ABIERTA' }) };
        prismaMock.pedidoAdelanto = { create: jest.fn().mockResolvedValue({ id: 1n, medio: 'EFECTIVO' }) };
        prismaMock.pedidoPagoPlan.deleteMany = jest.fn();
        prismaMock.pedido.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 300n, estado: 'PROGRAMADO', total: 28, monto_credito: 0, adelanto_total: 0 });
        await service.crear(dtoRecoger, 'prog-5', { canal: 'CAJA', usuarioPartyId: 7n, programadoPara: manana(), adelanto: { medio: 'EFECTIVO', monto: 10, pagaCon: 20 } });
        expect(prismaMock.pedidoAdelanto.create.mock.calls[0][0].data).toMatchObject({ caja_id: 5n, medio: 'EFECTIVO', por_party_id: 7n });
        expect(Number(prismaMock.pedidoAdelanto.create.mock.calls[0][0].data.vuelto)).toBe(10);
        expect(prismaMock.pedidoPagoPlan.deleteMany).toHaveBeenCalled();
      });

      it('con la caja de hoy cerrada el adelanto falla (409) y el pedido no queda', async () => {
        prismaMock.pedido.create.mockResolvedValue(creado('PROGRAMADO'));
        prismaMock.caja = { findUnique: jest.fn().mockResolvedValue({ id: 5n, estado: 'CERRADA' }), findFirst: jest.fn().mockResolvedValue(null) };
        prismaMock.pedidoAdelanto = { create: jest.fn() };
        await expect(service.crear(dtoRecoger, 'prog-6', { canal: 'CAJA', programadoPara: manana(), adelanto: { medio: 'EFECTIVO', monto: 10 } })).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
        expect(prismaMock.pedidoAdelanto.create).not.toHaveBeenCalled();
      });

      it('un adelanto sin programar se rechaza', async () => {
        await expect(service.crear(dtoRecoger, 'prog-7', { canal: 'CAJA', adelanto: { medio: 'EFECTIVO', monto: 10 } })).rejects.toMatchObject({ response: { codigo: 'ADELANTO_SOLO_PROGRAMADO' } });
      });
    });

    describe('pedido extra (pedidoOrigenId)', () => {
      it('delivery con zona: envío 0 (no vuelve a cobrar), total = subtotal y queda enlazado al original', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 102n, codigo: 'CP-W003', estado: 'COLA', subtotal: 28.0, envio: 0, total: 28.0 });

        const res = await service.crear(pedidoBaseDto, 'idemp-extra', { canal: 'CAJA', pedidoOrigenId: 100n });

        expect(res.envio).toBe(0);
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(Number(data.envio)).toBe(0);
        expect(Number(data.total)).toBe(28);
        expect(data.pedido_origen_id).toBe(100n);
        expect(data.canal).toBe('CAJA');
      });

      it('sin pedidoOrigenId el pedido no se enlaza a nadie', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 103n, codigo: 'CP-W004', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 33.0 });
        await service.crear(pedidoBaseDto, 'idemp-normal', { canal: 'CAJA' });
        expect(prismaMock.pedido.create.mock.calls.at(-1)[0].data.pedido_origen_id).toBeNull();
      });
    });

    describe('pedido extra (pedidoOrigenId)', () => {
      it('delivery con zona: envío 0 (no vuelve a cobrar), total = subtotal y queda enlazado al original', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 102n, codigo: 'CP-W003', estado: 'COLA', subtotal: 28.0, envio: 0, total: 28.0 });

        const res = await service.crear(pedidoBaseDto, 'idemp-extra', { canal: 'CAJA', pedidoOrigenId: 100n });

        expect(res.envio).toBe(0);
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(Number(data.envio)).toBe(0);
        expect(Number(data.total)).toBe(28);
        expect(data.pedido_origen_id).toBe(100n);
        expect(data.canal).toBe('CAJA');
      });

      it('sin pedidoOrigenId el pedido no se enlaza a nadie', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 103n, codigo: 'CP-W004', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 33.0 });
        await service.crear(pedidoBaseDto, 'idemp-normal', { canal: 'CAJA' });
        expect(prismaMock.pedido.create.mock.calls.at(-1)[0].data.pedido_origen_id).toBeNull();
      });
    });

    describe('delivery sin punto en el mapa (esperando ubicación)', () => {
      it('con dirección y referencia es válido: sin zona ni envío, el total no suma envío', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 101n, codigo: 'CP-W002', estado: 'COLA', subtotal: 28.0, envio: null, total: 28.0 });
        const dto: any = { ...pedidoBaseDto, entrega: { direccion: 'Av. Las Palmeras 123', referencia: 'Frente al parque' } };

        const res = await service.crear(dto, 'idemp-sin-punto', { canal: 'CARTA' });

        expect(res.envio).toBeNull();
        expect(zonasServiceMock.detectar).not.toHaveBeenCalled();
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(data).toMatchObject({ entrega_lat: null, entrega_lng: null, zona_id: null, entrega_origen: 'ESCRITA', envio: null });
        expect(Number(data.total)).toBe(28);
      });

      it('desde la carta con coordenadas (GPS o mapa) y sin dirección ni referencia: cae en su zona y calcula envío', async () => {
        prismaMock.pedido.create.mockResolvedValue({ id: 102n, codigo: 'CP-W003', estado: 'COLA', subtotal: 28.0, envio: 5, total: 33.0 });
        const dto: any = { ...pedidoBaseDto, entrega: { lat: -12.046374, lng: -77.042793, origen: 'MAPA' } };

        await service.crear(dto, 'idemp-con-punto', { canal: 'CARTA' });

        expect(zonasServiceMock.detectar).toHaveBeenCalledWith(-12.046374, -77.042793);
        const data = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(data.zona_id).not.toBeNull();
        expect(data).toMatchObject({ entrega_origen: 'MAPA' });
        expect(Number(data.envio)).toBeGreaterThanOrEqual(0);
        expect(data.entrega_lat).not.toBeNull();
      });

      it('sin referencia en la carta: 400 REFERENCIA_REQUERIDA y no se crea', async () => {
        const dto: any = { ...pedidoBaseDto, entrega: { direccion: 'Av. Las Palmeras 123' } };
        await expect(service.crear(dto, 'idemp-sin-ref', { canal: 'CARTA' })).rejects.toMatchObject({ response: { codigo: 'REFERENCIA_REQUERIDA' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('sin dirección ni punto: 400 UBICACION_REQUERIDA', async () => {
        const dto: any = { ...pedidoBaseDto, entrega: { referencia: 'Frente al parque' } };
        await expect(service.crear(dto, 'idemp-sin-dir', { canal: 'CARTA' })).rejects.toMatchObject({ response: { codigo: 'UBICACION_REQUERIDA' } });
      });
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
        ).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_MENOR_AL_TOTAL' } });
      });

      it('efectivo sin pagaCon: 400 PAGA_CON_REQUERIDO (carta, Caja, bot)', async () => {
        await expect(
          service.crear({ ...pedidoBaseDto, pago: { metodo: 'EFECTIVO' } }, 'idemp-pc-1'),
        ).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_REQUERIDO' } });
        await expect(
          service.crear({ ...pedidoBaseDto, pago: { metodo: 'EFECTIVO' } }, 'idemp-pc-2', { canal: 'CAJA' }),
        ).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_REQUERIDO' } });
        await expect(
          service.crear(conPlan([{ medio: 'EFECTIVO', monto: 13 }, { medio: 'YAPE', monto: 20 }]), 'idemp-pc-3'),
        ).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_REQUERIDO' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('efectivo con pagaCon menor al total: 400; exacto: se crea', async () => {
        await expect(
          service.crear({ ...pedidoBaseDto, pago: { metodo: 'EFECTIVO', pagaCon: 1 } }, 'idemp-pc-4'),
        ).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_MENOR_AL_TOTAL' } });
        await service.crear({ ...pedidoBaseDto, pago: { metodo: 'EFECTIVO', pagaCon: 33 } }, 'idemp-pc-5');
        expect(prismaMock.pedido.create).toHaveBeenCalled();
      });

      it('mesa del personal en efectivo sin pagaCon: exenta (se pide al cobrar)', async () => {
        await service.crear(
          { ...pedidoBaseDto, modalidad: 'MESA', mesa: 'Mesa 1', pago: { metodo: 'EFECTIVO' } },
          'idemp-pc-6',
          { canal: 'MOZO', omitirChequeoCarta: true, mesaNombre: 'Mesa 1' },
        );
        expect(prismaMock.pedido.create).toHaveBeenCalled();
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

    describe('pedido del personal', () => {
      // Recoger en local: subtotal 28 (2 x 14) sin envío
      const dtoPersonal: CrearPedidoDto = {
        ...pedidoBaseDto,
        modalidad: 'RECOGER',
        entrega: undefined,
        pago: { metodo: 'EFECTIVO' },
        comprobante: undefined,
      };
      const origen = { canal: 'MOZO' as const, usuarioPartyId: 5n, clientePartyId: 9n, esPersonal: true };

      beforeEach(() => {
        prismaMock.party = {
          findUnique: jest.fn().mockResolvedValue({
            id: 9n, persona: { nombres: 'Kevin', apellidos: 'Rosales' }, usuario: { activo: true }, roles: [],
          }),
        };
        prismaMock.partyRole.findFirst = jest.fn().mockResolvedValue(null);
        prismaMock.consumoPersonal = { create: jest.fn().mockResolvedValue({ id: 1n }) };
        prismaMock.pedido.create.mockImplementation(async ({ data }: any) => ({
          id: 100n, codigo: 'CP-W001', estado: 'COLA', subtotal: data.subtotal, descuento: data.descuento, envio: data.envio, total: data.total,
        }));
      });

      it('aplica el 25 % al crear: total con descuento, pagado a crédito y consumo acumulado en la cuenta del trabajador', async () => {
        const res = await service.crear(dtoPersonal, 'idemp-personal-1', origen);

        const data = prismaMock.pedido.create.mock.calls[0][0].data;
        expect(Number(data.descuento)).toBe(7);
        expect(Number(data.total)).toBe(21);
        expect(data.es_personal).toBe(true);
        expect(data.pago_metodo).toBe('CREDITO_PERSONAL');
        expect(data.pago_estado).toBe('PAGADO');
        expect(data.descuento_detalle).toEqual([expect.objectContaining({ tipo: 'PERSONAL', montoDescontado: 7, descuentoValor: 25 })]);
        expect(res.total).toBe(21);
        expect(prismaMock.consumoPersonal.create).toHaveBeenCalledTimes(1);
        const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
        expect(c.party_id).toBe(9n);
        expect(c.pedido_id).toBe(100n);
        expect(Number(c.monto)).toBe(21);
      });

      describe('carta con sesión de cliente que es del equipo', () => {
        const sesion = { canal: 'CARTA' as const, clientePartyId: 9n };
        const dtoCarta: CrearPedidoDto = { ...dtoPersonal, pago: { metodo: 'EFECTIVO', pagaCon: 50 } };
        beforeEach(() => {
          prismaMock.customerAccount = { ...(prismaMock.customerAccount ?? {}), findFirst: jest.fn().mockResolvedValue({ telefono: '900000001' }) };
          prismaMock.contactMechanism = { findFirst: jest.fn().mockResolvedValue({ party_id: 9n }) };
        });

        it('celular de trabajador activo: 25 % de descuento, pero NO es pedido del personal ni crédito', async () => {
          await service.crear(dtoCarta, 'idemp-carta-dp-1', sesion);
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(Number(data.descuento)).toBe(7);
          expect(Number(data.total)).toBe(21);
          expect(data.es_personal).toBe(false);
          expect(data.pago_metodo).not.toBe('CREDITO_PERSONAL');
          expect(prismaMock.consumoPersonal.create).not.toHaveBeenCalled();
          expect(data.descuento_detalle).toEqual([expect.objectContaining({ tipo: 'PERSONAL', descuentoValor: 25 })]);
        });

        it('sin sesión no aplica aunque el celular escrito sea de un trabajador', async () => {
          await service.crear(dtoCarta, 'idemp-carta-dp-0');
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(Number(data.descuento)).toBe(0);
          expect(Number(data.total)).toBe(28);
        });

        it('delivery: el descuento es solo sobre los productos (75 %) y el envío se paga íntegro', async () => {
          await service.crear({ ...pedidoBaseDto, pago: { metodo: 'EFECTIVO', pagaCon: 50 } }, 'idemp-carta-dp-5', sesion);
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(Number(data.subtotal)).toBe(28);
          expect(Number(data.envio)).toBe(5);
          expect(Number(data.descuento)).toBe(7);
          expect(Number(data.total)).toBe(26); // 28 - 25 % + 5 de envío
        });

        it('celular de no-personal (inactivo o inexistente): sin descuento', async () => {
          prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
          await service.crear(dtoCarta, 'idemp-carta-dp-2', sesion);
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(Number(data.descuento)).toBe(0);
          expect(Number(data.total)).toBe(28);
        });

        it('no acumula sobre una línea que ya tiene otra promoción', async () => {
          ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValue({
            descuentoTotal: 5, ofertaId: null, cuponId: null, cuponEmitidoId: null,
            detalles: [{ tipo: 'DESCUENTO', nombre: '2x', montoDescontado: 5, lineasAfectadas: [{ productoId: '1', cantidad: 2, subtotal: 28, descuento: 5 }] }],
          });
          await service.crear(dtoCarta, 'idemp-carta-dp-3', sesion);
          expect(Number(prismaMock.pedido.create.mock.calls[0][0].data.descuento)).toBe(5);
        });

        it('con el descuento del equipo no se canjean puntos', async () => {
          await expect(service.crear({ ...dtoCarta, puntosCanje: 1 } as any, 'idemp-carta-dp-4', sesion)).rejects.toMatchObject({
            response: { codigo: 'PUNTOS_NO_APLICAN_PERSONAL' },
          });
        });
      });

      describe('carta: «Cargar a mi crédito del personal» (pagoEquipo=CREDITO)', () => {
        const sesion = { canal: 'CARTA' as const, clientePartyId: 2n };
        const dtoCredito = (extra: any = {}): CrearPedidoDto => ({ ...dtoPersonal, pago: { metodo: 'EFECTIVO' }, pagoEquipo: 'CREDITO', ...extra });
        const vincular = (usuarioActivo = true) => {
          prismaMock.customerAccount = { ...(prismaMock.customerAccount ?? {}), findFirst: jest.fn().mockResolvedValue({ telefono: '900000001', usuario_party_id: 9n }) };
          prismaMock.userAccount = { findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(usuarioActivo && where.party_id === 9n ? { party_id: 9n } : null)) };
          prismaMock.contactMechanism = { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) };
        };
        beforeEach(() => vincular());

        it('crédito OK: pedido es_personal con 25 %, consumo a la cuenta del trabajador vinculado, sin cobro y con auditoría', async () => {
          await service.crear(dtoCredito(), 'idemp-credcarta-1', sesion);
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(data.es_personal).toBe(true);
          expect(data.pago_metodo).toBe('CREDITO_PERSONAL');
          expect(data.pago_estado).toBe('PAGADO');
          expect(Number(data.descuento)).toBe(7);
          expect(Number(data.total)).toBe(21);
          const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
          expect(c.party_id).toBe(9n);
          expect(Number(c.monto)).toBe(21);
          expect(c.pagado_en).toBeUndefined();
          expect(auditoriaMock.registrar).toHaveBeenCalledWith(
            expect.objectContaining({ modulo: 'creditos', accion: 'CREDITO_PERSONAL_DESDE_CARTA', partyId: 2n }),
          );
        });

        it('CONTADO: pedido normal de cliente con el descuento del equipo, sin crédito', async () => {
          await service.crear(dtoCredito({ pagoEquipo: 'CONTADO', pago: { metodo: 'EFECTIVO', pagaCon: 50 } }), 'idemp-credcarta-2', sesion);
          const data = prismaMock.pedido.create.mock.calls[0][0].data;
          expect(data.es_personal).toBe(false);
          expect(Number(data.descuento)).toBe(7);
          expect(prismaMock.consumoPersonal.create).not.toHaveBeenCalled();
        });

        describe('crédito + delivery: el crédito cubre los productos y el envío se paga al contado', () => {
          const dtoDelivery = (extra: any = {}): CrearPedidoDto => ({ ...pedidoBaseDto, pagoEquipo: 'CREDITO', pago: { metodo: 'YAPE' }, ...extra });

          it('envío > 0: pedido normal PENDIENTE con monto_credito; el consumo es por los productos; el pago se valida contra el envío', async () => {
            await service.crear(dtoDelivery(), 'idemp-creddel-1', sesion);
            const data = prismaMock.pedido.create.mock.calls[0][0].data;
            expect(data.es_personal).toBe(false);
            expect(data.pago_estado).toBe('PENDIENTE');
            expect(data.pago_metodo).toBe('YAPE'); // el medio del envío, no CREDITO_PERSONAL
            expect(Number(data.total)).toBe(26); // 28 - 25 % + 5 de envío
            expect(Number(data.envio)).toBe(5);
            expect(Number(data.monto_credito)).toBe(21);
            expect(Number(data.propina)).toBe(0);
            const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
            expect(c.party_id).toBe(9n);
            expect(Number(c.monto)).toBe(21);
            expect(c.pagado_en).toBeUndefined();
            expect(auditoriaMock.registrar).toHaveBeenCalledWith(
              expect.objectContaining({ accion: 'CREDITO_PERSONAL_DESDE_CARTA', despues: expect.objectContaining({ montoACredito: 21, montoEnvioAlContado: 5 }) }),
            );
          });

          it('efectivo: «paga con» se compara contra el envío, no contra el total', async () => {
            await expect(service.crear(dtoDelivery({ pago: { metodo: 'EFECTIVO' } }), 'idemp-creddel-2', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_REQUERIDO' } });
            await expect(service.crear(dtoDelivery({ pago: { metodo: 'EFECTIVO', pagaCon: 3 } }), 'idemp-creddel-3', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_MENOR_AL_TOTAL' } });
            expect(prismaMock.pedido.create).not.toHaveBeenCalled();
            await service.crear(dtoDelivery({ pago: { metodo: 'EFECTIVO', pagaCon: 10 } }), 'idemp-creddel-4', sesion);
            expect(Number(prismaMock.pedido.create.mock.calls[0][0].data.paga_con)).toBe(10);
          });

          it('envío gratis: todo a crédito, pedido PAGADO del personal (sin nada que cobrar)', async () => {
            zonasServiceMock.detectar.mockResolvedValue({ zonaId: 2n, codigo: 'Z3', tarifa: 0 });
            await service.crear(dtoDelivery(), 'idemp-creddel-5', sesion);
            const data = prismaMock.pedido.create.mock.calls[0][0].data;
            expect(data.es_personal).toBe(true);
            expect(data.pago_estado).toBe('PAGADO');
            expect(data.pago_metodo).toBe('CREDITO_PERSONAL');
            expect(Number(data.monto_credito)).toBe(0);
            expect(Number(prismaMock.consumoPersonal.create.mock.calls[0][0].data.monto)).toBe(21);
          });

          it('cuenta no vinculada: 403 y no se crea nada', async () => {
            vincular(false);
            await expect(service.crear(dtoDelivery(), 'idemp-creddel-6', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGO_EQUIPO_NO_DISPONIBLE' } });
            expect(prismaMock.pedido.create).not.toHaveBeenCalled();
            expect(prismaMock.consumoPersonal.create).not.toHaveBeenCalled();
          });

          it('sin ubicación (envío por confirmar): nace PENDIENTE con todo el total de productos a crédito', async () => {
            await service.crear(dtoDelivery({ entrega: { direccion: 'Av. Las Palmeras 123', referencia: 'Frente al parque' } }), 'idemp-creddel-7', sesion);
            const data = prismaMock.pedido.create.mock.calls[0][0].data;
            expect(data.es_personal).toBe(false);
            expect(data.pago_estado).toBe('PENDIENTE');
            expect(data.envio).toBeNull();
            expect(Number(data.total)).toBe(21);
            expect(Number(data.monto_credito)).toBe(21);
            expect(Number(prismaMock.consumoPersonal.create.mock.calls[0][0].data.monto)).toBe(21);
          });
        });

        it('usuario inactivo: 403 y no se crea nada', async () => {
          vincular(false);
          await expect(service.crear(dtoCredito(), 'idemp-credcarta-4', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGO_EQUIPO_NO_DISPONIBLE' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });

        it('sin sesión: 403', async () => {
          await expect(service.crear(dtoCredito(), 'idemp-credcarta-5')).rejects.toMatchObject({ response: { codigo: 'PAGO_EQUIPO_NO_DISPONIBLE' } });
          expect(prismaMock.consumoPersonal.create).not.toHaveBeenCalled();
        });

        it('cliente común con pagoEquipo=CREDITO: mismo 403, no revela nada', async () => {
          prismaMock.customerAccount = { findFirst: jest.fn().mockResolvedValue({ telefono: '911111111', usuario_party_id: null }) };
          prismaMock.userAccount = { findFirst: jest.fn().mockResolvedValue(null) };
          prismaMock.contactMechanism = { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) };
          await expect(service.crear(dtoCredito(), 'idemp-credcarta-6', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGO_EQUIPO_NO_DISPONIBLE' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });

        it('solo por celular (sin vínculo del ADMIN) hay descuento pero NO crédito', async () => {
          prismaMock.customerAccount = { findFirst: jest.fn().mockResolvedValue({ telefono: '900000001', usuario_party_id: null }) };
          prismaMock.userAccount = { findFirst: jest.fn().mockResolvedValue(null) };
          prismaMock.contactMechanism = { findFirst: jest.fn().mockResolvedValue({ party_id: 9n }) };
          await expect(service.crear(dtoCredito(), 'idemp-credcarta-7', sesion)).rejects.toMatchObject({ response: { codigo: 'PAGO_EQUIPO_NO_DISPONIBLE' } });
        });

        it('el canal MOZO ignora pagoEquipo (solo vale en la carta)', async () => {
          await service.crear(dtoCredito(), 'idemp-credcarta-8', { canal: 'MOZO', usuarioPartyId: 5n, clientePartyId: 9n, esPersonal: true });
          expect(prismaMock.pedido.create.mock.calls[0][0].data.es_personal).toBe(true);
        });
      });

      it('respeta el porcentaje configurado en el local', async () => {
        prismaMock.parametro.findUnique.mockImplementation(({ where }: any) =>
          Promise.resolve(where.clave === 'descuento_personal_pct' ? { valor: 20 } : where.clave === 'pedido_minimo' ? { valor: 0 } : null),
        );
        await service.crear(dtoPersonal, 'idemp-personal-2', origen);
        expect(Number(prismaMock.pedido.create.mock.calls[0][0].data.descuento)).toBe(5.6);
      });

      it('lo que ya tiene descuento de otra promoción no recibe además el del personal', async () => {
        ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValue({
          descuentoTotal: 5, ofertaId: null, cuponId: null, cuponEmitidoId: null,
          detalles: [{ tipo: 'DESCUENTO', nombre: '2x', montoDescontado: 5, lineasAfectadas: [{ productoId: '1', cantidad: 2, subtotal: 28, descuento: 5 }] }],
        });
        await service.crear(dtoPersonal, 'idemp-personal-3', origen);
        expect(Number(prismaMock.pedido.create.mock.calls[0][0].data.descuento)).toBe(5);
        expect(prismaMock.pedido.create.mock.calls[0][0].data.descuento_detalle).toHaveLength(1);
      });

      it('sin trabajador elegido rechaza con COLABORADOR_REQUERIDO y no crea el pedido', async () => {
        await expect(
          service.crear(dtoPersonal, 'idemp-personal-4', { ...origen, clientePartyId: undefined }),
        ).rejects.toMatchObject({ response: { codigo: 'COLABORADOR_REQUERIDO' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('un cliente (sin cuenta ni rol de empleado) no puede ser el trabajador', async () => {
        prismaMock.party.findUnique.mockResolvedValue({ id: 9n, persona: null, usuario: null, roles: [] });
        await expect(service.crear(dtoPersonal, 'idemp-personal-5', origen)).rejects.toMatchObject({
          response: { codigo: 'NO_ES_PERSONAL' },
        });
      });

      it('por la carta no hay pedido del personal', async () => {
        await expect(
          service.crear(dtoPersonal, 'idemp-personal-6', { ...origen, canal: 'CARTA' as const }),
        ).rejects.toMatchObject({ response: { codigo: 'CANAL_NO_PERMITIDO' } });
      });

      describe('«Pagar ahora» (creditos/cobrar_ahora)', () => {
        const ahora = (medio: string, pagaCon?: number) => ({ ...origen, puedeCobrarAhora: true, pagoPersonal: { modo: 'AHORA' as const, medio, pagaCon } });
        beforeEach(() => {
          prismaMock.caja = { findFirst: jest.fn().mockResolvedValue({ id: 3n }) };
          prismaMock.movimientoCaja = { create: jest.fn().mockResolvedValue({ id: 77n }) };
        });

        it('a crédito (por defecto): consumo Pendiente, sin movimiento de caja', async () => {
          await service.crear(dtoPersonal, 'ahora-0', { ...origen, puedeCobrarAhora: true, pagoPersonal: { modo: 'CREDITO' } });
          const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
          expect(c.pagado_en).toBeUndefined();
          expect(prismaMock.movimientoCaja.create).not.toHaveBeenCalled();
        });

        it('efectivo: consumo COBRADO con quién cobró, ingreso a la caja abierta y auditoría', async () => {
          await service.crear(dtoPersonal, 'ahora-1', ahora('EFECTIVO', 50));
          const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
          expect(c.pagado_en).toBeInstanceOf(Date);
          expect(c.pagado_por).toBe(5n);
          expect(c.pago_medio).toBe('EFECTIVO');
          expect(c.movimiento_caja_id).toBe(77n);
          expect(c.pago_motivo).toContain('vuelto S/ 29.00');
          expect(prismaMock.movimientoCaja.create.mock.calls[0][0].data).toMatchObject({ caja_id: 3n, tipo: 'INGRESO', monto: 21 });
          expect(auditoriaMock.registrar).toHaveBeenCalledWith(
            expect.objectContaining({ accion: 'CREDITO_PERSONAL_COBRADO_AHORA', despues: expect.objectContaining({ cobradoPor: '5', trabajador: '9', medio: 'EFECTIVO', pagaCon: 50, vuelto: 29 }) }),
          );
        });

        it('efectivo sin «con cuánto paga» o con menos del total: 400 y no se crea nada', async () => {
          await expect(service.crear(dtoPersonal, 'ahora-2', ahora('EFECTIVO'))).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_REQUERIDO' } });
          await expect(service.crear(dtoPersonal, 'ahora-3', ahora('EFECTIVO', 10))).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_MENOR_AL_TOTAL' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });

        it('efectivo con caja cerrada: 409 y no se crea el pedido', async () => {
          prismaMock.caja.findFirst.mockResolvedValue(null);
          await expect(service.crear(dtoPersonal, 'ahora-4', ahora('EFECTIVO', 50))).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });

        it('digital (Yape, Plin, Transferencia): sin caja ni movimiento; queda COBRADO con su medio', async () => {
          prismaMock.caja.findFirst.mockResolvedValue(null);
          for (const medio of ['YAPE', 'PLIN', 'TRANSFERENCIA']) {
            prismaMock.consumoPersonal.create.mockClear();
            await service.crear(dtoPersonal, `ahora-d-${medio}`, ahora(medio));
            const c = prismaMock.consumoPersonal.create.mock.calls[0][0].data;
            expect(c.pago_medio).toBe(medio);
            expect(c.movimiento_caja_id).toBeNull();
          }
          expect(prismaMock.movimientoCaja.create).not.toHaveBeenCalled();
        });

        it('sin el permiso creditos/cobrar_ahora: 403; con medio inválido: 400', async () => {
          await expect(service.crear(dtoPersonal, 'ahora-5', { ...ahora('EFECTIVO', 50), puedeCobrarAhora: false })).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO_COBRAR_AHORA' } });
          await expect(service.crear(dtoPersonal, 'ahora-6', ahora('BITCOIN'))).rejects.toMatchObject({ response: { codigo: 'MEDIO_REQUERIDO' } });
        });

        it('atomicidad: si falla el ingreso a caja el error sale de la transacción (no se confirma pedido)', async () => {
          prismaMock.movimientoCaja.create.mockRejectedValue(new Error('boom'));
          await expect(service.crear(dtoPersonal, 'ahora-7', ahora('EFECTIVO', 50))).rejects.toThrow('boom');
          expect(auditoriaMock.registrar).not.toHaveBeenCalled();
        });
      });

      it('un pedido normal no acumula nada ni cambia su cobro', async () => {
        await service.crear({ ...dtoPersonal, pago: { metodo: 'EFECTIVO', pagaCon: 100 } }, 'idemp-personal-7', { canal: 'MOZO', usuarioPartyId: 5n });
        const data = prismaMock.pedido.create.mock.calls[0][0].data;
        expect(data.pago_estado).toBe('PENDIENTE');
        expect(Number(data.descuento)).toBe(0);
        expect(prismaMock.consumoPersonal.create).not.toHaveBeenCalled();
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

    describe('promo ENVIO_GRATIS (envío gratis por promoción)', () => {
      // Subtotal 28 (no llega al envío gratis por monto de 70): sin la promo el envío es la tarifa de zona (5)
      const promo = {
        id: 77n,
        nombre: 'Delivery gratis de 2 a 6 pm',
        activo: true,
        tipo: 'ENVIO_GRATIS',
        orden: 0,
        dias: [],
        hora_desde: null,
        hora_hasta: null,
        fecha_desde: null,
        fecha_hasta: null,
        canales: ['CARTA', 'ADMIN'],
        limite_usos: null,
        usos_actuales: 0,
        compra_minima: null,
      };

      beforeEach(() => {
        prismaMock.cupon = { update: jest.fn().mockResolvedValue({}) };
        prismaMock.cuponCanjeCompartido = { create: jest.fn().mockResolvedValue({}) };
        prismaMock.pedido.create.mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 300n, codigo: 'CP-W300', estado: 'COLA', subtotal: 28, envio: Number(data.envio), total: Number(data.total) }),
        );
      });

      it('delivery de la carta con promo vigente: envío 0, total = subtotal, cuenta un uso de la promo', async () => {
        prismaMock.oferta.findMany.mockResolvedValueOnce([promo]);

        const res = await service.crear(pedidoBaseDto, 'idemp-promo-envio', { canal: 'CARTA' });

        expect(res.envio).toBe(0);
        expect(res.total).toBe(28);
        expect(prismaMock.oferta.update).toHaveBeenCalledWith({
          where: { id: 77n },
          data: { usos_actuales: { increment: 1 } },
        });
      });

      it('con compra mínima no alcanzada no aplica: paga la tarifa de zona y no cuenta uso', async () => {
        prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...promo, compra_minima: 50 }]);

        const res = await service.crear(pedidoBaseDto, 'idemp-promo-minima', { canal: 'CARTA' });

        expect(res.envio).toBe(5);
        expect(prismaMock.oferta.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77n } }));
      });

      it('bot sin la casilla BOT marcada: paga la tarifa de zona', async () => {
        prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...promo, canales: ['TODOS'] }]);

        const res = await service.crear(pedidoBaseDto, 'idemp-promo-bot', { canal: 'BOT' });

        expect(res.envio).toBe(5);
        expect(prismaMock.oferta.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77n } }));
      });

      it('bot con la casilla BOT marcada: envío 0 y cuenta el uso (WhatsApp también)', async () => {
        prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...promo, canales: ['CARTA', 'BOT'] }]);
        const res = await service.crear(pedidoBaseDto, 'idemp-promo-bot-ok', { canal: 'BOT' });
        expect(res.envio).toBe(0);
        expect(prismaMock.oferta.update).toHaveBeenCalledWith({ where: { id: 77n }, data: { usos_actuales: { increment: 1 } } });

        prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...promo, canales: ['CARTA', 'BOT'] }]);
        const wa = await service.crear(pedidoBaseDto, 'idemp-promo-wa-ok', { canal: 'WHATSAPP' });
        expect(wa.envio).toBe(0);
      });

      it('cupón de envío gratis: delivery queda en envío 0 y el cupón se cuenta (no la promo)', async () => {
        ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValueOnce({
          descuentoTotal: 0, ofertaId: null, cuponId: '5', cuponEmitidoId: null, detalles: [], envioGratisCupon: true,
        });
        prismaMock.oferta.findMany.mockResolvedValueOnce([promo]);

        const res = await service.crear(pedidoBaseDto, 'idemp-cupon-envio', { canal: 'CARTA' });

        expect(res.envio).toBe(0);
        expect(res.total).toBe(28);
        expect(prismaMock.cupon.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { usos_actuales: { increment: 1 } } });
        expect(prismaMock.oferta.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77n } }));
      });

      it('cupón de envío gratis en recoger en local: rechaza con CUPON_SOLO_DELIVERY', async () => {
        ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValueOnce({
          descuentoTotal: 0, ofertaId: null, cuponId: '5', cuponEmitidoId: null, detalles: [], envioGratisCupon: true,
        });

        await expect(
          service.crear({ ...pedidoBaseDto, modalidad: 'RECOGER', entrega: undefined }, 'idemp-cupon-recoger', { canal: 'CARTA' }),
        ).rejects.toMatchObject({ response: { codigo: 'CUPON_SOLO_DELIVERY' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('recoger en local no se ve afectado por la promo', async () => {
        prismaMock.oferta.findMany.mockResolvedValueOnce([promo]);

        const res = await service.crear({ ...pedidoBaseDto, modalidad: 'RECOGER', entrega: undefined }, 'idemp-promo-recoger', { canal: 'CARTA' });

        expect(res.envio).toBe(0);
        expect(prismaMock.oferta.findMany).not.toHaveBeenCalled();
        expect(prismaMock.oferta.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77n } }));
      });
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
            volverA: prodAgotado.agotado_hasta.toISOString(),
          }),
        );
      }
    });

    it('4b. agotado indefinido -> volverA null; agotado ya vencido -> se puede pedir', async () => {
      prismaMock.producto.findMany.mockResolvedValue([{ ...mockProductoCafe, agotado_hasta: new Date('9999-12-31T23:59:59Z') }]);
      await expect(service.crear(pedidoBaseDto, 'idemp-prod-indef')).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'PRODUCTO_AGOTADO', volverA: null }),
      });
      prismaMock.producto.findMany.mockResolvedValue([{ ...mockProductoCafe, agotado_hasta: new Date(Date.now() - 1000) }]);
      // Vencido: ya no es PRODUCTO_AGOTADO (el éxito completo lo cubren las pruebas del camino feliz)
      const r = await service.crear(pedidoBaseDto, 'idemp-prod-vencido').catch((e) => e);
      expect(r?.response?.codigo).not.toBe('PRODUCTO_AGOTADO');
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

    it('tipo de comprobante desconocido (p. ej. nota de venta) -> 400 COMPROBANTE_INVALIDO y no crea el pedido', async () => {
      await expect(
        service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'NOTA_VENTA' } as any }, 'idemp-sin-comp'),
      ).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_INVALIDO' } });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('comprobante simple (o sin comprobante) se guarda como SIMPLE y no guarda documento ni razón social', async () => {
      prismaMock.pedido.create.mockResolvedValue({ id: 100n, codigo: 'CP-W001', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 33.0 });
      for (const comprobante of [undefined, { tipo: 'SIMPLE', dni: '12345678', ruc: '20123456789', razonSocial: 'X' } as any]) {
        prismaMock.pedido.create.mockClear();
        await service.crear({ ...pedidoBaseDto, comprobante }, 'idemp-simple');
        expect(prismaMock.pedido.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              comprobante_tipo: 'SIMPLE',
              comprobante_doc: null,
              comprobante_razon: null,
              comprobante_direccion: null,
            }),
          }),
        );
      }
    });

    it('factura con RUC de prefijo inválido (11 dígitos pero no 10/15/17/20) -> 400 FACTURA_DATOS_INCOMPLETOS', async () => {
      await expect(
        service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'FACTURA', ruc: '30123456789', razonSocial: 'Acme SAC' } }, 'idemp-f-3'),
      ).rejects.toMatchObject({ response: { codigo: 'FACTURA_DATOS_INCOMPLETOS' } });
    });

    it('boleta con DNI de menos de 8 dígitos -> 400 DNI_INVALIDO', async () => {
      await expect(
        service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'BOLETA', dni: '1234' } }, 'idemp-b-1'),
      ).rejects.toMatchObject({ response: { codigo: 'DNI_INVALIDO' } });
    });

    it('boleta hasta S/ 700 sin DNI pasa: nunca se rechaza la venta por el DNI', async () => {
      const sinDni: CrearPedidoDto = { ...pedidoBaseDto, comprobante: { tipo: 'BOLETA' } };
      prismaMock.pedido.create.mockResolvedValue({ id: 101n, codigo: 'CP-W002', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 33.0 });
      await service.crear(sinDni, 'idemp-boleta-sin-dni');
      expect(prismaMock.pedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comprobante_tipo: 'BOLETA', comprobante_doc: null }) }),
      );
    });

    it('factura sin RUC de 11 dígitos o sin razón social -> 400 FACTURA_DATOS_INCOMPLETOS', async () => {
      await expect(
        service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'FACTURA', ruc: '2012345678', razonSocial: 'Acme SAC' } }, 'idemp-f-1'),
      ).rejects.toMatchObject({ response: { codigo: 'FACTURA_DATOS_INCOMPLETOS' } });
      await expect(
        service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'FACTURA', ruc: '20123456789', razonSocial: ' ' } }, 'idemp-f-2'),
      ).rejects.toMatchObject({ response: { codigo: 'FACTURA_DATOS_INCOMPLETOS' } });
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

    it.each([
      ['WHATSAPP', { canal: 'WHATSAPP', telefonoRemitente: '987654321' }],
      ['BOT', { canal: 'BOT', telefonoRemitente: '987654321' }],
      ['CARTA con sesión', { canal: 'CARTA', clientePartyId: 5n }],
      ['WHATSAPP con omitirChequeoCarta (se ignora)', { canal: 'WHATSAPP', omitirChequeoCarta: true }],
    ])('8b. fuera de horario, canal %s -> 409 CARTA_CERRADA', async (_n, origen: any) => {
      localServiceMock.obtenerEstadoCarta.mockResolvedValue({ abierta: false, motivo: 'HORARIO', texto: 'Abrimos hoy a las 14:00' });
      await expect(service.crear(pedidoBaseDto, `idemp-cerrada-${_n}`, origen)).rejects.toMatchObject({
        response: { codigo: 'CARTA_CERRADA', mensaje: 'Abrimos hoy a las 14:00' },
      });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
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

    describe('pedido mínimo (solo delivery, sobre subtotal de productos)', () => {
      // Subtotal de pedidoBaseDto: 2 × 14 = 28
      const conMinimo = (valor: number | null) =>
        prismaMock.parametro.findUnique.mockImplementation(({ where }: any) => {
          if (where.clave === 'pedido_minimo') {
            return Promise.resolve(valor === null ? null : { clave: 'pedido_minimo', valor });
          }
          if (where.clave === 'envio_gratis_monto') {
            return Promise.resolve({ clave: 'envio_gratis_monto', valor: 70 });
          }
          return Promise.resolve(null);
        });

      beforeEach(() => {
        prismaMock.pedido.create.mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 300n,
            codigo: 'CP-M001',
            estado: 'COLA',
            subtotal: Number(data.subtotal),
            envio: data.envio !== null ? Number(data.envio) : null,
            total: Number(data.total),
          }),
        );
      });

      it('delivery bajo el mínimo: rechaza con PEDIDO_MINIMO, faltante y no crea el pedido', async () => {
        conMinimo(30);

        await expect(service.crear(pedidoBaseDto, 'idemp-min-1')).rejects.toMatchObject({
          response: {
            codigo: 'PEDIDO_MINIMO',
            mensaje: 'El pedido mínimo para delivery es S/ 30.00; te faltan S/ 2.00',
            minimo: 30,
            faltante: 2,
          },
        });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('delivery exactamente en el mínimo: pasa', async () => {
        conMinimo(28);

        const res = await service.crear(pedidoBaseDto, 'idemp-min-2');

        expect(res.subtotal).toBe(28);
      });

      it('recoger bajo el mínimo: se acepta sin validar', async () => {
        conMinimo(30);
        const dto: any = { ...pedidoBaseDto, modalidad: 'RECOGER', entrega: undefined };

        const res = await service.crear(dto, 'idemp-min-3');

        expect(res.codigo).toBe('CP-M001');
        expect(prismaMock.pedido.create).toHaveBeenCalled();
      });

      it('mesa bajo el mínimo: se acepta sin validar', async () => {
        conMinimo(30);
        const dto: any = { ...pedidoBaseDto, modalidad: 'MESA', entrega: undefined };

        const res = await service.crear(dto, 'idemp-min-4');

        expect(res.codigo).toBe('CP-M001');
      });

      it('sin pedido_minimo configurado no hay mínimo: delivery de cualquier monto pasa', async () => {
        conMinimo(null);

        const res = await service.crear(pedidoBaseDto, 'idemp-min-5');

        expect(res.subtotal).toBe(28);
      });
    });

    describe('combo con parte fija y reemplazos', () => {
      const dtoCombo = (): CrearPedidoDto => ({
        ...pedidoBaseDto,
        lineas: [{ ...pedidoBaseDto.lineas[0], ofertaId: 3, comboElecciones: [{ parteId: 100, productoId: 7 }] }],
      });

      it('devuelve 409 COMBO_PARTE_NO_DISPONIBLE si la elección no está disponible y no crea el pedido', async () => {
        ofertasServiceMock.resolverPartesCombo.mockRejectedValueOnce(
          new HttpException({ codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje: 'x' }, HttpStatus.CONFLICT),
        );
        await expect(service.crear(dtoCombo(), 'idemp-combo-409')).rejects.toMatchObject({
          response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE' },
          status: 409,
        });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('guarda en la nota de la línea el producto realmente elegido', async () => {
        ofertasServiceMock.resolverPartesCombo.mockResolvedValueOnce({ nota: 'Combo Dúo · Empanada (en lugar de Club Sandwich)', partes: [] });
        prismaMock.pedido.create.mockResolvedValue({ id: 120n, codigo: 'CP-W120', estado: 'COLA', subtotal: 28, envio: 5, total: 33 });
        await service.crear(dtoCombo(), 'idemp-combo-ok');
        expect(ofertasServiceMock.resolverPartesCombo).toHaveBeenCalledWith(3, [{ parteId: 100, productoId: 7 }], 2, 'CARTA', expect.anything(), expect.any(String));
        expect(prismaMock.pedidoLinea.create.mock.calls[0][0].data.nota).toBe(
          'Combo Dúo · Empanada (en lugar de Club Sandwich) · Sin azúcar',
        );
      });
    });

    describe('combo con partes (cajita): una línea hija por parte', () => {
      const partesCajita = [
        { parteId: 10n, tipo: 'FIJO', productoId: 1n, nombre: 'FRAPPE OREO', cantidad: 1, areaId: 1n, areaNombre: 'Barra', categoriaNombre: 'FRAPPES', nota: 'Combo: Cajita', tamano: 'Regular 12 oz', unidadesTamano: 1 },
        { parteId: 11n, tipo: 'A_ELECCION', productoId: 20n, nombre: 'Burbujas', cantidad: 2, areaId: 2n, areaNombre: 'Salados', categoriaNombre: 'JUGUETES', nota: 'Combo: Cajita' },
      ];
      const dtoCajita = (): CrearPedidoDto => ({
        ...pedidoBaseDto,
        modalidad: 'MESA' as const,
        entrega: undefined,
        lineas: [{ productoId: 1, tamanoId: 10, cantidad: 1, opciones: [200], ofertaId: 9, comboElecciones: [{ parteId: 11, productoId: 20 }, { parteId: 11, productoId: 20 }] }],
      });

      beforeEach(() => {
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({ nota: '', partes: partesCajita });
        prismaMock.pedido.create.mockResolvedValue({ id: 100n, codigo: 'CP-W100', estado: 'COLA', subtotal: 27, envio: null, total: 27 });
        prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
          Promise.resolve(where?.controla_stock ? [{ id: 20n, nombre: 'Burbujas', sabores: [] }] : [mockProductoCafe]),
        );
        prismaMock.lugarStock = { findFirst: jest.fn().mockResolvedValue({ id: 7n }) };
        prismaMock.stock = {
          findFirst: jest.fn().mockResolvedValue({ id: 9n, lugar_id: 7n }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([{ cantidad: 9 }]),
          create: jest.fn(),
        };
        prismaMock.conteoApertura = { findFirst: jest.fn().mockResolvedValue(null) };
        prismaMock.movimientoStock = { create: jest.fn().mockResolvedValue({}) };
        prismaMock.agotado = { create: jest.fn() };
        prismaMock.producto.findUnique = jest.fn().mockResolvedValue({ agotado_hasta: null });
      });

      it('la madre no lleva producto ni área; cada parte es una línea hija con su área y sin cobro', async () => {
        await service.crear(dtoCajita(), 'key-cajita-lineas', { canal: 'MOZO' });
        const creadas = prismaMock.pedidoLinea.create.mock.calls.map((c: any) => c[0].data);
        expect(creadas).toHaveLength(3);
        expect(creadas[0]).toMatchObject({ producto_id: null, area_id: null });
        expect(creadas[1]).toMatchObject({ producto_id: 1n, linea_combo_id: 50n, nombre: 'FRAPPE OREO', tamano: 'Regular 12 oz', cantidad: 1, area_id: 1n, subtotal: expect.anything(), nombres_persona: ['Juan Perez'] });
        expect(creadas[2]).toMatchObject({ producto_id: 20n, linea_combo_id: 50n, nombre: 'Burbujas', cantidad: 2, area_id: 2n, nombres_persona: [] });
        expect(Number(creadas[1].precio_unit)).toBe(0);
        expect(Number(creadas[2].subtotal)).toBe(0);
      });

      it('descuenta el stock de cada juguete y no el de la madre', async () => {
        await service.crear(dtoCajita(), 'key-cajita-stock', { canal: 'MOZO' });
        const ventas = prismaMock.movimientoStock.create.mock.calls.map((c: any) => c[0].data);
        expect(ventas).toEqual([expect.objectContaining({ tipo: 'VENTA', producto_id: 20n, pedido_id: 100n })]);
        expect(Number(ventas[0].cantidad)).toBe(2);
      });

      it('desde WhatsApp (bot) el combo se resuelve con el canal WHATSAPP y crea las mismas líneas hijas', async () => {
        await service.crear(dtoCajita(), 'key-cajita-bot', { canal: 'WHATSAPP', telefonoRemitente: '987654321', telefonoPuntos: '987654321' });
        expect(ofertasServiceMock.resolverPartesCombo).toHaveBeenCalledWith(9, dtoCajita().lineas[0].comboElecciones, 1, 'WHATSAPP', 100n, expect.any(String));
        const creadas = prismaMock.pedidoLinea.create.mock.calls.map((c: any) => c[0].data);
        expect(creadas).toHaveLength(3);
        expect(creadas[2]).toMatchObject({ producto_id: 20n, linea_combo_id: 50n, nombre: 'Burbujas', cantidad: 2 });
      });

      it('el canal apagado del combo rechaza el pedido del bot sin crear nada', async () => {
        ofertasServiceMock.resolverPartesCombo.mockRejectedValueOnce(
          new BadRequestException({ codigo: 'OFERTA_NO_APLICA_CANAL', mensaje: 'Cajita no está disponible en este canal' }),
        );
        await expect(service.crear(dtoCajita(), 'key-cajita-bot-off', { canal: 'WHATSAPP', telefonoRemitente: '987654321', telefonoPuntos: '987654321' })).rejects.toMatchObject({ response: { codigo: 'OFERTA_NO_APLICA_CANAL' } });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('parte opcional: el extra suma al precio de la madre (servidor), la hija guarda la cantidad real y se descuenta solo lo entregado', async () => {
        await service.crear(dtoCajita(), 'key-cajita-sin-extra', { canal: 'MOZO' });
        const base = Number(prismaMock.pedidoLinea.create.mock.calls[0][0].data.precio_unit);
        prismaMock.pedidoLinea.create.mockClear();
        prismaMock.movimientoStock.create.mockClear();
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({
          nota: '', recargoPorCombo: 6, partes: [partesCajita[0], { ...partesCajita[1], cantidad: 3, extras: 1, nota: 'EXTRA +1 · Combo: Cajita' }],
        });
        await service.crear(dtoCajita(), 'key-cajita-con-extra', { canal: 'MOZO' });
        const creadas = prismaMock.pedidoLinea.create.mock.calls.map((c: any) => c[0].data);
        expect(Number(creadas[0].precio_unit)).toBeCloseTo(base + 6, 2);
        expect(creadas[2]).toMatchObject({ cantidad: 3, nota: 'EXTRA +1 · Combo: Cajita' });
        const ventas = prismaMock.movimientoStock.create.mock.calls.map((c: any) => c[0].data);
        expect(Number(ventas[0].cantidad)).toBe(3);
      });

      it('parte opcional quitada: no hay línea hija ni descuento de stock de esa parte', async () => {
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({ nota: 'Cajita · SIN Burbujas', partes: [{ ...partesCajita[0], nota: 'SIN Burbujas · Combo: Cajita' }] });
        await service.crear(dtoCajita(), 'key-cajita-quitada', { canal: 'MOZO' });
        const creadas = prismaMock.pedidoLinea.create.mock.calls.map((c: any) => c[0].data);
        expect(creadas).toHaveLength(2);
        expect(creadas.some((c: any) => c.producto_id === 20n)).toBe(false);
        expect(prismaMock.movimientoStock.create).not.toHaveBeenCalled();
      });

      it('una parte con tamaño descuenta cantidad × unidades del tamaño', async () => {
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({ nota: '', partes: [{ ...partesCajita[1], unidadesTamano: 3 }] });
        await service.crear(dtoCajita(), 'key-cajita-unidades', { canal: 'MOZO' });
        const ventas = prismaMock.movimientoStock.create.mock.calls.map((c: any) => c[0].data);
        expect(Number(ventas[0].cantidad)).toBe(6);
      });

      it('Dúo desde Caja/Mozo con dos bebidas: exactamente 2 líneas hijas de bebida, cada una con su etiqueta y sin exigir los grupos «Bebida N · Sabor» del anfitrión', async () => {
        const bebida = (parteId: bigint, productoId: bigint, nombre: string) => ({ parteId, tipo: 'A_ELECCION', productoId, nombre, cantidad: 1, areaId: 1n, areaNombre: 'Barra', categoriaNombre: 'ICED', nota: 'Combo: Dúo' });
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({ nota: '', conBebidas: true, partes: [bebida(11n, 101n, 'ICED COFFE'), bebida(11n, 102n, 'LATTE COFFE')] });
        const duoAnfitrion = {
          ...mockProductoCafe,
          grupos: [
            ...mockProductoCafe.grupos,
            ...['1', '2'].map((n, i) => ({ grupo_id: 90n + BigInt(i), grupo: { id: 90n + BigInt(i), nombre: `Bebida ${n} · Sabor`, obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones: [] } })),
          ],
        };
        prismaMock.producto.findMany.mockImplementation(({ where }: any) => Promise.resolve(where?.controla_stock ? [] : [duoAnfitrion]));
        await service.crear(
          { ...dtoCajita(), lineas: [{ ...dtoCajita().lineas[0], comboElecciones: [{ parteId: 11, productoId: 101 }, { parteId: 11, productoId: 102 }] }] },
          'key-duo-caja',
          { canal: 'MOZO' },
        );
        const hijas = prismaMock.pedidoLinea.create.mock.calls.map((c: any) => c[0].data).filter((d: any) => d.linea_combo_id);
        expect(hijas.map((h: any) => h.nombre)).toEqual(['ICED COFFE', 'LATTE COFFE']);
        expect(hijas.every((h: any) => h.cantidad === 1 && h.nombres_persona.length === 1 && h.nombres_persona[0])).toBe(true);
        expect(prismaMock.pedidoLineaOpcion.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ grupo_nombre: expect.stringMatching(/Bebida \d · Sabor/) }) }));
      });

      it('producto por sabor en una parte: el sabor sigue a la línea hija y descuenta el saldo de ese sabor', async () => {
        ofertasServiceMock.resolverPartesCombo.mockResolvedValue({
          nota: '',
          partes: [{ parteId: 11n, tipo: 'A_ELECCION', productoId: 20n, nombre: 'Dona', cantidad: 2, areaId: 2n, areaNombre: 'Salados', categoriaNombre: 'DONAS', nota: 'Combo: Cajita', sabores: [{ saborId: 501n, nombre: 'Fresa', cantidad: 2 }] }],
        });
        prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
          Promise.resolve(where?.controla_stock ? [{ id: 20n, nombre: 'Dona', sabores: [{ id: 501n, nombre: 'Fresa', activo: true, agotado_hasta: null }] }] : [mockProductoCafe]),
        );
        prismaMock.stockSabor = {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ cantidad: 5 }),
        };
        prismaMock.pedidoLineaSabor = { create: jest.fn().mockResolvedValue({}) };
        await service.crear(dtoCajita(), 'key-combo-sabor', { canal: 'MOZO' });
        expect(prismaMock.pedidoLineaSabor.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ pedido_linea_id: 50n, sabor_id: 501n, sabor_nombre: 'Fresa', cantidad: 2 }),
        });
        expect(prismaMock.stockSabor.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sabor_id: 501n }) }));
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

        expect(puntosServiceMock.canjear).toHaveBeenCalledWith(200n, 10, 101n, expect.anything());
        // el total se guarda YA neto (28 - 10 + 5 de envío), sin un segundo update posterior
        const datos = prismaMock.pedido.create.mock.calls.at(-1)[0].data;
        expect(datos.total.toNumber()).toBe(23.0);
        expect(datos.descuento.toNumber()).toBe(0);
      });

      it('el plan de pago y «paga con» se validan contra el total NETO de puntos', async () => {
        puntosServiceMock.obtenerSaldo.mockResolvedValue(50);
        prismaMock.pedido.create.mockResolvedValue({ id: 101n, codigo: 'CP-W005', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 23.0 });
        const dto = (plan: any, pagaCon?: number) => ({ ...pedidoBaseDto, puntosCanje: 10, pago: { metodo: 'YAPE', plan, ...(pagaCon ? { pagaCon } : {}) } as any });

        // el plan por el bruto (33) ya no cuadra: el cliente paga 23
        const err = await service.crear(dto([{ medio: 'YAPE', monto: 33 }]), 'idemp-plan-bruto', { clientePartyId: 200n }).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ codigo: 'PLAN_PAGO_NO_CUADRA' });
        // el plan por el neto (23) sí
        await expect(service.crear(dto([{ medio: 'YAPE', monto: 23 }]), 'idemp-plan-neto', { clientePartyId: 200n })).resolves.toBeDefined();
        // efectivo sin plan: paga con 25 alcanza para 23 (antes se exigía el bruto 33)
        await expect(
          service.crear({ ...pedidoBaseDto, puntosCanje: 10, pago: { metodo: 'EFECTIVO', pagaCon: 25 } as any }, 'idemp-efec-neto', { clientePartyId: 200n }),
        ).resolves.toBeDefined();
      });

      describe('canje en Caja y con el mozo (cuenta elegida por celular)', () => {
        const dtoLocal = (extra: any = {}) => ({ ...pedidoBaseDto, modalidad: 'RECOGER' as const, entrega: undefined, comprobante: undefined, clienteTelefono: '987654321', puntosCanje: 10, ...extra });
        beforeEach(() => {
          direccionesMock.resolverPartyPorTelefono.mockResolvedValue(200n);
          puntosServiceMock.obtenerSaldo.mockResolvedValue(50);
          puntosServiceMock.canjear.mockResolvedValue({ puntosCanjeados: 10, saldoRestante: 40 });
          prismaMock.pedido.create.mockImplementation(async ({ data }: any) => ({ id: 301n, codigo: 'CP-L301', estado: 'COLA', subtotal: data.subtotal, descuento: data.descuento, envio: data.envio, total: data.total }));
        });

        it.each(['CAJA', 'MOZO'] as const)('%s: canjea sobre la cuenta del celular, total neto y deja CANJE_PUNTOS_LOCAL con saldo antes/después', async (canal) => {
          await service.crear(dtoLocal(), `idemp-local-${canal}`, { canal, usuarioPartyId: 5n, omitirChequeoCarta: true });
          expect(puntosServiceMock.canjear).toHaveBeenCalledWith(200n, 10, 301n, expect.anything());
          expect(prismaMock.pedido.create.mock.calls.at(-1)[0].data.total.toNumber()).toBe(18);
          expect(auditoriaMock.registrar).toHaveBeenCalledWith(
            expect.objectContaining({
              accion: 'CANJE_PUNTOS_LOCAL',
              partyId: 5n,
              despues: expect.objectContaining({ usuario: '5', canal, cliente: '200', puntos: 10, saldoAntes: 50, saldoDespues: 40 }),
            }),
            expect.anything(),
          );
        });

        it('saldo insuficiente: PUNTOS_INSUFICIENTES y no crea el pedido', async () => {
          puntosServiceMock.obtenerSaldo.mockResolvedValue(5);
          await expect(service.crear(dtoLocal(), 'idemp-local-saldo', { canal: 'CAJA', usuarioPartyId: 5n, omitirChequeoCarta: true })).rejects.toMatchObject({ response: { codigo: 'PUNTOS_INSUFICIENTES' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });

        it('con cupón: PUNTOS_CON_CUPON', async () => {
          ofertasServiceMock.calcularDescuentosParaPedido.mockResolvedValueOnce({ descuentoTotal: 2, ofertaId: null, cuponId: '5', cuponEmitidoId: null, detalles: [] });
          await expect(service.crear(dtoLocal({ cuponCodigo: 'ABC' }), 'idemp-local-cupon', { canal: 'CAJA', usuarioPartyId: 5n, omitirChequeoCarta: true })).rejects.toMatchObject({ response: { codigo: 'PUNTOS_CON_CUPON' } });
        });

        it('pedido del personal: PUNTOS_NO_APLICAN_PERSONAL', async () => {
          prismaMock.party = { findUnique: jest.fn().mockResolvedValue({ id: 9n, persona: { nombres: 'Kevin', apellidos: 'Rosales' }, usuario: { activo: true }, roles: [] }) };
          prismaMock.partyRole.findFirst = jest.fn().mockResolvedValue(null);
          await expect(
            service.crear(dtoLocal(), 'idemp-local-personal', { canal: 'CAJA', usuarioPartyId: 5n, clientePartyId: 9n, esPersonal: true, omitirChequeoCarta: true }),
          ).rejects.toMatchObject({ response: { codigo: 'PUNTOS_NO_APLICAN_PERSONAL' } });
        });

        it('invitado (sin cuenta activa) o sin celular elegido: PUNTOS_REQUIEREN_CUENTA', async () => {
          direccionesMock.datosCuentaActiva.mockResolvedValue(null);
          await expect(service.crear(dtoLocal(), 'idemp-local-inv', { canal: 'CAJA', usuarioPartyId: 5n, omitirChequeoCarta: true })).rejects.toMatchObject({ response: { codigo: 'PUNTOS_REQUIEREN_CUENTA' } });
          direccionesMock.datosCuentaActiva.mockResolvedValue({ nombre: 'Ana', telefono: '987654321' });
          await expect(service.crear(dtoLocal({ clienteTelefono: undefined }), 'idemp-local-sincel', { canal: 'CAJA', usuarioPartyId: 5n, omitirChequeoCarta: true })).rejects.toMatchObject({ response: { codigo: 'PUNTOS_REQUIEREN_CUENTA' } });
          expect(puntosServiceMock.canjear).not.toHaveBeenCalled();
        });

        it('doble clic: la misma clave de idempotencia devuelve el pedido existente y no vuelve a canjear', async () => {
          prismaMock.pedido.findUnique.mockResolvedValueOnce({ id: 301n, codigo: 'CP-L301', estado: 'COLA', subtotal: 28, envio: 0, total: 18 });
          const res = await service.crear(dtoLocal(), 'idemp-local-doble', { canal: 'CAJA', usuarioPartyId: 5n, omitirChequeoCarta: true });
          expect(res.id).toBe('301');
          expect(puntosServiceMock.canjear).not.toHaveBeenCalled();
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });
      });

      it('si el canje falla, el error sale de la MISMA transacción (revierte pedido y stock) y no deja un pedido ANULADO', async () => {
        puntosServiceMock.obtenerSaldo.mockResolvedValue(50);
        prismaMock.pedido.create.mockResolvedValue({ id: 101n, codigo: 'CP-W004', estado: 'COLA', subtotal: 28.0, envio: 5.0, total: 33.0 });
        puntosServiceMock.canjear.mockRejectedValueOnce(new BadRequestException({ codigo: 'PUNTOS_INSUFICIENTES' }));
        let dentroDeTx: any = null;
        const txOriginal = prismaMock.$transaction.getMockImplementation();
        prismaMock.$transaction.mockImplementation(async (fn: any, ...r: any[]) => {
          dentroDeTx = fn;
          return txOriginal!(fn, ...r);
        });

        await expect(
          service.crear({ ...pedidoBaseDto, puntosCanje: 10 }, 'idemp-canje-falla', { clientePartyId: 200n }),
        ).rejects.toMatchObject({ response: { codigo: 'PUNTOS_INSUFICIENTES' } });

        expect(dentroDeTx).not.toBeNull();
        // el canje recibió el cliente de la transacción (no el prisma global)
        expect(puntosServiceMock.canjear.mock.calls[0][3]).toBeDefined();
        // ya no se "anula a posteriori": nada escribe ANULADO fuera de la transacción
        const anulaciones = prismaMock.pedido.update.mock.calls.filter((c: any) => c[0].data.estado === 'ANULADO');
        expect(anulaciones).toHaveLength(0);
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
      it('crea pedido con canal MOZO, omite chequeo de carta cerrada y guarda nombre y celular del cliente', async () => {
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
          comprobante: { tipo: 'BOLETA' },
          cliente: { nombre: 'Ana Ruiz', telefono: '987654321' },
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
        expect(pedidoCreadoData.cliente_nombre).toBe('Ana Ruiz');
        expect(pedidoCreadoData.cliente_telefono).toBe('987654321');
      });

      describe('propina (monto libre) en mesa de MOZO y CAJA', () => {
        const dtoMesa: any = {
          ...pedidoBaseDto,
          modalidad: 'MESA',
          mesa: 'Mesa 1',
          cliente: { nombre: 'Ana Ruiz', telefono: '987654321' },
          comprobante: { tipo: 'SIMPLE' },
        };
        const activa = (v: Record<string, boolean>) =>
          prismaMock.parametro.findMany.mockResolvedValue([
            { clave: 'propina_activa', valor: { carta: false, bot: false, mozo: false, caja: false, ...v } },
            { clave: 'propina_tope', valor: 50 },
          ]);
        const crearConPropina = async (canal: 'MOZO' | 'CAJA', pago: any, propina: number, clave: string) => {
          let data: any = null;
          prismaMock.pedido.create.mockImplementation((args: any) => {
            data = args.data;
            return Promise.resolve({ id: 400n, codigo: 'CP-P400', estado: 'COLA', subtotal: 28, envio: null, total: Number(args.data.total) });
          });
          const res = await service.crear({ ...dtoMesa, pago, propina }, clave, { canal, usuarioPartyId: 55n, mesasIds: [3n], mesaNombre: 'Mesa 1', enTransaccion: async () => undefined });
          return { res, data };
        };

        it.each(['MOZO', 'CAJA'] as const)('canal %s encendido: guarda la propina aparte; el plan mixto suma venta + propina', async (canal) => {
          activa({ [canal.toLowerCase()]: true });
          const { res, data } = await crearConPropina(
            canal,
            { metodo: 'EFECTIVO', pagaCon: 50, plan: [{ medio: 'EFECTIVO', monto: 20 }, { medio: 'YAPE', monto: 10.5 }, { medio: 'TARJETA', monto: 5 }] },
            7.5,
            `idemp-prop-${canal}-1`,
          );
          expect(Number(data.propina)).toBe(7.5);
          // la venta no cambia: total 28 sin propina
          expect(Number(data.total)).toBe(28);
          expect(res.propina).toBe(7.5);
        });

        it.each(['MOZO', 'CAJA'] as const)('canal %s apagado: la propina se ignora (0) y el plan debe cubrir solo la venta', async (canal) => {
          activa({});
          const { data } = await crearConPropina(canal, { metodo: 'YAPE', plan: [{ medio: 'YAPE', monto: 28 }] }, 7.5, `idemp-prop-${canal}-2`);
          expect(Number(data.propina)).toBe(0);
        });

        it('encendido solo en CAJA: el mozo no recibe propina', async () => {
          activa({ caja: true });
          const { data } = await crearConPropina('MOZO', { metodo: 'YAPE', plan: [{ medio: 'YAPE', monto: 28 }] }, 5, 'idemp-prop-solo-caja');
          expect(Number(data.propina)).toBe(0);
        });

        it('propina sobre el tope: 400 PROPINA_INVALIDA y no crea el pedido', async () => {
          activa({ mozo: true });
          prismaMock.pedido.create.mockClear();
          await expect(
            service.crear({ ...dtoMesa, pago: { metodo: 'YAPE' }, propina: 80 }, 'idemp-prop-tope', { canal: 'MOZO', usuarioPartyId: 55n, mesasIds: [3n], mesaNombre: 'Mesa 1', enTransaccion: async () => undefined }),
          ).rejects.toMatchObject({ response: { codigo: 'PROPINA_INVALIDA' } });
          expect(prismaMock.pedido.create).not.toHaveBeenCalled();
        });
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

  describe('cortesía en una línea del pedido', () => {
    it('sin permiso cortesias/dar responde 403 SIN_PERMISO_CORTESIA', async () => {
      const dto: any = {
        ...pedidoBaseDto,
        modalidad: 'RECOGER',
        lineas: [{ ...pedidoBaseDto.lineas[0], cortesia: { motivo: 'ERROR_COCINA' } }],
      };
      await expect(service.crear(dto, 'idemp-cort-403', { canal: 'MOZO', usuarioPartyId: 55n })).rejects.toMatchObject({
        status: 403,
        response: { codigo: 'SIN_PERMISO_CORTESIA' },
      });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('con permiso: la línea sale a S/ 0, guarda su valor de lista y el pedido no suma esa línea', async () => {
      // Producto base 12 + extra 2 = 14 x 2 = 28 de valor de lista
      let pedidoData: any = null;
      const lineasData: any[] = [];
      const cortesiasData: any[] = [];
      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        pedidoData = data;
        return Promise.resolve({ id: 500n, codigo: 'CP-W500', estado: 'COLA', subtotal: Number(data.subtotal), envio: 0, total: Number(data.total) });
      });
      prismaMock.pedidoLinea.create.mockImplementation(({ data }: any) => {
        lineasData.push(data);
        return Promise.resolve({ id: 900n + BigInt(lineasData.length), ...data });
      });
      prismaMock.cortesia = { create: jest.fn(({ data }: any) => { cortesiasData.push(data); return Promise.resolve(data); }) };

      // Una línea normal (28) y la misma producto como cortesía: el pedido cobra solo 28
      const dto: any = {
        ...pedidoBaseDto,
        modalidad: 'RECOGER',
        lineas: [pedidoBaseDto.lineas[0], { ...pedidoBaseDto.lineas[0], cortesia: { motivo: 'PRUEBA' } }],
      };
      const res = await service.crear(dto, 'idemp-cort-ok', { canal: 'CAJA', usuarioPartyId: 55n, puedeCortesia: true, omitirChequeoCarta: true });

      expect(res.subtotal).toBe(28);
      expect(res.total).toBe(28);
      expect(Number(pedidoData.total)).toBe(28);
      expect(lineasData[1]).toMatchObject({ es_cortesia: true });
      expect(Number(lineasData[1].precio_unit)).toBe(0);
      expect(Number(lineasData[1].subtotal)).toBe(0);
      expect(cortesiasData[0]).toMatchObject({ motivo: 'PRUEBA', pedido_id: 500n, dada_por_party_id: 55n });
      expect(Number(cortesiasData[0].valor_lista)).toBe(28);
    });
  });

  describe('stock de la cortesía', () => {
    it('la línea gratis descuenta stock igual que una venta (solo cambia el precio)', async () => {
      const venta = await service.ventaDeLineas({}, [
        { productoId: 10n, cantidad: 2, unidadesTamano: 1, areaId: 3n, sabores: [], contenedora: false, partesCombo: [], requisitosOpcion: [], cortesia: { motivo: 'PRUEBA', valorLista: 24 } },
      ]);
      expect(venta).toEqual([{ productoId: 10n, cantidad: 2, areaId: 3n, sabores: [] }]);
    });
  });

  describe('cortesía en un pedido de mesa (local)', () => {
    it('sin permiso cortesias/dar en mesa responde 403 SIN_PERMISO_CORTESIA (quien no tenga el permiso)', async () => {
      const dto: any = {
        ...pedidoBaseDto,
        modalidad: 'MESA',
        lineas: [{ ...pedidoBaseDto.lineas[0], cortesia: { motivo: 'ERROR_COCINA' } }],
      };
      await expect(
        service.crear(dto, 'idemp-cort-mesa-403', { canal: 'MOZO', usuarioPartyId: 55n, mesasIds: [6n], mesaNombre: 'Mesa 6' }),
      ).rejects.toMatchObject({ status: 403, response: { codigo: 'SIN_PERMISO_CORTESIA' } });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('con permiso (caja o admin) la cortesía en mesa sale a S/ 0 y el pedido no la cobra', async () => {
      let pedidoData: any = null;
      const lineasData: any[] = [];
      const cortesiasData: any[] = [];
      prismaMock.pedido.create.mockImplementation(({ data }: any) => {
        pedidoData = data;
        return Promise.resolve({ id: 501n, codigo: 'CP-M501', estado: 'COLA', subtotal: Number(data.subtotal), envio: 0, total: Number(data.total) });
      });
      prismaMock.pedidoLinea.create.mockImplementation(({ data }: any) => {
        lineasData.push(data);
        return Promise.resolve({ id: 950n + BigInt(lineasData.length), ...data });
      });
      prismaMock.cortesia = { create: jest.fn(({ data }: any) => { cortesiasData.push(data); return Promise.resolve(data); }) };
      prismaMock.pedidoMesa = { create: jest.fn().mockResolvedValue({}) };

      const dto: any = {
        ...pedidoBaseDto,
        modalidad: 'MESA',
        lineas: [pedidoBaseDto.lineas[0], { ...pedidoBaseDto.lineas[0], cortesia: { motivo: 'PRUEBA' } }],
      };
      const res = await service.crear(dto, 'idemp-cort-mesa-ok', {
        canal: 'CAJA',
        usuarioPartyId: 55n,
        puedeCortesia: true,
        omitirChequeoCarta: true,
        mesasIds: [6n],
        mesaNombre: 'Mesa 6',
      });

      expect(res.total).toBe(28);
      expect(Number(pedidoData.total)).toBe(28);
      expect(lineasData[1]).toMatchObject({ es_cortesia: true });
      expect(Number(lineasData[1].subtotal)).toBe(0);
      expect(cortesiasData[0]).toMatchObject({ motivo: 'PRUEBA', pedido_id: 501n, dada_por_party_id: 55n });
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

    it.each(['MOZO', 'CAJA', 'WHATSAPP', 'BOT'] as const)('pedido del canal %s también dispara el aviso RECIBIDO (el servicio de avisos decide por celular y consentimiento)', async (canal) => {
      await service.crear(pedidoBaseDto, `idemp-recibido-${canal}`, { canal });

      await esperarFondo();
      expect(avisar).toHaveBeenCalledTimes(1);
      expect(avisar).toHaveBeenCalledWith(100n, 'RECIBIDO', {}, expect.anything());
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

    describe('RUC en la cuenta del cliente', () => {
      // RUC de prueba con dígito verificador válido (calculado, no real)
      const rucPrueba = (() => {
        const base = '2000000001';
        const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        const suma = pesos.reduce((a, p, i) => a + p * Number(base[i]), 0);
        return base + ((11 - (suma % 11)) % 10);
      })();
      const factura = { tipo: 'FACTURA', ruc: rucPrueba, razonSocial: 'Empresa de Prueba SAC' } as any;

      it('mozo con cliente por celular: factura valida intenta guardar el RUC en la cuenta (canal y actor)', async () => {
        crearPedidoCapturado();
        direccionesMock.resolverPartyPorTelefono.mockResolvedValue(77n);
        await service.crear({ ...pedidoBaseDto, clienteTelefono: '912345678', comprobante: factura } as any, 'idemp-ruc-1', { canal: 'MOZO', usuarioPartyId: 55n });
        expect(facturacionMock.asignarSiFalta).toHaveBeenCalledWith(77n, expect.objectContaining({ ruc: rucPrueba }), expect.objectContaining({ canal: 'MOZO', actorPartyId: 55n }));
      });

      it('carta con sesion: guarda; carta sin sesion (solo celular tecleado): NO guarda', async () => {
        crearPedidoCapturado();
        await service.crear({ ...pedidoBaseDto, comprobante: factura } as any, 'idemp-ruc-2', { canal: 'CARTA', clientePartyId: 88n });
        expect(facturacionMock.asignarSiFalta).toHaveBeenCalledTimes(1);
        facturacionMock.asignarSiFalta.mockClear();
        partyPuntosMock.resolverOCrear.mockResolvedValue(99n);
        await service.crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '912345678' }, comprobante: factura } as any, 'idemp-ruc-3', { canal: 'CARTA' });
        expect(facturacionMock.asignarSiFalta).not.toHaveBeenCalled();
      });

      it('boleta con DNI: no se guarda nada en la cuenta', async () => {
        crearPedidoCapturado();
        await service.crear({ ...pedidoBaseDto, comprobante: { tipo: 'BOLETA', dni: '12345678' } } as any, 'idemp-ruc-4', { canal: 'CARTA', clientePartyId: 88n });
        expect(facturacionMock.asignarSiFalta).not.toHaveBeenCalled();
      });
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

    it('alta por celular sin sesión: guarda el nombre en el party y nunca el cumpleaños', async () => {
      const capturado = crearCapturado();
      const res: any = await service.crear(pedidoBaseDto, 'idemp-cumple-ok', undefined);
      expect(partyPuntosMock.completarDatos).toHaveBeenCalledWith(300n, { nombre: 'Juan Perez' });
      expect(JSON.stringify(res)).not.toMatch(/1990|03-14|14\/03/);
      expect(JSON.stringify(capturado.data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/1990|03-14|14\/03/);
    });

    it('WhatsApp con teléfono de quien escribe: usa el party de puntos', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-pp-wa', { canal: 'WHATSAPP', telefonoRemitente: '987654321' });
      expect(partyPuntosMock.resolverOCrear).toHaveBeenCalledWith('987654321');
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    it('WhatsApp con telefonoPuntos (celular elegido en el chat): suma a ese celular, no al de quien escribe', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-pp-tp', { canal: 'WHATSAPP', telefonoRemitente: '987654321', telefonoPuntos: '912345678' });
      expect(direccionesMock.resolverPartyPorTelefono).toHaveBeenCalledWith('912345678');
      expect(partyPuntosMock.resolverOCrear).toHaveBeenCalledWith('912345678');
      expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalledWith('987654321');
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    it('WhatsApp con telefonoPuntos que ya tiene cuenta: usa esa cuenta', async () => {
      const capturado = crearCapturado();
      direccionesMock.resolverPartyPorTelefono.mockResolvedValueOnce(77n);
      await service.crear(pedidoBaseDto, 'idemp-pp-tp-2', { canal: 'WHATSAPP', telefonoRemitente: '987654321', telefonoPuntos: '912345678' });
      expect(capturado.data.cliente_party_id).toBe(77n);
      expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalled();
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
        mensaje: 'El celular es obligatorio: 9 dígitos que empiecen con 9 (no vale 999999999)',
      });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('alta por celular sin sesión: el pedido se crea sin cumpleaños y no se guarda ninguno', async () => {
      const capturado = crearCapturado();
      await service.crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '987654321' } } as any, 'idemp-cumple-no', { canal: 'CARTA' });
      expect(capturado.data.cliente_party_id).toBe(300n);
      expect(partyPuntosMock.completarDatos).toHaveBeenCalledWith(300n, { nombre: 'Ana' });
    });

    it('sin sesión, un cumpleaños inválido se ignora: no bloquea el pedido ni se guarda', async () => {
      const capturado = crearCapturado();
      await service.crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '987654321', cumpleanos: '31/02' } } as any, 'idemp-cumple-invalido', { canal: 'CARTA' });
      expect(capturado.data.cliente_party_id).toBe(300n);
      expect(partyPuntosMock.completarDatos).not.toHaveBeenCalledWith(300n, expect.objectContaining({ cumple: expect.anything() }));
    });

    it('con sesión iniciada, el cumpleaños sí se guarda si la cuenta aún no lo tiene', async () => {
      crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-cumple-sesion', { canal: 'CARTA', clientePartyId: 55n });
      expect(partyPuntosMock.completarDatos).toHaveBeenCalledWith(55n, { nombre: 'Juan Perez', cumple: { dia: 14, mes: 3 } });
    });

    describe('dirección del último pedido por celular', () => {
      const ultimoPedido = {
        entrega_direccion: 'Av. Los Girasoles 123',
        entrega_referencia: 'Portón negro',
        entrega_lat: 1.5,
        entrega_lng: -77.04,
        entrega_origen: 'GPS',
        zona_id: 2n,
      };

      beforeEach(() => {
        prismaMock.pedido.findFirst = jest.fn().mockResolvedValue(null);
        prismaMock.zonaReparto = { findUnique: jest.fn().mockResolvedValue({ codigo: 'SJL' }) };
      });

      it('la pista sale con zona y dirección enmascarada, sin la dirección completa ni el punto', async () => {
        prismaMock.pedido.findFirst.mockResolvedValue(ultimoPedido);
        const res = await service.pistaUltimaDireccion('987654321', '10.0.0.1');
        expect(res).toEqual({ existe: true, zona: 'SJL', direccion: 'Av. Los G••••' });
        expect(JSON.stringify(res)).not.toMatch(/Girasoles|123|Portón|1\.5|77\.04/);
        expect(prismaMock.pedido.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ cliente_telefono: '987654321', modalidad: 'DELIVERY' }) }),
        );
      });

      it('sin pedidos previos con dirección: existe false, sin más datos', async () => {
        expect(await service.pistaUltimaDireccion('987654321')).toEqual({ existe: false });
      });

      it('la pista de un pedido que solo tiene punto en el mapa no muestra texto, pero sí la zona', async () => {
        prismaMock.pedido.findFirst.mockResolvedValue({ ...ultimoPedido, entrega_direccion: '-12.04, -77.04' });
        expect(await service.pistaUltimaDireccion('987654321')).toEqual({ existe: true, zona: 'SJL', direccion: null });
      });

      it('la pista rechaza con 429 al pasar de 10 consultas por celular en una hora', async () => {
        redisMock.incr.mockResolvedValueOnce(11);
        const err = await service.pistaUltimaDireccion('987654321', '10.0.0.1').catch((e) => e);
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse()).toMatchObject({ codigo: 'DEMASIADAS_CONSULTAS' });
        expect(prismaMock.pedido.findFirst).not.toHaveBeenCalled();
      });

      it('la pista rechaza con 429 al pasar de 30 consultas por IP en una hora', async () => {
        redisMock.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(31);
        const err = await service.pistaUltimaDireccion('987654321', '10.0.0.1').catch((e) => e);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      });

      it('si Redis no responde, la pista sigue (el texto ya va enmascarado)', async () => {
        redisMock.incr.mockRejectedValueOnce(new Error('redis caído'));
        prismaMock.pedido.findFirst.mockResolvedValue(ultimoPedido);
        expect(await service.pistaUltimaDireccion('987654321', '10.0.0.1')).toMatchObject({ existe: true, direccion: 'Av. Los G••••' });
      });

      it('con la marca, el pedido usa la dirección, coordenadas y zona de su último pedido', async () => {
        const capturado = crearCapturado();
        prismaMock.pedido.findFirst.mockResolvedValue(ultimoPedido);
        await service.crear(
          { ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '987654321' }, entrega: { reutilizarUltimaDireccion: true } } as any,
          'idemp-reutiliza-ok',
          { canal: 'CARTA' },
        );
        expect(zonasServiceMock.detectar).toHaveBeenCalledWith(1.5, -77.04);
        expect(capturado.data.entrega_direccion).toBe('Av. Los Girasoles 123');
        expect(capturado.data.entrega_referencia).toBe('Portón negro');
        expect(capturado.data.entrega_origen).toBe('GPS');
        expect(capturado.data.zona_id).toBe(2n);
      });

      it('con la marca y sin pedido previo, el pedido se rechaza con mensaje claro', async () => {
        const err = await service
          .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '987654321' }, entrega: { reutilizarUltimaDireccion: true } } as any, 'idemp-reutiliza-no', { canal: 'CARTA' })
          .catch((e) => e);
        expect(err.getResponse()).toEqual({
          codigo: 'SIN_DIRECCION_ANTERIOR',
          mensaje: 'No encontramos una dirección anterior con ese celular. Escribe tu dirección.',
        });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('con sesión iniciada la marca no se usa: manda la dirección que llegue en el pedido', async () => {
        const capturado = crearCapturado();
        prismaMock.pedido.findFirst.mockResolvedValue(ultimoPedido);
        await service.crear(
          { ...pedidoBaseDto, entrega: { reutilizarUltimaDireccion: true, direccion: 'Calle Nueva 456', lat: -12.046374, lng: -77.042793 } } as any,
          'idemp-reutiliza-sesion',
          { canal: 'CARTA', clientePartyId: 55n },
        );
        expect(capturado.data.entrega_direccion).toBe('Calle Nueva 456');
        expect(prismaMock.pedido.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('enmascararDireccion', () => {
      it('oculta la mayor parte de la dirección y no muestra números', () => {
        expect(enmascararDireccion('Av. Los Girasoles 123')).toBe('Av. Los G••••');
        expect(enmascararDireccion('Jr. Lima')).toBe('Jr. L••••');
        expect(enmascararDireccion('123 Calle')).toBe('C••••');
        expect(enmascararDireccion('Av. Lima 1234')).toBe('Av. L••••');
        expect(enmascararDireccion('Pasaje')).toBe('P••••');
      });

      it('sin texto o solo con coordenadas no devuelve nada', () => {
        expect(enmascararDireccion(null)).toBeNull();
        expect(enmascararDireccion('   ')).toBeNull();
        expect(enmascararDireccion('-12.046374, -77.042793')).toBeNull();
      });
    });

    it('el relleno 999999999 ya no vale como celular', async () => {
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana', telefono: '999999999' } } as any, 'idemp-celular-relleno', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'TELEFONO_INVALIDO' });
    });

    it('invitado apagado (valor «no») también exige celular', async () => {
      conParametro('carta_invitado_activo', 'no');
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-celular-no', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CELULAR_REQUERIDO' });
    });

    it('invitado encendido ya no existe: sin celular sigue siendo 400', async () => {
      conParametro('carta_invitado_activo', 'si');
      const err = await service
        .crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-invitado-on', { canal: 'CARTA' })
        .catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'CELULAR_REQUERIDO' });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    describe('nombre y celular obligatorios en todos los canales', () => {
      const dtoMozo = (cliente: any, extra: any = {}) => ({ ...pedidoBaseDto, modalidad: 'MESA', entrega: undefined, cliente, ...extra }) as any;
      const canales: [string, any][] = [
        ['CARTA', { canal: 'CARTA' }],
        ['WHATSAPP', { canal: 'WHATSAPP', telefonoRemitente: '987654321' }],
        ['MOZO', { canal: 'MOZO', mesaNombre: 'Mesa 2' }],
        ['CAJA', { canal: 'CAJA', mesaNombre: 'Mesa 2' }],
      ];
      it.each(canales)('%s: sin nombre -> 400 CLIENTE_NOMBRE_REQUERIDO', async (_n, origen) => {
        const err = await service.crear(dtoMozo({ nombre: ' ', telefono: '987654321' }), 'idemp-n-' + _n, origen).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ codigo: 'CLIENTE_NOMBRE_REQUERIDO' });
      });
      it.each(canales)('%s: sin celular (mesa) -> se crea y no suma puntos', async (_n, origen) => {
        const capturado = crearCapturado();
        partyPuntosMock.resolverOCrear.mockClear();
        const res = await service.crear(dtoMozo({ nombre: 'Ana' }), 'idemp-c-' + _n, { ...origen, telefonoRemitente: undefined }); // WhatsApp sin número (BSUID)
        expect(res.codigo).toBe('CP-W310');
        expect(capturado.data.cliente_telefono ?? null).toBeNull();
        expect(capturado.data.cliente_party_id ?? null).toBeNull();
        expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalled();
      });
      it.each(canales)('%s: delivery sin celular -> 400 CELULAR_REQUERIDO', async (_n, origen) => {
        const err = await service.crear({ ...pedidoBaseDto, cliente: { nombre: 'Ana' } } as any, 'idemp-cd-' + _n, origen).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ codigo: 'CELULAR_REQUERIDO' });
      });
      it.each(canales)('%s: con 999999999 -> 400 TELEFONO_INVALIDO', async (_n, origen) => {
        const err = await service.crear(dtoMozo({ nombre: 'Ana', telefono: '999999999' }), 'idemp-p-' + _n, origen).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ codigo: 'TELEFONO_INVALIDO' });
      });
      it.each(canales)('%s: con nombre y celular válidos pasa', async (_n, origen) => {
        crearCapturado();
        const res = await service.crear(dtoMozo({ nombre: 'Ana', telefono: '987654321' }), 'idemp-ok-' + _n, origen);
        expect(res.codigo).toBe('CP-W310');
      });
      it('MOZO con cuenta por celular (clienteTelefono): no pide nombre aparte', async () => {
        crearCapturado();
        direccionesMock.datosCuentaActiva.mockResolvedValueOnce({ nombre: 'Rosa Diaz', telefono: '912345678' });
        const res = await service.crear(dtoMozo(undefined, { clienteTelefono: '912345678' }), 'idemp-cuenta', { canal: 'MOZO', mesaNombre: 'Mesa 2' });
        expect(res.codigo).toBe('CP-W310');
      });
      it('pedido del personal no exige celular (usa la ficha del trabajador)', async () => {
        crearCapturado();
        const err = await service
          .crear(dtoMozo({ nombre: 'Luis' }), 'idemp-personal', { canal: 'MOZO', esPersonal: true, clientePartyId: 55n, mesaNombre: 'Mesa 2' })
          .catch((e) => e);
        expect(err?.getResponse?.()?.codigo).not.toBe('CELULAR_REQUERIDO');
        expect(err?.getResponse?.()?.codigo).not.toBe('CLIENTE_NOMBRE_REQUERIDO');
      });
      it('pedido extra hereda los datos del original: no se revalidan', async () => {
        crearCapturado();
        const err = await service
          .crear(dtoMozo({ nombre: 'Ana' }), 'idemp-extra', { canal: 'MOZO', pedidoOrigenId: 9n, mesaNombre: 'Mesa 2' })
          .catch((e) => e);
        expect(err?.getResponse?.()?.codigo).not.toBe('CELULAR_REQUERIDO');
      });
    });

    it('invitado apagado con celular válido: pide y suma puntos', async () => {
      const capturado = crearCapturado();
      await service.crear(pedidoBaseDto, 'idemp-celular-ok', { canal: 'CARTA' });
      expect(capturado.data.cliente_party_id).toBe(300n);
    });

    describe('«Comer en el local» desde la carta', () => {
      const dtoLocal = (cliente: any, extra: any = {}) =>
        ({ ...pedidoBaseDto, modalidad: 'COMER_LOCAL', entrega: undefined, mesa: undefined, cliente, ...extra }) as any;

      it('con nombre y celular: crea sin envío, sin zona, sin dirección y sin mesa', async () => {
        const capturado = crearCapturado();
        const res = await service.crear(dtoLocal({ nombre: 'Miguel', telefono: '987654321' }), 'idemp-local-ok', { canal: 'CARTA' });
        expect(res.codigo).toBe('CP-W310');
        expect(capturado.data.modalidad).toBe('COMER_LOCAL');
        expect(Number(capturado.data.envio)).toBe(0);
        expect(capturado.data.zona_id ?? null).toBeNull();
        expect(capturado.data.entrega_direccion ?? null).toBeNull();
        expect(capturado.data.mesa_nombre).toBeNull();
        expect(capturado.data.cliente_nombre).toBe('Miguel');
      });

      it('con mesa en el cuerpo igual no ocupa mesa: mesa_nombre queda nulo', async () => {
        const capturado = crearCapturado();
        await service.crear(dtoLocal({ nombre: 'Miguel', telefono: '987654321' }, { mesa: '5' }), 'idemp-local-mesa', { canal: 'CARTA' });
        expect(capturado.data.mesa_nombre).toBeNull();
      });

      it('sin nombre: 400 CLIENTE_NOMBRE_REQUERIDO', async () => {
        const err = await service.crear(dtoLocal({ nombre: ' ', telefono: '987654321' }), 'idemp-local-n', { canal: 'CARTA' }).catch((e) => e);
        expect(err.getResponse()).toMatchObject({ codigo: 'CLIENTE_NOMBRE_REQUERIDO' });
      });

      it('sin celular: se crea y no suma puntos', async () => {
        const capturado = crearCapturado();
        partyPuntosMock.resolverOCrear.mockClear();
        const res = await service.crear(dtoLocal({ nombre: 'Miguel' }), 'idemp-local-c', { canal: 'CARTA' });
        expect(res.codigo).toBe('CP-W310');
        expect(capturado.data.cliente_party_id ?? null).toBeNull();
        expect(partyPuntosMock.resolverOCrear).not.toHaveBeenCalled();
      });
    });
  });

  describe('productos que controlan stock al crear el pedido (todos los canales)', () => {
    const soloMesa = { ...pedidoBaseDto, modalidad: 'MESA' as const, entrega: undefined };

    beforeEach(() => {
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.controla_stock ? [{ id: 1n, nombre: 'Americano', controla_stock: true }] : [mockProductoCafe]),
      );
      prismaMock.pedido.create.mockResolvedValue({ id: 100n, codigo: 'CP-W001', estado: 'COLA', subtotal: 28, envio: null, total: 28 });
      prismaMock.lugarStock = { findFirst: jest.fn().mockResolvedValue({ id: 7n }) };
      prismaMock.stock = {
        findFirst: jest.fn().mockResolvedValue({ id: 9n, lugar_id: 7n }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ cantidad: 1 }]),
        create: jest.fn(),
      };
      prismaMock.conteoApertura = { findFirst: jest.fn().mockResolvedValue(null) };
      prismaMock.movimientoStock = { create: jest.fn().mockResolvedValue({}) };
      prismaMock.agotado = { create: jest.fn() };
      prismaMock.producto.findUnique = jest.fn().mockResolvedValue({ agotado_hasta: null });
    });

    it.each([
      ['CARTA', undefined, pedidoBaseDto],
      ['MOZO', { canal: 'MOZO' }, soloMesa],
      ['CAJA', { canal: 'CAJA' }, soloMesa],
      ['WHATSAPP', { canal: 'WHATSAPP' }, pedidoBaseDto],
    ])('canal %s: descuenta el producto al crear con movimiento VENTA ligado al pedido', async (_canal, origen, dto) => {
      await service.crear(dto as any, `key-${_canal}`, origen as any);
      expect(prismaMock.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'VENTA', producto_id: 1n, pedido_id: 100n }),
      });
    });

    it('sin conteo de apertura hoy también limita por el saldo: descuento condicional contra el saldo', async () => {
      await service.crear(pedidoBaseDto, 'key-sin-apertura', { canal: 'WHATSAPP' });
      expect(prismaMock.stock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ producto_id: 1n }) }),
      );
      expect(prismaMock.stock.updateMany.mock.calls[0][0].where.cantidad).toEqual({ gte: expect.anything() });
    });

    it('sin apertura hoy y saldo 0: responde 409 STOCK_INSUFICIENTE con quedan 0 y no descuenta', async () => {
      prismaMock.stock.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.stock.findMany.mockResolvedValue([{ cantidad: 0 }]);
      const err: any = await service.crear(pedidoBaseDto, 'key-saldo-cero', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', productoId: '1', quedan: 0 });
      expect(prismaMock.movimientoStock.create).not.toHaveBeenCalled();
    });

    it('con apertura hoy y saldo insuficiente responde 409 STOCK_INSUFICIENTE con productoId y quedan', async () => {
      prismaMock.conteoApertura.findFirst.mockResolvedValue({ cantidad: 5 });
      prismaMock.stock.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.stock.findMany.mockResolvedValue([{ cantidad: 1 }]);
      const err: any = await service.crear(pedidoBaseDto, 'key-tope', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toEqual({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Solo quedan 1 de Americano',
        productoId: '1',
        quedan: 1,
      });
    });

    it('tamaño de 1/2 docena (6 unidades): cada tamaño descuenta 6 del saldo, no 1', async () => {
      prismaMock.conteoApertura.findFirst.mockResolvedValue({ cantidad: 10 });
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.controla_stock
            ? [{ id: 1n, nombre: 'Americano', controla_stock: true }]
            : [{ ...mockProductoCafe, controla_stock: true, tamanos: [{ ...mockProductoCafe.tamanos[0], unidades: 6 }] }],
        ),
      );
      const linea = { ...pedidoBaseDto.lineas[0], tamanoId: 10, cantidad: 2 } as any;
      await service.crear({ ...pedidoBaseDto, lineas: [linea] } as any, 'key-media-docena', { canal: 'CARTA' });
      expect(Number(prismaMock.stock.updateMany.mock.calls[0][0].data.cantidad.decrement)).toBe(12);
      expect(prismaMock.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'VENTA', producto_id: 1n, pedido_id: 100n, cantidad: expect.anything() }),
      });
      expect(Number(prismaMock.movimientoStock.create.mock.calls[0][0].data.cantidad)).toBe(12);
    });

    it('suma las líneas repetidas del mismo producto en un solo descuento (2 + 3 = 5)', async () => {
      prismaMock.conteoApertura.findFirst.mockResolvedValue({ cantidad: 10 });
      const linea = pedidoBaseDto.lineas[0];
      await service.crear({ ...pedidoBaseDto, lineas: [linea, { ...linea, cantidad: 3 }] } as any, 'key-repetidas', { canal: 'CARTA' });
      expect(prismaMock.stock.updateMany).toHaveBeenCalledTimes(1);
      expect(Number(prismaMock.stock.updateMany.mock.calls[0][0].data.cantidad.decrement)).toBe(5);
    });

    it('galleta sin sabores: 2 × 1/2 docena descuenta 12 unidades del stock del producto (no 2)', async () => {
      const galleta = {
        ...mockProductoCafe,
        nombre: 'GALLETA CHOCO CHIPS',
        controla_stock: true,
        sabores: [],
        grupos: [],
        tamanos: [{ id: 5n, producto_id: 1n, tamano_valor_id: 100n, precio: 18, unidades: 6, tamano_valor: { id: 100n, nombre: '1/2 docena' } }],
      };
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.controla_stock ? [{ id: 1n, nombre: 'GALLETA CHOCO CHIPS', controla_stock: true, sabores: [] }] : [galleta]),
      );
      prismaMock.conteoApertura.findFirst.mockResolvedValue({ cantidad: 20 });
      prismaMock.stock.findMany.mockResolvedValue([{ cantidad: 8 }]);
      await service.crear({ ...pedidoBaseDto, lineas: [{ productoId: 1, tamanoId: 5, cantidad: 2 }] } as any, 'key-galleta-media', { canal: 'CARTA' });
      expect(prismaMock.stock.updateMany).toHaveBeenCalledTimes(1);
      expect(Number(prismaMock.stock.updateMany.mock.calls[0][0].data.cantidad.decrement)).toBe(12);
      expect(prismaMock.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'VENTA', producto_id: 1n, pedido_id: 100n, cantidad: expect.anything() }),
      });
    });
  });
  describe('productos por sabor al crear el pedido (stock por sabor)', () => {
    const donaSabor = {
      id: 1n,
      nombre: 'Dona',
      precio: 3,
      oculto: false,
      agotado_hasta: null,
      controla_stock: true,
      categoria_id: 1n,
      no_suma_beneficios: false,
      area_id: null,
      categoria: { id: 1n, nombre: 'Dulces', area_id: 1n, area: { id: 1n, nombre: 'Salados', tipo: 'COCINA' } },
      tamanos: [
        { id: 5n, producto_id: 1n, tamano_valor_id: 100n, precio: 18, unidades: 6, tamano_valor: { id: 100n, nombre: '1/2 docena' } },
      ],
      grupos: [],
      sabores: [
        { id: 11n, producto_id: 1n, nombre: 'Fresa', activo: true, agotado_hasta: null },
        { id: 12n, producto_id: 1n, nombre: 'Oreo', activo: true, agotado_hasta: null },
      ],
    };
    const lineaMedia = (sabores: any[]) => ({ ...pedidoBaseDto, lineas: [{ productoId: 1, tamanoId: 5, cantidad: 1, sabores }] });

    beforeEach(() => {
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.controla_stock ? [{ id: 1n, nombre: 'Dona', controla_stock: true, sabores: donaSabor.sabores }] : [donaSabor]),
      );
      prismaMock.pedido.create.mockResolvedValue({ id: 100n, codigo: 'CP-W001', estado: 'COLA', subtotal: 18, envio: null, total: 18 });
      prismaMock.lugarStock = { findFirst: jest.fn().mockResolvedValue({ id: 7n }) };
      prismaMock.stock = { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() };
      prismaMock.conteoApertura = { findFirst: jest.fn().mockResolvedValue(null) };
      prismaMock.stockSabor = {
        findUnique: jest.fn().mockResolvedValue({ cantidad: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      };
      prismaMock.pedidoLineaSabor = { create: jest.fn().mockResolvedValue({}) };
      prismaMock.movimientoStock = { create: jest.fn().mockResolvedValue({}) };
      prismaMock.agotado = { create: jest.fn() };
      prismaMock.sabor = { findMany: jest.fn().mockResolvedValue([]) };
    });

    it('reparte la media docena entre sabores: guarda cada sabor de la línea y descuenta por sabor', async () => {
      await service.crear(lineaMedia([{ saborId: 11, cantidad: 2 }, { saborId: 12, cantidad: 4 }]) as any, 'key-sab-ok', { canal: 'CARTA' });
      expect(prismaMock.pedidoLineaSabor.create).toHaveBeenCalledWith({
        data: { pedido_linea_id: 50n, sabor_id: 11n, sabor_nombre: 'Fresa', cantidad: 2 },
      });
      expect(prismaMock.pedidoLineaSabor.create).toHaveBeenCalledWith({
        data: { pedido_linea_id: 50n, sabor_id: 12n, sabor_nombre: 'Oreo', cantidad: 4 },
      });
      expect(prismaMock.movimientoStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'VENTA', producto_id: 1n, sabor_id: 11n, pedido_id: 100n }),
      });
      expect(prismaMock.stock.updateMany).not.toHaveBeenCalled();
    });

    it('ignora el grupo obligatorio heredado «Sabor» (opciones de empanada): sin opciones el pedido pasa', async () => {
      const grupoHeredado = {
        id: 30n,
        nombre: 'Sabor',
        obligatorio: true,
        minimo: 1,
        maximo: 1,
        activo: true,
        opciones: [
          { id: 300n, grupo_id: 30n, valor_id: 310n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 310n, nombre: 'Empanada de pollo' } },
        ],
      };
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.controla_stock
            ? [{ id: 1n, nombre: 'Dona', controla_stock: true, sabores: donaSabor.sabores }]
            : [{ ...donaSabor, grupos: [{ grupo_id: 30n, grupo: grupoHeredado }] }],
        ),
      );
      await service.crear(lineaMedia([{ saborId: 11, cantidad: 6 }]) as any, 'key-sab-grupo-heredado', { canal: 'CARTA' });
      expect(prismaMock.pedido.create).toHaveBeenCalled();
      expect(prismaMock.pedidoLineaSabor.create).toHaveBeenCalledWith({
        data: { pedido_linea_id: 50n, sabor_id: 11n, sabor_nombre: 'Fresa', cantidad: 6 },
      });
    });

    it('anfitrión de combo (Dúo): no pide sabores aunque tenga sabores activos y un grupo sin opciones no bloquea', async () => {
      const duo = {
        ...donaSabor,
        nombre: 'DÚO COMPARTIR',
        ofertasAlcance: [{ id: 900n }],
        grupos: [
          { grupo_id: 30n, grupo: { id: 30n, nombre: 'Galleta 1 · Sabor', obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones: [] } },
          {
            grupo_id: 31n,
            grupo: {
              id: 31n, nombre: 'Dona 1 · Sabor', obligatorio: true, minimo: 1, maximo: 1, activo: true,
              opciones: [{ id: 310n, grupo_id: 31n, valor_id: 320n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 320n, nombre: 'Fresa' } }],
            },
          },
        ],
      };
      prismaMock.producto.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(where?.controla_stock ? [{ id: 1n, nombre: 'DÚO COMPARTIR', controla_stock: true, sabores: duo.sabores, ofertasAlcance: duo.ofertasAlcance }] : [duo]),
      );
      prismaMock.stock = {
        findFirst: jest.fn().mockResolvedValue({ id: 9n, lugar_id: 7n }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ cantidad: 50 }]),
        create: jest.fn(),
      };
      await service.crear({ ...pedidoBaseDto, lineas: [{ productoId: 1, tamanoId: 5, cantidad: 1, opciones: [310] }] } as any, 'key-duo-combo', { canal: 'CARTA' });
      expect(prismaMock.pedido.create).toHaveBeenCalled();
      expect(prismaMock.pedidoLineaSabor.create).not.toHaveBeenCalled();
    });

    describe('opciones ligadas a stock (opcion_requiere)', () => {
      const duoStock = {
        ...donaSabor,
        nombre: 'DÚO COMPARTIR',
        ofertasAlcance: [{ id: 900n }],
        grupos: [
          { grupo_id: 31n, grupo: { id: 31n, nombre: 'Dona 1 · Sabor', obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones: [{ id: 310n, grupo_id: 31n, valor_id: 320n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 320n, nombre: 'Fresa' } }] } },
          { grupo_id: 32n, grupo: { id: 32n, nombre: 'Dona 2 · Sabor', obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones: [{ id: 311n, grupo_id: 32n, valor_id: 321n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 321n, nombre: 'Fresa' } }] } },
        ],
      };
      // Dona 1 y Dona 2 consumen cada una 1 del MISMO sabor (501) de la dona (producto 20)
      const preparar = (saldoSabor: number) => {
        prismaMock.opcionRequiere.findMany.mockResolvedValue([
          { opcion_id: 310n, producto_id: 20n, sabor_id: 501n, cantidad: 1 },
          { opcion_id: 311n, producto_id: 20n, sabor_id: 501n, cantidad: 1 },
        ]);
        prismaMock.producto.findMany.mockImplementation(({ where, select }: any) => {
          if (select?.stocks) {
            return Promise.resolve([{ id: 20n, oculto: false, agotado_hasta: null, controla_stock: true, stocks: [], sabores: [{ id: 501n, producto_id: 20n, activo: true, agotado_hasta: null, stockSabor: { cantidad: saldoSabor } }] }]);
          }
          return Promise.resolve(where?.controla_stock ? [{ id: 1n, nombre: 'DÚO COMPARTIR', controla_stock: true, sabores: [], ofertasAlcance: duoStock.ofertasAlcance }] : [duoStock]);
        });
        prismaMock.stock = {
          findFirst: jest.fn().mockResolvedValue({ id: 9n, lugar_id: 7n }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([{ cantidad: 50 }]),
          create: jest.fn(),
        };
      };
      const dto = { ...pedidoBaseDto, lineas: [{ productoId: 1, tamanoId: 5, cantidad: 1, opciones: [310, 311] }] } as any;

      it('mismo sabor con saldo 1: la segunda opción no cabe -> 409 OPCION_AGOTADA y no crea el pedido', async () => {
        preparar(1);
        const err: any = await service.crear(dto, 'key-opcion-sabor-1', { canal: 'CARTA' }).catch((e) => e);
        expect(err.getStatus()).toBe(409);
        expect(err.getResponse()).toMatchObject({ codigo: 'OPCION_AGOTADA', opcionId: '311' });
        expect(prismaMock.pedido.create).not.toHaveBeenCalled();
      });

      it('mismo sabor con saldo 2: las dos opciones caben y el pedido pasa', async () => {
        preparar(2);
        await service.crear(dto, 'key-opcion-sabor-2', { canal: 'CARTA' });
        expect(prismaMock.pedido.create).toHaveBeenCalled();
      });
    });

    describe('descuento de stock por opciones (opcion_requiere)', () => {
      const donas = {
        id: 20n, nombre: 'DONAS ARTESANALES', oculto: false, agotado_hasta: null, controla_stock: true,
        stocks: [{ cantidad: 4 }],
        sabores: [
          { id: 501n, producto_id: 20n, nombre: 'Fresa', activo: true, agotado_hasta: null, stockSabor: { cantidad: 3 } },
          { id: 502n, producto_id: 20n, nombre: 'Oreo', activo: true, agotado_hasta: null, stockSabor: { cantidad: 1 } },
        ],
      };
      const host = {
        ...donas,
        id: 1n, nombre: 'DÚO COMPARTIR', precio: 20, controla_stock: false, stocks: [], sabores: [], tamanos: [], ofertasAlcance: [{ id: 900n }],
        categoria_id: 1n, categoria: { id: 1n, nombre: 'Combos', area_id: 1n, area: { id: 1n, nombre: 'Barra', tipo: 'BEBIDA' } },
        grupos: [{ grupo_id: 41n, grupo: { id: 41n, nombre: 'Complemento 1 · Complemento', obligatorio: true, minimo: 1, maximo: 1, activo: true, opciones: [
          { id: 411n, grupo_id: 41n, valor_id: 420n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 420n, nombre: '2 Donas' } },
        ] } },
        { grupo_id: 42n, grupo: { id: 42n, nombre: 'Dona 2 · Sabor', obligatorio: false, minimo: 0, maximo: 1, activo: true, opciones: [
          { id: 412n, grupo_id: 42n, valor_id: 421n, precio_extra: 0, activo: true, agotado_hasta: null, valor: { id: 421n, nombre: 'Fresa' } },
        ] } }],
      };
      const preparar = (saldoPorSabor: Record<string, number>, requisitos: any[], partesCombo?: any[]) => {
        prismaMock.opcionRequiere.findMany.mockResolvedValue(requisitos);
        prismaMock.producto.findMany.mockImplementation(({ where, select }: any) => {
          if (select?.stocks) return Promise.resolve([donas]); // saldo de validación
          if (where?.controla_stock) return Promise.resolve([donas]); // descuento
          return Promise.resolve([host]);
        });
        prismaMock.producto.findUnique = jest.fn().mockResolvedValue({ agotado_hasta: null });
        prismaMock.stock = {
          findFirst: jest.fn().mockResolvedValue({ id: 9n, lugar_id: 7n }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([{ cantidad: 9 }]),
          create: jest.fn(),
        };
        prismaMock.stockSabor = {
          findMany: jest.fn().mockResolvedValue(Object.entries(saldoPorSabor).map(([id, c]) => ({ sabor_id: BigInt(id), cantidad: c }))),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ cantidad: 1 }),
        };
        prismaMock.movimientoStock = { create: jest.fn().mockResolvedValue({}) };
        prismaMock.pedidoLineaSabor = { create: jest.fn().mockResolvedValue({}) };
        prismaMock.agotado = { create: jest.fn() };
        if (partesCombo) ofertasServiceMock.resolverPartesCombo.mockResolvedValue({ nota: '', partes: partesCombo });
      };
      const dtoOpciones = (opciones: number[]) => ({ ...pedidoBaseDto, lineas: [{ productoId: 1, tamanoId: 5, cantidad: 1, opciones }] }) as any;
      const decrementos = () => prismaMock.stockSabor.updateMany.mock.calls.map((c: any) => ({ sabor: c[0].where.sabor_id, n: Number(c[0].data.cantidad.decrement) }));

      it('«2 Donas» baja 2 del stock de las donas, repartidas entre sabores, y deja la venta como VENTA del pedido', async () => {
        preparar({ '501': 3, '502': 1 }, [{ opcion_id: 411n, producto_id: 20n, sabor_id: null, cantidad: 2 }]);
        await service.crear(dtoOpciones([411]), 'key-donas-2', { canal: 'CARTA' });
        expect(decrementos()).toEqual([{ sabor: 501n, n: 2 }]);
        expect(prismaMock.movimientoStock.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ tipo: 'VENTA', producto_id: 20n, sabor_id: 501n, pedido_id: 100n }),
        });
      });

      it('requisito con sabor: baja ese sabor, no otro', async () => {
        preparar({ '501': 3, '502': 1 }, [{ opcion_id: 411n, producto_id: 20n, sabor_id: 502n, cantidad: 1 }]);
        await service.crear(dtoOpciones([411]), 'key-donas-sabor', { canal: 'CARTA' });
        expect(decrementos()).toEqual([{ sabor: 502n, n: 1 }]);
      });

      it('Dona 1 y Dona 2 con el mismo sabor acumulan: un solo descuento de 2 en ese sabor', async () => {
        preparar({ '501': 3, '502': 1 }, [
          { opcion_id: 411n, producto_id: 20n, sabor_id: 501n, cantidad: 1 },
          { opcion_id: 412n, producto_id: 20n, sabor_id: 501n, cantidad: 1 },
        ]);
        await service.crear(dtoOpciones([411, 412]), 'key-donas-acumula', { canal: 'CARTA' });
        expect(decrementos()).toEqual([{ sabor: 501n, n: 2 }]);
      });

      it('no cuenta dos veces si una parte de combo ya descuenta el mismo producto', async () => {
        preparar({ '501': 3, '502': 1 }, [{ opcion_id: 411n, producto_id: 20n, sabor_id: null, cantidad: 2 }], [{
          parteId: 11n, tipo: 'A_ELECCION', productoId: 20n, nombre: 'Dona', cantidad: 2, areaId: 2n, areaNombre: 'Salados',
          categoriaNombre: 'DONAS', nota: 'Combo', sabores: [{ saborId: 501n, nombre: 'Fresa', cantidad: 2 }],
        }]);
        await service.crear(dtoOpciones([411]), 'key-donas-sin-doble', { canal: 'CARTA' });
        expect(decrementos()).toEqual([{ sabor: 501n, n: 2 }]);
      });

      it('saldo que no alcanza dentro de la transacción: 409 STOCK_INSUFICIENTE (el pedido se deshace)', async () => {
        // La validación ve saldo de sobra, pero al descontar solo queda 1 unidad en total
        preparar({ '501': 0, '502': 1 }, [{ opcion_id: 411n, producto_id: 20n, sabor_id: null, cantidad: 2 }]);
        const err: any = await service.crear(dtoOpciones([411]), 'key-donas-409', { canal: 'CARTA' }).catch((e) => e);
        expect(err.getStatus()).toBe(409);
        expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 1 });
      });
    });

    it('suma inválida (5 de 6): 400 SABORES_INVALIDOS y no crea el pedido', async () => {
      const err: any = await service.crear(lineaMedia([{ saborId: 11, cantidad: 2 }, { saborId: 12, cantidad: 3 }]) as any, 'key-sab-suma', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'SABORES_INVALIDOS' });
      expect(prismaMock.pedido.create).not.toHaveBeenCalled();
    });

    it('sin sabores en la línea: 400 SABORES_INVALIDOS con el nombre del producto', async () => {
      const err: any = await service.crear(lineaMedia([]) as any, 'key-sab-faltan', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getResponse()).toEqual({ codigo: 'SABORES_INVALIDOS', mensaje: 'Elige los sabores de Dona' });
    });

    it('sabor agotado: 409 SABOR_AGOTADO con productoId, saborId y saborNombre', async () => {
      prismaMock.producto.findMany.mockImplementation(() =>
        Promise.resolve([{ ...donaSabor, sabores: [{ ...donaSabor.sabores[0], agotado_hasta: new Date('9999-12-31T23:59:59Z') }, donaSabor.sabores[1]] }]),
      );
      const err: any = await service.crear(lineaMedia([{ saborId: 11, cantidad: 6 }]) as any, 'key-sab-agotado', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toEqual({
        codigo: 'SABOR_AGOTADO',
        mensaje: 'El sabor Fresa está agotado',
        productoId: '1',
        saborId: '11',
        saborNombre: 'Fresa',
      });
    });

    it('con apertura de hoy del sabor y pedido mayor al saldo: 409 STOCK_INSUFICIENTE por sabor', async () => {
      prismaMock.conteoApertura.findFirst.mockResolvedValue({ cantidad: 10 });
      prismaMock.stockSabor.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.stockSabor.findUnique.mockResolvedValue({ cantidad: 1 });
      const err: any = await service.crear(lineaMedia([{ saborId: 11, cantidad: 6 }]) as any, 'key-sab-tope', { canal: 'CARTA' }).catch((e) => e);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toEqual({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Solo quedan 1 de Fresa',
        productoId: '1',
        saborId: '11',
        saborNombre: 'Fresa',
        quedan: 1,
      });
    });
  });
});
