import {
  extraerOpciones,
  enmascararDni,
  formatearCorrelativo,
  formatearFechaHoraLima,
  validarDni,
  validarDocumentoComprobante,
  validarRuc,
} from './comprobantes.util';

describe('comprobantes.util', () => {
  describe('validarDni', () => {
    it('acepta DNI de 8 dígitos numéricos', () => {
      expect(validarDni('12345678')).toBe(true);
      expect(validarDni(' 87654321 ')).toBe(true);
      expect(validarDni('00012345')).toBe(true);
    });

    it('rechaza DNI con longitud distinta a 8', () => {
      expect(validarDni('1234567')).toBe(false); // 7 dígitos
      expect(validarDni('123456789')).toBe(false); // 9 dígitos
    });

    it('rechaza DNI con caracteres no numéricos o vacío', () => {
      expect(validarDni('1234567a')).toBe(false);
      expect(validarDni('1234-567')).toBe(false);
      expect(validarDni('')).toBe(false);
      expect(validarDni(null)).toBe(false);
      expect(validarDni(undefined)).toBe(false);
    });
  });

  describe('validarRuc (RQ-LEG-01-02)', () => {
    it('acepta RUC de 11 dígitos que inicien con 10, 15, 17 o 20', () => {
      expect(validarRuc('10123456789')).toBe(true);
      expect(validarRuc('15123456789')).toBe(true);
      expect(validarRuc('17123456789')).toBe(true);
      expect(validarRuc('20601234567')).toBe(true);
      expect(validarRuc(' 20123456789 ')).toBe(true);
    });

    it('rechaza RUC de 10 dígitos (RQ-LEG-01-02)', () => {
      expect(validarRuc('1012345678')).toBe(false);
      expect(validarRuc('2012345678')).toBe(false);
    });

    it('rechaza RUC de 11 dígitos con prefijo no permitido', () => {
      expect(validarRuc('30123456789')).toBe(false);
      expect(validarRuc('11123456789')).toBe(false);
      expect(validarRuc('99123456789')).toBe(false);
    });

    it('rechaza RUC con letras o nulo', () => {
      expect(validarRuc('2012345678a')).toBe(false);
      expect(validarRuc('')).toBe(false);
      expect(validarRuc(null)).toBe(false);
      expect(validarRuc(undefined)).toBe(false);
    });
  });

  describe('validarDocumentoComprobante', () => {
    it('acepta NOTA_VENTA sin exigir documento ni razón social', () => {
      expect(validarDocumentoComprobante('NOTA_VENTA')).toEqual({ valido: true });
      expect(validarDocumentoComprobante('nota_venta', null, null)).toEqual({ valido: true });
    });

    it('valida BOLETA con DNI válido', () => {
      expect(validarDocumentoComprobante('BOLETA', '76543210')).toEqual({ valido: true });
    });

    it('acepta BOLETA sin DNI (opcional)', () => {
      expect(validarDocumentoComprobante('BOLETA')).toEqual({ valido: true });
      expect(validarDocumentoComprobante('BOLETA', '', null)).toEqual({ valido: true });
    });

    it('rechaza BOLETA con DNI inválido', () => {
      const res = validarDocumentoComprobante('BOLETA', '12345');
      expect(res.valido).toBe(false);
      expect(res.motivo).toContain('8 dígitos');
    });

    it('valida FACTURA con RUC de 11 dígitos y razón social', () => {
      expect(
        validarDocumentoComprobante('FACTURA', '20601234567', 'Inversiones Aybar S.A.C.'),
      ).toEqual({ valido: true });
    });

    it('rechaza FACTURA con RUC de 10 dígitos (RQ-LEG-01-02)', () => {
      const res = validarDocumentoComprobante('FACTURA', '2012345678', 'Empresa SAC');
      expect(res.valido).toBe(false);
      expect(res.motivo).toContain('11 dígitos');
    });

    it('rechaza FACTURA sin razón social', () => {
      const res = validarDocumentoComprobante('FACTURA', '20601234567', '   ');
      expect(res.valido).toBe(false);
      expect(res.motivo).toContain('razón social');
    });

    it('rechaza tipos desconocidos', () => {
      const res = validarDocumentoComprobante('TICKET_FISCAL');
      expect(res.valido).toBe(false);
      expect(res.motivo).toContain('no reconocido');
    });
  });

  describe('enmascararDni', () => {
    it('enmascara DNI mostrando los 2 primeros y 2 últimos dígitos', () => {
      expect(enmascararDni('12345678')).toBe('12****78');
      expect(enmascararDni('87654321')).toBe('87****21');
    });

    it('enmascara RUC mostrando los 2 primeros y 2 últimos dígitos', () => {
      expect(enmascararDni('20601234567')).toBe('20****67');
    });

    it('devuelve **** si es corto o nulo', () => {
      expect(enmascararDni('123')).toBe('****');
      expect(enmascararDni('')).toBe('****');
      expect(enmascararDni(null)).toBe('****');
    });
  });

  describe('formatearCorrelativo', () => {
    it('rellena con ceros a 6 posiciones', () => {
      expect(formatearCorrelativo('NV01', 1)).toBe('NV01-000001');
      expect(formatearCorrelativo('NV01', 123)).toBe('NV01-000123');
      expect(formatearCorrelativo('NV01', 999999)).toBe('NV01-999999');
    });
  });

  describe('formatearFechaHoraLima', () => {
    it('formatea fecha a hora de Lima (America/Lima, UTC-5)', () => {
      const fechaUtc = new Date('2026-10-21T20:30:00.000Z'); // 15:30 en Lima
      const texto = formatearFechaHoraLima(fechaUtc);
      expect(texto).toBe('2026-10-21 15:30:00');
    });
  });

  describe('extraerOpciones', () => {
    it('extrae opciones de opcionesElegidas', () => {
      const linea = {
        opcionesElegidas: [
          { opcion_id: 10n, opcion_nombre: 'Mayonesa', grupo_nombre: 'Salsas' },
        ],
      };
      expect(extraerOpciones(linea)).toEqual([
        { id: '10', nombre: 'Mayonesa', grupo: 'Salsas' },
      ]);
    });

    it('extrae opciones de array json', () => {
      const linea = {
        opciones: [{ id: 5, nombre: 'Papas extras', grupo: 'Guarnición' }],
      };
      expect(extraerOpciones(linea)).toEqual([
        { id: '5', nombre: 'Papas extras', grupo: 'Guarnición' },
      ]);
    });

    it('devuelve array vacío si no hay opciones', () => {
      expect(extraerOpciones({})).toEqual([]);
      expect(extraerOpciones(null)).toEqual([]);
    });
  });

  it('boleta sin DNI por más de S/ 700 no es válida; con DNI o hasta S/ 700 sí', () => {
    expect(validarDocumentoComprobante('BOLETA', null, null, 700).valido).toBe(true);
    expect(validarDocumentoComprobante('BOLETA', null, null, 700.01).valido).toBe(false);
    expect(validarDocumentoComprobante('BOLETA', '12345678', null, 900).valido).toBe(true);
  });
});
