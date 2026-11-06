import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

const CATS = [
  { id: 'c1', nombre: 'Bebidas', areaId: 'a', orden: 1, oculta: false, llevaOpciones: true },
  { id: 'c2', nombre: 'Postres', areaId: 'a', orden: 2, oculta: false, llevaOpciones: false },
];
const LISTAS = [
  { id: 'l1', codigo: 'TAMANO', nombre: 'Tamaños', valores: [{ id: 'v1', nombre: 'Regular 12 oz', orden: 1, activo: true }] },
];

async function abrirNuevo() {
  render(<MemoryRouter><ProductosView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /\+ Nuevo producto/i }));
  return screen.findByRole('dialog', { name: 'Nuevo producto' });
}

describe('Nuevo producto: ¿Cómo se vende?', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombreUsuario: 'admin', nombres: 'A', rol: 'ADMIN' } as any,
      tiene: () => true,
    } as any);
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue(CATS as any);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([]);
  });

  it('categoría con llevaOpciones preselecciona tamaños; sin ella, un solo precio (sin editor)', async () => {
    const d = await abrirNuevo();
    expect(within(d).getByRole('button', { name: /Con tamaños y opciones/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(d).getByRole('button', { name: 'Postres' }));
    expect(within(d).getByRole('button', { name: /Un solo precio/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).queryByText('Agregar tamaño')).not.toBeInTheDocument();
    expect(within(d).getByPlaceholderText('0.00')).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: /Con tamaños y opciones/ }));
    expect(await within(d).findByText('Agregar tamaño')).toBeInTheDocument();
  });

  it('con tamaños exige al menos uno activo', async () => {
    const d = await abrirNuevo();
    fireEvent.change(within(d).getByPlaceholderText(/BROWNIE/), { target: { value: 'cafe' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Agregar a la carta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(/al menos un tamaño activo/);
  });

  it('guarda enviando tamanos y grupos, y la vista previa recibe el borrador', async () => {
    const crear = vi.spyOn(catalogoApi, 'crearProducto').mockResolvedValue({} as any);
    const d = await abrirNuevo();
    fireEvent.change(within(d).getByPlaceholderText(/BROWNIE/), { target: { value: 'cafe' } });
    fireEvent.click(await within(d).findByText('Agregar tamaño'));
    const sel = await waitFor(() => {
      const s = d.querySelector('select.eo-input') as HTMLSelectElement;
      expect(s.options.length).toBeGreaterThan(1);
      return s;
    });
    fireEvent.change(sel, { target: { value: 'v1' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Agregar a este producto' }));

    fireEvent.click(within(d).getByRole('button', { name: 'Ver cómo se ve en la carta' }));
    expect(await screen.findByText('Vista previa de tus cambios sin guardar')).toBeInTheDocument();
    expect((await screen.findAllByText(/Regular 12 oz/)).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/CAFE/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));

    fireEvent.click(within(d).getByRole('button', { name: 'Agregar a la carta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    const arg = crear.mock.calls[0][0];
    expect(arg.nombre).toBe('CAFE');
    expect(arg.tamanos).toEqual([{ tamanoValorId: 'v1', precio: 0, activo: true, unidades: 1 }]);
    expect(arg.grupos).toEqual([]);
  });
});
