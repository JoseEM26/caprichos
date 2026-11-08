import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { PedidosAdminView } from '../PedidosAdminView';
import { Pedido, pedidosApi } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
// PedidoDetalle usa useSesion (botón de rechazo del cobro del mozo): sin sesión en estas pruebas, sin permisos extra
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => false, usuario: null }),
}));


vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { listarVouchers: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));

const pedidoConProductos = {
  id: '77',
  codigo: 'CP-W004',
  canal: 'CARTA',
  modalidad: 'LLEVAR',
  estado: 'LISTO',
  pago_estado: 'PAGADO',
  pago_metodo: 'YAPE',
  subtotal: 40,
  descuento: 5,
  envio: 0,
  total: 35,
  cliente_nombre: 'Rosa',
  cliente_telefono: '988776655',
  creado_en: '2026-10-21T18:00:00Z',
  lineas: [
    {
      id: 'l1',
      nombre: 'Café filtro',
      cantidad: 2,
      precio_unit: 12,
      subtotal: 24,
      opcionesElegidas: [{ opcion_nombre: 'Leche de almendra' }],
    },
    { id: 'l2', nombre: 'Donut', cantidad: 1, precio_unit: 16, subtotal: 16 },
  ],
} as unknown as Pedido;

function renderDetalle(pedido: Pedido = pedidoConProductos) {
  return render(
    <MemoryRouter>
      <PedidoDetalle pedido={pedido} alActualizar={() => {}} />
    </MemoryRouter>,
  );
}

describe('Detalle del pedido: layout en tarjetas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('la pestaña Pedido muestra productos y resumen lado a lado en tarjetas', () => {
    renderDetalle();

    const productos = screen.getByRole('region', { name: 'Productos del pedido' });
    const resumen = screen.getByRole('region', { name: 'Resumen del pedido' });
    expect(within(productos).getByText('Café filtro')).toBeInTheDocument();
    expect(within(productos).getByText('+ Leche de almendra')).toBeInTheDocument();
    expect(within(resumen).getByText('Resumen y cobro')).toBeInTheDocument();
    expect(within(resumen).getByText('Subtotal')).toBeInTheDocument();
    expect(within(resumen).getByText('Descuento')).toBeInTheDocument();
    expect(within(resumen).getByText('Pagado')).toBeInTheDocument();
    expect(within(resumen).queryByText('Envío')).not.toBeInTheDocument();
  });

  it('la pestaña Cobro separa el estado del cobro y el total en dos tarjetas', () => {
    renderDetalle();

    fireEvent.click(screen.getByRole('tab', { name: 'Cobro' }));

    expect(screen.getByRole('region', { name: 'Estado del cobro' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Total a cobrar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Total a cobrar' })).toHaveTextContent('S/ 35.00');
  });

  it('la pestaña Ticket de cocina muestra el ticket y su acción de reimpresión en tarjetas', () => {
    renderDetalle();

    fireEvent.click(screen.getByRole('tab', { name: 'Ticket de cocina' }));

    expect(screen.getByRole('region', { name: 'Ticket de cocina' })).toHaveTextContent('COMANDA CP-W004');
    expect(screen.getByRole('region', { name: 'Reimprimir el ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reimprimir ticket' })).toBeInTheDocument();
  });

  it('la pestaña Comprobante muestra la vista y la impresión en tarjetas', () => {
    renderDetalle();

    fireEvent.click(screen.getByRole('tab', { name: 'Comprobante' }));

    expect(screen.getByRole('region', { name: 'Vista del comprobante' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Imprimir el comprobante' })).toBeInTheDocument();
  });

  it('las pestañas del detalle tienen al menos 44 px de alto para tocarlas', () => {
    renderDetalle();

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.style.minHeight).toBe('44px');
    }
  });
});

describe('Pedidos y caja: tarjetas y ventana de detalle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['pedidos/ver'],
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
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({
      total: 1,
      pagina: 1,
      limite: 100,
      items: [pedidoConProductos],
    });
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 });
  });

  it('renderiza tarjetas a todo el ancho y el detalle solo se abre en una ventana', async () => {
    const { container } = render(<PedidosAdminView />);

    expect(await screen.findByRole('navigation', { name: 'Estado de los pedidos' })).toBeInTheDocument();
    expect(container.querySelector('.cj2-cuadricula')).not.toBeNull();
    expect(container.querySelector('.cj-left')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Pedido CP-W004 de Rosa/ }));
    const ventana = await screen.findByRole('dialog', { name: 'Detalle del pedido CP-W004' });
    expect(ventana).toHaveAttribute('aria-modal', 'true');
    expect(within(ventana).getByRole('tab', { name: 'Cobro' })).toBeInTheDocument();
  });
});
