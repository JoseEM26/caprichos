import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BloqueoVinculacion } from '../BloqueoVinculacion';
import { api } from '../../../comun/api';

const chat = <div data-testid="chat">chat</div>;
const estado = (o: object) => vi.spyOn(api, 'get').mockResolvedValue({ proveedor: 'EVOLUTION', vinculado: true, estado: 'open', ...o } as any);

describe('BloqueoVinculacion', () => {
  afterEach(() => vi.restoreAllMocks());

  it('desvinculado: solo el QR, sin chat', async () => {
    estado({ vinculado: false, estado: 'close' });
    vi.spyOn(api, 'post').mockResolvedValue({ disponible: true, base64: 'AAA' } as any);
    render(<BloqueoVinculacion>{chat}</BloqueoVinculacion>);
    expect(await screen.findByTestId('bloqueo-vinculacion')).toBeTruthy();
    expect((await screen.findByAltText(/QR para vincular/)).getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(screen.queryByTestId('chat')).toBeNull();
    expect(screen.getByText(/Escanéalo solo con el celular del local/)).toBeTruthy();
  });

  it('vinculado: muestra el chat', async () => {
    estado({});
    render(<BloqueoVinculacion>{chat}</BloqueoVinculacion>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('chat')).toBeTruthy();
    expect(screen.queryByTestId('bloqueo-vinculacion')).toBeNull();
  });

  it('Meta: muestra el chat', async () => {
    estado({ proveedor: 'META', vinculado: null, estado: null });
    render(<BloqueoVinculacion>{chat}</BloqueoVinculacion>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('chat')).toBeTruthy();
  });

  it('Meta en uso y Evolution sin vincular: QR arriba y el chat sigue', async () => {
    estado({ proveedor: 'META', vinculado: false, estado: 'close' });
    vi.spyOn(api, 'post').mockResolvedValue({ disponible: true, base64: 'BBB' } as any);
    render(<BloqueoVinculacion>{chat}</BloqueoVinculacion>);
    expect(await screen.findByTestId('qr-vincular-meta')).toBeTruthy();
    expect((await screen.findByAltText(/QR para vincular/)).getAttribute('src')).toBe('data:image/png;base64,BBB');
    expect(screen.getByTestId('chat')).toBeTruthy();
    expect(screen.queryByTestId('bloqueo-vinculacion')).toBeNull();
  });

  it('error de red: chat con aviso pequeño', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('red'));
    render(<BloqueoVinculacion>{chat}</BloqueoVinculacion>);
    expect(await screen.findByTestId('aviso-vinculacion')).toBeTruthy();
    expect(screen.getByTestId('chat')).toBeTruthy();
  });
});
