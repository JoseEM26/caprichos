import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaResenasGoogleConfiguracion } from '../TarjetaResenasGoogleConfiguracion';

const estado = (o: Record<string, any> = {}) => ({
  negocio: { businessId: 'biz-1', nombre: 'Caprichos Campoy' },
  claveConfigurada: true,
  resumen: { rating: 4.8, total: 778 },
  ultimaActualizacion: null,
  cargaInicialHecha: false,
  consumo: 12,
  tope: 40,
  guardadas: 3,
  visibles: 2,
  ocultas: 1,
  actualizarAhora: { disponible: true, motivo: null },
  autoActiva: false,
  ...o,
});

const resena = (id: string, visible = true) => ({
  id,
  autor: `Autor ${id}`,
  foto: null,
  estrellas: 5,
  texto: 'Muy buen café y atención amable en cada visita.',
  fecha: '2026-10-01T12:00:00.000Z',
  enlace: 'https://maps.google.com/x',
  visible,
});

describe('Tarjeta de Reseñas de Google (admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('quien no es ADMIN no ve botones', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado(), resenas: [] });
    render(<TarjetaResenasGoogleConfiguracion esAdmin={false} />);
    expect(screen.getByTestId('tarjeta-resenas-no-admin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar ahora' })).not.toBeInTheDocument();
  });

  it('sin local: busca, muestra candidatos y guarda al confirmar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado({ negocio: null }), resenas: [] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      ok: true,
      candidatos: [{ businessId: 'biz-9', nombre: 'Caprichos Campoy', direccion: 'Av. Campoy 1', rating: 4.8, total: 778, enlaceLocal: 'https://www.google.com/maps/place/local' }],
    });
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.change(await screen.findByLabelText('Nombre de tu local en Google'), { target: { value: 'Caprichos Campoy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mi local' }));
    expect(await screen.findByText('Av. Campoy 1')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/admin/resenas/buscar-negocio', { consulta: 'Caprichos Campoy' });

    fireEvent.click(screen.getByRole('button', { name: 'Usar este local' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/resenas/negocio', {
        businessId: 'biz-9',
        nombre: 'Caprichos Campoy',
        rating: 4.8,
        total: 778,
        enlaceLocal: 'https://www.google.com/maps/place/local',
      }),
    );
  });

  it('muestra consumo, totales y deshabilita Actualizar ahora con el motivo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado({ actualizarAhora: { disponible: false, motivo: 'LIMITE_DIARIO' } }), resenas: [resena('a')] });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    expect(await screen.findByText('12 de 40')).toBeInTheDocument();
    expect(screen.getByText(/Visibles:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeDisabled();
    expect(screen.getByText(/una vez al día/)).toBeInTheDocument();
  });

  it('actualizar ahora pide Confirmar antes de llamar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado(), resenas: [] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, nuevas: 1, actualizadas: 0 });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar ahora' }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/ }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/resenas/actualizar', {}));
  });

  it('carga inicial con menos de 20 guardadas no repite; con Confirmar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado({ guardadas: 3 }), resenas: [] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, paginas: 3, guardadas: 45 });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Carga inicial' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/resenas/carga-inicial', { repetir: false }));
  });

  it('con 20 o más guardadas y carga ya hecha ofrece Repetir carga', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado({ guardadas: 25, cargaInicialHecha: true }), resenas: [] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, paginas: 1, guardadas: 0 });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Repetir carga' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/resenas/carga-inicial', { repetir: true }));
  });

  it('ocultar una reseña pide Confirmar y hace PATCH con visible false; No cancela', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado(), resenas: [resena('7', true)] });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ visible: false });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar reseña de Autor 7' }));
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/ }));
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar reseña de Autor 7' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/resenas/7', { visible: false }));
  });

  it('muestra un error claro si la búsqueda falla', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: estado({ negocio: null }), resenas: [] });
    vi.spyOn(api, 'post').mockResolvedValue({ ok: false, motivo: 'NO_AUTORIZADO', mensaje: 'La API de reseñas no autorizó la consulta (clave o plan). No se cambió nada.' });
    render(<TarjetaResenasGoogleConfiguracion esAdmin />);
    fireEvent.change(await screen.findByLabelText('Nombre de tu local en Google'), { target: { value: 'Caprichos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mi local' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no autorizó');
  });
});
