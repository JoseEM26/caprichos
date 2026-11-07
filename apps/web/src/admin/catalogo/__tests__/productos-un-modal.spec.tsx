import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import * as sesionModulo from '../../../comun/sesion';
import { catalogoApi } from '../catalogoApi';

// «Servidor» en memoria: guardar tamaños sincroniza el precio base con el primer tamaño activo (como el real).
let prod: any;
const nuevo = () => ({
  id: 'p1', categoriaId: 'c1', categoria: { id: 'c1', nombre: 'Frappes' }, nombre: 'Frappe Oreo', descripcion: '', precio: 10,
  orden: 1, oculto: false, disponible: true, agotadoHasta: null, noSumaBeneficios: false, controlaStock: false, fotoUrl: null,
  tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: '12 oz', precio: 10, activo: true, unidades: 1 }], grupos: [], sabores: [],
});

describe('Productos: un solo modal a la vez y guardados que no se pisan', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    prod = nuevo();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    vi.spyOn(catalogoApi, 'listarProductos').mockImplementation(async () => [JSON.parse(JSON.stringify(prod))]);
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue([{ id: 'c1', nombre: 'Frappes', areaId: 'a', orden: 1, oculta: false, llevaOpciones: true }] as any);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([{ id: 'l', codigo: 'TAMANO', valores: [{ id: 'v1', nombre: '12 oz', activo: true, orden: 1 }] }] as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'editarProducto').mockImplementation(async (_id: string, d: any) => {
      if (d.nombre !== undefined) prod.nombre = d.nombre;
      if (d.precio !== undefined) prod.precio = d.precio;
      if (d.tamanos) { prod.tamanos = d.tamanos.map((t: any) => ({ ...t, id: 't' + t.tamanoValorId, nombre: '12 oz' })); prod.precio = d.tamanos[0].precio; }
      return { ok: true } as any;
    });
  });

  const abrir = async () => {
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    await screen.findByText('Frappe Oreo');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    return screen.findByRole('dialog', { name: /Editar:/ });
  };
  const confirmar = async (titulo: string) => {
    await screen.findByRole('dialog', { name: titulo });
    fireEvent.click(screen.getByRole('button', { name: /^Sí/ }));
  };

  it('guardar el editor envía solo lo que cambió: el precio base sincronizado por Tamaños no se pisa', async () => {
    const ed = await abrir();
    fireEvent.change(within(ed).getByLabelText('Nombre'), { target: { value: 'Frappe Nuevo' } });
    // Otro guardado (tamaños) cambió el precio base en el servidor mientras el editor seguía con el 10 viejo
    prod.precio = 12;
    fireEvent.click(within(ed).getByRole('button', { name: 'Guardar' }));
    await confirmar('¿Guardar los cambios?');
    await waitFor(() => expect(catalogoApi.editarProducto).toHaveBeenCalledTimes(1));
    expect((catalogoApi.editarProducto as any).mock.calls[0][1]).toEqual({ nombre: 'Frappe Nuevo' });
    expect(prod.precio).toBe(12);
    expect(prod.nombre).toBe('Frappe Nuevo');
  });

  it('abrir Tamaños y opciones desde el editor limpio lo reemplaza: nunca dos modales', async () => {
    const ed = await abrir();
    fireEvent.click(within(ed).getByRole('button', { name: /^Tamaños y opciones/ }));
    await screen.findByRole('dialog', { name: /Tamaños y opciones: Frappe Oreo/ });
    expect(screen.queryByRole('dialog', { name: /Editar:/ })).not.toBeInTheDocument();
  });

  it('con cambios sin guardar avisa antes de reemplazar el editor; «Volver» conserva lo escrito', async () => {
    const ed = await abrir();
    fireEvent.change(within(ed).getByLabelText('Nombre'), { target: { value: 'Otro' } });
    fireEvent.click(within(ed).getByRole('button', { name: /^Tamaños y opciones/ }));
    await screen.findByRole('dialog', { name: 'Hay cambios sin guardar' });
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByRole('dialog', { name: /Tamaños y opciones:/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: /Editar:/ })).getByLabelText('Nombre')).toHaveValue('Otro');
    fireEvent.click(within(ed).getByRole('button', { name: /^Tamaños y opciones/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar y abrir' }));
    await screen.findByRole('dialog', { name: /Tamaños y opciones:/ });
    expect(screen.queryByRole('dialog', { name: /Editar:/ })).not.toBeInTheDocument();
  });

  it('editar nombre, guardar, y luego guardar Tamaños: el nombre persiste', async () => {
    const ed = await abrir();
    fireEvent.change(within(ed).getByLabelText('Nombre'), { target: { value: 'Frappe Nuevo' } });
    fireEvent.click(within(ed).getByRole('button', { name: 'Guardar' }));
    await confirmar('¿Guardar los cambios?');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Editar:/ })).not.toBeInTheDocument());
    await screen.findByText('Frappe Nuevo');
    fireEvent.click(screen.getByRole('button', { name: /^Tamaños y opciones/ }));
    const op = await screen.findByRole('dialog', { name: /Tamaños y opciones: Frappe Nuevo/ });
    fireEvent.change(within(op).getByLabelText('Precio de 12 oz'), { target: { value: '13' } });
    fireEvent.click(within(op).getByRole('button', { name: /Guardar/ }));
    await confirmar('¿Guardar los cambios?');
    await waitFor(() => expect(catalogoApi.editarProducto).toHaveBeenCalledTimes(2));
    expect(prod.nombre).toBe('Frappe Nuevo');
    expect(prod.precio).toBe(13);
  });
});
