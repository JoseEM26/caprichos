import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

// Aunque la sesión trajera pedidos/anular, Mis pedidos (vista del mozo) no ofrece anular: es de Caja o Administrador
const permisos = new Set(['pedidos/anular', 'pedidos/extra']);
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: 'MOZO', partyId: '7' }, tiene: (p: string) => permisos.has(p) }),
}));
vi.mock('../api', () => ({ salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() } }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({ ModalNuevoPedidoMesa: () => null }));

const linea = { id: '1', nombre: 'Café', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 5, subtotal: 5, lista: false };

describe('Mis pedidos: sin botón de anular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [{ id: '11', codigo: 'CP-M011', estado: 'PREPARANDO', modalidad: 'MESA', mesaNombre: 'Mesa 3', total: 5, pagoEstado: 'PENDIENTE', creadoEn: '2026-10-29T15:10:00Z', lineas: [linea] }],
      resumen: { cantidad: 1, total: 5, enCurso: 1, entregados: 0 },
    } as any);
  });

  it('el pedido en curso sin cobro no ofrece «Anular pedido»', async () => {
    render(<MisPedidosView />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    expect(await screen.findByRole('button', { name: 'Agregar extra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).toBeNull();
  });
});
