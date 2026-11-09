import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EditorOpcionesTamanos } from '../EditorOpcionesTamanos';
import { EstadoOpciones } from '../editorOpcionesTipos';
import { catalogoApi } from '../catalogoApi';

const op = (id: string, nombre: string, precioExtra = 0) => ({ id, nombre, precioExtra, activo: true });
const GRUPOS = [
  { id: 'g1', nombre: 'Tipo de leche', obligatorio: true, minimo: 1, maximo: 1, productosCount: 4, opciones: [op('o1', 'Entera'), op('o2', 'Almendra', 2)] },
  { id: 'g2', nombre: 'Endulzante', obligatorio: false, minimo: 0, maximo: 1, productosCount: 4, opciones: [op('o3', 'Azúcar'), op('o4', 'Stevia')] },
  { id: 'g3', nombre: 'Acompañante', obligatorio: false, minimo: 0, maximo: 2, productosCount: 4, opciones: [op('o5', 'Galleta'), op('o6', 'Brownie', 3)] },
];
const INICIAL: EstadoOpciones = {
  tamanos: [{ tamanoValorId: 'v1', nombre: 'Regular', precio: 6, activo: true, unidades: 1 }],
  grupos: [{ grupoId: 'g1' }, { grupoId: 'g2' }, { grupoId: 'g3' }],
};

function Borrador() {
  const [v, setV] = useState(INICIAL);
  return <EditorOpcionesTamanos modo="borrador" valor={v} precioBase={6} onChange={setV} borradorBase={{ nombre: 'Frappé caramelo clásico', precio: 6 }} />;
}

const filas = () => screen.getAllByTestId('fila-pregunta').map((f) => f.getAttribute('data-grupo-id'));
const enVista = () => within(screen.getByTestId('vista-en-vivo')).queryAllByTestId('num-pregunta').map((n) => n.closest('[data-grupo]')?.getAttribute('data-grupo'));

async function abrir(ui = <Borrador />) {
  render(<MemoryRouter>{ui}</MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: /Preguntas al cliente/ }));
  await waitFor(() => expect(screen.getAllByTestId('fila-pregunta')).toHaveLength(3));
  await waitFor(() => expect(enVista()).toHaveLength(3));
}

