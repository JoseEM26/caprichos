import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { DespachoAdmin } from '../DespachoAdmin';
import { contarDespacho, pedidosDespacho, rutaDespacho } from '../despachoModelo';
import { CONFIG_REPARTO_DEFECTO } from '../calculoRuta';
import { repartosApi, PedidoSeguimiento, RepartidorPanel } from '../repartosApi';
import { OpcionesRutaSugerida } from '../OpcionesRutaSugerida';

let propsMapa: any;
vi.mock('../MapaRepartos', () => ({
  MapaRepartos: (p: any) => {
    propsMapa = p;
    return (
      <div data-testid="mock-mapa">
        {p.puntos.map((x: any) => (
          <button key={x.id} data-testid={`pin-${x.id}`} onClick={() => p.onSeleccionarPunto(x.id)}>
            {x.orden}
          </button>
        ))}
      </div>
    );
  },
}));

const ped = (o: Partial<PedidoSeguimiento>): PedidoSeguimiento =>
  ({
    id: '1', codigo: 'CP-1', modalidad: 'DELIVERY', estado: 'LISTO', cliente_nombre: 'Lucía Rojas', cliente_telefono: '987 654 321',
    direccion: 'Av. 1', referencia: null, lat: -12.04, lng: -77.03, zona: 'Norte', zona_id: '1', minutosEspera: 12, color: 'verde',
    total: 30, pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', cobro_pendiente_efectivo: true, paga_con: null,
    repartidor_party_id: null, repartidor: null, tomado_en: null, salio_en: null, llego_en: null, entregado_en: null,
    motivo_falla: null, creado_en: '2026-11-06T15:00:00Z', seccion: 'ESPERANDO', etapa: null, ...o,
  }) as PedidoSeguimiento;

const ana = { id: '9', nombre: 'Ana Paz' };
const pedidos = [
  ped({ id: 'a', codigo: 'CP-A', minutosEspera: 5, seccion: 'PREPARACION', estado: 'EN_COCINA' }),
  ped({ id: 'b', codigo: 'CP-B', minutosEspera: 40 }),
  ped({ id: 'c', codigo: 'CP-C', minutosEspera: 20, seccion: 'EN_CAMINO', estado: 'EN_CAMINO', etapa: 'EN_CAMINO', salio_en: '2026-11-06T15:10:00Z', repartidor_party_id: '9', repartidor: ana, pago_estado: 'PAGADO' }),
  ped({ id: 'd', codigo: 'CP-D', minutosEspera: 10, seccion: 'EN_CAMINO', estado: 'EN_CAMINO', etapa: 'LLEGADO', llego_en: '2026-11-06T15:20:00Z', repartidor_party_id: '9', repartidor: ana }),
  ped({ id: 'e', codigo: 'CP-E', seccion: 'ENTREGADOS', estado: 'ENTREGADO' }),
];
const repartidores = [
  { party_id: '9', nombre: 'Ana Paz', libre: false, pedidos: [], efectivo_por_rendir: 0 },
  { party_id: '8', nombre: 'Beto Libre', libre: true, pedidos: [], efectivo_por_rendir: 0 },
] as unknown as RepartidorPanel[];

function Montaje({ alActualizar = () => {}, puedeAsignar = true }: { alActualizar?: () => void; puedeAsignar?: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <DespachoAdmin
      pedidos={pedidos} repartidores={repartidores} config={CONFIG_REPARTO_DEFECTO} zonas={[]}
      puedeAsignar={puedeAsignar} seleccionadoId={sel} alSeleccionar={setSel} alAbrirDetalle={() => {}} alActualizar={alActualizar}
    />
  );
}

beforeEach(() => {
  propsMapa = undefined;
});
afterEach(() => vi.restoreAllMocks());

describe('modelo del despacho', () => {
  it('numera por urgencia (más espera primero), sin entregados', () => {
    const l = pedidosDespacho(pedidos);
    expect(l.map((d) => [d.numero, d.pedido.codigo, d.fase])).toEqual([
      [1, 'CP-B', 'porSalir'],
      [2, 'CP-C', 'enCamino'],
      [3, 'CP-D', 'llego'],
      [4, 'CP-A', 'cocina'],
    ]);
  });

  it('cuenta cocina, por salir, en camino, llegaron y sin repartidor (la cocina no cuenta como sin repartidor)', () => {
    expect(contarDespacho(pedidosDespacho(pedidos))).toEqual({ enCocina: 1, porSalir: 1, enCamino: 1, llegaron: 1, sinRepartidor: 1 });
  });

  it('la ruta lleva los números de las paradas, distancia, tiempo y enlace de Google Maps', () => {
    const r = rutaDespacho(pedidosDespacho(pedidos).filter((d) => d.fase !== 'cocina'))!;
    expect(r.numeros).toEqual([1, 2, 3]);
    expect(r.distanciaAproxKm).toBeGreaterThan(0);
    expect(r.urlGoogleMaps).toContain('google.com/maps/dir');
  });
});

