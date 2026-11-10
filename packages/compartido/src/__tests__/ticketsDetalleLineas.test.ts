import { describe, it, expect } from 'vitest';
import { lineasTicketPago } from '../etiquetas/ticketPago.js';
import { lineasTicketComandaSalon } from '../etiquetas/ticketComanda.js';
import { entradaDeLineaPedido } from '../etiquetas/detalleLinea.js';
import type { TicketComandaSalonDatos, TicketPagoDatos } from '../tipos/etiquetas.js';

const frappe = {
  id: 1, cantidad: 1, nombre: 'Frappé Oreo', tamano: 'Regular 12 oz', precio_unit: 14, subtotal: 14,
  opcionesElegidas: [
    { grupo_nombre: 'Leche', opcion_nombre: 'Deslactosada', precio_extra: 2 },
    { grupo_nombre: 'Endulzante', opcion_nombre: 'Stevia', precio_extra: 0 },
  ],
  nombres_persona: ['Ana'], nota: 'poco hielo',
};
const duo = { id: 2, cantidad: 1, nombre: 'Dúo Cafetero', tamano: null, precio_unit: 30, subtotal: 30, es_cortesia: false };
const parteBebida = (n: number, sabor?: string) => ({
  id: 10 + n, linea_combo_id: 2, cantidad: 1, nombre: 'Latte Coffe', tamano: 'Regular 12 oz', precio_unit: 0, subtotal: 0,
  nombres_persona: [n === 1 ? 'Ana' : 'Luis'], sabores: sabor ? [{ sabor_nombre: sabor, cantidad: 1 }] : [],
});
const donas = {
  id: 3, cantidad: 1, nombre: 'Dona', tamano: 'Caja x4', precio_unit: 20, subtotal: 20,
  sabores: [{ sabor_nombre: 'Fresa', cantidad: 2 }, { sabor_nombre: 'Oreo', cantidad: 1 }, { sabor_nombre: 'Manjar', cantidad: 1 }],
};
const carrot = { id: 4, cantidad: 1, nombre: 'Carrot cake', tamano: 'Entero clásico', precio_unit: 60, subtotal: 60 };
const sinTamano = { id: 5, cantidad: 2, nombre: 'Agua', tamano: null, precio_unit: 3, subtotal: 6 };
const largo = { id: 6, cantidad: 1, nombre: 'Sandwich de pollo deshilachado con palta y mayonesa casera especial', tamano: 'Grande', precio_unit: 20, subtotal: 20 };

const todas = [frappe, duo, parteBebida(1, 'Vainilla'), parteBebida(2), donas, carrot, sinTamano, largo];
const madres = todas.filter((l: any) => l.linea_combo_id == null);

const ticket = (): TicketPagoDatos => ({
  local: { nombre: 'Caprichos' }, codigo: 'CP-90', fecha: '08/11/2026', hora: '10:00', who: 'Ana', modalidad: 'MESA',
  lineas: madres.map((l) => entradaDeLineaPedido(l, todas)), total: 153, pagos: [],
});

describe('ticket de pago: tamaño, sabores, opciones, «Para» y nota en cada línea', () => {
  for (const cols of [48, 32]) {
    it(`${cols} columnas: nada pasa del ancho y no se parten palabras`, () => {
      const lineas = lineasTicketPago(ticket(), cols).map((l) => l.texto);
      for (const t of lineas) expect(t.length, t).toBeLessThanOrEqual(cols);
      const todo = lineas.join(' ');
      for (const palabra of ['deshilachado', 'mayonesa', 'especial']) expect(todo).toContain(palabra);
    });
  }

  it('Frappé: tamaño, leche con su extra, endulzante, para quién y nota', () => {
    const t = lineasTicketPago(ticket(), 48).map((l) => l.texto).join('\n');
    expect(t).toContain('1 x Frappé Oreo (Regular 12 oz)');
    expect(t).toContain('Leche: Deslactosada (+S/ 2.00)');
    expect(t).toContain('Endulzante: Stevia');
    expect(t).toContain('Para: Ana');
    expect(t).toContain('Nota: poco hielo');
  });

  it('Dúo: cada bebida hija con su tamaño heredado, su persona y su sabor, sin duplicar', () => {
    const t = lineasTicketPago(ticket(), 48).map((l) => l.texto).join('\n');
    expect(t.match(/Dúo Cafetero/g)).toHaveLength(1);
    expect(t.match(/- 1 x Latte Coffe \(Regular 12 oz\)/g)).toHaveLength(2);
    expect(t).toContain('Sabores: 1 Vainilla');
    expect(t).toContain('Para: Luis');
  });

  it('caja de 4 donas con sus sabores, carrot cake entero clásico', () => {
    const t = lineasTicketPago(ticket(), 48).map((l) => l.texto).join('\n');
    expect(t).toContain('Dona (Caja x4)');
    expect(t).toContain('Sabores: 2 Fresa · 1 Oreo · 1 Manjar');
    expect(t).toContain('Carrot cake (Entero clásico)');
  });

  it('producto sin tamaño no imprime paréntesis ni guion vacío', () => {
    const t = lineasTicketPago(ticket(), 48).map((l) => l.texto);
    const agua = t.find((x) => x.includes('2 x Agua'))!;
    expect(agua).not.toContain('(');
    expect(agua).not.toMatch(/-\s*$/);
  });
});

