import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

// El aviso de instalar en la carta solo sale con un pedido previo: se prueba en «Mis pedidos».
const { pedidosGuardados } = vi.hoisted(() => ({
  pedidosGuardados: { lista: [] as Array<Record<string, unknown>> },
}));

vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ listaPedidosAbierta: true, setListaPedidosAbierta: vi.fn() }),
}));

vi.mock('../cuenta/CuentaContext', () => ({
  useCuentaOpcional: () => null,
}));

vi.mock('../seguimiento', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../seguimiento')>();
  return {
    ...original,
    usePedidosGuardados: () => pedidosGuardados.lista,
    consultarLote: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../useEsMovil', () => ({ useEsMovil: () => false }));

import { MisPedidos } from '../MisPedidos';
import { iniciarCapturaInstalar } from '../../pwa/instalar';

describe('Aviso «Instalar app» en la carta', () => {
  beforeEach(() => {
    iniciarCapturaInstalar();
    pedidosGuardados.lista = [];
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('sin pedidos previos no aparece aunque el navegador permita instalar', () => {
    render(<MisPedidos />);
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
    expect(screen.getByText('Aún no tienes pedidos')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Instalar Caprichos en tu celular' })).toBeNull();
  });

  it('con un pedido previo sí se ofrece instalar', () => {
    pedidosGuardados.lista = [
      {
        codigo: 'A1B2',
        token: 'tok',
        modalidad: 'RECOGER',
        nombre: 'Ana',
        creadoEn: new Date().toISOString(),
        estado: 'COLA',
        estadoEtiqueta: 'En cola',
        terminado: false,
      },
    ];
    render(<MisPedidos />);
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });
    expect(screen.getByRole('region', { name: 'Instalar Caprichos en tu celular' })).toBeDefined();
  });
});
