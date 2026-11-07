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

const CHECK = /Controlar stock de este producto/;

function producto(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    categoriaId: 'c2',
    categoria: { id: 'c2', nombre: 'Postres' },
    nombre: 'DONA DE CHOCOLATE',
    descripcion: '',
    precio: 4,
    orden: 1,
    oculto: false,
    disponible: true,
    agotadoHasta: null,
    noSumaBeneficios: false,
    controlaStock: false,
    fotoUrl: null,
    tamanos: [],
    grupos: [],
    sabores: [],
    ...over,
  };
}

describe('Productos: casilla «Controlar stock de este producto»', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombreUsuario: 'admin', nombres: 'A', rol: 'ADMIN' } as any,
      tiene: () => true,
    } as any);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue(CATS as any);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([] as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([] as any);
  });

  it('en Nuevo producto se envía controlaStock al crear', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([]);
    const crear = vi.spyOn(catalogoApi, 'crearProducto').mockResolvedValue({} as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /\+ Nuevo producto/i }));
    const d = await screen.findByRole('dialog', { name: 'Nuevo producto' });

    const casilla = within(d).getByRole('checkbox', { name: CHECK });
    expect(casilla).not.toBeChecked();
    fireEvent.click(within(d).getByRole('button', { name: 'Postres' }));
    fireEvent.change(within(d).getByPlaceholderText(/BROWNIE/), { target: { value: 'dona' } });
    fireEvent.change(within(d).getByPlaceholderText('0.00'), { target: { value: '4' } });
    fireEvent.click(casilla);
    fireEvent.click(within(d).getByRole('button', { name: 'Agregar a la carta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));

    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ controlaStock: true })));
  });

  it('en Editar la casilla refleja el producto y se guarda con el resto', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([producto()] as any);
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    const d = await screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
    fireEvent.click(within(d).getByRole('tab', { name: /Stock y sabores/ }));

    const casilla = within(d).getByRole('checkbox', { name: CHECK });
    expect(casilla).not.toBeChecked();
    fireEvent.click(casilla);
    fireEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));

    await waitFor(() =>
      expect(editar).toHaveBeenCalledWith(
        'p1',
        { controlaStock: true }, // solo viaja lo que cambió
      ),
    );
  });

  it('un producto que ya controla stock muestra la casilla marcada y la insignia «Con stock»', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([
      producto({ controlaStock: true }),
      producto({ id: 'p2', nombre: 'FLAN', controlaStock: false }),
    ] as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    expect(await screen.findByText('DONA DE CHOCOLATE')).toBeInTheDocument();
    expect(screen.getAllByText('Con stock')).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    const d = await screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
    fireEvent.click(within(d).getByRole('tab', { name: /Stock y sabores/ }));
    expect(within(d).getByRole('checkbox', { name: CHECK })).toBeChecked();
  });
});
