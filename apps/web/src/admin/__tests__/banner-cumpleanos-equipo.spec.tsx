import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BannerCumpleanosEquipo } from '../BannerCumpleanosEquipo';
import { hoyLima } from '../SaludoCumpleanos';
import { api } from '../../comun/api';
import * as sesionModulo from '../../comun/sesion';
import { TarjetaCumpleanosBannerConfiguracion } from '../configuracion/TarjetaCumpleanosBannerConfiguracion';

function sesion() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '7', nombres: 'Luis', rol: 'MOZO' } } as any);
}

describe('Banner «Hoy cumple años» del equipo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    sesion();
  });

  it('muestra los nombres abreviados que manda el servidor', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ nombres: ['María S.'] } as any);
    render(<BannerCumpleanosEquipo />);
    expect(await screen.findByRole('status')).toHaveTextContent('Hoy cumple años María S.');
    expect(get).toHaveBeenCalledWith('/admin/escritorio/cumpleanos-hoy');
  });

  it('varios cumpleañeros en plural', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ nombres: ['Ana G.', 'Luis P.'] } as any);
    render(<BannerCumpleanosEquipo />);
    expect(await screen.findByRole('status')).toHaveTextContent('Hoy cumplen años Ana G. y Luis P.');
  });

  it('no muestra nada si nadie cumple años (o el ADMIN lo apagó: lista vacía)', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ nombres: [] } as any);
    render(<BannerCumpleanosEquipo />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('si la consulta falla no molesta ni bloquea', async () => {
    const get = vi.spyOn(api, 'get').mockRejectedValue(new Error('red'));
    render(<BannerCumpleanosEquipo />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('se cierra por día: al volver el mismo día no aparece y no consulta; otro día sí', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ nombres: ['María S.'] } as any);
    const { unmount } = render(<BannerCumpleanosEquipo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso de cumpleaños' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(window.localStorage.getItem('caprichos_banner_cumple_7')).toBe(hoyLima());
    unmount();
    get.mockClear();
    render(<BannerCumpleanosEquipo />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    window.localStorage.setItem('caprichos_banner_cumple_7', '2020-01-01');
    cleanupRender();
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('sin localStorage igual se muestra y se cierra', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(api, 'get').mockResolvedValue({ nombres: ['María S.'] } as any);
    render(<BannerCumpleanosEquipo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso de cumpleaños' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('respeta prefers-reduced-motion y el adorno es decorativo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ nombres: ['María S.'] } as any);
    const { container } = render(<BannerCumpleanosEquipo />);
    await screen.findByRole('status');
    expect(container.querySelector('style')?.textContent).toMatch(/prefers-reduced-motion: reduce\)\{\.banner-cumple-pastel\{animation:none/);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

// Vuelve a montar el banner en el mismo documento (otro "día")
function cleanupRender() {
  cleanup();
  render(<BannerCumpleanosEquipo />);
}

describe('Configuración: aviso de cumpleaños del equipo', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('nace encendido y el administrador lo apaga (se guarda «no»)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaCumpleanosBannerConfiguracion esAdmin />);
    expect(await screen.findByText('Encendido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Alternar aviso de cumpleaños/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/cumpleanos_banner_equipo', { valor: 'no' }));
  });

  it('con «no» aparece apagado y quien no es administrador no ve el botón', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([{ clave: 'cumpleanos_banner_equipo', valor: 'no' }]);
    render(<TarjetaCumpleanosBannerConfiguracion esAdmin={false} />);
    expect(await screen.findByText('Apagado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alternar aviso/ })).toBeNull();
  });
});
