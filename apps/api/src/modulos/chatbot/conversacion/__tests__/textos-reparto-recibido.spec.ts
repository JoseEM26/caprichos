import { construirResumenRecibido, ResumenRecibido, TEXTOS_REPARTO, textoResumenRecibido, conBienvenidaPuntos } from '../textos-reparto';

const datosPlin = '📲 Plin:\n• Número: 977503006\n• Titular: Maria Perez\n• Monto: S/ 12.37';
const ctxPlin = { nombre: 'Alejandro', codigo: 'CP-W099', medioDigital: 'Plin', datosPago: datosPlin, enlace: 'https://x/?seguimiento=CP-W099' };

const delivery: ResumenRecibido = {
  lineas: ['1 x FRAPPE CARAMEL CLÁSICO'],
  total: 12.37,
  medioPago: 'Plin',
  envioPorConfirmar: true,
  modalidad: 'DELIVERY',
  direccion: 'Av. Los Olivos 123',
  referencia: 'Frente al parque',
  clienteNombre: 'Alejandro',
  clienteTelefono: '987654321',
  subtotal: 12.37,
  pagoEstado: 'PENDIENTE',
};

const sinDobles = (t: string) => expect(t).not.toMatch(/\n{3,}/);
const sinBasura = (t: string) => {
  expect(t).not.toContain('undefined');
  expect(t).not.toContain('null');
  expect(t).not.toContain('NaN');
};

