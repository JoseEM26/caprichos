import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('el selector de producto de Nuevo descuento no ofrece el producto de un combo', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/ofertas') {
        return Promise.resolve([
          ...mockOfertas,
          { id: '3', tipo: 'COMBO', nombre: 'Combo Frappé Dúo', activo: true, orden: 3, alcanceProductoId: '10', combosPrecio: [], combosParte: [] },
        ]);
      }
      if (url === '/carta') {
        return Promise.resolve([
          {
            id: 1,
            nombre: 'Frappés',
            productos: [
              { id: 10, nombre: 'Frappé Combo Base', precio: 12, noSumaBeneficios: false },
              { id: 20, nombre: 'Frappé Normal', precio: 9, noSumaBeneficios: false },
            ],
          },
        ]);
      }
      if (url === '/admin/cupones') return Promise.resolve(mockCupones);
      if (url === '/admin/cupones/emitidos') return Promise.resolve([]);
      if (url === '/admin/ofertas/reglas') return Promise.resolve(mockReglas);
      return Promise.resolve([]);
    });

    render(<OfertasAdminView />);

    fireEvent.click(await screen.findByRole('tab', { name: /Descuentos/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo descuento/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Un producto' }));
    fireEvent.click(await screen.findByRole('button', { name: /PRODUCTO: Elige un producto/i }));

    expect(await screen.findByText('Frappé Normal')).toBeInTheDocument();
    expect(screen.queryByText('Frappé Combo Base')).not.toBeInTheDocument();
  });
  it('desactivar pregunta cómo se ve en la carta y manda la elección junto con activo', async () => {
    (api.patch as any).mockResolvedValue({});
    render(<OfertasAdminView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('¿Cómo quieres que se vea en la carta mientras esté desactivada?')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Ocultar de la carta (recomendado)')).toBeChecked();

    fireEvent.click(within(dialogo).getByLabelText('Mostrar como No disponible'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/ofertas/1/estado', { activo: false, visibleCarta: true }),
    );
  });

  it('la tarjeta dice dónde se ve cada desactivada y cambia la visibilidad con el interruptor', async () => {
    const lista = [
      { ...mockOfertas[0], id: '1', activo: false, visibleCarta: false },
      { ...mockOfertas[0], id: '3', nombre: 'Combo Frappé Dúo', activo: false, visibleCarta: true },
    ];
    (api.get as any).mockImplementation((url: string) => (url === '/admin/ofertas' ? Promise.resolve(lista) : Promise.resolve([])));
    (api.patch as any).mockResolvedValue({});
    render(<OfertasAdminView />);

    expect(await screen.findByLabelText('Desactivada: oculta en la carta')).toHaveTextContent('Desactivada');
    expect(screen.getByLabelText('Desactivada: se ve como No disponible')).toHaveTextContent('Desactivada');

    fireEvent.click(screen.getAllByRole('button', { name: /^Más acciones de/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mostrar como No disponible' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/ofertas/1/estado', { activo: false, visibleCarta: true }),
    );
  });
  it('una oferta desactivada no añade bloques: la insignia es inline de una línea y conserva sus botones', async () => {
    const lista = [{ ...mockOfertas[0], id: '1', activo: false, visibleCarta: false }];
    (api.get as any).mockImplementation((url: string) => (url === '/admin/ofertas' ? Promise.resolve(lista) : Promise.resolve([])));
    render(<OfertasAdminView />);

    const insignia = await screen.findByLabelText('Desactivada: oculta en la carta');
    expect(insignia.tagName).toBe('SPAN');
    expect(insignia.className).toContain('oferta-estado');
    expect(insignia.textContent).toBe('Desactivada');
    expect(insignia.children.length).toBe(0);
    const tarjeta = insignia.closest('.oferta-card') as HTMLElement;
    expect(tarjeta.className).toContain('oferta-card--off');
    const acciones = tarjeta.querySelector('.oferta-acciones') as HTMLElement;
    expect(within(acciones).getByRole('button', { name: 'Activar' })).toBeEnabled();
    expect(within(acciones).getByRole('button', { name: 'Editar' })).toBeEnabled();
    expect(within(acciones).queryByRole('button', { name: 'Mostrar como No disponible' })).toBeNull();
  });

  it('el menú ⋯ pone las mismas acciones principales en tarjetas activas y desactivadas, y se maneja con teclado', async () => {
    const lista = [
      { ...mockOfertas[0], id: '1', nombre: 'Combo A', activo: true },
      { ...mockOfertas[0], id: '3', nombre: 'Combo B', activo: false, visibleCarta: false },
    ];
    (api.get as any).mockImplementation((url: string) => (url === '/admin/ofertas' ? Promise.resolve(lista) : Promise.resolve([])));
    render(<OfertasAdminView />);

    const filas = (await screen.findAllByRole('button', { name: /^Más acciones de/ })).map((b) => b.closest('.oferta-acciones') as HTMLElement);
    expect(filas).toHaveLength(2);
    const nombres = filas.map((f) => Array.from(f.children).map((c) => c.textContent));
    expect(nombres[0]).toEqual(['Editar', 'Desactivar', '⋯']);
    expect(nombres[1]).toEqual(['Editar', 'Activar', '⋯']);

    // Teclado: ↓ abre y enfoca el primero; ↓ avanza; Esc cierra y devuelve el foco al botón
    const boton = screen.getByRole('button', { name: 'Más acciones de Combo B' });
    expect(boton).toHaveAttribute('aria-haspopup', 'menu');
    boton.focus();
    fireEvent.keyDown(boton, { key: 'ArrowDown' });
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Ver cómo se ve en la carta', 'Mostrar como No disponible']);
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(boton).toHaveFocus();

    // La tarjeta activa solo ofrece «Ver cómo se ve», sin Ocultar/Mostrar
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de Combo A' }));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Ver cómo se ve en la carta']);
  });
});
