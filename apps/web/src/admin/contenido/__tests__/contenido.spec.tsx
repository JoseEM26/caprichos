import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortadaCarta } from '../../../carta/PortadaCarta';
import { PaginaNovedades } from '../../../carta/PaginaNovedades';

vi.mock('../../../carta/useEsMovil', () => ({ useEsMovil: () => false }));

describe('Carta pública: contenido administrable', () => {
  it('la portada muestra el banner que viene del administrativo', () => {
    render(<PortadaCarta datosLocal={null} estadoLocal={null} fotoDestacada={null}
      banner={{ activo: true, tag: 'ETQ', title: 'Título X', sub: 'Sub X' }} onPedir={() => {}} onVerCarta={() => {}} />);
    expect(screen.getByText('Título X')).toBeTruthy();
  });

  it('la portada oculta el banner si está desactivado o vacío', () => {
    render(<PortadaCarta datosLocal={null} estadoLocal={null} fotoDestacada={null}
      banner={{ activo: false, title: 'Oculto' }} onPedir={() => {}} onVerCarta={() => {}} />);
    expect(screen.queryByText('Oculto')).toBeNull();
  });

  it('novedades: estado vacío real y filtro por tipo', () => {
    const base = { orden: 0, activo: true, fotos: [] };
    const { rerender } = render(<PaginaNovedades novedades={[]} onVerCarta={() => {}} />);
    expect(screen.getByText('Aún no hay novedades')).toBeTruthy();
    rerender(<PaginaNovedades onVerCarta={() => {}} novedades={[
      { ...base, id: '1', tipo: 'AVISO', titulo: 'Aviso uno' },
      { ...base, id: '2', tipo: 'VIDEO', titulo: 'Video dos' },
    ]} />);
    fireEvent.click(screen.getByText('Videos'));
    expect(screen.queryByText('Aviso uno')).toBeNull();
    expect(screen.getByText('Video dos')).toBeTruthy();
  });
});
