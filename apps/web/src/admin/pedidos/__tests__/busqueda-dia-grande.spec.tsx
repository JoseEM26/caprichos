import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));
vi.mock('../../vouchers/vouchersApi', () => ({ vouchersApi: { listarVouchers: vi.fn().mockResolvedValue([]) } }));

const ahora = new Date().toISOString();
const ped = (n: number, cliente: string) =>
  ({
    id: String(n), codigo: `CP-${String(n).padStart(3, '0')}`, canal: 'CAJA', modalidad: 'LLEVAR', estado: 'PREPARANDO',
    pago_estado: 'PAGADO', total: 20, subtotal: 20, descuento: 0, cliente_nombre: cliente, creado_en: ahora,
    lineas: [{ id: `l${n}`, nombre: 'Café', cantidad: 1, precio_unit: 20, subtotal: 20 }],
  }) as unknown as Pedido;

// Día con 230 pedidos: el 215 (página 3 de 100) es de «José Peña»
const TODOS = Array.from({ length: 230 }, (_, i) => ped(i + 1, i + 1 === 215 ? 'José Peña' : `Cliente ${i + 1}`));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Pedidos y Caja: búsqueda en un día con más de 100 pedidos', () => {
  it('buscar «jose» pide las páginas que faltan y encuentra a José Peña de la página 3', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' }, permisos: [], debeCambiar: false, cargando: false, autenticado: true, tiene: vi.fn(() => true),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation((() => {}) as any);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
    const listar = vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
      if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
      const pag = f?.pagina ?? 1;
      return { total: TODOS.length, pagina: pag, limite: 100, items: TODOS.slice((pag - 1) * 100, pag * 100) } as any;
    });
    vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));

    render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
    await screen.findByTestId('pag-carga');
    expect(screen.queryByText('José Peña')).not.toBeInTheDocument();

    fireEvent.change(document.getElementById('ord-q') as HTMLInputElement, { target: { value: 'jose' } });

    await waitFor(() => expect(screen.getByText('José Peña')).toBeInTheDocument());
    expect(listar.mock.calls.some(([f]: any) => f?.pagina === 3)).toBe(true);
    // Con todo cargado ya no queda el aviso de carga en el pie
    await waitFor(() => expect(screen.queryByTestId('pag-carga')).not.toBeInTheDocument());
  });
});
