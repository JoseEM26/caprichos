import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView, enRangoVisible } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { preferenciasApi } from '../preferenciasCaja';
import { mediosDePedido, enMedios, montosPorMedio } from '../mediosFila';
import { normalizarColumnas, COLUMNAS_POR_DEFECTO } from '../columnasCaja';
import { normalizarFilas, tamanoPagina } from '../PaginadorCaja';
import { totalesDeFilas } from '../TablaCaja';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';
import { vouchersApi } from '../../vouchers/vouchersApi';

// El contenido del detalle tiene sus propias pruebas (detalle-venta.spec.tsx): aquí solo se comprueba que se abre.
vi.mock('../DetalleVentaModal', () => ({
  DetalleVentaModal: ({ alCerrar }: { alCerrar: () => void }) => (
    <div role="dialog" aria-label="Detalle de la venta">
      <button type="button" onClick={alCerrar}>Cerrar</button>
    </div>
  ),
}));

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

let listar: { mock: { calls: any[][] } };

function montar(items: Pedido[]) {
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
  listar = vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) =>
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

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(preferenciasApi, 'obtener').mockRejectedValue(new Error('sin servidor'));
  vi.spyOn(preferenciasApi, 'guardar').mockResolvedValue({ clave: '', valor: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const abrirFiltros = async () => {
  await screen.findByTestId('resumen-dia');
  fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
};
const irATabla = async () => {
  await screen.findByTestId('resumen-dia');
  fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
};

describe('Filtros de Caja', () => {
  it('la búsqueda ignora tildes y mayúsculas, y mira también la mesa', async () => {
    montar([ped(1, { cliente_nombre: 'José Pérez' }), ped(2, { cliente_nombre: 'Ana' }), ped(3, { cliente_nombre: 'Luis', mesa_nombre: 'Terraza 4', modalidad: 'MESA' })]);
    const q = await screen.findByPlaceholderText(/Buscar por código/);
    fireEvent.change(q, { target: { value: 'jose perez' } });
    await waitFor(() => expect(screen.getAllByText('José Pérez').length).toBeGreaterThan(0));
    expect(screen.queryByText('Ana')).toBeNull();
    fireEvent.change(q, { target: { value: 'TERRAZA' } });
    await waitFor(() => expect(screen.queryByText('José Pérez')).toBeNull());
    expect(screen.getByText('Luis')).toBeTruthy();
  });

  it('canal y modalidad cambian lo que se ve y los contadores de las pastillas', async () => {
    montar([ped(1, { canal: 'CAJA' }), ped(2, { canal: 'BOT' }), ped(3, { canal: 'BOT', modalidad: 'DELIVERY' })]);
    await abrirFiltros();
    expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: /^Canal:/ }));
    fireEvent.click(screen.getByRole('option', { name: 'WhatsApp' }));
    await waitFor(() => expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: /^Modalidad:/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Delivery' }));
    await waitFor(() => expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('1'));
  });

  it('medio de pago: multi-selección en cliente (respaldo) y chip para quitarlo', async () => {
    montar([
      ped(1, { mediosPago: ['YAPE'] }),
      ped(2, { mediosPago: ['EFECTIVO'] }),
      ped(3, { planPago: [{ medio: 'PLIN', monto: 10 }, { medio: 'TARJETA', monto: 10 }] }),
      ped(4, { mediosPago: ['TRANSFERENCIA'] }),
    ]);
    await abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /^Medio de pago:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Yape/ }));
    await waitFor(() => expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('option', { name: /Plin/ }));
    await waitFor(() => expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Medio: Yape, Plin' }));
    await waitFor(() => expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('4'));
  });

  it('medio de pago: se pide también al servidor con el parámetro medios', async () => {
    montar([ped(1, { mediosPago: ['YAPE'] })]);
    await abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /^Medio de pago:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Yape/ }));
    fireEvent.click(screen.getByRole('option', { name: /Efectivo/ }));
    await waitFor(() => expect(listar.mock.calls.some(([f]: any) => f?.medios?.join(',') === 'YAPE,EFECTIVO')).toBe(true));
  });

  it('pestañas: «Todo» cuenta todo y «Listos» solo los listos', async () => {
    montar([ped(1, { estado: 'LISTO' }), ped(2, { estado: 'PREPARANDO' })]);
    await screen.findByTestId('resumen-dia');
    expect(screen.getByTestId('cuenta-todo')).toHaveTextContent('2');
    expect(screen.getByTestId('cuenta-listos')).toHaveTextContent('1');
  });

  it('un pedido nuevo de hoy no entra a una lista de otro día', () => {
    const hoy = new Date().toISOString();
    expect(enRangoVisible(hoy, { modo: 'hoy', desde: '2000-01-01', hasta: '2000-01-01' })).toBe(true);
    expect(enRangoVisible(hoy, { modo: 'ayer', desde: '2000-01-01', hasta: '2000-01-01' })).toBe(false);
    expect(enRangoVisible(hoy, { modo: 'pendientes', desde: '', hasta: '' })).toBe(false);
  });
});

