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

describe('clienteFetch con errores de Nest sin `mensaje`', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const err400 = (cuerpo: unknown) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(cuerpo), { status: 400, headers: { 'content-type': 'application/json' } }),
    );

  it('muestra el primer elemento de message cuando es una lista (ValidationPipe)', async () => {
    err400({ statusCode: 400, message: ['pagoPersonal.pagaCon must not have more than 2 decimal places', 'otro'], error: 'Bad Request' });
    const err = await clienteFetch('/admin/pedidos', { method: 'POST' }).catch((e) => e);
    expect(err.message).toBe('pagoPersonal.pagaCon must not have more than 2 decimal places');
  });
  it('muestra message cuando es texto', async () => {
    err400({ statusCode: 500, message: 'Internal server error' });
    const err = await clienteFetch('/x', { method: 'POST' }).catch((e) => e);
    expect(err.message).toBe('Internal server error');
  });
  it('`mensaje` del servidor sigue mandando sobre `message`', async () => {
    err400({ codigo: 'X', mensaje: 'Texto claro', message: 'otro' });
    const err = await clienteFetch('/x', { method: 'POST' }).catch((e) => e);
    expect(err.message).toBe('Texto claro');
  });
  it('sin cuerpo útil queda la frase genérica', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));
    const err = await clienteFetch('/x', { method: 'POST' }).catch((e) => e);
    expect(err.message).toBe('Error al procesar la solicitud');
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
