import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { PanelRepartidores } from '../PanelRepartidores';
import { PendientesCierreRuta } from '../PendientesCierreRuta';
import { useAvisosAnulados, PilaAvisosAnulados, DURACION_AVISO_ANULADO_MS } from '../AvisosAnulados';
import { repartosApi, PedidoReparto } from '../repartosApi';
import { ErrorApi } from '../../../comun/api';
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

const mio = (id: string, orden: number, estado = 'LISTO'): PedidoReparto => ({
  id, codigo: `CP-W${id}`, modalidad: 'DELIVERY', estado, cliente_nombre: `Cli ${id}`, cliente_telefono: null,
  direccion: 'x', referencia: null, lat: -12.06 - Number(id) / 100, lng: -77.04, zona: null, zona_id: null, minutosEspera: 5,
  color: 'verde', total: 30, pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false, paga_con: null,
  repartidor_party_id: '10', tomado_en: null, salio_en: null, llego_en: null, entregado_en: null, motivo_falla: null,
  creado_en: '2026-10-27T14:00:00Z', cantidad_productos: 1, ordenRuta: orden,
} as any);

/** Captura los manejadores de socket para poder disparar eventos a mano. */
const registro: Record<string, Array<(d: any) => void>> = {};
const manejadores = new Proxy({} as Record<string, (d: any) => void>, {
  get: (_t, ev: string) => (d: any) => (registro[ev] ?? []).forEach((f) => f(d)),
});
const registrar = (ev: string, cb: any) => { (registro[ev] ??= []).push(cb); };

function Arnes({ ids }: { ids: string[] }) {
  const a = useAvisosAnulados(ids);
  socketModulo.useEventos('pedido:estado', a.alEstado);
  return <PilaAvisosAnulados avisos={a.avisos} alCerrar={a.cerrar} />;
}

