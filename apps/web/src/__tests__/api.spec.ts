import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, setTokenAcceso, getTokenAcceso, ErrorApi } from '../comun/api';

describe('Cliente API (api.ts)', () => {
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    setTokenAcceso(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('guarda y entrega el token de acceso en memoria', () => {
    expect(getTokenAcceso()).toBeNull();
    setTokenAcceso('token-prueba-123');
    expect(getTokenAcceso()).toBe('token-prueba-123');
    setTokenAcceso(null);
    expect(getTokenAcceso()).toBeNull();
  });

  it('envía credentials: "include" y Authorization header si hay token', async () => {
    setTokenAcceso('token-valido-abc');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = mockFetch;

    await api.get('/admin/prueba');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opciones] = mockFetch.mock.calls[0];
    expect(opciones.credentials).toBe('include');
    expect(opciones.headers['Authorization']).toBe('Bearer token-valido-abc');
  });

  it('renueva una vez ante 401 y reintenta la petición original con el nuevo token', async () => {
    setTokenAcceso('token-vencido');

    let contadorLlamadas = 0;
    const mockFetch = vi.fn().mockImplementation((url: string, opciones?: any) => {
      contadorLlamadas++;

      // 1. Primera llamada a /admin/datos: falla con 401
      if (url === '/admin/datos' && contadorLlamadas === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ codigo: 'TOKEN_EXPIRADO', mensaje: 'Token expirado' }),
        });
      }

      // 2. Llamada automática de renovación a /auth/renovar
      if (url === '/auth/renovar') {
        expect(opciones?.credentials).toBe('include');
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            accessToken: 'token-xxxx-renovado',
            debeCambiar: false,
          }),
        });
      }

      // 3. Reintento de /admin/datos con el nuevo token
      if (url === '/admin/datos' && contadorLlamadas === 3) {
        expect(opciones?.headers?.['Authorization']).toBe('Bearer token-xxxx-renovado');
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ exito: true, datos: [1, 2, 3] }),
        });
      }

      throw new Error(`Ruta inesperada: ${url}`);
    });

    globalThis.fetch = mockFetch;

    const respuesta = await api.get('/admin/datos');

    expect(respuesta).toEqual({ exito: true, datos: [1, 2, 3] });
    expect(getTokenAcceso()).toBe('token-xxxx-renovado');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('no renueva en bucle si el reintento vuelve a fallar con 401', async () => {
    setTokenAcceso('token-expirado');

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/admin/secreto') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ codigo: 'NO_AUTORIZADO', mensaje: 'No autorizado' }),
        });
      }
      if (url === '/auth/renovar') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ accessToken: 'token-xxxx-supuestamente-nuevo' }),
        });
      }
      throw new Error('Ruta inesperada');
    });

    globalThis.fetch = mockFetch;

    await expect(api.get('/admin/secreto')).rejects.toThrow(ErrorApi);
    // Debe haber llamado a: 1. /admin/secreto (401), 2. /auth/renovar (200), 3. /admin/secreto reintento (401) y PARAR (no bucle)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('no intenta renovar si la llamada fallida ya era a /auth/renovar o /auth/ingresar', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Clave incorrecta' }),
    });

    globalThis.fetch = mockFetch;

    await expect(
      api.post('/auth/ingresar', { dni: '12345678', contrasena: 'mala' }),
    ).rejects.toThrow(ErrorApi);

    // Solo se debe haber llamado a /auth/ingresar una sola vez, sin llamar a /auth/renovar
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/auth/ingresar');
  });

  it('limpia el token y lanza ErrorApi si la renovación falla', async () => {
    setTokenAcceso('token-antiguo');

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/admin/panel') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ codigo: 'NO_AUTORIZADO', mensaje: 'Expiró' }),
        });
      }
      if (url === '/auth/renovar') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ codigo: 'SESION_REVOCADA', mensaje: 'Sesión revocada' }),
        });
      }
      throw new Error('Ruta inesperada');
    });

    globalThis.fetch = mockFetch;

    await expect(api.get('/admin/panel')).rejects.toThrow(ErrorApi);
    expect(getTokenAcceso()).toBeNull();
  });
});
