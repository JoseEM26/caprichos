import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EscritorioView } from '../EscritorioView';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

const operativo = {
  generadoEn: '2026-10-31T19:00:00.000Z',
  pedidos: { porConfirmar: 2, enPreparacion: 4, enCola: 5, listos: 1, enReparto: 3, noEntregados: 15 },
  reservas: {
    cantidadHoy: 3,
    proximas: [
      { nombre: 'Ana', personas: 4, hora: '20:30' },
      { nombre: 'Luis', personas: 2, hora: '21:00' },
    ],
  },
  mesas: { cantidad: 10, ocupadas: 3, libres: 7 },
  caja: { estado: 'ABIERTA' },
};

function sesionCon(rol: string) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '7', nombres: 'Rosa Sup', rol },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

describe('Escritorio del SUPERVISOR: solo operación, sin dinero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra pedidos, reservas, mesas y caja con cantidades y enlaces', async () => {
    sesionCon('SUPERVISOR');
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/escritorio/operativo') return operativo;
      return { conteos: {}, notificaciones: [] };
    });

    render(
      <MemoryRouter>
        <EscritorioView />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Este es tu escritorio de Supervisor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Por confirmar: 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No entregados: 15/ })).toBeInTheDocument();
    expect(screen.getByText('20:30')).toBeInTheDocument();
    expect(screen.getByText(/Ana · 4 personas/)).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
  });

  it('no muestra ningún dato de dinero: ni ventas, ni montos, ni medios de pago', async () => {
    sesionCon('SUPERVISOR');
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/escritorio/operativo') return operativo;
      return { conteos: {}, notificaciones: [] };
    });

    const { container } = render(
      <MemoryRouter>
        <EscritorioView />
      </MemoryRouter>,
    );
    await screen.findByText(/Este es tu escritorio de Supervisor/);
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/S\/|soles|venta|ticket|ganan|cobrado|efectivo|monto|pago|yape|plin|cobro/i);
  });

  it('pide solo el escritorio operativo, no el resumen de informes', async () => {
    sesionCon('SUPERVISOR');
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/escritorio/operativo') return operativo;
      return { conteos: {}, notificaciones: [] };
    });
    render(
      <MemoryRouter>
        <EscritorioView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/escritorio/operativo'));
    expect(get.mock.calls.some(([u]) => String(u).includes('/admin/informes'))).toBe(false);
  });

  it('el administrador sigue viendo su escritorio de siempre', async () => {
    sesionCon('ADMIN');
    vi.spyOn(api, 'get').mockRejectedValue(new Error('sin conexión'));
    render(
      <MemoryRouter>
        <EscritorioView />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Este es tu escritorio de Administrador/)).toBeInTheDocument();
    expect(screen.queryByText(/Este es tu escritorio de Supervisor/)).not.toBeInTheDocument();
  });
});
