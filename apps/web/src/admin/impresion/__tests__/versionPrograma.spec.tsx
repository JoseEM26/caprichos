import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsigniaVersion, estadoVersion, numeroVersion } from '../versionPrograma';

const ultima = { version: '0.1.57', commit: 'ab12cd3', fecha: '2026-11-09T10:00:00Z' };

describe('versionPrograma', () => {
  it('extrae N y trata 0.1.0 y dev como antiguas', () => {
    expect(numeroVersion('0.1.57')).toBe(57);
    expect(numeroVersion('0.1.57 (ab12cd3)')).toBe(57);
    expect(numeroVersion('0.1.0')).toBe(0);
    expect(numeroVersion('0.1.0-dev')).toBe(0);
    expect(numeroVersion(null)).toBe(0);
  });

  it('compara con la ultima publicada', () => {
    expect(estadoVersion('0.1.0', ultima)).toBe('nueva');
    expect(estadoVersion('0.1.56 (x)', ultima)).toBe('nueva');
    expect(estadoVersion('0.1.57 (ab12cd3)', ultima)).toBe('actualizado');
    expect(estadoVersion('0.1.58', ultima)).toBe('actualizado');
    expect(estadoVersion('0.1.0', null)).toBeNull();
  });

  it('muestra Programa vN y la insignia correcta; sin publicada no hay insignia', () => {
    const { rerender } = render(<InsigniaVersion instalada="0.1.10" ultima={ultima} />);
    expect(screen.getByTestId('programa-version').textContent).toBe('Programa v0.1.10');
    expect(screen.getByTestId('version-nueva').textContent).toContain('v0.1.57');
    rerender(<InsigniaVersion instalada="0.1.57 (ab12cd3)" ultima={ultima} />);
    expect(screen.getByTestId('version-actualizada').textContent).toBe('Actualizado');
    rerender(<InsigniaVersion instalada="0.1.10" ultima={null} />);
    expect(screen.queryByTestId('version-nueva')).toBeNull();
    expect(screen.queryByTestId('version-actualizada')).toBeNull();
  });
});
