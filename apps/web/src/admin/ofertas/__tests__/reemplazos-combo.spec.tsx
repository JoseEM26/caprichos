import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReemplazosParteFijo } from '../ReemplazosParteFijo';
import { ModalCombo } from '../ModalCombo';
import { OfertaItem } from '../ofertasApi';

const productos = [
  { id: '5', nombre: 'Club Sandwich', precio: 15 },
  { id: '7', nombre: 'Empanada', precio: 6 },
  { id: '8', nombre: 'Croissant', precio: 9 },
  { id: '9', nombre: 'Dona', precio: 5 },
];

function Contenedor({ inicial = [] as string[] }) {
  const [ids, setIds] = useState<string[]>(inicial);
  return (
    <>
      <ReemplazosParteFijo principalId="5" principalNombre="Club Sandwich" reemplazos={ids} productos={productos} onCambiar={setIds} />
      <output data-testid="orden">{ids.join(',')}</output>
    </>
  );
}

describe('Reemplazos (plan B, C...) de la parte fija', () => {
  it('agrega, no ofrece el principal ni duplicados, ordena y quita con confirmación Sí/No', () => {
    render(<Contenedor />);
    expect(screen.getByText('Si el principal y todos los reemplazos se agotan, el combo se muestra agotado.')).toBeInTheDocument();

    const buscador = screen.getByLabelText('Buscar reemplazo');
    fireEvent.change(buscador, { target: { value: 'club' } });
    expect(screen.queryByRole('button', { name: /Agregar Club Sandwich/ })).toBeNull();

    fireEvent.change(buscador, { target: { value: 'empa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Empanada' }));
    fireEvent.change(buscador, { target: { value: 'crois' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Croissant' }));
    expect(screen.getByTestId('orden').textContent).toBe('7,8');
    expect(screen.getByText('Plan B')).toBeInTheDocument();
    expect(screen.getByText('Plan C')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'empa' } });
    expect(screen.queryByRole('button', { name: 'Agregar Empanada' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Subir Croissant' }));
    expect(screen.getByTestId('orden').textContent).toBe('8,7');

    // Quitar pide confirmación: "No" conserva, "Sí" quita
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Croissant' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByTestId('orden').textContent).toBe('8,7');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Croissant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    expect(screen.getByTestId('orden').textContent).toBe('7');
  });

  it('ModalCombo muestra la sección en la parte fija y envía los reemplazos al guardar', async () => {
    const combo = {
      id: '1', tipo: 'COMBO', nombre: 'Combo Dúo', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null,
      alcanceProductoId: null, descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null,
      horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'], limiteUsos: null, usosActuales: 0,
      noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '',
      combosPrecio: [{ tamanoNombre: 'Regular', precio: 20 }],
      combosParte: [{ id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], reemplazos: ['7'] }],
    } as unknown as OfertaItem;
    render(<ModalCombo abierto comboAEditar={combo} onCerrar={() => {}} onGuardar={async () => {}} productosDisponibles={productos} categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(await screen.findByText('Si no hay Club Sandwich, ofrecer en su lugar')).toBeInTheDocument();
    expect(screen.getByText('Plan B')).toBeInTheDocument();
    expect(screen.getByText('Empanada')).toBeInTheDocument();
  });
});
