import { describe, it, expect } from 'vitest';
import { otrosDiasProgramados, separarProgramadosOtrosDias, esProgramadoOtroDia } from '../programado';
import { filasDePedidos, resumirDia } from '../resumenDia';
import { parametrosDeRango, textoRango, rangoPara } from '../filtroDias';
import type { Pedido } from '../pedidosApi';

// Hoy es 29/10/2026 a las 10:00 en Lima
const AHORA = new Date('2026-10-29T15:00:00Z');

const pedido = (id: string, programado: string | null, extra: Partial<Pedido> = {}): Pedido =>
  ({ id, codigo: `CP-${id}`, estado: programado ? 'PROGRAMADO' : 'PREPARANDO', pago_estado: 'PAGADO', total: 29, programado_para: programado, ...extra }) as unknown as Pedido;

const HOY_NOCHE = '2026-10-29T22:00:00Z';
const MANANA = '2026-10-30T22:00:00Z';

describe('programados visibles con cualquier filtro de días', () => {
  it('con el filtro de ayer la sección de otros días sale igual de los vigentes', () => {
    // La lista de ayer no trae programados de mañana, pero los vigentes sí
    const enAyer = [pedido('9', null)];
    const vigentes = [pedido('3', MANANA), pedido('2', HOY_NOCHE)];
    const otros = otrosDiasProgramados(separarProgramadosOtrosDias(enAyer, AHORA).otrosDias, vigentes, AHORA);
    expect(otros.map((p) => p.id)).toEqual(['3']);
  });

  it('no duplica un programado que viene en la lista y también en los vigentes', () => {
    const enLista = [pedido('3', MANANA), pedido('1', null)];
    const vigentes = [pedido('3', MANANA)];
    const otros = otrosDiasProgramados(separarProgramadosOtrosDias(enLista, AHORA).otrosDias, vigentes, AHORA);
    expect(otros.map((p) => p.id)).toEqual(['3']);
  });

  it('ordena la sección por fecha pactada', () => {
    const vigentes = [pedido('5', '2026-10-31T22:00:00Z'), pedido('3', MANANA)];
    const otros = otrosDiasProgramados([], vigentes, AHORA);
    expect(otros.map((p) => p.id)).toEqual(['3', '5']);
  });

  it('un programado de hoy no va a la sección de otros días (es del día)', () => {
    const hoy = pedido('2', HOY_NOCHE);
    expect(esProgramadoOtroDia(hoy, AHORA)).toBe(false);
    expect(otrosDiasProgramados([], [hoy], AHORA)).toEqual([]);
  });
});

describe('modo «Programados / encargos»', () => {
  it('pide solo programados, sin fechas de días', () => {
    expect(parametrosDeRango({ modo: 'programados', desde: '', hasta: '' })).toEqual({ programados: true });
  });

  it('se muestra con su nombre en el filtro', () => {
    expect(textoRango({ modo: 'programados', desde: '', hasta: '' }, '2026-10-29')).toBe('programados y encargos');
  });

  it('el filtro de ayer no cambia de modo', () => {
    expect(rangoPara('ayer', '2026-10-29')).toEqual({ modo: 'ayer', desde: '2026-10-28', hasta: '2026-10-28' });
  });
});

describe('un programado de otro día no cuenta en el día', () => {
  it('ni en ventas ni en por cobrar, aunque esté pagado completo', () => {
    const normales = [pedido('1', null, { total: 40 })];
    const otroDiaPagado = pedido('3', MANANA, { total: 29, pago_estado: 'PAGADO' });
    const delDia = resumirDia(filasDePedidos(separarProgramadosOtrosDias([...normales, otroDiaPagado], AHORA).normales));
    expect(delDia.ventas).toBe(40);
    expect(delDia.total).toBe(1);
  });

  it('cuando llega su día sí cuenta como del día', () => {
    const hoy = pedido('2', HOY_NOCHE, { total: 29, pago_estado: 'PAGADO' });
    const delDia = resumirDia(filasDePedidos(separarProgramadosOtrosDias([hoy], AHORA).normales));
    expect(delDia.total).toBe(1);
    expect(delDia.ventas).toBe(29);
  });
});
