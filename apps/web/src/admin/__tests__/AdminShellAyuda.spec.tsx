import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminShell } from '../AdminShell';
import * as ayudaApi from '../ayuda/ayudaApi';
import * as notifApi from '../notificaciones/notificacionesApi';

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { id: 'u1', nombres: 'Admin Caprichos', rol: 'ADMIN' },
    salir: vi.fn(),
    tiene: () => true,
    cargando: false,
    autenticado: true,
  }),
}));

const resumenPrueba = vi.hoisted(() => ({
  valor: {
    notificaciones: [] as any[],
    conteos: {} as Record<string, number>,
    refrescar: vi.fn(async () => {}),
  },
}));

vi.mock('../useNotificaciones', () => ({
  useNotificaciones: () => resumenPrueba.valor,
}));

vi.mock('../notificaciones/notificacionesApi', () => ({
  marcarNotificacionLeida: vi.fn(async () => ({ ok: true, id: '5', leida: true })),
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
    // Con toda la suite en paralelo el chunk diferido tarda más que el 1 s por defecto
    const botonAyuda = await screen.findByRole('button', {
      name: /abrir la ayuda de capri/i,
    }, { timeout: 5000 });
    expect(botonAyuda).toBeInTheDocument();
  });

  it('campanita: el aviso guardado tiene Leído con confirmación; al confirmar lo marca y refresca la cola', async () => {
    resumenPrueba.valor = {
      conteos: {},
      refrescar: vi.fn(async () => {}),
      notificaciones: [
        {
          id: '5',
          titulo: 'Mensaje interno de turno',
          detalle: 'Turno de tarde',
          prioridad: 'MEDIA',
          desde: null,
          modulo: 'notificaciones',
          accion: 'Ver en el historial',
          marcable: true,
        },
        {
          id: 'stock-bajo',
          titulo: '1 insumo con stock bajo',
          detalle: 'Insumos bajo el mínimo.',
          prioridad: 'ALTA',
          desde: null,
          modulo: 'compras',
          accion: 'Pedir al proveedor',
          marcable: false,
        },
      ],
    };

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin/caja']}>
          <AdminShell />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones: 2' }));

    // Solo el aviso guardado tiene el botón; la alerta calculada no
    const leidos = screen.getAllByRole('button', { name: 'Leído' });
    expect(leidos).toHaveLength(1);
    fireEvent.click(leidos[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Sí, marcar leída' }));

    await waitFor(() => {
      expect(notifApi.marcarNotificacionLeida).toHaveBeenCalledWith('5');
      expect(resumenPrueba.valor.refrescar).toHaveBeenCalled();
    });
  });
});
