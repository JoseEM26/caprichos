import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { etiquetaMesa } from '../InsigniaMesa';
import type { Pedido } from '../pedidosApi';

const base = {
  id: '1', codigo: 'CP-0001', canal: 'CARTA', modalidad: 'MESA', estado: 'COLA', total: 25,
  cliente_nombre: 'Lucía Pérez', pago_estado: 'PENDIENTE', creado_en: '2026-11-07T15:00:00Z',
  lineas: [{ cantidad: 2, nombre: 'Carrot cake' }],
} as unknown as Pedido;

const pintar = (p: Partial<Pedido>) =>
  render(
    <TarjetaPedidoCaja pedido={{ ...base, ...p } as Pedido} seleccionado={false} resaltado={false}
      cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} ahora={Date.parse('2026-11-07T15:12:00Z')} />,
  );

describe('mesa siempre visible en la tarjeta', () => {
  it('nombre muy largo y «Mesa 12 - Terraza»: insignia propia completa; el nombre sí se acorta', () => {
    const largo = 'María de los Ángeles Fernández de la Cruz y Sotomayor Villanueva';
    pintar({ mesa_nombre: 'Mesa 12 - Terraza', cliente_nombre: largo });
    const ins = screen.getByTestId('insignia-mesa');
    expect(ins).toHaveTextContent('MESA 12');
    expect(ins).toHaveTextContent('TERRAZA');
    expect(ins.querySelector('.ins-mesa-num')).toHaveTextContent(/^MESA 12$/);
    expect(ins.className).not.toMatch(/clamp|ellipsis/);
    const h = screen.getByRole('heading');
    expect(h).toHaveTextContent(largo);
    expect(h).not.toHaveTextContent('MESA');
    expect(h).toHaveAttribute('title', largo);
    expect(screen.getByRole('button', { name: new RegExp(`MESA 12 - TERRAZA.*${largo}`) })).toBeInTheDocument();
  });

  it('mesas unidas: se muestran todas', () => {
    pintar({ mesa_nombre: 'Mesa 4 + 5 + 6' });
    const ins = screen.getByTestId('insignia-mesa');
    expect(ins).toHaveTextContent('MESA 4');
    expect(ins).toHaveTextContent('+ 5 + 6');
  });

  it('«En espera de mesa» visible completo', () => {
    pintar({ modalidad: 'COMER_LOCAL', mesa_nombre: 'En espera de mesa' });
    expect(screen.getByTestId('insignia-mesa')).toHaveTextContent('EN ESPERA DE MESA');
  });

  it('pedidos sin mesa no renderizan el bloque', () => {
    pintar({ modalidad: 'DELIVERY', mesa_nombre: null });
    expect(screen.queryByTestId('insignia-mesa')).toBeNull();
  });

  it('etiquetaMesa separa número y resto', () => {
    expect(etiquetaMesa('4')).toMatchObject({ principal: 'MESA 4', resto: null });
    expect(etiquetaMesa('Mesa 12 - Terraza')).toMatchObject({ principal: 'MESA 12', resto: 'TERRAZA' });
  });
});
