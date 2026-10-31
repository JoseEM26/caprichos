import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { RutasAdmin } from '../RutasAdmin';
import { repartosApi, type RutaHistorial } from '../repartosApi';
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

// El mapa del admin no interesa aquí: solo la pestaña Rutas
vi.mock('../MapaRepartos', () => ({ MapaRepartos: () => null }));

const pedido = (id: string, o: any = {}): any => ({
  id, codigo: `CP-${id}`, modalidad: 'DELIVERY', estado: 'EN_CAMINO', cliente_nombre: `Cli ${id}`, cliente_telefono: null,
  direccion: 'Av. Lima 1', referencia: null, lat: -12.06 - Number(id) / 100, lng: -77.04, zona: null, zona_id: null, minutosEspera: 5,
  color: 'verde', total: 30, pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false, paga_con: null,
  repartidor_party_id: '10', tomado_en: null, salio_en: null, llego_en: null, entregado_en: null, motivo_falla: null,
  creado_en: '2026-10-31T14:00:00Z', cantidad_productos: 1, ordenRuta: null, estadoFinal: null, horaFinal: null, orden: Number(id), ...o,
});

// 15:04Z = 10:04 en Lima
const enCurso = (): any => ({
  id: '7', iniciadaEn: '2026-10-31T14:30:00Z', estado: 'EN_CURSO',
  pedidos: [
    pedido('1', { estado: 'ENTREGADO', estadoFinal: 'ENTREGADO', horaFinal: '2026-10-31T15:04:00Z' }),
    pedido('2', { estado: 'LISTO', repartidor_party_id: null, estadoFinal: 'NO_ENTREGADO', horaFinal: '2026-10-31T15:10:00Z', motivo_falla: 'NO_CONTESTA' }),
    pedido('3', { ordenRuta: 1 }),
  ],
});

const historial = (o: Partial<RutaHistorial> = {}): RutaHistorial => ({
  id: '7', repartidorId: '10', repartidorNombre: 'Luis Gómez', iniciadaEn: '2026-10-31T14:30:00Z', terminadaEn: '2026-10-31T16:00:00Z',
  estado: 'TERMINADA', totalPedidos: 3, entregados: 2, fallidos: 1, distanciaKm: 4.2,
  pedidos: [
    { id: '1', codigo: 'CP-1', clienteNombre: 'Ana', direccion: 'x', lat: -12.07, lng: -77.04, estadoFinal: 'ENTREGADO', horaFinal: '2026-10-31T15:04:00Z', orden: 1 },
    { id: '2', codigo: 'CP-2', clienteNombre: 'Beto', direccion: 'y', lat: -12.08, lng: -77.04, estadoFinal: 'NO_ENTREGADO', horaFinal: '2026-10-31T15:10:00Z', orden: 2 },
    { id: '3', codigo: 'CP-3', clienteNombre: 'Caro', direccion: 'z', lat: -12.09, lng: -77.04, estadoFinal: 'ENTREGADO', horaFinal: '2026-10-31T15:20:00Z', orden: 3 },
  ],
  ...o,
});

let eventosCb: Array<() => void> = [];

function preparar(rol = 'REPARTIDOR', permisos = ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar']) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '10', nombres: 'R', rol }, permisos, cargando: false, autenticado: true, debeCambiar: false,
    tiene: vi.fn((p: string) => permisos.includes(p)),
  } as any);
  eventosCb = [];
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(((_e: string, cb: () => void) => { eventosCb.push(cb); }) as any);
  vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 3 });
  vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: 5 });
}

