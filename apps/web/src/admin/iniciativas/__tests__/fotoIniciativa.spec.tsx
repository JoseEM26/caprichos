import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FotoIniciativa } from '../FotoIniciativa';
import * as apiModulo from '../../../comun/api';

describe('FotoIniciativa', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('no renderiza nada si src es null o vacío', () => {
    const { container } = render(<FotoIniciativa src={null} alt="Prueba" />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza directamente sin petición si es una URL pública o blob', () => {
    render(<FotoIniciativa src="blob:http://localhost:5173/123" alt="Foto blob" />);
    const img = screen.getByRole('img', { name: 'Foto blob' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:http://localhost:5173/123');
  });

  it('descarga con autenticación y genera un blob URL si la ruta es privada /admin/archivos/:id', async () => {
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:http://localhost:5173/fake-blob-123');

    render(<FotoIniciativa src="/admin/archivos/42" alt="Captura privada" />);

    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'Captura privada' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'blob:http://localhost:5173/fake-blob-123');
    });

    expect(apiModulo.obtenerBlobAutenticado).toHaveBeenCalledWith('/admin/archivos/42');
  });

  it('muestra mensaje amigable en lugar de imagen rota si falla la descarga', async () => {
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockRejectedValue(new Error('Error de red o 404'));

    render(<FotoIniciativa src="/admin/archivos/999" alt="Captura fallida" />);

    await waitFor(() => {
      expect(screen.getByText('Sin vista previa')).toBeInTheDocument();
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
