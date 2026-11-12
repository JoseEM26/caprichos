import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TiemposTab } from '../tiempos/TiemposTab';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: 'hoy' as const, desde: '2026-11-11', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const etapa = (codigo: string, paso: number, nombre: string, extra: Record<string, unknown> = {}) => ({
  codigo,
  paso,
  nombre,
  detalle: `Qué mide ${nombre}`,
  modalidades: null,
  compite: true,
  meta: 10,
  n: 0,
  promedio: null,
  mediana: null,
  p90: null,
  maximo: null,
  sinDato: true,
  semaforo: 'sin_dato',
  ...extra,
});

const respuesta = {
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  truncado: false,
  limite: 5000,
  pedidos: { entran: 12, considerados: 10, enCurso: 2 },
  anulados: { n: 2, minutosPromedio: 6, minutosMediana: 6 },
  etapaMasLenta: 'cocina',
  etapas: [
    etapa('a_cocina', 3, 'Enviado a cocina', { meta: 3, n: 10, promedio: 2, mediana: 2, p90: 3, maximo: 4, sinDato: false, semaforo: 'verde' }),
    etapa('cocina', 4, 'Cocina', { meta: 15, n: 9, promedio: 22, mediana: 20, p90: 30, maximo: 35, sinDato: false, semaforo: 'rojo' }),
    etapa('recojo', 7, 'Listo → recogido', { modalidades: ['RECOGER'], meta: 10 }),
    etapa('reparto_ruta', 7, 'Delivery: en camino', { modalidades: ['DELIVERY'], meta: 25 }),
    etapa('cierre', 9, 'Cierre de caja', { compite: false, meta: 720, n: 3, promedio: 300, mediana: 300, p90: 300, maximo: 300, sinDato: false, semaforo: 'verde' }),
  ],
  areas: [
    { nombre: 'Barra', n: 5, promedio: 8, mediana: 7, p90: 10, maximo: 11, meta: 15, semaforo: 'verde' },
    { nombre: 'Cocina caliente', n: 9, promedio: 22, mediana: 20, p90: 30, maximo: 35, meta: 15, semaforo: 'rojo' },
  ],
};

const atascados = {
  generadoEn: '2026-11-11T20:00:00Z',
  total: 1,
  items: [
    {
      id: '31',
      codigo: 'CP-31',
      modalidad: 'MESA',
      mesa: 'Mesa 4',
      etapa: 'cocina',
      etapaNombre: 'Cocina',
      areasPendientes: ['Barra'],
      desde: '2026-11-11T19:20:00Z',
      minutos: 40,
      meta: 15,
      veces: 2.7,
      semaforo: 'rojo',
      enlace: '/admin/cocina',
    },
  ],
};

function servidor(principal: unknown, vivo: unknown = atascados) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.startsWith('/admin/analisis/tiempos/atascados')) return vivo;
    if (principal instanceof Error) throw principal;
    return principal;
  });
}

