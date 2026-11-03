import { aCentimos, calcularComprobante, centsATexto, dividirRedondeado } from './facturacion.calculo';

const base = { igvPct: 10.5 };

describe('facturacion.calculo: montos con IGV 10.5 %', () => {
  it('redondeo mitad hacia arriba en divisiones enteras', () => {
    expect(dividirRedondeado(5, 2)).toBe(3);
    expect(dividirRedondeado(4, 2)).toBe(2);
    expect(dividirRedondeado(1180 * 1000, 1105)).toBe(1068);
  });

  it('una línea de S/ 11.80: base 10.68, IGV 1.12, total 11.80', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [{ nombre: 'Frappe', cantidad: 1, subtotalCents: 1180 }],
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 1180,
    });
    expect(t.items[0]).toMatchObject({ baseCents: 1068, igvCents: 112, totalCents: 1180, precioUnitCents: 1180 });
    expect(t.totalGravadaCents).toBe(1068);
    expect(t.totalIgvCents).toBe(112);
    expect(t.totalCents).toBe(1180);
  });

  it('varias líneas: la diferencia de redondeo cae en la última y la suma cuadra al céntimo', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [
        { nombre: 'A', cantidad: 1, subtotalCents: 1180 },
        { nombre: 'B', cantidad: 1, subtotalCents: 2350 },
        { nombre: 'C', cantidad: 1, subtotalCents: 790 },
      ],
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 4320,
    });
    // bases por línea 1068 + 2127 + 715 = 3910 = base global (4320 * 1000 / 1105 = 3910.0)
    expect(t.items.map((i) => i.baseCents)).toEqual([1068, 2127, 715]);
    expect(t.items.reduce((a, i) => a + i.totalCents, 0)).toBe(4320);
    expect(t.totalGravadaCents).toBe(3910);
    expect(t.totalIgvCents).toBe(410);
    expect(t.totalGravadaCents + t.totalIgvCents).toBe(4320);
  });

  it('cantidad 3 de S/ 11.80 (3540 céntimos): precio unitario 11.80 y base de la línea 32.04', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [{ nombre: 'Frappe', cantidad: 3, subtotalCents: 3540 }],
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 3540,
    });
    expect(t.items[0].precioUnitCents).toBe(1180);
    expect(t.items[0].baseCents).toBe(3204);
    expect(t.items[0].igvCents).toBe(336);
  });

  it('descuento global de S/ 10 sobre S/ 100: base 9.05 de descuento, total 90.00', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [{ nombre: 'Combo', cantidad: 1, subtotalCents: 10000 }],
      envioCents: 0,
      descuentoCents: 1000,
      totalCents: 9000,
    });
    expect(t.descuentoBaseCents).toBe(905);
    expect(t.descuentoIgvCents).toBe(95);
    expect(t.totalGravadaCents).toBe(8145);
    expect(t.totalIgvCents).toBe(855);
    expect(t.totalCents).toBe(9000);
  });

  it('envío de delivery es un ítem propio con IGV y entra en el total', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [{ nombre: 'Waffle', cantidad: 1, subtotalCents: 2000 }],
      envioCents: 500,
      descuentoCents: 0,
      totalCents: 2500,
    });
    const envio = t.items.find((i) => i.esEnvio)!;
    expect(envio.nombre).toBe('Servicio de delivery');
    expect(envio.totalCents).toBe(500);
    expect(t.items.reduce((a, i) => a + i.totalCents, 0)).toBe(2500);
  });

  it('descuento y envío juntos: el total es subtotal + envío - descuento', () => {
    const t = calcularComprobante({
      ...base,
      lineas: [{ nombre: 'Combo', cantidad: 1, subtotalCents: 10000 }],
      envioCents: 500,
      descuentoCents: 1000,
      totalCents: 9500,
    });
    expect(t.totalCents).toBe(9500);
    expect(t.totalGravadaCents + t.totalIgvCents).toBe(9500);
  });

  it('montos que no cuadran con el total del pedido lanzan error (no se envía nada)', () => {
    expect(() =>
      calcularComprobante({
        ...base,
        lineas: [{ nombre: 'A', cantidad: 1, subtotalCents: 1180 }],
        envioCents: 0,
        descuentoCents: 0,
        totalCents: 1190,
      }),
    ).toThrow('no cuadran');
  });

  it('descuento mayor al total lanza error', () => {
    expect(() =>
      calcularComprobante({
        ...base,
        lineas: [{ nombre: 'A', cantidad: 1, subtotalCents: 1000 }],
        envioCents: 0,
        descuentoCents: 1100,
        totalCents: -100,
      }),
    ).toThrow();
  });

  it('barrido determinista: siempre cuadra (base + IGV = total; ítems suman el total)', () => {
    let semilla = 42;
    const aleatorio = (n: number) => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla % n;
    };
    for (let k = 0; k < 300; k++) {
      const n = 1 + aleatorio(5);
      const lineas = Array.from({ length: n }, (_, i) => {
        const cant = 1 + aleatorio(3);
        const precio = 100 + aleatorio(9000);
        return { nombre: `P${i}`, cantidad: cant, subtotalCents: precio * cant };
      });
      const envio = aleatorio(3) === 0 ? 0 : 100 + aleatorio(800);
      const suma = lineas.reduce((a, l) => a + l.subtotalCents, 0) + envio;
      const desc = aleatorio(2) === 0 ? 0 : aleatorio(Math.max(1, Math.floor(suma / 3)));
      const t = calcularComprobante({ ...base, lineas, envioCents: envio, descuentoCents: desc, totalCents: suma - desc });
      expect(t.totalGravadaCents + t.totalIgvCents).toBe(suma - desc);
      expect(t.totalCents).toBe(suma - desc);
      expect(t.items.reduce((a, i) => a + i.totalCents, 0)).toBe(suma);
      expect(t.items.every((i) => i.igvCents >= 0 && i.baseCents >= 0)).toBe(true);
    }
  });

  it('IGV 0 % deja la base igual al total', () => {
    const t = calcularComprobante({
      igvPct: 0,
      lineas: [{ nombre: 'A', cantidad: 1, subtotalCents: 1180 }],
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 1180,
    });
    expect(t.totalIgvCents).toBe(0);
    expect(t.totalGravadaCents).toBe(1180);
  });
});

describe('facturacion.calculo: conversiones', () => {
  it('aCentimos convierte soles y rechaza más de 2 decimales', () => {
    expect(aCentimos('10.5')).toBe(1050);
    expect(aCentimos(11.8)).toBe(1180);
    expect(() => aCentimos(1.005)).toThrow('más de 2 decimales');
  });

  it('centsATexto formatea con 2 decimales', () => {
    expect(centsATexto(1234)).toBe('12.34');
    expect(centsATexto(5)).toBe('0.05');
    expect(centsATexto(0)).toBe('0.00');
  });
});
