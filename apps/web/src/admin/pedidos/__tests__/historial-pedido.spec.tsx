import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { HistorialPedidoModal } from '../HistorialPedidoModal';
import { Pedido } from '../pedidosApi';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));

let permisos: string[] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  permisos = [];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p), usuario: { rol: 'CAJERO' } } as any);
});

const pedido = { id: 'ped-9', codigo: 'CP-W009', canal: 'CARTA', modalidad: 'RECOGER', cliente_nombre: 'Ana', estado: 'COLA', pago_estado: 'PENDIENTE',
  creado_en: '2026-11-02T20:00:00.000Z', subtotal: 30, descuento: 0, total: 30, comprobante_tipo: 'NOTA_VENTA', lineas: [] } as unknown as Pedido;
const montar = () => render(<MemoryRouter><PedidoDetalle pedido={pedido} alActualizar={vi.fn()} cajaAbierta /></MemoryRouter>);

describe('Historial del pedido', () => {
  it('el botón no aparece sin el permiso (cajero, mozo...)', () => {
    montar();
    expect(screen.queryByRole('button', { name: 'Historial del pedido' })).toBeNull();
  });

  it('el botón aparece con el permiso de ADMIN/SUPERVISOR', () => {
    permisos.push('caja/auditoria_pedido');
    montar();
    expect(screen.getByRole('button', { name: 'Historial del pedido' })).toBeTruthy();
  });

  it('muestra la línea de tiempo con quién, qué, cuándo (Lima), motivo y detalle', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      pedidoId: '9', truncado: false,
      eventos: [
        { id: 'c1', fuente: 'cobro', titulo: 'Cobró S/ 25.00 con Yape', motivo: null, en: '2026-11-13T15:00:00Z', por: 'Luis Mozo', antes: null, despues: { total: '25' } },
        { id: 'a1', fuente: 'auditoria', titulo: 'Cambió el comprobante a factura', motivo: 'Lo pidió el cliente', en: '2026-11-13T16:00:00Z', por: 'Eva Paz', antes: { tipo: 'BOLETA' }, despues: { tipo: 'FACTURA' } },
      ],
    });
    render(<HistorialPedidoModal pedidoId="9" codigo="CP-W009" alCerrar={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('historial-pedido')).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith('/admin/pedidos/9/historial-caja');
    expect(screen.getByText('Cobró S/ 25.00 con Yape')).toBeTruthy();
    expect(screen.getByText(/Luis Mozo · 13\/11\/2026,? 10:00/)).toBeTruthy();
    expect(screen.getByText('Motivo: Lo pidió el cliente')).toBeTruthy();
    expect(screen.getAllByText('Ver detalle')).toHaveLength(2);
  });
});