describe('Medios por pedido', () => {
  it('lee mediosPago, el plan, el cobro por mozo o el medio del pedido pagado, sin repetir', () => {
    expect(mediosDePedido(ped(1, { mediosPago: ['yape', 'YAPE'] }))).toEqual(['YAPE']);
    expect(mediosDePedido(ped(1, { planPago: [{ medio: 'EFECTIVO', monto: 5 }, { medio: 'PLIN', monto: 15 }] }))).toEqual(['EFECTIVO', 'PLIN']);
    expect(mediosDePedido(ped(1, { cobroMozo: { en: ahora, medio: 'YAPE+EFECTIVO', mozo: 'Ana', faltaVoucher: false } }))).toEqual(['YAPE', 'EFECTIVO']);
    expect(mediosDePedido(ped(1, { pago_metodo: 'TARJETA' }))).toEqual(['TARJETA']);
    expect(mediosDePedido(ped(1, { pago_estado: 'PENDIENTE', pago_metodo: 'TARJETA' }))).toEqual([]);
    expect(enMedios(ped(1, { mediosPago: ['PLIN'] }), [])).toBe(true);
    expect(enMedios(ped(1, { mediosPago: ['PLIN'] }), ['YAPE'])).toBe(false);
    expect(montosPorMedio(ped(1, { planPago: [{ medio: 'EFECTIVO', monto: 5 }, { medio: 'PLIN', monto: 15 }] }))).toEqual({ EFECTIVO: 5, PLIN: 15 });
  });

  it('totales: no suman anulados y reparten por medio', () => {
    const t = totalesDeFilas([
      ped(1, { total: 30, mediosPago: ['YAPE'], propina: 2 }),
      ped(2, { total: 10, planPago: [{ medio: 'EFECTIVO', monto: 4 }, { medio: 'YAPE', monto: 6 }] }),
      ped(3, { total: 99, estado: 'ANULADO', mediosPago: ['YAPE'] }),
    ]);
    expect(t).toMatchObject({ filas: 3, total: 40, propina: 2, porMedio: { YAPE: 36, EFECTIVO: 4 } });
  });
});

describe('Vista de tabla', () => {
  it('conmutador Tarjetas | Tabla: muestra todas las filas del filtro, totales al pie y recuerda la elección', async () => {
    montar([ped(1, { total: 30, mediosPago: ['YAPE'] }), ped(2, { total: 20, mediosPago: ['EFECTIVO'] }), ped(3, { total: 50, estado: 'ANULADO' })]);
    await irATabla();
    const tabla = await screen.findByTestId('tabla-caja');
    expect(within(tabla).getAllByTestId('fila-caja')).toHaveLength(2); // el anulado es de «Cerrados»: no está en la vista por defecto
    expect(screen.getByTestId('total-filtro')).toHaveTextContent('S/ 50.00');
    expect(screen.getByTestId('total-medio-YAPE')).toHaveTextContent('S/ 30.00');
    expect(screen.getByTestId('total-medio-EFECTIVO')).toHaveTextContent('S/ 20.00');
    expect(window.localStorage.getItem('caprichos.caja.vista')).toBe('"tabla"');
    expect(preferenciasApi.guardar).toHaveBeenCalledWith('caja.vista', 'tabla');
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(screen.queryByTestId('tabla-caja')).toBeNull();
  });

  it('arranca en tabla si así quedó guardado en el servidor', async () => {
    vi.mocked(preferenciasApi.obtener).mockImplementation(async (c: string) => ({ clave: c, valor: c === 'caja.vista' ? 'tabla' : null }));
    montar([ped(1)]);
    expect(await screen.findByTestId('tabla-caja')).toBeTruthy();
  });

  it('«Ver detalle» de una fila abre el detalle de la venta', async () => {
    montar([ped(7)]);
    await irATabla();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle (CP-007)' }));
    expect(await screen.findByRole('dialog', { name: 'Detalle de la venta' })).toBeTruthy();
  });

  it('las tarjetas también tienen «Ver detalle»', async () => {
    montar([ped(8)]);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle de la venta (CP-008)' }));
    expect(await screen.findByRole('dialog', { name: 'Detalle de la venta' })).toBeTruthy();
  });

  it('columnas: ocultar una la quita de la tabla y se guarda por usuario', async () => {
    montar([ped(1)]);
    await irATabla();
    await screen.findByTestId('tabla-caja');
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Columnas' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cliente' }));
    expect(screen.queryByRole('columnheader', { name: 'Cliente' })).toBeNull();
    const esperado = COLUMNAS_POR_DEFECTO.filter((c) => c !== 'cliente');
    expect(preferenciasApi.guardar).toHaveBeenCalledWith('caja.tabla.columnas', esperado);
    // activar una nueva y subirla
    fireEvent.click(screen.getByRole('checkbox', { name: 'Canal' }));
    expect(screen.getByRole('columnheader', { name: 'Canal' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Canal' }));
    const ultima = vi.mocked(preferenciasApi.guardar).mock.calls.filter((c) => c[0] === 'caja.tabla.columnas').pop()![1] as string[];
    expect(ultima.indexOf('canal')).toBe(ultima.length - 2);
  });

  it('columnas: se restauran las guardadas en el servidor y, si falla, las de este equipo', async () => {
    vi.mocked(preferenciasApi.obtener).mockImplementation(async (c: string) => ({ clave: c, valor: c === 'caja.tabla.columnas' ? ['codigo', 'total'] : c === 'caja.vista' ? 'tabla' : null }));
    montar([ped(1)]);
    await waitFor(() => expect(screen.getAllByRole('columnheader').filter((h) => h.textContent).map((h) => h.textContent)).toEqual(['Código', 'Total']));
    cleanup();
    vi.restoreAllMocks();
    vi.spyOn(preferenciasApi, 'obtener').mockRejectedValue(new Error('sin servidor'));
    vi.spyOn(preferenciasApi, 'guardar').mockResolvedValue({ clave: '', valor: null });
    window.localStorage.setItem('caprichos.caja.vista', '"tabla"');
    window.localStorage.setItem('caprichos.caja.tabla.columnas', JSON.stringify(['hora', 'cliente']));
    montar([ped(1)]);
    await waitFor(() => expect(screen.getAllByRole('columnheader').filter((h) => h.textContent).map((h) => h.textContent)).toEqual(['Hora', 'Cliente']));
  });

  it('normalizarColumnas descarta ids raros y repetidos; vacío vuelve a las de fábrica', () => {
    expect(normalizarColumnas(['total', 'x', 'total', 'codigo'])).toEqual(['total', 'codigo']);
    expect(normalizarColumnas([])).toEqual(COLUMNAS_POR_DEFECTO);
    expect(normalizarColumnas('hola')).toEqual(COLUMNAS_POR_DEFECTO);
  });
});

