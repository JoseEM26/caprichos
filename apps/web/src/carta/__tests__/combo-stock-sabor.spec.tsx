import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SelectorEleccionCombo } from '../SelectorEleccionCombo';
import { usosDeSabor, type ParteEleccion } from '../ReemplazoCombo';
import { Reparto } from '../../comun/saboresMezcla';

const parte: ParteEleccion = {
  parteId: '200',
  cantidad: 2,
  opciones: [
    {
      id: '40',
      nombre: 'DONA ARTESANAL',
      disponible: true,
      sabores: [
        { id: '501', nombre: 'Fresa', disponible: true, saldo: 1 },
        { id: '502', nombre: 'Oreo', disponible: false, saldo: 0 },
      ],
    },
    { id: '42', nombre: 'KEKE', disponible: false, sinStock: true },
  ],
};

// Como la ventana: los usos salen de las partes del combo y del carrito (externo = otras líneas del carrito)
function Caja({ externos = {} }: { externos?: Record<string, number> }) {
  const [valor, setValor] = useState<Reparto>({});
  const carrito = [{ sabores: Object.entries(externos).map(([saborId, cantidad]) => ({ saborId, cantidad })) }];
  const usos = usosDeSabor(carrito, { '200': valor });
  return <SelectorEleccionCombo parte={parte} unidades={1} valor={valor} onCambio={setValor} usos={usos} />;
}

describe('elecciones de combo con stock', () => {
  it('un sabor sin saldo y un producto sin stock salen «No hay stock» y no se pueden elegir', () => {
    render(<Caja />);
    expect(screen.getByRole('button', { name: 'Agregar DONA ARTESANAL · Oreo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Agregar KEKE' })).toBeDisabled();
    expect(screen.getAllByText('No hay stock')).toHaveLength(2);
  });

  it('el + de un sabor no supera su saldo (Fresa 1): después de elegirla queda bloqueado', () => {
    render(<Caja />);
    const mas = screen.getByRole('button', { name: 'Agregar DONA ARTESANAL · Fresa' });
    expect(mas).not.toBeDisabled();
    fireEvent.click(mas);
    expect(screen.getByLabelText('Cantidad de DONA ARTESANAL · Fresa')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Agregar DONA ARTESANAL · Fresa' })).toBeDisabled();
  });

  it('lo que ya va en el carrito o en otra parte del combo descuenta del saldo del sabor', () => {
    render(<Caja externos={{ '501': 1 }} />);
    expect(screen.getByRole('button', { name: 'Agregar DONA ARTESANAL · Fresa' })).toBeDisabled();
  });
});
