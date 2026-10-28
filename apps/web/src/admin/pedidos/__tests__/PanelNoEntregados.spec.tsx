import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PanelNoEntregados } from '../PanelNoEntregados';
import type { NoEntregado, RespuestaNoEntregados } from '../pedidosApi';
import { repartosApi } from '../../repartos/repartosApi';

vi.mock('../../repartos/repartosApi', async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    repartosApi: {
      ...real.repartosApi,
      reprogramarPedido: vi.fn().mockResolvedValue({ ok: true, pedido: {} }),
    },
  };
});

const fila = (extra: Partial<NoEntregado>): NoEntregado => ({
  id: '1',
  codigo: 'CP-N001',
  cliente_nombre: 'Marta',
  cliente_telefono: '987654321',
  total: 30,
  motivo: 'No contestó al repartidor (retiro por espera agotada)',
  retirado_en: '2026-10-28T10:00:00Z',
  pregunta: 'ESPERANDO',
  pago_estado: 'PENDIENTE',
  revisar_devolucion: false,
  ...extra,
});

const datos: RespuestaNoEntregados = {
  reprogramar: [
    fila({ id: '1', codigo: 'CP-ESP', pregunta: 'ESPERANDO' }),
    fila({ id: '2', codigo: 'CP-SI', pregunta: 'SI', cliente_nombre: 'Luis' }),
  ],
  cancelados: [
    fila({
      id: '3',
      codigo: 'CP-NO',
      pregunta: 'NO',
      motivo: 'Cliente no quiso reprogramar la entrega tras la espera agotada',
      pago_estado: 'PAGADO',
      revisar_devolucion: true,
    }),
    fila({ id: '4', codigo: 'CP-SR', pregunta: 'SIN_RESPUESTA', motivo: 'Sin respuesta del cliente sobre reprogramar (tiempo agotado)' }),
  ],
  total: 4,
};

describe('PanelNoEntregados', () => {
  beforeEach(() => {
    vi.mocked(repartosApi.reprogramarPedido).mockClear();
  });

  it('agrupa las filas en Por reprogramar y Cancelados por no recibir, con sus contadores', () => {
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar alActualizar={() => {}} />);

    const porReprogramar = screen.getByTestId('grupo-reprogramar');
    const cancelados = screen.getByTestId('grupo-cancelados');

    expect(within(porReprogramar).getByRole('heading', { name: /Por reprogramar · 2/ })).toBeInTheDocument();
    expect(within(cancelados).getByRole('heading', { name: /Cancelados por no recibir · 2/ })).toBeInTheDocument();
    expect(within(porReprogramar).getByTestId('no-entregado-CP-ESP')).toBeInTheDocument();
    expect(within(porReprogramar).getByTestId('no-entregado-CP-SI')).toBeInTheDocument();
    expect(within(cancelados).getByTestId('no-entregado-CP-NO')).toBeInTheDocument();
    expect(within(porReprogramar).queryByTestId('no-entregado-CP-NO')).not.toBeInTheDocument();
  });

  it('muestra el estado de la pregunta y el motivo, la hora del retiro y el total de cada fila', () => {
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar alActualizar={() => {}} />);

    expect(screen.getByTestId('pregunta-CP-ESP')).toHaveTextContent('Esperando respuesta del cliente');
    expect(screen.getByTestId('pregunta-CP-SI')).toHaveTextContent('Dijo que sí quiere reprogramar');
    expect(screen.getByTestId('pregunta-CP-NO')).toHaveTextContent('Dijo que no quiere reprogramar');
    expect(screen.getByTestId('pregunta-CP-SR')).toHaveTextContent('Sin respuesta del cliente');

    const card = screen.getByTestId('no-entregado-CP-NO');
    expect(card).toHaveTextContent('Cliente no quiso reprogramar la entrega tras la espera agotada');
    expect(card).toHaveTextContent('S/ 30.00');
    expect(card).toHaveTextContent('Retiro');
    expect(within(card).getByRole('link', { name: '987654321' })).toHaveAttribute('href', 'tel:987654321');
  });

  it('marca Revisar devolución solo en los cancelados que ya estaban pagados', () => {
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar alActualizar={() => {}} />);

    expect(screen.getByTestId('revisar-devolucion-CP-NO')).toHaveTextContent('Revisar devolución');
    expect(screen.queryByTestId('revisar-devolucion-CP-SR')).not.toBeInTheDocument();
  });

  it('el botón Reprogramar / Reenviar a reparto solo aparece en los que dijeron que sí', () => {
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar alActualizar={() => {}} />);

    const botones = screen.getAllByRole('button', { name: 'Reprogramar / Reenviar a reparto' });
    expect(botones).toHaveLength(1);
    expect(within(screen.getByTestId('no-entregado-CP-SI')).getByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).toBeInTheDocument();
    expect(within(screen.getByTestId('no-entregado-CP-ESP')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('sin permiso repartos/liquidar no aparece ningún botón de reenvío', () => {
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar={false} alActualizar={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).not.toBeInTheDocument();
  });

  it('el botón pide confirmación Sí/No y solo al confirmar llama al reenvío y refresca', async () => {
    const alActualizar = vi.fn();
    render(<PanelNoEntregados datos={datos} cargando={false} error="" puedeLiquidar alActualizar={alActualizar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto' }));
    expect(screen.getByText('¿Reenviar este pedido a reparto?')).toBeInTheDocument();
    expect(repartosApi.reprogramarPedido).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(repartosApi.reprogramarPedido).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() => expect(repartosApi.reprogramarPedido).toHaveBeenCalledWith('2'));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('muestra estados vacíos en cada grupo cuando no hay pedidos', () => {
    render(
      <PanelNoEntregados
        datos={{ reprogramar: [], cancelados: [], total: 0 }}
        cargando={false}
        error=""
        puedeLiquidar
        alActualizar={() => {}}
      />,
    );

    expect(screen.getByText('No hay pedidos por reprogramar.')).toBeInTheDocument();
    expect(screen.getByText('No hay cancelados por no recibir.')).toBeInTheDocument();
  });

  it('muestra el error de carga en lugar de los grupos', () => {
    render(<PanelNoEntregados datos={null} cargando={false} error="Sin conexión" puedeLiquidar alActualizar={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
  });
});
