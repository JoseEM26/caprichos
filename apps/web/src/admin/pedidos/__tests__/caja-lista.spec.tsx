import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { VentanaDetalle } from '../VentanaDetalle';
import { accionDePedido } from '../accionesCaja';
import { enFiltroCaja, estadoVisual, nivelEspera } from '../estadosCaja';
import { pedidosApi, type Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';
import { vouchersApi } from '../../vouchers/vouchersApi';

vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { listarVouchers: vi.fn().mockResolvedValue([]) },
}));

const ahora = new Date().toISOString();
const ped = (n: number, extra: Partial<Pedido> = {}) =>
  ({
    id: String(n),
    codigo: `CP-${String(n).padStart(3, '0')}`,
    canal: 'CAJA',
    modalidad: 'LLEVAR',
    estado: 'PREPARANDO',
    pago_estado: 'PAGADO',
    total: 20,
    subtotal: 20,
    descuento: 0,
    cliente_nombre: `Cliente ${n}`,
    creado_en: ahora,
    lineas: [{ id: `l${n}`, nombre: 'Café', cantidad: 1, precio_unit: 20, subtotal: 20 }],
    ...extra,
  }) as unknown as Pedido;

function montar(items: Pedido[], tiene: (p: string) => boolean = () => true) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    tiene: vi.fn(tiene),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
  vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) =>
    f?.pendientes ? ({ total: 0, pagina: 1, limite: 1, items: [] } as any) : ({ total: items.length, pagina: 1, limite: 100, items } as any),
  );
  vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([]);
  vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
  return render(
    <MemoryRouter>
      <PedidosAdminView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Reglas de estado de la lista de Caja', () => {
  it('«A domicilio» incluye el delivery en cualquier etapa; «En preparación» y «Listos» son su estado', () => {
    expect(enFiltroCaja(ped(1, { modalidad: 'DELIVERY', estado: 'COLA' }), 'domi')).toBe(true);
    expect(enFiltroCaja(ped(1, { modalidad: 'DELIVERY', estado: 'EN_CAMINO' }), 'domi')).toBe(true);
    expect(enFiltroCaja(ped(1, { modalidad: 'LLEVAR' }), 'domi')).toBe(false);
    expect(enFiltroCaja(ped(1, { estado: 'PREPARANDO' }), 'prep')).toBe(true);
    expect(enFiltroCaja(ped(1, { estado: 'LISTO' }), 'prep')).toBe(false);
    expect(enFiltroCaja(ped(1, { estado: 'LISTO' }), 'listos')).toBe(true);
  });

  it('colores: pendiente naranja, preparación dorado, listo verde, camino azul petróleo', () => {
    expect(estadoVisual(ped(1, { estado: 'COLA', pago_estado: 'PENDIENTE' })).l).toBe('Por confirmar');
    expect(estadoVisual(ped(1, { estado: 'COLA', modalidad: 'MESA' })).barra).toBe('#E67929');
    expect(estadoVisual(ped(1, { estado: 'PREPARANDO' })).barra).toBe('#D99E39');
    expect(estadoVisual(ped(1, { estado: 'LISTO' })).barra).toBe('#2F7A45');
    expect(estadoVisual(ped(1, { estado: 'EN_CAMINO' })).barra).toBe('#2C4C5D');
  });

  it('espera: verde <35, óxido 35–49, rojo ≥50, neutro en cerrados', () => {
    expect(nivelEspera(34, false)).toBe('verde');
    expect(nivelEspera(35, false)).toBe('oxido');
    expect(nivelEspera(49, false)).toBe('oxido');
    expect(nivelEspera(50, false)).toBe('rojo');
    expect(nivelEspera(90, true)).toBe('neutro');
  });

  it('acción siguiente por estado, con permisos y sin botón en cerrados', () => {
    const todo = () => true;
    expect(accionDePedido(ped(1, { estado: 'NUEVO', pago_estado: 'PENDIENTE' }), todo)?.texto).toBe('CONFIRMAR PAGO');
    expect(accionDePedido(ped(1, { estado: 'COLA' }), todo)?.texto).toBe('PREPARAR');
    expect(accionDePedido(ped(1, { estado: 'PREPARANDO' }), todo)?.texto).toBe('LISTO');
    expect(accionDePedido(ped(1, { estado: 'LISTO' }), todo)?.texto).toBe('ENTREGAR');
    expect(accionDePedido(ped(1, { estado: 'LISTO', pago_estado: 'PENDIENTE' }), todo)?.texto).toMatch(/^COBRAR/);
    expect(accionDePedido(ped(1, { estado: 'EN_CAMINO', modalidad: 'DELIVERY' }), todo)?.texto).toBe('ENTREGAR');
    // Delivery listo: sin repartidor abre el detalle (explica cómo asignarlo); con repartidor envía
    expect(accionDePedido(ped(1, { estado: 'LISTO', modalidad: 'DELIVERY' }), todo)).toMatchObject({ texto: 'ENVIAR', tipo: 'detalle' });
    expect(accionDePedido(ped(1, { estado: 'LISTO', modalidad: 'DELIVERY', repartidor_party_id: 'r1' } as any), todo)).toMatchObject({ texto: 'ENVIAR', tipo: 'estado', nuevoEstado: 'EN_CAMINO' });
    for (const e of ['ENTREGADO', 'ANULADO', 'RECHAZADO']) expect(accionDePedido(ped(1, { estado: e }), todo)).toBeNull();
    // Sin permiso de cambiar estado no hay botón de estado
    expect(accionDePedido(ped(1, { estado: 'PREPARANDO' }), () => false)).toBeNull();
  });
});

