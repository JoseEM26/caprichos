import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaginaConocenos } from '../PaginaConocenos';
import { PaginaNovedades } from '../PaginaNovedades';
import { CONOCENOS_DEFAULT } from '../conocenosContenido';
import type { FotoGaleria } from '../conocenosContenido';

const foto = (id: string, activo = true): FotoGaleria => ({ id, url: `/archivos/${id}.webp`, activo });
const srcs = (grilla: HTMLElement) => Array.from(grilla.querySelectorAll('img')).map((i) => i.getAttribute('src'));

describe('Conócenos: su galería, sin repetir fotos', () => {
  const galeria = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => foto(id));

  it('«Nuestro lugar» toma las 3 primeras y Momentos el resto: ninguna foto aparece dos veces', () => {
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} contenido={{ ...CONOCENOS_DEFAULT, galeria }} />);
    const grillas = screen.getAllByTestId('mosaico-momentos');
    expect(srcs(grillas[0])).toEqual(['/archivos/a.webp', '/archivos/b.webp', '/archivos/c.webp']);
    expect(srcs(grillas[1])).toEqual(['/archivos/d.webp', '/archivos/e.webp', '/archivos/f.webp']);
  });

  it('en la carta pública las fotos ocultas no se ven y no se rellenan con otras', () => {
    const conOcultas = [foto('a'), foto('b', false), foto('c'), foto('d')];
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} contenido={{ ...CONOCENOS_DEFAULT, galeria: conOcultas }} />);
    const grillas = screen.getAllByTestId('mosaico-momentos');
    expect(srcs(grillas[0])).toEqual(['/archivos/a.webp', '/archivos/c.webp', '/archivos/d.webp']);
    expect(screen.queryByText('Momentos Caprichos')).toBeNull();
  });

  it('sin galería no muestra fotos de otras pantallas', () => {
    const { container } = render(<PaginaConocenos datosLocal={null} estadoLocal={null} contenido={{ ...CONOCENOS_DEFAULT, galeria: [] }} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('Novedades: Momentos Caprichos con fotos propias', () => {
  const tarjeta = {
    id: '1', tipo: 'AVISO', titulo: 'Aviso uno', orden: 1, activo: true, tamano: 'MEDIANO',
    fotos: [{ id: 'n1', url: '/archivos/tarjeta.webp' }],
  };

  it('los Momentos muestran sus fotos y no la foto de la tarjeta', () => {
    render(
      <PaginaNovedades
        onVerCarta={() => {}}
        novedades={[tarjeta as any]}
        momentos={[foto('m1'), foto('m2')]}
      />,
    );
    const grilla = screen.getByTestId('mosaico-momentos');
    expect(srcs(grilla)).toEqual(['/archivos/m1.webp', '/archivos/m2.webp']);
  });

  it('sin fotos de Momentos no repite las de las tarjetas', () => {
    render(<PaginaNovedades onVerCarta={() => {}} novedades={[tarjeta as any]} momentos={[]} />);
    expect(screen.queryByTestId('mosaico-momentos')).toBeNull();
    expect(screen.queryByText('Momentos Caprichos')).toBeNull();
  });
});
