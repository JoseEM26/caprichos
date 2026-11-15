import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconoMedioPago } from '../IconoMedioPago';

describe('IconoMedioPago', () => {
  it('renderiza Yape con alt y aria-label en español', () => {
    render(<IconoMedioPago medio="YAPE" />);
    const img = screen.getByRole('img', { name: 'Yape' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Yape');
    expect(img.getAttribute('src')).toMatch(/yape\.svg/);
  });

  it('renderiza Plin con alt y aria-label en español', () => {
    render(<IconoMedioPago medio="PLIN" />);
    const img = screen.getByRole('img', { name: 'Plin' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Plin');
    expect(img.getAttribute('src')).toMatch(/plin\.svg/);
  });

  it('renderiza Tarjeta (Visa + Mastercard)', () => {
    render(<IconoMedioPago medio="TARJETA" />);
    const img = screen.getByRole('img', { name: 'Tarjeta' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Tarjeta');
    expect(img.getAttribute('src')).toMatch(/tarjeta\.svg/);
  });

  it('renderiza Efectivo con alt y aria-label en español', () => {
    render(<IconoMedioPago medio="EFECTIVO" />);
    const img = screen.getByRole('img', { name: 'Efectivo' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Efectivo');
    expect(img.getAttribute('src')).toMatch(/efectivo\.svg/);
  });

  it('renderiza Transferencia con alt y aria-label en español', () => {
    render(<IconoMedioPago medio="TRANSFERENCIA" />);
    const img = screen.getByRole('img', { name: 'Transferencia' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Transferencia');
    expect(img.getAttribute('src')).toMatch(/transferencia\.svg/);
  });

  it('renderiza Culqi y PAGO_EN_LINEA como Pago en línea', () => {
    const { unmount } = render(<IconoMedioPago medio="CULQI" />);
    expect(screen.getByRole('img', { name: 'Pago en línea' })).toBeInTheDocument();
    unmount();

    render(<IconoMedioPago medio="PAGO_EN_LINEA" />);
    expect(screen.getByRole('img', { name: 'Pago en línea' })).toBeInTheDocument();
  });

  it('admite tamaño personalizado y mantiene proporciones', () => {
    render(<IconoMedioPago medio="YAPE" tamano={40} data-testid="icono-yape" />);
    const img = screen.getByTestId('icono-yape');
    expect(img).toHaveAttribute('height', '40');
    expect(img.style.height).toBe('40px');
  });

  it('soporta minúsculas sin fallar', () => {
    render(<IconoMedioPago medio="yape" data-testid="yape-min" />);
    expect(screen.getByTestId('yape-min')).toHaveAttribute('alt', 'Yape');
  });

  it('ariaHidden oculta la imagen de los lectores de pantalla cuando hay texto descriptivo al lado', () => {
    render(<IconoMedioPago medio="PLIN" ariaHidden data-testid="plin-oculto" />);
    const img = screen.getByTestId('plin-oculto');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('alt', '');
  });
});
