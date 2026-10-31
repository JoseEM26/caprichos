import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PantallasView } from '../PantallasView';
import * as api from '../pantallasApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

describe('PantallasView (/admin/pantallas)', () => {
  const pantallasMock = {
    total: 2,
    pantallas: [
      {
        id: '1',
        nombre: 'TV cocina',
        estacion: 'Cocina y barra',
        areaId: '1',
        ultimaConexion: 'Hoy 21:34',
        llave: 'Termina en ...4QX9',
        estado: 'Activa' as const,
        activo: true,
        codigoVinculo: null,
        creadoEn: '2026-10-15T20:00:00Z',
      },
      {
        id: '2',
        nombre: 'TV barra',
        estacion: 'Solo barra',
        areaId: '2',
        ultimaConexion: 'Hoy 21:33',
        llave: 'Termina en ...8KL2',
        estado: 'Activa' as const,
        activo: true,
        codigoVinculo: null,
        creadoEn: '2026-10-15T20:00:00Z',
      },
    ],
    estaciones: ['Cocina y barra', 'Solo barra', 'Solo cocina'],
  };

  const areasMock = [
    { id: '1', nombre: 'Cocina y barra' },
    { id: '2', nombre: 'Solo barra' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarPantallas').mockResolvedValue(pantallasMock);
    vi.spyOn(api, 'listarAreasPantalla').mockResolvedValue(areasMock);
    vi.spyOn(api, 'vincularPantalla').mockResolvedValue({
      ok: true,
      mensaje: 'Pantalla vinculada con el código K7M-4QX. El código ya no sirve. Aparecerá en la lista cuando la TV se conecte.',
    });
    vi.spyOn(api, 'desactivarPantalla').mockResolvedValue({ ok: true, activo: false });
    vi.spyOn(api, 'activarPantalla').mockResolvedValue({ ok: true, activo: true });
    vi.spyOn(api, 'editarPantalla').mockResolvedValue({ ok: true });
  });

  it('1. Renderiza lista de pantallas con tarjetas, estación y llave', async () => {
    render(<PantallasView />);
    await waitFor(() => {
      expect(screen.getByText('TV cocina')).toBeInTheDocument();
      expect(screen.getByText('TV barra')).toBeInTheDocument();
      expect(screen.getByText('Termina en ...4QX9')).toBeInTheDocument();
      expect(screen.getByText('2 resultados')).toBeInTheDocument();
    });
  });

  it('5. el filtro de estación es un combo dentro de Filtros y pide la lista de esa estación', async () => {
    render(<PantallasView />);
    await screen.findByText('TV cocina');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Estación: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Solo barra' }));

    expect(screen.getByRole('button', { name: 'Estación: Solo barra' })).toBeInTheDocument();
    await waitFor(() => expect(api.listarPantallas).toHaveBeenLastCalledWith('', 'Solo barra'));
  });

  it('2. Permite desactivar una pantalla con diálogo de confirmación Sí/No', async () => {
    render(<PantallasView />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Desactivar' }).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sí, desactivar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, desactivar' }));

    await waitFor(() => {
      expect(api.desactivarPantalla).toHaveBeenCalledWith('1');
    });
  });

  it('3. Valida código corto y vincula pantalla con confirmación', async () => {
    render(<PantallasView />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ejemplo: K7M-4QX')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Ejemplo: K7M-4QX');
    const vincularBtn = screen.getByRole('button', { name: 'Vincular pantalla' });

    // Código corto
    fireEvent.change(input, { target: { value: 'ABC' } });
    fireEvent.click(vincularBtn);

    expect(
      screen.getByText('Escribe el código completo que aparece en la TV (6 caracteres).'),
    ).toBeInTheDocument();

    // Código completo
    fireEvent.change(input, { target: { value: 'K7M-4QX' } });
    fireEvent.click(vincularBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sí, vincular' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, vincular' }));

    await waitFor(() => {
      expect(api.vincularPantalla).toHaveBeenCalledWith({ codigo: 'K7M-4QX' });
    });
  });

  it('4. Abre modal de edición y permite guardar cambios', async () => {
    render(<PantallasView />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Editar pantalla' })).toBeInTheDocument();
    });

    const inputNombre = screen.getByDisplayValue('TV cocina');
    fireEvent.change(inputNombre, { target: { value: 'TV Cocina Central' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(api.editarPantalla).toHaveBeenCalledWith('1', {
        nombre: 'TV Cocina Central',
        areaId: '1',
      });
    });
  });
});
