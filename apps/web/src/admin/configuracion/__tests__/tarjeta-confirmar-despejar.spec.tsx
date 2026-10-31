import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaConfirmarDespejarConfiguracion } from '../TarjetaConfirmarDespejarConfiguracion';

describe('Configuración › Cocina: Confirmar al despejar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sin fila en parámetros aparece encendido (valor por defecto)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    render(<TarjetaConfirmarDespejarConfiguracion esAdmin />);
    expect(await screen.findByText('Encendido')).toBeInTheDocument();
  });

  it('el administrador lo apaga con Sí y se guarda «no» (auditado por el servidor)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([{ clave: 'cocina_confirmar_despejar', valor: 'si' }]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaConfirmarDespejarConfiguracion esAdmin />);
    await screen.findByText('Encendido');

    fireEvent.click(screen.getByRole('button', { name: /Alternar confirmar al despejar/ }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/cocina_confirmar_despejar', { valor: 'no' }));
  });

  it('con «no» aparece apagado y encender guarda «si»', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([{ clave: 'cocina_confirmar_despejar', valor: 'no' }]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaConfirmarDespejarConfiguracion esAdmin />);
    expect(await screen.findByText('Apagado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alternar confirmar al despejar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/cocina_confirmar_despejar', { valor: 'si' }));
  });

  it('quien no es administrador no ve el botón', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    render(<TarjetaConfirmarDespejarConfiguracion esAdmin={false} />);
    await screen.findByText('Encendido');
    expect(screen.queryByRole('button', { name: /Alternar confirmar al despejar/ })).toBeNull();
    expect(screen.getByText('Solo ADMIN')).toBeInTheDocument();
  });
});
