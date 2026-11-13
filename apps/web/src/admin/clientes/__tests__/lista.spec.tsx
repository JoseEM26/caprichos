import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ClientesAdminView } from '../ClientesAdminView';
import * as clientesApi from '../clientesApi';
import type { ClienteItem } from '../tipos';

let rolMock = 'ADMIN';
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: rolMock } }),
}));
const sorteoMock = vi.fn();
vi.mock('../sorteos/SorteoEnVivo', () => ({
  SorteoEnVivo: (p: any) => {
    sorteoMock(p);
    return <div role="dialog" aria-label="Sorteo">{p.filtrosTexto}</div>;
  },
}));

const cliente = (id: string, nombre: string, extra: Partial<ClienteItem> = {}): ClienteItem => ({
  id,
  nombre,
  tipo: 'Persona',
  telefono: '999888777',
  correo: 'sin correo',
  cumpleanos: '—',
  pedidos: 3,
  consumo: 120.5,
  ultimaCompra: '2026-11-10T15:00:00.000Z',
  puntos: 40,
  creditoPersonal: false,
  envioFijo: null,
  descuentoEnvio: null,
  activo: true,
  verificado: true,
  ...extra,
});

describe('Admin ▸ Clientes: filtros, vistas, Excel y sorteo', () => {
  let listar: MockInstance<typeof clientesApi.listarClientes>;
  const ultimaLlamada = () => (listar.mock.calls.at(-1)![0] as any);

  beforeEach(() => {
    rolMock = 'ADMIN';
    window.localStorage.clear();
    vi.clearAllMocks();
    listar = vi.spyOn(clientesApi, 'listarClientes').mockResolvedValue({
      items: [cliente('1', 'Ana Pérez'), cliente('2', 'Luis Soto', { activo: false, verificado: false })],
      total: 50,
      pagina: 1,
      paginas: 3,
    });
    vi.spyOn(clientesApi, 'listarParticipantesSorteo').mockResolvedValue({ total: 1, participantes: [{ id: '1', nombre: 'Ana P.', detalle: '···777' }] });
    vi.spyOn(clientesApi, 'exportarClientesExcel').mockResolvedValue('blob:xlsx');
  });
  afterEach(() => vi.restoreAllMocks());

  it('arranca con 24 por página, vista de tarjetas y sin filtros', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => expect(screen.getByText('Ana Pérez')).toBeInTheDocument());
    expect(ultimaLlamada()).toMatchObject({ limite: 24, pagina: 1 });
    expect(screen.getByRole('button', { name: 'Tarjetas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Mostrando 1 a 24 de 50 resultados')).toBeInTheDocument();
  });

  it('cambia a tabla, recuerda la vista y abre la ficha al tocar una fila', async () => {
    const { unmount } = render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    const tabla = screen.getByRole('table');
    for (const h of ['Nombre', 'Celular', 'Pedidos', 'Consumo', 'Puntos', 'Última compra', 'Verificado']) {
      expect(within(tabla).getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(within(tabla).getAllByText('S/ 120.50')).toHaveLength(2);
    expect(window.localStorage.getItem('caprichos.clientes.vista')).toBe('tabla');
    // la tabla se desliza dentro de su propio contenedor
    expect(tabla.parentElement).toHaveStyle({ overflowX: 'auto' });
    unmount();

    vi.spyOn(clientesApi, 'obtenerFichaCliente').mockResolvedValue({ id: '1', nombre: 'Ana Pérez', telefono: '999888777', correo: '', cumpleanos: '', puntos: 40, pedidos: [] });
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByRole('table'));
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial de Ana Pérez' }));
    await waitFor(() => expect(clientesApi.obtenerFichaCliente).toHaveBeenCalledWith('1'));
  });

  it('elige 48 o 96 por página, lo recuerda y vuelve a la página 1', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Por página: 24' }));
    fireEvent.click(screen.getByRole('option', { name: '48' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ limite: 48, pagina: 1 }));
    expect(window.localStorage.getItem('caprichos.clientes.tamano')).toBe('48');
  });

  it('pagina en la tabla con Siguiente', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Tabla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ pagina: 2 }));
  });

  it('los chips de recurrencia y de fechas llegan al API', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Recurrentes (2+)' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ pedidosMin: 2, pedidosMax: undefined }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos (1 pedido)' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ pedidosMin: 1, pedidosMax: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ periodo: 'semana', pedidosMin: 1 }));
  });

  it('Más filtros: consumo, puntos, dormidos, cumpleaños y fechas propias se combinan', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: /Más filtros/i }));
    fireEvent.change(screen.getByLabelText('Consumo (S/) desde'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Puntos hasta'), { target: { value: '500' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 30'), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('Cumplen años este mes'));
    fireEvent.change(screen.getByLabelText('Compraron desde'), { target: { value: '2026-11-01' } });
    await waitFor(() =>
      expect(ultimaLlamada()).toMatchObject({ consumoMin: 100, puntosMax: 500, sinCompraDias: 30, cumpleMes: true, desde: '2026-11-01' }),
    );
    // se ven como chips y cada uno se quita solo
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Sin comprar hace más de 30 días' }));
    await waitFor(() => expect(ultimaLlamada().sinCompraDias).toBeUndefined());
    expect(ultimaLlamada()).toMatchObject({ consumoMin: 100, cumpleMes: true });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ consumoMin: undefined, cumpleMes: undefined, desde: undefined }));
  });

  it('ordenar por más consumo', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar: Más nuevos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Más consumo' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ orden: 'consumo' }));
  });

  it('Descargar Excel: solo ADMIN, con los filtros puestos', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Frecuentes (5+)' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ pedidosMin: 5 }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(clientesApi.exportarClientesExcel).toHaveBeenCalledWith(expect.objectContaining({ pedidosMin: 5 })));
    await waitFor(() => expect(clic).toHaveBeenCalled());
  });

  it('un usuario que no es ADMIN no ve Descargar Excel', async () => {
    rolMock = 'CAJERO';
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    expect(screen.queryByRole('button', { name: 'Descargar Excel' })).toBeNull();
  });

  it('Sorteo en vivo: trae los participantes con los filtros y los pasa a SorteoEnVivo', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(ultimaLlamada()).toMatchObject({ periodo: 'hoy' }));
    fireEvent.click(screen.getByRole('button', { name: /Sorteo en vivo/ }));
    await waitFor(() => expect(sorteoMock).toHaveBeenCalled());
    expect(clientesApi.listarParticipantesSorteo).toHaveBeenCalledWith(expect.objectContaining({ periodo: 'hoy' }));
    const props = sorteoMock.mock.calls.at(-1)![0];
    expect(props.participantes).toEqual([{ id: '1', nombre: 'Ana P.', detalle: '···777' }]);
    expect(props.filtrosTexto).toBe('Hoy');
    fireEvent.click(screen.getByRole('dialog', { name: 'Sorteo' }));
    expect(typeof props.alCerrar).toBe('function');
  });

  it('Sorteo en vivo queda deshabilitado si no hay resultados', async () => {
    listar.mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 });
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Nada coincide con los filtros.'));
    expect(screen.getByRole('button', { name: /Sorteo en vivo/ })).toBeDisabled();
  });
});