describe('aviso «Recibimos tu pedido» completo', () => {
  it('delivery sin ubicación (Plin): reproduce el caso real CP-W099 y lo compara con el texto nuevo', () => {
    const viejo = [
      '¡Hola Alejandro! 😊 Recibimos tu pedido CP-W099, ¡muchas gracias! 🎉',
      '🧾 Tu pedido:\n• 1 x FRAPPE CARAMEL CLÁSICO\n💰 Total: S/ 12.37 (sin envío)',
      `💳 Pago por Plin:\n${datosPlin}\ntu pedido ya está en marcha. Cuando puedas, envíanos por aquí mismo la captura (foto) de tu pago 📸 (opcional) y un asesor la revisará. 🙏`,
    ].join('\n\n');
    const nuevo = textoResumenRecibido(delivery, ctxPlin);
    expect(nuevo).not.toBe(viejo);
    expect(nuevo).not.toContain('tu pedido ya está en marcha');
    expect(nuevo).toBe(
      [
        '¡Hola Alejandro! 😊\nRecibimos tu pedido *CP-W099*, ¡muchas gracias! 🎉',
        '*Tipo de pedido*\n🛵 Delivery\n📍 Av. Los Olivos 123\n🔖 Referencia: Frente al parque',
        '📍 *Falta tu ubicación*\nEnvíanos tu ubicación: toca el clip 📎 → Ubicación → Enviar tu ubicación actual. Con ella calculamos tu envío.',
        '👤 Alejandro · 📱 987654321',
        '*Tu pedido*\n• 1 x FRAPPE CARAMEL CLÁSICO',
        '*Resumen de pago*\nSubtotal: S/ 12.37\nEnvío: por confirmar\n*TOTAL: S/ 12.37* + envío por confirmar',
        `*Cómo pagas*\n${datosPlin}\n⏳ Pago pendiente`,
        '📸 Envíanos la captura de tu pago por aquí cuando puedas (opcional). Un asesor la revisará. 🙏',
        'Sigue tu pedido aquí: https://x/?seguimiento=CP-W099',
      ].join('\n\n'),
    );
    sinDobles(nuevo);
  });

  it('delivery con ubicación y envío: dirección, envío, sin pedir ubicación', () => {
    const t = textoResumenRecibido({ ...delivery, envioPorConfirmar: false, envio: 5, total: 17.37 }, ctxPlin);
    expect(t).toContain('Envío: S/ 5.00');
    expect(t).toContain('*TOTAL: S/ 17.37*');
    expect(t).not.toContain('Falta tu ubicación');
    expect(t).not.toContain('por confirmar');
  });

  it('envío gratis', () => {
    expect(textoResumenRecibido({ ...delivery, envioPorConfirmar: false, envio: 0 }, ctxPlin)).toContain('Envío: gratis');
  });

  it('delivery en efectivo con vuelto y exacto, estado «Se cobra al recibir»', () => {
    const base: ResumenRecibido = { ...delivery, envioPorConfirmar: false, envio: 4, total: 31.75, medioPago: 'efectivo' };
    const ctx = { nombre: 'A', codigo: 'CP-1' };
    const con = textoResumenRecibido({ ...base, efectivo: { aPagar: 31.75, pagaCon: 50 } }, ctx);
    expect(con).toContain('💵 Pagas en efectivo al recibir: S/ 31.75');
    expect(con).toContain('🪙 Pagas con S/ 50.00 · vuelto S/ 18.25');
    expect(con).toContain('Se cobra al recibir');
    expect(con).not.toContain('captura');
    const exacto = textoResumenRecibido({ ...base, efectivo: { aPagar: 31.75, pagaCon: null } }, ctx);
    expect(exacto).toContain('Sin vuelto (pago exacto)');
    expect(textoResumenRecibido(base, ctx)).not.toContain('Pagas en efectivo');
  });

  it('tarjeta: se paga con POS al recibir', () => {
    const t = textoResumenRecibido({ ...delivery, envioPorConfirmar: false, medioPago: 'tarjeta', conTarjeta: true }, { nombre: 'A', codigo: 'CP-1' });
    expect(t).toContain('Pagas con tarjeta (POS) al recibir');
    expect(t).toContain('Se cobra al recibir');
  });

  it('pago dividido: monto por medio, efectivo con vuelto y datos del medio digital en su bloque', () => {
    const t = textoResumenRecibido(
      {
        ...delivery,
        envioPorConfirmar: false,
        total: 30,
        pagos: [{ medio: 'YAPE', monto: 20 }, { medio: 'EFECTIVO', monto: 10 }],
        efectivo: { aPagar: 10, pagaCon: 20 },
      },
      { ...ctxPlin, medioDigital: 'Yape', datosPago: '📲 Yape:\n• Número: 999' },
    );
    expect(t).toContain('• Yape: S/ 20.00');
    expect(t).toContain('• Efectivo: S/ 10.00');
    expect(t).toContain('Pagas con S/ 20.00 · vuelto S/ 10.00');
    expect(t).toContain('*Datos para tu pago por Yape*\n📲 Yape:\n• Número: 999');
    sinDobles(t);
  });

  it('recoger en el local: dirección del local si existe', () => {
    const r: ResumenRecibido = { lineas: ['2 x Dona'], total: 10, medioPago: 'efectivo', envioPorConfirmar: false, modalidad: 'RECOJO', localDireccion: 'Av. Principal 123', efectivo: { aPagar: 10 } };
    const t = textoResumenRecibido(r, { nombre: 'A', codigo: 'CP-2' });
    expect(t).toContain('🏪 Recoger en el local');
    expect(t).toContain('📍 Recoges en: Av. Principal 123');
    expect(textoResumenRecibido({ ...r, localDireccion: null }, { nombre: 'A', codigo: 'CP-2' })).not.toContain('Recoges en');
  });

  it('para llevar y mesa', () => {
    const r: ResumenRecibido = { lineas: ['1 x Café'], total: 5, medioPago: 'efectivo', envioPorConfirmar: false };
    const ctx = { nombre: 'A', codigo: 'CP-3' };
    expect(textoResumenRecibido({ ...r, modalidad: 'LLEVAR' }, ctx)).toContain('🥡 Para llevar');
    const mesa = textoResumenRecibido({ ...r, modalidad: 'MESA', mesa: 'Mesa 4' }, ctx);
    expect(mesa).toContain('🍽️ En mesa');
    expect(mesa).toContain('🪑 Mesa 4');
    expect(textoResumenRecibido({ ...r, modalidad: 'COMER_LOCAL' }, ctx)).toContain('Comer en el local');
  });

  it('descuento con nombre de la oferta y propina', () => {
    const t = textoResumenRecibido({ ...delivery, envioPorConfirmar: false, subtotal: 20, descuento: 2, descuentoNombre: '2x1 Frappés', propina: 1, total: 18 }, ctxPlin);
    expect(t).toContain('Subtotal: S/ 20.00');
    expect(t).toContain('Descuento (2x1 Frappés): -S/ 2.00');
    expect(t).toContain('Propina: S/ 1.00 (aparte del total)');
    expect(t).toContain('*TOTAL: S/ 18.00*');
    expect(textoResumenRecibido({ ...delivery, descuento: 0, propina: 0 }, ctxPlin)).not.toMatch(/Descuento|Propina/);
  });

  it('combo con sus partes con sangría bajo el combo', () => {
    const t = textoResumenRecibido({ ...delivery, lineas: ['1 x COMBO DÚO (Grande)\n   ◦ 1 x Frappé\n   ◦ 1 x Dona'] }, ctxPlin);
    expect(t).toContain('• 1 x COMBO DÚO (Grande)\n   ◦ 1 x Frappé\n   ◦ 1 x Dona');
  });

  it('comprobante: boleta, factura a RUC y sin comprobante', () => {
    expect(textoResumenRecibido({ ...delivery, comprobanteTipo: 'BOLETA' }, ctxPlin)).toContain('🧾 Comprobante: Boleta');
    const f = textoResumenRecibido({ ...delivery, comprobanteTipo: 'FACTURA', comprobanteDoc: '20123456789', comprobanteRazon: 'ACME SAC' }, ctxPlin);
    expect(f).toContain('Factura a RUC 20123456789 (ACME SAC)');
    expect(textoResumenRecibido({ ...delivery, comprobanteTipo: 'SIMPLE' }, ctxPlin)).not.toContain('Comprobante');
  });

  it('tiempo estimado solo si existe', () => {
    expect(textoResumenRecibido({ ...delivery, tiempoEstimado: '25 a 30' }, ctxPlin)).toContain('⏱️ Tiempo estimado: 25 a 30 minutos');
    expect(textoResumenRecibido(delivery, ctxPlin)).not.toContain('Tiempo estimado');
  });

  it('pedido enorme: recorta la lista de productos, nunca el total ni el pago', () => {
    const lineas = Array.from({ length: 300 }, (_, i) => `1 x Producto número ${i + 1} con nombre bastante largo para llenar`);
    const t = textoResumenRecibido({ ...delivery, lineas, envioPorConfirmar: false, total: 999.5 }, ctxPlin);
    expect(t.length).toBeLessThan(4096);
    expect(t).toMatch(/• y \d+ productos más/);
    expect(t).toContain('*TOTAL: S/ 999.50*');
    expect(t).toContain('Número: 977503006');
    expect(t).toContain('Sigue tu pedido aquí');
    expect(t.indexOf('productos más')).toBeLessThan(t.indexOf('*Resumen de pago*'));
  });

  it('sin campos opcionales: nada de undefined, null ni huecos', () => {
    const minimo: ResumenRecibido = { lineas: ['1 x Dona'], total: 5, medioPago: 'por coordinar', envioPorConfirmar: false };
    const t = textoResumenRecibido(minimo, { nombre: 'A', codigo: 'CP-9' });
    sinBasura(t);
    sinDobles(t);
    expect(t).not.toContain('Tipo de pedido');
    expect(t).not.toContain('Subtotal');
    expect(t).toContain('*TOTAL: S/ 5.00*');
    const secciones = construirResumenRecibido({ ...delivery, referencia: undefined, clienteTelefono: null }, ctxPlin);
    expect(secciones.every((s) => s.trim() !== '' && !s.includes('\n\n'))).toBe(true);
    sinBasura(secciones.join('\n\n'));
  });

  it('un solo salto de línea doble entre secciones', () => {
    sinDobles(textoResumenRecibido({ ...delivery, comprobanteTipo: 'BOLETA', tiempoEstimado: '20' }, ctxPlin));
  });
});

