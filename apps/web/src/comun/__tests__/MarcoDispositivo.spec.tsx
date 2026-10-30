import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { MarcoDispositivo, ConmutadorDispositivo } from '../MarcoDispositivo';
import { PrevisualizacionCarta } from '../../admin/ofertas/PrevisualizacionCarta';
import { VistaPreviaProducto } from '../../admin/catalogo/VistaPreviaProducto';

function Demo() {
  const [c, setC] = useState(true);
  return (
    <>
      <ConmutadorDispositivo celular={c} onCambiar={setC} />
      <MarcoDispositivo celular={c}><div data-testid="hijo" /></MarcoDispositivo>
    </>
  );
}

describe('MarcoDispositivo', () => {
  it('aplica clase de celular o PC, contiene a los hijos y conmuta', () => {
    render(<Demo />);
    const marco = screen.getByTestId('preview-container-celular');
    expect(marco.className).toContain('mdv-marco--celular');
    expect(marco.contains(screen.getByTestId('hijo'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Computadora' }));
    const pc = screen.getByTestId('preview-container-pc');
    expect(pc.className).not.toContain('mdv-marco--celular');
    expect(pc.dataset.dispositivo).toBe('pc');
  });

  it('la oferta abierta queda dentro del marco', () => {
    render(<PrevisualizacionCarta oferta={{ nombre: '2x1 LATTE' }} vistaInicial="abierta" dispositivoInicial="celular" />);
    const marco = screen.getByTestId('preview-container-celular');
    expect(marco.contains(screen.getByRole('dialog', { name: /Detalles de/ }))).toBe(true);
  });

  it('el producto abierto queda dentro del marco y alterna a tarjeta', () => {
    render(<VistaPreviaProducto borrador={{ nombre: 'Latte', precio: 8, tamanos: [], grupos: [] }} onCerrar={() => {}} />);
    const marco = screen.getByTestId('preview-container-celular');
    expect(marco.contains(screen.getByRole('dialog', { name: /Detalles de/ }))).toBe(true);
    fireEvent.click(screen.getByTestId('btn-vista-tarjeta'));
    expect(screen.queryByRole('dialog', { name: /Detalles de/ })).toBeNull();
  });
});
