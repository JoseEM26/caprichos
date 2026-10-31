import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
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

const resumenPrueba = vi.hoisted(() => ({
  valor: {
    notificaciones: [] as any[],
    conteos: {} as Record<string, number>,
    cargado: true,
    refrescar: vi.fn(async () => {}),
    marcar: vi.fn(async () => true),
  },
}));

vi.mock('../useNotificaciones', () => ({
  useNotificaciones: () => resumenPrueba.valor,
}));

vi.mock('../notificaciones/notificacionesApi', () => ({
  marcarNotificacion: vi.fn(async () => ({ ok: true, clave: 'n:5', leida: true })),
  marcarTodasNotificacionesLeidas: vi.fn(async () => ({ ok: true })),
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

  it('campanita: cada aviso tiene su botón Leída que lo marca para este usuario', async () => {
    resumenPrueba.valor = {
      conteos: {},
      cargado: true,
      refrescar: vi.fn(async () => {}),
      marcar: vi.fn(async () => true),
      notificaciones: [
        {
          id: '5',
          clave: 'n:5',
          titulo: 'Mensaje interno de turno',
          detalle: 'Turno de tarde',
          prioridad: 'MEDIA',
          desde: null,
          modulo: 'notificaciones',
          accion: 'Ver en el historial',
          leida: false,
          leidaEn: null,
        },
        {
          id: 'stock-bajo',
          clave: 'c:stock-bajo:0123456789ab',
          titulo: '1 insumo con stock bajo',
          detalle: 'Insumos bajo el mínimo.',
          prioridad: 'ALTA',
          desde: null,
          modulo: 'compras',
          accion: 'Pedir al proveedor',
          leida: false,
          leidaEn: null,
        },
        {
          id: '9',
          clave: 'n:9',
          titulo: 'Ya atendida',
          detalle: '',
          prioridad: 'BAJA',
          desde: null,
          modulo: 'notificaciones',
          accion: 'Ver en el historial',
          leida: true,
          leidaEn: new Date().toISOString(),
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

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones: 2 sin leer' }));

    const leidas = screen.getAllByRole('button', { name: 'Leída' });
    expect(leidas).toHaveLength(2);
    fireEvent.click(leidas[0]);

    // la campanita muestra la lista en el orden que trae el resumen; la primera fila es n:5
    await waitFor(() => {
      expect(resumenPrueba.valor.marcar).toHaveBeenCalledWith('n:5', true);
    });
  });
});
