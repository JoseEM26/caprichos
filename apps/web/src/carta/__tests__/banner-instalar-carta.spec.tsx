import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El aviso de instalar sale en la carta en cada visita (sin pedido previo). Se oculta mientras
// «Mis pedidos» o la confirmación están abiertos, para que nunca haya dos a la vez.
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

const NOMBRE_AVISO = 'Instalar Caprichos en tu celular';
const CLAVE = 'caprichos.pwa.instalar.descartado';

const pedidoPrevio = {
  codigo: 'A1B2',
  token: 'tok',
  modalidad: 'RECOGER',
  nombre: 'Ana',
  creadoEn: new Date().toISOString(),
  estado: 'COLA',
  estadoEtiqueta: 'En cola',
  terminado: false,
};

function dispararInstalable() {
  act(() => {
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  });
}

describe('Aviso «Instalar app» en la carta', () => {
  beforeEach(() => {
    iniciarCapturaInstalar();
    pedidosGuardados.lista = [];
    forzado.valores = {};
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('la carta lo muestra en cada visita, sin pedido previo', async () => {
    render(enCarta());
    dispararInstalable();
    expect(await screen.findByRole('region', { name: NOMBRE_AVISO })).toBeDefined();
  });

  it('la × lo oculta solo en esta sesión: con una sesión nueva vuelve a salir', async () => {
    const { unmount } = render(enCarta());
    dispararInstalable();
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso de instalación' }));
    expect(screen.queryByRole('region', { name: NOMBRE_AVISO })).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE)).toBe('1');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
    unmount();

    window.sessionStorage.clear();
    render(enCarta());
    dispararInstalable();
    expect(await screen.findByRole('region', { name: NOMBRE_AVISO })).toBeDefined();
  });

  it('en standalone (ya instalada) no se muestra', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(enCarta());
    dispararInstalable();
    await act(async () => {});
    expect(screen.queryByRole('region', { name: NOMBRE_AVISO })).toBeNull();
  });

  it('en la confirmación del pedido hay un solo aviso, no dos', async () => {
    forzado.valores = {
      pedidoConfirmado: { codigo: 'A1B2', seguimientoToken: 'tok', modalidad: 'RECOGER', clienteNombre: 'Ana' },
    };
    render(enCarta());
    dispararInstalable();
    expect(await screen.findAllByRole('region', { name: NOMBRE_AVISO })).toHaveLength(1);
  });

  it('con «Mis pedidos» abierto hay un solo aviso, no dos', async () => {
    pedidosGuardados.lista = [pedidoPrevio];
    forzado.valores = { listaPedidosAbierta: true };
    render(enCarta());
    dispararInstalable();
    expect(await screen.findAllByRole('region', { name: NOMBRE_AVISO })).toHaveLength(1);
  });
});
