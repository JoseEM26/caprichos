import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const revisar = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({ ...(await orig<any>()), revisarMarca: (...a: any[]) => revisar(...a) }));

import { EliminarMarca } from '../EliminarMarca';

const marca: any = { id: 50, hora: '14:12', rol: 'ENTRADA' };

describe('Eliminar una marca (admin)', () => {
  it('pide motivo de 10+ caracteres, anula la marca y recarga', async () => {
    revisar.mockResolvedValue({ ok: true });
    const alEliminar = vi.fn(async () => undefined);
    const alVolver = vi.fn();
    render(<EliminarMarca marca={marca} alVolver={alVolver} alEliminar={alEliminar} onError={() => undefined} />);
    const boton = screen.getByRole('button', { name: 'Eliminar marca' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Marcó dos veces por error' } });
    fireEvent.click(boton);
    await waitFor(() => expect(alEliminar).toHaveBeenCalled());
    expect(revisar).toHaveBeenCalledWith(50, 'anular', 'Marcó dos veces por error');
    expect(alVolver).toHaveBeenCalled();
  });
});
