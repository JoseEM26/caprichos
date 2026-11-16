jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));

import 'reflect-metadata';
import { cuponesParaDar, darCupon, quitarCuponDado } from './cupon-asignado';
import { usosDeCupon } from './cupon-usos';
import { CuponesController } from './ofertas.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ } from '../acceso/permisos';

const HOY = new Date('2027-03-19T20:00:00Z');
const cupon = (extra: any = {}) => ({
  id: 3n,
  modo: 'ASIGNADO_PERSONAL',
  codigo_base: 'AMIGO15',
  descripcion: '15% para ti',
  descuento_tipo: 'PORCENTAJE',
  descuento_valor: 15,
  dias_validez: 10,
  tope_usos: 5,
  activo: true,
  dias: [],
  hora_desde: null,
  hora_hasta: null,
  fecha_desde: null,
  fecha_hasta: null,
  orden: 0,
  ...extra,
});

function entorno(opts: { pedido?: any; cupon?: any; dados?: number; yaDado?: any } = {}) {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue('pedido' in opts ? opts.pedido : { id: 9n, estado: 'ENTREGADO' }) },
    cupon: { findUnique: jest.fn().mockResolvedValue('cupon' in opts ? opts.cupon : cupon()), findMany: jest.fn().mockResolvedValue([cupon(), cupon({ id: 4n, codigo_base: 'LLENO', tope_usos: 1 })]) },
    cuponEmitido: {
      findFirst: jest.fn().mockResolvedValue(opts.yaDado ?? null),
      groupBy: jest.fn().mockResolvedValue([{ cupon_id: 3n, _count: { _all: opts.dados ?? 0 } }, { cupon_id: 4n, _count: { _all: 1 } }]),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 50n, ...data, estado: 'VIGENTE', cupon: cupon() })),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 50n, cupon_id: 3n, codigo: 'AMIGO15-AAAAAA', ...data, cupon: cupon() })),
    },
  };
  const auditoria = { registrar: jest.fn() };
  return { prisma, auditoria, deps: { prisma, auditoria } };
}

describe('darCupon (cupón que da el mozo o cajero)', () => {
  it('crea un código único de un solo uso con vencimiento, pedido de origen y quién lo dio, y lo audita', async () => {
    const { prisma, auditoria, deps } = entorno();
    const r = await darCupon(deps, '3', '9', 77n, HOY);
    const data = prisma.cuponEmitido.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ cupon_id: 3n, pedido_origen_id: 9n, estado: 'VIGENTE', otorgado_por: 77n });
    expect(data.codigo).toMatch(/^AMIGO15-[A-Z2-9]{6}$/);
    expect(data.vence_en.toISOString()).toBe('2027-03-29T20:00:00.000Z'); // 10 días
    expect(r).toMatchObject({ codigo: data.codigo, yaExistia: false });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'cupones', accion: 'dar', partyId: 77n }));
  });

  it('idempotente: si el pedido ya tiene un cupón dado devuelve el mismo y no crea otro', async () => {
    const yaDado = { id: 8n, cupon_id: 3n, codigo: 'AMIGO15-ZZZZZZ', estado: 'VIGENTE', vence_en: null, cupon: cupon() };
    const { prisma, deps } = entorno({ yaDado });
    const r = await darCupon(deps, '3', '9', 77n, HOY);
    expect(r).toMatchObject({ codigo: 'AMIGO15-ZZZZZZ', yaExistia: true });
    expect(prisma.cuponEmitido.create).not.toHaveBeenCalled();
  });

  it.each([
    ['pedido anulado', { pedido: { id: 9n, estado: 'ANULADO' } }, 'PEDIDO_ANULADO'],
    ['cupón de otro modo', { cupon: cupon({ modo: 'COMPARTIDO' }) }, 'CUPON_NO_ASIGNABLE'],
    ['cupón desactivado', { cupon: cupon({ activo: false }) }, 'CUPON_INACTIVO'],
    ['fuera de fechas', { cupon: cupon({ fecha_hasta: new Date('2027-01-01T00:00:00Z') }) }, 'CUPON_INACTIVO'],
    ['tope alcanzado', { dados: 5 }, 'CUPON_AGOTADO'],
  ])('rechaza: %s', async (_n, opts, codigo) => {
    const { prisma, deps } = entorno(opts as any);
    await expect(darCupon(deps, '3', '9', 77n, HOY)).rejects.toMatchObject({ response: { codigo } });
    expect(prisma.cuponEmitido.create).not.toHaveBeenCalled();
  });

  it('pedido inexistente: 404', async () => {
    const { deps } = entorno({ pedido: null });
    await expect(darCupon(deps, '3', '9', 77n, HOY)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
  });
});

