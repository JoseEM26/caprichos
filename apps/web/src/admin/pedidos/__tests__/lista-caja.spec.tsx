import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { ListaCaja, ranurasDeAccion } from '../ListaCaja';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { preferenciasApi } from '../preferenciasCaja';
import { normalizarVistaCaja } from '../ControlesTabla';
import { abrirFiltros } from './abrirFiltros';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';
import { vouchersApi } from '../../vouchers/vouchersApi';

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

function montar(items: Pedido[], permisos: string[] | 'todos' = 'todos') {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Usuario Prueba', rol: 'CAJERO' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    tiene: vi.fn((p: string) => permisos === 'todos' || permisos.includes(p)),
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

const irALista = async () => {
  await screen.findByTestId('resumen-dia');
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
  return screen.findByTestId('lista-caja');
};
const codigosEnLista = () => screen.getAllByTestId('fila-lista').map((f) => within(f).getByText(/^CP-\d+$/).textContent);

describe('Vista Lista: interruptor y preferencia', () => {
  it('Tabla | Tarjetas | Lista: se alterna y se recuerda por usuario', async () => {
    montar([ped(1)]);
    await screen.findByTestId('resumen-dia');
    const grupo = screen.getByRole('group', { name: 'Vista de la lista' });
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tarjetas', 'Tabla', 'Lista']);
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(await screen.findByTestId('lista-caja')).toBeTruthy();
    expect(window.localStorage.getItem('caprichos.caja.vista')).toBe('"lista"');
    expect(preferenciasApi.guardar).toHaveBeenCalledWith('caja.vista', 'lista');
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    expect(screen.queryByTestId('lista-caja')).toBeNull();
    expect(screen.getByTestId('tabla-caja')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(screen.queryByTestId('tabla-caja')).toBeNull();
  });

  it('el interruptor vive dentro de la cabecera (con Nuevo pedido), no en una fila propia, con nombre y título por opción', async () => {
    montar([ped(1)]);
    await screen.findByTestId('resumen-dia');
    const grupo = screen.getByRole('group', { name: 'Vista de la lista' });
    const cabecera = grupo.closest('.cj2-cab') as HTMLElement;
    expect(cabecera).toBeTruthy();
    expect(within(cabecera).getByRole('button', { name: 'Nuevo pedido' })).toBeTruthy();
    expect(grupo.closest('.cj2-control')).toBeNull();
    for (const n of ['Tarjetas', 'Tabla', 'Lista']) expect(within(grupo).getByRole('button', { name: n })).toHaveAttribute('title', n);
    // el selector de columnas aparece junto al interruptor solo en Tabla
    expect(within(cabecera).queryByRole('button', { name: /Columnas/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    expect(within(cabecera).getByRole('button', { name: /Columnas/ })).toBeTruthy();
  });

  it('arranca en Lista si así quedó guardado; una preferencia antigua (tabla) o desconocida sigue siendo válida', async () => {
    vi.mocked(preferenciasApi.obtener).mockImplementation(async (c: string) => ({ clave: c, valor: c === 'caja.vista' ? 'lista' : null }));
    montar([ped(1)]);
    expect(await screen.findByTestId('lista-caja')).toBeTruthy();
    expect(normalizarVistaCaja('tabla')).toBe('tabla');
    expect(normalizarVistaCaja('tarjetas')).toBe('tarjetas');
    expect(normalizarVistaCaja('lista')).toBe('lista');
    expect(normalizarVistaCaja('cuadro')).toBe('tarjetas');
    expect(normalizarVistaCaja(null)).toBe('tarjetas');
  });
});

describe('Vista Lista: mismos filtros que Tarjetas y Tabla', () => {
  const surtido = () => [
    ped(1, { cliente_nombre: 'Ana Prueba', modalidad: 'LLEVAR', mediosPago: ['YAPE'] }),
    ped(2, { cliente_nombre: 'Luis Prueba', modalidad: 'DELIVERY', mediosPago: ['EFECTIVO'] }),
    ped(3, { cliente_nombre: 'Rosa Prueba', modalidad: 'MESA', mesa_nombre: 'Mesa 3', estado: 'ENTREGADO' }),
    ped(4, { cliente_nombre: 'Ana Maria Prueba', modalidad: 'MESA', mesa_nombre: 'Mesa 4', pago_estado: 'PENDIENTE' }),
  ];
  const codigosTarjetas = () => screen.getAllByText(/^CP-\d+$/).map((e) => e.textContent).sort();

  it('hay búsqueda, botón Filtros, pastillas de estado, «Todo el día» y Resumen que filtra; no hay la nota vieja', async () => {
    montar([ped(1)]);
    await irALista();
    expect(screen.getByPlaceholderText(/Buscar por código/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtros/ })).toBeTruthy();
    // Estado y «Todo el día» viven dentro del panel «Filtros» (la barra de arriba es una sola línea)
    expect(screen.queryByRole('navigation', { name: 'Estado de los pedidos' })).toBeNull();
    abrirFiltros();
    expect(screen.getByTestId('cuenta-todo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Todo el día/ })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Estado de los pedidos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /activo/ })).not.toBeDisabled();
    expect(screen.queryByTestId('nota-lista-filtros')).toBeNull();
    expect(screen.queryByText(/los filtros aplican en/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Medio de pago:/ })).toBeTruthy();
    // El orden es el general de Caja («Orden por tiempo»), el mismo de Tarjetas y Tabla
    expect(screen.getByRole('group', { name: 'Orden por tiempo' })).toBeTruthy();
  });

  it('la búsqueda da los mismos pedidos en Tarjetas, Tabla y Lista, y se conserva al cambiar de vista', async () => {
    montar(surtido());
    await screen.findByTestId('resumen-dia');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'Ana' } });
    await waitFor(() => expect(screen.queryByText('Luis Prueba')).toBeNull());
    const enTarjetas = codigosTarjetas();
    expect(enTarjetas).toEqual(['CP-001', 'CP-004']);
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const enTabla = within(await screen.findByTestId('tabla-caja')).getAllByText(/^CP-\d+$/).map((e) => e.textContent).sort();
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    await screen.findByTestId('lista-caja');
    expect(enTabla).toEqual(enTarjetas);
    expect(codigosEnLista().sort()).toEqual(enTarjetas);
    expect((screen.getByPlaceholderText(/Buscar por código/) as HTMLInputElement).value).toBe('Ana');
  });

  it('las pastillas de estado y «Todo el día» filtran la Lista igual que las tarjetas (entregados solo con «Todo el día»)', async () => {
    montar(surtido());
    await irALista();
    expect(codigosEnLista().sort()).toEqual(['CP-001', 'CP-002', 'CP-004']); // por defecto: los activos
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    expect(codigosEnLista().sort()).toEqual(['CP-001', 'CP-002', 'CP-003', 'CP-004']);
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–4 de 4');
  });

  it('un contador del Resumen filtra la Lista (Entregados) y los chips lo muestran', async () => {
    montar(surtido());
    await irALista();
    fireEvent.click(screen.getByRole('button', { name: /entregado/ }));
    await waitFor(() => expect(codigosEnLista()).toEqual(['CP-003']));
    abrirFiltros();
    expect(screen.getAllByRole('button', { name: /^Quitar filtro/ }).length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByTestId('resumen-dia')).getByRole('button', { name: /activo/ }));
    expect(codigosEnLista().sort()).toEqual(['CP-001', 'CP-002', 'CP-004']);
  });

  it('el filtro por medio de pago llega al servidor también desde la Lista, y no se pierde al cambiar de vista', async () => {
    montar([ped(1, { mediosPago: ['YAPE'] })]);
    await irALista();
    listar.mock.calls.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Medio de pago:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Yape/ }));
    await waitFor(() => expect(listar.mock.calls.some(([f]: any) => f?.medios?.join(',') === 'YAPE')).toBe(true));
    listar.mock.calls.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    await screen.findByTestId('lista-caja');
    // cambiar de vista no vuelve a pedir ni suelta el medio
    expect(listar.mock.calls.filter(([f]: any) => !f?.pendientes && !f?.medios)).toHaveLength(0);
    abrirFiltros();
    expect(screen.getByRole('button', { name: /^Quitar filtro Medio: Yape/ })).toBeTruthy();
  });

  it('un filtro sin resultados dice «No hay pedidos con estos filtros» y permite limpiarlos', async () => {
    montar(surtido());
    await irALista();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'zzz' } });
    expect(await screen.findByText('No hay pedidos con estos filtros.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]);
    await waitFor(() => expect(codigosEnLista()).toHaveLength(3));
  });
});

