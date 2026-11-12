import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaludoCumpleanos, hoyLima } from '../SaludoCumpleanos';
import * as sesionModulo from '../../comun/sesion';
import { api } from '../../comun/api';

function sesion(extra: Record<string, unknown> = {}) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '7', nombres: 'María José', rol: 'MOZO' },
    cumpleHoy: true,
    debeCambiar: false,
    ...extra,
  } as any);
}

describe('Saludo grande de cumpleaños al iniciar sesión', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
  });

  it('avisa al servidor que ya se mostró (una vez por día en cualquier dispositivo)', () => {
    sesion();
    render(<SaludoCumpleanos />);
    expect(api.post).toHaveBeenCalledWith('/auth/cumpleanos/visto', {});
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('si el POST falla igual se muestra y el respaldo local evita repetirlo en este dispositivo', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('red'));
    sesion();
    const { unmount } = render(<SaludoCumpleanos />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(window.localStorage.getItem('caprichos_saludo_cumple_7')).toBe(hoyLima());
    unmount();
    render(<SaludoCumpleanos />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si el servidor ya lo registró, cumpleHoy llega en false y no sale', () => {
    sesion({ cumpleHoy: false });
    render(<SaludoCumpleanos />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('aparece con el primer nombre y se cierra con el botón', async () => {
    sesion();
    render(<SaludoCumpleanos />);
    expect(screen.getByRole('dialog', { name: /Feliz cumpleaños, María!/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gracias' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('se cierra con Esc', async () => {
    sesion();
    render(<SaludoCumpleanos />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('una sola vez al día: si ya se mostró hoy, no vuelve; mañana sí', () => {
    window.localStorage.setItem('caprichos_saludo_cumple_7', hoyLima());
    sesion();
    const { unmount } = render(<SaludoCumpleanos />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    window.localStorage.setItem('caprichos_saludo_cumple_7', '2020-01-01');
    render(<SaludoCumpleanos />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('no aparece si hoy no es su cumpleaños', () => {
    sesion({ cumpleHoy: false });
    render(<SaludoCumpleanos />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('espera a que termine el cambio de clave obligatorio', () => {
    sesion({ debeCambiar: true });
    render(<SaludoCumpleanos />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el confeti es decorativo y se desactiva con prefers-reduced-motion', () => {
    sesion();
    const { container } = render(<SaludoCumpleanos />);
    expect(container.querySelector('[aria-hidden="true"] .cumple-confeti')).not.toBeNull();
    expect(container.querySelector('style')?.textContent).toMatch(/prefers-reduced-motion: reduce\)\{\.cumple-confeti\{animation:none/);
  });

  it('sin localStorage igual muestra el saludo', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    sesion();
    render(<SaludoCumpleanos />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