describe('quitarCuponDado', () => {
  it('anula un cupón vigente y lo audita', async () => {
    const { prisma, auditoria, deps } = entorno();
    prisma.cuponEmitido.findUnique.mockResolvedValue({ id: 50n, cupon_id: 3n, codigo: 'AMIGO15-AAAAAA', estado: 'VIGENTE', pedido_origen_id: 9n, cupon: cupon() });
    const r = await quitarCuponDado(deps, '50', 77n);
    expect(prisma.cuponEmitido.update.mock.calls[0][0].data).toMatchObject({ estado: 'ANULADO', anulado_por: 77n });
    expect(r.quitado).toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'quitar_dado' }));
  });

  it('si ya fue canjeado no se puede quitar', async () => {
    const { prisma, deps } = entorno();
    prisma.cuponEmitido.findUnique.mockResolvedValue({ id: 50n, estado: 'CANJEADO', cupon: cupon() });
    await expect(quitarCuponDado(deps, '50', 77n)).rejects.toMatchObject({ response: { codigo: 'CUPON_YA_CANJEADO' } });
    expect(prisma.cuponEmitido.update).not.toHaveBeenCalled();
  });

  it('no toca códigos de otros modos', async () => {
    const { prisma, deps } = entorno();
    prisma.cuponEmitido.findUnique.mockResolvedValue({ id: 50n, estado: 'VIGENTE', cupon: cupon({ modo: 'UNICO_COMPROBANTE' }) });
    await expect(quitarCuponDado(deps, '50', 77n)).rejects.toMatchObject({ response: { codigo: 'CUPON_EMITIDO_NO_ENCONTRADO' } });
  });
});

describe('cuponesParaDar', () => {
  it('lista los activos con cupos (oculta los agotados) y el cupón que ya tiene el pedido', async () => {
    const { prisma } = entorno({ dados: 2, yaDado: { id: 8n, cupon_id: 3n, codigo: 'AMIGO15-ZZZZZZ', estado: 'VIGENTE', vence_en: null, cupon: cupon() } });
    const r = await cuponesParaDar(prisma, '9', HOY);
    expect(r.cupones).toEqual([expect.objectContaining({ id: '3', codigoBase: 'AMIGO15', quedan: 3 })]);
    expect(r.dado).toMatchObject({ codigo: 'AMIGO15-ZZZZZZ' });
  });
});

describe('permiso cupones/dar', () => {
  it('lo piden los tres endpoints y lo tienen ADMIN, CAJERO y MOZO', () => {
    for (const m of ['darCupon', 'quitarCuponDado', 'cuponesParaDar'] as const) {
      expect(Reflect.getMetadata(CLAVE_PERMISO, CuponesController.prototype[m])).toEqual({ modulo: 'cupones', accion: 'dar' });
    }
    for (const rol of ['ADMIN', 'CAJERO', 'MOZO']) expect(MATRIZ[rol]).toContain('cupones/dar');
  });
});

describe('usosDeCupon ASIGNADO_PERSONAL', () => {
  const pedido = (extra: any = {}) => ({
    codigo: 'CP-1', canal: 'CAJA', estado: 'ENTREGADO', total: 40, descuento: 6, descuento_detalle: { tipo: 'CUPON', codigo: 'X', monto: 6 },
    cliente_nombre: 'Lucía Ejemplo', cliente_telefono: '987654321', cliente_party_id: 5n, ...extra,
  });
  it('dados vs canjeados, por quien lo dio y con los pedidos de origen y de canje', async () => {
    const ayer = new Date('2027-03-18T20:00:00Z');
    const emitidos = [
      { id: 1n, codigo: 'AMIGO15-AAAAAA', estado: 'CANJEADO', creado_en: ayer, canjeado_en: HOY, canjeado_canal: 'MOZO', otorgado_por: 77n, vence_en: null, pedidoOrigen: pedido(), pedidoCanje: pedido({ codigo: 'CP-2' }) },
      { id: 2n, codigo: 'AMIGO15-BBBBBB', estado: 'VIGENTE', creado_en: ayer, otorgado_por: 77n, vence_en: new Date('2027-01-01T00:00:00Z'), pedidoOrigen: pedido({ codigo: 'CP-3', cliente_party_id: null }), pedidoCanje: null },
      { id: 3n, codigo: 'AMIGO15-CCCCCC', estado: 'ANULADO', creado_en: ayer, otorgado_por: 78n, pedidoOrigen: pedido(), pedidoCanje: null },
    ];
    const prisma: any = {
      cupon: { findUnique: jest.fn().mockResolvedValue(cupon()) },
      cuponEmitido: { findMany: jest.fn().mockResolvedValue(emitidos) },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 77n, nombres: 'Rosa', apellidos: 'Prueba' }]) },
    };
    const r: any = await usosDeCupon(prisma, '3', 1, 10, HOY);
    expect(r.resumen).toMatchObject({ usos: 2, emitidos: 2, canjeados: 1, vencidos: 1, anulados: 1, tope: 5, quedan: 3, descuentoTotal: 6 });
    expect(r.porTrabajador).toEqual([{ partyId: '77', nombre: 'Rosa Prueba', usos: 2, dados: 2, canjeados: 1, soles: 6 }]);
    expect(r.historial.items).toHaveLength(2);
    expect(r.historial.items.find((i: any) => i.codigo === 'AMIGO15-AAAAAA')).toMatchObject({
      estado: 'CANJEADO', pedidoOrigenCodigo: 'CP-1', pedidoCanjeCodigo: 'CP-2', otorgadoPor: 'Rosa Prueba', canjeadoCanal: 'MOZO', cliente: { nombre: 'Lucía Ejemplo', celular: '9•••••321' },
    });
    expect(r.historial.items.find((i: any) => i.codigo === 'AMIGO15-BBBBBB')).toMatchObject({ estado: 'VENCIDO', cliente: { sinCuenta: true } });
  });
});
