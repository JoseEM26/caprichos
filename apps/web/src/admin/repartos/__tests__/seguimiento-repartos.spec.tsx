import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, PedidoSeguimiento, PanelRepartidores } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import { MODULOS } from '../../modulos';
import * as socketModulo from '../../../comun/socket';

vi.mock('../MapaRepartos', () => ({ MapaRepartos: () => <div data-testid="mock-mapa" /> }));

const ped = (o: Partial<PedidoSeguimiento>): PedidoSeguimiento =>
  ({
    id: '1', codigo: 'CP-1', modalidad: 'DELIVERY', estado: 'LISTO', cliente_nombre: 'Lucía Rojas', cliente_telefono: null,
    direccion: 'Av. 1', referencia: null, lat: -12.04, lng: -77.03, zona: 'Norte', zona_id: '1', minutosEspera: 12, color: 'verde',
    total: 30, pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', cobro_pendiente_efectivo: true, paga_con: null,
    repartidor_party_id: null, repartidor: null, tomado_en: null, salio_en: null, llego_en: null, entregado_en: null,
    motivo_falla: null, creado_en: '2026-11-06T15:00:00Z', seccion: 'ESPERANDO', etapa: null, ...o,
  }) as PedidoSeguimiento;

const ana = { id: '9', nombre: 'Ana Paz' };
const pedidos = [
  ped({ id: '1', codigo: 'CP-0001', seccion: 'ESPERANDO' }),
  ped({ id: '2', codigo: 'CP-0002', seccion: 'PREPARACION', estado: 'EN_COCINA', cliente_nombre: 'Beto Soto' }),
  ped({ id: '3', codigo: 'CP-0003', seccion: 'EN_CAMINO', estado: 'EN_CAMINO', repartidor_party_id: '9', repartidor: ana, etapa: 'EN_CAMINO', salio_en: '2026-11-06T15:10:00Z' }),
  ped({ id: '4', codigo: 'CP-0004', seccion: 'ENTREGADOS', estado: 'ENTREGADO', repartidor_party_id: '9', repartidor: ana, entregado_en: '2026-11-06T15:30:00Z' }),
  ped({ id: '5', codigo: 'CP-0005', seccion: 'INCIDENTE', motivo_falla: 'No sale' }),
];
const panel: PanelRepartidores = {
  generado_en: '', max_pedidos: 3,
  resumen: { repartidores_libres: 1, repartidores_ocupados: 1, pedidos_sin_tomar: 1 },
  repartidores: [
    { party_id: '9', nombre: 'Ana Paz', libre: false, efectivo_por_rendir: 0, pedidos: [{ ...pedidos[2], etapa: 'EN_CAMINO' } as any] },
    { party_id: '8', nombre: 'Beto Libre', libre: true, efectivo_por_rendir: 0, pedidos: [] },
  ],
  sin_tomar: [pedidos[0]],
};

function sesion(rol: string, permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '10', nombres: 'X', rol },
    permisos, debeCambiar: false, cargando: false, autenticado: true,
    tiene: (p: string) => rol === 'ADMIN' || permisos.some((x) => x === p || x.startsWith(`${p}/`)),
  } as any);
}

const montar = (vista?: string) =>
  render(<MemoryRouter initialEntries={[vista ? `/admin/repartos?vista=${vista}` : '/admin/repartos']}><RepartosView /></MemoryRouter>);

beforeEach(() => {
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation(() => {});
  vi.spyOn(repartosApi, 'obtenerPanel').mockResolvedValue(panel);
  vi.spyOn(repartosApi, 'obtenerSeguimiento').mockResolvedValue({ generado_en: '', pedidos });
  vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue(null as any);
  vi.spyOn(repartosApi, 'obtenerZonasPoligonos').mockResolvedValue(null as any);
});
afterEach(() => vi.restoreAllMocks());