const comanda = (): TicketComandaSalonDatos => ({
  codigo: 'CP-90', mesa: '4', cliente: 'Ana', canal: 'Mozo', fecha: '08/11/2026', hora: '10:00',
  lineas: [
    { cantidad: 1, nombre: 'Frappé Oreo', tamano: 'Regular 12 oz', opciones: ['Deslactosada', 'Stevia'], nota: 'poco hielo',
      detalles: ['Leche: Deslactosada (+S/ 2.00)', 'Endulzante: Stevia', 'Para: Ana', 'Nota: poco hielo'] },
    { cantidad: 1, nombre: 'Dúo Cafetero', tamano: null, opciones: [], detalles: [],
      partes: [
        { cantidad: 1, nombre: 'Latte Coffe', tamano: 'Regular 12 oz', opciones: [], detalles: ['Sabor: Vainilla', 'Para: Ana'] },
        { cantidad: 1, nombre: 'Latte Coffe', tamano: 'Regular 12 oz', opciones: [], detalles: ['Para: Luis'] },
      ] },
    { cantidad: 1, nombre: 'Sandwich de pollo deshilachado con palta y mayonesa casera especial', tamano: 'Grande', opciones: [] },
    { cantidad: 2, nombre: 'Agua', tamano: null, opciones: [] },
  ],
});

describe('comanda de cocina: tamaño, detalle y piezas de combo', () => {
  it('imprime tamaño y todo el detalle de la línea, y las piezas del combo con su tamaño', () => {
    const t = lineasTicketComandaSalon(comanda(), 48).map((l) => l.texto).join('\n');
    expect(t).toContain('1 x Frappé Oreo');
    expect(t).toContain('  Tamaño: Regular 12 oz');
    expect(t).toContain('  Leche: Deslactosada (+S/ 2.00)');
    expect(t).toContain('  Para: Ana');
    expect(t.match(/ {2}- 1 x Latte Coffe/g)).toHaveLength(2);
    expect(t.match(/ {6}Tamaño: Regular 12 oz/g)).toHaveLength(2);
    expect(t).toContain('      Sabor: Vainilla');
  });

  it('sin tamaño no imprime «Tamaño:»; nombres largos parten en líneas con sangría y ancho 32', () => {
    const lineas = lineasTicketComandaSalon(comanda(), 32).map((l) => l.texto);
    for (const x of lineas) expect(x.length, x).toBeLessThanOrEqual(32);
    const agua = lineas.findIndex((x) => x.includes('2 x Agua'));
    expect(lineas[agua + 1]).not.toContain('Tamaño');
    expect(lineas.join(' ')).toContain('deshilachado');
  });

  it('un .exe viejo (línea sin detalles) imprime igual que antes: opciones y nota', () => {
    const t = lineasTicketComandaSalon(
      { ...comanda(), lineas: [{ cantidad: 1, nombre: 'Café', tamano: '8 oz', opciones: ['Sin azúcar'], nota: 'caliente' }] },
      48,
    ).map((l) => l.texto);
    expect(t).toContain('  Tamaño: 8 oz');
    expect(t).toContain('  - Sin azúcar');
    expect(t).toContain('  NOTA: caliente');
  });
});
