import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import { textoSabores } from '../cocinaTipos';
import type { Comanda } from '../cocinaTipos';

const sabores = [
  { nombre: 'Fresa', cantidad: 3 },
  { nombre: 'Oreo', cantidad: 3 },
];

const comanda: Comanda = {
  id: '9-1',
  pedidoId: '9',
  areaId: '1',
  areaNombre: 'Postres',
  ticket: 'CP-9',
  codigo: 'CP-9',
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 2,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [{ id: 'a', nombre: 'Donas', cantidad: 1, tamano: 'Media docena', sabores, opciones: [] }],
  despejada: false,
};

describe('Cocina: reparto por sabor', () => {
  it('textoSabores arma «3 Fresa · 3 Oreo» y cae al sabor simple', () => {
    expect(textoSabores({ sabores })).toBe('3 Fresa · 3 Oreo');
    expect(textoSabores({ sabor: 'Fresa' })).toBe('Fresa');
    expect(textoSabores({})).toBeNull();
  });
  it('la tarjeta muestra el reparto en negrita', () => {
    render(<ComandaTarjeta comanda={comanda} onDespejar={() => {}} />);
    const el = screen.getByTestId('linea-sabores');
    expect(el).toHaveTextContent('3 Fresa · 3 Oreo');
    expect(el).toHaveStyle({ fontWeight: '800' });
  });
});
