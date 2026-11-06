import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { PropinasView } from '../PropinasView';

const resumen = {
  anio: 2026,
  mes: 11,
  total: 18.5,
  efectivo: 10,
  digital: 8.5,
  devuelto: 4,
  porDia: [{ fecha: '2026-11-06', total: 18.5, efectivo: 10, digital: 8.5 }],
  porMedio: [
    { medio: 'EFECTIVO', monto: 10 },
    { medio: 'YAPE', monto: 8.5 },
  ],
  porCanal: [
    { canal: 'CARTA', monto: 12 },
    { canal: 'WHATSAPP', monto: 6.5 },
  ],
};

const pendiente = {
  id: 9,
  codigo: 'CP-9',
  propina: 3,
  total: 25,
  canal: 'CARTA',
  modalidad: 'DELIVERY',
  cliente: 'Ana',
  entregadoEn: null,
};

function rutas(pendientes: unknown[] = []) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.startsWith('/admin/propinas/mes')) return resumen as any;
    if (url === '/admin/propinas/pendientes') return pendientes as any;
    if (url === '/admin/propinas/configuracion') return { activa: { carta: true, bot: false }, tope: 200 } as any;
    throw new Error(`ruta inesperada ${url}`);
  });
}

describe('Vista Propinas (admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el acumulado del mes, la devolución, el día, el medio y el canal', async () => {
    rutas();
    render(<PropinasView />);

    expect(await screen.findByText('S/ 18.50')).toBeInTheDocument();
    expect(screen.getByText('Devueltas: S/ 4.00')).toBeInTheDocument();
    expect(screen.getByText('2026-11-06')).toBeInTheDocument();
    expect(screen.getByText('Carta virtual')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Propinas pendientes de cobro')).toBeInTheDocument();
  });

  it('avisa de los pedidos entregados con propina que aún no tienen cobro', async () => {
    rutas([pendiente]);
    render(<PropinasView />);

    expect(await screen.findByText(/CP-9/)).toBeInTheDocument();
    expect(screen.getByText(/La propina no cuenta hasta que Caja registre el cobro del pedido/)).toBeInTheDocument();
  });

  it('cambiar de mes pide ese año y mes al servidor', async () => {
    const get = rutas();
    render(<PropinasView />);
    await screen.findByText('S/ 18.50');

    const selector = screen.getByLabelText('Mes de las propinas') as HTMLSelectElement;
    const otro = Array.from(selector.options).find((o) => o.value !== selector.value)!;
    fireEvent.change(selector, { target: { value: otro.value } });

    const [anio, mes] = otro.value.split('-');
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/admin/propinas/mes?anio=${anio}&mes=${mes}`));
  });
});