describe('RepartidorView: la ruta como unidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preparar();
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({
      pedidos: [pedido('3', { ordenRuta: 1 })], orden: ['3'], paso: [], ruta: [], rutaReparto: enCurso(),
    });
  });

  const abrirMios = async () => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
  };

  it('los terminados se quedan en gris: entregado con check y hora, fallido con X y su estado; el pendiente sigue numerado', async () => {
    await abrirMios();
    const ok = await screen.findByTestId('marcador-1');
    expect(ok).toHaveAttribute('data-estado-final', 'ENTREGADO');
    expect(ok).toHaveAttribute('data-color', 'gris');
    expect(ok).toHaveTextContent('✓');
    expect(ok).toHaveTextContent('Entregado 10:04');
    const no = screen.getByTestId('marcador-2');
    expect(no).toHaveAttribute('data-estado-final', 'NO_ENTREGADO');
    expect(no).toHaveTextContent('✕');
    expect(no).toHaveTextContent('No entregado');
    expect(screen.getByTestId('marcador-3')).toHaveAttribute('data-numero', '1');
  });

  it('el chip muestra el avance de la ruta en curso y no cuenta los terminados como pedidos que lleva', async () => {
    await abrirMios();
    expect(await screen.findByTestId('chip-progreso-ruta')).toHaveTextContent('Ruta en curso: 1 de 3 entregado');
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Llevas 1 / 5 pedidos');
  });

  it('tocar un terminado abre su detalle de solo lectura, sin botones de acción', async () => {
    await abrirMios();
    fireEvent.click(await screen.findByTestId('marcador-1'));
    const det = await screen.findByTestId('detalle-terminado');
    expect(det).toHaveTextContent('CP-1');
    expect(det).toHaveTextContent('Entregado 10:04');
    expect(det).toHaveTextContent('solo lectura');
    expect(within(det).queryByRole('button')).toBeNull();
  });

  it('al terminar la ruta avisa con el resumen y el mapa vuelve a Pedidos', async () => {
    const lista = vi.spyOn(repartosApi, 'listarMisRutas').mockResolvedValue({ rutas: [historial()], pagina: 1, limite: 20, total: 1, totalPaginas: 1 });
    await abrirMios();
    await screen.findByTestId('marcador-1');
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [], rutaReparto: null });
    await act(async () => { eventosCb.forEach((cb) => cb()); });
    expect(await screen.findByText('Ruta terminada: 2 entregados, 1 no entregado')).toBeInTheDocument();
    expect(lista).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page');
  });

  it('Más > Mis rutas lista las rutas agrupadas y tocar una la dibuja en el mapa solo lectura', async () => {
    const lista = vi.spyOn(repartosApi, 'listarMisRutas').mockResolvedValue({ rutas: [historial()], pagina: 1, limite: 20, total: 1, totalPaginas: 1 });
    await abrirMios();
    await screen.findByTestId('marcador-1');
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Mis rutas/ }));
    const cab = await screen.findByTestId('ruta-cabecera-7');
    expect(cab).toHaveTextContent('09:30 – 11:00');
    expect(cab).toHaveTextContent('2 entregados, 1 no entregado');
    expect(cab).toHaveTextContent('3 pedidos');
    fireEvent.click(cab);
    expect(screen.getAllByTestId(/^ruta-pedido-/).map((e) => e.textContent)).toEqual([
      expect.stringContaining('CP-1'), expect.stringContaining('CP-2'), expect.stringContaining('CP-3'),
    ]);
    expect(screen.getByTestId('ruta-pedido-2')).toHaveTextContent('No entregado 10:10');
    // el combo de periodo pide Hoy por defecto
    expect(lista).toHaveBeenCalledWith(expect.objectContaining({ desde: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), pagina: 1 }));
    fireEvent.click(screen.getByTestId('btn-dibujar-ruta-7'));
    expect(await screen.findByTestId('chip-ruta-dibujada')).toHaveTextContent('Ruta de 09:30: solo lectura');
    expect(screen.getByTestId('marcador-3')).toHaveAttribute('data-estado-final', 'ENTREGADO');
    expect(screen.queryByTestId('detalle-terminado')).toBeNull();
    fireEvent.click(screen.getByTestId('marcador-3'));
    expect(screen.queryByTestId('detalle-pedido')).toBeNull();
    fireEvent.click(screen.getByTestId('btn-cerrar-ruta-dibujada'));
    await waitFor(() => expect(screen.queryByTestId('chip-ruta-dibujada')).toBeNull());
  });
});

describe('Admin: sección Rutas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista las rutas por repartidor y día, solo lectura, y filtra por repartidor', async () => {
    const spy = vi.spyOn(repartosApi, 'listarRutas').mockResolvedValue({
      rutas: [historial(), historial({ id: '8', repartidorId: '20', repartidorNombre: 'Marta Ruiz', totalPedidos: 1, entregados: 1, fallidos: 0 })],
      pagina: 1, limite: 20, total: 2, totalPaginas: 1,
    });
    render(<RutasAdmin />);
    expect(await screen.findByTestId('ruta-cabecera-7')).toHaveTextContent('Luis Gómez');
    expect(screen.getByTestId('ruta-cabecera-8')).toHaveTextContent('Marta Ruiz');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ desde: expect.any(String), hasta: expect.any(String) }));
    fireEvent.click(screen.getByRole('button', { name: /Repartidor/ }));
    fireEvent.click(screen.getByRole('option', { name: /Marta Ruiz/ }));
    expect(screen.queryByTestId('ruta-cabecera-7')).toBeNull();
    expect(screen.getByTestId('ruta-cabecera-8')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-dibujar-ruta-8')).toBeNull();
  });

  it('el admin tiene la pestaña Rutas junto a Mapa y Lista', async () => {
    preparar('ADMIN', ['repartos/ver', 'repartos/liquidar']);
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] });
    vi.spyOn(repartosApi, 'obtenerResumen').mockResolvedValue({} as any);
    vi.spyOn(repartosApi, 'obtenerZonasPoligonos').mockResolvedValue([] as any);
    vi.spyOn(repartosApi, 'listarRutas').mockResolvedValue({ rutas: [historial()], pagina: 1, limite: 20, total: 1, totalPaginas: 1 });
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Rutas' }));
    expect(await screen.findByTestId('rutas-admin')).toBeInTheDocument();
    expect(await screen.findByTestId('ruta-cabecera-7')).toBeInTheDocument();
  });
});
