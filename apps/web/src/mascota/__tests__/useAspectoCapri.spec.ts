import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from '../../comun/api';
import {
  useAspectoCapri,
  limpiarCacheAspecto,
  cargarAspectoPublico,
  preestablecerAspectoCache,
} from '../useAspectoCapri';
import { ASPECTO_BASE_DEFECTO } from '../tiposAspecto';

describe('useAspectoCapri', () => {
  beforeEach(() => {
    limpiarCacheAspecto();
    vi.restoreAllMocks();
  });

  it('inicia inmediatamente con el aspecto por defecto mientras carga para evitar parpadeos', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {})); // promesa pendiente

    const { result } = renderHook(() => useAspectoCapri());

    expect(result.current.aspecto).toEqual(ASPECTO_BASE_DEFECTO);
    expect(result.current.cargando).toBe(true);
    expect(result.current.tema).toBe('normal');
  });

  it('obtiene el aspecto público desde /carta/mascota y actualiza el estado', async () => {
    const mockRespuesta = {
      tema: 'halloween',
      aspecto: {
        ...ASPECTO_BASE_DEFECTO,
        gorro: { tipo: 'bruja', color: '#2B1B3F' },
        accesorios: ['calabaza'],
      },
    };

    const spyGet = vi.spyOn(api, 'get').mockResolvedValue(mockRespuesta);

    const { result } = renderHook(() => useAspectoCapri());

    await waitFor(() => {
      expect(result.current.cargando).toBe(false);
    });

    expect(result.current.tema).toBe('halloween');
    expect(result.current.aspecto.gorro.tipo).toBe('bruja');
    expect(result.current.aspecto.gorro.color).toBe('#2B1B3F');
    expect(spyGet).toHaveBeenCalledWith('/carta/mascota');
  });

  it('guarda en cache y no repite la petición al montar otro hook', async () => {
    const mockRespuesta = {
      tema: 'navidad',
      aspecto: {
        ...ASPECTO_BASE_DEFECTO,
        gorro: { tipo: 'navideno', color: '#C5221F' },
      },
    };

    const spyGet = vi.spyOn(api, 'get').mockResolvedValue(mockRespuesta);

    const hook1 = renderHook(() => useAspectoCapri());
    await waitFor(() => expect(hook1.result.current.cargando).toBe(false));

    // Segundo consumidor
    const hook2 = renderHook(() => useAspectoCapri());
    expect(hook2.result.current.cargando).toBe(false);
    expect(hook2.result.current.tema).toBe('navidad');

    // api.get solo debió llamarse una vez
    expect(spyGet).toHaveBeenCalledTimes(1);
  });

  it('ante error de red realiza reintento suave y hace fallback a base', async () => {
    const spyGet = vi.spyOn(api, 'get').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAspectoCapri());

    await waitFor(
      () => {
        expect(result.current.cargando).toBe(false);
      },
      { timeout: 2000 }
    );

    expect(result.current.aspecto).toEqual(ASPECTO_BASE_DEFECTO);
    expect(result.current.tema).toBe('normal');
    // Verificamos que se intentó dos veces (original + 1 reintento suave)
    expect(spyGet).toHaveBeenCalledTimes(2);
  });

  it('permite cargar aspecto directamente con cargarAspectoPublico y preestablecer con preestablecerAspectoCache', async () => {
    preestablecerAspectoCache({
      tema: 'fiestas_patrias',
      aspecto: {
        ...ASPECTO_BASE_DEFECTO,
        uniforme: { principal: '#FFFFFF', delantal: '#C5221F', ribete: '#D99E39' },
      },
    });

    const resultado = await cargarAspectoPublico();
    expect(resultado.tema).toBe('fiestas_patrias');
    expect(resultado.aspecto.uniforme.delantal).toBe('#C5221F');
  });
});
