import { describe, it, expect } from 'vitest';
import {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
  generarBytesTrabajo,
} from '../generadorTspl';
import { LOGO_BASE64 } from '../logoBitmap';
import type {
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from '@caprichos/compartido';

const V = { formato: { orientacion: 'vertical' as const } };
const H = { formato: { orientacion: 'horizontal' as const } };

describe('generadorTspl', () => {
  const datosGeneral: EtiquetaGeneralDatos = {
    codigo: 'PED-101',
    modalidad: 'SALON',
    modalidadPill: 'MESA 4',
    who: 'Juan Pérez Ñaña',
    canal: 'Caja',
    hora: '15:30',
    fecha: '26/10/2026',
    cantidadProductos: 3,
    productos: [
      { cantidad: 1, nombre: 'Americano Clásico', tamano: '8oz' },
      { cantidad: 1, nombre: 'Croissant de Jamón y Queso' },
      { cantidad: 1, nombre: 'Jugo de Naranja' },
    ],
    nota: 'Entregar caliente y sin azúcar',
    printer: 'Etiquetera de caja',
  };

  const datosArea: EtiquetaAreaDatos = {
    areaNombre: 'COCINA',
    areaIndex: 1,
    totalAreas: 2,
    codigo: 'PED-101',
    modalidadPill: 'MESA 4',
    who: 'Juan Pérez',
    canal: 'Caja',
    hora: '15:30',
    fecha: '26/10/2026',
    lineas: [
      {
        cantidad: 1,
        nombre: 'Croissant de Jamón y Queso',
        opciones: ['Bien tostado'],
      },
      {
        cantidad: 2,
        nombre: 'Empanada de Carne',
        opciones: ['Con limón'],
      },
    ],
    esCompacta: true,
    nota: 'Mesa con niños',
    printer: 'Etiquetera de cocina',
  };

  const datosBebida: EtiquetaBebidaDatos = {
    bebidaIndex: 1,
    totalBebidas: 2,
    codigo: 'PED-101',
    persona: 'MARÍA',
    bebidaNombre: 'CAPPUCCINO VAINILLA',
    tamano: '12oz',
    opciones: ['Leche de avena', 'Sin azúcar', 'Extra canela'],
    contiene: 'Avena, canela, espresso doble',
    who: 'Para: Juan Pérez',
    hora: '15:30',
  };

  describe('etiqueta general', () => {
    it('genera comandos iniciales, marco doble, cabecera y pie requeridos', () => {
      const tspl = generarEtiquetaGeneral(datosGeneral, V);
      expect(tspl).toContain('SIZE 63.5 mm,101.6 mm\r\n');
      expect(tspl).toContain('GAP 3 mm,0 mm\r\n');
      expect(tspl).toContain('DIRECTION 1\r\n');
      expect(tspl).toContain('CLS\r\n');
      expect(tspl).toContain('CODEPAGE 1252\r\n');
      // Marco doble
      expect(tspl).toContain('BOX 16,16,492,796,4,16\r\n');
      expect(tspl).toContain('BOX 26,26,482,786,2,10\r\n');
      // Cabecera negra con CAPRICHOS y REVERSE
      expect(tspl).toContain('CAPRICHOS');
      expect(tspl).toContain('Pedido completo');
      expect(tspl).toContain('REVERSE 28,28,452,78\r\n');
      // Rombo separador
      expect(tspl).toContain('BAR 36,');
      // Codigo del pedido y modalidad pill
      expect(tspl).toContain('PED-101');
      expect(tspl).toContain('MESA 4');
      // Pie y PRINT
      expect(tspl).toContain('Sale en: Etiquetera de caja');
      expect(tspl).toContain('26/10/2026');
      expect(tspl).toContain('PRINT 1,1\r\n');
    });

    it('incluye número de copias cuando se solicita reimpresion o copia', () => {
      const tspl = generarEtiquetaGeneral(datosGeneral, { copias: 2 });
      expect(tspl).toContain('PRINT 1,2\r\n');
    });

    it('muestra indicador de más productos cuando la lista supera 5', () => {
      const conMuchosProductos: EtiquetaGeneralDatos = {
        ...datosGeneral,
        cantidadProductos: 7,
        productos: [
          { cantidad: 1, nombre: 'P1' },
          { cantidad: 1, nombre: 'P2' },
          { cantidad: 1, nombre: 'P3' },
          { cantidad: 1, nombre: 'P4' },
          { cantidad: 1, nombre: 'P5' },
          { cantidad: 1, nombre: 'P6' },
          { cantidad: 1, nombre: 'P7' },
        ],
      };
      const tspl = generarEtiquetaGeneral(conMuchosProductos, V);
      expect(tspl).toContain('+ 2 producto(s)');
    });
  });

  describe('etiqueta de área', () => {
    it('genera cabecera con el nombre de área e índice', () => {
      const tspl = generarEtiquetaArea(datosArea, V);
      expect(tspl).toContain('COCINA');
      expect(tspl).toContain('Area 1 de 2');
      expect(tspl).toContain('REVERSE 28,28,452,78\r\n');
      expect(tspl).toContain('PED-101');
      expect(tspl).toContain('MESA 4');
      expect(tspl).toContain('PRINT 1,1\r\n');
    });

    it('soporta versión compacta cuando hay múltiples líneas', () => {
      const tspl = generarEtiquetaArea(datosArea, V);
      // En compacta las opciones van en la misma línea separadas por coma
      expect(tspl).toContain('Bien tostado');
      expect(tspl).toContain('Con limón');
    });

    it('soporta versión no compacta cuando es un solo producto detallado', () => {
      const noCompacta: EtiquetaAreaDatos = {
        ...datosArea,
        esCompacta: false,
        lineas: [
          {
            cantidad: 1,
            nombre: 'Hamburguesa Artesanal',
            tamano: 'Doble',
            opciones: ['Término medio', 'Sin cebolla', 'Papas extra'],
          },
        ],
      };
      const tspl = generarEtiquetaArea(noCompacta, V);
      expect(tspl).toContain('Hamburguesa Artesanal');
      expect(tspl).toContain('Doble');
      expect(tspl).toContain('Término medio');
    });
  });

  describe('etiqueta por bebida (vaso)', () => {
    it('genera nombre del bebedor gigante, bebida, opciones y recuadro contiene', () => {
      const tspl = generarEtiquetaBebida(datosBebida, V);
      expect(tspl).toContain('BEBIDA 1 de 2');
      expect(tspl).toContain('MARÍA');
      expect(tspl).toContain('CAPPUCCINO VAINILLA');
      expect(tspl).toContain('12oz');
      expect(tspl).toContain('Leche de avena');
      expect(tspl).toContain('CONTIENE:');
      expect(tspl).toContain('Avena, canela, espresso doble');
      expect(tspl).toContain('Para: Juan Pérez');
      expect(tspl).toContain('15:30');
      expect(tspl).toContain('PRINT 1,1\r\n');
    });

    it('adapta el tamaño de fuente para nombres de personas largos', () => {
      const nombreLargo: EtiquetaBebidaDatos = {
        ...datosBebida,
        persona: 'MAXIMILIANO DE LOS RÍOS',
      };
      const tspl = generarEtiquetaBebida(nombreLargo, V);
      // No debe romperse ni desbordar; debe estar contenido
      expect(tspl).toContain('MAXIMILIANO');
    });

    it('soporta numeración variable de bebidas (ej. 3 de 5)', () => {
      const bebida3de5: EtiquetaBebidaDatos = {
        ...datosBebida,
        bebidaIndex: 3,
        totalBebidas: 5,
      };
      const tspl = generarEtiquetaBebida(bebida3de5, V);
      expect(tspl).toContain('BEBIDA 3 de 5');
    });
  });

  describe('acentos, ñ y codificación de bytes', () => {
    it('convierte texto con acentos y ñ a bytes en Windows-1252 sin caracteres corruptos UTF-8', () => {
      const bytes = generarBytesTrabajo('ETIQUETA_BEBIDA', datosBebida);
      expect(Buffer.isBuffer(bytes)).toBe(true);

      // Verificamos que 'Í' de MARÍA se codifica en byte 0xCD (Windows-1252), no los dos bytes de UTF-8 [0xC3, 0x8D]
      const hex = bytes.toString('hex');
      expect(hex).toContain('4d4152cd41'); // M A R Í A en hex CP1252 (Í = CD)
    });
  });

  describe('cortes de textos largos con ...', () => {
    it('trunca nombres de productos y notas extremadamente largas con ... sin desbordar', () => {
      const conTextoExtremo: EtiquetaGeneralDatos = {
        ...datosGeneral,
        who: 'CLIENTE CON UN NOMBRE EXTREMADAMENTE LARGO QUE EXCEDE CUALQUIER ANCHO NORMAL DE ETIQUETA FISICA',
        nota: 'ESTA ES UNA NOTA GIGANTE ESCRITA POR UN CLIENTE QUE QUIERE DESCRIBIR CADA DETALLE DE COMO PREPARAR SU PEDIDO CON VEINTE CONDICIONES DISTINTAS',
      };
      const tspl = generarEtiquetaGeneral(conTextoExtremo, V);
      expect(tspl).toContain('...');
      expect(tspl).toContain('CLIENTE');
    });
  });

  describe('generarTsplTrabajo despachador unificado', () => {
    it('despacha correctamente a cada generador segun el tipo', () => {
      const general = generarTsplTrabajo('ETIQUETA_GENERAL', datosGeneral);
      expect(general).toContain('PEDIDO');

      const area = generarTsplTrabajo('ETIQUETA_AREA', datosArea);
      expect(area).toContain('COCINA');

      const bebida = generarTsplTrabajo('ETIQUETA_BEBIDA', datosBebida);
      expect(bebida).toContain('BEBIDA 1 de 2');
    });
  });

  describe('formato apaisado (defecto) y logo', () => {
    it('por defecto sale vertical-girado sobre rollo 101.6 x 63.5 mm, DIRECTION 1, con el logo en BITMAP OVERWRITE', () => {
      for (const t of [
        generarEtiquetaGeneral(datosGeneral),
        generarEtiquetaArea(datosArea),
        generarEtiquetaBebida(datosBebida),
      ]) {
        expect(t).toContain('SIZE 101.6 mm,63.5 mm\r\n');
        expect(t).toContain('DIRECTION 1\r\n');
        expect(t).toMatch(/BITMAP \d+,\d+,8,64,0,/);
        expect(t).toMatch(/REVERSE \d+,28,84,452/);
        expect(t).toMatch(/TEXT \d+,\d+,"\d",90,/);
        expect(t).toContain('PRINT 1,1\r\n');
      }
    });

    it('el contenido cabe en el lienzo 813 x 508 dots', () => {
      const t = generarEtiquetaGeneral(datosGeneral, H);
      for (const m of t.matchAll(/^TEXT (\d+),(\d+),/gm)) {
        expect(Number(m[1])).toBeLessThan(813);
        expect(Number(m[2])).toBeLessThan(508);
      }
    });

    it('la orientacion y el tamano son configurables', () => {
      const v = generarEtiquetaGeneral(datosGeneral, V);
      expect(v).toContain('SIZE 63.5 mm,101.6 mm\r\n');
      expect(v).toMatch(/BITMAP \d+,\d+,8,64,0,/);
      const c = generarEtiquetaBebida(datosBebida, { formato: { anchoMm: 100, altoMm: 60, direccion: 0, gapMm: 2 } });
      expect(c).toContain('SIZE 100 mm,60 mm\r\n');
      expect(c).toContain('GAP 2 mm,0 mm\r\n');
      expect(c).toContain('DIRECTION 0\r\n');
    });

    it('los bytes llevan el bitmap del logo crudo (512 bytes) y el texto en Windows-1252', () => {
      const bytes = generarBytesTrabajo('ETIQUETA_GENERAL', datosGeneral, false, { orientacion: 'horizontal' });
      const i = bytes.indexOf(Buffer.from('BITMAP 34,34,8,64,0,'));
      expect(i).toBeGreaterThan(0);
      const logo = Buffer.from(LOGO_BASE64, 'base64');
      expect(bytes.subarray(i + 20, i + 20 + 512).equals(logo)).toBe(true);
      expect(bytes.subarray(i + 20 + 512, i + 20 + 514).toString()).toBe('\r\n');
      expect(bytes.includes(Buffer.from('J'))).toBe(true);
    });
  });
});