describe('Seguimiento de repartos', () => {
  it('ya no hay selector «Ver como» ni Repartidor 1/2/3; las pestañas son las nuevas', async () => {
    sesion('CAJERO', ['repartos/seguir', 'repartos/liquidar']);
    montar();
    await screen.findByLabelText('Repartidor Ana Paz');
    expect(screen.queryByText(/Ver como/)).toBeNull();
    expect(screen.queryByText(/Repartidor [123]$/)).toBeNull();
    for (const t of ['Repartidores', 'Todos los pedidos', 'Mapa', 'Rutas']) expect(screen.getByRole('button', { name: t })).toBeTruthy();
  });

  it('el repartidor libre dice «Libre · Sin pedidos» y el filtro lista repartidores reales', async () => {
    sesion('MOZO', ['repartos/seguir']);
    montar();
    const libre = await screen.findByLabelText('Repartidor Beto Libre');
    expect(within(libre).getByText('Libre · Sin pedidos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Repartidor: Todos/ }));
    expect(screen.getByRole('option', { name: /Ana Paz/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Beto Libre/ })).toBeTruthy();
  });

  it('«Todos los pedidos» agrupa en secciones con conteo, filtra por chip y busca', async () => {
    sesion('MOZO', ['repartos/seguir']);
    montar('todos');
    for (const t of ['Esperando repartidor (1)', 'En preparación / en espera (1)', 'Tomados · en camino (1)', 'Entregados hoy (1)', 'No entregados / con incidente (1)']) {
      expect(await screen.findByRole('heading', { name: t })).toBeTruthy();
    }
    expect(screen.getByText(/Ana Paz · En camino/)).toBeTruthy();
    expect(screen.getAllByText(/Sin repartidor/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Entregados hoy (1)' }));
    expect(screen.queryByText(/CP-0001/)).toBeNull();
    expect(screen.getByText(/CP-0004/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Todos \(/ }));
    fireEvent.change(screen.getByLabelText('Buscar por código o cliente'), { target: { value: 'beto' } });
    expect(screen.getByText(/CP-0002/)).toBeTruthy();
    expect(screen.queryByText(/CP-0001/)).toBeNull();
  });

  it('ADMIN ve «Tomar como repartidor» en un pedido esperando y la API toma ese pedido', async () => {
    sesion('ADMIN', ['repartos/tomar', 'repartos/liquidar']);
    const tomar = vi.spyOn(repartosApi, 'tomarPedido').mockResolvedValue({} as any);
    montar('todos');
    fireEvent.click(await screen.findByText(/CP-0001/));
    fireEvent.click(await screen.findByRole('button', { name: 'Tomar como repartidor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    await waitFor(() => expect(tomar).toHaveBeenCalledWith('1'));
  });

  it.each([['MOZO', ['repartos/seguir']], ['CAJERO', ['repartos/seguir', 'repartos/liquidar']], ['SUPERVISOR', ['repartos/seguir', 'repartos/liquidar']]])(
    '%s ve el seguimiento sin botón de tomar ni de asignar',
    async (rol, permisos) => {
      sesion(rol as string, permisos as string[]);
      montar('todos');
      fireEvent.click(await screen.findByText(/CP-0001/));
      await screen.findByRole('region', { name: /Hoja de pedido CP-0001/ });
      expect(screen.queryByRole('button', { name: /Tomar/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Asignar/i })).toBeNull();
    },
  );

  it('«Soltar / reasignar» solo ADMIN y CAJERO, exige motivo y usa la API de liberar', async () => {
    sesion('MOZO', ['repartos/seguir']);
    const m = montar('todos');
    fireEvent.click(await screen.findByText(/CP-0003/));
    await screen.findByRole('region', { name: /Hoja de pedido CP-0003/ });
    expect(screen.queryByRole('button', { name: /Soltar/ })).toBeNull();
    m.unmount();

    sesion('CAJERO', ['repartos/seguir', 'repartos/liquidar']);
    const liberar = vi.spyOn(repartosApi, 'liberarPedido').mockResolvedValue({} as any);
    montar('todos');
    fireEvent.click(await screen.findByText(/CP-0003/));
    fireEvent.click(await screen.findByRole('button', { name: 'Soltar / reasignar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Soltar pedido' }));
    expect(await screen.findByText('Escribe el motivo')).toBeTruthy();
    expect(liberar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Se le cayó la moto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soltar pedido' }));
    await waitFor(() => expect(liberar).toHaveBeenCalledWith('3', 'Se le cayó la moto'));
  });

  it('el REPARTIDOR conserva su pantalla móvil (no ve el seguimiento)', async () => {
    sesion('REPARTIDOR', ['repartos/ver', 'repartos/tomar']);
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] } as any);
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([] as any);
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 0 } as any);
    montar();
    await waitFor(() => expect(repartosApi.listarMios).toHaveBeenCalled());
    expect(repartosApi.obtenerSeguimiento).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Todos los pedidos' })).toBeNull();
  });
});

describe('Menú: módulo Repartos', () => {
  const visible = (permisos: string[]) => {
    const m = MODULOS.find((x) => x.clave === 'repartos')!;
    return permisos.some((p) => p === m.permisoMinimo || p.startsWith(`${m.permisoMinimo}/`));
  };
  it('lo ven quien sigue el delivery (seguir) y el repartidor (ver) y no cocina', () => {
    expect(visible(['repartos/seguir'])).toBe(true);
    expect(visible(['repartos/ver', 'repartos/tomar'])).toBe(true);
    expect(visible(['cocina/ver', 'reservas/ver'])).toBe(false);
  });
});
