import { calcularAjusteCobro, sumarAjustesCambioDigitales, textoAvisoEnvio, textoDiferencia } from './cambio-ubicacion.util';

describe('cambio de ubicación: cálculo puro', () => {
  it('sin pago no hay ajuste de cobro (el total simplemente cambia)', () => {
    expect(calcularAjusteCobro(false, 4000, 4600)).toBeNull();
  });

  it('pagado y envío mayor: saldo por cobrar; menor: devolución; igual: nada', () => {
    expect(calcularAjusteCobro(true, 4000, 4600)).toEqual({ tipo: 'SALDO', montoC: 600 });
    expect(calcularAjusteCobro(true, 4600, 4000)).toEqual({ tipo: 'DEVOLUCION', montoC: 600 });
    expect(calcularAjusteCobro(true, 4600, 4600)).toBeNull();
  });

  it('textos de diferencia y del aviso al cliente', () => {
    expect(textoDiferencia(6)).toBe('+S/ 6.00');
    expect(textoDiferencia(-2.5)).toBe('-S/ 2.50');
    expect(textoDiferencia(0)).toBe('sin diferencia');
    expect(textoAvisoEnvio({ codigo: 'CP-1', envioAnterior: 0, envioNuevo: 6, diferencia: 6 })).toBe(
      'Actualizamos la dirección de entrega de tu pedido CP-1. Envío: S/ 0.00 → S/ 6.00. Diferencia: +S/ 6.00.',
    );
  });

  it('ajustes digitales del día: cobrados suman, devueltos restan del neto (solo COBRADO/DEVUELTO y dentro del día)', () => {
    const inicio = new Date('2026-11-06T05:00:00Z');
    const fin = new Date('2026-11-07T05:00:00Z');
    const dentro = new Date('2026-11-06T15:00:00Z');
    const fuera = new Date('2026-11-05T15:00:00Z');
    const r = sumarAjustesCambioDigitales(
      [
        { ajuste_tipo: 'SALDO', ajuste_estado: 'COBRADO', ajuste_medio: 'YAPE', ajuste_monto: 6, ajuste_en: dentro },
        { ajuste_tipo: 'DEVOLUCION', ajuste_estado: 'DEVUELTO', ajuste_medio: 'PLIN', ajuste_monto: 2.5, ajuste_en: dentro },
        { ajuste_tipo: 'SALDO', ajuste_estado: 'COBRADO', ajuste_medio: 'YAPE', ajuste_monto: 9, ajuste_en: fuera },
        { ajuste_tipo: 'SALDO', ajuste_estado: 'COBRADO', ajuste_medio: 'EFECTIVO', ajuste_monto: 4, ajuste_en: dentro },
      ],
      inicio,
      fin,
    );
    expect(r.cobrados).toEqual({ yape: 6, plin: 0, transferencia: 0, tarjeta: 0 });
    expect(r.devueltos).toEqual({ yape: 0, plin: 2.5, transferencia: 0, tarjeta: 0 });
  });
});
