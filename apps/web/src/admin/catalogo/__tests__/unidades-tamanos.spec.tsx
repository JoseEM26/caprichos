import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { EditorOpcionesTamanos } from '../EditorOpcionesTamanos';
import { EstadoOpciones } from '../editorOpcionesTipos';
import { catalogoApi } from '../catalogoApi';

const AYUDA_UNIDADES = 'Sirve para descontar el stock: una 1/2 docena descuenta 6 unidades.';

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

const INICIAL: EstadoOpciones = {
  tamanos: [
    { tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true, unidades: 1 },
    { tamanoValorId: 'v2', nombre: 'Grande 16 oz', precio: 7, activo: true, unidades: 1 },
  ],
  grupos: [],
};

function Borrador({ onEmitir }: { onEmitir: (e: EstadoOpciones) => void }) {
  const [v, setV] = useState(INICIAL);
  return <EditorOpcionesTamanos modo="borrador" valor={v} precioBase={5} onChange={(n) => { setV(n); onEmitir(n); }} />;
}

describe('Tamaños: campo «Unidades» (stock por sabor)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([] as any);
  });

  it('cada tamaño muestra Unidades con 1 por defecto y la ayuda corta', () => {
    render(<Borrador onEmitir={() => {}} />);
    expect(screen.getByLabelText('Unidades de Regular 12 oz')).toHaveValue(1);
    expect(screen.getByLabelText('Unidades de Grande 16 oz')).toHaveValue(1);
    expect(screen.getAllByText(AYUDA_UNIDADES)).toHaveLength(2);
  });

  it('en borrador, cambiar las unidades emite el nuevo valor', () => {
    const emitir = vi.fn();
    render(<Borrador onEmitir={emitir} />);
    fireEvent.change(screen.getByLabelText('Unidades de Grande 16 oz'), { target: { value: '6' } });
    expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: [
        expect.objectContaining({ tamanoValorId: 'v1', unidades: 1 }),
        expect.objectContaining({ tamanoValorId: 'v2', unidades: 6 }),
      ],
    }));
  });

  it('modo guardado: muestra las unidades del producto y las envía editadas', async () => {
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    const producto: any = {
      id: 'p1', nombre: 'DONA', precio: 6, grupos: [], sabores: [],
      tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true, unidades: 12 }],
    };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    const campo = screen.getByLabelText('Unidades de Regular 12 oz');
    expect(campo).toHaveValue(12);
    fireEvent.change(campo, { target: { value: '6' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    fireEvent.click(screen.getByText('Sí, guardar'));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('p1', expect.objectContaining({
      tamanos: [{ tamanoValorId: 'v1', precio: 6, activo: true, unidades: 6 }],
    })));
  });

  it('un producto guardado sin unidades (dato antiguo) muestra 1', () => {
    const producto: any = {
      id: 'p1', nombre: 'FLAN', precio: 6, grupos: [], sabores: [],
      tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true }],
    };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    expect(screen.getByLabelText('Unidades de Regular 12 oz')).toHaveValue(1);
  });

  it('unidades menores a 1 o vacías bloquean el guardado con un mensaje claro', () => {
    const editar = vi.spyOn(catalogoApi, 'editarProducto');
    const producto: any = {
      id: 'p1', nombre: 'DONA', precio: 6, grupos: [], sabores: [],
      tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true, unidades: 1 }],
    };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    fireEvent.change(screen.getByLabelText('Unidades de Regular 12 oz'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(screen.getByRole('alert')).toHaveTextContent('Las unidades de «Regular 12 oz» deben ser un número entero de 1 o más.');
    expect(editar).not.toHaveBeenCalled();
  });

  it('se puede agregar el tamaño Docena creándolo en la lista y ponerle 12 unidades', async () => {
    const emitir = vi.fn();
    const agregar = vi.spyOn(catalogoApi, 'agregarValor').mockResolvedValue({ id: 'v9', nombre: 'Docena', orden: 3, activo: true });
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByText('Agregar tamaño'));
    await waitFor(() => screen.getByRole('option', { name: 'Extra 21 oz' }));
    fireEvent.change(screen.getByLabelText('O crear uno nuevo'), { target: { value: 'Docena' } });
    fireEvent.click(screen.getByText('+ Crear'));
    await waitFor(() => expect(agregar).toHaveBeenCalledWith('lst-tam', { nombre: 'Docena' }));
    await waitFor(() => expect(screen.getByLabelText('Unidades de Docena')).toHaveValue(1));

    fireEvent.change(screen.getByLabelText('Unidades de Docena'), { target: { value: '12' } });
    expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: expect.arrayContaining([expect.objectContaining({ tamanoValorId: 'v9', nombre: 'Docena', unidades: 12 })]),
    }));
  });
});
