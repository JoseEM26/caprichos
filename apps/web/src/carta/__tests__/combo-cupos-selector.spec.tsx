import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectorEleccionCombo } from '../SelectorEleccionCombo';
import { faltaElegirJuguetes, lugaresElegidos, type ParteEleccion } from '../ReemplazoCombo';
import type { Reparto } from '../../comun/saboresMezcla';

const parte: ParteEleccion = {
  parteId: '1',
  cantidad: 2,
  opciones: [
    { id: '17', nombre: 'Dona X', disponible: true },
    { id: '37', nombre: 'Galleta Y', disponible: true },
    { id: '50', nombre: 'Torta Z', disponible: true, cupos: 2 },
  ],
};

function Caja() {
  const [v, setV] = useState<Reparto>({});
  return <SelectorEleccionCombo parte={parte} unidades={1} valor={v} onCambio={setV} />;
}
const mas = (n: string) => screen.getByRole('button', { name: `Agregar ${n}` }) as HTMLButtonElement;

describe('Selector de combo con cupos', () => {
  it('muestra «ocupa 2» y el contador de lugares', () => {
    render(<Caja />);
    expect(screen.getByTestId('ocupa-50')).toHaveTextContent('ocupa 2');
    expect(screen.getByText('0 de 2 lugares')).toBeInTheDocument();
  });

  it('la torta sola llena los 2 lugares y bloquea todo lo demás', () => {
    render(<Caja />);
    fireEvent.click(mas('Torta Z'));
    expect(screen.getByText('2 de 2 lugares')).toBeInTheDocument();
    expect(screen.getByText('Completo ✓')).toBeInTheDocument();
    for (const n of ['Dona X', 'Galleta Y', 'Torta Z']) expect(mas(n).disabled).toBe(true);
  });

  it('con 1 lugar usado no se puede agregar la torta (sería 3) pero sí otra dona', () => {
    render(<Caja />);
    fireEvent.click(mas('Galleta Y'));
    expect(mas('Torta Z').disabled).toBe(true);
    expect(mas('Dona X').disabled).toBe(false);
  });

  it('exige completar exactamente los lugares', () => {
    expect(lugaresElegidos(parte, { '50': 1 })).toBe(2);
    expect(lugaresElegidos(parte, { '17': 1, '37': 1 })).toBe(2);
    expect(faltaElegirJuguetes([parte], { '1': { '50': 1 } }, 1)).toBe(false);
    expect(faltaElegirJuguetes([parte], { '1': { '50': 1, '37': 1 } }, 1)).toBe(true);
    expect(faltaElegirJuguetes([parte], { '1': { '50': 2 } }, 1)).toBe(true);
    expect(faltaElegirJuguetes([parte], { '1': { '17': 1 } }, 1)).toBe(true);
  });
});
