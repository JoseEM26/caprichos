import { construirPromptSistema, construirSeccionConocimiento, CONOCIMIENTO_MAX_CARACTERES, CONOCIMIENTO_MAX_ITEMS } from '../prompt-sistema';

const item = (n: number, extra: any = {}) => ({ tipo: 'FAQ', intencion: `i${n}`, pregunta: `Pregunta ${n}`, respuesta: `Respuesta ${n}`, frases: [], ...extra });

describe('prompt con conocimiento aprobado', () => {
  it('sin conocimiento el prompt queda exactamente igual', () => {
    expect(construirSeccionConocimiento([])).toBe('');
    expect(construirPromptSistema('Ana', true, '')).toBe(construirPromptSistema('Ana', true));
    expect(construirPromptSistema('Ana', true)).not.toContain('RESPUESTAS APROBADAS');
  });

  it('con conocimiento agrega la sección y manda lo del sistema sobre lo aprendido', () => {
    const p = construirPromptSistema(undefined, false, construirSeccionConocimiento([item(1)]));
    expect(p).toContain('RESPUESTAS APROBADAS POR CAPRICHOS');
    expect(p).toContain('Pregunta 1');
    expect(p).toMatch(/contradice los datos del sistema.*mandan SIEMPRE los datos del sistema/s);
    expect(p).toMatch(/Precios, stock y horarios NUNCA salen de esta lista/);
  });

  it('formatea FRASES y DERIVAR', () => {
    const s = construirSeccionConocimiento([
      item(1, { tipo: 'FRASES', frases: ['q precio tiene', 'cuanto sale'], intencion: 'precio' }),
      item(2, { tipo: 'DERIVAR' }),
    ]);
    expect(s).toContain('«q precio tiene», «cuanto sale»');
    expect(s).toContain('pasarAPersona');
  });

  it('tope de 40 ítems y de caracteres, con los más recientes primero', () => {
    const muchos = Array.from({ length: 100 }, (_, i) => item(i));
    expect(construirSeccionConocimiento(muchos).split('\n').filter((l) => l.startsWith('- Pregunta:')).length).toBeLessThanOrEqual(CONOCIMIENTO_MAX_ITEMS);
    const largos = Array.from({ length: 30 }, (_, i) => item(i, { respuesta: 'x'.repeat(500) }));
    const s = construirSeccionConocimiento(largos);
    expect(s.length).toBeLessThanOrEqual(CONOCIMIENTO_MAX_CARACTERES + 600);
    expect(s).toContain('Pregunta 0');
  });
});
