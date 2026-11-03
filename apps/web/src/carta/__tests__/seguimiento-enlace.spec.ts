import { describe, it, expect, vi, afterEach } from 'vitest';
import { abrirSeguimientoDesdeEnlace, leerEnlaceSeguimiento } from '../seguimiento';

const TOKEN = 'a'.repeat(64);

describe('enlace de seguimiento de la carta (?seguimiento=CODIGO&t=TOKEN)', () => {
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it('lee código y token del enlace', () => {
    expect(leerEnlaceSeguimiento(`?seguimiento=CP-0110&t=${TOKEN}`)).toEqual({ codigo: 'CP-0110', token: TOKEN });
  });

  it('sin parámetros o con formato inválido no hay enlace', () => {
    expect(leerEnlaceSeguimiento('')).toBeNull();
    expect(leerEnlaceSeguimiento('?seguimiento=CP-0110')).toBeNull();
    expect(leerEnlaceSeguimiento('?seguimiento=CP-0110&t=corto')).toBeNull();
    expect(leerEnlaceSeguimiento(`?seguimiento=<script>&t=${TOKEN}`)).toBeNull();
  });

  it('pide el seguimiento con el token y devuelve el estado cuando coincide', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ codigo: 'CP-0110', modalidad: 'DELIVERY', estado: 'COCINA' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const estado = await abrirSeguimientoDesdeEnlace({ codigo: 'CP-0110', token: TOKEN });
    expect(estado?.codigo).toBe('CP-0110');
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/carta/seguimiento/CP-0110?t=${TOKEN}`);
  });

  it('con token que no coincide el servidor responde 404 y la carta se abre normal, sin error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(abrirSeguimientoDesdeEnlace({ codigo: 'CP-0110', token: TOKEN })).resolves.toBeNull();
  });
});