describe('recibidoDigital / recibidoEfectivo con resumen', () => {
  it('la plantilla de Meta no cambia (misma clave y variables)', () => {
    const d = TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', null, delivery, 'datos');
    expect(d.plantillaClave).toBe('CARTA_RECIBIDO_DIGITAL');
    expect(d.variablesPlantilla).toEqual(['A', 'CP-1', 'Yape']);
    const e = TEXTOS_REPARTO.recibidoEfectivo('A', 'CP-1', null, false, delivery);
    expect(e.plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    expect(e.variablesPlantilla).toEqual(['A', 'CP-1']);
    const s = TEXTOS_REPARTO.recibidoEfectivo('A', 'CP-1', 'https://x', true, delivery);
    expect(s.plantillaClave).toBe('CARTA_RECIBIDO_SEGUIMIENTO');
    expect(s.variablesPlantilla).toEqual(['A', 'CP-1', 'https://x']);
  });

  it('recibidoDigital usa el texto completo', () => {
    const t = TEXTOS_REPARTO.recibidoDigital('Alejandro', 'CP-W099', 'Plin', 'https://x/s', delivery, datosPlin).textoLibre;
    expect(t).toContain('*Cómo pagas*');
    expect(t).toContain('Número: 977503006');
    expect(t.indexOf('977503006')).toBeLessThan(t.indexOf('captura'));
  });

  it('sin resumen mantiene el texto de siempre', () => {
    expect(TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', null).textoLibre).toContain('Tu pedido ya está en marcha');
  });

  it('la bienvenida de puntos se anexa tras una línea en blanco', () => {
    const base = TEXTOS_REPARTO.recibidoDigital('A', 'CP-1', 'Yape', 'https://x/s', delivery, 'datos');
    const t = conBienvenidaPuntos(base, 'A', 'CP-1', 'https://x/?puntos=1', false).textoLibre;
    expect(t).toContain('\n\nYa sumas puntos con este número. Ve tus puntos aquí: https://x/?puntos=1');
  });
});
