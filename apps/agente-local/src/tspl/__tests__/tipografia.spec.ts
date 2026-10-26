import { describe, it, expect } from 'vitest';
import {
  medirAnchoTexto,
  calcularCentroX,
  truncar,
  ajustarLineas,
  generarComandoTexto,
} from '../tipografia';
import { generarSeparadorRombos } from '../rombos';

describe('tipografia', () => {
  it('calcula ancho de texto segun fuente y multiplicador', () => {
    expect(medirAnchoTexto('HOLA', '2', 1)).toBe(4 * 12);
    expect(medirAnchoTexto('HOLA', '4', 2)).toBe(4 * 24 * 2);
  });

  it('calcula posicion central centrada en el ancho de la etiqueta', () => {
    // 508 - (4 * 12) = 460 -> 460 / 2 = 230
    expect(calcularCentroX('HOLA', '2', 1, 508)).toBe(230);
  });

  it('trunca textos largos con ... sin desbordar', () => {
    const largo = 'Café con leche de avena y jarabe de vainilla con extra canela';
    const cortado = truncar(largo, 20);
    expect(cortado.length).toBe(20);
    expect(cortado.endsWith('...')).toBe(true);
    expect(cortado).toBe('Café con leche de...');
  });

  it('no trunca textos que caben', () => {
    expect(truncar('Corto', 10)).toBe('Corto');
  });

  it('ajusta lineas por palabras sin cortar a mitad si es posible', () => {
    const texto = 'Sandwich mixto de jamon y queso caliente';
    const lineas = ajustarLineas(texto, 20);
    expect(lineas.length).toBeGreaterThan(1);
    lineas.forEach((l) => expect(l.length).toBeLessThanOrEqual(20));
  });

  it('respeta maxLineas agregando puntos suspensivos al final si se desborda', () => {
    const texto = 'Palabra uno dos tres cuatro cinco seis siete ocho nueve diez';
    const lineas = ajustarLineas(texto, 15, 2);
    expect(lineas.length).toBe(2);
    expect(lineas[1].endsWith('...')).toBe(true);
  });

  it('genera comando TSPL TEXT limpio', () => {
    const cmd = generarComandoTexto(30, 40, '2', 1, 1, 'CAPRICHOS "CAFE"');
    expect(cmd).toBe('TEXT 30,40,"2",0,1,1,"CAPRICHOS \'CAFE\'"\r\n');
  });
});

describe('rombos', () => {
  it('genera comandos BAR para lineas laterales y 3 rombos rellenos', () => {
    const cmds = generarSeparadorRombos(150);
    expect(cmds).toContain('BAR 36,150,170,2\r\n');
    expect(cmds).toContain('BAR 302,150,170,2\r\n');
    // Verifica que contiene barras de los rombos (ej. centro del rombo medio: x = 254 - 5 = 249)
    expect(cmds).toContain('BAR 249,150,11,1\r\n');
  });
});
