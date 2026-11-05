import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalDescuento } from '../ModalDescuento';

function abrir() {
  return render(<ModalDescuento abierto descuentoAEditar={null} onCerrar={() => {}} onGuardar={vi.fn().mockResolvedValue(undefined)} />);
}

describe('ModalDescuento (aviso de delivery)', () => {
  it('muestra siempre el aviso fijo arriba del formulario', () => {
    abrir();
    const aviso = screen.getByTestId('aviso-descuento-productos');
    expect(aviso.getAttribute('role')).toBe('note');
    expect(aviso.textContent).toContain('usa «+ Envío gratis».');
  });

  it('no muestra la advertencia de delivery con un nombre normal', () => {
    abrir();
    fireEvent.change(screen.getByLabelText(/Nombre del descuento/), { target: { value: 'Martes de waffles' } });
    expect(screen.queryByTestId('advertencia-delivery')).toBeNull();
  });

  it('muestra la advertencia con "descuento automatico delivery" (sin tildes ni mayúsculas) sin bloquear guardar', () => {
    abrir();
    fireEvent.change(screen.getByLabelText(/Nombre del descuento/), { target: { value: 'DESCUENTO AUTOMATICO Delivery' } });
    const advertencia = screen.getByTestId('advertencia-delivery');
    expect(advertencia.textContent).toContain('Parece una promoción de delivery');
    expect(screen.getByLabelText(/Nombre del descuento/)).toHaveValue('DESCUENTO AUTOMATICO Delivery');
  });

  it('detecta envío y reparto escritos con tilde', () => {
    abrir();
    const campo = screen.getByLabelText(/Nombre del descuento/);
    fireEvent.change(campo, { target: { value: 'Envío a domicilio' } });
    expect(screen.getByTestId('advertencia-delivery')).toBeTruthy();
    fireEvent.change(campo, { target: { value: 'Reparto gratis' } });
    expect(screen.getByTestId('advertencia-delivery')).toBeTruthy();
  });
});
