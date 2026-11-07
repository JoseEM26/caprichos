import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import type { Comanda } from '../cocinaTipos';

const comanda: Comanda = {
  id: '9-1',
  pedidoId: '9',
  areaId: '1',
  areaNombre: 'Barra',
  ticket: 'CP-9',
  codigo: 'CP-9',
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 2,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [
    { id: 'a', nombre: 'Frappe fresa', cantidad: 2, opciones: ['Sin crema'], personas: ['Ana', 'Luis'] },
    { id: 'b', nombre: 'Frappe fresa', cantidad: 1, opciones: [], personas: ['Rosa'] },
    { id: 'c', nombre: 'Americano', cantidad: 1, opciones: [], personas: [] },
  ],
  despejada: false,
};

describe('Comanda: nombre de cada bebida', () => {
  it('muestra una línea «Bebida — para X» por cada nombre, y nada si no hay nombres', () => {
    render(<ComandaTarjeta comanda={comanda} onDespejar={() => {}} />);
    expect(screen.getByText('Frappe fresa — para Ana')).toBeInTheDocument();
    expect(screen.getByText('Frappe fresa — para Luis')).toBeInTheDocument();
    expect(screen.getByText('Frappe fresa — para Rosa')).toBeInTheDocument();
    expect(screen.getAllByTestId('linea-personas')).toHaveLength(2);
  });
});
