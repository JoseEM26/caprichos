import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, PedidoReparto } from '../repartosApi';
import { cambioCobroApi } from '../cambioCobroApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { contadoresVivos, pasosDeTiempo } from '../tiemposReparto';

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

const T0 = new Date('2027-01-04T15:00:00Z').getTime();
const iso = (minDesde: number) => new Date(T0 + minDesde * 60000).toISOString();

const pedido = (extra: Partial<PedidoReparto> = {}): PedidoReparto =>
  ({
    id: '7', codigo: 'CP-7', modalidad: 'DELIVERY', estado: 'EN_CAMINO', cliente_nombre: 'Ana', cliente_telefono: '999888777',
    direccion: 'Av. Brasil 123', referencia: 'Portón verde', lat: -12.06, lng: -77.04, zona: null, zona_id: null, minutosEspera: 40,
    color: 'verde', total: 40, pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', cobro_pendiente_efectivo: true, paga_con: 50,
    repartidor_party_id: '10', tomado_en: iso(20), salio_en: iso(25), llego_en: iso(35), entregado_en: null, motivo_falla: null,
    creado_en: iso(0), cantidad_productos: 2, ordenRuta: null, cambio_cobro_pendiente: null, ...extra,
  }) as any;

const resumen = (extra: any = {}) => ({
  id: '7', codigo: 'CP-7', clienteNombre: 'Ana', estado: 'EN_CAMINO', estadoTexto: 'En camino', minutosEspera: 40,
  productos: [
    { cantidad: 2, nombre: 'Dona', tamano: 'Caja', sabores: ['Fresa'], opciones: ['Glaseado'], nota: 'sin nuez', es_cortesia: false },
    { cantidad: 1, nombre: 'Café', es_cortesia: true },
  ],
  nota: 'Tocar el timbre', zona: null, puedeTomar: false, motivoNoTomar: null, direccion: 'Av. Brasil 123', referencia: 'Portón verde', telefono: '999888777',
  cobro: {
    estado: 'FALTA_COBRAR', medio: 'YAPE', plan: [{ medio: 'EFECTIVO', monto: 15 }, { medio: 'YAPE', monto: 25 }], mixto: true, total: 40, propina: 0,
    total_cobrable: 40, efectivo_cobrar: 15, paga_con: 20, vuelto: 5,
    vouchers: [{ id: '1', medio: 'YAPE', estado: 'PENDIENTE' }], cortesias: [{ nombre: 'Café', cantidad: 1 }], cambio_pendiente: null,
  },
  tiempos: {
    creado_en: iso(0), pasa_cocina_en: iso(2), listo_en: iso(18), tomado_en: iso(20), salio_en: iso(25), llego_en: iso(35), entregado_en: null, espera_max_min: 5,
  },
  ...extra,
});

function montar(p: PedidoReparto, r: any = resumen()) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '10', nombres: 'R', rol: 'REPARTIDOR' }, cargando: false, autenticado: true, debeCambiar: false,
    tiene: vi.fn((x: string) => ['repartos/ver', 'repartos/entregar', 'repartos/solicitar_cambio_cobro'].includes(x)),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [p], orden: ['7'], paso: [], ruta: [] } as any);
  vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
  vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 3 } as any);
  vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: 5 });
  vi.spyOn(repartosApi, 'obtenerResumenRepartidor').mockResolvedValue(r);
  vi.spyOn(cambioCobroApi, 'vigente').mockResolvedValue(null);
}

