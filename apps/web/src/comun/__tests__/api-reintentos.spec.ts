import { afterEach, describe, expect, it, vi } from 'vitest';
import { clienteFetch, configurarReintentos } from '../api';

describe('reintentos ante un reinicio del servidor', () => {
  afterEach(() => {
    configurarReintentos([]);
    vi.restoreAllMocks();
  });

  const json = (status: number, cuerpo: unknown = {}) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

  it('reintenta una lectura que recibe 503 y luego responde bien', async () => {
    configurarReintentos([0, 0]);
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(503))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(clienteFetch('/carta/estado')).resolves.toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('reintenta un error de red en una escritura con Idempotency-Key', async () => {
    configurarReintentos([0]);
    const f = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(201, { codigo: 'CP-W001' }));
    await expect(
      clienteFetch('/pedidos', { method: 'POST', body: '{}', headers: { 'Idempotency-Key': 'abc' } }),
    ).resolves.toEqual({ codigo: 'CP-W001' });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('no repite una escritura sin Idempotency-Key', async () => {
    configurarReintentos([0, 0]);
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(clienteFetch('/admin/algo', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
