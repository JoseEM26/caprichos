import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListasCategoriasView } from '../ListasCategoriasView';
import * as sesionModulo from '../../../comun/sesion';
import * as cocinaApi from '../../cocina/cocinaApi';
import { catalogoApi } from '../catalogoApi';

const cat = { id: '7', nombre: 'Postres', areaId: '1', areaNombre: 'Cocina', orden: 1, oculta: false, llevaOpciones: false };

describe('Categoría: área de cocina', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue([cat]);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Cocina' },
      { id: '2', nombre: 'Postres y bebidas' },
    ]);
  });

  it('muestra el área y permite cambiarla al editar', async () => {
    const patch = vi
      .spyOn(catalogoApi, 'actualizarCategoria')
      .mockResolvedValue({ ...cat, areaId: '2', areaNombre: 'Postres y bebidas' });
    render(<MemoryRouter><ListasCategoriasView /></MemoryRouter>);
    expect(await screen.findByText(/Cocina: Cocina/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Editar nombre de Postres/ }));
    const sel = await screen.findAllByLabelText(/Área de cocina donde se prepara/);
    fireEvent.change(sel[sel.length - 1], { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('7', { nombre: 'Postres', areaId: '2' }));
    expect(await screen.findByText(/Cocina: Postres y bebidas/)).toBeInTheDocument();
  });
});