describe('Paginador', () => {
  const muchos = (n: number) => Array.from({ length: n }, (_, i) => ped(i + 1));

  it('tabla: 50 por página por defecto; 10, 25, 100 y Todas cambian el rango y se guardan', async () => {
    montar(muchos(60));
    await irATabla();
    await screen.findByTestId('tabla-caja');
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–50 de 60');
    const sel = screen.getByRole('combobox', { name: 'Filas por página' });
    fireEvent.change(sel, { target: { value: '10' } });
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–10 de 60');
    expect(preferenciasApi.guardar).toHaveBeenCalledWith('caja.tabla.filas', 10);
    fireEvent.change(sel, { target: { value: '25' } });
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–25 de 60');
    fireEvent.change(sel, { target: { value: 'todas' } });
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–60 de 60');
    expect(within(screen.getByTestId('tabla-caja')).getAllByTestId('fila-caja')).toHaveLength(60);
  });

  it('el paginador no es fijo ni sticky (no salta en celular)', async () => {
    montar(muchos(3));
    await screen.findByTestId('resumen-dia');
    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(nav.style.position).toBe('');
    expect(nav.className).toBe('cj2-pag');
  });

  it('helpers: tamaños válidos y «Todas»', () => {
    expect(normalizarFilas(25)).toBe(25);
    expect(normalizarFilas(7)).toBeNull();
    expect(normalizarFilas('todas')).toBe('todas');
    expect(tamanoPagina('todas', 80, 12)).toBe(80);
    expect(tamanoPagina(null, 80, 12)).toBe(12);
    expect(tamanoPagina(100, 80, 12)).toBe(100);
  });

  it('«Todas» con más del tope avisa', async () => {
    const items = muchos(1);
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1' }, tiene: () => true } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
    vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('x'));
    // el servidor dice 2500 pedidos (una fila por página para que el test sea liviano): tras 20 páginas se llega al tope
    vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
      if (f?.pendientes) return { total: 0, items: [] } as any;
      const pag = f?.pagina ?? 1;
      return { total: 2500, pagina: pag, limite: 100, items: items.map((p) => ({ ...p, id: `${pag}-${p.id}`, codigo: `${pag}-${p.codigo}` })) } as any;
    });
    render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
    await irATabla();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Filas por página' }), { target: { value: 'todas' } });
    await waitFor(() => expect(screen.getByText(/acota el filtro/)).toBeTruthy(), { timeout: 8000 });
  }, 15000);
});

describe('Tarjeta: rótulos sin desbordes', () => {
  it('los rótulos de modalidad usan clases con wrap/min-width controlados', async () => {
    montar([ped(1, { modalidad: 'COMER_LOCAL' }), ped(2, { modalidad: 'DELIVERY' })]);
    await screen.findByTestId('resumen-dia');
    const rotulos = document.querySelectorAll('.cj2-mod-texto');
    expect(rotulos.length).toBe(2);
    expect(rotulos[0].textContent).toContain('COMER EN EL LOCAL');
    // el CSS real lo cubre la prueba de navegador; aquí se asegura la estructura que permite el wrap
    expect(rotulos[0].querySelector('.cj2-mod-txt')).not.toBeNull();
  });
});
