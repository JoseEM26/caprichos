import { describe, it, expect } from 'vitest';
import {
  sanitizarColorHex,
  sanitizarAspecto,
  fusionarAspecto,
  estaEnRango,
  calcularDuracionRango,
  resolverAspecto,
} from '../aspectoUtils';
import {
  ASPECTO_BASE_DEFECTO,
  CONFIGURACION_DEFECTO,
  TEMAS_PREDETERMINADOS,
  type ConfiguracionMascota,
} from '../tiposAspecto';

describe('aspectoUtils.ts', () => {
  describe('sanitizarColorHex', () => {
    it('acepta colores hexadecimales validos #RRGGBB', () => {
      expect(sanitizarColorHex('#e67929', '#000000')).toBe('#E67929');
      expect(sanitizarColorHex('#FFFFFF', '#000000')).toBe('#FFFFFF');
    });

    it('devuelve el fallback ante valores invalidos o no hexadecimales', () => {
      expect(sanitizarColorHex('red', '#FF0000')).toBe('#FF0000');
      expect(sanitizarColorHex('rgb(0,0,0)', '#000000')).toBe('#000000');
      expect(sanitizarColorHex('#123', '#000000')).toBe('#000000');
      expect(sanitizarColorHex(null, '#123456')).toBe('#123456');
      expect(sanitizarColorHex(undefined, '#123456')).toBe('#123456');
    });
  });

  describe('sanitizarAspecto', () => {
    it('devuelve valores por defecto ante aspecto nulo o invalido', () => {
      const res = sanitizarAspecto(null);
      expect(res).toEqual(ASPECTO_BASE_DEFECTO);
    });

    it('sanea valores fuera de listas blancas', () => {
      const res = sanitizarAspecto({
        piel: 'no-hex',
        cabello: { estilo: 'invalido', color: 'blue' },
        gorro: { tipo: 'alien', color: '#112233' },
        accesorios: ['calabaza', 'espada_laser', 'bufanda'],
      });

      expect(res.piel).toBe(ASPECTO_BASE_DEFECTO.piel);
      expect(res.cabello.estilo).toBe('colitas');
      expect(res.cabello.color).toBe(ASPECTO_BASE_DEFECTO.cabello.color);
      expect(res.gorro.tipo).toBe('chef');
      expect(res.gorro.color).toBe('#112233');
      expect(res.accesorios).toEqual(['calabaza', 'bufanda']);
    });
  });

  describe('fusionarAspecto', () => {
    it('superpone valores parciales manteniendo los campos base intactos', () => {
      const fusionado = fusionarAspecto(ASPECTO_BASE_DEFECTO, {
        gorro: { tipo: 'bruja', color: '#2B1B3F' },
        accesorios: ['calabaza'],
      });

      expect(fusionado.gorro.tipo).toBe('bruja');
      expect(fusionado.gorro.color).toBe('#2B1B3F');
      expect(fusionado.accesorios).toEqual(['calabaza']);
      expect(fusionado.piel).toBe(ASPECTO_BASE_DEFECTO.piel);
      expect(fusionado.cabello).toEqual(ASPECTO_BASE_DEFECTO.cabello);
      expect(fusionado.uniforme).toEqual(ASPECTO_BASE_DEFECTO.uniforme);
    });
  });

  describe('estaEnRango', () => {
    it('evalua rangos regulares dentro del mismo año', () => {
      expect(estaEnRango('10-27', '10-24', '11-02')).toBe(true);
      expect(estaEnRango('10-23', '10-24', '11-02')).toBe(false);
      expect(estaEnRango('11-03', '10-24', '11-02')).toBe(false);
      expect(estaEnRango('12-25', '12-01', '12-26')).toBe(true);
    });

    it('evalua rangos que cruzan fin de año (ej. 12-27 a 01-02)', () => {
      expect(estaEnRango('12-28', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('12-31', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-01', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-02', '12-27', '01-02')).toBe(true);
      expect(estaEnRango('01-03', '12-27', '01-02')).toBe(false);
      expect(estaEnRango('12-26', '12-27', '01-02')).toBe(false);
    });
  });

  describe('calcularDuracionRango', () => {
    it('calcula dias de un rango regular', () => {
      // 10-24 a 11-02 = 8 dias en oct + 2 dias en nov = 10 dias
      expect(calcularDuracionRango('10-24', '11-02')).toBe(10);
    });

    it('calcula dias de un rango cruzando el año', () => {
      // 12-27 a 01-02 = 5 dias en dic + 2 dias en ene = 7 dias
      expect(calcularDuracionRango('12-27', '01-02')).toBe(7);
    });
  });

  describe('resolverAspecto', () => {
    it('en modo AUTOMATICO aplica Halloween el 27 de octubre', () => {
      const res = resolverAspecto(CONFIGURACION_DEFECTO, '10-27');
      expect(res.tema).toBe('halloween');
      expect(res.aspecto.gorro.tipo).toBe('bruja');
      expect(res.aspecto.gorro.color).toBe('#2B1B3F');
      expect(res.aspecto.uniforme.delantal).toBe('#2B1B3F');
      expect(res.aspecto.accesorios).toContain('calabaza');
      // Mantiene la piel base
      expect(res.aspecto.piel).toBe(ASPECTO_BASE_DEFECTO.piel);
    });

    it('en modo AUTOMATICO aplica Navidad el 25 de diciembre', () => {
      const res = resolverAspecto(CONFIGURACION_DEFECTO, '12-25');
      expect(res.tema).toBe('navidad');
      expect(res.aspecto.gorro.tipo).toBe('navideno');
      expect(res.aspecto.accesorios).toContain('bufanda');
    });

    it('en modo AUTOMATICO aplica Año Nuevo el 1 de enero', () => {
      const res = resolverAspecto(CONFIGURACION_DEFECTO, '01-01');
      expect(res.tema).toBe('ano_nuevo');
      expect(res.aspecto.gorro.tipo).toBe('sombrero');
      expect(res.aspecto.accesorios).toContain('estrellas');
    });

    it('en modo AUTOMATICO devuelve base si no hay tema activo en esa fecha', () => {
      const res = resolverAspecto(CONFIGURACION_DEFECTO, '04-15');
      expect(res.tema).toBe('normal');
      expect(res.aspecto).toEqual(ASPECTO_BASE_DEFECTO);
    });

    it('en caso de superposicion de temas gana el de rango mas corto', () => {
      const config: ConfiguracionMascota = {
        base: ASPECTO_BASE_DEFECTO,
        modo: 'AUTOMATICO',
        temas: [
          {
            clave: 'largo',
            nombre: 'Largo',
            desde: '10-01',
            hasta: '10-31', // 31 días
            activo: true,
            aspecto: { gorro: { tipo: 'corona', color: '#D99E39' } },
          },
          {
            clave: 'corto',
            nombre: 'Corto',
            desde: '10-24',
            hasta: '10-28', // 5 días
            activo: true,
            aspecto: { gorro: { tipo: 'bruja', color: '#000000' } },
          },
        ],
      };

      const res = resolverAspecto(config, '10-27');
      expect(res.tema).toBe('corto');
      expect(res.aspecto.gorro.tipo).toBe('bruja');
    });

    it('en modo MANUAL respeta temaManual y tema normal', () => {
      const configManual: ConfiguracionMascota = {
        base: ASPECTO_BASE_DEFECTO,
        modo: 'MANUAL',
        temaManual: 'navidad',
        temas: TEMAS_PREDETERMINADOS,
      };

      // Aunque la fecha sea 10-27, en manual debe mostrar navidad
      const resNavidad = resolverAspecto(configManual, '10-27');
      expect(resNavidad.tema).toBe('navidad');
      expect(resNavidad.aspecto.gorro.tipo).toBe('navideno');

      // Si temaManual es normal, devuelve base
      const resNormal = resolverAspecto({ ...configManual, temaManual: 'normal' }, '10-27');
      expect(resNormal.tema).toBe('normal');
      expect(resNormal.aspecto).toEqual(ASPECTO_BASE_DEFECTO);
    });
  });
});