describe('Vista Lista: sin pestañas ni «Ordenar por» propio; orden general y un solo pie', () => {
  // Del servidor llegan del más reciente al más antiguo (creado_en desc)
  const tres = () => [
    ped(2, { total: 10, cliente_nombre: 'Ana Prueba', creado_en: '2026-11-10T16:00:00Z' }),
    ped(1, { total: 30, cliente_nombre: 'Beto Prueba', creado_en: '2026-11-10T15:00:00Z' }),
    ped(3, { total: 20, cliente_nombre: 'Carla Prueba', creado_en: '2026-11-10T14:00:00Z' }),
  ];
  const codigosTarjetas = () => screen.getAllByText(/^CP-\d+$/).map((e) => e.textContent);

  it('no hay pestañas por tipo de servicio ni el bloque «Ordenar por»', async () => {
    montar(tres());
    await irALista();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.queryByText('Ordenar por')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Ordenar por' })).toBeNull();
    expect(screen.queryByTestId('lista-cuenta-todos')).toBeNull();
    expect(screen.queryByRole('button', { name: /Ascendente|Descendente/ })).toBeNull();
  });

  it('el orden por defecto de la Lista es el de Tarjetas (más recientes arriba) y el orden general lo invierte', async () => {
    montar(tres());
    await screen.findByTestId('resumen-dia');
    const enTarjetas = codigosTarjetas();
    expect(enTarjetas).toEqual(['CP-002', 'CP-001', 'CP-003']);
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    await screen.findByTestId('lista-caja');
    expect(codigosEnLista()).toEqual(enTarjetas);
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /^Más tiempo primero/ }));
    expect(codigosEnLista()).toEqual(['CP-003', 'CP-001', 'CP-002']);
    expect(screen.getByRole('button', { name: 'Quitar orden: más tiempo primero' })).toBeTruthy();
  });

  it('una preferencia vieja «caja.lista.orden» se ignora sin error: ni se lee ni se guarda', async () => {
    window.localStorage.setItem('caprichos.caja.vista', '"lista"');
    window.localStorage.setItem('caprichos.caja.lista.orden', JSON.stringify({ campo: 'cliente', dir: 'asc' }));
    montar(tres());
    await screen.findByTestId('lista-caja');
    expect(codigosEnLista()).toEqual(['CP-002', 'CP-001', 'CP-003']);
    const claves = [...vi.mocked(preferenciasApi.obtener).mock.calls, ...vi.mocked(preferenciasApi.guardar).mock.calls].map((c) => c[0]);
    expect(claves).not.toContain('caja.lista.orden');
  });

  describe('pie único', () => {
    const muchos = () => Array.from({ length: 120 }, (_, i) => ped(i + 1));
    const montarPaginado = (pagina2: () => Promise<any>) => {
      const todos = muchos();
      vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
        usuario: { partyId: '1', nombres: 'Usuario Prueba', rol: 'CAJERO' }, permisos: [], debeCambiar: false, cargando: false, autenticado: true, tiene: vi.fn(() => true),
      } as any);
      vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
      vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
      vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
      vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
      vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([]);
      vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
        if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
        if (f?.pagina === 2) return pagina2();
        return { total: 120, pagina: 1, limite: 100, items: todos.slice(0, 100) } as any;
      });
      window.localStorage.setItem('caprichos.caja.vista', '"lista"');
      return render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
    };

    it('mientras carga: una sola barra, con el conteo coherente y «Cargando…» como texto (no un botón)', async () => {
      let soltar: (v: any) => void = () => {};
      montarPaginado(() => new Promise((r) => { soltar = r; }));
      await screen.findByTestId('lista-caja');
      const pie = await screen.findByRole('navigation', { name: 'Paginación' });
      expect(screen.getAllByRole('navigation', { name: 'Paginación' })).toHaveLength(1);
      expect(screen.queryByTestId('mas-pedidos')).toBeNull();
      await waitFor(() => expect(within(pie).getByTestId('pag-carga')).toHaveTextContent('Cargando… 100/120'));
      expect(within(pie).queryByRole('button', { name: /Cargar|Cargando/ })).toBeNull();
      expect(within(pie).getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–25 de 100');
      await act(async () => { soltar({ total: 120, pagina: 2, limite: 100, items: muchos().slice(100) }); });
      await waitFor(() => expect(screen.queryByTestId('pag-carga')).toBeNull());
      expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–25 de 120');
    });

    it('si falla la carga, «Cargar más» queda como enlace en la MISMA barra y reintenta', async () => {
      let intento = 0;
      montarPaginado(async () => {
        intento++;
        if (intento === 1) throw new Error('sin red');
        return { total: 120, pagina: 2, limite: 100, items: muchos().slice(100) } as any;
      });
      await screen.findByTestId('lista-caja');
      const pie = await screen.findByRole('navigation', { name: 'Paginación' });
      const boton = await within(pie).findByRole('button', { name: 'Cargar más' });
      expect(within(pie).getByRole('alert')).toHaveTextContent('sin red');
      expect(boton).toHaveClass('cj2-pag-mas');
      fireEvent.click(boton);
      await waitFor(() => expect(screen.queryByTestId('pag-carga')).toBeNull());
      expect(screen.getByTestId('rango-pagina')).toHaveTextContent('de 120');
    });
  });
});