describe('Despacho del admin', () => {
  it('los contadores salen de los pedidos', () => {
    render(<Montaje />);
    expect(screen.getByLabelText('Sin repartidor: 1')).toBeTruthy();
    expect(screen.getByLabelText('En cocina: 1')).toBeTruthy();
    expect(screen.getByLabelText('Listos para salir: 1')).toBeTruthy();
    expect(screen.getByLabelText('En camino: 1')).toBeTruthy();
    expect(screen.getByLabelText('Llegaron: 1')).toBeTruthy();
  });

  it('el mapa recibe un pin numerado por pedido con el color de su estado y sin flechas', () => {
    render(<Montaje />);
    expect(propsMapa.puntos.map((p: any) => [p.codigo, p.orden, p.colorFase])).toEqual([
      ['CP-B', 1, '#E67929'],
      ['CP-C', 2, '#2563EB'],
      ['CP-D', 3, '#2E8B57'],
      ['CP-A', 4, '#6B7C86'],
    ]);
    expect(document.body.textContent).not.toMatch(/→|➜|➤|►/);
  });

  it('las tarjetas muestran número, pago, hora de Salió/Llegó, Llamar y WhatsApp', () => {
    render(<Montaje />);
    const c = screen.getByTestId('tarjeta-despacho-c');
    expect(within(c).getByText('2')).toBeTruthy();
    expect(within(c).getByText(/Salió/)).toBeTruthy();
    expect(within(c).getByText('Pagado')).toBeTruthy();
    expect(within(screen.getByTestId('tarjeta-despacho-d')).getByText(/Llegó/)).toBeTruthy();
    const b = screen.getByTestId('tarjeta-despacho-b');
    expect(within(b).getByText(/Falta cobrar S\/ 30\.00/)).toBeTruthy();
    expect(within(b).getByText('Llamar').getAttribute('href')).toBe('tel:987654321');
    expect(within(b).getByText('WhatsApp').getAttribute('href')).toBe('https://wa.me/51987654321');
  });

  it('tocar un pin resalta su tarjeta y tocar la tarjeta resalta su pin', () => {
    render(<Montaje />);
    fireEvent.click(screen.getByTestId('pin-b'));
    expect(screen.getByTestId('tarjeta-despacho-b').getAttribute('aria-current')).toBe('true');
    expect(propsMapa.seleccionadoId).toBe('b');
    fireEvent.click(within(screen.getByTestId('tarjeta-despacho-c')).getByRole('button', { name: /Pedido 2/ }));
    expect(propsMapa.seleccionadoId).toBe('c');
    expect(screen.getByTestId('tarjeta-despacho-b').getAttribute('aria-current')).toBeNull();
  });

  it('asignar repartidor en un toque llama a reasignar y recarga', async () => {
    const reasignar = vi.spyOn(repartosApi, 'reasignarPedido').mockResolvedValue({} as any);
    const recargar = vi.fn();
    render(<Montaje alActualizar={recargar} />);
    fireEvent.change(screen.getByLabelText('Asignar repartidor del pedido CP-B'), { target: { value: '8' } });
    await waitFor(() => expect(reasignar).toHaveBeenCalledWith('b', '8', expect.any(String)));
    expect(recargar).toHaveBeenCalled();
  });

  it('sin permiso no hay selector de asignación', () => {
    render(<Montaje puedeAsignar={false} />);
    expect(screen.queryByLabelText(/Asignar repartidor del pedido/)).toBeNull();
  });

  it('filtra por «Sin repartidor» y la ruta usa solo esas paradas', () => {
    render(<Montaje />);
    fireEvent.change(screen.getByLabelText('Ver pedidos de'), { target: { value: 'sin' } });
    expect(screen.queryByTestId('tarjeta-despacho-c')).toBeNull();
    expect(screen.getByTestId('tarjeta-despacho-b')).toBeTruthy();
    expect(screen.getByTestId('ruta-despacho').textContent).toMatch(/Paradas 1 ·/);
  });
});

describe('Rutas sugeridas sin flechas', () => {
  it('la opción muestra un número, no una flecha de rumbo', () => {
    const datos: any = {
      cupo: 3, sinUbicacion: [],
      opciones: [{ id: 'o1', sector: 'Norte', rumbo: 0, pedidos: [{ id: 'p', codigo: 'CP-9', cliente: 'Ana', retrasoMin: 0, llegadaMin: 5 }], distanciaKm: 1, tiempoMin: 5, retrasoTotalMin: 0, yaTarde: 0, urgente: false, razon: 'x', puntaje: 1, ruta: [] }],
    };
    const { container } = render(
      <OpcionesRutaSugerida datos={datos} cargando={false} error={null} alReintentar={() => {}} seleccionadaId={null} alSeleccionar={() => {}} alCambiar={() => {}} />,
    );
    expect(container.querySelector('svg path')).toBeNull();
    expect(container.textContent).not.toMatch(/→/);
  });
});
