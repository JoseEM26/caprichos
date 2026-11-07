import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalCupon } from '../ModalCupon';

function abrir(onGuardar = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ModalCupon
      abierto
      cuponAEditar={null}
      onCerrar={() => {}}
      onGuardar={onGuardar}
      productosDisponibles={[{ id: '7', nombre: 'Iced Coffee' }]}
      categorias={[{ id: '3', nombre: 'Frappes' }]}
    />,
  );
  return onGuardar;
}

describe('ModalCupon envía los nombres de la API (CrearCuponDto)', () => {
  it('crea un cupón de porcentaje con su cuerpo: descuentoTipo, descuentoValor, topeUsos, canales sin BOT', async () => {
    const onGuardar = abrir();
    fireEvent.change(document.getElementById('cp-c')!, { target: { value: 'verano10' } });
    fireEvent.change(document.getElementById('cp-d')!, { target: { value: '10% de verano' } });
    fireEvent.change(document.getElementById('cp-v')!, { target: { value: '10' } });
    fireEvent.click(screen.getAllByRole('radio')[1]); // Compartido (campaña)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cupón' }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    const cuerpo = onGuardar.mock.calls[0][0];
    expect(cuerpo).toMatchObject({
      codigoBase: 'VERANO10',
      modo: 'COMPARTIDO',
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 10,
      canales: ['CARTA', 'CAJA'],
      dias: [],
      horaDesde: null,
      horaHasta: null,
    });
    expect(cuerpo.topeUsos).toBe(5000);
    // Nombres viejos del modal ya no se envían
    expect(cuerpo).not.toHaveProperty('tipo');
    expect(cuerpo).not.toHaveProperty('valor');
    expect(cuerpo).not.toHaveProperty('maxUsos');
    expect(cuerpo).not.toHaveProperty('canal');
  });

  it('crea un cupón de envío gratis con horario: ENVIO_GRATIS, valor 0, días y horas', async () => {
    const onGuardar = abrir();
    fireEvent.change(document.getElementById('cp-c')!, { target: { value: 'envio2a6' } });
    fireEvent.change(document.getElementById('cp-d')!, { target: { value: 'Envío gratis de 2 a 6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envío gratis' }));
    expect(document.getElementById('cp-v')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mié' }));
    fireEvent.change(screen.getByLabelText(/Desde las/), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/Hasta las/), { target: { value: '18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cupón' }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(onGuardar.mock.calls[0][0]).toMatchObject({
      descuentoTipo: 'ENVIO_GRATIS',
      descuentoValor: 0,
      dias: [3],
      horaDesde: '14:00',
      horaHasta: '18:00',
    });
  });

  it('no guarda si la hora de fin no es posterior a la de inicio', async () => {
    const onGuardar = abrir();
    fireEvent.change(document.getElementById('cp-c')!, { target: { value: 'x' } });
    fireEvent.change(document.getElementById('cp-d')!, { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envío gratis' }));
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.change(screen.getByLabelText(/Desde las/), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Hasta las/), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cupón' }));
    expect(await screen.findByText(/La hora de fin debe ser después/)).toBeTruthy();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
