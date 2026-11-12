import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../SeccionUbicacionPedido', () => ({ SeccionUbicacionPedido: () => null }));
vi.mock('../SeccionComprobantesPedido', () => ({ SeccionComprobantesPedido: () => null }));
vi.mock('../../mensajes/BotonAbrirChatCliente', () => ({ BotonAbrirChatCliente: () => null }));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: (p: { etiqueta?: string }) => <div>{p.etiqueta}</div> }));

import { CapaEntrega } from '../CapaEntrega';

const base: any = { id: 1, codigo: 'CP-W001', estado: 'LISTO', canal: 'CARTA', cliente_nombre: 'Cliente de prueba', cliente_telefono: null, entrega_direccion: 'Av. Ejemplo 123', envio: 5, historial: [], eventos: [] };
const props = { esDelivery: true, esMesa: false, puedeCorregirCliente: false, alCorregirCliente: vi.fn(), alUbicar: vi.fn(), alActualizar: vi.fn() };

describe('Cliente y entrega: mapa visible sin tocar botones', () => {
  it('con ubicación muestra el mapa ahí mismo', () => {
    render(<CapaEntrega pedido={{ ...base, entrega_lat: '-12.02', entrega_lng: '-76.96' }} {...props} />);
    expect(screen.getByTestId('mapa-entrega-pedido').textContent).toContain('CP-W001');
  });
  it('sin ubicación pide ubicarla y no muestra mapa', () => {
    render(<CapaEntrega pedido={{ ...base, entrega_lat: null, entrega_lng: null }} {...props} />);
    expect(screen.queryByTestId('mapa-entrega-pedido')).toBeNull();
    expect(screen.getByText(/falta la ubicación/)).toBeTruthy();
  });
});
