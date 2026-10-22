import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import { ListasCategoriasView } from '../ListasCategoriasView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

const CATEGORIAS_MOCK = [
  {
    id: 'cat-1',
    nombre: 'Frappes',
    areaId: 'area-1',
    orden: 1,
    oculta: false,
    llevaOpciones: true,
  },
  {
    id: 'cat-2',
    nombre: 'Donas y Galletas',
    areaId: 'area-2',
    orden: 2,
    oculta: false,
    llevaOpciones: false,
  },
];

const PRODUCTOS_MOCK = [
  {
    id: 'prod-1',
    categoriaId: 'cat-1',
    categoria: { id: 'cat-1', nombre: 'Frappes' },
    nombre: 'Frappe Oreo',
    descripcion: 'Delicioso frappe con galletas Oreo',
    precio: 14.5,
    orden: 1,
    oculto: false,
    disponible: true,
    agotadoHasta: null,
    noSumaBeneficios: false,
    fotoUrl: '/uploads/frappe.jpg',
    tamanos: [
      { id: 'tam-1', tamanoValorId: 'val-tam-1', nombre: '12 oz', precio: 14.5, activo: true },
      { id: 'tam-2', tamanoValorId: 'val-tam-2', nombre: '16 oz', precio: 16.5, activo: true },
    ],
    grupos: [
      {
        id: 'grp-1',
        nombre: 'Tipo de leche',
        opciones: [
          { id: 'opc-1', nombre: 'Entera', precioExtra: 0, activo: true, disponible: true },
          { id: 'opc-2', nombre: 'Deslactosada', precioExtra: 1.5, activo: true, disponible: true },
        ],
      },
    ],
    sabores: [],
  },
  {
    id: 'prod-2',
    categoriaId: 'cat-2',
    categoria: { id: 'cat-2', nombre: 'Donas y Galletas' },
    nombre: 'Caja x6 Donas Artesanales',
    descripcion: 'Elige los sabores que más te gusten',
    precio: 25.0,
    orden: 2,
    oculto: false,
    disponible: false,
    agotadoHasta: null,
    noSumaBeneficios: false,
    fotoUrl: null,
    tamanos: [],
    grupos: [],
    sabores: [
      { id: 'sab-1', nombre: 'Chocolate Glaseado', activo: true, disponible: true },
      { id: 'sab-2', nombre: 'Manjar Blanco', activo: true, disponible: false },
    ],
  },
];

const LISTAS_MOCK = [
  {
    id: 'lst-1',
    codigo: 'tam_bebida',
    nombre: 'Tamaños de bebida',
    valores: [
      { id: 'val-1', nombre: '12 oz', orden: 1, activo: true, usos: 10 },
      { id: 'val-2', nombre: '16 oz', orden: 2, activo: true, usos: 10 },
      { id: 'val-3', nombre: '21 oz', orden: 3, activo: false, usos: 5 },
    ],
  },
  {
    id: 'lst-2',
    codigo: 'opc_leche',
    nombre: 'Tipos de leche',
    valores: [
      { id: 'val-4', nombre: 'Entera', orden: 1, activo: true, usos: 12 },
      { id: 'val-5', nombre: 'Deslactosada', orden: 2, activo: true, usos: 12 },
    ],
  },
  {
    id: 'lst-combo-1',
    codigo: 'GRP_BEBIDA_1_BEBIDA',
    nombre: 'Bebida 1 · Bebida',
    valores: [{ id: 'val-c1', nombre: 'Frappe', orden: 1, activo: true }],
  },
  {
    id: 'lst-combo-2',
    codigo: 'GRP_DONA_1_SABOR',
    nombre: 'Dona 1 · Sabor',
    valores: [{ id: 'val-c2', nombre: 'Chocolate', orden: 1, activo: true }],
  },
];

