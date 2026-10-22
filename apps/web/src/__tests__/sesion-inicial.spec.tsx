import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SesionProvider } from '../comun/sesion';

describe('SesionProvider: renovación al abrir la página', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('con StrictMode renueva la sesión una sola vez (el token de renovación rota)', async () => {
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
});
