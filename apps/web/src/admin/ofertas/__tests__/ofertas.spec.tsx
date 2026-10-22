import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfertasAdminView } from '../OfertasAdminView';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockOfertas = [
  {
    id: '1',
    tipo: 'COMBO',
    nombre: 'Combo Dúo Para Compartir',
    descripcion: '2 bebidas a elección',
    activo: true,
    orden: 1,
    combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Regular', precio: 33 }],
    combosParte: [{ id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: ['2'] }],
  },
  {
    id: '2',
    tipo: 'DESCUENTO_AUTOMATICO',
    nombre: 'Martes de Waffles 10% OFF',
    descripcion: '10 % de descuento',
    aplicaA: 'CATEGORIA',
    activo: true,
    orden: 2,
    descuentoTipo: 'PORCENTAJE',
    descuentoValor: 10,
    dias: [2],
    combosPrecio: [],
    combosParte: [],
  },
];

const mockCupones = [
  {
    id: '1',
    modo: 'COMPARTIDO',
    codigoBase: 'BIENVENIDO5',
    descripcion: 'Descuento de S/ 5',
    descuentoTipo: 'MONTO',
    descuentoValor: 5,
    activo: true,
    orden: 1,
  },
  {
    id: '2',
    modo: 'UNICO_COMPROBANTE',
    codigoBase: 'VUELVE15',
    descripcion: '15 % en tu próxima visita',
    descuentoTipo: 'PORCENTAJE',
    descuentoValor: 15,
    activo: true,
    orden: 2,
  },
];

const mockReglas = {
  id: 1,
  cuponConDescuento: false,
  promoConDescuento: false,
  cuponesPorComprobante: 2,
  diasValidezCupon: 15,
  textoPie: 'Cupones válidos por 15 días.',
};

describe('OfertasAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/ofertas') return Promise.resolve(mockOfertas);
      if (url === '/admin/cupones') return Promise.resolve(mockCupones);
      if (url === '/admin/cupones/emitidos') return Promise.resolve([]);
      if (url === '/admin/ofertas/reglas') return Promise.resolve(mockReglas);
      if (url === '/admin/catalogo/productos') return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it('renderiza pestañas principales (Promociones, Descuentos, Cupones, Reglas)', async () => {
    render(<OfertasAdminView />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Promociones/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Descuentos/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Cupones/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Reglas/i })).toBeInTheDocument();
    });
  });

  it('muestra las promociones combo en la pestaña activa', async () => {
    render(<OfertasAdminView />);

    await waitFor(() => {
      expect(screen.getByText('Combo Dúo Para Compartir')).toBeInTheDocument();
    });
  });

  it('cambia a la pestaña de Descuentos al hacer clic', async () => {
    render(<OfertasAdminView />);

    const tabDescuentos = await screen.findByRole('tab', { name: /Descuentos/i });
    fireEvent.click(tabDescuentos);

    await waitFor(() => {
      expect(screen.getByText('Martes de Waffles 10% OFF')).toBeInTheDocument();
    });
  });

  it('cambia a la pestaña de Cupones y muestra cupones y vista previa de comprobante', async () => {
    render(<OfertasAdminView />);

    const tabCupones = await screen.findByRole('tab', { name: /Cupones/i });
    fireEvent.click(tabCupones);

    await waitFor(() => {
      expect(screen.getByText('BIENVENIDO5')).toBeInTheDocument();
      expect(screen.getByText('VUELVE15')).toBeInTheDocument();
      expect(screen.getByText(/ASÍ SALE EL COMPROBANTE/i)).toBeInTheDocument();
    });
  });

  it('cambia a la pestaña de Reglas de acumulación y muestra las opciones', async () => {
    render(<OfertasAdminView />);

    const tabReglas = await screen.findByRole('tab', { name: /Reglas/i });
    fireEvent.click(tabReglas);

    await waitFor(() => {
      expect(
        screen.getByText(/¿Se pueden juntar una promoción, un descuento automático y un cupón\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Cupones por comprobante'),
      ).toBeInTheDocument();
    });
  });
});
