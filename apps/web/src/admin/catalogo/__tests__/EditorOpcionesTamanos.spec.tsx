import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { EditorOpcionesTamanos } from '../EditorOpcionesTamanos';
import { EstadoOpciones } from '../editorOpcionesTipos';
import { catalogoApi } from '../catalogoApi';

const LISTAS = [
  {
    id: 'lst-tam', codigo: 'TAMANO', nombre: 'Tamaños',
    valores: [
      { id: 'v1', nombre: 'Regular 12 oz', orden: 1, activo: true },
      { id: 'v2', nombre: 'Grande 16 oz', orden: 2, activo: true },
      { id: 'v3', nombre: 'Extra 21 oz', orden: 3, activo: true },
    ],
  },
];
const GRUPOS = [
  {
    id: 'g1', nombre: 'Tipo de leche', obligatorio: true, minimo: 1, maximo: 1, productosCount: 4,
    opciones: [{ id: 'o1', nombre: 'Entera', precioExtra: 0, activo: true }],
  },
];
const INICIAL: EstadoOpciones = {
  tamanos: [
    { tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true },
    { tamanoValorId: 'v2', nombre: 'Grande 16 oz', precio: 7, activo: true },
  ],
  grupos: [],
};

function Borrador({ onEmitir, inicial = INICIAL }: { onEmitir: (e: EstadoOpciones) => void; inicial?: EstadoOpciones }) {
  const [v, setV] = useState(inicial);
  return <EditorOpcionesTamanos modo="borrador" valor={v} precioBase={5} onChange={(n) => { setV(n); onEmitir(n); }} />;
}

