import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsigniaModalidad, claveModalidad } from '../InsigniaModalidad';
import { obtenerModalidadPill } from '../etiquetasPedido';

describe('«Comer en el local» en las vistas del personal', () => {
  it('tiene su propia clave e insignia, distinta de MESA y de «En el local»', () => {
    expect(claveModalidad('COMER_LOCAL')).toBe('COMER_LOCAL');
    render(<InsigniaModalidad modalidad="COMER_LOCAL" />);
    expect(screen.getByText('COMER EN EL LOCAL')).toBeInTheDocument();
  });

  it('el pill de la etiqueta lo nombra sin mesa', () => {
    expect(obtenerModalidadPill({ modalidad: 'COMER_LOCAL', mesa_nombre: null } as any)).toBe('COMER EN EL LOCAL');
  });
});
