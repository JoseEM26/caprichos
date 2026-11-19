import { describe, expect, it, vi, afterEach } from 'vitest';
import { salonApi } from '../api';
import { api } from '../../../comun/api';

describe('borradorDeMesa', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sin borrador el servidor responde vacío ({}): devuelve null, no un borrador falso', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({});
    expect(await salonApi.borradorDeMesa('5')).toBeNull();
  });

  it('con borrador lo devuelve', async () => {
    const b = { mesaId: '5', mozo: 'Ana', productos: 2, actualizadoEn: '2026-11-18T10:00:00Z' };
    vi.spyOn(api, 'get').mockResolvedValue(b);
    expect(await salonApi.borradorDeMesa('5')).toEqual(b);
  });
});
