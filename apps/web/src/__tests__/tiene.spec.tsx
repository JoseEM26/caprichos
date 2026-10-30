import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SesionProvider, useSesion } from '../comun/sesion';

describe('tiene(permiso) y control de permisos en SesionProvider', () => {
  it('devuelve false si el usuario no ha iniciado sesión', async () => {
    // Mock fetch para que falle la renovación inicial silenciosa
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Sin cookie'));

    let renderResult: any;
    await act(async () => {
      renderResult = renderHook(() => useSesion(), {
        wrapper: ({ children }) => <SesionProvider>{children}</SesionProvider>,
      });
    });

    expect(renderResult.result.current.tiene('caja/cobrar')).toBe(false);
    expect(renderResult.result.current.tiene('pedidos/ver')).toBe(false);
  });

  it('permite cualquier acción si el usuario tiene rol ADMIN', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url === '/auth/ingresar') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            accessToken: 'token-admin',
            debeCambiar: false,
            usuario: { partyId: '1', nombres: 'Kevin Rosales', rol: 'ADMIN' },
          }),
        } as Response);
      }
      if (url === '/auth/yo') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            partyId: '1',
            nombres: 'Kevin Rosales',
            rol: 'ADMIN',
            debeCambiar: false,
            permisos: ['usuarios/ver', 'caja/cobrar'],
          }),
        } as Response);
      }
      return Promise.reject(new Error('Ruta no mockeada'));
    });

    let renderResult: any;
    await act(async () => {
      renderResult = renderHook(() => useSesion(), {
        wrapper: ({ children }) => <SesionProvider>{children}</SesionProvider>,
      });
    });

    await act(async () => {
      await renderResult.result.current.ingresar('11112222', 'clave123');
    });

    // ADMIN siempre tiene permiso para todo
    expect(renderResult.result.current.tiene('cualquier/permiso')).toBe(true);
    expect(renderResult.result.current.tiene('usuarios/desactivar')).toBe(true);
    expect(renderResult.result.current.tiene('caja')).toBe(true);
  });

  it('valida con precisión los permisos de un rol no admin (ej. CAJERO)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url === '/auth/ingresar') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            accessToken: 'token-cajero',
            debeCambiar: false,
            usuario: { partyId: '2', nombres: 'Ana Cajera', rol: 'CAJERO' },
          }),
        } as Response);
      }
      if (url === '/auth/yo') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            partyId: '2',
            nombres: 'Ana Cajera',
            rol: 'CAJERO',
            debeCambiar: false,
            permisos: [
              'pedidos/ver',
              'pedidos/cambiar_estado',
              'caja/abrir',
              'caja/cobrar',
              'caja/cerrar',
              'caja/ver',
            ],
          }),
        } as Response);
      }
      return Promise.reject(new Error('Ruta no mockeada'));
    });

    let renderResult: any;
    await act(async () => {
      renderResult = renderHook(() => useSesion(), {
        wrapper: ({ children }) => <SesionProvider>{children}</SesionProvider>,
      });
    });

    await act(async () => {
      await renderResult.result.current.ingresar('87654321', 'clave123');
    });

    // Acciones asignadas: true
    expect(renderResult.result.current.tiene('caja/cobrar')).toBe(true);
    expect(renderResult.result.current.tiene('caja/ver')).toBe(true);
    expect(renderResult.result.current.tiene('pedidos/ver')).toBe(true);

    // Consulta genérica por módulo asignado: true
    expect(renderResult.result.current.tiene('caja')).toBe(true);
    expect(renderResult.result.current.tiene('pedidos')).toBe(true);

    // Módulos o acciones no asignados: false
    expect(renderResult.result.current.tiene('usuarios/crear')).toBe(false);
    expect(renderResult.result.current.tiene('usuarios/ver')).toBe(false);
    expect(renderResult.result.current.tiene('configuracion/editar')).toBe(false);
  });
});
