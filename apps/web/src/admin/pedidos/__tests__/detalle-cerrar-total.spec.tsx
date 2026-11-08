import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { VentanaDetalle } from '../VentanaDetalle';
import type { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));
vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => false } as any);
  vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);
});

const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'p-1', codigo: 'CP-W100', canal: 'MOZO', modalidad: 'MESA', mesa_nombre: 'Mesa 3',
    cliente_nombre: 'Nombre de cliente larguísimo que no debe empujar el precio debajo de la X de cierre',
    estado: 'PREPARANDO', pago_estado: 'PENDIENTE', creado_en: '2026-11-08T20:00:00.000Z', minutosEspera: 12,
    subtotal: 40, descuento: 0, total: 40, lineas: [], eventos: [], ...extra,
  }) as unknown as Pedido;

const pintar = (p: Pedido) =>
  render(
    <MemoryRouter>
      <VentanaDetalle titulo="Detalle del pedido CP-W100" alCerrar={vi.fn()}>
        <PedidoDetalle pedido={p} alActualizar={vi.fn()} />
      </VentanaDetalle>
    </MemoryRouter>,
  );

describe('Cabecera del detalle: la X no tapa el total', () => {
  it('hay un solo botón de cerrar accesible y el total está en la cabecera, en otra celda', () => {
    const container = document.body;
    pintar(pedido());
    expect(screen.getAllByRole('button', { name: /^Cerrar detalle/ })).toHaveLength(1);
    const x = screen.getByRole('button', { name: 'Cerrar detalle del pedido' });
    const total = container.querySelector('.dp-total-cab')!;
    expect(total).toHaveTextContent('S/ 40.00');
    expect(total.closest('.dp-cab')).not.toBeNull();
    expect(x.contains(total) || total.contains(x)).toBe(false);
    expect(total.parentElement).toHaveClass('dp-cab-fila');
  });

  it('el total sigue en la cabecera con muchos chips', () => {
    const container = document.body;
    pintar(pedido({ pedido_origen: { codigo: 'CP-001' }, numero_dia: 7 }));
    expect(container.querySelector('.dp-cab > .dp-cab-fila > .dp-total-cab')).not.toBeNull();
    expect(container.querySelector('.dp-cab > .dp-chips')).not.toBeNull();
  });

  it('CSS: la cabecera reserva espacio a la derecha para la X y el total no se encoge', () => {
    const vd = readFileSync(resolve(__dirname, '../ventana-detalle.css'), 'utf8');
    const dp = readFileSync(resolve(__dirname, '../detalle-pedido.css'), 'utf8');
    expect(vd).toMatch(/\.vd-cuerpo \.dp-cab\s*\{[^}]*padding-right:\s*68px/);
    expect(dp).toMatch(/\.dp-cab-fila > \.dp-total-cab\s*\{\s*flex:\s*none/);
  });
});
