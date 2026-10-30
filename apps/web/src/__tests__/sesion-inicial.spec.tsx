import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SesionProvider } from '../comun/sesion';

describe('SesionProvider: renovación al abrir la página', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('con StrictMode renueva la sesión una sola vez (el token de renovación rota)', async () => {
    window.localStorage.setItem('caprichos_sesion', '1');
    const llamadas: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      llamadas.push(url);
      if (url === '/auth/renovar') {
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            accessToken: 'tok',
            debeCambiar: false,
            usuario: { partyId: '1', nombres: 'Ana', rol: 'ADMIN' },
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ partyId: '1', nombres: 'Ana', rol: 'ADMIN', debeCambiar: false, permisos: [] }),
      } as Response);
    });

    render(
      <StrictMode>
        <SesionProvider>
          <div>contenido</div>
        </SesionProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(llamadas).toContain('/auth/yo'));
    expect(llamadas.filter((u) => u === '/auth/renovar')).toHaveLength(1);
  });

  it('sin indicio de sesión (carta pública) no intenta renovar', async () => {
    const llamadas: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      llamadas.push(String(input));
      return Promise.reject(new Error('no debería llamarse'));
    });

    render(
      <StrictMode>
        <SesionProvider>
          <div>contenido</div>
        </SesionProvider>
      </StrictMode>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(llamadas).toHaveLength(0);
  });
});
