// El controlador importa VouchersService -> EventosGateway (@nestjs/jwt, ESM): en pruebas unitarias basta un mock
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SeguimientoController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';
import { generarTokenSeguimiento } from './seguimiento.tokens';

jest.mock('../clientes/clientes.service', () => ({ ClientesService: class {} }));

const CREADO = new Date('2026-10-23T17:00:00Z');

function pedidoBase(id: bigint, codigo: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    codigo,
    estado: 'COLA',
    modalidad: 'DELIVERY',
    total: { toString: () => '20.00' },
    creado_en: CREADO,
    pasa_cocina_en: null,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    historial: [],
    cliente_nombre: 'Nombre Privado',
    cliente_telefono: '999000111',
    entrega_direccion: 'Calle Secreta 123',
    entrega_referencia: 'Portón azul',
    entrega_lat: 1,
    entrega_lng: 2,
    ...extra,
  };
}

const TOKEN_1 = generarTokenSeguimiento(1n);
const TOKEN_2 = generarTokenSeguimiento(2n);

describe('SeguimientoService.obtenerLote', () => {
  let prismaMock: any;
  let service: SeguimientoService;

  beforeEach(() => {
    prismaMock = { pedido: { findMany: jest.fn() } };
    service = new SeguimientoService(prismaMock);
  });

  it('responde en el mismo orden: válido, token inválido y pedido inexistente igual', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([pedidoBase(1n, 'CAP-0001'), pedidoBase(2n, 'CAP-0002')]);

    const res = await service.obtenerLote([
      { codigo: 'CAP-0002', t: TOKEN_1 },
      { codigo: 'CAP-0001', t: TOKEN_1 },
      { codigo: 'CAP-9999', t: TOKEN_2 },
      { codigo: 'CAP-0002' },
    ]);

    expect(res[0]).toEqual({ codigo: 'CAP-0002', noEncontrado: true });
    expect(res[1]).toMatchObject({ codigo: 'CAP-0001', estado: 'COLA', modalidad: 'DELIVERY', total: 20 });
    expect(res[2]).toEqual({ codigo: 'CAP-9999', noEncontrado: true });
    expect(res[3]).toEqual({ codigo: 'CAP-0002', noEncontrado: true });
  });

  it('un token inválido responde igual que un pedido inexistente', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([pedidoBase(1n, 'CAP-0001')]);
    const invalido = await service.obtenerLote([{ codigo: 'CAP-0001', t: 'x'.repeat(64) }]);
    const inexistente = await service.obtenerLote([{ codigo: 'CAP-0404', t: 'x'.repeat(64) }]);
    expect(invalido[0]).toEqual({ codigo: 'CAP-0001', noEncontrado: true });
    expect(Object.keys(inexistente[0])).toEqual(Object.keys(invalido[0]));
  });

  it('no expone nombre, teléfono, dirección ni coordenadas', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([pedidoBase(1n, 'CAP-0001')]);
    const [res] = await service.obtenerLote([{ codigo: 'CAP-0001', t: TOKEN_1 }]);
    const texto = JSON.stringify(res);
    for (const dato of ['Nombre Privado', '999000111', 'Calle Secreta', 'Portón', 'cliente_', 'entrega_']) {
      expect(texto).not.toContain(dato);
    }
  });
});

