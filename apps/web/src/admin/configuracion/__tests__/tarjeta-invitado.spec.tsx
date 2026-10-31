import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaInvitadoConfiguracion } from '../TarjetaInvitadoConfiguracion';

const lista = (valor: string | undefined) => [{ clave: 'carta_invitado_activo', valor }];

describe('Pedir como invitado (interruptor de configuración)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sin parámetro (o «no») aparece Apagado, y el texto explica qué pasa al apagarlo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista(undefined));
    render(<TarjetaInvitadoConfiguracion esAdmin />);

    expect(await screen.findByText('Apagado')).toBeInTheDocument();
    expect(screen.getByText(/Encendido, quien pide desde la carta puede hacerlo sin dar su celular \(no suma puntos\)/)).toBeInTheDocument();
    expect(screen.getByText(/Apagado, debe poner al menos su celular para pedir y sumar puntos/)).toBeInTheDocument();
  });

  it('encender pide confirmación Sí/No y guarda carta_invitado_activo como «si»', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(lista('no')).mockResolvedValue(lista('si'));
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaInvitadoConfiguracion esAdmin />);

    fireEvent.click(await screen.findByRole('button', { name: /Alternar pedir como invitado/ }));
    expect(screen.getByRole('button', { name: 'Sí, confirmar' })).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/carta_invitado_activo', { valor: 'si' }));
    expect(await screen.findByText('Encendido')).toBeInTheDocument();
  });

  it('apagar guarda «no»; «No, cancelar» no cambia nada', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista('si'));
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaInvitadoConfiguracion esAdmin />);

    expect(await screen.findByText('Encendido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Alternar pedir como invitado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Alternar pedir como invitado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/carta_invitado_activo', { valor: 'no' }));
  });

  it('quien no es ADMIN no ve el botón', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(lista('no'));
    render(<TarjetaInvitadoConfiguracion esAdmin={false} />);
    expect(await screen.findByText('Solo ADMIN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alternar pedir como invitado/ })).not.toBeInTheDocument();
  });
});
