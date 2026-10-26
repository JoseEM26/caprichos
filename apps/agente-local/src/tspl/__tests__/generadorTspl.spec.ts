import { describe, it, expect } from 'vitest';
import {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
  generarBytesTrabajo,
} from '../generadorTspl';
import type {
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from '@caprichos/compartido';

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
      const tspl = generarEtiquetaGeneral(datosGeneral);
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
      const tspl = generarEtiquetaGeneral(conMuchosProductos);
      expect(tspl).toContain('+ 2 producto(s)');
    });
  });

  describe('etiqueta de área', () => {
    it('genera cabecera con el nombre de área e índice', () => {
      const tspl = generarEtiquetaArea(datosArea);
      expect(tspl).toContain('COCINA');
      expect(tspl).toContain('Area 1 de 2');
      expect(tspl).toContain('REVERSE 28,28,452,78\r\n');
      expect(tspl).toContain('PED-101');
      expect(tspl).toContain('MESA 4');
      expect(tspl).toContain('PRINT 1,1\r\n');
    });

    it('soporta versión compacta cuando hay múltiples líneas', () => {
      const tspl = generarEtiquetaArea(datosArea);
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
      const tspl = generarEtiquetaArea(noCompacta);
      expect(tspl).toContain('Hamburguesa Artesanal');
      expect(tspl).toContain('Doble');
      expect(tspl).toContain('Término medio');
    });
  });

  describe('etiqueta por bebida (vaso)', () => {
    it('genera nombre del bebedor gigante, bebida, opciones y recuadro contiene', () => {
      const tspl = generarEtiquetaBebida(datosBebida);
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
      const tspl = generarEtiquetaBebida(nombreLargo);
      // No debe romperse ni desbordar; debe estar contenido
      expect(tspl).toContain('MAXIMILIANO');
    });

    it('soporta numeración variable de bebidas (ej. 3 de 5)', () => {
      const bebida3de5: EtiquetaBebidaDatos = {
        ...datosBebida,
        bebidaIndex: 3,
        totalBebidas: 5,
      };
      const tspl = generarEtiquetaBebida(bebida3de5);
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
      const tspl = generarEtiquetaGeneral(conTextoExtremo);
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
});
