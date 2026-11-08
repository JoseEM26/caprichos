import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorPartesCombo } from '../EditorPartesCombo';
import {
  Parte, ProductoEditor, errorDePartes, normalizarPartes, nuevoFijo, partesParaGuardar, resumenParaCliente,
} from '../partesComboModelo';

const productos: ProductoEditor[] = [{ id: '51', nombre: 'Papas nativas', categoriaId: '1' }];

function Contenedor({ inicial = [] as Parte[], alCambiar }: { inicial?: Parte[]; alCambiar?: (p: Parte[]) => void }) {
  const [partes, setPartes] = useState<Parte[]>(inicial);
  return <EditorPartesCombo partes={partes} productos={productos} categorias={[]} onCambiar={(p) => { setPartes(p); alCambiar?.(p); }} />;
}

const fijo = (extra: Partial<Parte> = {}): Parte => ({ ...nuevoFijo(), productos: ['51'], ...extra });

describe('Editor de partes: parte opcional', () => {
  it('un FIJO muestra el interruptor «El cliente puede quitarla (opcional)» y, al activarlo, los campos del extra', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor inicial={[fijo()]} alCambiar={(p) => (ultimo = p)} />);
    expect(screen.queryByLabelText('Máximo que puede llevar')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente puede quitarla \(opcional\)/ }));
    expect(screen.getByText('Incluidas en el precio')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Máximo que puede llevar'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Precio por cada extra'), { target: { value: '6' } });
    expect(screen.getByRole('checkbox', { name: /Aparece marcada por defecto/ })).toBeChecked();
    expect(ultimo[0]).toMatchObject({ opcional: true, cantidadMax: 3, precioExtra: 6 });
  });

  it('el tipo «Opcional» del menú agrega un FIJO ya opcional con su ayuda', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opcional' }));
    expect(ultimo[0]).toMatchObject({ tipoParte: 'FIJO', opcional: true, incluidaPorDefecto: true });
  });

  it('valida: máximo menor que las incluidas o extra negativo se explican con palabras simples', () => {
    expect(errorDePartes([fijo({ opcional: true, cantidad: 2, cantidadMax: 1 })])).toMatch(/máximo que puede llevar/);
    expect(errorDePartes([fijo({ opcional: true, precioExtra: -1 })])).toMatch(/precio de cada extra/);
    expect(errorDePartes([fijo({ opcional: true, cantidadMax: 3, precioExtra: 6 })])).toBeNull();
  });

  it('guarda los campos solo si es opcional; el FIJO normal queda opcional:false', () => {
    const guardado = partesParaGuardar([fijo({ opcional: true, cantidadMax: 3, precioExtra: 6, incluidaPorDefecto: false }), fijo()], [], productos);
    expect(guardado[0]).toMatchObject({ opcional: true, cantidadMin: 0, cantidadMax: 3, incluidaPorDefecto: false, precioExtra: 6 });
    expect(guardado[1]).toMatchObject({ opcional: false });
    expect(guardado[1]).not.toHaveProperty('precioExtra');
  });

  it('el resumen lo muestra: «incluida 1 · se puede quitar · extra S/ 6.00 hasta 3»', () => {
    const partes = normalizarPartes([fijo({ opcional: true, cantidadMax: 3, precioExtra: 6 })], [], productos);
    const [l] = resumenParaCliente(partes, [], productos);
    expect(l.titulo).toBe('Papas nativas: incluida 1 · se puede quitar · extra S/ 6.00 hasta 3');
  });
});