const abrir = async () => {
  render(<MemoryRouter><RepartosView /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mis pedidos' }));
  fireEvent.click(await screen.findByTestId('marcador-7'));
  return screen.findByTestId('detalle-pedido');
};

describe('Detalle del pedido del repartidor en dos pantallas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(T0 + 38 * 60000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pantalla Pedido: cliente, dirección y referencia, contacto, productos con detalle y el cobro bien detallado', async () => {
    montar(pedido());
    const hoja = await abrir();
    const d = within(hoja);
    expect(screen.getByTestId('pantalla-pedido')).toBeInTheDocument();
    expect(d.getByText('Ana')).toBeInTheDocument();
    expect(d.getByText('Av. Brasil 123')).toBeInTheDocument();
    expect(d.getByText('Portón verde')).toBeInTheDocument();
    expect(d.getByText('Llamar')).toBeInTheDocument();
    expect(d.getByText('Google Maps')).toBeInTheDocument();
    expect(d.getByText(/2 x Dona/, { selector: 'li' })).toHaveTextContent('Caja, Fresa, Glaseado');
    expect(d.getByText(/1 x Café/, { selector: 'li' })).toHaveTextContent('(cortesía)');
    const cobro = screen.getByTestId('cobro-detallado');
    expect(cobro).toHaveTextContent('Falta cobrar');
    expect(cobro).toHaveTextContent('Pago mixto');
    expect(cobro).toHaveTextContent('Efectivo S/ 15.00 + Yape S/ 25.00');
    expect(cobro).toHaveTextContent('Cobrar en efectivo');
    expect(cobro).toHaveTextContent('Paga con');
    expect(cobro).toHaveTextContent('S/ 20.00');
    expect(cobro).toHaveTextContent('Vuelto a llevar');
    expect(cobro).toHaveTextContent('S/ 5.00');
    expect(cobro).toHaveTextContent('Captura YAPE: pendiente de validar');
    expect(cobro).toHaveTextContent('Cortesías: 1 x Café');
    expect(cobro).toHaveTextContent('Tocar el timbre');
    expect(screen.getByTestId('btn-cambiar-pago')).toBeInTheDocument();
  });

  it('pagado con Yape validado: «Pagado», sin efectivo que cobrar', async () => {
    montar(
      pedido({ pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false }),
      resumen({ cobro: { ...resumen().cobro, estado: 'PAGADO', medio: 'YAPE', plan: [{ medio: 'YAPE', monto: 40 }], mixto: false, efectivo_cobrar: 0, paga_con: null, vuelto: 0, vouchers: [{ id: '1', medio: 'YAPE', estado: 'VALIDADO' }] } }),
    );
    await abrir();
    const cobro = screen.getByTestId('cobro-detallado');
    expect(cobro).toHaveTextContent('Pagado');
    expect(cobro).toHaveTextContent('Captura YAPE: validado');
    expect(cobro).not.toHaveTextContent('Cobrar en efectivo');
  });

  it('«Ver tiempos ›» abre la pantalla Tiempos con contadores y línea de tiempo; «‹ Volver» regresa', async () => {
    montar(pedido());
    await abrir();
    fireEvent.click(screen.getByTestId('ver-tiempos'));
    expect(screen.getByTestId('pantalla-tiempos')).toBeInTheDocument();
    expect(screen.queryByTestId('cobro-detallado')).toBeNull();
    // contadores en vivo (hora simulada: 38 min después de recibir el pedido)
    expect(screen.getByTestId('contador-total')).toHaveTextContent('38 min');
    expect(screen.getByTestId('contador-tomado')).toHaveTextContent('18 min');
    expect(screen.getByTestId('contador-salio')).toHaveTextContent('13 min');
    // espera en puerta: 3 min con máximo 5
    expect(screen.getByTestId('contador-puerta')).toHaveTextContent('3 min');
    expect(screen.getByTestId('contador-puerta')).toHaveTextContent('máx. 5 min');
    // los siete pasos; el entregado sigue pendiente
    for (const id of ['creado', 'cocina', 'listo', 'tomado', 'salio', 'llego']) expect(screen.getByTestId(`paso-${id}`)).not.toHaveTextContent('Pendiente');
    expect(screen.getByTestId('paso-entregado')).toHaveTextContent('Pendiente');
    expect(screen.getByTestId('paso-listo')).toHaveTextContent('18 min');
    expect(screen.getByTestId('paso-creado')).toHaveTextContent('Pedido recibido en la tienda');
    fireEvent.click(screen.getByTestId('volver-pedido'));
    expect(screen.getByTestId('pantalla-pedido')).toBeInTheDocument();
  });

  it('también se cambia con las pestañas y deslizando', async () => {
    montar(pedido());
    const hoja = await abrir();
    fireEvent.click(screen.getByTestId('pestana-tiempos'));
    expect(screen.getByTestId('pantalla-tiempos')).toBeInTheDocument();
    fireEvent.touchStart(hoja.querySelector('[data-testid="pantalla-tiempos"]')!.parentElement!, { touches: [{ clientX: 50 }] });
    fireEvent.touchEnd(hoja.querySelector('[data-testid="pantalla-tiempos"]')!.parentElement!, { changedTouches: [{ clientX: 200 }] });
    expect(screen.getByTestId('pantalla-pedido')).toBeInTheDocument();
  });

  it('los contadores avanzan en vivo', async () => {
    montar(pedido());
    await abrir();
    fireEvent.click(screen.getByTestId('ver-tiempos'));
    expect(screen.getByTestId('contador-total')).toHaveTextContent('38 min');
    await vi.advanceTimersByTimeAsync(5 * 60000);
    await waitFor(() => expect(screen.getByTestId('contador-total')).toHaveTextContent('43 min'));
  });

  it('con solicitud de cambio pendiente el botón Entregar está bloqueado con el aviso', async () => {
    const pendiente = { id: '3', plan_original: [{ medio: 'EFECTIVO', monto: 40 }], plan_solicitado: [{ medio: 'YAPE', monto: 40 }], paga_con: null, solicitado_en: iso(36) };
    montar(pedido({ cambio_cobro_pendiente: pendiente }));
    vi.spyOn(cambioCobroApi, 'vigente').mockResolvedValue({ id: '3', pedidoId: '7', estado: 'PENDIENTE', planOriginal: pendiente.plan_original, planSolicitado: pendiente.plan_solicitado, pagaCon: null, voucherIds: ['9'], motivo: null, solicitadoPor: 'R', solicitadoEn: iso(36), resueltoPor: null, resueltoEn: null });
    await abrir();
    expect(screen.getByTestId('btn-entregar-7')).toBeDisabled();
    expect(screen.getByTestId('motivo-bloqueo-7')).toHaveTextContent('Esperando que Caja valide el pago…');
    expect(await screen.findByTestId('estado-cambio-cobro')).toHaveTextContent('Efectivo S/ 40.00 → Yape S/ 40.00');
    expect(screen.queryByTestId('btn-cambiar-pago')).toBeNull();
  });

  it('sin solicitud pendiente se puede entregar', async () => {
    montar(pedido());
    await abrir();
    expect(screen.getByTestId('btn-entregar-7')).toBeEnabled();
  });
});

