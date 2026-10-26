import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { MascotaCapri } from '../MascotaCapri';
import MascotaCapri3D from '../MascotaCapri3D';
import * as soporteWebGL from '../soporteWebGL';
import * as moduloRenderer from '../crearRendererWebGL';

describe('MascotaCapri.tsx', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra CapriFallback cuando WebGL no está disponible (entorno jsdom)', () => {
    vi.spyOn(soporteWebGL, 'tieneSoporteWebGL').mockReturnValue(false);

    render(<MascotaCapri estado="reposo" tamano={150} />);

    const img = screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('capri-fallback');
    expect(img).toHaveStyle({ width: '150px', height: '150px' });
  });

  it('muestra CapriFallback cuando se activa forzarFallback2D=true', () => {
    vi.spyOn(soporteWebGL, 'tieneSoporteWebGL').mockReturnValue(true);

    render(<MascotaCapri estado="saludando" forzarFallback2D={true} />);

    const img = screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('capri-fallback');
    expect(img).toHaveClass('capri-estado-saludando');
  });

  it('muestra CapriFallback cuando el usuario tiene preferencia de movimiento reducido', () => {
    vi.spyOn(soporteWebGL, 'tieneSoporteWebGL').mockReturnValue(true);
    vi.spyOn(soporteWebGL, 'prefiereMovimientoReducido').mockReturnValue(true);

    render(<MascotaCapri estado="pensando" />);

    const img = screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('capri-fallback');
  });

  describe('MascotaCapri3D y ciclo de vida de recursos', () => {
    it('inicializa el renderer WebGL, monta el canvas y limpia todos los recursos al desmontar', async () => {
      // Mock de WebGLRenderer para jsdom
      const disposeRendererSpy = vi.fn();
      const mockCanvas = document.createElement('canvas');

      const mockRendererInstance = {
        domElement: mockCanvas,
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        setClearColor: vi.fn(),
        render: vi.fn(),
        dispose: disposeRendererSpy,
      };

      vi.spyOn(moduloRenderer, 'crearRendererWebGL').mockImplementation(() => {
        return mockRendererInstance as unknown as THREE.WebGLRenderer;
      });

      const { unmount } = render(
        <MascotaCapri3D estado="contento" tamano={200} />
      );

      const contenedor3D = screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' });
      expect(contenedor3D).toBeInTheDocument();
      expect(contenedor3D).toContainElement(mockCanvas);
      expect(contenedor3D).toHaveClass('capri-3d-contenedor');

      // Desmontar el componente debe invocar renderer.dispose() y remover canvas
      unmount();

      expect(disposeRendererSpy).toHaveBeenCalled();
      expect(mockCanvas.parentNode).toBeNull();
    });

    it('llama a onError si el renderer falla al crearse', () => {
      const errorSimulado = new Error('WebGL context lost or failed');
      vi.spyOn(moduloRenderer, 'crearRendererWebGL').mockImplementation(() => {
        throw errorSimulado;
      });

      const onErrorMock = vi.fn();
      render(<MascotaCapri3D estado="dormido" onError={onErrorMock} />);

      expect(onErrorMock).toHaveBeenCalledWith(errorSimulado);
    });
  });
});
