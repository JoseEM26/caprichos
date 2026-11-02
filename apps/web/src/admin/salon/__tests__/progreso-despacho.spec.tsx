import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgresoPedido } from '../ProgresoPedido';
import { VistaPreviaMesa } from '../componentes/VistaPreviaMesa';
import type { MesaSalon, ProgresoPedido as Progreso } from '../tipos';
import * as cocinaApi from '../../cocina/cocinaApi';

const base: Progreso = {
  etapa: 'PARCIAL',
  etiqueta: 'Cocina: listas Postres, faltan Bebidas',
  areas: [],
  listasDe: 1,
  totalAreas: 2,
  porcentaje: 50,
  enCamino: false,
};

describe('ProgresoPedido: por producto y tiempo estimado', () => {
  it('cada producto muestra su estado: 2 de 3 listos, Listo, En preparación y Despachado', () => {
    const progreso: Progreso = {
      ...base,
      areas: [
        {
          nombre: 'Bebidas',
          estado: 'PENDIENTE',
          lineas: 4,
          productos: [
            { lineaId: '1', nombre: 'Frappé', cantidad: 3, listas: 2, despachadas: 0 },
            { lineaId: '2', nombre: 'Limonada', cantidad: 1, listas: 1, despachadas: 0 },
            { lineaId: '3', nombre: 'Agua', cantidad: 1, listas: 0, despachadas: 0 },
            { lineaId: '4', nombre: 'Té', cantidad: 1, listas: 1, despachadas: 1 },
          ],
        },
      ],
    };
    render(<ProgresoPedido progreso={progreso} modalidad="MESA" variante="completo" />);

    const filas = screen.getAllByTestId('pp-producto').map((li) => li.getAttribute('data-estado'));
    expect(filas).toEqual(['2 de 3 listos', 'Listo', 'En preparación', 'Despachado']);
  });

  it('el resumen «Falta» cuenta solo unidades no listas', () => {
    const progreso: Progreso = {
      ...base,
      areas: [
        {
          nombre: 'Bebidas',
          estado: 'PENDIENTE',
          lineas: 2,
          productos: [
            { nombre: 'Frappé', cantidad: 3, listas: 1, despachadas: 0 },
            { nombre: 'Limonada', cantidad: 2, listas: 2, despachadas: 0 },
          ],
        },
      ],
    };
    render(<ProgresoPedido progreso={progreso} modalidad="MESA" variante="compacto" />);
    expect(screen.getByText('Falta: Bebidas (2 Frappé)')).toBeInTheDocument();
  });

  it('muestra «Listo en ~N min» cuando hay estimado', () => {
    render(<ProgresoPedido progreso={{ ...base, estimadoMin: 6 }} modalidad="MESA" variante="compacto" />);
    expect(screen.getByTestId('pp-estimado')).toHaveTextContent('Listo en ~6 min');
  });

  it('sin estimado no muestra la línea', () => {
    render(<ProgresoPedido progreso={base} modalidad="MESA" variante="compacto" />);
    expect(screen.queryByTestId('pp-estimado')).toBeNull();
  });
});

describe('VistaPreviaMesa: despachar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mesa = {
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
      creadoEn: new Date().toISOString(),
      total: 20,
      progreso: {
        ...base,
        areas: [
          {
            nombre: 'Salados',
            estado: 'PENDIENTE',
            lineas: 1,
            productos: [{ lineaId: '55', nombre: 'Lomo', cantidad: 2, listas: 1, despachadas: 0 }],
          },
        ],
      },
      lineas: [],
    },
  } as unknown as MesaSalon;

  it('despacha la línea lista tras Sí, y sin permiso no muestra el botón', async () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: false, estado: 'PREPARANDO' });
    const alCambiar = vi.fn();
    const { unmount } = render(
      <VistaPreviaMesa mesa={mesa} puedeForzar={false} alCerrar={vi.fn()} alCambiar={alCambiar} puedeDespachar />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Despachar 1 de Lomo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, despachar' }));
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('9', [{ lineaId: '55', unidades: 1 }]));
    expect(alCambiar).toHaveBeenCalled();
    unmount();

    render(<VistaPreviaMesa mesa={mesa} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Despachar todo lo listo' })).toBeNull();
  });

  it('despachar todo lo listo pide Sí o No', async () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: false, estado: 'PREPARANDO' });
    render(<VistaPreviaMesa mesa={mesa} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} puedeDespachar />);

    fireEvent.click(screen.getByRole('button', { name: 'Despachar todo lo listo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(despachar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Despachar todo lo listo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, despachar' }));
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('9', undefined));
  });
});
