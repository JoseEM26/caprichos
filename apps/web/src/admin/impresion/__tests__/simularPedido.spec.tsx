import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { impresionApi } from '../impresionApi';
import { SimularPedido } from '../SimularPedido';

vi.mock('../impresionApi', () => ({ impresionApi: { simularPedido: vi.fn() } }));

const montar = () =>
  render(
    <MemoryRouter>
      <SimularPedido />
    </MemoryRouter>,
  );

describe('Simular un pedido completo', () => {
  beforeEach(() => ((impresionApi as any).simularPedido = vi.fn()));
  afterEach(() => cleanup());

  it('pide confirmación con la frase, deja elegir modalidad (Para llevar por defecto) y muestra el resumen', async () => {
    (impresionApi.simularPedido as any).mockResolvedValue({
      ok: true,
      total: 5,
      enviados: [{ equipoId: '1', equipo: 'Caja', maquina: 'Etiquetera', cantidad: 3, trabajos: ['bebida', 'bebida', 'resumen'] }],
      noRecibieron: [{ equipoId: '2', equipo: 'Barra', motivo: 'sin configurar' }],
      sinReceptor: [],
      mensaje: '',
    });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Simular un pedido completo' }));
    expect(await screen.findByText(/No crea pedido, ni cobro, ni stock\./)).toBeInTheDocument();
    expect(impresionApi.simularPedido).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Para llevar')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Delivery'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, simular' }));
    await waitFor(() => expect(impresionApi.simularPedido).toHaveBeenCalledWith('DELIVERY'));
    const r = await screen.findByTestId('resultado-simulacion');
    expect(r).toHaveTextContent('Se enviaron 5 trabajos');
    expect(r).toHaveTextContent('Etiquetera de Caja: 3 (bebida, bebida, resumen)');
    expect(r).toHaveTextContent('No recibieron: PC «Barra» (sin configurar)');
    expect(screen.getByRole('link', { name: 'Ver cola' })).toBeInTheDocument();
  });

  it('un error del servidor se muestra', async () => {
    // función simple (no espía): el espía de vitest deja sin atender la promesa rechazada que devuelve
    (impresionApi as any).simularPedido = async () => {
      throw new Error('Solo Caja o un administrador');
    };
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Simular un pedido completo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, simular' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo Caja o un administrador');
  });
});
