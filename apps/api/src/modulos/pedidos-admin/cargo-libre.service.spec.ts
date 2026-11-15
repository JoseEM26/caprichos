jest.mock('../impresion/impresion.service', () => ({ ImpresionService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { CargoLibreService } from './cargo-libre.service';
import { calcularComprobante } from '../comprobantes/facturacion/facturacion.calculo';
import { construirEtiquetasArea } from '../impresion/constructor-etiquetas';
import { lineasParaComprobante } from '../pedidos/lineas-combo.util';

const cajero: any = { partyId: 9n, rol: 'CAJERO' };

function pedido(over: any = {}) {
  return {
    id: 100n, codigo: 'CP-W100', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', cobro_mozo_en: null, monto_credito: 0, version: 3,
    subtotal: 28, total: 28, propina: 0, pago_metodo: 'EFECTIVO', paga_con: 50,
    lineas: [{ id: 1n, nombre: 'Brownie', nota: null, linea_combo_id: null, cargo_libre: false, es_cortesia: false }],
    planPago: [{ medio: 'EFECTIVO', monto: 18 }, { medio: 'YAPE', monto: 10 }],
    cobros: [],
    ...over,
  };
}

describe('CargoLibreService (pedido sin cobrar)', () => {
  let tx: any, prisma: any, pagoPlan: any, auditoria: any, impresion: any, servicio: CargoLibreService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn(),
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()), update: jest.fn().mockResolvedValue({ version: 4 }) },
      pedidoLinea: { create: jest.fn(), update: jest.fn() },
      pedidoPagoPlan: { deleteMany: jest.fn() },
      pedidoEstadoHistorial: { create: jest.fn() },
    };
    prisma = { pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) }, $transaction: jest.fn((fn: any) => fn(tx)) };
    pagoPlan = { guardar: jest.fn(), pagoPrincipal: jest.fn().mockReturnValue('EFECTIVO'), montoEfectivo: jest.fn().mockReturnValue(21.5) };
    auditoria = { registrar: jest.fn() };
    impresion = { capturarEtiquetas: jest.fn().mockResolvedValue(new Map()), encolarEtiquetasEditadas: jest.fn() };
    servicio = new CargoLibreService(prisma, pagoPlan, auditoria, impresion);
  });

  it('agrega la línea libre, sube subtotal y total, ajusta el plan por el efectivo y audita', async () => {
    const r = await servicio.agregar('100', { descripcion: 'Topping de fresa', monto: 3.5 }, cajero);
    expect(tx.pedidoLinea.create.mock.calls[0][0].data).toMatchObject({ cargo_libre: true, producto_id: null, nombre: 'Topping de fresa', cantidad: 1, cargo_libre_por: 9n, listas: 1, despachadas: 1 });
    const upd = tx.pedido.update.mock.calls[0][0].data;
    expect(Number(upd.subtotal)).toBe(31.5);
    expect(Number(upd.total)).toBe(31.5);
    expect(upd.version).toEqual({ increment: 1 });
    expect(pagoPlan.guardar.mock.calls[0][2]).toEqual([{ medio: 'EFECTIVO', monto: 21.5 }, { medio: 'YAPE', monto: 10 }]);
    expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({ accion: 'CARGO_LIBRE', entidadId: 100n, partyId: 9n, despues: expect.objectContaining({ monto: 3.5, total: 31.5 }) });
    expect(r).toMatchObject({ total: 31.5, totalAnterior: 28, version: 4 });
  });

  it('vinculado a un producto: su nota (comanda y sticker) lleva el texto y se reimprime su etiqueta', async () => {
    await servicio.agregar('100', { descripcion: 'Texto: Feliz cumple Ana', monto: 2, paraLineaId: '1' }, cajero);
    expect(tx.pedidoLinea.update.mock.calls[0][0]).toMatchObject({ where: { id: 1n }, data: { nota: '+ Texto: Feliz cumple Ana' } });
    expect(tx.pedidoLinea.create.mock.calls[0][0].data.nota).toBe('Para: Brownie');
    expect(impresion.encolarEtiquetasEditadas).toHaveBeenCalled();
  });

  it('pedido ya cobrado, anulado o al crédito: 409 y no cambia nada', async () => {
    for (const p of [pedido({ pago_estado: 'PAGADO' }), pedido({ cobros: [{ id: 1n }] }), pedido({ estado: 'ANULADO' }), pedido({ monto_credito: 10 })]) {
      prisma.pedido.findUnique.mockResolvedValue(p);
      await expect(servicio.agregar('100', { descripcion: 'Topping', monto: 2 }, cajero)).rejects.toBeInstanceOf(ConflictException);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('monto o descripción inválidos: 400', async () => {
    await expect(servicio.agregar('100', { descripcion: 'Topping', monto: 0 }, cajero)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.agregar('100', { descripcion: 'Topping', monto: 501 }, cajero)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.agregar('100', { descripcion: '  ', monto: 5 }, cajero)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('comprobante con «Servicio o producto» libre', () => {
  it('la línea libre va al comprobante con su descripción y el IGV como el resto; cuadra al céntimo', () => {
    const lineas = lineasParaComprobante([
      { nombre: 'Brownie', cantidad: 1, subtotal: 12, linea_combo_id: null, es_cortesia: false },
      { nombre: 'Texto: Feliz cumple Ana', cantidad: 1, subtotal: 3.5, linea_combo_id: null, es_cortesia: false, cargo_libre: true },
    ] as any[]);
    expect(lineas.map((l: any) => l.nombre)).toContain('Texto: Feliz cumple Ana');
    const t = calcularComprobante({
      igvPct: 18,
      lineas: lineas.map((l: any) => ({ nombre: l.nombre, cantidad: 1, subtotalCents: Math.round(l.subtotal * 100) })),
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 1550,
    });
    expect(t.totalCents).toBe(1550);
    expect(t.items.map((i) => i.nombre)).toContain('Texto: Feliz cumple Ana');
    expect(t.items.reduce((a, i) => a + i.baseCents + i.igvCents, 0)).toBe(1550);
    expect(t.totalGravadaCents + t.totalIgvCents).toBe(1550);
  });
});

describe('stickers con «Servicio o producto» libre', () => {
  const base = { codigo: 'CP-W1', creado_en: new Date(), canal: 'CAJA', modalidad: 'MESA', mesa_nombre: 'Mesa 1', cliente_nombre: 'Ana' };
  const brownie = { id: 1n, producto_id: 5n, area_id: 2n, area: { nombre: 'Postres' }, nombre: 'Brownie', cantidad: 1, nota: '+ Texto: Feliz cumple Ana', linea_combo_id: null };

  it('vinculado: el texto sale en la nota del producto y el cargo no genera línea propia', () => {
    const libre = { id: 2n, producto_id: null, area_id: null, nombre: 'Texto: Feliz cumple Ana', cantidad: 1, nota: 'Para: Brownie', cargo_libre: true };
    const [a] = construirEtiquetasArea({ ...base, lineas: [brownie, libre] });
    expect(a.lineas.map((l) => l.nombre)).toEqual(['Brownie']);
    expect(a.lineas[0].nota).toContain('Feliz cumple Ana');
  });

  it('suelto: sale como línea propia en el primer sticker de área', () => {
    const suelto = { id: 3n, producto_id: null, area_id: null, nombre: 'Bola de helado extra', cantidad: 1, nota: null, cargo_libre: true };
    const [a] = construirEtiquetasArea({ ...base, lineas: [{ ...brownie, nota: null }, suelto] });
    expect(a.lineas.map((l) => l.nombre)).toEqual(['Brownie', 'Bola de helado extra']);
  });
});