describe('Orden de las preguntas y vista previa en vivo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([] as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue(GRUPOS as any);
  });

  it('numera 1ª, 2ª, 3ª y la vista previa sigue el mismo orden', async () => {
    await abrir();
    expect(screen.getAllByTestId('num-fila').map((n) => n.textContent)).toEqual(['1ª pregunta', '2ª pregunta', '3ª pregunta']);
    expect(filas()).toEqual(['g1', 'g2', 'g3']);
    expect(enVista()).toEqual(['g1', 'g2', 'g3']);
    const nums = within(screen.getByTestId('vista-en-vivo')).getAllByTestId('num-pregunta').map((n) => n.textContent);
    expect(nums).toEqual(['1', '2', '3']);
  });

  it('▲ ▼ reordenan, renumeran, resaltan la pregunta movida y actualizan la vista al instante', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Acompañante' }));
    expect(filas()).toEqual(['g1', 'g3', 'g2']);
    expect(enVista()).toEqual(['g1', 'g3', 'g2']);
    expect(document.querySelector('[data-grupo="g3"]')?.getAttribute('data-destacado')).toBe('1');
    expect(screen.getByRole('button', { name: 'Subir Tipo de leche' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Tipo de leche' }));
    expect(filas()).toEqual(['g3', 'g1', 'g2']);
    expect(enVista()).toEqual(['g3', 'g1', 'g2']);
  });

  it('Alt+↑/↓ en el asa mueve y deja el foco en la pregunta movida', async () => {
    await abrir();
    const asa = screen.getByRole('button', { name: /Arrastrar Endulzante/ });
    fireEvent.keyDown(asa, { key: 'ArrowUp', altKey: true });
    expect(filas()).toEqual(['g2', 'g1', 'g3']);
    expect(screen.getByRole('button', { name: /Arrastrar Endulzante/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: /Arrastrar Endulzante/ }), { key: 'ArrowUp' }); // sin Alt no mueve
    expect(filas()).toEqual(['g2', 'g1', 'g3']);
  });

  it('arrastrar el asa con Pointer Events cambia el orden', async () => {
    await abrir();
    screen.getAllByTestId('fila-pregunta').forEach((f, i) => {
      f.getBoundingClientRect = () => ({ top: i * 60, height: 50, bottom: i * 60 + 50, left: 0, right: 300, width: 300, x: 0, y: i * 60, toJSON: () => ({}) });
    });
    const asa = screen.getByRole('button', { name: /Arrastrar Tipo de leche/ });
    fireEvent.pointerDown(asa, { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 20 });
    fireEvent.pointerMove(asa, { pointerId: 1, pointerType: 'mouse', clientY: 150 });
    expect(screen.getAllByTestId('fila-pregunta')[2]).toHaveClass('eo-destino');
    fireEvent.pointerUp(asa, { pointerId: 1, pointerType: 'mouse', clientY: 150 });
    expect(filas()).toEqual(['g2', 'g3', 'g1']);
    expect(enVista()).toEqual(['g2', 'g3', 'g1']);
  });

  it('en táctil hace falta pulsación larga: un toque corto no arrastra', async () => {
    await abrir();
    vi.useFakeTimers();
    try {
      screen.getAllByTestId('fila-pregunta').forEach((f, i) => {
        f.getBoundingClientRect = () => ({ top: i * 60, height: 50, bottom: i * 60 + 50, left: 0, right: 300, width: 300, x: 0, y: i * 60, toJSON: () => ({}) });
      });
      const asa = screen.getByRole('button', { name: /Arrastrar Tipo de leche/ });
      fireEvent.pointerDown(asa, { pointerId: 2, pointerType: 'touch', clientY: 20 });
      fireEvent.pointerMove(asa, { pointerId: 2, pointerType: 'touch', clientY: 150 });
      fireEvent.pointerUp(asa, { pointerId: 2, pointerType: 'touch', clientY: 150 });
      expect(filas()).toEqual(['g1', 'g2', 'g3']);
      fireEvent.pointerDown(asa, { pointerId: 3, pointerType: 'touch', clientY: 20 });
      await vi.advanceTimersByTimeAsync(400);
      fireEvent.pointerMove(asa, { pointerId: 3, pointerType: 'touch', clientY: 100 });
      fireEvent.pointerUp(asa, { pointerId: 3, pointerType: 'touch', clientY: 100 });
      expect(filas()).toEqual(['g2', 'g1', 'g3']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('la vista refleja quitar y volver a agregar una pregunta, y «Restablecer orden» vuelve al inicial', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Tipo de leche' }));
    expect(filas()).toEqual(['g2', 'g1', 'g3']);
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer orden' }));
    expect(filas()).toEqual(['g1', 'g2', 'g3']);
    expect(screen.getByRole('button', { name: 'Restablecer orden' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Preguntar «Endulzante» en este producto'));
    expect(filas()).toEqual(['g1', 'g3']);
    expect(enVista()).toEqual(['g1', 'g3']);
    fireEvent.click(screen.getByLabelText('Preguntar «Endulzante» en este producto'));
    expect(enVista()).toEqual(['g1', 'g3', 'g2']);
  });

  it('la vista previa es solo lectura: «Vista previa» deshabilitado y cero llamadas de guardado', async () => {
    const editar = vi.spyOn(catalogoApi, 'editarProducto');
    const ordenar = vi.spyOn(catalogoApi, 'ordenarGrupos');
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Tipo de leche' }));
    const vista = screen.getByTestId('vista-en-vivo');
    expect(within(vista).getByRole('button', { name: 'Vista previa deshabilitada' })).toBeDisabled();
    expect(within(vista).getByText('Vista previa')).toBeInTheDocument();
    expect(editar).not.toHaveBeenCalled();
    expect(ordenar).not.toHaveBeenCalled();
    // celular / computadora
    fireEvent.click(within(vista).getByTestId('btn-disp-pc'));
    expect(within(vista).getByTestId('preview-container-pc')).toBeInTheDocument();
  });

  it('modo guardado: si solo cambió el orden usa orden-grupos y luego guarda con el mismo orden', async () => {
    const ordenar = vi.spyOn(catalogoApi, 'ordenarGrupos').mockResolvedValue({ ok: true, grupoIds: [] });
    const editar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    const alGuardar = vi.fn();
    const producto: any = {
      id: 'p1', nombre: 'Frappé caramelo clásico', precio: 6, tamanos: [],
      grupos: GRUPOS.map((g) => ({ ...g })),
    };
    await abrir(<EditorOpcionesTamanos modo="guardado" producto={producto} alGuardar={alGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Endulzante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
    expect(ordenar).toHaveBeenCalledWith('p1', ['g2', 'g1', 'g3']);
    expect(editar.mock.calls[0][1].grupos).toEqual([
      { grupoId: 'g2', orden: 0 }, { grupoId: 'g1', orden: 1 }, { grupoId: 'g3', orden: 2 },
    ]);
  });
});
