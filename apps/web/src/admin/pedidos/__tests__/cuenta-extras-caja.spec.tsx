import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { agruparCuentas } from '../agruparCuentas';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { abrirFiltros } from './abrirFiltros';

vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { listarVouchers: vi.fn().mockResolvedValue([]) },
}));

const t0 = Date.now();
const ped = (n: number, extra: Partial<Pedido> = {}) =>
  ({
    id: String(n),
    codigo: `CP-W${100 + n}`,
    canal: 'CAJA',
    modalidad: 'MESA',
    mesa_nombre: 'Mesa 4',
    estado: 'PREPARANDO',
    pago_estado: 'PAGADO',
    total: 30,
    subtotal: 30,
    descuento: 0,
    cliente_nombre: `Cliente ${n}`,
    creado_en: new Date(t0 - (50 - n) * 60000).toISOString(),
    lineas: [{ id: `l${n}`, nombre: `Producto ${n}`, cantidad: 1, precio_unit: 30, subtotal: 30 }],
    ...extra,
  }) as unknown as Pedido;

const original = () => ped(20, { cliente_nombre: 'Ana', total: 30, estado: 'PREPARANDO', pago_estado: 'PAGADO' });
const extra1 = () => ped(21, { cliente_nombre: 'Ana', total: 6, estado: 'LISTO', pago_estado: 'PENDIENTE', pedido_origen: { id: '20', codigo: 'CP-W120' } });
const extra2 = () => ped(22, { cliente_nombre: 'Ana', total: 4, estado: 'COLA', pago_estado: 'PENDIENTE', pedido_origen: { id: '20', codigo: 'CP-W120' } });
const suelto = () => ped(5, { cliente_nombre: 'Luis', modalidad: 'LLEVAR', mesa_nombre: null });

let manejadores: Record<string, ((d: any) => void)[]> = {};

