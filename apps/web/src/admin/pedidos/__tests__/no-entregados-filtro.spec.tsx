import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, Pedido, RespuestaNoEntregados } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));

vi.mock('../../repartos/repartosApi', async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    repartosApi: {
      ...real.repartosApi,
      reprogramarPedido: vi.fn().mockResolvedValue({ ok: true, pedido: {} }),
    },
  };
});

const pedidoEnCurso: Pedido = {
  id: '1',
  codigo: 'CP-001',
  canal: 'CARTA',
  modalidad: 'DELIVERY',
  estado: 'PREPARANDO',
  pago_estado: 'PAGADO',
  total: '45.00',
  subtotal: '45.00',
  descuento: '0',
  cliente_nombre: 'Ana Lopez',
  creado_en: '2026-10-21T18:00:00Z',
  minutosEspera: 5,
  color: 'verde',
} as unknown as Pedido;

const noEntregados: RespuestaNoEntregados = {
  reprogramar: [
    {
      id: '901',
      codigo: 'CP-R01',
      cliente_nombre: 'Marta Prueba',
      cliente_telefono: '999000111',
      total: 30,
      motivo: 'No contestó al repartidor (retiro por espera agotada)',
      retirado_en: '2026-10-28T10:00:00Z',
      pregunta: 'SI',
      pago_estado: 'PENDIENTE',
      revisar_devolucion: false,
    },
  ],
  cancelados: [
    {
      id: '902',
      codigo: 'CP-R02',
      cliente_nombre: 'Diego Prueba',
      cliente_telefono: '999000222',
      total: 18,
      motivo: 'Cliente no quiso reprogramar la entrega tras la espera agotada',
      retirado_en: '2026-10-28T09:00:00Z',
      pregunta: 'NO',
      pago_estado: 'PAGADO',
      revisar_devolucion: true,
    },
  ],
  total: 2,
};

function montarVista(permisoLiquidar: boolean) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: ['pedidos/ver', 'repartos/liquidar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn((permiso: string) => (permiso === 'repartos/liquidar' ? permisoLiquidar : true)),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 1, pagina: 1, limite: 100, items: [pedidoEnCurso] });
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue(noEntregados);
  vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue(pedidoEnCurso);
}

// «No entregados» y «Cerrados» viven en el grupo Estado del panel Filtros: se abre y devuelve la opción buscada
async function opcionVer(nombre: RegExp) {
  const filtros = await screen.findByRole('button', { name: /^Filtros/ });
  if (filtros.getAttribute('aria-expanded') !== 'true') fireEvent.click(filtros);
  const combo = screen.getByRole('button', { name: /^Estado:/ });
  if (combo.getAttribute('aria-expanded') !== 'true') fireEvent.click(combo);
  return screen.getByRole('option', { name: nombre });
}

describe('Pedidos y caja: pestaña No entregados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Se desmonta antes de restaurar el mock de useEventos: si no, un re-render tardío cambia el orden de hooks
    cleanup();
    vi.restoreAllMocks();
  });

  it('muestra la pestaña con el contador de no entregados sin entrar a la pestaña', async () => {
    montarVista(true);
    render(<PedidosAdminView />);

    expect(await opcionVer(/^No entregados\s*2$/)).toBeInTheDocument();
    expect(pedidosApi.listarNoEntregados).toHaveBeenCalled();
  });

  it('al abrir la pestaña muestra los dos grupos con sus filas y el botón de reenvío', async () => {
    montarVista(true);
    render(<PedidosAdminView />);

    fireEvent.click(await opcionVer(/^No entregados/));

    const panel = await screen.findByTestId('panel-no-entregados');
    expect(within(panel).getByTestId('grupo-reprogramar')).toHaveTextContent('Por reprogramar · 1');
    expect(within(panel).getByTestId('grupo-cancelados')).toHaveTextContent('Cancelados por no recibir · 1');
    expect(within(panel).getByTestId('no-entregado-CP-R01')).toBeInTheDocument();
    expect(within(panel).getByTestId('revisar-devolucion-CP-R02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtro No entregados' })).toBeInTheDocument();
  });

  it('sin permiso repartos/liquidar la pestaña funciona pero no aparece el botón de reenvío', async () => {
    montarVista(false);
    render(<PedidosAdminView />);

    fireEvent.click(await opcionVer(/^No entregados/));

    await screen.findByTestId('panel-no-entregados');
    expect(screen.getByTestId('no-entregado-CP-R01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).not.toBeInTheDocument();
  });

  it('las pestañas de pedidos siguen funcionando y vuelven a mostrar la lista', async () => {
    montarVista(true);
    render(<PedidosAdminView />);

    fireEvent.click(await opcionVer(/^No entregados/));
    await screen.findByTestId('panel-no-entregados');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro No entregados' }));
    await waitFor(() => expect(screen.queryByTestId('panel-no-entregados')).not.toBeInTheDocument());
    expect(screen.getAllByText('CP-001').length).toBeGreaterThan(0);
  });

  it('si la consulta de no entregados falla, la vista de pedidos sigue cargando', async () => {
    montarVista(true);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockRejectedValue(new Error('caída'));
    render(<PedidosAdminView />);

    expect(await opcionVer(/^No entregados\s*0$/)).toBeInTheDocument();
    expect(screen.getAllByText('CP-001').length).toBeGreaterThan(0);
  });
});
