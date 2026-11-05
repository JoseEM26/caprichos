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
    fotoUrl: '/fotos/dona.jpg',
    tamanos: [],
    grupos: [],
    sabores: [],
    ...over,
  };
}

async function abrirEditarConFoto() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
  return screen.findByRole('dialog', { name: /Editar: DONA DE CHOCOLATE/ });
}

async function guardarYConfirmar(d: HTMLElement) {
  fireEvent.click(within(d).getByRole('button', { name: 'Guardar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));
}

describe('Editar producto: la foto solo viaja si el admin la cambia', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombreUsuario: 'admin', nombres: 'A', rol: 'ADMIN' } as any,
      tiene: () => true,
    } as any);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue(CATS as any);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([] as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([] as any);
    vi.spyOn(catalogoApi, 'listarProductos').mockResolvedValue([producto()] as any);
    vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
  });

  it('sin tocar la foto no envía fotoArchivoId en el payload', async () => {
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    const d = await abrirEditarConFoto();

    await guardarYConfirmar(d);

    await waitFor(() => expect(catalogoApi.editarProducto).toHaveBeenCalled());
    const payload = vi.mocked(catalogoApi.editarProducto).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('fotoArchivoId');
  });

  it('marcar «Controlar stock» y guardar conserva la foto (sin fotoArchivoId)', async () => {
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    const d = await abrirEditarConFoto();

    fireEvent.click(within(d).getByRole('checkbox', { name: CHECK }));
    await guardarYConfirmar(d);

    await waitFor(() =>
      expect(catalogoApi.editarProducto).toHaveBeenCalledWith('p1', expect.objectContaining({ controlaStock: true })),
    );
    expect(vi.mocked(catalogoApi.editarProducto).mock.calls[0][1]).not.toHaveProperty('fotoArchivoId');
  });

  it('subir una foto nueva envía su id', async () => {
    const subir = vi
      .spyOn(catalogoApi, 'subirFoto')
      .mockResolvedValue({ id: '77', url: '/fotos/nueva.jpg' });
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    const d = await abrirEditarConFoto();

    const input = d.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'n.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(subir).toHaveBeenCalled());

    await guardarYConfirmar(d);
    await waitFor(() =>
      expect(catalogoApi.editarProducto).toHaveBeenCalledWith('p1', expect.objectContaining({ fotoArchivoId: '77' })),
    );
  });

  it('quitar la foto envía fotoArchivoId null', async () => {
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    const d = await abrirEditarConFoto();

    fireEvent.click(within(d).getByRole('button', { name: 'Quitar imagen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));
    await guardarYConfirmar(d);

    await waitFor(() =>
      expect(catalogoApi.editarProducto).toHaveBeenCalledWith('p1', expect.objectContaining({ fotoArchivoId: null })),
    );
  });

  it('reabrir la edición reinicia el estado: tras subir y cancelar, guardar no envía foto', async () => {
    vi.spyOn(catalogoApi, 'subirFoto').mockResolvedValue({ id: '77', url: '/fotos/nueva.jpg' });
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    let d = await abrirEditarConFoto();

    const input = d.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'n.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(catalogoApi.subirFoto).toHaveBeenCalled());

    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Editar: DONA/ })).not.toBeInTheDocument());

    d = await abrirEditarConFoto();
    await guardarYConfirmar(d);
    await waitFor(() => expect(catalogoApi.editarProducto).toHaveBeenCalled());
    expect(vi.mocked(catalogoApi.editarProducto).mock.calls[0][1]).not.toHaveProperty('fotoArchivoId');
  });
});
