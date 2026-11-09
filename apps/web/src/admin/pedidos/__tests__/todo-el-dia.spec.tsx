import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { resumirDia, filasDePedidos } from '../resumenDia';
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

/** Lista servida por páginas de `limite`, como el API (mismo orden que se le da). */
function montar(todos: Pedido[], opciones: { resumen?: any[]; obtener?: Pedido } = {}) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    tiene: vi.fn(() => true),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
  if (opciones.obtener) vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue(opciones.obtener);
  const listar = vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
    if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
    const limite = f?.limite ?? 20;
    const pagina = f?.pagina ?? 1;
    return {
      total: todos.length,
      pagina,
      limite,
      items: todos.slice((pagina - 1) * limite, pagina * limite),
      ...(f?.resumen && opciones.resumen ? { resumen: opciones.resumen } : {}),
    } as any;
  });
  vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([]);
  vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
  render(
    <MemoryRouter>
      <PedidosAdminView />
    </MemoryRouter>,
  );
  return listar;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

const dia = [
  ped(1, { estado: 'PREPARANDO' }),
  ped(2, { estado: 'ENTREGADO' }),
  ped(3, { estado: 'ANULADO', total: 50 }),
  ped(4, { estado: 'RECHAZADO', total: 30 }),
  ped(5, { estado: 'COLA', pago_estado: 'PENDIENTE', modalidad: 'DELIVERY', canal: 'BOT' }),
];

describe('Todo el día', () => {
  it('por defecto la lista sigue en Activos y el botón está fuera del panel de Filtros, sin pulsar', async () => {
    montar(dia);
    const boton = await screen.findByRole('button', { name: /Todo el día/ });
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('CP-002')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
  });

  it('un toque muestra todos los estados, limpia los demás filtros y pone el chip para volver', async () => {
    montar(dia);
    fireEvent.change(await screen.findByPlaceholderText(/Buscar por código/), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: /^Todo el día/ }));
    const boton = screen.getByRole('button', { name: /Todo el día/ });
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    for (const c of ['CP-001', 'CP-002', 'CP-003', 'CP-004', 'CP-005']) expect(screen.getByText(c)).toBeTruthy();
    expect((screen.getByPlaceholderText(/Buscar por código/) as HTMLInputElement).value).toBe('');
    // El chip vuelve a la vista normal (Activos)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Mostrando todo el día' }));
    expect(screen.queryByText('CP-002')).toBeNull();
    expect(screen.getByText('CP-001')).toBeTruthy();
  });

  it('anulados y rechazados se ven con texto y sin sumar a las ventas', async () => {
    montar(dia);
    fireEvent.click(await screen.findByRole('button', { name: /^Todo el día/ }));
    expect(screen.getByText('ANULADO')).toBeTruthy();
    expect(screen.getByText('RECHAZADO')).toBeTruthy();
    const resumen = screen.getByTestId('resumen-dia');
    // 20 + 20 + 20 (preparando, entregado, cola); 50 y 30 no suman
    expect(resumen.textContent).toContain('S/ 60.00');
  });

  it('el resumen cuenta lo que muestra la lista y cada contador filtra por su estado', async () => {
    montar(dia);
    const resumen = await screen.findByTestId('resumen-dia');
    expect(resumen.textContent).toContain('5 pedidos');
    expect(within(resumen).getByRole('button', { name: /activo/ }).textContent).toContain('2');
    expect(within(resumen).getByRole('button', { name: /entregado/ }).textContent).toContain('1');
    expect(within(resumen).getByRole('button', { name: /anulado/ }).textContent).toContain('1');
    expect(within(resumen).getByRole('button', { name: /rechazado/ }).textContent).toContain('1');
    expect(within(resumen).getByRole('button', { name: /por cobrar/ }).textContent).toContain('1');
    fireEvent.click(within(resumen).getByRole('button', { name: /anulado/ }));
    expect(screen.getByText('CP-003')).toBeTruthy();
    expect(screen.queryByText('CP-001')).toBeNull();
    fireEvent.click(within(resumen).getByRole('button', { name: /por cobrar/ }));
    expect(screen.getByText('CP-005')).toBeTruthy();
    expect(screen.queryByText('CP-003')).toBeNull();
  });

  it('con más de 100 pedidos muestra «Mostrando N de M» y «Cargar más» trae el resto sin repetir', async () => {
    const muchos = Array.from({ length: 120 }, (_, i) => ped(i + 1, { estado: i % 2 ? 'ENTREGADO' : 'PREPARANDO' }));
    const listar = montar(muchos);
    const barra = await screen.findByTestId('mas-pedidos');
    expect(barra.textContent).toContain('Mostrando 100 de 120');
    fireEvent.click(within(barra).getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getByTestId('mas-pedidos').textContent).toContain('Mostrando 120 de 120'));
    expect(within(screen.getByTestId('mas-pedidos')).queryByRole('button', { name: 'Cargar más' })).toBeNull();
    expect(listar.mock.calls.some(([f]: any[]) => f?.pagina === 2 && f?.limite === 100)).toBe(true);
  });

  it('si faltan páginas, el resumen usa el conteo agrupado del servidor', async () => {
    const muchos = Array.from({ length: 120 }, (_, i) => ped(i + 1));
    montar(muchos, { resumen: [{ estado: 'ENTREGADO', pago_estado: 'PAGADO', n: 118, total: 2360 }, { estado: 'ANULADO', pago_estado: 'PAGADO', n: 2, total: 40 }] });
    const resumen = await screen.findByTestId('resumen-dia');
    expect(resumen.textContent).toContain('120 pedidos');
    expect(within(resumen).getByRole('button', { name: /entregado/ }).textContent).toContain('118');
    expect(resumen.textContent).toContain('S/ 2,360.00');
  });

  it('?vista=todo abre mostrando todos los estados', async () => {
    window.history.pushState({}, '', '/admin/caja?vista=todo');
    montar(dia);
    expect(await screen.findByText('CP-003')).toBeTruthy();
  });

  it('?pedido= abre un pedido anulado aunque no esté en la lista cargada', async () => {
    window.history.pushState({}, '', '/admin/caja?pedido=999');
    montar(dia, { obtener: ped(999, { estado: 'ANULADO' }) });
    expect(await screen.findByRole('dialog', { name: /Detalle del pedido CP-999/ })).toBeTruthy();
  });

  it('resumirDia suma coherente: activos + entregados + anulados + rechazados = total', () => {
    const r = resumirDia(filasDePedidos(dia));
    expect(r.activos + r.entregados + r.anulados + r.rechazados).toBe(r.total);
    expect(r.porCobrar).toBe(1);
  });
});
