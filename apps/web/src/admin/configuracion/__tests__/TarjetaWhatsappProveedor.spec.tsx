import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaWhatsappProveedor } from '../TarjetaWhatsappProveedor';

const datos = {
  proveedor: 'META',
  configurado: true,
  webhookConTokenConfigurado: true,
  pausado: false,
  conexion: { estado: 'CONECTADO', razon: null, actualizadoEn: null, enVivo: 'open' },
  limites: { evolution_limite_minuto: 3, evolution_limite_hora: 30, evolution_limite_dia: 150, evolution_exigir_contacto_previo: 'si', evolution_origenes_permitidos: 'AVISO_PEDIDO,ENCUESTA' },
};

describe('Tarjeta Número de WhatsApp: Meta o Evolution', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra el proveedor en uso, la conexión y los límites', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    render(<TarjetaWhatsappProveedor esAdmin />);
    expect(await screen.findByText('Meta (oficial)')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByLabelText(/Máx. mensajes por minuto/)).toHaveValue(3);
  });

  it('cambiar a Evolution solo se guarda tras confirmar Sí', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ proveedor: 'EVOLUTION' });
    render(<TarjetaWhatsappProveedor esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar a Evolution' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/whatsapp/evolution/proveedor', { proveedor: 'EVOLUTION' }));
  });

  it('un límite cambiado se guarda tras confirmar, y solo manda lo que cambió', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    render(<TarjetaWhatsappProveedor esAdmin />);
    fireEvent.change(await screen.findByLabelText(/Máx. mensajes por minuto/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar límites' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/whatsapp/evolution/limites', { evolution_limite_minuto: '2' }));
  });

  it('sin ser administrador no hay botones de cambio', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    render(<TarjetaWhatsappProveedor />);
    await screen.findByText('Meta (oficial)');
    expect(screen.queryByRole('button', { name: 'Cambiar a Evolution' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar límites' })).toBeNull();
  });

  it('sin configurar avisa que es modo simulado; desconectado permite pedir el QR', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) =>
      ruta.endsWith('/qr') ? { disponible: true, base64: 'AAAA', codigo: null } : { ...datos, proveedor: 'EVOLUTION', conexion: { ...datos.conexion, estado: 'DESCONECTADO', enVivo: 'close' } },
    );
    render(<TarjetaWhatsappProveedor esAdmin />);
    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar QR para vincular' }));
    expect(await screen.findByAltText('QR para vincular el número')).toBeInTheDocument();
  });
});
