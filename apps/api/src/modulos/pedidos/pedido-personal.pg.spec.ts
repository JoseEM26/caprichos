/**
 * Pedido del personal (descuento 25 %) contra un Postgres REAL: crédito y «pagar ahora», con cada comprobante.
 * Solo corre con una base desechable con todas las migraciones:
 *   PEDIDO_PG_URL=<url> npx jest pedido-personal.pg
 */
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { PrismaClient } from '@prisma/client';
import { PedidosService } from './pedidos.service';
import { PagoPlanService } from './pago-plan.service';

const URL_PG = process.env.PEDIDO_PG_URL;
const suite = URL_PG ? describe : describe.skip;

suite('Pedido del personal en Postgres real', () => {
  let prisma: PrismaClient;
  let service: PedidosService;
  let productoId: bigint;
  let trabajadorId: bigint;
  let n = 0;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_PG! } } });
    const area = await prisma.areaCocina.create({ data: { nombre: `Area-${Date.now()}` } });
    const cat = await prisma.categoria.create({ data: { nombre: `Cat-${Date.now()}`, area_id: area.id } });
    productoId = (await prisma.producto.create({ data: { nombre: `Prod-${Date.now()}`, precio: 14.49, categoria_id: cat.id } })).id;
    const rol = await prisma.rol.findFirst();
    const party = await prisma.party.create({ data: { tipo: 'PERSONA' } });
    await prisma.person.create({ data: { party_id: party.id, nombres: 'Ana', apellidos: 'Prueba' } });
    await prisma.userAccount.create({ data: { party_id: party.id, rol: rol!.codigo, hash: 'x' } });
    trabajadorId = party.id;
    const cajero = await prisma.party.create({ data: { tipo: 'PERSONA' } });
    (global as any).__cajero = cajero.id;
    await prisma.caja.create({ data: { fecha: new Date(), apertura: 100, estado: 'ABIERTA', abierta_por: cajero.id } });
    const stub = (o: any) => o;
    service = new PedidosService(
      prisma as any,
      stub({ exigirLocalAbierto: async () => undefined, obtenerEstadoCarta: async () => ({ abierta: true }) }),
      stub({ detectar: async () => null }),
      stub({ emitirAdmin: () => undefined }),
      stub({
        calcularDescuentosParaPedido: async () => ({ descuentoTotal: 0, ofertaId: null, cuponId: null, cuponEmitidoId: null, detalles: [] }),
        emitirCuponesParaPedido: async () => [],
      }),
      new PagoPlanService(),
    );
  });
  afterAll(() => prisma.$disconnect());

  const dto = (extra: any = {}): any => ({
    modalidad: 'RECOGER',
    cliente: { nombre: 'Ana Prueba (personal)' },
    lineas: [{ productoId: String(productoId), cantidad: 1 }],
    pago: { metodo: 'EFECTIVO', plan: [{ medio: 'EFECTIVO', monto: 10.87 }] },
    esPersonal: true,
    ...extra,
  });
  const origen = (extra: any = {}): any => ({
    canal: 'CAJA',
    usuarioPartyId: (global as any).__cajero,
    clientePartyId: trabajadorId,
    esPersonal: true,
    puedeCobrarAhora: true,
    omitirChequeoCarta: true,
    ...extra,
  });

  const comprobantes: Array<[string, any]> = [
    ['simple', { tipo: 'SIMPLE' }],
    ['boleta', { tipo: 'BOLETA', dni: '12345678' }],
    ['factura', { tipo: 'FACTURA', ruc: '20123456789', razonSocial: 'Empresa Prueba SAC' }],
  ];
  it.each(comprobantes)('a su crédito con comprobante %s: total 10.87 y consumo pendiente', async (_n, comprobante) => {
    const r: any = await service.crear(dto({ comprobante }), `pers-cred-${_n}-${++n}-${Date.now()}`, origen({ pagoPersonal: { modo: 'CREDITO' } }));
    expect(Number(r.total)).toBe(10.87);
    const c = await prisma.consumoPersonal.findFirst({ where: { pedido_id: BigInt(r.id) } });
    expect(c?.pagado_en).toBeNull();
  });
  it.each(comprobantes)('pagar ahora en efectivo con comprobante %s', async (_n, comprobante) => {
    const r: any = await service.crear(
      dto({ comprobante }),
      `pers-ahora-${_n}-${++n}-${Date.now()}`,
      origen({ pagoPersonal: { modo: 'AHORA', medio: 'EFECTIVO', pagaCon: 20 } }),
    );
    const c = await prisma.consumoPersonal.findFirst({ where: { pedido_id: BigInt(r.id) } });
    expect(c?.pagado_en).not.toBeNull();
  });
});
