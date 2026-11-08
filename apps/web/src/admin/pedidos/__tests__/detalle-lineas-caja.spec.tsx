import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { CapaProductos } from '../CapaProductos';
import { itemsCaja, textoDetalle, contraste, COLOR_DETALLE } from '../detalleCaja';
import { detalleLinea } from '../../cocina/DespachoView';
import type { Pedido, LineaPedido } from '../pedidosApi';

const bebida = {
  id: '1', cantidad: 1, nombre: 'FRAPPE OREO', tamano: 'Grande 16 oz', precio_unit: 18, subtotal: 18,
  opcionesElegidas: [{ opcion_nombre: 'Leche entera' }, { opcion_nombre: 'Azúcar' }], nombres_persona: ['Luis'], nota: 'sin hielo',
} as unknown as LineaPedido;
const donas = { id: '2', cantidad: 2, nombre: 'Dona', sabores: [{ sabor_nombre: 'Fresa', cantidad: 1 }, { sabor_nombre: 'Manjar', cantidad: 1 }], precio_unit: 5, subtotal: 10 } as unknown as LineaPedido;
const combo = { id: '3', cantidad: 1, nombre: 'DÚO COMPARTIR', precio_unit: 30, subtotal: 30 } as unknown as LineaPedido;
const hijaBebida = { id: '4', linea_combo_id: '3', cantidad: 1, nombre: 'Frappe Oreo', tamano: 'Regular 12 oz', opcionesElegidas: [{ nombre: 'Leche entera' }], precio_unit: 0, subtotal: 0 } as unknown as LineaPedido;
const hijaDonas = { id: '5', linea_combo_id: '3', cantidad: 2, nombre: 'Donas', sabores: [{ nombre: 'Fresa', cantidad: 1 }, { nombre: 'Manjar', cantidad: 1 }], precio_unit: 0, subtotal: 0 } as unknown as LineaPedido;
const simple = { id: '6', cantidad: 1, nombre: 'Carrot cake', tamano: null, opciones: [], nombres_persona: null, nota: null, precio_unit: 9, subtotal: 9 } as unknown as LineaPedido;

const pedido = (lineas: LineaPedido[]) =>
  ({ id: '1', codigo: 'CP-1', canal: 'CARTA', modalidad: 'LOCAL', estado: 'COLA', total: 25, cliente_nombre: 'Ana', pago_estado: 'PENDIENTE', creado_en: '2026-11-07T15:00:00Z', lineas }) as unknown as Pedido;

const tarjeta = (lineas: LineaPedido[]) =>
  render(<TarjetaPedidoCaja pedido={pedido(lineas)} seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} ahora={Date.parse('2026-11-07T15:12:00Z')} />);

describe('detalle de líneas en Caja', () => {
  it('bebida: tamaño, leche, azúcar y para quién en una línea; cantidad con el nombre', () => {
    tarjeta([bebida]);
    expect(screen.getByText('1× FRAPPE OREO')).toBeInTheDocument();
    expect(screen.getByTestId('producto-detalle')).toHaveTextContent('Grande 16 oz · Leche entera · Azúcar · Para Luis');
  });

  it('donas con sabores y cantidades', () => {
    tarjeta([donas]);
    expect(screen.getByTestId('producto-detalle')).toHaveTextContent('1 Fresa · 1 Manjar');
  });

  it('combo: las partes salen con su detalle y no como productos aparte', () => {
    tarjeta([combo, hijaBebida, hijaDonas]);
    expect(screen.getAllByTestId('producto-tarjeta')).toHaveLength(1);
    const partes = screen.getAllByTestId('producto-parte').map((e) => e.textContent);
    expect(partes).toEqual(['→ Frappe Oreo · Regular 12 oz · Leche entera', '→ Donas · 1 Fresa · 1 Manjar']);
  });

  it('línea con nota y línea sin detalle (sin huecos ni undefined)', () => {
    const { container } = tarjeta([bebida, simple]);
    expect(screen.getByText('Nota: sin hielo')).toBeInTheDocument();
    expect(screen.getAllByTestId('producto-detalle')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/undefined|null/);
  });

  it('límite: 4 visibles y «+N más»', () => {
    const l = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `x${i}`, cantidad: 1, nombre: `P${i}` }) as unknown as LineaPedido);
    tarjeta(l);
    expect(screen.getAllByTestId('producto-tarjeta')).toHaveLength(4);
    expect(screen.getByText(/\+2 más/)).toBeInTheDocument();
  });

  it('capa Productos: detalle completo, sabores, nota y partes anidadas', () => {
    render(<CapaProductos pedido={pedido([combo, hijaBebida, hijaDonas, bebida])} puedeDarCortesia={false} alCortesia={vi.fn()} />);
    expect(screen.getAllByTestId('linea-pedido')).toHaveLength(2);
    const partes = screen.getAllByTestId('parte-combo');
    expect(within(partes[0]).getByTestId('linea-detalle')).toHaveTextContent('Regular 12 oz · Leche entera');
    expect(within(partes[1]).getByTestId('linea-sabores')).toHaveTextContent('1 Fresa · 1 Manjar');
    expect(screen.getByTestId('linea-nota')).toHaveTextContent('Nota: sin hielo');
  });

  it('Caja y Despacho dicen lo mismo para la misma línea', () => {
    const [it] = itemsCaja([bebida]);
    const comanda = { id: '1', nombre: 'x', cantidad: 1, tamano: 'Grande 16 oz', opciones: ['Leche entera', 'Azúcar'], personas: ['Luis'] };
    expect(it.detalle).toBe(detalleLinea(comanda).join(' · '));
    expect(textoDetalle(it)).toBe(it.detalle);
  });

  it('contraste AA de los textos nuevos sobre el fondo claro de la tarjeta', () => {
    for (const c of Object.values(COLOR_DETALLE)) expect(contraste(c, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});