describe('Lista de Caja: tarjetas, ventana y paginación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el botón de la tarjeta pide Sí/No: «No» no cambia nada, «Sí» cambia el estado, y no abre el detalle', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    montar([ped(7)]);

    fireEvent.click(await screen.findByRole('button', { name: 'LISTO CP-007' }));
    expect(screen.queryByRole('dialog', { name: /Detalle del pedido/ })).not.toBeInTheDocument();
    const confirmar = screen.getByRole('dialog', { name: /CP-007/ });
    fireEvent.click(within(confirmar).getByRole('button', { name: 'No' }));
    expect(cambiar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'LISTO CP-007' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /CP-007/ })).getByRole('button', { name: /Sí, continuar/ }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('7', 'LISTO'));
    expect(screen.queryByRole('dialog', { name: /Detalle del pedido/ })).not.toBeInTheDocument();
  });

  it('CONFIRMAR PAGO abre el mismo modal que el detalle', async () => {
    montar([ped(8, { estado: 'NUEVO', pago_estado: 'PENDIENTE' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR PAGO CP-008' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Detalle del pedido/ })).not.toBeInTheDocument();
  });

  it('tocar la tarjeta abre el detalle en la ventana; se cierra con la X, con Escape y con clic fuera', async () => {
    montar([ped(7, { estado: 'LISTO' })]);

    fireEvent.click(await screen.findByRole('button', { name: /^Pedido CP-007/ }));
    let ventana = await screen.findByRole('dialog', { name: 'Detalle del pedido CP-007' });
    expect(ventana).toHaveAttribute('aria-modal', 'true');

    fireEvent.click(within(ventana).getByRole('button', { name: 'Cerrar detalle del pedido' }));
    expect(screen.queryByRole('dialog', { name: /Detalle/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Pedido CP-007/ }));
    ventana = await screen.findByRole('dialog', { name: 'Detalle del pedido CP-007' });
    fireEvent.keyDown(ventana, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Detalle/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Pedido CP-007/ }));
    ventana = await screen.findByRole('dialog', { name: 'Detalle del pedido CP-007' });
    fireEvent.click(ventana.parentElement!);
    expect(screen.queryByRole('dialog', { name: /Detalle/ })).not.toBeInTheDocument();
  });

  it('un clic dentro de la ventana no la cierra', async () => {
    const alCerrar = vi.fn();
    render(
      <VentanaDetalle titulo="Prueba" alCerrar={alCerrar}>
        <p>Contenido</p>
      </VentanaDetalle>,
    );
    fireEvent.click(screen.getByText('Contenido'));
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('el enlace profundo ?pedido=ID abre la ventana de ese pedido', async () => {
    window.history.pushState({}, '', '/admin/caja?pedido=7');
    try {
      montar([ped(6), ped(7, { estado: 'LISTO' })]);
      expect(await screen.findByRole('dialog', { name: 'Detalle del pedido CP-007' })).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('paginación fina de una línea: «1–8 de 10» con flechas', async () => {
    montar(Array.from({ length: 10 }, (_, i) => ped(i + 1)));

    expect(await screen.findByTestId('rango-pagina')).toHaveTextContent('1–8 de 10');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('9–10 de 10');
    expect(screen.getByText('CP-009')).toBeInTheDocument();
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  it('el botón flotante abre «Nuevo pedido»', async () => {
    const { salonApi } = await import('../../salon/api');
    const mesas = vi.spyOn(salonApi, 'obtenerMesas').mockResolvedValue({ pisos: [] } as any);
    montar([ped(1)]);
    const fab = await screen.findByRole('button', { name: 'Agregar nuevo pedido' });
    fireEvent.click(fab);
    await waitFor(() => expect(mesas).toHaveBeenCalled());
  });

  it('el atajo «N por confirmar» filtra por esa etapa y el chip se quita', async () => {
    montar([ped(1, { estado: 'NUEVO', pago_estado: 'PENDIENTE' }), ped(2)]);
    fireEvent.click(await screen.findByRole('button', { name: '1 por confirmar' }));
    expect(screen.getByText('CP-001')).toBeInTheDocument();
    expect(screen.queryByText('CP-002')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Por confirmar' }));
    expect(screen.getByText('CP-002')).toBeInTheDocument();
  });

  it('la búsqueda por celular con +51 sigue encontrando el pedido', async () => {
    montar([ped(1, { cliente_telefono: '987654321' } as any), ped(2, { cliente_telefono: '911222333' } as any)]);
    await screen.findByText('CP-001');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '+51 987 654 321' } });
    expect(screen.getByText('CP-001')).toBeInTheDocument();
    expect(screen.queryByText('CP-002')).not.toBeInTheDocument();
  });
});
