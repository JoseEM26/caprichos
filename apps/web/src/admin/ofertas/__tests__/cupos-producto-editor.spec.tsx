import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorPartesCombo } from '../EditorPartesCombo';
import { CategoriaEditor, Parte, ProductoEditor, partesParaGuardar } from '../partesComboModelo';

const categorias: CategoriaEditor[] = [{ id: '8', nombre: 'Donas' }, { id: '10', nombre: 'Postres' }];
const productos: ProductoEditor[] = [
  { id: '40', nombre: 'Dona X', categoriaId: '8' },
  { id: '50', nombre: 'Torta Y', categoriaId: '10' },
];
const inicial: Parte[] = [{ tipoParte: 'A_ELECCION', cantidad: 2, categorias: ['8', '10'], productos: [], alternativas: [], saboresIds: [], productosExcluidos: [], uid: 'a' }];

function Contenedor({ alCambiar }: { alCambiar: (p: Parte[]) => void }) {
  const [partes, setPartes] = useState<Parte[]>(inicial);
  return <EditorPartesCombo partes={partes} productos={productos} categorias={categorias} onCambiar={(p) => { setPartes(p); alCambiar(p); }} />;
}

describe('Editor: cupos que ocupa cada producto', () => {
  it('guarda la torta con 2 lugares y no guarda los de 1 lugar', () => {
    let ultimo: Parte[] = inicial;
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    const torta = screen.getByLabelText('Cupos que ocupa Torta Y') as HTMLSelectElement;
    expect(torta.value).toBe('1');
    fireEvent.change(torta, { target: { value: '2' } });
    expect(ultimo[0].cuposProducto).toEqual({ '50': 2 });
    expect(partesParaGuardar(ultimo, categorias, productos)[0]).toMatchObject({ cuposProducto: { '50': 2 } });
    fireEvent.change(screen.getByLabelText('Cupos que ocupa Torta Y'), { target: { value: '1' } });
    expect(ultimo[0].cuposProducto).toBeUndefined();
  });

  it('el máximo es la cantidad de la parte y se limpia si baja la cantidad', () => {
    const base: Parte = { ...inicial[0], cuposProducto: { '50': 2 } };
    expect(partesParaGuardar([{ ...base, cantidad: 1 }], categorias, productos)[0]).not.toHaveProperty('cuposProducto');
    expect(partesParaGuardar([base], categorias, productos)[0]).toHaveProperty('cuposProducto');
    render(<EditorPartesCombo partes={[base]} productos={productos} categorias={categorias} onCambiar={() => {}} />);
    expect(screen.getByLabelText('Cupos que ocupa Dona X').querySelectorAll('option')).toHaveLength(2);
  });
});
