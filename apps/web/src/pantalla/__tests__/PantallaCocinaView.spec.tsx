import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PantallaCocinaView } from '../PantallaCocinaView';
import * as cocinaApi from '../../admin/cocina/cocinaApi';
import * as socketModule from '../../comun/socket';

describe('PantallaCocinaView - TV de Cocina', () => {
  const comandaBase = {
    id: '1-1',
    pedidoId: '1',
    areaId: '1',
    areaNombre: 'Barra',
    ticket: 'CP-101',
    codigo: 'CP-101',
    canal: 'Web',
    modalidad: 'LLEVAR',
    minutos: 5,
    minutosEspera: 5,
    color: 'VERDE' as const,
    creado_en: '2026-10-22T12:00:00Z',
    lineas: [
      {
        id: '10',
        nombre: 'Frappe Oreo',
        cantidad: 2,
        tamano: 'Regular 12 oz',
        sabor: null,
        area: 'bebidas',
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina');

    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Barra' },
      { id: '2', nombre: 'Cocina' },
      { id: '3', nombre: 'Postres' },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([comandaBase]);

    vi.spyOn(socketModule, 'conectarSocket').mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
    } as any);
  });

  it('1. No renderiza la barra «CONTROLES DE LA MAQUETA»', async () => {
    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('CP-101')).toBeInTheDocument();
    });

    expect(screen.queryByText(/CONTROLES DE LA MAQUETA/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mostrando pedidos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vincular pantalla/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sin conexión/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desvinculada/i })).not.toBeInTheDocument();
  });

  it('2. Sin parámetro de área muestra «COCINA · TODAS LAS ÁREAS» y estación Todas', async () => {
    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('COCINA · TODAS LAS ÁREAS')).toBeInTheDocument();
    });
    expect(screen.getByText(/Estación: Todas · Meta de entrega: 13 min/i)).toBeInTheDocument();
  });

  it('3. Con parámetro ?area=bebidas muestra «ÁREA: BEBIDAS» y estación Bebidas', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?area=bebidas');
    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('ÁREA: BEBIDAS')).toBeInTheDocument();
    });
    expect(screen.getByText(/Estación: Bebidas · Meta de entrega: 13 min/i)).toBeInTheDocument();
  });

  it('4. Con parámetro ?area=postres mapea a Postres', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?area=postres');
    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('ÁREA: POSTRES')).toBeInTheDocument();
    });
    expect(screen.getByText(/Estación: Postres · Meta de entrega: 13 min/i)).toBeInTheDocument();
  });

  it('5. Con parámetro ?area=salados mapea a Salados', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?area=salados');
    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('ÁREA: SALADOS')).toBeInTheDocument();
    });
    expect(screen.getByText(/Estación: Salados · Meta de entrega: 13 min/i)).toBeInTheDocument();
  });

  it('6. Muestra estado «Vincular pantalla» con código cuando se fuerza o requiere vincular', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?modo=pair');
    render(<PantallaCocinaView />);

    expect(screen.getByText('Vincula esta pantalla')).toBeInTheDocument();
    expect(screen.getByText('K7M-4QX')).toBeInTheDocument();
    expect(screen.getByText(/El código vence en 10 minutos/i)).toBeInTheDocument();
  });

  it('7. Muestra estado «Sin conexión» con última actualización', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?modo=off');
    render(<PantallaCocinaView />);

    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(
      screen.getByText(/No se pueden mostrar pedidos nuevos\. Estamos reintentando solos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Última actualización:/i)).toBeInTheDocument();
  });

  it('8. Muestra estado «Pantalla desvinculada»', async () => {
    (window as any).location = new URL('http://localhost:5173/pantalla/cocina?modo=out');
    render(<PantallaCocinaView />);

    expect(screen.getByText('Pantalla desvinculada')).toBeInTheDocument();
    expect(screen.getByText(/El administrador desactivó esta pantalla/i)).toBeInTheDocument();
  });

  it('9. Calcula totales Por preparar, En preparación y Atrasados y leyenda en pie', async () => {
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([
      {
        ...comandaBase,
        ticket: 'CP-001',
        minutos: 4, // azul (<10)
        lineas: [{ id: '1', nombre: 'Cafe', cantidad: 1, area: 'bebidas' }],
      },
      {
        ...comandaBase,
        ticket: 'CP-002',
        minutos: 11, // naranja (10..12)
        lineas: [{ id: '2', nombre: 'Te', cantidad: 1, area: 'bebidas' }],
      },
      {
        ...comandaBase,
        ticket: 'CP-003',
        minutos: 15, // rojo (>=13 atrasado)
        lineas: [{ id: '3', nombre: 'Jugo', cantidad: 1, area: 'bebidas' }],
      },
    ]);

    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('CP-001')).toBeInTheDocument();
      expect(screen.getByText('CP-002')).toBeInTheDocument();
      expect(screen.getByText('CP-003')).toBeInTheDocument();
    });

    // Totales: 3 por preparar, 0 en preparación, 1 atrasado (15 min)
    expect(screen.getByText('Por preparar')).toBeInTheDocument();
    expect(screen.getByText('En preparación')).toBeInTheDocument();
    expect(screen.getByText('Atrasados')).toBeInTheDocument();

    // Leyenda inferior
    expect(
      screen.getByText(/Azul: a tiempo · Naranja: desde 10 min · Rojo: desde 13 min/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pantalla fija: no se toca · Se actualiza sola/i),
    ).toBeInTheDocument();
  });
});
