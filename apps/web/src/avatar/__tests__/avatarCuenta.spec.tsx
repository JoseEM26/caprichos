import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const put = vi.fn().mockResolvedValue({ cliente: { partyId: '1', nombre: 'Ana', avatarUrl: '/archivos/a.png' } });
const get = vi.fn().mockResolvedValue({ config: { nombre: 'Ana' } });
vi.mock('../../comun/api', () => ({ api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: vi.fn(), delete: vi.fn() }, clienteFetch: vi.fn() }));

import { CuentaProvider, useCuenta } from '../../carta/cuenta/CuentaContext';
import { RetratoAvatar } from '../RetratoAvatar';

describe('avatar en la cuenta', () => {
  it('guardarAvatar hace PUT /carta/cuenta/avatar con config y retrato y actualiza el cliente', async () => {
    let ctx!: ReturnType<typeof useCuenta>;
    const Sonda = () => {
      ctx = useCuenta();
      return <span>{ctx.cliente?.avatarUrl ?? 'sin'}</span>;
    };
    render(<CuentaProvider><Sonda /></CuentaProvider>);
    await act(async () => {
      await ctx.guardarAvatar!({ nombre: 'Ana' }, 'data:image/png;base64,AAAA');
    });
    expect(put).toHaveBeenCalledWith('/carta/cuenta/avatar', { config: { nombre: 'Ana' }, retrato: 'data:image/png;base64,AAAA' });
    expect(screen.getByText('/archivos/a.png')).toBeInTheDocument();
    await expect(ctx.cargarAvatar!()).resolves.toEqual({ nombre: 'Ana' });
    expect(get).toHaveBeenCalledWith('/carta/cuenta/avatar');
  });

  it('el retrato celebra solo cuando se pide (pedido listo)', () => {
    const { rerender } = render(<RetratoAvatar url="/archivos/a.png" tamano={64} />);
    expect(screen.getByTestId('retrato-avatar')).not.toHaveClass('av-celebra');
    rerender(<RetratoAvatar url="/archivos/a.png" tamano={64} celebra />);
    expect(screen.getByTestId('retrato-avatar')).toHaveClass('av-celebra');
  });
});
