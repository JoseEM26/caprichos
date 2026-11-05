import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El botón «Instalar app» está en la cabecera de la carta, siempre que la app no esté instalada.
const { pedidosGuardados, forzado } = vi.hoisted(() => ({
  pedidosGuardados: { lista: [] as Array<Record<string, unknown>> },
  forzado: { valores: {} as Record<string, unknown> },
}));

vi.mock('../CarritoContext', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../CarritoContext')>();
  return {
    ...original,
    useCarrito: () => ({ ...original.useCarrito(), ...forzado.valores }),
  };
});

vi.mock('../cuenta/CuentaContext', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../cuenta/CuentaContext')>();
  return { ...original, useCuentaOpcional: () => null };
});

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      get: vi.fn(async (ruta: string) => (ruta === '/carta' || ruta === '/carta/ofertas' ? [] : null)),
    },
  };
});

vi.mock('../seguimiento', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../seguimiento')>();
  return {
    ...original,
    usePedidosGuardados: () => pedidosGuardados.lista,
    consultarLote: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../useEsMovil', () => ({ useEsMovil: () => false }));

import { CartaPublica } from '../CartaPublica';

const enCarta = () => <MemoryRouter><CartaPublica /></MemoryRouter>;
import { iniciarCapturaInstalar } from '../../pwa/instalar';

const NOMBRE_BOTON = 'Instalar app';

function dispararInstalable() {
  act(() => {
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  });
}

describe('Botón «Instalar app» en la cabecera de la carta', () => {
  beforeEach(() => {
    iniciarCapturaInstalar();
    pedidosGuardados.lista = [];
    forzado.valores = {};
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('está en la cabecera sin pedido previo y sin que el navegador haya dado el aviso', async () => {
    render(enCarta());
    expect(await screen.findByRole('button', { name: NOMBRE_BOTON })).toBeDefined();
  });

  it('ya no hay barra de instalar bajo la cabecera: el aviso vive en el botón', async () => {
    render(enCarta());
    dispararInstalable();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: 'Instalar Caprichos en tu celular' })).toBeNull();
  });

  it('en standalone (ya instalada) no se muestra', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(enCarta());
    await act(async () => {});
    expect(screen.queryByRole('button', { name: NOMBRE_BOTON })).toBeNull();
  });
});
