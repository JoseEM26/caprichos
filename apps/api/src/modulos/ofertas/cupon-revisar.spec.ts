import { BadRequestException } from '@nestjs/common';
import { revisarCupon } from './cupon-canje';

const HOY = new Date('2026-11-16T15:00:00Z');
const futuro = new Date('2026-12-01T00:00:00Z');
const cupon = (o: any = {}) => ({
  id: 1n, modo: 'ASIGNADO_PERSONAL', codigo_base: 'GRACIAS10', descripcion: '10% de cortesia', descuento_tipo: 'PORCENTAJE',
  descuento_valor: 10, compra_minima: null, canales: ['CAJA', 'MOZO'], activo: true, categoria: null, producto: null, fecha_hasta: null, ...o,
});
const emitido = (o: any = {}) => ({
  id: 5n, codigo: 'ABC123', estado: 'VIGENTE', vence_en: futuro, creado_en: new Date('2026-11-10T15:00:00Z'), otorgado_por: 7n, canjeado_por: null, canjeado_en: null, canjeado_canal: null,
  cupon: cupon(), pedidoOrigen: { codigo: 'P-1', cliente_telefono: '987654321' }, pedidoCanje: null, ...o,
});
const montar = (em: any, ped: any = {}, validar?: jest.Mock) => {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue({ id: 9n, subtotal: 50, envio: 0, total: 50, estado: 'COLA', cupon_id: null, puntos_canjeados: 0, lineas: [], ...ped }) },
    cuponEmitido: { findUnique: jest.fn().mockResolvedValue(em), update: jest.fn() },
    cupon: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    person: { findMany: jest.fn().mockResolvedValue([{ party_id: 7n, nombres: 'Ana', apellidos: 'Mozo' }, { party_id: 8n, nombres: 'Luis', apellidos: 'Caja' }]) },
  };
  const v = validar ?? jest.fn().mockResolvedValue({ cupon: { descuentoCalculado: 5, canales: ['CAJA', 'MOZO'], tipo: 'PORCENTAJE' } });
  return { prisma, v, run: (canal?: string) => revisarCupon({ prisma, validar: v, partyCliente: () => null }, ' abc 123 ', 9, canal, HOY) };
};

describe('revisarCupon', () => {
  it('vigente: detalles, descuento calculado y quién lo dio; no escribe nada', async () => {
    const { prisma, run } = montar(emitido());
    const r: any = await run();
    expect(r).toMatchObject({ aplicable: true, motivo: null, estado: 'VIGENTE', descuento: 5, nuevoTotal: 45, totalActual: 50 });
    expect(r.dado).toMatchObject({ por: 'Ana Mozo', pedido: 'P-1', cliente: '9•••••321' });
    expect(r.cupon).toMatchObject({ codigoBase: 'GRACIAS10', tipo: 'PORCENTAJE', valor: 10 });
    expect(prisma.cuponEmitido.update).not.toHaveBeenCalled();
    expect(prisma.cupon.update).not.toHaveBeenCalled();
    expect(prisma.cuponEmitido.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { codigo: 'ABC123' } }));
  });

  it('canjeado: motivo claro y datos de cuándo y quién lo canjeó', async () => {
    const e = emitido({ estado: 'CANJEADO', canjeado_en: new Date('2026-11-12T15:00:00Z'), canjeado_por: 8n, canjeado_canal: 'CAJA', pedidoCanje: { codigo: 'P-3' } });
    const { run } = montar(e, {}, jest.fn().mockRejectedValue(new BadRequestException({ mensaje: 'Este cupón ya fue canjeado' })));
    const r: any = await run();
    expect(r).toMatchObject({ aplicable: false, estado: 'CANJEADO', motivo: 'Este cupón ya fue canjeado', descuento: null });
    expect(r.canje).toMatchObject({ por: 'Luis Caja', canal: 'CAJA', pedido: 'P-3' });
  });

  it('vencido: estado VENCIDO aunque la base diga VIGENTE', async () => {
    const { run } = montar(emitido({ vence_en: new Date('2026-11-01T00:00:00Z') }), {}, jest.fn().mockRejectedValue(new BadRequestException({ mensaje: 'Este cupón está vencido' })));
    expect(await run()).toMatchObject({ aplicable: false, estado: 'VENCIDO', motivo: 'Este cupón está vencido' });
  });

  it('anulado', async () => {
    const { run } = montar(emitido({ estado: 'ANULADO' }), {}, jest.fn().mockRejectedValue(new BadRequestException({ mensaje: 'Este cupón fue anulado' })));
    expect(await run()).toMatchObject({ aplicable: false, estado: 'ANULADO', motivo: 'Este cupón fue anulado' });
  });

  it('compra mínima: muestra el mensaje de la validación', async () => {
    const { run } = montar(emitido(), {}, jest.fn().mockRejectedValue(new BadRequestException({ mensaje: 'Este cupón exige una compra mínima de S/ 80.00' })));
    expect(await run()).toMatchObject({ aplicable: false, motivo: expect.stringContaining('compra mínima') });
  });

  it('canal: un cupón que no vale en mozo se rechaza con motivo', async () => {
    const v = jest.fn().mockResolvedValue({ cupon: { descuentoCalculado: 5, canales: ['CARTA'], tipo: 'MONTO' } });
    const { run } = montar(emitido(), {}, v);
    expect(await run('MOZO')).toMatchObject({ aplicable: false, motivo: 'Este cupón no vale en mozo', descuento: null });
  });

  it('pedido con cupón, anulado o con puntos: motivo del pedido sin validar el cupón', async () => {
    for (const [ped, texto] of [[{ cupon_id: 3n }, 'ya tiene un cupón'], [{ estado: 'ANULADO' }, 'anulado'], [{ puntos_canjeados: 20 }, 'puntos']] as const) {
      const { v, run } = montar(emitido(), ped as any);
      expect(await run()).toMatchObject({ aplicable: false, motivo: expect.stringContaining(texto) });
      expect(v).not.toHaveBeenCalled();
    }
  });

  it('envío gratis no se aplica desde aquí', async () => {
    const v = jest.fn().mockResolvedValue({ cupon: { descuentoCalculado: 0, canales: [], tipo: 'ENVIO_GRATIS' } });
    const { run } = montar(emitido(), {}, v);
    expect(await run()).toMatchObject({ aplicable: false, motivo: expect.stringContaining('envío gratis') });
  });

  it('código inexistente', async () => {
    const { run } = montar(null);
    expect(await run()).toMatchObject({ existe: false, aplicable: false, motivo: expect.stringContaining('no existe') });
  });
});
