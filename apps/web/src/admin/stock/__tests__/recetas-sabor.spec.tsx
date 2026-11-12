import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { stockApi } from '../stockApi';
import { RecetasTab } from '../RecetasTab';
import type { RecetaProductoDetalle } from '../tipos';

const linea = (n: string, c: number) => ({ insumoId: '1', insumoNombre: n, unidadReceta: 'G', cantidad: c, costoUnitarioReceta: 0.01, subtotalCosto: c / 100 });
const detalle = (saborId: string | null, usaGeneral: boolean, propia: boolean): RecetaProductoDetalle => ({
  productoId: '7',
  productoNombre: 'DONA',
  categoria: null,
  tieneReceta: true,
  saborId,
  usaGeneral,
  sabores: [
    { id: '20', nombre: 'Chocolate', tieneRecetaPropia: propia, costo: 2 },
    { id: '21', nombre: 'Fresa', tieneRecetaPropia: false, costo: 1 },
  ],
  tamanos: [{ tamanoId: '1', tamanoNombre: 'Unidad', precio: 10, costo: 1, margenSoles: 9, margenPorcentaje: 90, tieneRecetaTamano: true, lineas: [linea(propia ? 'Harina propia' : 'Harina general', 100)] }],
});

function sesion(editar: boolean) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => (editar ? true : p === 'recetas/ver') } as any);
}

describe('Receta por sabor (selector)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(stockApi, 'listarRecetas').mockResolvedValue({
      productos: [{ id: '7', nombre: 'DONA', categoriaId: null, categoriaNombre: null, tieneReceta: true, precio: 10, costo: 1, margenSoles: 9, margenPorcentaje: 90, cantidadTamanos: 1 }],
      totalProductos: 1,
      platosSinMargen: 0,
    });
  });

  it('un sabor sin receta propia avisa que usa la general y ofrece crear la suya', async () => {
    sesion(true);
    const obtener = vi.spyOn(stockApi, 'obtenerReceta').mockImplementation(async (_p, s) => (s ? detalle(s, true, false) : detalle(null, false, true)));
    render(<RecetasTab insumos={[]} />);
    await screen.findByRole('group', { name: 'Receta para' });
    fireEvent.click(screen.getByRole('button', { name: /Chocolate/ }));
    await screen.findByText(/usa la receta general/i);
    expect(obtener).toHaveBeenCalledWith('7', '20');
    expect(screen.getByRole('button', { name: 'Crear receta propia para este sabor' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Quitar receta del sabor/ })).toBeNull();
  });

  it('crear receta propia abre el editor con las líneas de la general y guarda con sabor_id', async () => {
    sesion(true);
    vi.spyOn(stockApi, 'obtenerReceta').mockImplementation(async (_p, s) => (s ? detalle(s, true, false) : detalle(null, false, true)));
    const guardar = vi.spyOn(stockApi, 'guardarReceta').mockResolvedValue({} as any);
    render(<RecetasTab insumos={[]} />);
    await screen.findByRole('group', { name: 'Receta para' });
    fireEvent.click(screen.getByRole('button', { name: /Chocolate/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Crear receta propia para este sabor' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /^Guardar/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar receta' }));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect(guardar.mock.calls[0][1]).toMatchObject({ sabor_id: '20', lineas: [{ insumo_id: '1', cantidad: 100 }] });
  });

  it('quitar pide Sí/No: No no borra, Sí borra y vuelve a la general', async () => {
    sesion(true);
    vi.spyOn(stockApi, 'obtenerReceta').mockImplementation(async (_p, s) => (s ? detalle(s, false, true) : detalle(null, false, true)));
    const quitar = vi.spyOn(stockApi, 'quitarRecetaSabor').mockResolvedValue(detalle('20', true, false));
    render(<RecetasTab insumos={[]} />);
    await screen.findByRole('group', { name: 'Receta para' });
    fireEvent.click(screen.getByRole('button', { name: /Chocolate · propia/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar receta del sabor (volver a la general)' }));
    fireEvent.click(await screen.findByRole('button', { name: /^No/ }));
    expect(quitar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar receta del sabor (volver a la general)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('7', '20'));
    await screen.findByText(/usa la receta general/i);
  });

  it('sin permiso de editar se ve el selector pero no los botones', async () => {
    sesion(false);
    vi.spyOn(stockApi, 'obtenerReceta').mockImplementation(async (_p, s) => (s ? detalle(s, true, false) : detalle(null, false, true)));
    render(<RecetasTab insumos={[]} />);
    await screen.findByRole('group', { name: 'Receta para' });
    fireEvent.click(screen.getByRole('button', { name: /Chocolate/ }));
    await screen.findByText(/usa la receta general/i);
    expect(screen.queryByRole('button', { name: /Crear receta propia/ })).toBeNull();
  });
});
