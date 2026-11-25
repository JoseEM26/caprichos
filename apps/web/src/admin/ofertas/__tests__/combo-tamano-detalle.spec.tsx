import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalCombo } from '../ModalCombo';
import type { OfertaItem } from '../ofertasApi';

vi.mock('../../catalogo/catalogoApi', () => ({
  catalogoApi: { listarListas: vi.fn().mockResolvedValue([{ id: '1', codigo: 'TAMANO', nombre: 'Tamaños', valores: [] }]) },
}));

const juguetes = [
  { id: '1', nombre: 'Oso', categoriaId: '2', categoria: 'Juguetes', precio: 5, tamanos: [] },
  { id: '2', nombre: 'Auto', categoriaId: '2', categoria: 'Juguetes', precio: 5, tamanos: [] },
];
const categorias = [{ id: '2', nombre: 'Juguetes', productos: [] }];

/** Combo guardado: Personal (7) y Familiar (8); la parte «Juguetes» elige 2 y en Familiar 4. */
const combo: OfertaItem = {
  id: '4', tipo: 'COMBO', nombre: 'Combo Juguetes', descripcion: 'Del combo', activo: true, creadoEn: '2026-11-01T00:00:00.000Z',
  alcanceCategoriaId: '2', canales: ['CARTA', 'ADMIN', 'BOT'],
  combosPrecio: [
    { tamanoValorId: '7', tamanoNombre: 'Personal', precio: 30 },
    { tamanoValorId: '8', tamanoNombre: 'Familiar', precio: 60, descripcion: 'Para 4', fotoArchivoId: '9', fotoUrl: '/archivos/familiar.jpg' },
  ],
  combosParte: [{ id: '1', tipo: 'A_ELECCION', nombre: 'Juguetes', cantidad: 2, categorias: [], productos: ['1', '2'], mostrarImagenes: true, cantidadPorTamano: { '8': 4 } }],
} as any;

async function guardar(c: OfertaItem, antes?: () => void) {
  const onGuardar = vi.fn().mockResolvedValue(undefined);
  render(<ModalCombo abierto comboAEditar={c} onCerrar={() => {}} onGuardar={onGuardar} productosDisponibles={juguetes} categorias={categorias} />);
  await screen.findAllByTestId('fila-tamano-combo');
  antes?.();
  fireEvent.click(screen.getByRole('button', { name: /Guardar combo/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(onGuardar).toHaveBeenCalled());
  return onGuardar.mock.calls[0][0];
}

describe('Combo: detalle por tamaño (descripción, foto y cantidad por parte)', () => {
  it('un combo guardado devuelve lo mismo: descripción, foto, cantidad por tamaño e interruptor de la parte', async () => {
    const payload = await guardar(combo);
    expect(payload.tamanos).toEqual([
      { tamanoValorId: '7', tamanoNombre: 'Personal', precio: 30 },
      { tamanoValorId: '8', tamanoNombre: 'Familiar', precio: 60, descripcion: 'Para 4', fotoArchivoId: '9' },
    ]);
    expect(payload.partes[0]).toMatchObject({ mostrarImagenes: true, cantidad: 2, cantidadPorTamano: { '8': 4 } });
  });

  it('el dueño cambia la descripción y la cantidad de un tamaño y se guardan; vacío vuelve a la cantidad de la parte', async () => {
    const payload = await guardar(combo, () => {
      fireEvent.change(screen.getAllByPlaceholderText('Si lo dejas vacío, se usa la descripción del combo')[0], { target: { value: 'Para 2' } });
      fireEvent.change(screen.getByLabelText(/Cantidad de .* en Personal/), { target: { value: '3' } });
      fireEvent.change(screen.getByLabelText(/Cantidad de .* en Familiar/), { target: { value: '' } });
    });
    expect(payload.tamanos[0]).toMatchObject({ tamanoNombre: 'Personal', descripcion: 'Para 2' });
    expect(payload.partes[0].cantidadPorTamano).toEqual({ '7': 3 });
  });
});
