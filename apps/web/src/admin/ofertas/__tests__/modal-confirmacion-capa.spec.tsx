import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalConfirmacion } from '../ModalConfirmacion';

describe('ModalConfirmacion', () => {
  it('sale en el body por encima de los modales con pestañas y Esc la cancela', () => {
    const onCancelar = vi.fn();
    const { container } = render(<ModalConfirmacion abierto titulo="¿Guardar?" mensaje="m" onConfirmar={() => {}} onCancelar={onCancelar} />);
    const dialogo = screen.getByRole('dialog', { name: 'Confirmar acción' });
    expect(container.contains(dialogo)).toBe(false);
    expect((dialogo.parentElement as HTMLElement).style.zIndex).toBe('5000');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelar).toHaveBeenCalled();
  });
});
