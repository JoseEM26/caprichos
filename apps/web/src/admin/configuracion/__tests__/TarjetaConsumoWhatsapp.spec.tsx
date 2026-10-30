import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaConsumoWhatsapp } from '../TarjetaConsumoWhatsapp';

const datos = { mes: '2026-10', servicio: 800, plantillas: 40, plantillasPorTipo: { aviso_pedido: 40 }, gratisMes: 1000, avisoPct: 80, porcentaje: 80, proyeccionFinDeMes: 1700 };

describe('Tarjeta Mensajes de WhatsApp este mes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra barra, desglose, proyección y la línea del cobro de Meta', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    render(<TarjetaConsumoWhatsapp esAdmin />);
    await waitFor(() => expect(screen.getByText(/800 de 1[.,]000 gratis \(80%\)/)).toBeInTheDocument());
    expect(screen.getByText('Mensajes de WhatsApp este mes (2026-10)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByText(/Plantillas:/)).toBeInTheDocument();
    expect(screen.getByText(/Proyección a fin de mes/)).toBeInTheDocument();
    expect(screen.getByText(/Meta cobra cada mensaje de servicio/)).toBeInTheDocument();
  });

  it('el tope se guarda solo tras confirmar Sí', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ...datos, gratisMes: 2000, porcentaje: 40 });
    render(<TarjetaConsumoWhatsapp esAdmin />);
    const campo = await screen.findByLabelText('Mensajes gratis al mes');
    fireEvent.change(campo, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/chatbot/configuracion/consumo-whatsapp', { gratisMes: 2000 }));
  });

  it('sin permiso de edición no hay botón de guardar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    render(<TarjetaConsumoWhatsapp />);
    await screen.findByLabelText('Mensajes gratis al mes');
    expect(screen.queryByRole('button', { name: 'Guardar tope' })).toBeNull();
  });
});
