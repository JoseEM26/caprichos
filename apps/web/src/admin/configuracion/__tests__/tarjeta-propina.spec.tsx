import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaPropinaConfiguracion } from '../TarjetaPropinaConfiguracion';

const lista = (activa: unknown, tope: unknown = 200) => [
  { clave: 'propina_activa', valor: activa },
  { clave: 'propina_tope', valor: tope },
];

describe('Propina opcional (interruptor por canal y tope)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('encendida por defecto en los cuatro canales, con tope de S/ 200', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista(undefined));
    render(<TarjetaPropinaConfiguracion esAdmin />);

    expect(await screen.findByText('Propina en la carta virtual')).toBeInTheDocument();
    expect(screen.getByText('Propina en WhatsApp')).toBeInTheDocument();
    expect(screen.getAllByText('Encendida')).toHaveLength(4);
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
  });

  it('encender la carta pide confirmación y guarda solo ese canal (el bot sigue igual)', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(lista({ carta: false, bot: true })).mockResolvedValue(lista({ carta: true, bot: true }));
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaPropinaConfiguracion esAdmin />);

    fireEvent.click(await screen.findByRole('button', { name: 'Alternar propina en la carta virtual' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/configuracion/propina_activa', { valor: { carta: true, bot: true, mozo: true, caja: true } }),
    );
  });

  it('un tope fuera de rango no se envía; uno válido sí', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista(undefined));
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaPropinaConfiguracion esAdmin />);

    const campo = await screen.findByDisplayValue('200');
    fireEvent.change(campo, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));
    expect(await screen.findByText('El tope de propina debe estar entre S/ 1 y S/ 1000')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    fireEvent.change(campo, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/propina_tope', { valor: 50 }));
  });

  it('quien no es ADMIN ve el estado pero no puede cambiarlo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista({ carta: true, bot: false }, 80));
    render(<TarjetaPropinaConfiguracion esAdmin={false} />);

    // carta encendida; bot apagado a propósito; mozo y caja sin valor guardado = encendidos por defecto
    expect(await screen.findAllByText('Encendida')).toHaveLength(3);
    expect(screen.getAllByText('Apagada')).toHaveLength(1);
    expect(screen.getAllByText('Solo ADMIN').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Alternar propina en la carta virtual' })).not.toBeInTheDocument();
  });
});
