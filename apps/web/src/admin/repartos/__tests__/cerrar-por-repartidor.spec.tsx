import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DespachoAdmin } from '../DespachoAdmin';
import { CONFIG_REPARTO_DEFECTO } from '../calculoRuta';
import { repartosApi, PedidoSeguimiento, RepartidorPanel } from '../repartosApi';

vi.mock('../MapaRepartos', () => ({ MapaRepartos: () => <div data-testid="mock-mapa" /> }));

const ped = (o: Partial<PedidoSeguimiento>): PedidoSeguimiento =>
  ({
    id: 'c', codigo: 'CP-C', modalidad: 'DELIVERY', estado: 'EN_CAMINO', cliente_nombre: 'Lucía Rojas', cliente_telefono: '987 654 321',
    direccion: 'Av. 1', referencia: null, lat: -12.04, lng: -77.03, zona: 'Norte', zona_id: '1', minutosEspera: 20, color: 'verde',
    total: 30, pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false, paga_con: null,
    repartidor_party_id: '9', repartidor: { id: '9', nombre: 'Ana Paz' }, tomado_en: null, salio_en: '2026-11-06T15:10:00Z', llego_en: null, entregado_en: null,
    motivo_falla: null, creado_en: '2026-11-06T15:00:00Z', seccion: 'EN_CAMINO', etapa: 'EN_CAMINO', ...o,
  }) as unknown as PedidoSeguimiento;
const repartidores = [
  { party_id: '9', nombre: 'Ana Paz', libre: false, pedidos: [], efectivo_por_rendir: 0 },
  { party_id: '8', nombre: 'Beto Libre', libre: true, pedidos: [], efectivo_por_rendir: 0 },
] as unknown as RepartidorPanel[];

const montar = (puedeCerrar: boolean, alActualizar = vi.fn()) =>
  render(
    <DespachoAdmin
      pedidos={[ped({})]} repartidores={repartidores} config={CONFIG_REPARTO_DEFECTO} zonas={[]}
      puedeAsignar puedeCerrar={puedeCerrar} seleccionadoId={null} alSeleccionar={() => {}} alAbrirDetalle={() => {}} alActualizar={alActualizar}
    />,
  );

describe('Repartos: cerrar por el repartidor (ADMIN y SUPERVISOR)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sin permiso de cerrar no aparece el botón', () => {
    montar(false);
    expect(screen.queryByRole('button', { name: /por el repartidor/i })).toBeNull();
  });

  it('pide repartidor (por defecto el asignado) y motivo, y cierra por él', async () => {
    const cerrar = vi.spyOn(repartosApi, 'cerrarPorRepartidor').mockResolvedValue({} as any);
    const alActualizar = vi.fn();
    montar(true, alActualizar);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el pedido CP-C por el repartidor' }));
    const confirmar = screen.getByRole('button', { name: /Sí, cerrar por él/i });
    expect(confirmar).toBeDisabled();
    expect((screen.getByLabelText(/Repartidor que entregó/i) as HTMLSelectElement).value).toBe('9');
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Entregó pero no marcó' } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith('c', '9', 'Entregó pero no marcó'));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('se puede elegir otro repartidor (se asigna y cierra por él)', async () => {
    const cerrar = vi.spyOn(repartosApi, 'cerrarPorRepartidor').mockResolvedValue({} as any);
    montar(true);
    fireEvent.click(screen.getByRole('button', { name: /por el repartidor/i }));
    fireEvent.change(screen.getByLabelText(/Repartidor que entregó/i), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Salió con Beto' } });
    fireEvent.click(screen.getByRole('button', { name: /Sí, cerrar por él/i }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith('c', '8', 'Salió con Beto'));
  });

  it('muestra el error del servidor', async () => {
    vi.spyOn(repartosApi, 'cerrarPorRepartidor').mockRejectedValue(new Error('Solo se cierra un delivery listo o en camino'));
    montar(true);
    fireEvent.click(screen.getByRole('button', { name: /por el repartidor/i }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Entregó pero no marcó' } });
    fireEvent.click(screen.getByRole('button', { name: /Sí, cerrar por él/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/delivery listo o en camino/);
  });
});
