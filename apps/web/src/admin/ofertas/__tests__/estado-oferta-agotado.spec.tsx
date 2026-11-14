import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OfertasAdminView } from '../OfertasAdminView';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));

const combo = {
  id: '1', tipo: 'COMBO', nombre: 'Combo Nuggets', activo: true, orden: 1, canales: ['CARTA', 'ADMIN'],
  combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Regular', precio: 33 }],
  combosParte: [{ id: '1', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], alternativas: [{ id: '6', nombre: 'Alitas', cantidad: 1, disponible: false }] }],
};

function montar(lista: unknown[]) {
  (api.get as any).mockImplementation((url: string) => (url === '/admin/ofertas' ? Promise.resolve(lista) : Promise.resolve([])));
  render(<OfertasAdminView />);
}

describe('estado de una oferta: agotada sola o desactivada por ti', () => {
  it('sin stock y activa: «Agotado automáticamente · vuelve sola», con motivo y alternativas', async () => {
    montar([{ ...combo, disponible: false, motivoAgotado: 'Falta NUGGETS y las bebidas a elegir' }]);
    const chip = await screen.findByTestId('insignia-agotado-auto');
    expect(chip.textContent).toBe('Agotado automáticamente · vuelve sola cuando haya stock');
    expect(chip.getAttribute('aria-label')).toMatch(/Vuelve sola cuando haya stock/);
    expect(screen.getByTestId('motivo-agotado').textContent).toBe('falta NUGGETS y las bebidas a elegir · hay alternativas configuradas');
    expect(screen.queryByTestId('insignia-desactivada-manual')).toBeNull();
  });

  it('con stock y activa: no muestra ningún aviso (volvió sola)', async () => {
    montar([{ ...combo, disponible: true }]);
    await screen.findByText('Combo Nuggets');
    expect(screen.queryByTestId('insignia-agotado-auto')).toBeNull();
    expect(screen.queryByTestId('insignia-desactivada-manual')).toBeNull();
  });

  it('desactivada a mano: «Desactivada por ti · no vuelve sola», con última vez, y sigue pudiendo Activar', async () => {
    montar([{ ...combo, activo: false, visibleCarta: true, disponible: true, desactivadaEn: '2026-11-01T19:30:00.000Z', desactivadaPor: 'Ana Ruiz' }]);
    const chip = await screen.findByTestId('insignia-desactivada-manual');
    expect(chip.textContent).toBe('Desactivada por ti · no vuelve sola');
    expect(screen.getByTestId('ultima-desactivacion').textContent).toBe('Última vez desactivada: 01/11/2026 14:30 por Ana Ruiz');
    expect(screen.getByRole('button', { name: 'Activar' })).toBeEnabled();
    expect(screen.queryByTestId('insignia-agotado-auto')).toBeNull();
    expect(screen.queryByTestId('nota-falta-stock')).toBeNull();
  });

  it('desactivada a mano y además sin stock: manda «Desactivada por ti» y el stock es una nota', async () => {
    montar([{ ...combo, activo: false, visibleCarta: true, disponible: false, motivoAgotado: 'Falta NUGGETS' }]);
    expect(await screen.findByTestId('insignia-desactivada-manual')).toBeTruthy();
    expect(screen.getByTestId('nota-falta-stock').textContent).toBe('además hoy le falta stock');
    expect(screen.queryByTestId('insignia-agotado-auto')).toBeNull();
  });
});

describe('piezas bloqueadas (solo panel)', () => {
  it('la tarjeta lista cada pieza con su motivo y enlace a Productos', async () => {
    montar([{ ...combo, disponible: false, motivoAgotado: 'Falta NUGGETS', piezasBloqueadas: [{ productoId: '5', nombre: 'NUGGETS', motivo: 'Agotado hasta 15:40' }, { productoId: '6', nombre: 'PAPAS', motivo: 'Stock 0' }] }]);
    const aviso = await screen.findByTestId('piezas-bloqueadas');
    expect(aviso.textContent).toContain('NUGGETS · Agotado hasta 15:40');
    expect(aviso.textContent).toContain('PAPAS · Stock 0');
    expect(aviso.querySelector('a')?.getAttribute('href')).toBe('/admin/productos');
  });
});

describe('tarjeta del combo: piezas a elección con sus opciones', () => {
  it('lista los nombres de las opciones y marca las agotadas', async () => {
    const parte = { id: '2', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['1', '2', '3'], alternativas: [], opcionesDetalle: [
      { id: '1', nombre: 'Burbujas', disponible: false, sinStock: true },
      { id: '2', nombre: 'Pistola de burbujas', disponible: true },
      { id: '3', nombre: 'Squishy', disponible: true },
    ] };
    (api.get as any).mockImplementation((url: string) => (url === '/admin/ofertas' ? Promise.resolve([{ ...combo, disponible: true, combosParte: [parte] }]) : Promise.resolve([])));
    render(<OfertasAdminView />);
    expect(await screen.findByText(/2 × producto a elección: Burbujas \(agotado\), Pistola de burbujas, Squishy/)).toBeTruthy();
  });
});
