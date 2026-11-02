import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { VistaPreviaMesa } from '../componentes/VistaPreviaMesa';
import type { MesaSalon, ProgresoPedido as Progreso } from '../tipos';
import * as cocinaApi from '../../cocina/cocinaApi';

type Linea = { lineaId: string; nombre: string; cantidad: number; listas: number; despachadas: number; area?: string };

const progreso = (productos: Linea[]): Progreso => {
  const porArea = new Map<string, Linea[]>();
  for (const p of productos) {
    const area = p.area ?? 'Barra';
    porArea.set(area, [...(porArea.get(area) ?? []), p]);
  }
  return {
    etapa: 'PARCIAL',
    etiqueta: 'Cocina',
    areas: [...porArea].map(([nombre, prods]) => ({ nombre, estado: 'PENDIENTE', lineas: prods.length, productos: prods })),
    listasDe: 0,
    totalAreas: porArea.size,
    porcentaje: 0,
    enCamino: false,
  };
};

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

const casilla = (nombre: string) => screen.getByRole('checkbox', { name: nombre }) as HTMLInputElement;

describe('VistaPreviaMesa: lista de entrega', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cada producto aparece una sola vez, con su área y su estado', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 0, area: 'Barra' },
          { lineaId: '2', nombre: 'Torta', cantidad: 3, listas: 0, despachadas: 0, area: 'Postres' },
        ]),
      ),
    );

    expect(screen.getAllByText('2 × Latte')).toHaveLength(1);
    expect(screen.getAllByText('3 × Torta')).toHaveLength(1);
    expect(screen.queryByText('Listo para entregar')).toBeNull();
    expect(screen.queryByRole('button', { name: /Despachar/ })).toBeNull();

    const filas = screen.getAllByTestId('vista-previa-fila');
    expect(filas.map((f) => f.getAttribute('data-estado'))).toEqual(['Listo', 'En preparación']);
    expect(within(filas[0]).getByText('Barra')).toBeInTheDocument();
    expect(within(filas[1]).getByText('Postres')).toBeInTheDocument();
  });

  it('estados: parcial en naranja, listo, en preparación y entregado con check y atenuado', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Frappé', cantidad: 3, listas: 2, despachadas: 0 },
          { lineaId: '2', nombre: 'Limonada', cantidad: 1, listas: 1, despachadas: 0 },
          { lineaId: '3', nombre: 'Agua', cantidad: 1, listas: 0, despachadas: 0 },
          { lineaId: '4', nombre: 'Té', cantidad: 2, listas: 2, despachadas: 2 },
        ]),
      ),
    );

    const filas = screen.getAllByTestId('vista-previa-fila');
    expect(filas.map((f) => f.getAttribute('data-estado'))).toEqual([
      '2 de 3 listos',
      'Listo',
      'En preparación',
      'Entregado',
    ]);
    expect(within(filas[0]).getByText('2 de 3 listos').style.color).toBe('var(--cp-orange)');
    expect(within(filas[1]).getByText('Listo').style.color).toBe('rgb(47, 122, 69)');
    const entregado = filas[3];
    expect(entregado.style.opacity).toBe('0.6');
    expect(entregado.querySelector('svg')).not.toBeNull();
    expect(within(entregado).getByText('Entregado')).toBeInTheDocument();
  });

  it('en preparación: casilla deshabilitada con aria-disabled y title «Aún en preparación»', () => {
    render1(mesaCon(progreso([{ lineaId: '3', nombre: 'Agua', cantidad: 1, listas: 0, despachadas: 0 }])));

    const c = casilla('1 × Agua');
    expect(c.disabled).toBe(true);
    expect(c.getAttribute('aria-disabled')).toBe('true');
    expect(c.title).toBe('Aún en preparación');
    expect(c.checked).toBe(false);
    expect(screen.queryByRole('button', { name: /Marcar como entregado/ })).toBeNull();
  });

  it('entregado: la casilla aparece marcada y deshabilitada', () => {
    render1(mesaCon(progreso([{ lineaId: '4', nombre: 'Té', cantidad: 2, listas: 2, despachadas: 2 }])));

    const c = casilla('2 × Té');
    expect(c.checked).toBe(true);
    expect(c.disabled).toBe(true);
    expect(c.getAttribute('aria-disabled')).toBe('true');
  });

  it('marcar casillas solo selecciona: el botón aparece con el contador y no llama al endpoint', () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: false, estado: 'PREPARANDO' });
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 0 },
          { lineaId: '2', nombre: 'Torta', cantidad: 2, listas: 1, despachadas: 0 },
        ]),
      ),
    );

    expect(screen.queryByRole('button', { name: /Marcar como entregado/ })).toBeNull();
    fireEvent.click(casilla('2 × Latte'));
    expect(casilla('2 × Latte').checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Marcar como entregado (1)' })).toBeInTheDocument();

    fireEvent.click(casilla('2 × Torta'));
    expect(screen.getByRole('button', { name: 'Marcar como entregado (2)' })).toBeInTheDocument();
    expect(despachar).not.toHaveBeenCalled();
  });

  it('Sí/No propio: No no despacha; Sí llama al endpoint con las unidades listas sin entregar y refresca', async () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: false, estado: 'PREPARANDO' });
    const alCambiar = vi.fn();
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 3, listas: 2, despachadas: 1 },
          { lineaId: '2', nombre: 'Torta', cantidad: 2, listas: 2, despachadas: 0 },
          { lineaId: '3', nombre: 'Agua', cantidad: 1, listas: 0, despachadas: 0 },
        ]),
      ),
      { alCambiar },
    );

    fireEvent.click(casilla('3 × Latte'));
    fireEvent.click(casilla('2 × Torta'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como entregado (2)' }));

    expect(screen.getByText('¿Marcar 2 productos como entregados en la mesa?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(despachar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como entregado (2)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí' }));
    await waitFor(() =>
      expect(despachar).toHaveBeenCalledWith('9', [
        { lineaId: '1', unidades: 1 },
        { lineaId: '2', unidades: 2 },
      ]),
    );
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Marcar como entregado/ })).toBeNull();
  });

  it('«Seleccionar todo lo listo» marca solo las filas con unidades listas sin entregar', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 },
          { lineaId: '2', nombre: 'Torta', cantidad: 2, listas: 1, despachadas: 0 },
          { lineaId: '3', nombre: 'Agua', cantidad: 1, listas: 0, despachadas: 0 },
        ]),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todo lo listo' }));
    expect(casilla('2 × Torta').checked).toBe(true);
    expect(casilla('1 × Agua').checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Marcar como entregado (1)' })).toBeInTheDocument();
  });

  it('«Seleccionar todo lo listo» no aparece si nada está listo sin entregar', () => {
    render1(mesaCon(progreso([{ lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 }])));

    expect(screen.queryByRole('button', { name: 'Seleccionar todo lo listo' })).toBeNull();
  });

  it('con todo entregado el encabezado dice «Todo entregado» con check', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 2 },
          { lineaId: '2', nombre: 'Torta', cantidad: 1, listas: 1, despachadas: 1 },
        ]),
      ),
    );

    const lista = screen.getByTestId('vista-previa-productos');
    expect(within(lista).getByText('Todo entregado')).toBeInTheDocument();
    expect(within(lista).queryByText('Productos')).toBeNull();
    expect(within(lista).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('sin permiso cocina/despachar la lista se muestra sin casillas ni botón', () => {
    render1(
      mesaCon(
        progreso([
          { lineaId: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 0 },
          { lineaId: '2', nombre: 'Torta', cantidad: 1, listas: 0, despachadas: 0 },
        ]),
      ),
      { puedeDespachar: false },
    );

    expect(screen.getAllByText('2 × Latte')).toHaveLength(1);
    expect(screen.getByText('Listo')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Seleccionar todo lo listo' })).toBeNull();
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
