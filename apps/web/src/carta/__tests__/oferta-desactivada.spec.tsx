import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TarjetaOferta } from '../TarjetaOferta';
import { CartaVistaPrevia } from '../CartaPublica';
import { comboDeProducto } from '../ReemplazoCombo';
import type { OfertaItem } from '../../admin/ofertas/ofertasApi';
import type { VistaPreviaCarta } from '../CartaPublica';

const mockAbrirModal = vi.fn();
vi.mock('../CarritoContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../CarritoContext')>()),
  useCarrito: () => ({ abrirModalProducto: mockAbrirModal, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {}, aplicarCarta: () => {} }),
}));

const combo = (over: Partial<OfertaItem>): OfertaItem =>
  ({
    id: '1',
    tipo: 'COMBO',
    nombre: 'Combo Dúo Para Compartir',
    descripcion: '2 bebidas a elección',
    alcanceProductoId: '10',
    productoNombre: 'DÚO PARA COMPARTIR',
    combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Regular 12 oz', precio: 33 }],
    combosParte: [],
    canales: ['CARTA'],
    dias: [],
    orden: 1,
    activo: true,
    visibleCarta: true,
    vigenteAhora: true,
    creadoEn: '2026-10-22T05:39:18.163Z',
    ...over,
  }) as OfertaItem;

describe('oferta desactivada en la carta', () => {
  it('con visibleCarta true se ve como «No disponible» y no se puede pedir', () => {
    render(<TarjetaOferta oferta={combo({ activo: false, visibleCarta: true })} productos={[]} categorias={[]} />);
    expect(screen.getByTestId('insignia-no-disponible').textContent).toBe('No disponible');
    expect(screen.queryByRole('button', { name: /Personalizar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver oferta Combo/ }));
    expect(mockAbrirModal).not.toHaveBeenCalled();
  });

  it('una activa no lleva la insignia de «No disponible»', () => {
    render(<TarjetaOferta oferta={combo({})} productos={[]} categorias={[]} />);
    expect(screen.queryByTestId('insignia-no-disponible')).toBeNull();
    expect(screen.getByRole('button', { name: /Personalizar/ })).toBeInTheDocument();
  });

  it('la carta no pinta las desactivadas con visibleCarta false y sí las pinta como «No disponible» con true', () => {
    const datos: VistaPreviaCarta = {
      categorias: [],
      ofertas: [
        combo({ id: '1', nombre: 'Activa', activo: true, visibleCarta: true }),
        combo({ id: '2', nombre: 'Oculta', activo: false, visibleCarta: false }),
        combo({ id: '3', nombre: 'Sin pedir', activo: false, visibleCarta: true }),
      ],
      estadoLocal: null,
      datosLocal: null,
      contenido: { decoracion: 'NINGUNO', organizacion: 'SECCIONES', paleta: {}, novedades: [], destacadas: [], rankingMes: [], banner: { activo: false } } as any,
    };
    render(<MemoryRouter><CartaVistaPrevia datos={datos} movil={false} /></MemoryRouter>);
    expect(screen.getByTestId('oferta-1')).toBeTruthy();
    expect(screen.queryByTestId('oferta-2')).toBeNull();
    expect(screen.getByTestId('oferta-3').textContent).toContain('No disponible');
  });

  it('un combo desactivado no se ofrece para armar el producto', () => {
    const ofertas = [combo({ activo: false, visibleCarta: true })];
    expect(comboDeProducto(ofertas, '10')).toBeNull();
    expect(comboDeProducto([combo({ activo: true })], '10')?.id).toBe('1');
  });
});
