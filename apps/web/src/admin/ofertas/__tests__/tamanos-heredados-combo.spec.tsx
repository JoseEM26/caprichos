import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalCombo } from '../ModalCombo';
import { OfertaItem } from '../ofertasApi';
import { mezclarTamanos, tamanosHeredados } from '../tamanosCombo';

vi.mock('../../catalogo/catalogoApi', () => ({
  catalogoApi: {
    listarListas: vi.fn().mockResolvedValue([
      { id: '1', codigo: 'TAMANO', nombre: 'Tamaños', valores: [
        { id: '1', nombre: 'Regular 12 oz', orden: 1, activo: true },
        { id: '2', nombre: 'Grande 16 oz', orden: 2, activo: true },
        { id: '3', nombre: 'Extra 21 oz', orden: 3, activo: true },
        { id: '4', nombre: 'Mini 8 oz', orden: 0, activo: true },
      ] },
    ]),
  },
}));

const tam = (valorId: string, nombre: string) => ({ id: `t${valorId}`, nombre, precio: 10, valorId });
const productos = [
  { id: '1', nombre: 'Frappe Oreo', categoriaId: '2', categoria: 'Frappes', precio: 14, tamanos: [tam('1', 'Regular 12 oz'), tam('2', 'Grande 16 oz'), tam('3', 'Extra 21 oz')] },
  { id: '2', nombre: 'Capuccino', categoriaId: '3', categoria: 'Calientes', precio: 9, tamanos: [tam('1', 'Regular 12 oz'), tam('2', 'Grande 16 oz')] },
  { id: '3', nombre: 'Dona', categoriaId: '4', categoria: 'Donas', precio: 5, tamanos: [tam('9', 'Media docena')] },
];
const categorias = [
  { id: '2', nombre: 'Frappes', productos: [] },
  { id: '3', nombre: 'Calientes', productos: [] },
  { id: '4', nombre: 'Donas', productos: [] },
];
const bebidas = { id: '1', tipo: 'A_ELECCION' as const, cantidad: 2, categorias: ['2', '3'], productos: [] };

describe('tamaños del combo heredados de las bebidas', () => {
  it('une los tamaños reales de las bebidas y marca los que no tienen todas (la dona no cuenta si es fija)', () => {
    const h = tamanosHeredados([bebidas, { id: '2', tipo: 'FIJO' as const, cantidad: 1, categorias: [], productos: ['3'] }], productos, categorias);
    expect(h).toEqual([
      { valorId: '1', nombre: 'Regular 12 oz', enTodas: true },
      { valorId: '2', nombre: 'Grande 16 oz', enTodas: true },
      { valorId: '3', nombre: 'Extra 21 oz', enTodas: false },
    ]);
  });

  it('mezclar suma los que faltan sin pisar precios; en combo guardado quedan apagados', () => {
    const h = tamanosHeredados([bebidas], productos, categorias);
    const r = mezclarTamanos([{ tamanoValorId: '1', tamanoNombre: 'Regular 12 oz', precio: 33, activo: true }], h, false);
    expect(r.map((t) => [t.tamanoValorId, t.precio, t.activo])).toEqual([['1', 33, true], ['2', 0, false], ['3', 0, false]]);
  });

  const duoGuardado: OfertaItem = {
    id: '4', tipo: 'COMBO', nombre: 'Dúo Compartir', descripcion: '', activo: true, creadoEn: '2026-11-01T00:00:00.000Z', alcanceCategoriaId: '2', canales: ['CARTA', 'ADMIN', 'BOT'],
    combosPrecio: [
      { tamanoValorId: '1', tamanoNombre: 'Regular 12 oz', precio: 33 },
      { tamanoValorId: '2', tamanoNombre: 'Grande 16 oz', precio: 37 },
    ],
    combosParte: [{ ...bebidas, nombre: 'Bebidas' }],
  } as any;

  it('un combo con 2 tamaños muestra los 3; el dueño pone precio al tercero y se guardan los 3 con su valor real', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalCombo abierto comboAEditar={duoGuardado} onCerrar={() => {}} onGuardar={onGuardar} productosDisponibles={productos} categorias={categorias} />);

    const filas = await screen.findAllByTestId('fila-tamano-combo');
    await waitFor(() => expect(screen.getAllByTestId('fila-tamano-combo')).toHaveLength(3));
    expect(screen.getByLabelText('Ofrecer Extra 21 oz')).not.toBeChecked();
    expect(screen.getByText('No todas las bebidas lo tienen')).toBeInTheDocument();
    expect(filas.length).toBeGreaterThan(0);

    const extra = screen.getAllByTestId('fila-tamano-combo')[2];
    fireEvent.click(within(extra).getByLabelText('Ofrecer Extra 21 oz'));
    fireEvent.change(within(extra).getByLabelText('Precio del tamaño'), { target: { value: '41' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar combo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].tamanos).toEqual([
      { tamanoValorId: '1', tamanoNombre: 'Regular 12 oz', precio: 33 },
      { tamanoValorId: '2', tamanoNombre: 'Grande 16 oz', precio: 37 },
      { tamanoValorId: '3', tamanoNombre: 'Extra 21 oz', precio: 41 },
    ]);
  });

  it('«+ Tamaño» agrega uno de la lista TAMANO y sin precio no se guarda', async () => {
    render(<ModalCombo abierto comboAEditar={duoGuardado} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={productos} categorias={categorias} />);
    const combo = await screen.findByLabelText('+ Tamaño');
    await waitFor(() => expect(within(combo).getByRole('option', { name: 'Mini 8 oz' })).toBeInTheDocument());
    fireEvent.change(combo, { target: { value: '4' } });
    expect(screen.getByLabelText('Ofrecer Mini 8 oz')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Traer tamaños de las bebidas' })).toBeInTheDocument();
  });
});
