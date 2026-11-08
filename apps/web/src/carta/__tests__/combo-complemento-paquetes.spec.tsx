import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';
import { faltaElegirPaquete, filtrarPaquetes, gruposPaquetes } from '../ReemplazoCombo';

const agregarLinea = vi.fn();
const botonAgregar = () => screen.getByRole('button', { name: /Agregar al pedido|Falta elegir|Elige las opciones obligatorias/ });
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '9', nombre: 'DUO COMPARTIR', descripcion: null, fotoUrl: null, precio: 30,
  tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

const parte = (id: string, tipo: 'FIJO' | 'A_ELECCION', cantidad: number, paquete: string, extra: object = {}) => ({
  id, tipo, cantidad, categorias: [], productos: [], alternativas: [], paqueteGrupo: 'Complemento', paqueteNombre: paquete, disponible: true, ...extra,
});

/** Dúo con complemento: 2 donas, 1 dona + 1 galleta o 1 carrot cake (agotado si carrotOk = false). */
const duo = (carrotOk = true): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'DUO COMPARTIR', descripcion: null, lleva: null, paga: null,
    alcanceCategoriaId: null, alcanceProductoId: '9', descuentoTipo: null, descuentoValor: null, compraMinima: null,
    dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'],
    limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible: true,
    combosParte: [
      parte('300', 'A_ELECCION', 2, '2 donas', { opcionesDetalle: [{ id: '40', nombre: 'Dona', disponible: true }] }),
      parte('301', 'A_ELECCION', 1, '1 dona + 1 galleta', { opcionesDetalle: [{ id: '40', nombre: 'Dona', disponible: true }] }),
      parte('302', 'A_ELECCION', 1, '1 dona + 1 galleta', { productos: ['41'], opcionesDetalle: [{ id: '41', nombre: 'Galleta', disponible: true }] }),
      parte('303', 'FIJO', 1, '1 carrot cake', { productos: ['50'], principalNombre: 'Carrot cake', disponible: carrotOk }),
    ],
  }) as unknown as OfertaItem;

describe('Combo con complemento (paquetes)', () => {
  it('agrupa las piezas por alternativa y marca la que no se puede armar', () => {
    const [g] = gruposPaquetes(duo(false));
    expect(g.grupo).toBe('Complemento');
    expect(g.paquetes).toEqual([
      { nombre: '2 donas', disponible: true },
      { nombre: '1 dona + 1 galleta', disponible: true },
      { nombre: '1 carrot cake', disponible: false },
    ]);
  });

  it('filtrarPaquetes deja solo las piezas del paquete elegido', () => {
    expect(faltaElegirPaquete(duo(), {})).toBe(true);
    expect(filtrarPaquetes(duo(), { Complemento: '1 dona + 1 galleta' })!.combosParte!.map((p) => p.id)).toEqual(['301', '302']);
    expect(faltaElegirPaquete(duo(), { Complemento: '2 donas' })).toBe(false);
  });

  it('muestra «Elige tu complemento», no deja agregar sin paquete y luego pide sus sabores', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    expect(screen.getByText('Elige tu complemento')).toBeInTheDocument();
    expect(botonAgregar()).toBeDisabled();
    // Aún no se ven las piezas de ningún paquete
    expect(screen.queryByRole('button', { name: 'Agregar Dona' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1 dona + 1 galleta' }));
    expect(botonAgregar()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Dona' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Galleta' }));
    expect(botonAgregar()).toBeEnabled();

    fireEvent.click(botonAgregar());
    expect(agregarLinea.mock.calls[0][0].comboElecciones).toEqual([
      { parteId: '301', productoId: '40' },
      { parteId: '302', productoId: '41' },
    ]);
  });

  it('paquete fijo (carrot cake): se puede agregar sin más pasos y viaja con su producto', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    fireEvent.click(screen.getByRole('button', { name: '1 carrot cake' }));
    expect(botonAgregar()).toBeEnabled();
    fireEvent.click(botonAgregar());
    expect(agregarLinea.mock.calls[0][0].comboElecciones).toEqual([{ parteId: '303', productoId: '50' }]);
  });

  it('un paquete sin stock queda bloqueado', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo(false)} />);
    expect(screen.getByRole('button', { name: /1 carrot cake · No hay stock/ })).toBeDisabled();
  });
});
