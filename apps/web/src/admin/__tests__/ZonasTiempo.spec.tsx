import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../comun/api';
import * as sesionModulo from '../../comun/sesion';
import { ZonasRepartoView } from '../configuracion/ZonasRepartoView';
import { etiquetaZona } from '../configuracion/ZonasMapa';

const sesionConZonas = () =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
    permisos: ['zonas/ver', 'zonas/editar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => p.startsWith('zonas/'),
  } as any);

const z3 = { id: '3', codigo: 'Z3', tarifa: 3, activa: true, puntos: 0, poligono: [], minutosMin: 15, minutosMax: 20 };

describe('Minutos de entrega en Zonas de reparto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('la etiqueta del mapa muestra «Z3 · S/ 3.00 · 15–20 min»', () => {
    expect(etiquetaZona(z3 as any)).toBe('Z3 · S/ 3.00 · 15–20 min');
    expect(etiquetaZona({ ...z3, minutosMin: null, minutosMax: null } as any)).toBe('Z3 · S/ 3.00');
  });

  it('la tarjeta muestra el rango de minutos de la zona', async () => {
    sesionConZonas();
    vi.spyOn(api, 'get').mockResolvedValueOnce([z3] as any);
    render(<ZonasRepartoView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lista' }));
    await waitFor(() => expect(screen.getByTestId('minutos-Z3').textContent).toBe('15–20 min'));
  });

  it('editar minutos valida el rango, pide confirmación y envía el PUT /tiempo', async () => {
    sesionConZonas();
    vi.spyOn(api, 'get').mockResolvedValueOnce([z3] as any);
    const put = vi.spyOn(api, 'put').mockResolvedValueOnce({ ...z3, minutosMin: 18, minutosMax: 25 } as any);
    render(<ZonasRepartoView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lista' }));
    await waitFor(() => expect(screen.getByText('Editar minutos')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Editar minutos'));

    const min = screen.getByLabelText('Mínimo (min)') as HTMLInputElement;
    const max = screen.getByLabelText('Máximo (min)') as HTMLInputElement;
    fireEvent.change(min, { target: { value: '30' } });
    fireEvent.change(max, { target: { value: '20' } });
    fireEvent.click(screen.getByText('Continuar'));
    expect(screen.getByRole('alert').textContent).toContain('no puede ser mayor');
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(min, { target: { value: '18' } });
    fireEvent.change(max, { target: { value: '25' } });
    fireEvent.click(screen.getByText('Continuar'));
    fireEvent.click(await screen.findByText('Sí, actualizar minutos'));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/zonas/Z3/tiempo', { minutosMin: 18, minutosMax: 25 }),
    );
  });
});