const GRUPOS_MOCK = [
  {
    id: 'grp-1',
    nombre: 'Tipo de leche',
    listaId: 'lst-2',
    listaNombre: 'Tipos de leche',
    obligatorio: true,
    minimo: 1,
    maximo: 1,
    categoriaIds: ['cat-1'],
    opciones: [
      { id: 'opc-1', nombre: 'Entera', precioExtra: 0, activo: true },
      { id: 'opc-2', nombre: 'Deslactosada', precioExtra: 1.5, activo: true },
    ],
  },
];

describe('Módulo Catálogo - ProductosView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: {
        partyId: '1',
        nombreUsuario: 'admin',
        nombres: 'Administrador',
        rol: 'ADMIN',
      } as any,
      tiene: () => true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
      cargando: false,
    });

    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue(PRODUCTOS_MOCK);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue(CATEGORIAS_MOCK);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS_MOCK);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS_MOCK);
  });

  it('renderiza la lista de productos y botones de categorías', async () => {
    render(
      <MemoryRouter>
        <ProductosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Frappe Oreo')).toBeInTheDocument();
      expect(screen.getByText('Caja x6 Donas Artesanales')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Lo que se marca aquí se refleja de inmediato en la carta virtual y en el chatbot. Un producto agotado no se ofrece.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Las listas que se eligen en este módulo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Gestionar listas' }),
    ).toBeInTheDocument();

    expect(screen.getByText('+ Nuevo producto')).toBeInTheDocument();
  });

  it('permite filtrar por búsqueda de texto', async () => {
    render(
      <MemoryRouter>
        <ProductosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Frappe Oreo')).toBeInTheDocument();
    });

    const buscador = screen.getByPlaceholderText('Buscar producto');
    fireEvent.change(buscador, { target: { value: 'Donas' } });

    await waitFor(() => {
      expect(screen.queryByText('Frappe Oreo')).not.toBeInTheDocument();
      expect(screen.getByText('Caja x6 Donas Artesanales')).toBeInTheDocument();
    });
  });

  it('muestra ventana de nuevo producto al hacer clic en + Nuevo producto', async () => {
    render(
      <MemoryRouter>
        <ProductosView />
      </MemoryRouter>,
    );

    const btnNuevo = await screen.findByRole('button', { name: /\+ Nuevo producto/i });
    expect(btnNuevo).toBeInTheDocument();

    fireEvent.click(btnNuevo);

    await waitFor(() => {
      expect(screen.getByText('Agregar a la carta')).toBeInTheDocument();
    });
  });
});

describe('Módulo Catálogo - ListasCategoriasView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: {
        partyId: '1',
        nombreUsuario: 'admin',
        nombres: 'Administrador',
        rol: 'ADMIN',
      } as any,
      tiene: () => true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
      cargando: false,
    });

    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue(CATEGORIAS_MOCK);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS_MOCK);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS_MOCK);
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue(PRODUCTOS_MOCK);
  });

  it('renderiza la vista con el menú de categorías y elementos de la carta', async () => {
    render(
      <MemoryRouter>
        <ListasCategoriasView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Categorías de la carta').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Dónde se pregunta cada grupo')).toBeInTheDocument();
      expect(screen.getByText('Tamaños de bebida')).toBeInTheDocument();
    });

    expect(screen.getByText('+ Nueva categoría')).toBeInTheDocument();
    expect(screen.getByText(/Cada apartado tiene/)).toBeInTheDocument();
    expect(screen.getAllByText('Frappes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Donas y Galletas').length).toBeGreaterThanOrEqual(1);

    // Los grupos internos de combos no deben aparecer como listas a la izquierda
    expect(screen.queryByText('Bebida 1 · Bebida')).not.toBeInTheDocument();
    expect(screen.queryByText('Dona 1 · Sabor')).not.toBeInTheDocument();
  });

  it('cambia al panel de tamaños al hacer clic en Tamaños de bebida', async () => {
    render(
      <MemoryRouter>
        <ListasCategoriasView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Tamaños de bebida')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tamaños de bebida'));

    await waitFor(() => {
      expect(screen.getByText('12 oz')).toBeInTheDocument();
      expect(screen.getByText('16 oz')).toBeInTheDocument();
      expect(screen.getByText('21 oz')).toBeInTheDocument();
    });
  });
});
