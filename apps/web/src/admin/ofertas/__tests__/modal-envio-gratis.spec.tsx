import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalEnvioGratis } from '../ModalEnvioGratis';

describe('ModalEnvioGratis (editor de la promoción de envío)', () => {
  it('guarda el alta como ENVIO_GRATIS sin descuento, con BOT marcado por defecto', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} />);

    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Delivery gratis de 2 a 6 pm' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mié' }));
    fireEvent.change(screen.getByLabelText(/Desde las/), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/Hasta las/), { target: { value: '18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    const datos = onGuardar.mock.calls[0][0];
    expect(datos).toMatchObject({
      tipo: 'ENVIO_GRATIS',
      nombre: 'Delivery gratis de 2 a 6 pm',
      dias: [3],
      horaDesde: '14:00',
      horaHasta: '18:00',
      canales: ['CARTA', 'ADMIN', 'BOT'],
      compraMinima: null,
    });
    expect(datos).not.toHaveProperty('descuentoValor');
    expect(datos).not.toHaveProperty('visibleCarta');
  });

  it('con la casilla WhatsApp desmarcada no envía BOT', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío gratis' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.click(screen.getByLabelText('WhatsApp (bot)'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].canales).toEqual(['CARTA', 'ADMIN']);
  });

  it('valida que la hora de fin sea después de la de inicio y no guarda', () => {
    const onGuardar = vi.fn();
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.change(screen.getByLabelText(/Desde las/), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Hasta las/), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/después de la hora de inicio/);
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
