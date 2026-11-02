import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { VistaPreviaMesa } from '../componentes/VistaPreviaMesa';
import type { MesaSalon, ProgresoPedido as Progreso } from '../tipos';

const progreso = (productos: Array<{ lineaId: string; nombre: string; cantidad: number; listas: number; despachadas: number }>): Progreso => ({
  etapa: 'PARCIAL',
  etiqueta: 'Cocina',
  areas: [{ nombre: 'Bebidas', estado: 'PENDIENTE', lineas: productos.length, productos }],
  listasDe: 0,
  totalAreas: 1,
  porcentaje: 0,
  enCamino: false,
});

const mesaCon = (p: Progreso, creadoEn = new Date().toISOString()): MesaSalon =>
  ({
    id: '3',
    pisoId: '1',
    tipo: 'MESA',
    numero: 3,
    nombre: null,
    asientos: 4,
    x: 0,
    y: 0,
    ancho: 1,
    alto: 1,
    activo: true,
    estado: 'OCUPADA',
    pedidoCodigo: 'CP-9',
    mozo: 'Ana',
    reserva: null,
    pedido: {
      id: '9',
      codigo: 'CP-9',
      mozo: 'Ana',
      creadoEn,
      total: 30,
      progreso: p,
      lineas: [{ cantidad: 1, nombre: 'Latte', detalle: '', opciones: ['Leche de soya', 'Grande'] }],
    },
  }) as unknown as MesaSalon;

const render1 = (mesa: MesaSalon, extra: Partial<Parameters<typeof VistaPreviaMesa>[0]> = {}) =>
  render(
    <VistaPreviaMesa mesa={mesa} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} puedeDespachar {...extra} />,
  );

describe('VistaPreviaMesa: producto despachado', () => {
  it('despachado: check verde y «Entregado», sin botón Despachar; el pendiente sí tiene botón', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 },
          { lineaId: '2', nombre: 'Torta', cantidad: 2, listas: 1, despachadas: 0 },
        ]),
      ),
    );

    const bloque = screen.getByTestId('vista-previa-despachar');
    const entregado = within(bloque).getByTestId('vista-previa-entregado');
    expect(entregado).toHaveTextContent('2 × Latte');
    expect(entregado).toHaveTextContent('Entregado');
    expect(entregado.querySelector('svg')).not.toBeNull();
    expect(entregado.style.opacity).toBe('0.6');
    expect(within(entregado).queryByRole('button')).toBeNull();

    expect(screen.getByRole('button', { name: 'Despachar 1 de Torta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Despachar 2 de Latte/ })).toBeNull();
  });

  it('«Despachar todo lo listo» oculto si no hay unidades por despachar', () => {
    render1(mesaCon(progreso([{ lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 }])));

    expect(screen.queryByRole('button', { name: 'Despachar todo lo listo' })).toBeNull();
    expect(screen.queryByText('No hay unidades listas por despachar')).toBeNull();
  });

  it('con todo entregado el bloque dice «Todo entregado» con check, y no hay botón de despacho', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 },
          { lineaId: '2', nombre: 'Torta', cantidad: 1, listas: 1, despachadas: 1 },
        ]),
      ),
    );

    const bloque = screen.getByTestId('vista-previa-despachar');
    expect(within(bloque).getByText('Todo entregado')).toBeInTheDocument();
    expect(within(bloque).queryByText('Listo para entregar')).toBeNull();
    expect(within(bloque).getAllByTestId('vista-previa-entregado')).toHaveLength(2);
    expect(within(bloque).queryByRole('button')).toBeNull();
  });

  it('con algo sin despachar el bloque sigue en «Listo para entregar» y muestra «Despachar todo lo listo»', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 },
          { lineaId: '2', nombre: 'Torta', cantidad: 2, listas: 1, despachadas: 0 },
        ]),
      ),
    );

    const bloque = screen.getByTestId('vista-previa-despachar');
    expect(within(bloque).getByText('Listo para entregar')).toBeInTheDocument();
    expect(within(bloque).queryByText('Todo entregado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Despachar todo lo listo' })).toBeInTheDocument();
  });
});

describe('VistaPreviaMesa: tiempo y cuenta', () => {
  it('muestra el tiempo legible del pedido, no los minutos crudos', () => {
    const hace3Dias = new Date(Date.now() - 3 * 1440 * 60000).toISOString();
    render1(mesaCon(progreso([]), hace3Dias));

    expect(screen.getByText(/Pidió hace 3 días/)).toBeInTheDocument();
    expect(screen.queryByText(/minutos/)).toBeNull();
  });

  it('muestra «Pidió hace 25 min» para un pedido reciente', () => {
    const hace25 = new Date(Date.now() - 25 * 60000).toISOString();
    render1(mesaCon(progreso([]), hace25));

    expect(screen.getByText(/Pidió hace 25 min/)).toBeInTheDocument();
  });

  it('el botón dice «Ver cuenta y cobrar» y abre la cuenta de la mesa', () => {
    const alAbrirCuenta = vi.fn();
    render1(mesaCon(progreso([])), { alAbrirCuenta });

    const boton = screen.getByRole('button', { name: 'Ver cuenta y cobrar' });
    fireEvent.click(boton);
    expect(alAbrirCuenta).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Abrir cuenta' })).toBeNull();
  });
});
