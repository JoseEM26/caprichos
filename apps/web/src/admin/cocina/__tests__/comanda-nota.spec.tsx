import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import type { Comanda } from '../cocinaTipos';

const comanda = (over: Partial<Comanda> = {}): Comanda => ({
  id: '301-1',
  pedidoId: '301',
  areaId: '1',
  areaNombre: 'Barra',
  ticket: 'CP-301',
  codigo: 'CP-301',
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [
    { id: 'l1', nombre: 'Americano', cantidad: 1, opciones: [], personas: [], nota: 'Sin azúcar' },
    { id: 'l2', nombre: 'Limonada', cantidad: 2, opciones: [], personas: [], nota: null },
  ],
  despejada: false,
  ...over,
});

describe('Comanda: notas del cliente destacadas', () => {
  it('la nota del pedido sale con su testid antes de la lista de líneas', () => {
    render(<ComandaTarjeta comanda={comanda({ nota: 'Timbre roto, llamar al celular' })} onDespejar={() => {}} />);

    const nota = screen.getByTestId('comanda-nota');
    expect(nota).toHaveTextContent('NOTA DEL CLIENTE');
    expect(nota).toHaveTextContent('Timbre roto, llamar al celular');

    const primeraLinea = screen.getByText('Americano');
    expect(nota.compareDocumentPosition(primeraLinea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la nota por línea se resalta con su testid', () => {
    render(<ComandaTarjeta comanda={comanda()} onDespejar={() => {}} />);

    expect(screen.queryByTestId('comanda-nota')).toBeNull();
    const notaLinea = screen.getByTestId('linea-nota');
    expect(notaLinea).toHaveTextContent('Sin azúcar');
    expect(getComputedStyle(notaLinea).backgroundColor).toBe('rgb(255, 243, 196)');
  });

  it('el botón de la tarjeta dice Listo', () => {
    render(<ComandaTarjeta comanda={comanda()} onDespejar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });
});