describe('Pestaña Tiempos', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('con datos: KPIs, barras por etapa con promedio, mediana y la más lenta resaltada', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    const recorrido = await screen.findByRole('list', { name: /Minutos promedio de cada etapa/ });
    expect(within(recorrido).getByText('4. Cocina')).toBeInTheDocument();
    expect(within(recorrido).getByText('Prom. 22 min')).toBeInTheDocument();
    expect(within(recorrido).getByText(/Mediana 20 min · 9 pedidos/)).toBeInTheDocument();
    expect(within(recorrido).getByText('Más lenta')).toBeInTheDocument();
    expect(screen.getByText('Pedidos medidos')).toBeInTheDocument();
    expect(screen.getByText('2 aún en curso')).toBeInTheDocument();
    expect(screen.getByText('Anulados (aparte)')).toBeInTheDocument();
    expect(screen.getByText('Tardaron 6 min en anularse')).toBeInTheDocument();
    // las etapas sin dato se ven como tales, no como cero
    expect(within(recorrido).getAllByText('Sin dato').length).toBeGreaterThanOrEqual(2);
  });

  it('comparativo de las áreas de cocina con la más lenta marcada', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    const areas = await screen.findByRole('list', { name: /cada área de cocina/ });
    expect(within(areas).getByText('Barra')).toBeInTheDocument();
    expect(within(areas).getByText('Cocina caliente')).toBeInTheDocument();
    expect(within(areas).getAllByText('Más lenta')).toHaveLength(1);
  });

  it('tocar una etapa abre su detalle inline (no un modal) con lo que falta guardar si no hay dato', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    const recorrido = await screen.findByRole('list', { name: /Minutos promedio de cada etapa/ });
    fireEvent.click(within(recorrido).getByRole('button', { name: /Listo → recogido/ }));
    const detalle = screen.getByRole('region', { name: /Detalle: 7\. Listo → recogido/ });
    expect(within(detalle).getByText(/Falta la hora de entrega del pedido para llevar/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: /Cerrar detalle/ }));
    expect(screen.queryByRole('region', { name: /Detalle:/ })).toBeNull();
  });

  it('el cierre de caja no se marca como más lento aunque tenga minutos', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    const recorrido = await screen.findByRole('list', { name: /Minutos promedio de cada etapa/ });
    expect(within(recorrido).getAllByText('Más lenta')).toHaveLength(1);
  });

  it('con la modalidad Delivery oculta las etapas de otra modalidad', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={{ ...filtros, modalidad: 'DELIVERY' }} esAdmin={false} />);
    const recorrido = await screen.findByRole('list', { name: /Minutos promedio de cada etapa/ });
    expect(within(recorrido).queryByText('7. Listo → recogido')).toBeNull();
    expect(within(recorrido).getByText('7. Delivery: en camino')).toBeInTheDocument();
  });

  it('sin pedidos: estado vacío del recorrido y de las áreas', async () => {
    servidor({ ...respuesta, pedidos: { entran: 0, considerados: 0, enCurso: 0 }, etapaMasLenta: null, etapas: respuesta.etapas.map((e) => ({ ...e, n: 0, promedio: null, sinDato: true, semaforo: 'sin_dato' })), areas: [] });
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('Todavía no hay pedidos con tiempos en este período.')).toBeInTheDocument();
    expect(screen.getByText('Ninguna área de cocina tuvo pedidos en este período.')).toBeInTheDocument();
  });

  it('si falla el servidor: error con Reintentar que vuelve a consultar', async () => {
    const espia = servidor(new Error('Se cayó'));
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('No se pudieron calcular los tiempos')).toBeInTheDocument();
    const antes = espia.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: /Reintentar/ })[0]);
    await waitFor(() => expect(espia.mock.calls.length).toBeGreaterThan(antes));
  });

  it('avisa si se leyeron solo los pedidos más recientes', async () => {
    servidor({ ...respuesta, truncado: true });
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/más de 5000 pedidos/)).toBeInTheDocument();
  });
});

describe('Pedidos atascados ahora', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lista el pedido con su etapa, minutos, áreas que faltan y enlace a su pantalla', async () => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/CP-31 · Mesa · Mesa 4/)).toBeInTheDocument();
    expect(screen.getByText(/Cocina: lleva 40 min \(meta 15 min, 2.7 veces\)/)).toBeInTheDocument();
    expect(screen.getByText('Falta: Barra')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir pedido CP-31' })).toHaveAttribute('href', '/admin/cocina');
  });

  it('sin atascados: mensaje tranquilizador', async () => {
    servidor(respuesta, { generadoEn: '', total: 0, items: [] });
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/Ningún pedido está atascado/)).toBeInTheDocument();
  });

  it('el botón Actualizar vuelve a pedir la lista', async () => {
    const espia = servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={false} />);
    await screen.findByText(/CP-31/);
    const veces = () => espia.mock.calls.filter(([u]) => String(u).includes('/atascados')).length;
    const antes = veces();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(veces()).toBeGreaterThan(antes));
  });
});

describe('Metas por etapa', () => {
  beforeEach(() => vi.restoreAllMocks());

  const abrir = async (esAdmin: boolean) => {
    servidor(respuesta);
    render(<TiemposTab filtros={filtros} esAdmin={esAdmin} />);
    await screen.findByText('Metas por etapa');
    fireEvent.click(screen.getByText('Metas por etapa'));
  };

  it('el supervisor las ve pero no las edita ni guarda', async () => {
    await abrir(false);
    expect(screen.getByLabelText('Cocina')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar metas' })).toBeNull();
    expect(screen.getByText(/Solo el administrador puede cambiarlas/)).toBeInTheDocument();
  });

  it('el admin cambia una meta: se valida el rango y se guarda por Configuración', async () => {
    await abrir(true);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const campo = screen.getByLabelText('Cocina');
    expect(campo).toHaveValue(15);
    fireEvent.change(campo, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(await screen.findByText('Escribe un número entero entre 1 y 1440.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '1441' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/meta_tiempo_cocina_min', { valor: 18 }));
    expect(put).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Metas guardadas.')).toBeInTheDocument();
  });

  it('un decimal no se acepta', async () => {
    await abrir(true);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    fireEvent.change(screen.getByLabelText('Cocina'), { target: { value: '7.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(await screen.findByText(/número entero/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza, lo dice y no afirma que guardó', async () => {
    await abrir(true);
    vi.spyOn(api, 'put').mockRejectedValue(new Error('Meta no válida'));
    fireEvent.change(screen.getByLabelText('Cocina'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(await screen.findByText('Meta no válida')).toBeInTheDocument();
    expect(screen.queryByText('Metas guardadas.')).toBeNull();
  });
});