describe('aviso de pedido anulado en la ruta del repartidor', () => {
  beforeEach(() => {
    for (const k of Object.keys(registro)) delete registro[k];
    vi.useFakeTimers();
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(registrar);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('aparece con role=status solo para pedidos míos, no se duplica y se cierra al tocarlo', () => {
    render(<Arnes ids={['2', '3']} />);
    act(() => manejadores['pedido:estado']({ id: 9, codigo: 'CP-W9', estado: 'ANULADO' })); // no es mío
    expect(screen.queryByTestId('avisos-anulados')).toBeNull();
    act(() => manejadores['pedido:estado']({ id: 2, codigo: 'CP-W2', estado: 'ANULADO' }));
    act(() => manejadores['pedido:estado']({ id: 2, codigo: 'CP-W2', estado: 'ANULADO' })); // repetido
    expect(screen.getByRole('status')).toHaveTextContent('El pedido CP-W2 fue anulado: salió de tu ruta');
    expect(screen.getAllByTestId('aviso-anulado-2')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('aviso-anulado-2'));
    expect(screen.queryByTestId('aviso-anulado-2')).toBeNull();
  });

  it('se cierra solo a los 8 s, apila varios y un cambio normal de estado no avisa', () => {
    render(<Arnes ids={['2', '3']} />);
    act(() => manejadores['pedido:estado']({ id: 2, codigo: 'CP-W2', estado: 'EN_CAMINO' }));
    expect(screen.queryByTestId('avisos-anulados')).toBeNull();
    act(() => manejadores['pedido:estado']({ id: 2, codigo: 'CP-W2', estado: 'ANULADO' }));
    act(() => manejadores['pedido:estado']({ id: 3, codigo: 'CP-W3', estado: 'RECHAZADO' }));
    expect(screen.getByTestId('aviso-anulado-2')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-anulado-3')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(DURACION_AVISO_ANULADO_MS + 100); });
    expect(screen.queryByTestId('avisos-anulados')).toBeNull();
  });
});

describe('PendientesCierreRuta', () => {
  it('con pendientes lista cuáles y ofrece Entregado, No se pudo entregar y Devolver al local', () => {
    const e = vi.fn(); const n = vi.fn(); const d = vi.fn();
    render(<PendientesCierreRuta pendientes={[{ id: '110', codigo: 'CP-W110' }]} alEntregado={e} alNoSePudo={n} alDevolver={d} alCerrar={vi.fn()} alDescartar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Te falta resolver: CP-W110 (en camino)');
    fireEvent.click(screen.getByText('Entregado'));
    fireEvent.click(screen.getByText('No se pudo entregar'));
    fireEvent.click(screen.getByText('Devolver al local'));
    expect(e).toHaveBeenCalledWith('110'); expect(n).toHaveBeenCalledWith('110'); expect(d).toHaveBeenCalledWith('110');
  });

  it('sin pendientes ofrece cerrar la ruta con un toque', () => {
    const cerrar = vi.fn();
    render(<PendientesCierreRuta pendientes={[]} alCerrar={cerrar} alDescartar={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-confirmar-cerrar-ruta'));
    expect(cerrar).toHaveBeenCalled();
  });
});

describe('RepartidorView: anulan un pedido y se cierra la ruta', () => {
  beforeEach(() => {
    for (const k of Object.keys(registro)) delete registro[k];
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'R', rol: 'REPARTIDOR' }, permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'], cargando: false, autenticado: true, debeCambiar: false,
      tiene: vi.fn((p: string) => ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(p)),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(registrar);
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 3 });
    vi.spyOn(repartosApi, 'obtenerResumenRepartidor').mockResolvedValue({} as any);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: 5 });
  });

  const ruta = (pedidos: PedidoReparto[]) => ({ id: 'r1', iniciadaEn: '2026-11-08T15:00:00Z', estado: 'EN_CURSO', pedidos: pedidos.map((p, i) => ({ ...p, estadoFinal: null, horaFinal: null, orden: i + 1 })) });
  const abrirMios = async () => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
  };

  it('el aviso aparece al anular el pedido 2 y el pedido desaparece de pendientes al recargar', async () => {
    const todos = [mio('1', 1), mio('2', 2), mio('3', 3)];
    const listar = vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: todos, orden: ['1', '2', '3'], paso: [], ruta: [] } as any);
    await abrirMios();
    expect(await screen.findByTestId('marcador-2')).toBeInTheDocument();
    listar.mockResolvedValue({ pedidos: [todos[0], todos[2]], orden: ['1', '3'], paso: [], ruta: [] } as any);
    act(() => manejadores['pedido:estado']({ id: 2, codigo: 'CP-W2', estado: 'ANULADO' }));
    expect(await screen.findByText('El pedido CP-W2 fue anulado: salió de tu ruta')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('marcador-2')).toBeNull());
    expect(screen.getByTestId('marcador-1')).toBeInTheDocument();
    expect(screen.getByTestId('marcador-3')).toBeInTheDocument();
  });

  it('Cerrar ruta con un EN_CAMINO sin resolver muestra la lista y las acciones; los demás no cuentan', async () => {
    const todos = [mio('1', 1), mio('110', 2, 'EN_CAMINO')];
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: todos, orden: ['1', '110'], paso: [], ruta: [], rutaReparto: ruta(todos) } as any);
    const cerrar = vi.spyOn(repartosApi, 'cerrarRuta').mockRejectedValue(
      new ErrorApi('RUTA_CON_PENDIENTES', 'Te falta resolver: CP-W110 (en camino)', 409, { pedidos: [{ id: '110', codigo: 'CP-W110', estado: 'EN_CAMINO' }] }),
    );
    await abrirMios();
    fireEvent.click(await screen.findByTestId('btn-cerrar-ruta'));
    const alerta = await screen.findByTestId('pendientes-cierre');
    expect(alerta).toHaveTextContent('Te falta resolver: CP-W110 (en camino)');
    expect(screen.getByText('Entregado')).toBeInTheDocument();
    expect(screen.getByText('No se pudo entregar')).toBeInTheDocument();
    expect(screen.getByText('Devolver al local')).toBeInTheDocument();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('Cerrar ruta sin pendientes cierra con un toque y avisa', async () => {
    const todos = [mio('1', 1)];
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: todos, orden: ['1'], paso: [], ruta: [], rutaReparto: ruta(todos) } as any);
    const cerrar = vi.spyOn(repartosApi, 'cerrarRuta').mockResolvedValue({ ok: true, rutaId: 'r1', cerrada: true, liberados: 0 });
    await abrirMios();
    fireEvent.click(await screen.findByTestId('btn-cerrar-ruta'));
    expect(await screen.findByText('Ruta cerrada')).toBeInTheDocument();
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pendientes-cierre')).toBeNull();
  });
});

describe('PanelRepartidores: Cerrar ruta (Caja/Admin)', () => {
  const panel: any = {
    generado_en: '', max_pedidos: 3,
    resumen: { repartidores_libres: 0, repartidores_ocupados: 1, pedidos_sin_tomar: 0 },
    repartidores: [{ party_id: '10', nombre: 'Rosa', libre: false, efectivo_por_rendir: 0, pedidos: [{ ...mio('110', 1, 'EN_CAMINO'), etapa: 'EN_CAMINO' }] }],
    sin_tomar: [],
  };
  const config: any = { retrasadoMin: 20, tardeMin: 30, muyTardeMin: 45 };

  it('con EN_CAMINO sin resolver lista cuáles; si no, cierra', async () => {
    const cerrar = vi.spyOn(repartosApi, 'cerrarRuta')
      .mockRejectedValueOnce(new ErrorApi('RUTA_CON_PENDIENTES', 'x', 409, { pedidos: [{ id: '110', codigo: 'CP-W110' }] }))
      .mockResolvedValueOnce({ ok: true, rutaId: 'r1', cerrada: true, liberados: 0 });
    render(<PanelRepartidores panel={panel} config={config} alAbrir={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-cerrar-ruta-10'));
    expect(await screen.findByTestId('pendientes-cierre')).toHaveTextContent('Te falta resolver: CP-W110 (en camino)');
    expect(cerrar).toHaveBeenCalledWith('10');
    fireEvent.click(screen.getByTestId('btn-cerrar-ruta-10'));
    expect(await screen.findByTestId('msg-cierre-ruta')).toHaveTextContent('Ruta cerrada');
  });
});
