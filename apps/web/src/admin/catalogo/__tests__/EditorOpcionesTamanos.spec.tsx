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
    { tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true, unidades: 1 },
    { tamanoValorId: 'v2', nombre: 'Grande 16 oz', precio: 7, activo: true, unidades: 1 },
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

  it('la explicación general es plegable y la vista del cliente vive en su pestaña', async () => {
    render(<Borrador onEmitir={() => {}} />);
    expect(screen.queryByText(/el cliente elige UN tamaño/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '¿Para qué sirve?' }));
    expect(screen.getByText(/el cliente elige UN tamaño/)).toBeInTheDocument();
    expect(screen.getByText(/preguntas que aparecen al pedir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Vista del cliente/ }));
    expect(screen.getByLabelText('Así lo verá el cliente')).toHaveTextContent('Regular 12 oz · S/ 6.00');
  });

  it('las pestañas llevan conteo: tamaños y grupos que se preguntan aquí', async () => {
    render(<Borrador onEmitir={() => {}} inicial={{ ...INICIAL, grupos: [{ grupoId: 'g1' }] }} />);
    expect(screen.getByRole('tab', { name: /Tamaños/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Preguntas al cliente/ })).toHaveTextContent('1');
  });

  it('Preguntas: filtra por chips y por buscador, y los grupos que se preguntan salen primero', async () => {
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([
      ...GRUPOS,
      { id: 'g2', nombre: 'Extras', obligatorio: false, minimo: 0, maximo: 3, productosCount: 1, opciones: [] },
    ] as any);
    render(<Borrador onEmitir={() => {}} inicial={{ ...INICIAL, grupos: [{ grupoId: 'g2' }] }} />);
    fireEvent.click(screen.getByRole('tab', { name: /Preguntas al cliente/ }));
    await screen.findByText('Se pregunta aquí (1)');
    const nombres = () => screen.getAllByLabelText(/^Preguntar «/).map((e) => e.getAttribute('aria-label'));
    expect(nombres()).toEqual(['Preguntar «Extras» en este producto', 'Preguntar «Tipo de leche» en este producto']);
    fireEvent.click(screen.getByText('No se pregunta aquí (1)'));
    expect(nombres()).toEqual(['Preguntar «Tipo de leche» en este producto']);
    fireEvent.click(screen.getByText('Todos (2)'));
    fireEvent.change(screen.getByLabelText('Buscar grupo'), { target: { value: 'extra' } });
    expect(nombres()).toEqual(['Preguntar «Extras» en este producto']);
  });

  it('Vista del cliente: muestra 6 opciones y «Ver N más» despliega el resto', async () => {
    const ops = Array.from({ length: 27 }, (_, i) => ({ id: `o${i}`, nombre: `Bebida ${i}`, precioExtra: 0, activo: true }));
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([{ ...GRUPOS[0], opciones: ops }] as any);
    render(<Borrador onEmitir={() => {}} inicial={{ ...INICIAL, grupos: [{ grupoId: 'g1' }] }} />);
    await waitFor(() => expect(catalogoApi.listarGrupos).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('tab', { name: /Vista del cliente/ }));
    const vista = await screen.findByLabelText('Así lo verá el cliente');
    await waitFor(() => expect(vista).toHaveTextContent('Bebida 5'));
    expect(vista).not.toHaveTextContent('Bebida 6');
    fireEvent.click(screen.getByText('Ver 21 más'));
    expect(vista).toHaveTextContent('Bebida 26');
  });

  it('agrega un tamaño desde la lista en modo borrador sin llamar a la API de productos', async () => {
    const emitir = vi.fn();
    const editar = vi.spyOn(catalogoApi, 'editarProducto');
    const crear = vi.spyOn(catalogoApi, 'crearProducto');
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByText('+ Agregar tamaño'));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Extra 21 oz' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Elegir de la lista'), { target: { value: 'v3' } });
    fireEvent.click(screen.getByText('Agregar a este producto'));
    expect(emitir).toHaveBeenLastCalledWith(expect.objectContaining({
      tamanos: expect.arrayContaining([{ tamanoValorId: 'v3', nombre: 'Extra 21 oz', precio: 5, activo: true, unidades: 1 }]),
    }));
    expect(editar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });

  it('crea un tamaño nuevo al instante con «+ Crear»', async () => {
    const emitir = vi.fn();
    const agregar = vi.spyOn(catalogoApi, 'agregarValor').mockResolvedValue({ id: 'v9', nombre: 'Jarra 1 L', orden: 4, activo: true });
    render(<Borrador onEmitir={emitir} />);
    fireEvent.click(screen.getByText('+ Agregar tamaño'));
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
    fireEvent.click(screen.getByText('+ Agregar tamaño'));
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
    expect(emitir).not.toHaveBeenCalled(); // pide confirmación
    fireEvent.click(screen.getByText('Sí, quitar'));
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
    fireEvent.click(screen.getByRole('tab', { name: /Preguntas al cliente/ }));
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
    expect(screen.queryByText('Guardar cambios')).not.toBeInTheDocument(); // sin cambios no hay qué guardar
    fireEvent.click(screen.getByLabelText('Regular 12 oz: activo, tocar para ocultar'));
    fireEvent.click(screen.getByLabelText('Regular 12 oz: oculto, tocar para activar'));
    expect(screen.queryByText('Guardar cambios')).not.toBeInTheDocument(); // volvió al estado original
    fireEvent.change(screen.getByLabelText('Precio de Regular 12 oz'), { target: { value: '6.5' } });
    expect(screen.getByRole('status')).toHaveTextContent('Hay cambios sin guardar');
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(editar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, guardar'));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('p1', {
      tamanos: [{ tamanoValorId: 'v1', precio: 6.5, activo: true, unidades: 1 }],
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

describe('EditorOpcionesTamanos: cierre con cambios sin guardar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue(LISTAS as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS as any);
  });
  const producto: any = { id: 'p1', nombre: 'Frappe', precio: 6, grupos: [], tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Regular 12 oz', precio: 6, activo: true }] };

  it('sin cambios cierra directo', () => {
    const cancelar = vi.fn();
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} alCancelar={cancelar} />);
    fireEvent.click(screen.getAllByText('Cerrar').find((e) => e.textContent === 'Cerrar')!);
    expect(cancelar).toHaveBeenCalled();
  });

  it('con cambios pregunta Sí/No antes de cerrar', () => {
    const cancelar = vi.fn();
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} alCancelar={cancelar} />);
    fireEvent.change(screen.getByLabelText('Precio de Regular 12 oz'), { target: { value: '9' } });
    fireEvent.click(screen.getAllByText('Cerrar').find((e) => e.tagName === 'BUTTON' && e.textContent === 'Cerrar')!);
    expect(cancelar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('No'));
    expect(cancelar).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText('Cerrar').find((e) => e.textContent === 'Cerrar')!);
    fireEvent.click(screen.getByText('Sí, salir'));
    expect(cancelar).toHaveBeenCalled();
  });
});
