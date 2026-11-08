import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { GrupoOpcionesCarta, ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
const botonAgregar = () => screen.getByRole('button', { name: /Agregar al pedido|Falta elegir|Elige las opciones obligatorias/ });
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const grupo = (id: string, nombre: string, obligatorio: boolean, opciones: string[]): GrupoOpcionesCarta => ({
  id, nombre, obligatorio, minimo: obligatorio ? 1 : 0, maximo: 1,
  opciones: opciones.map((n, i) => ({ id: `${id}-${i}`, nombre: n, precioExtra: 0, disponible: true })),
});

/** Anfitrión del Dúo: los grupos «Bebida N · Sabor» son del producto viejo (6 bebidas fijas); «Endulzante» es una pregunta aparte. */
const producto: ProductoCarta = {
  id: '19', nombre: 'COMBO DUO', descripcion: null, fotoUrl: null, precio: 30, tamanos: [],
  grupos: [
    grupo('g1', 'Bebida 1 · Sabor', true, ['LATTE COFFE', 'ICED CHOCOLATE']),
    grupo('g2', 'Bebida 2 · Sabor', true, ['LATTE COFFE', 'ICED CHOCOLATE']),
    grupo('g3', 'Complemento · Extra', false, ['Con crema']),
    grupo('g4', 'Endulzante · Tipo', true, ['Azúcar', 'Stevia']),
  ],
  sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

const parte = (id: string, cantidad: number, extra: object = {}) => ({
  id, tipo: 'A_ELECCION', cantidad, categorias: [], productos: [], alternativas: [], disponible: true, ...extra,
});
const op = (id: string, nombre: string, extra: object = {}) => ({ id, nombre, disponible: true, ...extra });

const duo = (): OfertaItem =>
  ({
    id: '4', tipo: 'COMBO', nombre: 'Combo Dúo Para Compartir', descripcion: null, lleva: null, paga: null,
    alcanceCategoriaId: null, alcanceProductoId: '19', descuentoTipo: null, descuentoValor: null, compraMinima: null,
    dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'],
    limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible: true,
    combosParte: [
      parte('1', 2, {
        categorias: ['4', '6', '1'],
        bebidas: true,
        opcionesDetalle: [op('101', 'FRAPPE OREO', { fotoUrl: '/a.jpg' }), op('102', 'ICED COFFE'), op('103', 'CAPUCCINO'), op('104', 'CAFE AGOTADO', { disponible: false })],
      }),
      parte('2', 2, { productos: ['17'], paqueteGrupo: 'Complemento', paqueteNombre: '2 donas artesanales', opcionesDetalle: [op('17', 'DONA')] }),
      parte('3', 2, { productos: ['37'], paqueteGrupo: 'Complemento', paqueteNombre: '2 galleta chocochips', opcionesDetalle: [op('37', 'GALLETA')] }),
    ],
  }) as unknown as OfertaItem;

const abrir = () => render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
const paso = (n: number) => within(screen.getByRole('group', { name: `Bebida ${n}` }));

describe('Combo Dúo con bebidas por categoría', () => {
  it('muestra «Bebida 1» y «Bebida 2» con las bebidas de las categorías y oculta los grupos «Bebida N · Sabor» del anfitrión', () => {
    abrir();
    expect(screen.getByRole('group', { name: 'Bebida 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bebida 2' })).toBeInTheDocument();
    // Las bebidas del editor (Frappes + Iced + Calientes), no las 6 fijas del producto viejo
    expect(paso(1).getByRole('button', { name: /FRAPPE OREO/ })).toBeInTheDocument();
    expect(paso(1).queryByRole('button', { name: /LATTE COFFE/ })).toBeNull();
    expect(paso(1).getByRole('button', { name: /CAFE AGOTADO/ })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 2' })).getAllByRole('button')[0]); // abrir la tarjeta de la bebida 2
    expect(paso(2).getByRole('button', { name: /CAPUCCINO/ })).toBeInTheDocument();
    // Los grupos duplicados no salen; las otras preguntas del anfitrión se mantienen
    expect(screen.queryByText('Bebida 1 · Sabor')).toBeNull();
    expect(screen.queryAllByText('Sabor')).toHaveLength(0);
    expect(screen.getByText('Endulzante')).toBeInTheDocument();
  });

  it('conserva el complemento con paquetes y exige elegir las 2 bebidas, el complemento y el endulzante', () => {
    agregarLinea.mockClear();
    abrir();
    expect(screen.getByText('Elige tu complemento')).toBeInTheDocument();
    expect(botonAgregar()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '2 donas artesanales' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar DONA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar DONA' }));
    expect(botonAgregar()).toBeDisabled(); // faltan las bebidas

    fireEvent.click(paso(1).getByRole('button', { name: /FRAPPE OREO/ }));
    expect(botonAgregar()).toBeDisabled();
    fireEvent.click(paso(2).getByRole('button', { name: /CAPUCCINO/ }));
    expect(botonAgregar()).toBeEnabled();

    fireEvent.click(botonAgregar());
    const linea = agregarLinea.mock.calls[0][0];
    expect(linea.ofertaId).toBe('4');
    expect(linea.comboElecciones).toEqual([
      { parteId: '1', productoId: '101' },
      { parteId: '1', productoId: '103' },
      { parteId: '2', productoId: '17' },
      { parteId: '2', productoId: '17' },
    ]);
    // sin precio extra y solo viajan las opciones de los grupos visibles
    expect(linea.precioUnitario).toBe(30);
    expect(linea.opciones.map((o: { nombre: string }) => o.nombre)).toContain('Azúcar');
    expect(linea.opciones.some((o: { grupoNombre: string }) => o.grupoNombre.startsWith('Bebida'))).toBe(false);
  });

  it('permite la misma bebida en los dos pasos', () => {
    agregarLinea.mockClear();
    abrir();
    fireEvent.click(screen.getByRole('radio', { name: '2 donas artesanales' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar DONA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar DONA' }));
    fireEvent.click(paso(1).getByRole('button', { name: /ICED COFFE/ }));
    fireEvent.click(paso(2).getByRole('button', { name: /^ICED COFFE$/ }));
    fireEvent.click(botonAgregar());
    expect(agregarLinea.mock.calls[0][0].comboElecciones.filter((e: { parteId: string }) => e.parteId === '1')).toEqual([
      { parteId: '1', productoId: '102' },
      { parteId: '1', productoId: '102' },
    ]);
  });
});
