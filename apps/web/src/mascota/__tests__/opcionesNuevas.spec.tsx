import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CapriFallback } from '../CapriFallback';
import { construirCapri } from '../construirCapri';
import { ASPECTO_BASE_DEFECTO, type AspectoCapri } from '../tiposAspecto';
import * as soporteWebGL from '../soporteWebGL';
import { MascotaCapri } from '../MascotaCapri';

const conOpcion = (cambios: Partial<AspectoCapri>): AspectoCapri => ({
  ...ASPECTO_BASE_DEFECTO,
  ...cambios,
  cabello: { ...ASPECTO_BASE_DEFECTO.cabello, ...(cambios.cabello || {}) },
  uniforme: { ...ASPECTO_BASE_DEFECTO.uniforme, ...(cambios.uniforme || {}) },
  gorro: { ...ASPECTO_BASE_DEFECTO.gorro, ...(cambios.gorro || {}) },
});

describe('opciones nuevas de Capri (dibujo SVG y 3D)', () => {
  const gorros = ['gorra', 'boina', 'beanie', 'diadema'] as const;
  it.each(gorros)('el gorro %s se dibuja en el SVG de respaldo', (tipo) => {
    const { container } = render(
      <CapriFallback aspecto={conOpcion({ gorro: { tipo, color: '#112233' } })} />
    );
    expect(container.querySelector(`#capri-gorro-${tipo}`)).not.toBeNull();
  });

  it.each(['rizado', 'corto', 'melena', 'coleta'] as const)('el cabello %s se dibuja en el SVG', (estilo) => {
    const { container } = render(
      <CapriFallback aspecto={conOpcion({ cabello: { color: '#000000', estilo } })} />
    );
    expect(container.querySelector(`#capri-pelo-${estilo}`)).not.toBeNull();
  });

  it.each(['polo', 'mandil', 'pechera'] as const)('la prenda %s cambia el uniforme en el SVG', (prenda) => {
    const { container } = render(
      <CapriFallback aspecto={conOpcion({ uniforme: { ...ASPECTO_BASE_DEFECTO.uniforme, prenda } })} />
    );
    expect(container.querySelector(`#capri-prenda-${prenda}`)).not.toBeNull();
  });

  it.each(['lentes', 'aretes', 'mochila', 'flor', 'medalla', 'banda', 'confeti'] as const)(
    'el accesorio %s se dibuja en el SVG',
    (acc) => {
      const { container } = render(<CapriFallback aspecto={conOpcion({ accesorios: [acc] })} />);
      expect(container.querySelector(`#capri-acc-${acc}`)).not.toBeNull();
    }
  );

  it.each([...gorros, 'corto', 'rizado', 'melena', 'coleta', 'polo', 'mandil', 'pechera'] as const)(
    'la opcion %s se construye en 3D sin error',
    (opcion) => {
      const esGorro = (gorros as readonly string[]).includes(opcion);
      const aspecto = esGorro
        ? conOpcion({ gorro: { tipo: opcion as any, color: '#112233' } })
        : esPrenda(opcion)
        ? conOpcion({ uniforme: { ...ASPECTO_BASE_DEFECTO.uniforme, prenda: opcion as any } })
        : conOpcion({ cabello: { color: '#000000', estilo: opcion as any } });
      const piezas = construirCapri(aspecto);
      expect(piezas.cabeza.getObjectByName('capri-gorro')).toBeDefined();
      piezas.raiz.clear();
    }
  );

  it('la escala no cambia el dibujo, solo el tamano en pantalla', () => {
    vi.spyOn(soporteWebGL, 'tieneSoporteWebGL').mockReturnValue(false);
    const { container } = render(<MascotaCapri tamano={80} escala={0.7} aspecto={ASPECTO_BASE_DEFECTO} />);
    expect((container.querySelector('.capri-fallback') as HTMLElement).style.width).toBe('56px');
  });
});

function esPrenda(opcion: string): boolean {
  return ['polo', 'mandil', 'pechera'].includes(opcion);
}
