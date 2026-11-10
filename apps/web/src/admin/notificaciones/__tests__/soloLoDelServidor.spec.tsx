import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificaciones } from '../../useNotificaciones';

const oyentes = new Map<string, () => void>();
vi.mock('../../../comun/socket', () => ({
  useEventos: (evento: string, cb: (d?: unknown) => void) => {
    oyentes.set(evento, cb as () => void);
  },
}));
const get = vi.fn();
vi.mock('../../../comun/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

describe('useNotificaciones: lo que se ve sale solo de lo que devuelve el servidor', () => {
  beforeEach(() => {
    oyentes.clear();
    get.mockReset();
  });

  it('el evento en vivo con un título ajeno no crea ningún aviso: solo vuelve a pedir la lista', async () => {
    get.mockResolvedValue({ conteos: {}, notificaciones: [] });
    const { result } = renderHook(() => useNotificaciones());
    await waitFor(() => expect(result.current.cargado).toBe(true));

    // el servidor ya no manda títulos por el socket; aunque llegara uno, no se usa
    await act(async () => {
      (oyentes.get('notificaciones:nueva') as unknown as (d: unknown) => void)({ id: '9', titulo: 'Aviso de otro rol' });
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.notificaciones).toEqual([]);

    // aparece solo cuando el servidor lo devuelve para este usuario
    get.mockResolvedValue({
      conteos: {},
      notificaciones: [
        { id: '9', clave: 'n:9', titulo: 'Lo mío', detalle: '', prioridad: 'MEDIA', desde: null, modulo: 'caja', accion: 'Ir', leida: false, leidaEn: null },
      ],
    });
    await act(async () => {
      oyentes.get('notificaciones:nueva')!();
    });
    await waitFor(() => expect(result.current.notificaciones.map((n) => n.titulo)).toEqual(['Lo mío']));
  });
});
