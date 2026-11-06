import { BadRequestException } from '@nestjs/common';
import { puedeDarCortesia, requiereCodigoCortesia, validarMotivoCortesia, MOTIVOS_CORTESIA } from '../cortesia.tipos';

describe('cortesia.tipos', () => {
  it('lista fija de motivos, con Otro al final', () => {
    expect(MOTIVOS_CORTESIA.map((m) => m.codigo)).toEqual([
      'COMPENSACION_ERROR_DEMORA',
      'CUMPLEANOS_CLIENTE_FRECUENTE',
      'DEGUSTACION_PROMOCION',
      'RECLAMO_CLIENTE',
      'OTRO',
    ]);
  });

  it('el motivo es obligatorio y debe estar en la lista', () => {
    expect(() => validarMotivoCortesia(undefined, 'algo')).toThrow(BadRequestException);
    expect(() => validarMotivoCortesia('INVENTADO', null)).toThrow(BadRequestException);
  });

  it('con «Otro» la nota es obligatoria; sin «Otro» la nota es opcional', () => {
    expect(() => validarMotivoCortesia('OTRO', '   ')).toThrow(BadRequestException);
    expect(validarMotivoCortesia('OTRO', ' cliente pidió reponer ')).toEqual({ motivo: 'OTRO', nota: 'cliente pidió reponer' });
    expect(validarMotivoCortesia('RECLAMO_CLIENTE', '')).toEqual({ motivo: 'RECLAMO_CLIENTE', nota: null });
  });

  it('quién la da: Caja y ADMIN y SUPERVISOR; mozo, cocina y repartidor no', () => {
    expect(puedeDarCortesia({ rol: 'CAJERO' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'ADMIN' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'SUPERVISOR' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'MOZO' })).toBe(false);
    expect(puedeDarCortesia({ rol: 'COCINA' })).toBe(false);
    expect(puedeDarCortesia({ rol: 'REPARTIDOR' })).toBe(false);
  });

  it('solo el SUPERVISOR presenta código; Caja y ADMIN no', () => {
    expect(requiereCodigoCortesia({ usuario: { rol: 'SUPERVISOR' } })).toBe(true);
    expect(requiereCodigoCortesia({ usuario: { rol: 'CAJERO' } })).toBe(false);
    expect(requiereCodigoCortesia({ usuario: { rol: 'ADMIN' } })).toBe(false);
  });
});
