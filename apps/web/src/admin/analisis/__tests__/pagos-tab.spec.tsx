import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PagosTab } from '../pagos/PagosTab';
import { api } from '../../../comun/api';
import { ir } from './ayudas';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: '7d' as const, desde: '2026-11-05', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };
const base = {
  conDinero: true,
  pedidos: 10,
  porMedio: [
    { medio: 'YAPE', pedidos: 5, clientes: 4, monto: 100, porcentaje: 50 },
    { medio: 'TARJETA_CULQI', pedidos: 3, clientes: 2, monto: 90, porcentaje: 30 },
    { medio: 'DIVIDIDO', pedidos: 2, clientes: 2, monto: 60, porcentaje: 20 },
  ],
  porCanal: [{ canal: 'CARTA', medios: [{ medio: 'TARJETA_CULQI', pedidos: 3, clientes: 2, monto: 90 }] }],
  devueltosCulqi: { pedidos: 1, monto: 30 },
  adopcion: { pedidosCarta: 10, pedidosCulqi: 3, porcentaje: 30, ticketCulqi: 30, ticketResto: 25, porDia: [{ dia: '2026-11-10', pedidos: 4, culqi: 1, porcentaje: 25 }] },
  comision: { total: 4.5, pagosCulqi: 3, porConfirmar: 1 },
};

describe('Pestaña Medios de pago', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ADMIN: medios con Culqi separado, devueltos aparte, comisión por confirmar y adopción', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(base);
    render(<PagosTab filtros={filtros} esAdmin />);
    const lista = await screen.findByRole('list', { name: 'Pedidos por medio de pago' });
    expect(within(lista).getByText(/Yape \(manual\)/)).toBeInTheDocument();
    expect(within(lista).getByText(/Tarjeta · Culqi \(pasarela\)/)).toBeInTheDocument();
    expect(within(lista).getByText(/Pago dividido/)).toBeInTheDocument();
    expect(screen.getByText(/Devueltos por Culqi/)).toHaveTextContent('1 pedido');
    expect(screen.getByText(/Comisión por confirmar/)).toBeInTheDocument();
    ir('Adopción de Culqi');
    expect(screen.getByRole('list', { name: 'Porcentaje de la carta pagado por Culqi por día' })).toHaveTextContent('25 %');
  });

  it('SUPERVISOR: sin montos', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...base, conDinero: false, porMedio: base.porMedio.map((f) => ({ ...f, monto: null })), comision: { ...base.comision, total: null } });
    render(<PagosTab filtros={filtros} esAdmin={false} />);
    await screen.findByRole('list', { name: 'Pedidos por medio de pago' });
    expect(screen.getByText(/solo los ve el administrador/)).toBeInTheDocument();
  });
});
