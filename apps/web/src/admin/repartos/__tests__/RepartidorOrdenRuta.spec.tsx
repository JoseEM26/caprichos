import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, PedidoReparto } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

const leaflet = vi.hoisted(() => {
  const m: any = {};
  for (const k of ['setView', 'fitBounds', 'setMaxBounds', 'remove', 'invalidateSize', 'panBy']) m[k] = vi.fn(() => m);
  m.on = vi.fn(() => m);
  m.latLngToContainerPoint = vi.fn(() => ({ x: 120, y: 200 }));
  m.getContainer = vi.fn(() => {
    const d = document.createElement('div');
    document.body.appendChild(d);
    return d;
  });
  return { m };
});
vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = (): any => ({ addTo() { return this; } });
  return {
    ATRIBUCION: '', URL_TESELAS: '',
    L: {
      map: () => leaflet.m, control: { zoom: capa, attribution: capa }, tileLayer: capa,
      polyline: () => ({ addTo() { return this; }, remove: () => {}, on: () => {} }),
      latLngBounds: (c: unknown) => ({ coords: c, pad: () => c }),
    },
  };
});

const mio = (id: string, orden: number | null, estado = 'LISTO'): PedidoReparto => ({
  id, codigo: `CP-${id}`, modalidad: 'DELIVERY', estado, cliente_nombre: `Cli ${id}`, cliente_telefono: null,
  direccion: 'x', referencia: null, lat: -12.06 - Number(id) / 100, lng: -77.04, zona: null, zona_id: null, minutosEspera: 5,
  color: 'verde', total: 30, pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false, paga_con: null,
  repartidor_party_id: '10', tomado_en: null, salio_en: null, llego_en: null, entregado_en: null, motivo_falla: null,
  creado_en: '2026-10-27T14:00:00Z', cantidad_productos: 1, ordenRuta: orden,
} as any);

describe('RepartidorView: orden de entrega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'R', rol: 'REPARTIDOR' }, permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'], cargando: false, autenticado: true, debeCambiar: false,
      tiene: vi.fn((p: string) => ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(p)),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [mio('1', 1), mio('2', 2), mio('3', 3)], orden: ['1', '2', '3'], paso: [], ruta: [] });
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 3 });
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: 5 });
    vi.spyOn(repartosApi, 'obtenerResumenRepartidor').mockImplementation(async (id: string) => ({
      id, codigo: `CP-${id}`, clienteNombre: 'C', estado: 'LISTO', estadoTexto: 'Listo', minutosEspera: 5, productos: [], nota: null,
      zona: null, puedeTomar: false, motivoNoTomar: null,
    }) as any);
  });

  const abrirPedido = async (id: string) => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
    fireEvent.click(await screen.findByTestId(`marcador-${id}`));
    return screen.findByTestId('detalle-pedido');
  };

  it('el pedido 1 queda resaltado como Siguiente en el mapa', async () => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
    expect(await screen.findByTestId('marcador-1')).toHaveAttribute('data-siguiente', 'true');
    expect(screen.getByTestId('marcador-1')).toHaveTextContent('Siguiente');
    expect(screen.getByTestId('marcador-2')).not.toHaveAttribute('data-siguiente');
  });

  it('el que no toca tiene el botón deshabilitado con motivo y no ofrece Saltar', async () => {
    await abrirPedido('2');
    expect(screen.getByTestId('btn-salir-2')).toBeDisabled();
    expect(screen.getByTestId('motivo-bloqueo-2')).toHaveTextContent('Siguiente: CP-1');
    expect(screen.queryByTestId('btn-saltar-2')).toBeNull();
  });

  it('el que toca tiene el botón habilitado y Empezar por este reordena en la API', async () => {
    const spy = vi.spyOn(repartosApi, 'empezarPor').mockResolvedValue({ orden: [] });
    await abrirPedido('1');
    expect(screen.getByTestId('btn-salir-1')).toBeEnabled();
    fireEvent.click(screen.getByTestId('btn-empezar-por-1'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'));
  });

  it('Saltar pide motivo, exige detalle en Otro y confirma con Sí/No', async () => {
    const spy = vi.spyOn(repartosApi, 'saltar').mockResolvedValue({ id: '1', ordenRuta: 4 });
    await abrirPedido('1');
    fireEvent.click(screen.getByTestId('btn-saltar-1'));
    fireEvent.click(screen.getByText('Sí, saltar'));
    expect(await screen.findByText('Elige un motivo')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Otro'));
    fireEvent.click(screen.getByText('Sí, saltar'));
    expect(await screen.findByText('Cuéntanos el motivo')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Detalle del motivo'), { target: { value: 'Portón cerrado' } });
    fireEvent.click(screen.getByText('Sí, saltar'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1', { motivo: 'OTRO', detalle: 'Portón cerrado' }));
  });

  it('Saltar con un motivo de la lista y No cancela', async () => {
    const spy = vi.spyOn(repartosApi, 'saltar').mockResolvedValue({ id: '1', ordenRuta: 4 });
    await abrirPedido('1');
    fireEvent.click(screen.getByTestId('btn-saltar-1'));
    fireEvent.click(screen.getByText('No'));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('btn-saltar-1'));
    fireEvent.click(screen.getByLabelText('Cliente no contesta'));
    fireEvent.click(screen.getByText('Sí, saltar'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1', { motivo: 'NO_CONTESTA', detalle: undefined }));
  });

  it('pedidos sin orden (flujo viejo) no se bloquean', async () => {
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [mio('1', null), mio('2', null)], orden: [], paso: [], ruta: [] });
    await abrirPedido('2');
    expect(screen.getByTestId('btn-salir-2')).toBeEnabled();
    expect(screen.queryByTestId('btn-saltar-2')).toBeNull();
  });

  it('pellizco con dos punteros sobre un marcador no cuenta como toque', async () => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
    const m = await screen.findByTestId('marcador-1');
    fireEvent.pointerDown(m, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerDown(m, { pointerId: 2, pointerType: 'touch', clientX: 60, clientY: 10 });
    fireEvent.pointerMove(m, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerUp(m, { pointerId: 2, pointerType: 'touch' });
    fireEvent.pointerUp(m, { pointerId: 1, pointerType: 'touch' });
    fireEvent.click(m);
    expect(leaflet.m.panBy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('detalle-pedido')).toBeNull();
    // un toque normal después sí abre el detalle
    fireEvent.pointerDown(m, { pointerId: 3, pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerUp(m, { pointerId: 3, pointerType: 'touch' });
    fireEvent.click(m);
    expect(await screen.findByTestId('detalle-pedido')).toBeInTheDocument();
    void within;
  });
});
