import { BadRequestException } from '@nestjs/common';
import {
  construirPantallaIngresoPublica,
  resolverFraseIngreso,
  resolverImagenesIngreso,
  validarPantallaIngreso,
} from '../pantalla-ingreso.util';
import { FRASE_INGRESO_POR_DEFECTO } from '../pantalla-ingreso.constantes';
import { ImagenIngreso } from '../pantalla-ingreso.tipos';

describe('pantalla-ingreso.util', () => {
  describe('resolverImagenesIngreso (lectura defensiva)', () => {
    it('devuelve la imagen por defecto si no hay valor guardado', () => {
      expect(resolverImagenesIngreso(undefined)).toEqual([
        { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
      ]);
    });

    it('descarta URLs externas, rutas con .. y nombres de fábrica inexistentes', () => {
      const res = resolverImagenesIngreso([
        { tipo: 'archivo', valor: 'https://evil.example/x.webp' },
        { tipo: 'archivo', valor: '/archivos/publico/../../etc/passwd.webp' },
        { tipo: 'defecto', valor: 'no-existe.webp' },
        { tipo: 'defecto', valor: 'donuts-halloween.webp' },
      ]);
      expect(res).toEqual([{ tipo: 'defecto', valor: 'donuts-halloween.webp' }]);
    });

    it('si nada es válido cae al valor por defecto', () => {
      expect(resolverImagenesIngreso([{ tipo: 'x', valor: 'y' }])).toEqual([
        { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
      ]);
    });
  });

  describe('resolverFraseIngreso', () => {
    it('usa la frase por defecto si falta, está vacía o supera 80 caracteres', () => {
      expect(resolverFraseIngreso(undefined)).toBe(FRASE_INGRESO_POR_DEFECTO);
      expect(resolverFraseIngreso('   ')).toBe(FRASE_INGRESO_POR_DEFECTO);
      expect(resolverFraseIngreso('a'.repeat(81))).toBe(FRASE_INGRESO_POR_DEFECTO);
    });

    it('devuelve la frase guardada sin espacios sobrantes', () => {
      expect(resolverFraseIngreso('  Bienvenida  ')).toBe('Bienvenida');
    });
  });

  describe('construirPantallaIngresoPublica', () => {
    it('resuelve defecto a /imagenes/caprichos/ y deja archivo tal cual', () => {
      const res = construirPantallaIngresoPublica({
        imagenes: [
          { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
          { tipo: 'archivo', valor: '/archivos/publico/2026/10/abc.webp' },
        ],
        frase: 'Hola',
      });
      expect(res).toEqual({
        imagenes: ['/imagenes/caprichos/fantasma-cafe.webp', '/archivos/publico/2026/10/abc.webp'],
        frase: 'Hola',
      });
    });
  });

  describe('validarPantallaIngreso (validación estricta)', () => {
    it('acepta una lista válida y normaliza la frase', () => {
      const res = validarPantallaIngreso({
        imagenes: [
          { tipo: 'defecto', valor: 'hechizo-pumpkin.webp' },
          { tipo: 'archivo', valor: '/archivos/publico/2026/10/abc-123.webp' },
        ],
        frase: '  Hecho con cariño ',
      });
      expect(res.frase).toBe('Hecho con cariño');
      expect(res.imagenes).toHaveLength(2);
    });

    it('usa la frase por defecto si la frase llega vacía', () => {
      const res = validarPantallaIngreso({
        imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
        frase: '',
      });
      expect(res.frase).toBe(FRASE_INGRESO_POR_DEFECTO);
    });

    it('rechaza lista vacía', () => {
      expect(() => validarPantallaIngreso({ imagenes: [], frase: 'x' })).toThrow(BadRequestException);
    });

    it('rechaza más de 5 imágenes', () => {
      const seis: ImagenIngreso[] = [
        'caprichos-de-octubre.webp',
        'donuts-halloween.webp',
        'fantasma-cafe.webp',
        'hechizo-pumpkin.webp',
        'caprichos-del-mes.webp',
      ].map((valor): ImagenIngreso => ({ tipo: 'defecto', valor }));
      seis.push({ tipo: 'archivo', valor: '/archivos/publico/2026/10/x.webp' });
      expect(() => validarPantallaIngreso({ imagenes: seis, frase: 'x' })).toThrow(/hasta 5/);
    });

    it('rechaza nombres de fábrica que no existen', () => {
      expect(() =>
        validarPantallaIngreso({ imagenes: [{ tipo: 'defecto', valor: 'otra.webp' }], frase: 'x' }),
      ).toThrow(BadRequestException);
    });

    it('rechaza URLs externas y rutas con path traversal', () => {
      expect(() =>
        validarPantallaIngreso({
          imagenes: [{ tipo: 'archivo', valor: 'https://ejemplo.com/a.webp' }],
          frase: 'x',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        validarPantallaIngreso({
          imagenes: [{ tipo: 'archivo', valor: '/archivos/publico/../secreto.webp' }],
          frase: 'x',
        }),
      ).toThrow(BadRequestException);
    });

    it('rechaza imágenes repetidas', () => {
      expect(() =>
        validarPantallaIngreso({
          imagenes: [
            { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
            { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
          ],
          frase: 'x',
        }),
      ).toThrow(/repetirse/);
    });

    it('rechaza frases de más de 80 caracteres y con < o >', () => {
      expect(() =>
        validarPantallaIngreso({
          imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
          frase: 'a'.repeat(81),
        }),
      ).toThrow(/80 caracteres/);
      expect(() =>
        validarPantallaIngreso({
          imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
          frase: '<b>hola</b>',
        }),
      ).toThrow(/< o >/);
    });
  });
});
