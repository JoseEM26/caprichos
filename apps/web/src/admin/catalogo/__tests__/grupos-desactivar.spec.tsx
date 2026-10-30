import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListasCategoriasView } from '../ListasCategoriasView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

const grupo = (id: string, nombre: string, activo: boolean) => ({
  id, nombre, activo, productosCount: 27, categoriaIds: [], opciones: [],
});

describe('Grupos de opciones: desactivar / activar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([
      grupo('1', 'Shots de espresso extra', true),
      grupo('2', 'Extras (opcional)', false),
    ]);
  });

  async function abrir() {
    render(<MemoryRouter><ListasCategoriasView /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Dónde se pregunta cada grupo'));
  }

  it('desactiva con confirmación Sí/No y filtra', async () => {
    const patch = vi.spyOn(catalogoApi, 'actualizarGrupo').mockResolvedValue({ id: '1', nombre: '', activo: false, opciones: [] });
    await abrir();
    expect(await screen.findByText('Shots de espresso extra')).toBeInTheDocument();
    expect(screen.queryByText('Extras (opcional)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar grupo' }));
    expect(screen.getByText(/Dejará de mostrarse en 27 productos de la carta, el bot y el mozo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('1', { activo: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Desactivados' }));
    expect(await screen.findByText('Extras (opcional)')).toBeInTheDocument();
    expect(screen.getAllByText('Desactivado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Activar grupo' }).length).toBeGreaterThanOrEqual(1);
  });
});