function montar(items: Pedido[], opciones: { relacionados?: Pedido[]; obtener?: (id: string) => Pedido } = {}) {
  manejadores = {};
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    tiene: vi.fn(() => true),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: (d: any) => void) => {
    (manejadores[ev] ??= []).push(fn);
  }) as any);
  vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
  if (opciones.obtener) vi.spyOn(pedidosApi, 'obtenerPorId').mockImplementation(async (id: any) => opciones.obtener!(String(id)));
  vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
    if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
    return { total: items.length, pagina: 1, limite: 100, items, relacionados: opciones.relacionados ?? [] } as any;
  });
  vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([]);
  vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
  render(
    <MemoryRouter>
      <PedidosAdminView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

describe('Caja: una tarjeta por cuenta (original + extras)', () => {
  it('original + 2 extras: UNA tarjeta con los 3 códigos, rótulos y total de la cuenta', async () => {
    montar([extra2(), extra1(), original(), suelto()]);
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    expect(screen.getAllByTestId('tarjeta-cuenta')).toHaveLength(1);
    const secciones = within(tarjeta).getAllByTestId('seccion-pedido');
    expect(secciones.map((s) => s.getAttribute('data-pedido'))).toEqual(['CP-W120', 'CP-W121', 'CP-W122']);
    expect(within(tarjeta).getByTestId('rotulo-original')).toHaveTextContent('PEDIDO ORIGINAL');
    expect(within(tarjeta).getAllByTestId('insignia-extra')).toHaveLength(2);
    expect(within(tarjeta).getAllByTestId('insignia-extra')[0]).toHaveTextContent('EXTRA');
    // Total vigente 30 + 6 + 4; por cobrar solo los dos extras pendientes
    expect(within(tarjeta).getByTestId('total-cuenta')).toHaveTextContent('Total de la cuenta: S/ 40.00');
    expect(within(tarjeta).getByTestId('total-cuenta')).toHaveTextContent('Por cobrar S/ 10.00');
    // Cada pedido con su propio estado
    expect(within(secciones[0]).getByTestId('chip-estado')).toHaveTextContent('En preparación');
    expect(within(secciones[1]).getByTestId('chip-estado')).toHaveTextContent('Listo');
    // Encabezado: el cliente del original; el pedido suelto sigue como tarjeta normal
    expect(within(tarjeta).getByTestId('cuenta-cabecera')).toHaveTextContent('Ana');
    expect(screen.getByText('CP-W105')).toBeTruthy();
    // Los códigos del extra no aparecen como tarjetas aparte
    expect(screen.getAllByText('CP-W121')).toHaveLength(1);
  });

  it('un pedido sin extras se ve como antes (sin tarjeta de cuenta)', async () => {
    montar([suelto()]);
    await screen.findByText('CP-W105');
    expect(screen.queryByTestId('tarjeta-cuenta')).toBeNull();
    expect(screen.getByTestId('barra-estado')).toBeTruthy();
  });

  it('buscar por el código de un extra encuentra la cuenta completa', async () => {
    montar([extra2(), extra1(), original(), suelto()]);
    await screen.findByTestId('tarjeta-cuenta');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'W122' } });
    const tarjeta = screen.getByTestId('tarjeta-cuenta');
    expect(within(tarjeta).getAllByTestId('seccion-pedido')).toHaveLength(3);
    expect(screen.queryByText('CP-W105')).toBeNull();
    // Los pedidos que no coinciden con la búsqueda se ven atenuados y con su aviso, sin esconderlos
    expect(within(tarjeta).getAllByTestId('fuera-filtro')).toHaveLength(2);
  });

  it('el filtro de estado con mezcla: aparece si CUALQUIER pedido lo cumple y marca los demás', async () => {
    montar([extra1(), original()]);
    await screen.findByTestId('tarjeta-cuenta');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Listos/ }));
    const tarjeta = screen.getByTestId('tarjeta-cuenta');
    expect(within(tarjeta).getAllByTestId('seccion-pedido')).toHaveLength(2);
    const fuera = within(tarjeta).getAllByTestId('fuera-filtro');
    expect(fuera).toHaveLength(1);
    expect(fuera[0].closest('[data-testid="seccion-pedido"]')?.getAttribute('data-pedido')).toBe('CP-W120');
  });

  it('cada pedido de la cuenta conserva su acción y su menú «⋯»', async () => {
    montar([extra1(), original()]);
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    const acciones = within(tarjeta).getAllByRole('button').filter((b) => b.hasAttribute('data-accion'));
    // El extra está LISTO y por cobrar: tiene su acción, con su código
    expect(acciones.some((b) => /CP-W121$/.test(b.getAttribute('aria-label') || ''))).toBe(true);
    expect(within(tarjeta).getByLabelText('Más acciones de CP-W121')).toBeTruthy();
    expect(within(tarjeta).getByLabelText('Más acciones de CP-W120')).toBeTruthy();
  });

  it('tocar el encabezado abre el original; tocar una sección abre ese pedido', async () => {
    montar([extra1(), original()]);
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    fireEvent.click(within(tarjeta).getByLabelText(/Pedido CP-W121 extra/));
    await waitFor(() => expect(within(screen.getByTestId('tarjeta-cuenta')).getByLabelText(/Pedido CP-W121 extra/).closest('section')?.className).toContain('--sel'));
    fireEvent.click(within(tarjeta).getByTestId('cuenta-cabecera'));
    await waitFor(() => expect(within(screen.getByTestId('tarjeta-cuenta')).getByLabelText(/Pedido CP-W120 original/).closest('section')?.className).toContain('--sel'));
  });

  it('?pedido=<id del extra> abre ese extra y resalta su sección', async () => {
    window.history.pushState({}, '', '/admin/caja?pedido=21');
    montar([extra1(), original()]);
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    await waitFor(() => {
      const sec = within(tarjeta).getAllByTestId('seccion-pedido').find((s) => s.getAttribute('data-pedido') === 'CP-W121')!;
      expect(sec.className).toContain('cj2-cta-sec--sel');
    });
  });

  it('un extra que llega por socket se une a la tarjeta de su original sin duplicarse', async () => {
    montar([suelto(), original()], { obtener: (id) => (id === '21' ? extra1() : original()) });
    await screen.findByText('CP-W120');
    expect(screen.queryByTestId('tarjeta-cuenta')).toBeNull();
    await act(async () => {
      manejadores['pedido:nuevo'].forEach((fn) => fn({ id: '21', codigo: 'CP-W121' }));
    });
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    expect(within(tarjeta).getAllByTestId('seccion-pedido')).toHaveLength(2);
    expect(screen.getAllByText('CP-W121')).toHaveLength(1);
    expect(screen.getAllByText('CP-W120')).toHaveLength(1);
  });

  it('contadores y resumen del día siguen sumando cada pedido; el rango de página cuenta tarjetas', async () => {
    montar([extra2(), extra1(), original(), suelto()]);
    await screen.findByTestId('tarjeta-cuenta');
    expect(screen.getByTestId('resumen-dia')).toHaveTextContent('4 pedidos');
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('1–2 de 2');
  });

  it('el original que la página no trajo llega por `relacionados` y se une igual, sin sumar al resumen', async () => {
    montar([extra1()], { relacionados: [original()] });
    const tarjeta = await screen.findByTestId('tarjeta-cuenta');
    expect(within(tarjeta).getAllByTestId('seccion-pedido')).toHaveLength(2);
    expect(within(tarjeta).getByTestId('rotulo-original')).toHaveTextContent('PEDIDO ORIGINAL');
    expect(screen.getByTestId('resumen-dia')).toHaveTextContent('1 pedido');
  });
});

describe('agruparCuentas', () => {
  const p = (id: string, origen?: string) => ({ id, origen });
  const raiz = (x: { id: string; origen?: string }) => x.origen ?? x.id;
  it('la cuenta ocupa el lugar de su primer miembro y pone el original primero', () => {
    const lista = [p('3', '1'), p('2'), p('1'), p('4', '1')];
    const c = agruparCuentas(lista, lista, raiz);
    expect(c.map((x) => x.raizId)).toEqual(['1', '2']);
    expect(c[0].miembros.map((m) => m.id)).toEqual(['1', '3', '4']);
  });
  it('los miembros fuera del filtro viajan en la cuenta pero no están en `coincide`', () => {
    const c = agruparCuentas([p('3', '1')], [p('1'), p('3', '1')], raiz);
    expect(c[0].miembros.map((m) => m.id)).toEqual(['1', '3']);
    expect([...c[0].coincide]).toEqual(['3']);
  });
});
