import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProgresoPedido } from '../ProgresoPedido';
import type { ProgresoPedido as Progreso } from '../tipos';

const base: Progreso = {
  etapa: 'EN_COCINA',
  etiqueta: 'En cocina',
  areas: [],
  listasDe: 0,
  totalAreas: 0,
  porcentaje: 0,
  enCamino: false,
};

describe('ProgresoPedido', () => {
  it('parcial: muestra la etiqueta, el estado de cada área y la barra de avance', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Bebidas, faltan Salados',
      areas: [
        { nombre: 'Bebidas', estado: 'LISTA', lineas: 2 },
        { nombre: 'Salados', estado: 'PREPARANDO', lineas: 1 },
      ],
      listasDe: 1,
      totalAreas: 2,
      porcentaje: 50,
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="completo" />);

    expect(screen.getByText('Cocina: listas Bebidas, faltan Salados')).toBeInTheDocument();
    const areas = screen.getByLabelText('Estado por área');
    expect(within(areas).getByText('Bebidas')).toBeInTheDocument();
    expect(within(areas).getByText('lista')).toHaveClass('pp-area--lista');
    expect(within(areas).getByText('Salados')).toBeInTheDocument();
    expect(within(areas).getByText('preparando')).toHaveClass('pp-area--preparando');
    const barra = screen.getByRole('progressbar', { name: 'Avance de cocina' });
    expect(barra).toHaveAttribute('aria-valuenow', '50');
    // La etapa actual de la línea de tiempo es «Cocina»
    const actual = screen.getByRole('list', { name: 'Etapas del pedido' }).querySelector('[aria-current="step"]');
    expect(actual).toHaveTextContent('Cocina');
  });

  it('en camino: la línea de tiempo incluye «En camino» como etapa actual y la etiqueta lleva el tiempo', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'EN_CAMINO',
      etiqueta: 'En camino, llega en unos 15 a 20 minutos',
      enCamino: true,
      etaMin: 15,
      etaMax: 20,
      porcentaje: 100,
    };

    render(<ProgresoPedido progreso={progreso} modalidad="DELIVERY" variante="completo" />);

    expect(screen.getByText('En camino, llega en unos 15 a 20 minutos')).toBeInTheDocument();
    const pasos = screen.getByRole('list', { name: 'Etapas del pedido' }).querySelectorAll('li');
    expect(pasos).toHaveLength(5);
    expect(pasos[3]).toHaveAttribute('aria-current', 'step');
    expect(pasos[3]).toHaveTextContent('En camino');
  });

  it('esperando al cliente en recojo: listo sin repartidor, y la etapa actual es «Listo»', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'ESPERANDO_CLIENTE',
      etiqueta: 'Listo, esperando al cliente',
      listasDe: 2,
      totalAreas: 2,
      porcentaje: 100,
      areas: [
        { nombre: 'Bebidas', estado: 'LISTA', lineas: 1 },
        { nombre: 'Salados', estado: 'LISTA', lineas: 1 },
      ],
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="completo" />);

    expect(screen.getByText('Listo, esperando al cliente')).toBeInTheDocument();
    const pasos = screen.getByRole('list', { name: 'Etapas del pedido' }).querySelectorAll('li');
    expect(pasos).toHaveLength(4);
    expect(pasos[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('completo: cada área lista sus productos como «cantidad × nombre»', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Bebidas, faltan Postres',
      listasDe: 1,
      totalAreas: 2,
      porcentaje: 50,
      areas: [
        { nombre: 'Bebidas', estado: 'LISTA', lineas: 2, productos: [{ nombre: 'Frappé', cantidad: 2 }, { nombre: 'Limonada', cantidad: 1 }] },
        { nombre: 'Postres', estado: 'PENDIENTE', lineas: 1, productos: [{ nombre: 'Torta', cantidad: 1 }] },
      ],
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="completo" sinLinea />);

    const areas = screen.getByLabelText('Estado por área');
    expect(within(areas).getByText('2 × Frappé')).toBeInTheDocument();
    expect(within(areas).getByText('1 × Limonada')).toBeInTheDocument();
    expect(within(areas).getByText('1 × Torta')).toBeInTheDocument();
    expect(within(areas).getByText('pendiente')).toBeInTheDocument();
  });

  it('compacto: «Falta» solo con las áreas no listas y sus productos', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Salados, faltan Bebidas y Postres',
      listasDe: 1,
      totalAreas: 3,
      porcentaje: 33,
      areas: [
        { nombre: 'Bebidas', estado: 'PREPARANDO', lineas: 2, productos: [{ nombre: 'Frappé', cantidad: 2 }, { nombre: 'Limonada', cantidad: 1 }] },
        { nombre: 'Salados', estado: 'LISTA', lineas: 1, productos: [{ nombre: 'Empanada', cantidad: 1 }] },
        { nombre: 'Postres', estado: 'PENDIENTE', lineas: 1, productos: [{ nombre: 'Torta', cantidad: 1 }] },
      ],
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="compacto" />);

    expect(screen.getByText('Falta: Bebidas (2 Frappé, 1 Limonada) · Postres (1 Torta)')).toBeInTheDocument();
    expect(screen.queryByText(/Empanada/)).toBeNull();
  });

  it('compacto: si todas las áreas están listas no agrega línea de falta', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'ESPERANDO_CLIENTE',
      etiqueta: 'Listo, esperando al cliente',
      listasDe: 1,
      totalAreas: 1,
      porcentaje: 100,
      areas: [{ nombre: 'Bebidas', estado: 'LISTA', lineas: 1, productos: [{ nombre: 'Frappé', cantidad: 1 }] }],
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="compacto" />);

    expect(screen.getByText('Listo, esperando al cliente')).toBeInTheDocument();
    expect(screen.queryByText(/^Falta:/)).toBeNull();
  });

  it('compacto: solo la etiqueta y la barra, sin línea de tiempo ni áreas', () => {
    const progreso: Progreso = {
      ...base,
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Bebidas, faltan Salados',
      areas: [{ nombre: 'Bebidas', estado: 'LISTA', lineas: 2 }],
      totalAreas: 2,
      listasDe: 1,
      porcentaje: 50,
    };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="compacto" />);

    expect(screen.getByText('Cocina: listas Bebidas, faltan Salados')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Etapas del pedido' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado por área')).not.toBeInTheDocument();
  });

  it('sin línea de tiempo cuando la pantalla ya muestra sus pasos', () => {
    const progreso: Progreso = { ...base, etapa: 'PARCIAL', etiqueta: 'Cocina: listas Bebidas, faltan Salados', porcentaje: 50, listasDe: 1, totalAreas: 2, areas: [{ nombre: 'Bebidas', estado: 'LISTA', lineas: 1 }] };

    render(<ProgresoPedido progreso={progreso} modalidad="RECOGER" variante="completo" sinLinea />);

    expect(screen.queryByRole('list', { name: 'Etapas del pedido' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Estado por área')).toBeInTheDocument();
  });

  it('anulado: solo la etiqueta, sin barra ni áreas', () => {
    const progreso: Progreso = { ...base, etapa: 'ANULADO', etiqueta: 'Anulado', areas: [{ nombre: 'Bebidas', estado: 'PENDIENTE', lineas: 1 }], totalAreas: 1 };

    render(<ProgresoPedido progreso={progreso} modalidad="MESA" variante="completo" />);

    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado por área')).not.toBeInTheDocument();
  });

  it('sin progreso (respuesta anterior de la API): no pinta nada', () => {
    const { container } = render(<ProgresoPedido progreso={undefined} modalidad="MESA" variante="compacto" />);
    expect(container).toBeEmptyDOMElement();
  });
});
