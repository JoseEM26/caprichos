import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorPartesCombo } from '../EditorPartesCombo';
import { CategoriaEditor, Parte, ProductoEditor } from '../partesComboModelo';

// Los juguetes viven en una categoría oculta: el editor los ofrece igual, marcados como ocultos
const categorias: CategoriaEditor[] = [{ id: '1', nombre: 'Postres' }, { id: '9', nombre: 'Juguetes', oculta: true }];
const productos: ProductoEditor[] = [
  { id: '10', nombre: 'Torta Y', categoriaId: '1' },
  { id: '90', nombre: 'Carrito', categoriaId: '9', oculto: true },
];
const parte: Parte = { tipoParte: 'A_ELECCION', cantidad: 2, categorias: [], productos: [], alternativas: [], saboresIds: [], productosExcluidos: [], uid: 'a' };

describe('Editor de combos: categorías y productos ocultos', () => {
  it('lista la categoría y el producto ocultos, con su marca; los visibles no la llevan', () => {
    render(<EditorPartesCombo partes={[parte]} productos={productos} categorias={categorias} onCambiar={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Juguetes — todos' })).toHaveTextContent('oculta en la carta');
    expect(screen.getByRole('checkbox', { name: 'Carrito' })).toHaveTextContent('oculto en la carta');
    expect(screen.getByRole('checkbox', { name: 'Torta Y' })).not.toHaveTextContent('oculto');
    expect(screen.getByRole('checkbox', { name: 'Postres — todos' })).not.toHaveTextContent('oculta');
  });

  it('avisa si se marca una categoría oculta entera; con productos marcados uno por uno no avisa', () => {
    const porCategoria: Parte = { ...parte, categorias: ['9'] };
    const { rerender } = render(<EditorPartesCombo partes={[porCategoria]} productos={productos} categorias={categorias} onCambiar={() => {}} />);
    expect(screen.getByTestId('aviso-categoria-oculta')).toHaveTextContent('categoría oculta');
    rerender(<EditorPartesCombo partes={[{ ...porCategoria, productos: ['90'] }]} productos={productos} categorias={categorias} onCambiar={() => {}} />);
    expect(screen.queryByText(/Marcaste una categoría oculta/)).not.toBeInTheDocument();
  });
});
