import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
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

afterEach(() => vi.restoreAllMocks());

const dia = [
  ped(1, { estado: 'PREPARANDO' }),
  ped(2, { estado: 'ENTREGADO' }),
  ped(3, { estado: 'ANULADO', total: 50 }),
  ped(5, { estado: 'COLA', pago_estado: 'PENDIENTE', modalidad: 'DELIVERY', canal: 'BOT' }),
];

describe('Encabezado compacto de Caja', () => {
  beforeEach(() => window.localStorage.clear());

  it('el título va en la cabecera y la frase explicativa es un ⓘ con tooltip y nombre accesible', async () => {
    montar(dia);
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos y caja' })).toBeTruthy();
    const info = screen.getByRole('button', { name: /El cajero verifica cada pedido/ });
    expect(info.getAttribute('title')).toMatch(/El cajero verifica/);
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(info);
    expect(screen.getByRole('note').textContent).toMatch(/El cajero verifica/);
  });

  it('el panel de Filtros está cerrado, se abre con foco, y Escape lo cierra', async () => {
    montar(dia);
    const boton = await screen.findByRole('button', { name: /^Filtros/ });
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
    fireEvent.click(boton);
    const panel = screen.getByRole('group', { name: 'Filtros' });
    expect(document.activeElement).toBe(panel);
    for (const n of ['Estado', 'Etapa', 'Canal', 'Modalidad', 'Cobro', 'Orden por tiempo']) {
      expect(within(panel).getAllByText(new RegExp(n)).length).toBeGreaterThan(0);
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
    expect(document.activeElement).toBe(boton);
  });

  it('un clic fuera cierra el panel', async () => {
    montar(dia);
    fireEvent.click(await screen.findByRole('button', { name: /^Filtros/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
  });

  it('el badge cuenta los filtros activos y el chip los quita', async () => {
    montar(dia);
    const boton = await screen.findByRole('button', { name: /^Filtros/ });
    expect(boton.querySelector('.cj2-n-filtros')).toBeNull();
    fireEvent.click(within(screen.getByTestId('resumen-dia')).getByRole('button', { name: /entregado/ }));
    expect(boton.querySelector('.cj2-n-filtros')?.textContent).toBe('2');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Solo entregados' }));
    expect(boton.querySelector('.cj2-n-filtros')?.textContent).toBe('1');
  });

  it('«Rechazados» se oculta cuando es 0, y la búsqueda se limpia con la ✕', async () => {
    montar(dia);
    const resumen = await screen.findByTestId('resumen-dia');
    expect(within(resumen).queryByRole('button', { name: /rechazado/ })).toBeNull();
    expect(resumen.textContent).toContain('4 pedidos');
    const q = screen.getByPlaceholderText(/Buscar por código/) as HTMLInputElement;
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).toBeNull();
    fireEvent.change(q, { target: { value: 'CP-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(q.value).toBe('');
  });

  it('el resumen se pliega, lo recuerda, y sigue funcionando si el almacenamiento falla', async () => {
    montar(dia);
    const resumen = await screen.findByTestId('resumen-dia');
    fireEvent.click(within(resumen).getByRole('button', { name: /Resumen/ }));
    expect(within(resumen).queryByRole('button', { name: /activo/ })).toBeNull();
    expect(window.localStorage.getItem('caprichos.caja.resumen')).toBe('plegado');
    cleanup();
    montar(dia);
    expect(within(await screen.findByTestId('resumen-dia')).queryByRole('button', { name: /activo/ })).toBeNull();
    cleanup();
    window.localStorage.clear();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    montar(dia);
    const r2 = await screen.findByTestId('resumen-dia');
    fireEvent.click(within(r2).getByRole('button', { name: /Resumen/ }));
    expect(within(r2).queryByRole('button', { name: /activo/ })).toBeNull();
  });

  it('arriba queda una línea (Filtros, búsqueda y «Limpiar» si hay filtros); el panel es accesible y devuelve el foco con Esc', async () => {
    montar(dia);
    const boton = await screen.findByRole('button', { name: /^Filtros/ });
    expect(screen.queryByRole('link', { name: /Limpiar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull();
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveAttribute('aria-controls', 'cj2-panel-filtros');
    fireEvent.click(within(screen.getByTestId('resumen-dia')).getByRole('button', { name: /entregado/ }));
    // Con filtros activos: insignia con el número y «Limpiar» en la misma línea (fuera del panel)
    expect(boton.querySelector('.cj2-n-filtros')).not.toBeNull();
    const limpiar = screen.getByRole('button', { name: 'Limpiar' });
    expect(limpiar).toHaveClass('cj2-limpiar--linea');
    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('cj2-panel-filtros') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(within(panel).getByRole('navigation', { name: 'Estado de los pedidos' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /Todo el día/ })).toBeTruthy();
    expect(within(panel).getAllByRole('button', { name: /^Quitar filtro/ }).length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Filtros' })).toBeNull();
    expect(document.activeElement).toBe(boton);
    fireEvent.click(limpiar);
    expect(boton.querySelector('.cj2-n-filtros')).toBeNull();
  });
});
