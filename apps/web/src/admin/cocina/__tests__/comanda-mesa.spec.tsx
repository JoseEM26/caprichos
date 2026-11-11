import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import { HistorialView } from '../HistorialView';
import { textoMesa } from '../InsigniaMesa';
import type { Comanda } from '../cocinaTipos';

const comanda = (over: Partial<Comanda> = {}): Comanda => ({
  id: '401-1',
  pedidoId: '401',
  areaId: '1',
  areaNombre: 'Cocina',
  ticket: 'CP-401',
  codigo: 'CP-401',
  canal: 'SALON',
  modalidad: 'MESA',
  mesa: 'Mesa 6',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [{ id: 'l1', nombre: 'Pizza', cantidad: 1, opciones: [], personas: [], nota: null }],
  despejada: false,
  ...over,
});

const pintar = (c: Comanda, extra: object = {}) =>
  render(<ComandaTarjeta comanda={c} onDespejar={() => {}} {...extra} />);

describe('Insignia de mesa en la comanda', () => {
  it('pedido de mesa: insignia grande «Mesa 6» con aria-label', () => {
    pintar(comanda());
    const i = screen.getByTestId('comanda-mesa');
    expect(i).toHaveTextContent('Mesa 6');
    expect(screen.getByLabelText('Mesa 6')).toBe(i);
    expect(i).toHaveStyle({ fontWeight: '800' });
  });

  it('en la vista de todas las áreas (pantalla completa) también sale', () => {
    pintar(comanda(), { mostrarArea: true, soloArea: false, soloLectura: true });
    expect(screen.getByTestId('comanda-mesa')).toHaveTextContent('Mesa 6');
  });

  it('varias mesas', () => {
    pintar(comanda({ mesa: 'Mesas 4 y 5' }));
    expect(screen.getByLabelText('Mesas 4 y 5')).toBeInTheDocument();
  });

  it('pedido viejo con solo el número: «Mesa 3»', () => {
    pintar(comanda({ mesa: '3' }));
    expect(screen.getByLabelText('Mesa 3')).toBeInTheDocument();
  });

  it('pedido extra: misma mesa y se ve que es extra', () => {
    pintar(comanda({ extraDe: 'CP-400' }));
    expect(screen.getByLabelText('Mesa 6')).toBeInTheDocument();
    expect(screen.getByTestId('comanda-extra')).toHaveTextContent('EXTRA de CP-400');
  });

  it('mesa sin dato: «Mesa sin asignar»', () => {
    pintar(comanda({ mesa: null }));
    expect(screen.getByLabelText('Mesa sin asignar')).toBeInTheDocument();
  });

  it('lista de espera: «En espera de mesa»', () => {
    pintar(comanda({ mesa: 'En espera de mesa', enEsperaMesa: true }));
    expect(screen.getByLabelText('En espera de mesa')).toBeInTheDocument();
  });

  it.each(['RECOGER', 'LLEVAR', 'DELIVERY'])('%s no lleva insignia de mesa', (modalidad) => {
    pintar(comanda({ modalidad, mesa: null }));
    expect(screen.queryByTestId('comanda-mesa')).toBeNull();
    expect(screen.queryByText(/sin asignar/i)).toBeNull();
  });

  it('comer en el local sin mesa no inventa «sin asignar»', () => {
    expect(textoMesa({ modalidad: 'COMER_LOCAL', mesa: null })).toBeNull();
  });

  it('el historial también muestra la mesa', () => {
    render(
      <HistorialView
        historial={[
          {
            id: '9-1', pedidoId: '9', areaId: '1', areaNombre: 'Cocina', ticket: 'CP-9', codigo: 'CP-9',
            canal: 'SALON', modalidad: 'MESA', mesa: 'Mesas 4 y 5', llego_en: null, despejada_en: null,
            tiempoPreparacionMin: 3, lineas: [],
          } as any,
        ]}
        nombreAreaActual="Cocina"
        alDevolverExito={() => {}}
      />,
    );
    expect(screen.getByLabelText('Mesas 4 y 5')).toBeInTheDocument();
  });
});
