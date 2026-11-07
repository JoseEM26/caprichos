import { describe, it, expect } from 'vitest';
import { lineasTicketComandaSalon } from '../etiquetas/ticketComanda.js';
import { rolDeTrabajo } from '../tipos/etiquetas.js';
import { maquetarGeneral } from '../etiquetas/maquetaStickers.js';
import type { TicketComandaSalonDatos, EtiquetaGeneralDatos } from '../tipos/etiquetas.js';

const comanda: TicketComandaSalonDatos = {
  codigo: 'CP-0042',
  mesa: 'Mesa 5',
  cliente: 'Ana',
  canal: 'Mozo',
  fecha: '05/11/2026',
  hora: '13:10',
  lineas: [
    { cantidad: 2, nombre: 'Frappe Mocha', tamano: 'Grande', opciones: ['Sin azúcar', 'Leche de almendra'], nota: 'Poco hielo' },
    { cantidad: 1, nombre: 'Croissant', opciones: [], nota: null },
  ],
};

describe('comanda de salón (ticketera de Caja)', () => {
  it('imprime código, mesa, cliente, hora y cada línea con tamaño, opciones y notas', () => {
    const textos = lineasTicketComandaSalon(comanda, 32).map((l) => l.texto);
    expect(textos).toContain('Pedido CP-0042');
    expect(textos).toContain('Mesa: Mesa 5');
    expect(textos.some((t) => t.includes('Cliente: Ana'))).toBe(true);
    expect(textos.some((t) => t.includes('05/11/2026 13:10'))).toBe(true);
    expect(textos).toContain('2 x Frappe Mocha');
    expect(textos).toContain('  Tamaño: Grande');
    expect(textos).toContain('  - Sin azúcar');
    expect(textos).toContain('  - Leche de almendra');
    expect(textos.some((t) => t.includes('Poco hielo'))).toBe(true);
    expect(textos).toContain('1 x Croissant');
  });

  it('ningún renglón supera las columnas del papel', () => {
    for (const cols of [32, 48]) {
      const lineas = lineasTicketComandaSalon({ ...comanda, nota: 'x'.repeat(120) }, cols);
      expect(lineas.every((l) => l.texto.length <= cols)).toBe(true);
    }
  });

  it('omite la mesa si el pedido no tiene (comanda por cliente)', () => {
    const textos = lineasTicketComandaSalon({ ...comanda, mesa: null }, 32).map((l) => l.texto);
    expect(textos.some((t) => t.startsWith('Mesa:'))).toBe(false);
  });
});

describe('sticker general con monto total', () => {
  const general: EtiquetaGeneralDatos = {
    codigo: 'CP-0007', modalidad: 'Para llevar', modalidadPill: 'PARA LLEVAR', who: 'Luis', canal: 'Web',
    hora: '12:00', fecha: '05/11/2026', cantidadProductos: 1,
    productos: [{ cantidad: 1, nombre: 'Frappe', tamano: null }], printer: 'Etiquetera de caja',
  };

  it('muestra TOTAL S/ con dos decimales cuando el trabajo lo trae', () => {
    const textos = maquetarGeneral({ ...general, total: 23.5 }).primitivas.flatMap((p) => (p.t === 'texto' ? [p.texto] : []));
    expect(textos).toContain('S/ 23.50');
  });

  it('un trabajo viejo sin total sale igual que antes (sin línea de total)', () => {
    const textos = maquetarGeneral(general).primitivas.flatMap((p) => (p.t === 'texto' ? [p.texto] : []));
    expect(textos.some((t) => t.startsWith('S/'))).toBe(false);
  });
});

describe('comanda por área (TICKET_COMANDA_AREA)', () => {
  it('su cabecera lleva el nombre del área y sus líneas', () => {
    const textos = lineasTicketComandaSalon({ ...comanda, tipo: 'TICKET_COMANDA_AREA', area: 'SALADOS' }, 32).map((l) => l.texto);
    expect(textos[0]).toBe('COMANDA · SALADOS');
    expect(textos.some((t) => t.includes('Frappe Mocha'))).toBe(true);
  });

  it('sin área la cabecera de la comanda de salón no cambia', () => {
    expect(lineasTicketComandaSalon(comanda, 32)[0].texto).toBe('COMANDA');
  });

  it('se imprime en la ticketera, como la comanda de salón', () => {
    expect(rolDeTrabajo('TICKET_COMANDA_AREA')).toBe('TICKETERA');
    expect(rolDeTrabajo('ETIQUETA_AREA')).toBe('ETIQUETERA');
  });
});

