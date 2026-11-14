import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { GrupoOpcionesCarta, ProductoCarta } from '../tipos';
import { nombrarVasos } from './nombrarVasos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const grupo = (id: string, nombre: string, opciones: string[], minimo = 1): GrupoOpcionesCarta => ({
  id, nombre, obligatorio: minimo > 0, minimo, maximo: 1,
  opciones: opciones.map((n, i) => ({ id: `${id}-${i}`, nombre: n, precioExtra: 0, disponible: true })),
});

const bebidas = ['ICED COFFE', 'LATTE COFFE (cappuccino frío - líquido)', 'CAPUCCINO'];

/** El Dúo real: grupos viejos «Bebida N · Sabor» en el producto Y una parte A_ELECCION con la lista de bebidas en el combo. */
const producto = (extra: GrupoOpcionesCarta[] = []): ProductoCarta => ({
  id: '19', nombre: 'Dúo Irresistible', descripcion: null, fotoUrl: null, precio: 37, tamanos: [],
  grupos: [grupo('g1', 'Bebida 1 · Sabor', bebidas), grupo('g2', 'Bebida 2 · Sabor', bebidas), ...extra],
  sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
});

const op = (id: string, nombre: string) => ({ id, nombre, disponible: true });
const duo = (conBandera: boolean): OfertaItem =>
  ({
    id: '4', tipo: 'COMBO', nombre: 'Dúo', descripcion: null, alcanceProductoId: '19', canales: ['CARTA'], activo: true, disponible: true,
    combosParte: [
      {
        id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['101', '102', '103'], alternativas: [], disponible: true,
        ...(conBandera ? { bebidas: true } : {}),
        opcionesDetalle: [op('101', 'ICED COFFE'), op('102', 'LATTE COFFE'), op('103', 'CAPUCCINO')],
      },
    ],
  }) as unknown as OfertaItem;

const abrir = (p: ProductoCarta, o: OfertaItem | null, movil = true) =>
  render(<VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} oferta={o} esMovilPreview={movil} />);

const botonAgregar = () => Array.from(screen.getByTestId('barra-agregar').querySelectorAll('button')).at(-1) as HTMLButtonElement;

describe('Dúo en celular', () => {
  it('con la parte de bebidas marcada no hay doble interfaz: solo los pasos «Bebida N» y el botón se habilita al completarlos', () => {
    abrir(producto(), duo(true));
    expect(screen.queryByText(/Arma tu combo/)).toBeNull();
    expect(screen.queryByText(/Elige 2 opciones/)).toBeNull();
    expect(botonAgregar().disabled).toBe(true);
    expect(botonAgregar().textContent).toMatch(/Falta elegir: Bebida 1 · Bebida 2/);
    fireEvent.click(screen.getAllByRole('button', { name: /ICED COFFE/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /CAPUCCINO/ })[0]);
    expect(botonAgregar().disabled).toBe(false);
    // sin nombres de vaso no agrega y dice cuál falta
    fireEvent.click(botonAgregar());
    expect(agregarLinea).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del vaso de la Bebida 1');
    nombrarVasos();
    fireEvent.click(botonAgregar());
    expect(agregarLinea).toHaveBeenCalledTimes(1);
  });

  it('el campo de nombre del vaso aparece con el motivo aunque el combo use grupos «Bebida N · Sabor» (antes desaparecía)', () => {
    abrir(producto(), null);
    expect(screen.getByTestId('nombre-envase')).toHaveTextContent(/Obligatorio: el nombre de cada vaso/);
    expect(screen.getAllByLabelText(/Nombre para el envase/)).toHaveLength(2);
  });

  it('el nombre aparece también con la parte de bebidas en pasos', () => {
    abrir(producto(), duo(true));
    expect(screen.getAllByLabelText(/Nombre para el envase/)).toHaveLength(2);
  });

  it('un grupo suelto del anfitrión se titula con su nombre, nunca con su id («8»)', () => {
    abrir(producto([grupo('8', 'Papas', ['Fritas', 'Nativas'], 0)]), null);
    expect(screen.queryByText(/^8$/)).toBeNull();
    expect(screen.getAllByText('Papas').length).toBeGreaterThan(0);
  });

  it('un nombre de grupo numérico o vacío se muestra como «Complemento»', () => {
    abrir(producto([grupo('8', '8', ['Fritas', 'Nativas'], 0)]), null);
    expect(screen.queryByText(/^8$/)).toBeNull();
    expect(screen.getAllByText('Complemento').length).toBeGreaterThan(0);
  });

  it('sin bandera (API vieja) el botón dice cuál contador falta y «Ver qué falta» está disponible', () => {
    abrir(producto([]), duo(false));
    expect(screen.getByTestId('barra-agregar')).toHaveTextContent(/Falta elegir: .*Elige 2 opción\(es\)/);
    expect(screen.getByRole('button', { name: /Ver qué falta/ })).toBeInTheDocument();
  });

  it('en celular la ventana es una hoja con cabecera y barra fijas; en PC conserva la ventana centrada', () => {
    const { unmount } = abrir(producto(), duo(true));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-movil', 'si');
    expect(screen.getByTestId('cabecera-ventana')).toHaveTextContent('Dúo Irresistible');
    expect(screen.getByTestId('cuerpo-ventana')).toBeInTheDocument();
    expect(screen.getByTestId('barra-agregar')).toBeInTheDocument();
    expect(screen.getByRole('dialog').style.height).toBe('95%');
    unmount();
    abrir(producto(), duo(true), false);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-movil', 'no');
    expect(screen.queryByTestId('cabecera-ventana')).toBeNull();
    expect(screen.getByRole('dialog').style.left).toBe('50%');
  });
});
