import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarruselResenas, barajar, recortarTexto } from '../CarruselResenas';

const resena = (id: string, texto = 'Muy buen café, la atención fue rápida y el ambiente acogedor.', extra: any = {}) => ({
  id,
  autor: `Autor ${id}`,
  foto: null,
  estrellas: 5,
  texto,
  fecha: '2026-10-01T12:00:00.000Z',
  enlace: `https://maps.google.com/?r=${id}`,
  ...extra,
});

async function montar(datos: any) {
  vi.spyOn(api, 'get').mockResolvedValue(datos);
  const r = render(<CarruselResenas />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return r;
}

describe('CarruselResenas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.9999); // sin cambio de orden
    (window as any).matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('sin reseñas no muestra nada', async () => {
    const { container } = await montar({ resenas: [], resumen: null });
    expect(container.querySelector('section')).toBeNull();
  });

  it('si la llamada falla no muestra nada', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('caído'));
    const { container } = render(<CarruselResenas />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('muestra el resumen y la reseña con enlace seguro a Google', async () => {
    await montar({ resenas: [resena('a')], resumen: { rating: 4.8, total: 778 } });
    expect(screen.getByText('4.8 en Google · 778 reseñas')).toBeInTheDocument();
    expect(screen.getByText('Autor a')).toBeInTheDocument();
    expect(screen.getByText('Octubre de 2026 · Reseña de Google')).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: 'Ver en Google Maps' });
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    expect(enlace).toHaveAttribute('href', 'https://maps.google.com/?r=a');
    expect(screen.getByRole('img', { name: '5 de 5 estrellas' })).toBeInTheDocument();
  });

  it('Ver todas en Google aparece junto al resumen si hay enlaceLocal', async () => {
    await montar({ resenas: [resena('a')], resumen: { rating: 4.8, total: 778 }, enlaceLocal: 'https://www.google.com/maps/place/local' });
    const todas = screen.getByRole('link', { name: 'Ver todas en Google' });
    expect(todas).toHaveAttribute('href', 'https://www.google.com/maps/place/local');
    expect(todas).toHaveAttribute('target', '_blank');
    expect(todas).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('sin enlaceLocal no muestra Ver todas en Google; tarjeta sin enlace no muestra Ver en Google Maps', async () => {
    await montar({ resenas: [resena('a', undefined, { enlace: null })], resumen: { rating: 4.8, total: 778 }, enlaceLocal: null });
    expect(screen.queryByRole('link', { name: 'Ver todas en Google' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver en Google Maps' })).toBeNull();
  });

  it('recorta el texto a unos 220 caracteres con puntos suspensivos', () => {
    const largo = 'a'.repeat(300);
    expect(recortarTexto(largo)).toBe('a'.repeat(220) + '...');
    expect(recortarTexto('corto')).toBe('corto');
  });

  it('baraja el orden al cargar', () => {
    const lista = [1, 2, 3, 4];
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(barajar(lista)).not.toEqual(lista);
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(barajar(lista)).toEqual(lista);
    expect(lista).toEqual([1, 2, 3, 4]);
  });

  const cuatro = () => ({ resenas: ['a', 'b', 'c', 'd'].map((x) => resena(x)), resumen: null });
  const primeraVisible = () => screen.getAllByRole('link', { name: 'Ver en Google Maps' })[0].getAttribute('href');

  it('avanza solo cada 6 segundos', async () => {
    await montar(cuatro());
    expect(primeraVisible()).toBe('https://maps.google.com/?r=a');
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(primeraVisible()).toBe('https://maps.google.com/?r=b');
  });

  it('se pausa con el cursor encima', async () => {
    const { container } = await montar(cuatro());
    fireEvent.mouseEnter(container.querySelector('section') as HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });
    expect(primeraVisible()).toBe('https://maps.google.com/?r=a');
  });

  it('respeta prefers-reduced-motion: sin avance automatico', async () => {
    (window as any).matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    await montar(cuatro());
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });
    expect(primeraVisible()).toBe('https://maps.google.com/?r=a');
    fireEvent.click(screen.getByRole('button', { name: 'Reseña siguiente' }));
    expect(primeraVisible()).toBe('https://maps.google.com/?r=b');
  });

  it('flechas y puntos tienen aria-label', async () => {
    await montar({ resenas: ['a', 'b', 'c', 'd'].map((x) => resena(x)), resumen: null });
    expect(screen.getByRole('button', { name: 'Reseña anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver reseña 4 de 4' })).toBeInTheDocument();
  });

  it('en PC muestra tres tarjetas a la vez y oculta al lector las que quedan fuera', async () => {
    await montar({ resenas: ['a', 'b', 'c', 'd'].map((x) => resena(x)), resumen: null });
    expect(screen.getAllByRole('link', { name: 'Ver en Google Maps' })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Reseña siguiente' }));
    expect(screen.getAllByRole('link', { name: 'Ver en Google Maps' })[0]).toHaveAttribute('href', 'https://maps.google.com/?r=b');
  });

  it('la foto que falla cambia a la inicial del nombre', async () => {
    await montar({ resenas: [resena('a', 'Texto de prueba con más de treinta caracteres aquí.', { foto: 'https://x/foto.jpg' })], resumen: null });
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    fireEvent.error(img);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
