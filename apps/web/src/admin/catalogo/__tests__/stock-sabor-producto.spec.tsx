import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

const CATS = [{ id: 'c2', nombre: 'Postres', areaId: 'a', orden: 2, oculta: false, llevaOpciones: true }];

const TAMANOS_DONA = [
  { id: 't1', tamanoValorId: 'v1', nombre: 'Unidad', precio: 2, activo: true, unidades: 1 },
  { id: 't2', tamanoValorId: 'v2', nombre: '1/2 docena', precio: 10, activo: true, unidades: 6 },
  { id: 't3', tamanoValorId: 'v3', nombre: 'Docena', precio: 20, activo: true, unidades: 12 },
];

const SABORES_DONA = [
  { id: 's1', nombre: 'Chocolate', activo: true, disponible: true, quedan: 4 },
  { id: 's2', nombre: 'Vainilla', activo: false, disponible: false, quedan: null },
];

function producto(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    categoriaId: 'c2',
    categoria: { id: 'c2', nombre: 'Postres' },
    nombre: 'DONA DE CHOCOLATE',
    descripcion: '',
    precio: 2,
    orden: 1,
    oculto: false,
    disponible: true,
    agotadoHasta: null,
    noSumaBeneficios: false,
    controlaStock: true,
    fotoUrl: null,
    tamanos: [],
    grupos: [],
    sabores: [],
    ...over,
  };
}

const NOTA_APERTURA = 'El stock de cada sabor se registra en «Apertura del día» (Almacén), no aquí.';

describe('Productos: stock por sabor (tarjeta y modal de sabores)', () => {
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

  it('la tarjeta muestra los tamaños con sus unidades y la insignia «Stock por sabor»', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([
      producto({ tamanos: TAMANOS_DONA, sabores: SABORES_DONA }),
    ] as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    expect(await screen.findByText('DONA DE CHOCOLATE')).toBeInTheDocument();
    expect(screen.getByText('Unidad · 1/2 docena (6) · Docena (12)')).toBeInTheDocument();
    expect(screen.getByText('Stock por sabor')).toBeInTheDocument();
    expect(screen.queryByText('Con stock')).toBeNull();
  });

  it('un producto con stock pero sin sabores mantiene la insignia «Con stock» y no muestra tamaños si no tiene', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([producto()] as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    expect(await screen.findByText('DONA DE CHOCOLATE')).toBeInTheDocument();
    expect(screen.getByText('Con stock')).toBeInTheDocument();
    expect(screen.queryByText('Stock por sabor')).toBeNull();
    expect(screen.queryByText('TAMAÑOS (UNIDADES)')).toBeNull();
  });

  it('en Sabores o variantes muestra Quedan N o Sin apertura hoy y Disponible/Agotado, con la nota de Apertura del día', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([
      producto({ tamanos: TAMANOS_DONA, sabores: SABORES_DONA }),
    ] as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    const d = await screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
    fireEvent.click(within(d).getByRole('tab', { name: /Stock y sabores/ }));

    expect(within(d).getByText('Quedan 4')).toBeInTheDocument();
    expect(within(d).getByText('Sin apertura hoy')).toBeInTheDocument();
    expect(within(d).getByRole('status')).toHaveTextContent('Sin apertura de hoy: cárgala en Apertura del día');
    expect(within(d).getByRole('link', { name: 'Apertura del día' })).toHaveAttribute('href', '/admin/apertura');
    expect(within(d).getByRole('button', { name: /Chocolate: disponible/ })).toHaveTextContent('Disponible');
    expect(within(d).getByRole('button', { name: /Vainilla: agotado/ })).toHaveTextContent('Agotado');
    expect(within(d).getByText(NOTA_APERTURA)).toBeInTheDocument();
  });

  it('sin «Controlar stock» no muestra cantidades ni la nota de apertura', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([
      producto({ controlaStock: false, sabores: SABORES_DONA }),
    ] as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    const d = await screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
    fireEvent.click(within(d).getByRole('tab', { name: /Stock y sabores/ }));
    expect(within(d).getByText('Chocolate')).toBeInTheDocument();
    expect(within(d).queryByText(/Quedan \d+/)).toBeNull();
    expect(within(d).queryByText('Sin apertura hoy')).toBeNull();
    expect(within(d).queryByText(NOTA_APERTURA)).toBeNull();
  });

  it('marcar un sabor como Agotado o Disponible se guarda en sabores con su id', async () => {
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([
      producto({ tamanos: TAMANOS_DONA, sabores: SABORES_DONA }),
    ] as any);
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    const d = await screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
    fireEvent.click(within(d).getByRole('tab', { name: /Stock y sabores/ }));

    fireEvent.click(within(d).getByRole('button', { name: /Vainilla: agotado/ }));
    expect(within(d).getByRole('button', { name: /Vainilla: disponible/ })).toHaveTextContent('Disponible');
    fireEvent.click(within(d).getByRole('button', { name: /Chocolate: disponible/ }));

    fireEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));
    await waitFor(() =>
      expect(editar).toHaveBeenCalledWith('p1', expect.objectContaining({
        sabores: [
          { id: 's1', nombre: 'Chocolate', activo: false },
          { id: 's2', nombre: 'Vainilla', activo: true },
        ],
      })),
    );
  });
});
