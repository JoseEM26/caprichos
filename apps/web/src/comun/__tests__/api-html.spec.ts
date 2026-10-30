import { afterEach, describe, expect, it, vi } from 'vitest';
import { clienteFetch, ErrorApi } from '../api';
import { comoLista } from '../comoLista';

describe('clienteFetch con respuestas que no son JSON', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pide la respuesta sin caché HTTP para no leer el HTML del SPA', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await clienteFetch('/admin/zonas');
    expect(f.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });

  it('un 200 con HTML lanza error en vez de devolver {}', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    const err = await clienteFetch('/admin/zonas').catch((e) => e);
    expect(err).toBeInstanceOf(ErrorApi);
    expect(err.codigo).toBe('RESPUESTA_NO_JSON');
  });
});

describe('comoLista', () => {
  it('devuelve el array tal cual, el campo items o []', () => {
    expect(comoLista([1, 2])).toEqual([1, 2]);
    expect(comoLista({ items: [3] })).toEqual([3]);
    expect(comoLista({})).toEqual([]);
    expect(comoLista(undefined)).toEqual([]);
    expect(comoLista(null)).toEqual([]);
  });
});
