import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminShell } from '../AdminShell';
import * as ayudaApi from '../ayuda/ayudaApi';

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { id: 'u1', nombres: 'Admin Caprichos', rol: 'ADMIN' },
    salir: vi.fn(),
    tiene: () => true,
    cargando: false,
    autenticado: true,
  }),
}));

vi.mock('../useNotificaciones', () => ({
  useNotificaciones: () => ({
    notificaciones: [],
    conteos: {},
  }),
}));

vi.mock('../ayuda/ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(),
  enviarPreguntaAyuda: vi.fn(),
}));

describe('AdminShell - Integración de AyudaCapri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ayudaApi.obtenerContextoAyuda).mockResolvedValue({
      activo: true,
      modulo: 'caja',
      titulo: 'Pedidos y caja',
      rolUsuario: 'ADMIN',
      sugerencias: ['¿Cómo anulo un pedido?'],
      enlaces: [],
    });
  });

  it('monta el botón flotante de AyudaCapri diferido dentro del panel administrativo', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin/caja']}>
          <AdminShell />
        </MemoryRouter>
      );
    });

    // Como AyudaCapri es diferido con Suspense, esperamos a que aparezca
    const botonAyuda = await screen.findByRole('button', {
      name: /abrir la ayuda de capri/i,
    });
    expect(botonAyuda).toBeInTheDocument();
  });
});
