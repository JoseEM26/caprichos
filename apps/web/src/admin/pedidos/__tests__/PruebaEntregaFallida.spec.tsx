import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PruebaEntregaFallida } from '../PruebaEntregaFallida';
import * as apiModulo from '../../../comun/api';

describe('PruebaEntregaFallida (historial del pedido)', () => {
  it('muestra llegada, espera, repartidor y las fotos privadas', async () => {
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:foto-1');
    render(
      <PruebaEntregaFallida
        prueba={{
          llego_en: '2026-11-04T15:00:00.000Z',
          minutos_espera: 10,
          repartidor: 'Juan Pérez',
          reportado_en: '2026-11-04T15:14:00.000Z',
          fotos: ['41'],
        }}
      />,
    );

    expect(screen.getByText('Prueba de entrega fallida')).toBeInTheDocument();
    expect(screen.getByText('Espera exigida: 10 min')).toBeInTheDocument();
    expect(screen.getByText('Repartidor: Juan Pérez')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText('Foto 1 del lugar de entrega fallida')).toBeInTheDocument());
    expect(apiModulo.obtenerBlobAutenticado).toHaveBeenCalledWith('/admin/archivos/41');
  });

  it('sin prueba no muestra nada', () => {
    const { container } = render(<PruebaEntregaFallida prueba={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
