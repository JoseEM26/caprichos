import { BadRequestException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { historialProducto, cantidadConSigno } from './historial-producto';

const d = (iso: string) => new Date(iso);
const mov = (id: number, tipo: string, cantidad: number, en: string, extra: any = {}) => ({
  id: BigInt(id), tipo, cantidad, en: d(en), producto_id: 1n, sabor_id: null, sabor: null, pedido_id: null, pedido: null,
  produccion_id: null, movimiento_anulado_id: null, nota: null, por: 7n, ...extra,
});
const pedido = (id: number, codigo: string, estado = 'ENTREGADO') => ({ id: BigInt(id), codigo, estado, modalidad: 'MESA', cliente_nombre: 'Ana Torres Ruiz' });

function fake(movs: any[], opts: { stock?: number; sabores?: any[]; conteos?: any[]; sinProducto?: boolean } = {}) {
  const llamadas: Record<string, number> = {};
  const cuenta = (k: string, v: any) => { llamadas[k] = (llamadas[k] ?? 0) + 1; return Promise.resolve(v); };
  return {
    llamadas,
    producto: { findUnique: () => cuenta('producto', opts.sinProducto ? null : { id: 1n, nombre: 'Dona', sabores: opts.sabores ?? [] }) },
    movimientoStock: { findMany: (a: any) => cuenta('mov', movs.filter((m) => m.en >= a.where.en.gte)) },
    stock: { findMany: () => cuenta('stock', [{ cantidad: opts.stock ?? 0 }]) },
    stockSabor: { findMany: () => cuenta('stockSabor', []) },
    conteoApertura: { findMany: () => cuenta('conteo', opts.conteos ?? []) },
    person: { findMany: () => cuenta('person', [{ party_id: 7n, nombres: 'Rosa', apellidos: 'Díaz' }]) },
    produccion: { findMany: () => cuenta('produccion', [{ id: 5n, tandas: 2, anulado_en: null }]) },
  };
}
// «Hoy» = 2026-11-08 en Lima (UTC-5)
const AHORA = d('2026-11-08T20:00:00Z');

describe('historialProducto', () => {
  const movs = [
    mov(1, 'AJUSTE', 10, '2026-11-08T12:30:00Z', { nota: 'Apertura del día' }), // 07:30
    mov(2, 'ENTRADA', 20, '2026-11-08T13:00:00Z', { nota: 'Produje hoy', produccion_id: 5n }), // 08:00
    mov(3, 'VENTA', 3, '2026-11-08T15:00:00Z', { pedido_id: 30n, pedido: pedido(30, 'CP-W095', 'ANULADO') }),
    mov(4, 'ANULACION', 3, '2026-11-08T15:30:00Z', { pedido_id: 30n, pedido: pedido(30, 'CP-W095', 'ANULADO'), movimiento_anulado_id: 3n }),
    mov(5, 'VENTA', 2, '2026-11-08T16:00:00Z', { pedido_id: 31n, pedido: pedido(31, 'CP-M010') }),
    mov(6, 'MERMA', -1, '2026-11-08T17:00:00Z', { nota: 'Merma · Se cayó o se rompió · pisó' }),
    mov(7, 'AJUSTE', 1, '2026-11-08T18:00:00Z', { nota: 'Corrección' }),
  ];
  // 10+20-3+3-2-1+1 = 28; el inicio del día era 0

  it('arma la línea de tiempo, el saldo corrido y el resumen', async () => {
    const r = await historialProducto(fake(movs, { stock: 28 }), '1', {}, AHORA);
    expect(r.resumen).toMatchObject({ inicio: 0, subido: 20, vendido: -2, mermas: -1, ajustes: 11, saldo: 28, cuadra: true });
    expect(r.eventos.map((e: any) => e.id)).toEqual(['7', '6', '5', '4', '3', '2', '1']);
    const venta = r.eventos.find((e: any) => e.id === '3');
    expect(venta).toMatchObject({ cantidad: -3, saldoAntes: 30, saldoDespues: 27, hora: '10:00', por: 'Rosa Díaz' });
    expect(venta.pedido).toMatchObject({ codigo: 'CP-W095', anulado: true, devuelto: 3, cliente: 'Ana', enlace: '/admin/caja?pedido=30' });
    expect(r.eventos.find((e: any) => e.id === '2').detalle).toContain('Tanda #5');
    expect(r.eventos.find((e: any) => e.id === '6').detalle).toBe('Se cayó o se rompió · pisó');
  });

  it('avisa «diferencia sin explicar» si el conteo no cuadra con el saldo corrido', async () => {
    const conteos = [{ fecha: d('2026-11-08T00:00:00Z'), cantidad: 25, en: d('2026-11-08T13:00:01Z') }]; // tras la subida hay 30
    const r = await historialProducto(fake(movs, { stock: 28, conteos }), '1', {}, AHORA);
    expect(r.resumen).toMatchObject({ cuadra: false, diferencia: 5 });
    const ok = await historialProducto(fake(movs, { stock: 28, conteos: [{ ...conteos[0], cantidad: 30 }] }), '1', {}, AHORA);
    expect(ok.resumen.cuadra).toBe(true);
  });

  it('filtra por tipo y pagina', async () => {
    const r = await historialProducto(fake(movs, { stock: 28 }), '1', { tipo: 'pedidos' }, AHORA);
    expect(r.eventos.map((e: any) => e.id)).toEqual(['5', '4', '3']);
    expect(r.total).toBe(3);
    expect(r.resumen.saldo).toBe(28);
    const p2 = await historialProducto(fake(movs, { stock: 28 }), '1', { pagina: 2 }, AHORA);
    expect(p2.eventos).toEqual([]);
  });

  it('cruza la medianoche de Lima: 23:59 y 00:01 caen en días distintos', async () => {
    const m = [
      mov(1, 'ENTRADA', 5, '2026-11-08T04:59:00Z'), // 07-nov 23:59 Lima
      mov(2, 'VENTA', 1, '2026-11-08T05:01:00Z'), // 08-nov 00:01 Lima
    ];
    const ayerYHoy = await historialProducto(fake(m, { stock: 4 }), '1', { desde: '2026-11-07', hasta: '2026-11-08' }, AHORA);
    expect(ayerYHoy.eventos.map((e: any) => e.hora)).toEqual(['00:01', '23:59']);
    const hoy = await historialProducto(fake(m, { stock: 4 }), '1', { desde: '2026-11-08' }, AHORA);
    expect(hoy.eventos).toHaveLength(1);
    expect(hoy.resumen).toMatchObject({ inicio: 5, saldo: 4 });
    const soloAyer = await historialProducto(fake(m, { stock: 4 }), '1', { desde: '2026-11-07', hasta: '2026-11-07' }, AHORA);
    expect(soloAyer.eventos).toHaveLength(1);
    expect(soloAyer.resumen).toMatchObject({ inicio: 0, subido: 5, saldo: 5 });
  });

  it('producto sin movimientos: vacío y saldo = existencia', async () => {
    const r = await historialProducto(fake([], { stock: 9 }), '1', {}, AHORA);
    expect(r.eventos).toEqual([]);
    expect(r.resumen).toMatchObject({ inicio: 9, saldo: 9, cuadra: true });
  });

  it('una venta sin pedido guardado dice origen no registrado', async () => {
    const r = await historialProducto(fake([mov(1, 'VENTA', 1, '2026-11-08T15:00:00Z')], { stock: 0 }), '1', {}, AHORA);
    expect(r.eventos[0].origenRegistrado).toBe(false);
  });

  it('no hace N+1: las consultas no crecen con los movimientos', async () => {
    const f = fake(movs, { stock: 28 });
    await historialProducto(f, '1', {}, AHORA);
    const total = Object.values(f.llamadas).reduce((a, b) => a + b, 0);
    const f2 = fake([...movs, ...movs.map((m) => ({ ...m, id: m.id + 100n }))], { stock: 56 });
    await historialProducto(f2, '1', {}, AHORA);
    expect(Object.values(f2.llamadas).reduce((a, b) => a + b, 0)).toBe(total);
    expect(total).toBeLessThanOrEqual(8);
  });

  it('valida entradas y producto inexistente', async () => {
    await expect(historialProducto(fake([], { sinProducto: true }), '1', {}, AHORA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(historialProducto(fake([]), '1', { desde: 'x' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(historialProducto(fake([]), '1', { tipo: 'raro' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(historialProducto(fake([]), '1', { desde: '2026-11-08', hasta: '2026-11-01' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(historialProducto(fake([]), '1', { sabor: '99' }, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signos: ventas restan aunque se guarden en positivo', () => {
    expect(cantidadConSigno('VENTA', 2)).toBe(-2);
    expect(cantidadConSigno('MERMA', -1)).toBe(-1);
    expect(cantidadConSigno('ANULACION', 3)).toBe(3);
  });

  it('el endpoint exige el permiso almacen:apertura (el AccesoGuard del controlador da 403 sin él)', () => {
    const src = readFileSync(join(__dirname, 'almacen.controller.ts'), 'utf8');
    expect(src).toMatch(/@UseGuards\(AccesoGuard\)/);
    expect(src).toMatch(/@Get\('productos\/:id\/historial'\)\s+@Permiso\('almacen', 'apertura'\)/);
  });
});
