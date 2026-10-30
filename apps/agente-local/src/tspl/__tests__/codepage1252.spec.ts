import { describe, it, expect } from 'vitest';
import { aWindows1252, limpiarParaTspl } from '../codepage1252';

describe('codepage1252', () => {
  it('convierte texto ASCII sin cambios de longitud ni valores', () => {
    const texto = 'CAPRICHOS 123';
    const buffer = aWindows1252(texto);
    expect(buffer.toString('ascii')).toBe(texto);
    expect(buffer.length).toBe(texto.length);
  });

  it('codifica acentos espanoles y la letra n con tilde en Windows-1252 de 1 solo byte cada uno', () => {
    const texto = 'áéíóúñÁÉÍÓÚÑüÜ¡¿';
    const buffer = aWindows1252(texto);
    expect(buffer.length).toBe(texto.length);
    // Verificamos bytes individuales de Windows-1252
    expect(buffer[0]).toBe(0xE1); // á
    expect(buffer[1]).toBe(0xE9); // é
    expect(buffer[2]).toBe(0xED); // í
    expect(buffer[3]).toBe(0xF3); // ó
    expect(buffer[4]).toBe(0xFA); // ú
    expect(buffer[5]).toBe(0xF1); // ñ
    expect(buffer[6]).toBe(0xC1); // Á
    expect(buffer[7]).toBe(0xC9); // É
    expect(buffer[8]).toBe(0xCD); // Í
    expect(buffer[9]).toBe(0xD3); // Ó
    expect(buffer[10]).toBe(0xDA); // Ú
    expect(buffer[11]).toBe(0xD1); // Ñ
    expect(buffer[12]).toBe(0xFC); // ü
    expect(buffer[13]).toBe(0xDC); // Ü
    expect(buffer[14]).toBe(0xA1); // ¡
    expect(buffer[15]).toBe(0xBF); // ¿
  });

  it('mapea viñetas y caracteres especiales de Windows-1252 (bullet • y ●)', () => {
    const texto = '• Croissant ● Cafe';
    const buffer = aWindows1252(texto);
    expect(buffer[0]).toBe(0x95); // bullet •
    expect(buffer[12]).toBe(0x95); // ● mapeado a bullet 0x95
  });

  it('limpia y escapa comillas dobles y saltos para TSPL', () => {
    const sucio = 'Texto con "comillas" y \r\n salto';
    const limpio = limpiarParaTspl(sucio);
    expect(limpio).toBe("Texto con 'comillas' y   salto");
  });
});