describe('EditorOpcionesTamanos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS as any);
  });

  it('muestra las explicaciones y la vista «Así lo verá el cliente»', async () => {
    render(<Borrador onEmitir={() => {}} />);
    expect(screen.getByText(/el cliente elige UN tamaño/)).toBeInTheDocument();
    expect(screen.getByText(/preguntas que aparecen al pedir/)).toBeInTheDocument();
    expect(screen.getByText('Así lo verá el cliente')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Ayuda: Precio (S/)')[0]);
    expect(screen.getByRole('note')).toHaveTextContent(/precio final de este tamaño/);
  });

  it('agrega un tamaño desde la lista en modo borrador sin llamar a la API de productos', async () => {
    const emitir = vi.fn();
    const editar = vi.spyOn(catalogoApi, 'editarProducto');
    const crear = vi.spyOn(catalogoApi, 'crearProducto');
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByText('Agregar tamaño'));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Extra 21 oz' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Elegir de la lista'), { target: { value: 'v3' } });
    fireEvent.click(screen.getByText('Agregar a este producto'));
    expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: expect.arrayContaining([{ tamanoValorId: 'v3', nombre: 'Extra 21 oz', precio: 5, activo: true }]),
    }));
    expect(editar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });

  it('crea un tamaño nuevo al instante con «+ Crear»', async () => {
    const emitir = vi.fn();
    const agregar = vi.spyOn(catalogoApi, 'agregarValor').mockResolvedValue({ id: 'v9', nombre: 'Jarra 1 L', orden: 4, activo: true });
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByText('Agregar tamaño'));
    await waitFor(() => screen.getByRole('option', { name: 'Extra 21 oz' }));
    fireEvent.change(screen.getByLabelText('O crear uno nuevo'), { target: { value: 'Jarra 1 L' } });
    fireEvent.click(screen.getByText('+ Crear'));
    await waitFor(() => expect(agregar).toHaveBeenCalledWith('lst-tam', { nombre: 'Jarra 1 L' }));
    await waitFor(() => expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: expect.arrayContaining([expect.objectContaining({ tamanoValorId: 'v9', nombre: 'Jarra 1 L' })]),
    })));
  });

  it('rechaza un nombre de tamaño repetido', async () => {
    const agregar = vi.spyOn(catalogoApi, 'agregarValor');
    render(<Borrador onEmitir={() => {}} />);
    fireEvent.click(screen.getByText('Agregar tamaño'));
    fireEvent.change(screen.getByLabelText('O crear uno nuevo'), { target: { value: 'regular 12 oz' } });
    fireEvent.click(screen.getByText('+ Crear'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya está en este producto/);
    expect(agregar).not.toHaveBeenCalled();
  });

  it('renombra un tamaño solo después de confirmar con Sí', async () => {
    const actualizar = vi.spyOn(catalogoApi, 'actualizarValor').mockResolvedValue({ id: 'v1', nombre: 'Chico 12 oz', orden: 1, activo: true });
    render(<Borrador onEmitir={() => {}} />);
    fireEvent.click(screen.getByLabelText('Renombrar Regular 12 oz'));
    fireEvent.change(screen.getByLabelText('Nuevo nombre de Regular 12 oz'), { target: { value: 'Chico 12 oz' } });
    fireEvent.click(screen.getByText('Guardar nombre'));
    expect(screen.getByRole('dialog')).toHaveTextContent(/vale para todos los productos que usan este tamaño/);
    expect(actualizar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, renombrar'));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('v1', { nombre: 'Chico 12 oz' }));
    expect(await screen.findByText('Chico 12 oz')).toBeInTheDocument();
  });

  it('oculta (Quitar) un tamaño y valida que quede uno activo', async () => {
    const emitir = vi.fn();
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByLabelText('Quitar Regular 12 oz'));
    expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: [expect.objectContaining({ activo: false }), expect.objectContaining({ activo: true })],
    }));
    expect(screen.getByLabelText(/Regular 12 oz: oculto/)).toBeInTheDocument();
  });

  it('reordena con subir y bajar', () => {
    const emitir = vi.fn();
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByLabelText('Bajar Regular 12 oz'));
    expect(emitir.mock.calls.at(-1)![0].tamanos.map((t: any) => t.tamanoValorId)).toEqual(['v2', 'v1']);
    expect(screen.getByLabelText('Subir Grande 16 oz')).toBeDisabled();
  });

  it('crea un grupo con opciones y precio extra y lo activa en el producto', async () => {
    const emitir = vi.fn();
    const crearGrupo = vi.spyOn(catalogoApi, 'crearGrupo').mockResolvedValue({ id: 'g9', nombre: 'Extras', opciones: [] } as any);
    const crearOpcion = vi.spyOn(catalogoApi, 'crearOpcion').mockResolvedValue({ id: 'o9', nombre: 'Shot', precioExtra: 2.5, activo: true });
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(await screen.findByText('+ Crear grupo nuevo'));
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Extras' } });
    fireEvent.change(screen.getByLabelText('El cliente elige'), { target: { value: 'varias' } });
    fireEvent.change(screen.getByLabelText('Máximo'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Opción'), { target: { value: 'Shot' } });
    fireEvent.change(screen.getByLabelText('Precio extra (S/)'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByText('Crear grupo'));
    await waitFor(() => expect(crearGrupo).toHaveBeenCalledWith({ nombre: 'Extras', obligatorio: false, minimo: 0, maximo: 3 }));
    expect(crearOpcion).toHaveBeenCalledWith('g9', { nombre: 'Shot', precioExtra: 2.5 });
    await waitFor(() => expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      grupos: [expect.objectContaining({ grupoId: 'g9' })],
    })));
  });

  it('modo guardado: confirma con Sí y guarda con editarProducto', async () => {
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    const alGuardar = vi.fn();
    const producto: any = {
      id: 'p1', nombre: 'Frappe', precio: 6,
      tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true }],
      grupos: [],
    };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} alGuardar={alGuardar} />);
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(editar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, guardar'));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('p1', {
      tamanos: [{ tamanoValorId: 'v1', precio: 6, activo: true }],
      grupos: [],
      sincronizarGrupos: true,
      resaltarOpcionMenosPedida: false,
    }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
  });

  it('modo guardado: no guarda con precio negativo', () => {
    const editar = vi.spyOn(catalogoApi, 'editarProducto');
    const producto: any = { id: 'p1', nombre: 'F', precio: 6, grupos: [], tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true }] };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    fireEvent.change(screen.getByLabelText('Precio de Regular 12 oz'), { target: { value: '-1' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(screen.getByRole('alert')).toHaveTextContent(/debe ser 0 o más/);
    expect(editar).not.toHaveBeenCalled();
  });
});
