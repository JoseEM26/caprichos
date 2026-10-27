import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAyuda } from '../useAyuda';
import * as ayudaApi from '../ayudaApi';

vi.mock('../ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(),
  enviarPreguntaAyuda: vi.fn(),
}));

describe('useAyuda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ayudaApi.obtenerContextoAyuda).mockImplementation(async (ruta: string) => {
      if (ruta.includes('cocina')) {
        return {
          activo: true,
          modulo: 'cocina',
          titulo: 'Cocina',
          sugerencias: ['Pregunta cocina'],
          enlaces: [],
        };
      }
      return {
        activo: true,
        modulo: 'caja',
        titulo: 'Pedidos y caja',
        rolUsuario: 'Cajero',
        sugerencias: ['¿Cómo anulo un pedido?', '¿Cómo registro un cobro?'],
        enlaces: [],
      };
    });
  });

  it('inicia cerrado, con Capri en reposo y mensaje de bienvenida', async () => {
    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });

    const { result } = resultHook;
    expect(result.current.abierto).toBe(false);
    expect(result.current.estadoCapri).toBe('reposo');
    expect(result.current.mensajes.length).toBe(1);
    expect(result.current.mensajes[0].emisor).toBe('capri');
    expect(result.current.mensajes[0].texto).toContain('Capri');
  });

  it('al abrir pasa a saludando y carga el contexto de la ruta', async () => {
    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });
    const { result } = resultHook;

    await act(async () => {
      result.current.abrir();
    });

    expect(result.current.abierto).toBe(true);
    expect(result.current.estadoCapri).toBe('saludando');
    expect(ayudaApi.obtenerContextoAyuda).toHaveBeenCalledWith('/admin/caja');
    expect(result.current.sugerencias).toEqual([
      '¿Cómo anulo un pedido?',
      '¿Cómo registro un cobro?',
    ]);
  });

  it('al cerrar vuelve a reposo', async () => {
    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });
    const { result } = resultHook;

    await act(async () => {
      result.current.abrir();
    });
    expect(result.current.abierto).toBe(true);

    await act(async () => {
      result.current.cerrar();
    });
    expect(result.current.abierto).toBe(false);
    expect(result.current.estadoCapri).toBe('reposo');
  });

  it('al enviar una pregunta pasa por pensando y luego a hablando si la respuesta es ok', async () => {
    vi.mocked(ayudaApi.enviarPreguntaAyuda).mockResolvedValueOnce({
      respuesta: 'Para anular entra a Pedidos...',
      enlaces: [{ texto: 'Pedidos', ruta: '/admin/caja' }],
      estado: 'ok',
    });

    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });
    const { result } = resultHook;

    let promesaEnvio: Promise<void>;
    act(() => {
      promesaEnvio = result.current.enviar('¿Cómo anulo un pedido?');
    });

    expect(result.current.cargando).toBe(true);
    expect(result.current.estadoCapri).toBe('pensando');

    await act(async () => {
      await promesaEnvio;
    });

    expect(result.current.cargando).toBe(false);
    expect(result.current.estadoCapri).toBe('hablando');
    expect(result.current.mensajes).toHaveLength(3); // saludo + usuario + capri
    expect(result.current.mensajes[1].texto).toBe('¿Cómo anulo un pedido?');
    expect(result.current.mensajes[2].texto).toBe('Para anular entra a Pedidos...');
    expect(result.current.mensajes[2].enlaces).toEqual([{ texto: 'Pedidos', ruta: '/admin/caja' }]);
  });

  it('pasa a confundido si la respuesta es rechazada o sin_ia', async () => {
    vi.mocked(ayudaApi.enviarPreguntaAyuda).mockResolvedValueOnce({
      respuesta: 'Por seguridad, no debes ingresar datos personales como DNI o teléfono.',
      enlaces: [],
      estado: 'rechazada',
    });

    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });
    const { result } = resultHook;

    await act(async () => {
      await result.current.enviar('DNI 12345678');
    });

    expect(result.current.estadoCapri).toBe('confundido');
    expect(result.current.mensajes[result.current.mensajes.length - 1].estado).toBe('rechazada');
  });

  it('no envía preguntas vacías o que solo contengan espacios', async () => {
    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(() => useAyuda('/admin/caja'));
    });
    const { result } = resultHook;

    await act(async () => {
      await result.current.enviar('   ');
    });

    expect(ayudaApi.enviarPreguntaAyuda).not.toHaveBeenCalled();
    expect(result.current.mensajes).toHaveLength(1); // solo bienvenida
  });

  it('actualiza sugerencias al cambiar la ruta', async () => {
    let resultHook: any;
    await act(async () => {
      resultHook = renderHook(
        ({ ruta }: { ruta: string }) => useAyuda(ruta),
        { initialProps: { ruta: '/admin/caja' } }
      );
    });
    const { result, rerender } = resultHook;

    await act(async () => {
      result.current.abrir();
    });
    expect(result.current.sugerencias).toEqual([
      '¿Cómo anulo un pedido?',
      '¿Cómo registro un cobro?',
    ]);

    await act(async () => {
      rerender({ ruta: '/admin/cocina' });
    });

    expect(result.current.sugerencias).toEqual(['Pregunta cocina']);
  });
});
