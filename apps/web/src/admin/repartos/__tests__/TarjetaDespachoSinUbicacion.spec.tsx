import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => true, usuario: { rol: 'ADMIN' } }),
}));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: () => null }));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));
vi.mock('../../../comun/mapa/sedeDefecto', () => ({ SEDE_DEFECTO: { lat: 0, lng: 0 }, cargarSede: () => Promise.resolve({ lat: 0, lng: 0 }) }));

import { TarjetaDespacho } from '../DespachoAdmin';

const pedido = (extra: any = {}): any => ({
  id: '77', codigo: 'CP-0077', modalidad: 'DELIVERY', estado: 'LISTO', cliente_nombre: 'Cliente de prueba', cliente_telefono: '900000001',
  direccion: 'Av. Inventada 123', lat: null, lng: null, minutosEspera: 5, total: 30, pago_estado: 'PAGADO',
  repartidor_party_id: null, repartidor: null, seccion: 'LISTOS', etapa: null, ...extra,
});

const pintar = (p: any) =>
  render(
    <TarjetaDespacho d={{ pedido: p, numero: 1, fase: 'porSalir' }} seleccionada={false} repartidores={[{ party_id: '5', nombre: 'Rep Uno' } as any]} puedeAsignar
      alSeleccionar={() => {}} alAbrirDetalle={() => {}} alAsignar={() => {}} />,
  );

describe('Despacho: delivery sin ubicación', () => {
  it('muestra la marca y no deja asignar repartidor hasta ubicarlo', () => {
    pintar(pedido());
    expect(screen.getByTestId('marca-falta-ubicacion').textContent).toContain('Falta ubicación');
    expect(screen.getByTestId('aviso-delivery-sin-ubicacion')).toBeTruthy();
    expect(screen.queryByLabelText(/Asignar repartidor del pedido CP-0077/)).toBeNull();
  });

  it('con ubicación se puede asignar y no hay marca', () => {
    pintar(pedido({ lat: -12.1, lng: -77 }));
    expect(screen.queryByTestId('marca-falta-ubicacion')).toBeNull();
    expect(screen.getByLabelText(/Asignar repartidor del pedido CP-0077/)).toBeTruthy();
  });
});
