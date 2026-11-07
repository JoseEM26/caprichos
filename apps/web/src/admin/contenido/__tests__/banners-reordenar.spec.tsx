import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PopoverBanners, moverEnLista } from '../PopoverBanners';
import type { BannerImagen } from '../../../carta/CarruselBanners';

vi.mock('../edicion/subirFoto', () => ({ subirFotoEdicion: vi.fn() }));

const im = (id: string): BannerImagen => ({ id, url: `/${id}.webp`, alt: `alt ${id}`, activo: true });

function Prueba({ alCambiar }: { alCambiar: (ids: string[]) => void }) {
  const [l, setL] = useState([im('a'), im('b'), im('c')]);
  return (
    <PopoverBanners
      imagenes={l}
      intervaloSeg={5}
      categorias={[]}
      productos={[]}
      onIntervalo={() => {}}
      onImagenes={(n) => { setL(n); alCambiar(n.map((x) => x.id)); }}
    />
  );
}
const asa = (n: number) => screen.getByRole('button', { name: `Arrastrar banner ${n}` });
const orden = () => Array.from(document.querySelectorAll('[data-banner-fila] img')).map((i) => i.getAttribute('alt'));

// jsdom no calcula alturas: cada fila mide 100 px
const medir = () => {
  document.querySelectorAll('[data-banner-fila]').forEach((f, i) => {
    f.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 100, height: 100 }) as DOMRect;
  });
};

describe('Reordenar banners del Diseñador', () => {
  it('moverEnLista', () => {
    expect(moverEnLista(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moverEnLista(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('las flechas Subir/Bajar siguen funcionando y avisan', () => {
    const cambios: string[][] = [];
    render(<Prueba alCambiar={(x) => cambios.push(x)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bajar banner 1' }));
    expect(cambios.at(-1)).toEqual(['b', 'a', 'c']);
    expect(screen.getByRole('log').textContent).toBe('Banner 1 movido a la posición 2');
  });

  it('arrastrar el asa hasta otra fila reordena y marca dónde caerá', () => {
    const cambios: string[][] = [];
    render(<Prueba alCambiar={(x) => cambios.push(x)} />);
    medir();
    fireEvent.pointerDown(asa(1), { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(asa(1), { pointerId: 1, clientY: 250 });
    expect(document.querySelectorAll('[data-destino]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-banner-fila]')[2].hasAttribute('data-destino')).toBe(true);
    fireEvent.pointerUp(asa(1), { pointerId: 1, clientY: 250 });
    expect(cambios.at(-1)).toEqual(['b', 'c', 'a']);
    expect(orden()).toEqual(['alt b', 'alt c', 'alt a']);
    expect(document.querySelectorAll('[data-destino]')).toHaveLength(0);
    expect(screen.getByRole('log').textContent).toBe('Banner 1 movido a la posición 3');
  });

  it('soltar en su misma fila no cambia nada; cancelar tampoco', () => {
    const cambios: string[][] = [];
    render(<Prueba alCambiar={(x) => cambios.push(x)} />);
    medir();
    fireEvent.pointerDown(asa(2), { button: 0, pointerId: 1, clientY: 150 });
    fireEvent.pointerUp(asa(2), { pointerId: 1, clientY: 160 });
    fireEvent.pointerDown(asa(2), { button: 0, pointerId: 1, clientY: 150 });
    fireEvent.pointerMove(asa(2), { pointerId: 1, clientY: 10 });
    fireEvent.pointerCancel(asa(2), { pointerId: 1 });
    expect(cambios).toEqual([]);
  });

  it('teclado: Espacio toma, flechas mueven (el foco sigue al asa), Espacio suelta', () => {
    const cambios: string[][] = [];
    render(<Prueba alCambiar={(x) => cambios.push(x)} />);
    fireEvent.keyDown(asa(2), { key: ' ' });
    expect(asa(2).getAttribute('aria-pressed')).toBe('true');
    // sin tomar no hay movimiento: ya lo está; mover hacia arriba
    fireEvent.keyDown(asa(2), { key: 'ArrowUp' });
    expect(cambios.at(-1)).toEqual(['b', 'a', 'c']);
    expect(screen.getByRole('log').textContent).toBe('Banner 2 movido a la posición 1');
    expect(document.activeElement).toBe(asa(1));
    fireEvent.keyDown(asa(1), { key: ' ' });
    expect(asa(1).getAttribute('aria-pressed')).toBe('false');
    fireEvent.keyDown(asa(1), { key: 'ArrowDown' });
    expect(cambios).toHaveLength(1);
  });

  it('teclado: sin tomar, las flechas no mueven; en los extremos no hace nada', () => {
    const cambios: string[][] = [];
    render(<Prueba alCambiar={(x) => cambios.push(x)} />);
    fireEvent.keyDown(asa(1), { key: 'ArrowDown' });
    fireEvent.keyDown(asa(1), { key: ' ' });
    fireEvent.keyDown(asa(1), { key: 'ArrowUp' });
    expect(cambios).toEqual([]);
  });
});
