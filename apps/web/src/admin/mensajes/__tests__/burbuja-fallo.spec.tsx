import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BurbujaMensaje } from '../BurbujaMensaje';
import type { MensajeItem } from '../mensajesTipos';

const base: MensajeItem = {
  id: '9',
  autor: 'PERSONA',
  saliente: true,
  imagen: false,
  texto: 'Tu reserva está confirmada',
  hora: '10:00',
  estado: 'FALLIDO',
};

describe('Burbuja de un mensaje fallido', () => {
  it('muestra la causa amigable y, si hay detalle técnico, el código de Meta con el texto original', () => {
    render(
      <BurbujaMensaje
        mensaje={{
          ...base,
          motivoFallo: 'Una variable tiene un formato que Meta no admite.',
          metaCodigo: '132012',
          errorDetalle: 'Parameter format does not match',
        }}
        onReintentar={vi.fn()}
      />,
    );
    expect(screen.getByText('No se pudo enviar: Una variable tiene un formato que Meta no admite.')).toBeTruthy();
    expect(screen.getByText('Detalle técnico')).toBeTruthy();
    expect(screen.getByText(/Código de Meta: 132012 · Parameter format does not match/)).toBeTruthy();
  });

  it('sin detalle técnico (no ADMIN) no muestra la sección', () => {
    render(<BurbujaMensaje mensaje={{ ...base, motivoFallo: 'La plantilla de WhatsApp no se pudo enviar.' }} onReintentar={vi.fn()} />);
    expect(screen.queryByText('Detalle técnico')).toBeNull();
  });

  it('con error de 24 h (puedeReintentar false) no ofrece Reintentar; con otros errores si', () => {
    const { rerender } = render(<BurbujaMensaje mensaje={{ ...base, motivoFallo: 'Ventana cerrada', puedeReintentar: false }} onReintentar={vi.fn()} />);
    expect(screen.queryByText('Reintentar')).toBeNull();
    rerender(<BurbujaMensaje mensaje={{ ...base, motivoFallo: 'Fallo temporal', puedeReintentar: true }} onReintentar={vi.fn()} />);
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});
