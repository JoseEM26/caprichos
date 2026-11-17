import { describe, it, expect, vi } from 'vitest';
sessionStorage.setItem('caprichos.nombreInvitado', 'Invitado'); // el invitado ya dijo su nombre (si no, la carta lo pide primero)
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


describe('Dúo en celular', () => {
  it('con la parte de bebidas marcada: un paso por bebida y el nombre del vaso en su paso; Agregar llega desde el resumen', () => {
    abrir(producto(), duo(true));
    expect(screen.queryByText(/Arma tu combo/)).toBeNull();
    expect(screen.queryByText(/Elige 2 opciones/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Elige tu bebida 1');
    fireEvent.click(screen.getAllByRole('button', { name: /ICED COFFE/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /CAPUCCINO/ })[0]);
    // llega al paso de nombres sin nombres: «Siguiente» dice cuál falta
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Nombres para el vaso');
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Escribe el nombre del vaso de la Bebida 1');
    nombrarVasos();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // nota
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // resumen
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(agregarLinea).toHaveBeenCalledTimes(1);
  });

  it('el campo de nombre del vaso aparece con el motivo aunque el combo use grupos «Bebida N · Sabor» (antes desaparecía)', () => {
    abrir(producto(), null);
    expect(screen.getByTestId('nombre-envase')).toHaveTextContent(/Obligatorio: el nombre de cada vaso/);
    expect(screen.getAllByLabelText(/Nombre para el envase/)).toHaveLength(2);
  });

  it('el nombre aparece también con la parte de bebidas en pasos (en su paso, con una etiqueta por vaso)', () => {
    abrir(producto(), duo(true));
    fireEvent.click(screen.getAllByRole('button', { name: /ICED COFFE/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /CAPUCCINO/ })[0]);
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

  it('sin bandera (API vieja) el paso dice cuál contador falta y «Siguiente» lo explica', () => {
    abrir(producto([]), duo(false));
    // primero el complemento (sus lugares), luego los grupos viejos «Bebida N · Sabor» como pasos propios
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Complemento');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Elige 2 lugar(es) más');
    expect(screen.getByRole('button', { name: /Paso 2: Bebida 1/ })).toBeDisabled();
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
