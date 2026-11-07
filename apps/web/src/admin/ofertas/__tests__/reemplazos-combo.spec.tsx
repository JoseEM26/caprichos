import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlternativasParte } from '../AlternativasParte';
import { ModalCombo } from '../ModalCombo';
import { AlternativaParteItem, OfertaItem } from '../ofertasApi';

const productos = [
  { id: '5', nombre: 'Club Sandwich', precio: 15 },
  { id: '7', nombre: 'Empanada', precio: 6 },
  { id: '8', nombre: 'Croissant', precio: 9 },
  { id: '9', nombre: 'Dona', precio: 5 },
];

function Contenedor({ inicial = [] as AlternativaParteItem[] }) {
  const [alts, setAlts] = useState<AlternativaParteItem[]>(inicial);
  return (
    <>
      <AlternativasParte principalId="5" alternativas={alts} productos={productos} onCambiar={setAlts} />
      <output data-testid="orden">{alts.map((a) => `${a.id}x${a.cantidad}`).join(',')}</output>
    </>
  );
}

describe('Alternativas de una parte (si no hay stock, elige)', () => {
  it('agrega, no ofrece el principal ni duplicados, cambia cantidad, ordena y quita con confirmación Sí/No', () => {
    render(<Contenedor />);
    expect(screen.getByText('Si no hay stock, el cliente podrá elegir:')).toBeInTheDocument();

    const buscador = screen.getByLabelText('Buscar alternativa');
    fireEvent.change(buscador, { target: { value: 'club' } });
    expect(screen.queryByRole('button', { name: /Agregar Club Sandwich/ })).toBeNull();

    fireEvent.change(buscador, { target: { value: 'empa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Empanada' }));
    fireEvent.change(buscador, { target: { value: 'crois' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Croissant' }));
    expect(screen.getByTestId('orden').textContent).toBe('7x1,8x1');
    expect(screen.getByText('Opción 1')).toBeInTheDocument();
    expect(screen.getByText('Opción 2')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'empa' } });
    expect(screen.queryByRole('button', { name: 'Agregar Empanada' })).toBeNull();

    // Cantidad: 2 galletas, 1 carrot cake...
    fireEvent.change(screen.getByLabelText('Cantidad de Croissant'), { target: { value: '2' } });
    expect(screen.getByTestId('orden').textContent).toBe('7x1,8x2');

    fireEvent.click(screen.getByRole('button', { name: 'Subir Croissant' }));
    expect(screen.getByTestId('orden').textContent).toBe('8x2,7x1');

    // Quitar pide confirmación: "No" conserva, "Sí" quita
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Croissant' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByTestId('orden').textContent).toBe('8x2,7x1');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Croissant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    expect(screen.getByTestId('orden').textContent).toBe('7x1');
  });

  it('ModalCombo: una parte fija muestra el editor y guarda las alternativas con su cantidad', async () => {
    let guardado: any = null;
    const combo = {
      id: '1', tipo: 'COMBO', nombre: 'Combo Dúo', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null,
      alcanceProductoId: null, descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null,
      horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'], limiteUsos: null, usosActuales: 0,
      noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '',
      combosPrecio: [{ tamanoNombre: 'Regular', precio: 20 }],
      combosParte: [{ id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], alternativas: [{ id: '7', nombre: 'Empanada', cantidad: 2, disponible: true }] }],
    } as unknown as OfertaItem;
    render(<ModalCombo abierto comboAEditar={combo} onCerrar={() => {}} onGuardar={async (d) => { guardado = d; }} productosDisponibles={productos} categorias={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /Partes y alternativas/ }));
    expect(await screen.findByText('Si no hay stock, el cliente podrá elegir:')).toBeInTheDocument();
    expect(screen.getByText('Empanada')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de Empanada')).toHaveValue(2);
    fireEvent.click(screen.getByTestId('btn-guardar-combo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(guardado?.partes?.[0]?.alternativas).toEqual([{ productoId: '7', cantidad: 2 }]);
  });

  it('ModalCombo: también en una parte A_ELECCION (lista de productos)', async () => {
    const combo = {
      id: '2', tipo: 'COMBO', nombre: 'Combo Dúo', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null,
      alcanceProductoId: null, descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null,
      horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'], limiteUsos: null, usosActuales: 0,
      noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '',
      combosPrecio: [{ tamanoNombre: 'Regular', precio: 20 }],
      combosParte: [{ id: '200', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['9'], alternativas: [] }],
    } as unknown as OfertaItem;
    render(<ModalCombo abierto comboAEditar={combo} onCerrar={() => {}} onGuardar={async () => {}} productosDisponibles={productos} categorias={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /Partes y alternativas/ }));
    expect(await screen.findByText('Si no hay stock, el cliente podrá elegir:')).toBeInTheDocument();
  });
});
