import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

const producto = (extra: any = {}) => ({
  id: 'p1', categoriaId: 'c1', categoria: { id: 'c1', nombre: 'Frappes' }, nombre: 'Frappe Oreo',
  descripcion: '', precio: 10, orden: 1, oculto: false, disponible: true, agotadoHasta: null,
  noSumaBeneficios: false, fotoUrl: null, tamanos: [], grupos: [], sabores: [], ...extra,
});
const promo = (extra: any = {}) => ({
  id: '1', nombre: '2x1 Frappes', tipo: 'LLEVA_PAGA', vigenteAhora: true, estado: 'EN_CURSO', ...extra,
});
const BOTON = /Suma puntos y acepta cupones|No suma puntos ni aplica cupones/;

async function montar(p: any) {
  vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([p]);
  render(<MemoryRouter><ProductosView /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Frappe Oreo')).toBeInTheDocument());
}

describe('ProductosView: aviso de promoción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombreUsuario: 'admin', nombres: 'A', rol: 'ADMIN' } as any,
      tiene: () => true, permisos: [], autenticado: true, cargando: false, debeCambiar: false,
    } as any);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([]);
  });

  it('sin promociones: botón como siempre', async () => {
    await montar(producto({ promociones: [] }));
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-promocion')).toBeNull();
  });

  it('solo en combo (sin promociones): botón visible', async () => {
    await montar(producto());
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument();
  });

  it('en promoción: sin botón y con aviso', async () => {
    await montar(producto({ promociones: [promo()] }));
    expect(screen.queryByRole('button', { name: BOTON })).toBeNull();
    expect(screen.getByText('En promoción: no suma puntos')).toBeInTheDocument();
    expect(screen.getByText('2x1 Frappes')).toBeInTheDocument();
  });

  it('en promoción y marcado: aviso doble', async () => {
    await montar(producto({ noSumaBeneficios: true, promociones: [promo(), promo({ id: '2' })] }));
    expect(screen.getByText('En 2 promociones')).toBeInTheDocument();
    expect(screen.getByText('También marcado como no suma puntos')).toBeInTheDocument();
  });

  it('promoción programada y vencida con matiz', async () => {
    await montar(producto({ promociones: [promo({ estado: 'PROGRAMADA', vigenteAhora: false })] }));
    expect(screen.getByText('Promoción programada')).toBeInTheDocument();
  });

  it('promoción vencida', async () => {
    await montar(producto({ promociones: [promo({ estado: 'VENCIDA', vigenteAhora: false })] }));
    expect(screen.getByText('Promoción vencida: desactívala para volver a sumar')).toBeInTheDocument();
  });
});