describe('SeguimientoController', () => {
  let service: SeguimientoService;
  let obtenerLote: jest.SpyInstance;
  let clientesMock: { clienteDesdeRequest: jest.Mock };
  let controller: SeguimientoController;

  beforeEach(() => {
    service = new SeguimientoService({ pedido: { findMany: jest.fn().mockResolvedValue([]) } } as any);
    obtenerLote = jest.spyOn(service, 'obtenerLote').mockResolvedValue([]);
    clientesMock = { clienteDesdeRequest: jest.fn() };
    controller = new SeguimientoController(service, clientesMock as any, {} as any);
  });

  const entradas = (n: number) => Array.from({ length: n }, (_, i) => ({ codigo: `CAP-${i}`, t: 'tok' }));

  it('acepta hasta 20 pedidos en el lote', async () => {
    await expect(controller.obtenerLote({ pedidos: entradas(20) })).resolves.toEqual({ resultados: [] });
    expect(obtenerLote).toHaveBeenCalledTimes(1);
  });

  it('más de 20 pedidos responde 400', async () => {
    await expect(controller.obtenerLote({ pedidos: entradas(21) })).rejects.toBeInstanceOf(BadRequestException);
    expect(obtenerLote).not.toHaveBeenCalled();
  });

  it('sin lista de pedidos responde 400', async () => {
    await expect(controller.obtenerLote({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.obtenerLote({ pedidos: 'CAP-1' as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pedidos de cuenta sin sesión responde 401', async () => {
    clientesMock.clienteDesdeRequest.mockResolvedValue(null);
    await expect(controller.pedidosCuenta({} as any, '1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('pedidos de cuenta usan solo el party de la sesión y la página pedida', async () => {
    clientesMock.clienteDesdeRequest.mockResolvedValue({ partyId: '77' });
    const pedidosDeCuenta = jest.spyOn(service, 'pedidosDeCuenta').mockResolvedValue({ pedidos: [], pagina: 2, hayMas: false });

    await controller.pedidosCuenta({} as any, '2');

    expect(pedidosDeCuenta).toHaveBeenCalledWith(77n, 2);
  });

  it('una página inválida cuenta como la primera', async () => {
    clientesMock.clienteDesdeRequest.mockResolvedValue({ partyId: '77' });
    const pedidosDeCuenta = jest.spyOn(service, 'pedidosDeCuenta').mockResolvedValue({ pedidos: [], pagina: 1, hayMas: false });

    await controller.pedidosCuenta({} as any, 'abc');
    await controller.pedidosCuenta({} as any, '-3');

    expect(pedidosDeCuenta.mock.calls).toEqual([[77n, 1], [77n, 1]]);
  });
});

describe('SeguimientoService.pedidosDeCuenta', () => {
  let prismaMock: { pedido: { findMany: jest.Mock } };
  let service: SeguimientoService;

  const lineas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ nombre: `Producto ${i + 1}`, cantidad: i + 1 }));

  beforeEach(() => {
    prismaMock = { pedido: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new SeguimientoService(prismaMock as any);
  });

  it('filtra por party, ordena del más nuevo y pide 11 para saber si hay más', async () => {
    await service.pedidosDeCuenta(77n, 2);

    const args = prismaMock.pedido.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ party_id: 77n });
    expect(args.orderBy).toEqual([{ creado_en: 'desc' }, { id: 'desc' }]);
    expect(args.skip).toBe(10);
    expect(args.take).toBe(11);
  });

  it('marca hayMas cuando llega una fila extra y la devuelve fuera de la página', async () => {
    const filas = Array.from({ length: 11 }, (_, i) => pedidoBase(BigInt(i + 1), `CAP-${i}`, { lineas: [] }));
    prismaMock.pedido.findMany.mockResolvedValue(filas);

    const res = await service.pedidosDeCuenta(77n, 1);

    expect(res.pedidos).toHaveLength(10);
    expect(res.hayMas).toBe(true);
    expect(res.pagina).toBe(1);
  });

  it('sin más páginas: hayMas false', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([pedidoBase(1n, 'CAP-1', { lineas: [] })]);
    const res = await service.pedidosDeCuenta(77n, 1);
    expect(res.hayMas).toBe(false);
  });

  it('resumen: hasta 3 productos y «y N más» con el resto', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([
      pedidoBase(1n, 'CAP-1', { lineas: lineas(2) }),
      pedidoBase(2n, 'CAP-2', { lineas: lineas(4) }),
    ]);

    const res = await service.pedidosDeCuenta(77n, 1);

    expect(res.pedidos[0].resumen).toBe('1 x Producto 1, 2 x Producto 2');
    expect(res.pedidos[1].resumen).toBe('1 x Producto 1, 2 x Producto 2, 3 x Producto 3 y 1 más');
  });

  it('cada pedido trae su token de seguimiento, fecha y estado, sin datos personales', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([pedidoBase(1n, 'CAP-1', { lineas: lineas(1) })]);

    const [pedido] = (await service.pedidosDeCuenta(77n, 1)).pedidos;

    expect(pedido).toMatchObject({
      codigo: 'CAP-1',
      estado: 'COLA',
      estadoEtiqueta: 'En cola',
      total: 20,
      creadoEn: CREADO.toISOString(),
      terminado: false,
      anulado: false,
      seguimientoToken: TOKEN_1,
    });
    expect(pedido.pasos.map((p) => p.clave)).toEqual(['recibido', 'cocina', 'camino', 'entregado']);
    expect(JSON.stringify(pedido)).not.toContain('Nombre Privado');
    expect(JSON.stringify(pedido)).not.toContain('Calle Secreta');
  });
});
