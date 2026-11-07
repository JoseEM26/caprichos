import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// La PWA general (carta y admin) conserva su ícono de siempre; los de «QR Asistencia» son solo de la pantalla pública.
describe('manifest general de la web', () => {
  const vite = readFileSync(resolve(__dirname, '../../../../vite.config.ts'), 'utf8');
  it('sigue usando los íconos de Caprichos y no los de QR Asistencia', () => {
    expect(vite).toContain('/icons/icon-192.png');
    expect(vite).toContain('/icons/icon-512.png');
    expect(vite).toContain('/icons/icon-maskable-512.png');
    expect(vite).not.toContain('qr-asistencia');
  });
});
