import { readFileSync } from 'fs';
import { join } from 'path';

describe('Manual de Capri: receta por sabor', () => {
  it('recetas explica el selector, copiar la general, quitar con confirmacion y el interruptor', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'recetas.md'), 'utf8');
    expect(t).toContain('Receta para:');
    expect(t).toContain('Crear receta propia para este sabor');
    expect(t).toContain('Quitar receta del sabor (volver a la general)');
    expect(t).toContain('Si, quitar');
    expect(t).toContain('control de almacen esta apagado');
  });
});
