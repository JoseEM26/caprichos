import { readFileSync } from 'fs';
import { join } from 'path';

const leer = (n: string) => readFileSync(join(__dirname, '..', 'manuales', `${n}.md`), 'utf8');

describe('Manual de Capri: aviso de cumpleaños del equipo', () => {
  const t = leer('escritorio');

  it('explica el aviso para todo el equipo, la privacidad, el cierre y quién lo apaga', () => {
    expect(t).toContain('Hoy cumple anos Maria S.');
    expect(t).toContain('nunca la fecha ni la edad');
    expect(t).toContain('Aviso de cumpleanos para todo el equipo');
    expect(t).toContain('una sola vez por dia, aunque uses otro dispositivo');
  });

  it('mantiene como máximo 8 sugerencias', () => {
    const cabecera = t.split('---')[1];
    const sugerencias = cabecera.split('sugerencias:')[1].split('\n').filter((l) => l.trim().startsWith('- '));
    expect(sugerencias.length).toBeLessThanOrEqual(8);
  });
});
