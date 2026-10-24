import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NuevaIniciativaModal } from '../NuevaIniciativaModal';

describe('NuevaIniciativaModal', () => {
  it('muestra el mensaje del servidor y deja el botón habilitado tras un error', async () => {
    const alGuardar = vi.fn().mockRejectedValue(
      new Error('No se pudo generar el código de la iniciativa. Inténtalo de nuevo.'),
    );

    render(
      <NuevaIniciativaModal abierto alCerrar={vi.fn()} alGuardar={alGuardar} />,
    );

    fireEvent.change(screen.getByLabelText('Título corto'), { target: { value: 'Tablet lenta' } });
    fireEvent.change(screen.getByLabelText('Cuéntanos'), { target: { value: 'Se traba al cobrar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir iniciativa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, subir' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('No se pudo generar el código de la iniciativa. Inténtalo de nuevo.');
    expect(alGuardar).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Subir iniciativa' })).not.toBeDisabled();
    });
  });
});
