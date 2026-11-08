import { BadRequestException } from '@nestjs/common';
import { etiquetaMotivo, puedeDarCortesia, validarMotivoCortesia, MOTIVOS_CORTESIA } from '../cortesia.tipos';

describe('cortesia.tipos', () => {
  it('lista fija de motivos, con Otro al final', () => {
    expect(MOTIVOS_CORTESIA.map((m) => m.codigo)).toEqual([
      'CUMPLEANOS',
      'CLIENTE_FRECUENTE',
      'ERROR_COCINA',
      'PRUEBA',
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
    expect(validarMotivoCortesia('ERROR_COCINA', '')).toEqual({ motivo: 'ERROR_COCINA', nota: null });
  });

  it('los motivos de la lista anterior ya no se eligen pero se siguen mostrando', () => {
    expect(() => validarMotivoCortesia('RECLAMO_CLIENTE', null)).toThrow(BadRequestException);
    expect(etiquetaMotivo('RECLAMO_CLIENTE')).toBe('Reclamo del cliente');
    expect(etiquetaMotivo('ERROR_COCINA')).toBe('Error de cocina');
  });

  it('quién la da: ADMIN, SUPERVISOR, Caja y Mozo; cocina y repartidor no', () => {
    expect(puedeDarCortesia({ rol: 'CAJERO' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'ADMIN' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'SUPERVISOR' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'MOZO' })).toBe(true);
    expect(puedeDarCortesia({ rol: 'COCINA' })).toBe(false);
    expect(puedeDarCortesia({ rol: 'REPARTIDOR' })).toBe(false);
  });

});
