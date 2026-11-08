import { describe, it, expect } from 'vitest';
import {
  generarEtiquetaGeneral,
  generarEtiquetaArea,
  generarEtiquetaBebida,
  generarTsplTrabajo,
  generarBytesTrabajo,
} from '../generadorTspl';
import { FUENTES_TSPL } from '../tipografia';
import { PAGOS_EJEMPLO } from '@caprichos/compartido';
import { muestraEtiquetaGeneral } from '../../datosMuestra';
import type {
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from '@caprichos/compartido';

const V = { formato: { orientacion: 'vertical' as const } };

/** Textos TEXT sin girar de un script: cada uno cabe en el lienzo W x H dots. */
function verificarDentro(tspl: string, W: number, H: number) {
  let n = 0;
  for (const m of tspl.matchAll(/^TEXT (\d+),(\d+),"(\d)",0,(\d+),(\d+),"(.*)"$/gm)) {
    const f = FUENTES_TSPL[m[3]];
    expect(+m[1] + m[6].length * f.ancho * +m[4], m[6]).toBeLessThanOrEqual(W);
    expect(+m[2] + f.alto * +m[5], m[6]).toBeLessThanOrEqual(H);
    n++;
  }
  expect(n).toBeGreaterThan(3);
}

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
      { cantidad: 1, nombre: 'Croissant de Jamón y Queso', opciones: ['Bien tostado'] },
      { cantidad: 2, nombre: 'Empanada de Carne', opciones: ['Con limón'] },
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

  describe('etiqueta general (100 x 100 mm, sin girar)', () => {
    it('SIZE de fábrica, sin giro, con código, modalidad, cliente y PRINT', () => {
      const tspl = generarEtiquetaGeneral(datosGeneral);
      expect(tspl).toContain('SIZE 100 mm,100 mm\r\n');
      expect(tspl).toContain('GAP 3 mm,0 mm\r\n');
      expect(tspl).toContain('DIRECTION 1\r\n');
      expect(tspl).toContain('CODEPAGE 1252\r\n');
      expect(tspl).not.toMatch(/",90,|",270,/);
      expect(tspl).toContain('PED-101');
      expect(tspl).toContain('MESA 4');
      expect(tspl).toContain('JUAN P');
      expect(tspl).toContain('PRINT 1,1\r\n');
      verificarDentro(tspl, 800, 800);
    });

    it('el rollo del agente (orientación, ancho, alto, giro) no cambia un sticker con tamaño propio', () => {
      const tspl = generarEtiquetaGeneral(datosGeneral, { formato: { orientacion: 'vertical', anchoMm: 63.5, altoMm: 101.6, giro: 270 } });
      expect(tspl).toContain('SIZE 100 mm,100 mm\r\n');
      expect(tspl).not.toMatch(/",270,/);
    });

    it('usa el tamaño que manda la API (tamanoMm) y el lienzo lo sigue', () => {
      const tspl = generarEtiquetaGeneral({ ...datosGeneral, tamanoMm: { anchoMm: 80, altoMm: 120 } });
      expect(tspl).toContain('SIZE 80 mm,120 mm\r\n');
      verificarDentro(tspl, 640, 960);
    });

    it('un tamaño fuera de rango se ignora y sale el de fábrica', () => {
      expect(generarEtiquetaGeneral({ ...datosGeneral, tamanoMm: { anchoMm: 5, altoMm: 900 } })).toContain('SIZE 100 mm,100 mm');
    });

    it('incluye número de copias cuando se solicita reimpresión o copia', () => {
      expect(generarEtiquetaGeneral(datosGeneral, { copias: 2 })).toContain('PRINT 1,2\r\n');
    });

    it('con 60 productos resume con "+ N MAS" y no escribe fuera del lienzo', () => {
      const muchos: EtiquetaGeneralDatos = {
        ...datosGeneral,
        cantidadProductos: 60,
        productos: Array.from({ length: 60 }, (_, i) => ({ cantidad: 1, nombre: `Producto ${i + 1}` })),
      };
      const tspl = generarEtiquetaGeneral(muchos);
      expect(tspl).toMatch(/\+ \d+ MAS \(\d+ UNID\.\)/);
      verificarDentro(tspl, 800, 800);
    });

    it('delivery: dirección y celular salen en el sticker', () => {
      const tspl = generarEtiquetaGeneral({ ...datosGeneral, modalidadPill: 'DELIVERY', direccion: 'Av. Larga 123', telefono: '987654321' });
      expect(tspl).toContain('DIR: Av. Larga 123');
      expect(tspl).toContain('TEL: 987654321');
    });
  });

  describe('etiqueta de área (rollo del agente)', () => {
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
      expect(tspl).toContain('Bien tostado');
      expect(tspl).toContain('Con limón');
    });

    it('soporta versión no compacta cuando es un solo producto detallado', () => {
      const noCompacta: EtiquetaAreaDatos = {
        ...datosArea,
        esCompacta: false,
        lineas: [{ cantidad: 1, nombre: 'Hamburguesa Artesanal', tamano: 'Doble', opciones: ['Término medio', 'Sin cebolla', 'Papas extra'] }],
      };
      const tspl = generarEtiquetaArea(noCompacta, V);
      expect(tspl).toContain('Hamburguesa Artesanal');
      expect(tspl).toContain('Doble');
      expect(tspl).toContain('Término medio');
    });
  });

  describe('etiqueta por bebida (vaso, 76 x 38 mm)', () => {
    it('SIZE de fábrica, código, índice 1/2, persona, bebida con tamaño, opciones, cliente y hora', () => {
      const tspl = generarEtiquetaBebida(datosBebida);
      expect(tspl).toContain('SIZE 76 mm,38 mm\r\n');
      expect(tspl).toContain('PED-101');
      expect(tspl).toContain('1/2');
      expect(tspl).toContain('MAR');
      expect(tspl).toContain('CAPPUCCINO');
      expect(tspl).toContain('12OZ');
      expect(tspl).toContain('Leche de avena');
      expect(tspl).toContain('CAPRICHOS');
      expect(tspl).toContain('+1 m\xe1s'); // con tantos datos, el ultimo se resume (max 2 lineas)
      expect(tspl).toContain('Para: Juan P');
      expect(tspl).toContain('15:30');
      expect(tspl).toContain('PRINT 1,1\r\n');
      verificarDentro(tspl, 608, 304);
    });

    it('con tamanoMm 100 x 100 cambia el SIZE y sigue cuadrando', () => {
      const tspl = generarEtiquetaBebida({ ...datosBebida, tamanoMm: { anchoMm: 100, altoMm: 100 } });
      expect(tspl).toContain('SIZE 100 mm,100 mm\r\n');
      verificarDentro(tspl, 800, 800);
    });

    it('nombres de personas largos no se salen del sticker', () => {
      const tspl = generarEtiquetaBebida({ ...datosBebida, persona: 'MAXIMILIANO DE LOS RÍOS Y OTROS APELLIDOS MUY LARGOS' });
      expect(tspl).toContain('MAXIMILIANO');
      verificarDentro(tspl, 608, 304);
    });

    it('soporta numeración variable de bebidas (ej. 3 de 5)', () => {
      expect(generarEtiquetaBebida({ ...datosBebida, bebidaIndex: 3, totalBebidas: 5 })).toContain('3/5');
    });
  });

  describe('acentos, ñ y codificación de bytes', () => {
    it('convierte texto con acentos y ñ a bytes en Windows-1252 sin caracteres corruptos UTF-8', () => {
      const bytes = generarBytesTrabajo('ETIQUETA_BEBIDA', datosBebida);
      expect(Buffer.isBuffer(bytes)).toBe(true);
      // 'Í' de MARÍA es el byte 0xCD (Windows-1252), no los dos bytes de UTF-8 [0xC3, 0x8D]
      expect(bytes.toString('hex')).toContain('4d4152cd41');
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
      verificarDentro(tspl, 800, 800);
    });
  });

  describe('generarTsplTrabajo despachador unificado', () => {
    it('despacha correctamente a cada generador según el tipo', () => {
      expect(generarTsplTrabajo('ETIQUETA_GENERAL', datosGeneral)).toContain('SIZE 100 mm,100 mm');
      expect(generarTsplTrabajo('ETIQUETA_AREA', datosArea)).toContain('COCINA');
      expect(generarTsplTrabajo('ETIQUETA_BEBIDA', datosBebida)).toContain('SIZE 76 mm,38 mm');
    });
  });

  describe('rollo del agente (solo etiqueta de área) y logo', () => {
    it('el área sigue por defecto vertical-girado sobre rollo 101.6 x 63.5 mm, con el logo en BITMAP OVERWRITE', () => {
      const t = generarEtiquetaArea(datosArea);
      expect(t).toContain('SIZE 101.6 mm,63.5 mm\r\n');
      expect(t).toContain('DIRECTION 1\r\n');
      expect(t).toMatch(/BITMAP \d+,\d+,8,64,0,/);
      expect(t).toMatch(/TEXT \d+,\d+,"\d",90,/);
      expect(t).toContain('PRINT 1,1\r\n');
    });

    it('la orientación y el tamaño del rollo siguen configurables para el área; DIRECTION y GAP también para los stickers', () => {
      expect(generarEtiquetaArea(datosArea, V)).toContain('SIZE 63.5 mm,101.6 mm\r\n');
      const c = generarEtiquetaBebida(datosBebida, { formato: { direccion: 0, gapMm: 2 } });
      expect(c).toContain('GAP 2 mm,0 mm\r\n');
      expect(c).toContain('DIRECTION 0\r\n');
    });
  });
});

describe('sticker de despacho con bloque de pago', () => {
  it('con `pago` dibuja el recuadro; sin `pago` (servidor viejo) sale el sticker de siempre', () => {
    const sin = generarTsplTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral, false);
    const con = generarTsplTrabajo('ETIQUETA_GENERAL', { ...muestraEtiquetaGeneral, pago: PAGOS_EJEMPLO.deliveryContraEntrega }, false);
    expect(sin).not.toContain('"PAGO"');
    expect(con).toContain('"PAGO"');
    expect(con).toContain('COBRAR AL ENTREGAR: S/ 38.50');
    expect(generarTsplTrabajo('ETIQUETA_GENERAL', { ...muestraEtiquetaGeneral, pago: null }, false)).toBe(sin);
  });
});
