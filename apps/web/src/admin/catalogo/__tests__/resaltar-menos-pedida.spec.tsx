import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { EditorOpcionesTamanos } from '../EditorOpcionesTamanos';
import { EstadoOpciones, estadoDesdeProducto } from '../editorOpcionesTipos';
import { catalogoApi } from '../catalogoApi';

const LISTAS = [{ id: 'lst-tam', codigo: 'TAMANO', nombre: 'Tamaños', valores: [] }];
const GRUPOS = [
  { id: 'g1', nombre: 'Tipo de leche', obligatorio: true, minimo: 1, maximo: 1, productosCount: 1,
    opciones: [{ id: 'o1', nombre: 'Entera', precioExtra: 0, activo: true }] },
];
const CHECK = /Resaltar en cocina la opción menos pedida/;

describe('Check «Resaltar en cocina la opción menos pedida» en el editor de producto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS as any);
  });

  it('viene apagado por defecto y en modo borrador se emite al marcarlo', async () => {
    const emitidos: EstadoOpciones[] = [];
    function Borrador() {
      const [v, setV] = useState<EstadoOpciones>({ tamanos: [], grupos: [] });
      return <EditorOpcionesTamanos modo="borrador" valor={v} onChange={(n) => { setV(n); emitidos.push(n); }} />;
    }
    render(<Borrador />);
    const check = screen.getByRole('checkbox', { name: CHECK });
    expect(check).not.toBeChecked();
    fireEvent.click(check);
    expect(emitidos.at(-1)?.resaltarMenosPedida).toBe(true);
    expect(check).toBeChecked();
  });

  it('en modo guardado sale en el producto y se envía al guardar', async () => {
    const producto: any = {
      id: '10', nombre: 'LATTE', precio: 8, tamanos: [], grupos: [{ id: 'g1', nombre: 'Tipo de leche', obligatorio: true, minimo: 1, maximo: 1 }],
      resaltarOpcionMenosPedida: false, sabores: [], categoriaId: '1', categoria: { id: '1', nombre: 'Cafés' },
    };
    expect(estadoDesdeProducto(producto).resaltarMenosPedida).toBe(false);
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue(producto);
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} alGuardar={() => {}} />);

    const check = await screen.findByRole('checkbox', { name: CHECK });
    expect(check).not.toBeChecked();
    fireEvent.click(check);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith('10', expect.objectContaining({ resaltarOpcionMenosPedida: true })));
  });

  it('un producto que ya lo tiene encendido lo muestra marcado', async () => {
    const producto: any = { id: '11', nombre: 'MOCHA', precio: 9, tamanos: [], grupos: [], resaltarOpcionMenosPedida: true, sabores: [], categoriaId: '1', categoria: { id: '1', nombre: 'Cafés' } };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    expect(await screen.findByRole('checkbox', { name: CHECK })).toBeChecked();
  });
});
