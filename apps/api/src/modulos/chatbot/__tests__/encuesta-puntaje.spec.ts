import { interpretarPuntajeEncuesta } from '../servicios/encuesta-posventa.util';
import { textoGraciasEncuesta } from '../conversacion/textos-encuesta';

describe('interpretarPuntajeEncuesta: solo calificaciones explícitas', () => {
  it.each([
    ['encuesta:1', 1],
    ['encuesta:5', 5],
    ['1', 1],
    ['5', 5],
    [' 3 ', 3],
    ['1 Malo', 1],
    ['3 Regular', 3],
    ['5 Excelente', 5],
    ['4 Bueno', 4],
    ['4 Muy bueno', 4],
    ['MALO', 1],
    ['Excelente', 5],
    ['Bueno', 4],
    ['muy   bueno', 4],
    ['Regular', 3],
  ])('"%s" es %s', (entrada, puntaje) => {
    expect(interpretarPuntajeEncuesta(entrada)).toBe(puntaje);
  });

  it.each([
    'tengo 1 pregunta',
    '987654321',
    '51987654321',
    'CP-W114',
    '2 Regular',
    '1 Excelente',
    '6',
    '0',
    '1.',
    '1 malo, gracias',
    'encuesta:6',
    'encuesta:0',
    'muy malo',
    'hola',
    '',
  ])('"%s" no es calificación', (entrada) => {
    expect(interpretarPuntajeEncuesta(entrada)).toBeNull();
  });

  it('sin texto ni payload devuelve null', () => {
    expect(interpretarPuntajeEncuesta(null)).toBeNull();
    expect(interpretarPuntajeEncuesta(undefined)).toBeNull();
  });
});

describe('textoGraciasEncuesta: un texto distinto por nivel', () => {
  const baja = textoGraciasEncuesta(1, 2, 'José Ángel', 'CP-W114').textoLibre;
  const media = textoGraciasEncuesta(3, 2, 'José Ángel', 'CP-W114').textoLibre;
  const alta = textoGraciasEncuesta(5, 2, 'José Ángel', 'CP-W114').textoLibre;

  it('la calificación baja lleva nombre, código, la promesa de una persona y la invitación a contar', () => {
    expect(baja).toContain('Gracias por contarnos, José Ángel');
    expect(baja).toContain('pedido CP-W114');
    expect(baja).toContain('una persona te escribirá por este chat');
    expect(baja).toContain('Si quieres, ya puedes contarnos aquí qué ocurrió.');
  });

  it('la calificación media y la alta son agradecimientos sin prometer que una persona escribe', () => {
    expect(media).toContain('José Ángel');
    expect(alta).toContain('José Ángel');
    expect(media).not.toMatch(/persona te escribir/);
    expect(alta).not.toMatch(/persona te escribir/);
  });

  it('los tres textos son distintos entre sí', () => {
    expect(new Set([baja, media, alta]).size).toBe(3);
  });

  it('usa la plantilla de respaldo ENCUESTA_GRACIAS con nombre y código', () => {
    expect(textoGraciasEncuesta(4, 2, 'Ana', 'CP-1').plantillaClave).toBe('ENCUESTA_GRACIAS');
    expect(textoGraciasEncuesta(4, 2, 'Ana', 'CP-1').variablesPlantilla).toEqual(['Ana', 'CP-1']);
  });

  it('respeta el umbral configurado: con umbral 3, un 3 ya es calificación baja', () => {
    expect(textoGraciasEncuesta(3, 3, 'Ana', 'CP-1').textoLibre).toContain('una persona te escribirá');
  });
});
