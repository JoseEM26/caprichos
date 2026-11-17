import { darCupon, MODO_ASIGNADO, puedeDarCupon } from '../ofertas/cupon-asignado';
import { darCuponAlCrear } from './cupon-al-crear';

// Prisma falso con la lógica real de darCupon: un cupón «Lo da el personal» con tope y emisiones en memoria
function montarPrisma(tope: number | null) {
  const cupon = {
    id: 3n,
    codigo_base: 'AMIGO15',
    descripcion: 'Amigo',
    modo: MODO_ASIGNADO,
    activo: true,
    descuento_tipo: 'PORCENTAJE',
    descuento_valor: 15,
    dias_validez: 10,
    tope_usos: tope,
  };
  const emitidos: any[] = [];
  const activos = () => emitidos.filter((e) => e.estado !== 'ANULADO');
  const prisma: any = {
    pedido: { findUnique: jest.fn(async () => ({ id: 500n, estado: 'COLA' })) },
    cupon: { findUnique: jest.fn(async () => cupon) },
    cuponEmitido: {
      findFirst: jest.fn(async ({ where }: any) => activos().find((e) => e.pedido_origen_id === where.pedido_origen_id) ?? null),
      groupBy: jest.fn(async () => [{ cupon_id: cupon.id, _count: { _all: activos().length } }]),
      create: jest.fn(async ({ data }: any) => {
        const e = { id: BigInt(emitidos.length + 1), ...data, cupon, estado: data.estado, creado_en: new Date() };
        emitidos.push(e);
        return e;
      }),
    },
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const dar = (c: string, p: string, u?: { partyId?: any }) => darCupon({ prisma, auditoria }, c, p, u?.partyId);
  return { prisma, auditoria, emitidos, dar };
}

describe('darCuponAlCrear (cupón «Lo da el personal» junto con el pedido)', () => {
  it('con cupo: queda emitido y ligado al pedido, con quien lo dio, y se audita', async () => {
    const { emitidos, auditoria, dar } = montarPrisma(null);
    const r = await darCuponAlCrear(dar, 500n, '3', 7n);
    expect(r.cuponNoDado).toBeUndefined();
    expect(r.cuponDado).toMatchObject({ descripcion: 'Amigo', yaExistia: false });
    expect(r.cuponDado?.codigo).toMatch(/^AMIGO15-/);
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0]).toMatchObject({ pedido_origen_id: 500n, otorgado_por: 7n, estado: 'VIGENTE' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'cupones', accion: 'dar' }));
  });

  it('sin cupo: no lanza, devuelve el motivo y no emite nada', async () => {
    const { emitidos, dar, prisma } = montarPrisma(1);
    // otro pedido ya tiene el único cupón que se podía dar
    prisma.cuponEmitido.groupBy.mockResolvedValueOnce([{ cupon_id: 3n, _count: { _all: 1 } }]);
    const r = await darCuponAlCrear(dar, 500n, '3', 7n);
    expect(r).toEqual({ cuponNoDado: { motivo: 'Ya se dieron todos los cupones de este tipo' } });
    expect(emitidos).toHaveLength(0);
  });

  it('reintento con el mismo pedido: no da un segundo cupón (devuelve el que ya tiene)', async () => {
    const { emitidos, dar } = montarPrisma(null);
    const primera = await darCuponAlCrear(dar, 500n, '3', 7n);
    const segunda = await darCuponAlCrear(dar, 500n, '3', 7n);
    expect(emitidos).toHaveLength(1);
    expect(segunda.cuponDado).toMatchObject({ codigo: primera.cuponDado?.codigo, yaExistia: true });
  });

  it('un fallo que no es de negocio no tumba el pedido: motivo genérico', async () => {
    const r = await darCuponAlCrear(async () => {
      throw new Error('conexión caída: detalle interno');
    }, 500n, '3');
    expect(r.cuponNoDado?.motivo).toMatch(/inesperado/);
    expect(r.cuponNoDado?.motivo).not.toMatch(/detalle interno/);
  });
});

describe('puedeDarCupon (mismo permiso cupones/dar que el botón del detalle)', () => {
  it('MOZO y CAJERO sí; COCINA no; sin usuario no', () => {
    expect(puedeDarCupon({ rol: 'MOZO' })).toBe(true);
    expect(puedeDarCupon({ rol: 'CAJERO' })).toBe(true);
    expect(puedeDarCupon({ rol: 'COCINA' })).toBe(false);
    expect(puedeDarCupon(undefined)).toBe(false);
  });
});