describe('Vista Lista: acciones por fila y permisos', () => {
  const filaDe = (codigo: string) => screen.getAllByTestId('fila-lista').find((f) => within(f).queryByText(codigo))!;

  it('cajero: Estado, Pago y Finalizar según el pedido, imprimir y menú ⋮ con Ver detalle', async () => {
    montar([
      ped(1, { estado: 'PREPARANDO' }),
      ped(2, { estado: 'LISTO', pago_estado: 'PENDIENTE', total: 18 }),
      ped(3, { estado: 'LISTO', pago_estado: 'PAGADO' }),
      ped(4, { estado: 'COLA', pago_estado: 'PENDIENTE' }),
    ]);
    await irALista();
    expect(within(filaDe('CP-001')).getByRole('button', { name: 'LISTO CP-001' })).toHaveTextContent('Estado');
    expect(within(filaDe('CP-001')).queryByRole('button', { name: /Finalizar|COBRAR/ })).toBeNull();
    expect(within(filaDe('CP-002')).getByRole('button', { name: /COBRAR S\/ 18.00 CP-002/ })).toHaveTextContent('Cobrar S/ 18.00');
    expect(within(filaDe('CP-003')).getByRole('button', { name: 'ENTREGAR CP-003' })).toHaveTextContent('Finalizar');
    expect(within(filaDe('CP-004')).getByRole('button', { name: 'CONFIRMAR PAGO CP-004' })).toHaveTextContent('Pago');
    expect(within(filaDe('CP-001')).getByRole('button', { name: 'Reimprimir pedido CP-001' })).toBeTruthy();
    fireEvent.click(within(filaDe('CP-001')).getByRole('button', { name: 'Más acciones de CP-001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver detalle de la venta' }));
    expect(await screen.findByRole('dialog', { name: 'Detalle de la venta' })).toBeTruthy();
  });

  it('el botón Estado abre la confirmación existente y cambia el estado con el mismo endpoint', async () => {
    montar([ped(1, { estado: 'LISTO', modalidad: 'LLEVAR', pago_estado: 'PAGADO' })]);
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    await irALista();
    fireEvent.click(screen.getByRole('button', { name: 'ENTREGAR CP-001' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, continuar' }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('1', 'ENTREGADO'));
  });

  it('mozo sin permiso de cambiar estado ni de cobrar: sin Estado, Pago ni Finalizar (queda imprimir y ⋮)', async () => {
    montar([ped(1, { estado: 'PREPARANDO' }), ped(2, { estado: 'LISTO', pago_estado: 'PENDIENTE' })], []);
    await irALista();
    for (const c of ['CP-001', 'CP-002']) {
      const f = filaDe(c);
      expect(within(f).queryByText('Estado')).toBeNull();
      expect(within(f).queryByText('Pago')).toBeNull();
      expect(within(f).queryByText('Finalizar')).toBeNull();
      expect(within(f).getByRole('button', { name: `Más acciones de ${c}` })).toBeTruthy();
    }
  });

  it('solo cobrar (sin cambiar estado): hay Pago y no Estado', async () => {
    montar([ped(1, { estado: 'LISTO', pago_estado: 'PENDIENTE' })], ['caja/cobrar']);
    await irALista();
    expect(within(filaDe('CP-001')).getByText('Pago')).toBeTruthy();
    expect(within(filaDe('CP-001')).queryByText('Estado')).toBeNull();
  });

  it('nunca hay anular, chat de WhatsApp ni «Finalizar todo»', async () => {
    montar([ped(1), ped(2, { estado: 'LISTO' })]);
    await irALista();
    expect(screen.queryByRole('button', { name: /anular/i })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^Más acciones de/ })[0]);
    expect(screen.queryByRole('menuitem', { name: /anular/i })).toBeNull();
    expect(screen.queryByText(/whatsapp/i)).toBeNull();
    expect(screen.queryByText(/Finalizar todo/i)).toBeNull();
  });

  it('ranurasDeAccion reparte la acción siguiente en un solo botón', () => {
    const a = (tipo: any, extra: any = {}) => ({ tipo, texto: 'X', bg: '', fg: '', ...extra });
    expect(ranurasDeAccion(null)).toEqual({});
    expect(Object.keys(ranurasDeAccion(a('cobrar')))).toEqual(['pago']);
    expect(Object.keys(ranurasDeAccion(a('confirmar_pago')))).toEqual(['pago']);
    expect(Object.keys(ranurasDeAccion(a('mesa')))).toEqual(['finalizar']);
    expect(Object.keys(ranurasDeAccion(a('estado', { nuevoEstado: 'ENTREGADO' })))).toEqual(['finalizar']);
    expect(Object.keys(ranurasDeAccion(a('estado', { nuevoEstado: 'LISTO' })))).toEqual(['estado']);
    expect(Object.keys(ranurasDeAccion(a('detalle')))).toEqual(['estado']);
  });
});

describe('Vista Lista: delivery sin repartidor', () => {
  it('«Elige un repartidor» solo en delivery abierto sin repartidor, y lleva a Repartos', async () => {
    montar([
      ped(1, { modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null }),
      ped(2, { modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: '9' }),
      ped(3, { modalidad: 'LLEVAR', estado: 'LISTO' }),
      ped(4, { modalidad: 'DELIVERY', estado: 'ENTREGADO', repartidor_party_id: null }),
    ]);
    await irALista();
    const enlaces = screen.getAllByRole('link', { name: /Elige un repartidor/ });
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAttribute('href', '/admin/repartos');
    expect(enlaces[0]).toHaveAttribute('aria-label', 'Elige un repartidor para CP-001');
  });
});

describe('Vista Lista: cronómetro', () => {
  const T0 = Date.parse('2026-11-08T15:00:00Z');
  const minAtras = (m: number, s = 0) => new Date(T0 - m * 60000 - s * 1000).toISOString();
  const cargar = (filas: Pedido[]) =>
    render(
      <MemoryRouter>
        <ListaCaja filas={filas} accionDe={() => null} resaltados={new Set()} alAccion={() => {}} alVerDetalle={() => {}} alAbrir={() => {}} />
      </MemoryRouter>,
    );

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('texto accesible «Hace N minutos», avanza solo cada 30 s y se pone rojo desde los 50 min', () => {
    cargar([ped(1, { creado_en: minAtras(49, 40) })]);
    const reloj = screen.getByRole('timer');
    expect(reloj).toHaveAttribute('aria-label', 'Hace 49 minutos, atención');
    expect(reloj).toHaveAttribute('data-nivel', 'oxido');
    act(() => { vi.advanceTimersByTime(30000); });
    expect(screen.getByRole('timer')).toHaveAttribute('data-nivel', 'rojo');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Hace 50 minutos, tarde');
  });

  it('un solo intervalo para toda la lista y se limpia al desmontar', () => {
    const set = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = cargar([ped(1, { creado_en: minAtras(5) }), ped(2, { creado_en: minAtras(8) }), ped(3, { creado_en: minAtras(70) })]);
    expect(screen.getAllByRole('timer')).toHaveLength(3);
    expect(set).toHaveBeenCalledTimes(1);
    unmount();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('un pedido cerrado no corre: muestra la hora y no se pone rojo', () => {
    cargar([ped(1, { estado: 'ENTREGADO', creado_en: minAtras(200) })]);
    expect(screen.getByRole('timer')).toHaveAttribute('data-nivel', 'neutro');
  });
});

describe('Vista Lista: celular y paginación', () => {
  const anchoOriginal = window.innerWidth;
  afterEach(() => { window.innerWidth = anchoOriginal; });

  it('a 360 px la Lista se arma igual (el diseño pasa a 2–3 líneas por CSS) y las acciones siguen presentes', async () => {
    window.innerWidth = 360;
    montar([ped(1, { estado: 'LISTO', pago_estado: 'PENDIENTE' })]);
    await irALista();
    const fila = screen.getByTestId('fila-lista');
    expect(within(fila).getByRole('button', { name: /COBRAR/ })).toBeTruthy();
    expect(within(fila).getByRole('button', { name: 'Más acciones de CP-001' })).toBeTruthy();
  });

  it('usa el paginador de Caja: 25 por defecto, sin «Auto», y 10 por página se respeta', async () => {
    montar(Array.from({ length: 30 }, (_, i) => ped(i + 1)));
    await irALista();
    expect(screen.getAllByTestId('fila-lista')).toHaveLength(25);
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–25 de 30');
    const sel = screen.getByRole('combobox', { name: 'Filas por página' });
    expect(within(sel).queryByRole('option', { name: 'Auto' })).toBeNull();
    fireEvent.change(sel, { target: { value: '10' } });
    expect(screen.getAllByTestId('fila-lista')).toHaveLength(10);
  });
});

describe('Vista Lista: el Resumen coincide con la lista', () => {
  it('con «Todo el día»: total del resumen = filas de la lista y ventas = suma sin anulados', async () => {
    montar([ped(1, { total: 30 }), ped(2, { total: 20, pago_estado: 'PENDIENTE' }), ped(3, { total: 99, estado: 'ANULADO' }), ped(4, { total: 10, estado: 'ENTREGADO' })]);
    await irALista();
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    expect(screen.getByTestId('resumen-dia')).toHaveTextContent('4 pedidos');
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–4 de 4');
    expect(screen.getAllByTestId('fila-lista')).toHaveLength(4);
    expect(screen.getByTestId('montos-resumen')).toHaveTextContent('Ventas S/ 60.00'); // 30 + 20 + 10; el anulado no suma
  });

  it('los montos siguen los filtros también en la Lista: «Filtrado», solo esos pedidos y el total del día aparte', async () => {
    montar([ped(1, { total: 30, cliente_nombre: 'Ana Prueba' }), ped(2, { total: 20, cliente_nombre: 'Luis Prueba' })]);
    await irALista();
    expect(screen.getByTestId('montos-resumen')).not.toHaveTextContent('Filtrado');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'Ana' } });
    await waitFor(() => expect(screen.getByTestId('montos-resumen')).toHaveTextContent('Filtrado: 1 pedido'));
    expect(screen.getByTestId('montos-resumen')).toHaveTextContent('Ventas S/ 30.00');
    expect(screen.getByTestId('montos-resumen')).toHaveTextContent('Día: S/ 50.00');
    expect(screen.getAllByTestId('fila-lista')).toHaveLength(1);
  });
});

describe('Vista Lista: estados', () => {
  it('sin pedidos: mensaje de vacío', async () => {
    montar([]);
    await screen.findByTestId('resumen-dia');
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(await screen.findByText('No hay pedidos hoy.')).toBeTruthy();
  });

  it('con error al cargar: el mismo estado de error de Caja', async () => {
    montar([]);
    vi.mocked(pedidosApi.listar).mockRejectedValue(new Error('sin conexión de prueba'));
    cleanup();
    vi.mocked(sesionModulo.useSesion).mockReturnValue({ tiene: () => true, usuario: { partyId: '1' } } as any);
    render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
    expect(await screen.findByText(/sin conexión de prueba/)).toBeTruthy();
  });
});
