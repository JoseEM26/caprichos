import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CapriFallback } from '../CapriFallback';
import { ASPECTO_BASE_DEFECTO, type AspectoCapri } from '../tiposAspecto';

describe('CapriFallback.tsx con Aspecto personalizado', () => {
  it('aplica colores personalizados de piel, ojos y uniforme', () => {
    const aspecto: AspectoCapri = {
      ...ASPECTO_BASE_DEFECTO,
      piel: '#B77742',
      ojos: '#2B1B3F',
      uniforme: {
        principal: '#3BB4E7',
        delantal: '#123456',
        ribete: '#FFD700',
      },
    };

    const { container } = render(<CapriFallback aspecto={aspecto} />);
    const svgHtml = container.innerHTML;

    expect(svgHtml).toContain('#B77742');
    expect(svgHtml).toContain('#2B1B3F');
    expect(svgHtml).toContain('#3BB4E7');
    expect(svgHtml).toContain('#123456');
    expect(svgHtml).toContain('#FFD700');
  });

  it('renderiza diferentes tipos de gorros (chef, bruja, navideno, corona, sombrero, ninguno)', () => {
    // 1. Bruja
    const { container: cBruja } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'bruja', color: '#2B1B3F' } }} />
    );
    expect(cBruja.querySelector('#capri-gorro-bruja')).not.toBeNull();

    // 2. Navideño
    const { container: cNavidad } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'navideno', color: '#C5221F' } }} />
    );
    expect(cNavidad.querySelector('#capri-gorro-navideno')).not.toBeNull();

    // 3. Corona
    const { container: cCorona } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'corona', color: '#D99E39' } }} />
    );
    expect(cCorona.querySelector('#capri-gorro-corona')).not.toBeNull();

    // 4. Sombrero
    const { container: cSombrero } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'sombrero', color: '#D2B48C' } }} />
    );
    expect(cSombrero.querySelector('#capri-gorro-sombrero')).not.toBeNull();

    // 5. Chef
    const { container: cChef } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'chef', color: '#FFFFFF' } }} />
    );
    expect(cChef.querySelector('#capri-gorro-chef')).not.toBeNull();

    // 6. Ninguno
    const { container: cNinguno } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, gorro: { tipo: 'ninguno', color: '#FFFFFF' } }} />
    );
    expect(cNinguno.querySelector('#capri-gorro-chef')).toBeNull();
    expect(cNinguno.querySelector('#capri-gorro-bruja')).toBeNull();
  });

  it('renderiza estilos de cabello (colitas, suelto, trenza, mono)', () => {
    const { container: cColitas } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, cabello: { color: '#000000', estilo: 'colitas' } }} />
    );
    expect(cColitas.querySelector('#capri-pelo-colitas')).not.toBeNull();

    const { container: cSuelto } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, cabello: { color: '#000000', estilo: 'suelto' } }} />
    );
    expect(cSuelto.querySelector('#capri-pelo-suelto')).not.toBeNull();

    const { container: cTrenza } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, cabello: { color: '#000000', estilo: 'trenza' } }} />
    );
    expect(cTrenza.querySelector('#capri-pelo-trenza')).not.toBeNull();

    const { container: cMono } = render(
      <CapriFallback aspecto={{ ...ASPECTO_BASE_DEFECTO, cabello: { color: '#000000', estilo: 'mono' } }} />
    );
    expect(cMono.querySelector('#capri-pelo-mono')).not.toBeNull();
  });

  it('renderiza accesorios seleccionados', () => {
    const { container } = render(
      <CapriFallback
        aspecto={{
          ...ASPECTO_BASE_DEFECTO,
          accesorios: [
            'calabaza',
            'bufanda',
            'corazon',
            'bandera',
            'lazo',
            'estrellas',
            'guirnalda',
            'antifaz',
            'bigote',
          ],
        }}
      />
    );

    expect(container.querySelector('#capri-acc-calabaza')).not.toBeNull();
    expect(container.querySelector('#capri-acc-bufanda')).not.toBeNull();
    expect(container.querySelector('#capri-acc-corazon')).not.toBeNull();
    expect(container.querySelector('#capri-acc-bandera')).not.toBeNull();
    expect(container.querySelector('#capri-acc-lazo')).not.toBeNull();
    expect(container.querySelector('#capri-acc-estrellas')).not.toBeNull();
    expect(container.querySelector('#capri-acc-guirnalda')).not.toBeNull();
    expect(container.querySelector('#capri-acc-antifaz')).not.toBeNull();
    expect(container.querySelector('#capri-acc-bigote')).not.toBeNull();
  });
});
