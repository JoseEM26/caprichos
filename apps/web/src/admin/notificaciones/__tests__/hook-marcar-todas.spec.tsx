import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificaciones } from '../../useNotificaciones';
import { api } from '../../../comun/api';
import * as notifApi from '../notificacionesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const aviso = (i: number) => ({ id: `${i}`, clave: `n:${i}`, titulo: `A${i}`, detalle: '', prioridad: 'ALTA' as const, desde: null, modulo: 'caja', accion: 'x', leida: false, leidaEn: null });

describe('useNotificaciones.marcarTodas', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('deja el contador en 0 al instante y confirma con el servidor', async () => {
    let servidor: Array<ReturnType<typeof aviso> | (Omit<ReturnType<typeof aviso>, "leidaEn"> & { leidaEn: string })> = [aviso(1), aviso(2), aviso(3)];
    vi.spyOn(api, 'get').mockImplementation(async () => ({ conteos: {}, notificaciones: servidor }) as never);
    const marcar = vi.spyOn(notifApi, 'marcarTodasNotificacionesLeidas').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      servidor = servidor.map((n) => ({ ...n, leida: true, leidaEn: 'x' }));
      return { ok: true };
    });
    const { result } = renderHook(() => useNotificaciones());
    await waitFor(() => expect(result.current.notificaciones.filter((n) => !n.leida)).toHaveLength(3));

    let promesa!: Promise<boolean>;
    act(() => {
      promesa = result.current.marcarTodas();
    });
    // antes de que responda el servidor ya no queda nada sin leer
    expect(result.current.notificaciones.filter((n) => !n.leida)).toHaveLength(0);
    await act(async () => {
      await promesa;
    });
    expect(marcar).toHaveBeenCalledTimes(1);
    expect(result.current.notificaciones.filter((n) => !n.leida)).toHaveLength(0);
  });
});
