import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PaginaNovedades, tamanoDeNovedad, type NovedadCarta } from '../carta/PaginaNovedades';

const base: Omit<NovedadCarta, 'id' | 'titulo' | 'tipo'> = { orden: 0, activo: true, fotos: [] };

describe('novedades de la carta: mosaico, detalle y estados', () => {
  it('el mosaico aplica el tamaño del contrato y cae en MEDIANO si falta o no es válido', () => {
    const novedades: NovedadCarta[] = [
      { ...base, id: 'a', tipo: 'AVISO', titulo: 'Chica', tamano: 'CHICO' },
      { ...base, id: 'b', tipo: 'AVISO', titulo: 'Grande', tamano: 'GRANDE' },
      { ...base, id: 'c', tipo: 'AVISO', titulo: 'Ancha', tamano: 'ANCHO' },
      { ...base, id: 'd', tipo: 'AVISO', titulo: 'Sin tamaño' },
      { ...base, id: 'e', tipo: 'AVISO', titulo: 'Tamaño raro', tamano: 'XL' },
    ];
    const { container } = render(<PaginaNovedades novedades={novedades} onVerCarta={() => {}} />);
    const tamanos = Array.from(container.querySelectorAll('article')).map((a) => a.getAttribute('data-tamano'));
    expect(tamanos).toEqual(['CHICO', 'GRANDE', 'ANCHO', 'MEDIANO', 'MEDIANO']);
    const grande = container.querySelector('article[data-tamano="GRANDE"]') as HTMLElement;
    expect(grande.style.gridColumn).toBe('span 2');
    expect(grande.style.gridRow).toBe('span 2');
    const ancha = container.querySelector('article[data-tamano="ANCHO"]') as HTMLElement;
    expect(ancha.style.gridColumn).toBe('span 4');
  });

  it('tamanoDeNovedad: valor ausente o inválido es MEDIANO', () => {
    expect(tamanoDeNovedad({ ...base, id: 'x', tipo: 'AVISO', titulo: 'x' })).toBe('MEDIANO');
    expect(tamanoDeNovedad({ ...base, id: 'x', tipo: 'AVISO', titulo: 'x', tamano: 'grande' })).toBe('GRANDE');
  });

  it('la ventana de detalle abre con el toque y cierra con Escape', () => {
    const novedades: NovedadCarta[] = [
      { ...base, id: '1', tipo: 'AVISO', titulo: 'Aviso para detalle', texto: 'Texto completo del aviso' },
    ];
    render(<PaginaNovedades novedades={novedades} onVerCarta={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Aviso para detalle' }));
    const ventana = screen.getByRole('dialog', { name: 'Aviso para detalle' });
    expect(within(ventana).getByText('Texto completo del aviso')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('en el detalle de una promoción el botón dice Pedir ahora y lleva a la carta', () => {
    const onVerCarta = vi.fn();
    const novedades: NovedadCarta[] = [{ ...base, id: 'p', tipo: 'PROMOCION', titulo: 'Promo del día' }];
    render(<PaginaNovedades novedades={novedades} onVerCarta={onVerCarta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Promo del día' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir ahora' }));
    expect(onVerCarta).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra esqueletos mientras carga', () => {
    render(<PaginaNovedades novedades={[]} onVerCarta={() => {}} cargando />);
    expect(screen.getByRole('status', { name: 'Cargando novedades' })).toBeTruthy();
    expect(screen.queryByText('Pronto tendremos novedades para ti')).toBeNull();
  });

  it('muestra error con Reintentar', () => {
    const alReintentar = vi.fn();
    render(<PaginaNovedades novedades={[]} onVerCarta={() => {}} error="Sin conexión" alReintentar={alReintentar} />);
    expect(screen.getByText('No se pudieron cargar las novedades')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });
});