describe('tiemposReparto', () => {
  it('pasosDeTiempo da hora y minutos desde que el pedido llegó a la tienda; contadoresVivos se detiene al entregar', () => {
    const t = { creado_en: iso(0), pasa_cocina_en: iso(3), listo_en: iso(20), tomado_en: iso(22), salio_en: iso(25), llego_en: iso(35), entregado_en: iso(40), espera_max_min: 5 };
    expect(pasosDeTiempo(t).map((p) => p.minDesdePedido)).toEqual([0, 3, 20, 22, 25, 35, 40]);
    const c = contadoresVivos(t, T0 + 999 * 60000);
    expect(c.map((x) => [x.id, x.minutos, x.detenido])).toEqual([['total', 40, true], ['tomado', 18, true], ['salio', 15, true], ['puerta', 5, true]]);
    expect(c[3].colorHex).toBe('#C4412B'); // 5 de 5 min: espera agotada
  });

  it('el semáforo del total usa los colores de siempre', () => {
    const t = { creado_en: iso(0) };
    expect(contadoresVivos(t, T0 + 10 * 60000)[0].colorHex).toBe('#2E8B57');
    expect(contadoresVivos(t, T0 + 25 * 60000)[0].colorHex).toBe('#D99E39');
    expect(contadoresVivos(t, T0 + 50 * 60000)[0].colorHex).toBe('#C4412B');
  });
});
