import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { opcionesBilletes, parsearMonto, calcularTotales } from '../flujos/pedido/pago-bot.util';
import { PagoPlanService } from '../../../pedidos/pago-plan.service';
import { TEXTOS_BOT } from '../textos-bot';

const ctx = (mediosPago?: any): ContextoConversacion => ({
  nombreCliente: 'Kevin Rosales',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: { abierta: true, direccion: 'x', enlaceMapa: 'm' } as any,
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, envioGratis: 1, ...(mediosPago ? { mediosPago } : {}) },
  categoriasCarta: [],
  ofertas: [],
});
const TODOS = { efectivo: { activo: true }, yape: { activo: true }, plin: { activo: true }, tarjeta: { activo: true }, transferencia: { activo: true } };

const item = (nombre: string, cantidad: number, precio: number, tam?: string) => ({
  lineaId: nombre, productoId: nombre, productoNombre: nombre, categoriaId: 'c', categoriaNombre: 'C',
  tamanoNombre: tam, cantidad, precioUnitario: precio, subtotal: cantidad * precio, opciones: [], noSumaBeneficios: false,
});

function flujoPago(extra: any = {}, estado = 'PEDIDO_MEDIO_PAGO'): FlujoConversacion {
  return {
    version: 2, repreguntasFallidas: 0, estado: estado as any,
    pedido: {
      estadoInterno: estado, modalidad: 'RECOGER', cuponPreguntado: true,
      items: [item('Hamburguesa', 2, 26, 'Doble'), item('Frappe', 1, 10.5)],
      cliente: { nombre: 'Kevin Rosales', telefono: '987654321' }, telefonoSugerido: '987654321',
      comprobante: { tipo: 'NINGUNO' },
      ...extra,
    },
  } as any;
}
const paso = (f: FlujoConversacion, e: any, c = ctx(TODOS)) => transicionarEstado(f, normalizarEntrada(e), c);
const textos = (r: any) => r.acciones.map((a: any) => a.texto).join('\n---\n');

describe('Pagos del bot', () => {
  describe('resumen con total antes de pagar', () => {
    it('lista cantidad, tamaño, precios, subtotal, delivery y TOTAL en negrita (sin descuentos)', () => {
      const f = flujoPago({ modalidad: 'DELIVERY', entrega: { modalidad: 'DELIVERY', tarifaEnvio: 5 } }, 'PEDIDO_INGRESAR_TELEFONO');
      (f.pedido as any).cliente.telefono = undefined;
      const r = paso(f, { buttonPayload: 'ped_tel_mismo' });
      const t = (r.acciones[0] as any).texto as string;
      expect(t).toContain('2× Hamburguesa · Doble — S/ 52.00');
      expect(t).toContain('Frappe — S/ 10.50');
      expect(t).toContain('Subtotal: S/ 62.50');
      expect(t).not.toMatch(/descuento|cup[oó]n/i);
      expect(t).toContain('Delivery: S/ 5.00');
      expect(t).toContain('*TOTAL: S/ 67.50*');
      // Un solo mensaje: el resumen y la pregunta de pago juntos
      expect(t.endsWith('¿Cómo pagarás?')).toBe(true);
      expect(r.acciones).toHaveLength(1);
    });
    it('delivery gratis y recojo en tienda', () => {
      const g = paso(flujoPago({ modalidad: 'DELIVERY', entrega: { modalidad: 'DELIVERY', tarifaEnvio: 0 } }, 'PEDIDO_INGRESAR_TELEFONO'), { buttonPayload: 'ped_tel_mismo' });
      expect(textos(g)).toContain('Delivery gratis');
      const f = flujoPago({}, 'PEDIDO_INGRESAR_TELEFONO'); (f.pedido as any).cliente.telefono = undefined;
      expect(textos(paso(f, { buttonPayload: 'ped_tel_mismo' }))).toContain('Recojo en tienda');
    });
  });

  describe('medios de pago', () => {
    it('con más de 3 medios usa lista «Elegir medio de pago» con Tarjeta, Transferencia y dividir', () => {
      const r = paso(flujoPago(), { texto: 'xyz' });
      const a: any = r.acciones[0];
      expect(a.tipo).toBe('enviarLista');
      expect(a.botonTexto).toBe('Elegir medio de pago');
      const ids = a.filas.map((x: any) => x.id);
      expect(ids).toEqual(expect.arrayContaining(['ped_pago_tarjeta', 'ped_pago_transf', 'ped_pago_dividir']));
    });
    it('respeta los medios activos del local (solo efectivo y yape: botones)', () => {
      const r = paso(flujoPago(), { texto: 'xyz' }, ctx({ efectivo: { activo: true }, yape: { activo: true } }));
      const a: any = r.acciones[0];
      expect(a.tipo).toBe('enviarBotones');
      expect(a.botones.map((b: any) => b.id)).toEqual(['ped_pago_efectivo', 'ped_pago_yape', 'ped_pago_dividir']);
    });
    it('tarjeta: delivery = POS del repartidor, recojo = en caja; sin voucher ni vuelto; DTO TARJETA', () => {
      const d = paso(flujoPago({ modalidad: 'DELIVERY', entrega: { modalidad: 'DELIVERY', tarifaEnvio: 0, direccion: 'Av 1' } }), { buttonPayload: 'ped_pago_tarjeta' });
      expect((d.acciones[0] as any).texto).toContain('el repartidor lleva el POS');
      const rj = paso(flujoPago(), { buttonPayload: 'ped_pago_tarjeta' });
      expect((rj.acciones[0] as any).texto).toContain('en caja');
      const fin = paso(rj.nuevoFlujo, { buttonPayload: 'ped_confirmar' });
      const accion: any = fin.acciones.find((a: any) => a.tipo === 'crearPedido');
      expect(accion.dto.pago).toEqual({ metodo: 'TARJETA', pagaCon: undefined });
      expect(accion.esPagoDigital).toBe(false);
    });
  });

  describe('efectivo', () => {
    it('texto nuevo y botones calculados del total (62.50 → exacto, 70, 100)', () => {
      const r = paso(flujoPago(), { buttonPayload: 'ped_pago_efectivo' });
      const a: any = r.acciones[0];
      expect(a.texto).toContain('¿Con cuánto pagas? Escribe el monto o selecciona una opción.');
      expect(a.botones.map((b: any) => b.titulo)).toEqual(['Exacto (S/ 62.50)', 'S/ 70', 'S/ 100']);
    });
    it('nunca ofrece un billete menor al total', () => {
      for (const total of [14.5, 45, 62.5, 70, 100, 150, 199.9]) {
        for (const b of opcionesBilletes(total)) expect(b).toBeGreaterThan(total);
      }
      expect(opcionesBilletes(14.5)).toEqual([20, 50]);
    });
    it('monto menor al total: pide uno igual o mayor y no avanza', () => {
      const f = paso(flujoPago(), { buttonPayload: 'ped_pago_efectivo' }).nuevoFlujo;
      const r = paso(f, { texto: '50', textoOriginal: '50' });
      expect(r.nuevoEstado).toBe('PEDIDO_MONTO_EFECTIVO');
      expect(textos(r)).toContain('al menos de S/ 62.50');
    });
    it.each(['70', 's/70', 'S/ 70.00', 's/. 70'])('acepta «%s»', (txt) => {
      const f = paso(flujoPago(), { buttonPayload: 'ped_pago_efectivo' }).nuevoFlujo;
      const r = paso(f, { texto: txt, textoOriginal: txt });
      expect((r.nuevoFlujo.pedido as any).pago).toEqual({ metodo: 'EFECTIVO', pagaCon: 70 });
    });
    it('parsearMonto', () => {
      expect(parsearMonto('S/ 50.00')).toBe(50);
      expect(parsearMonto('hola')).toBeNull();
      expect(parsearMonto('50,5')).toBe(50.5);
    });
  });

  describe('pago dividido (2 medios)', () => {
    const iniciar = () => {
      let r = paso(flujoPago(), { buttonPayload: 'ped_pago_dividir' });
      expect(r.nuevoEstado).toBe('PEDIDO_PAGO_DIV_MEDIO1');
      r = paso(r.nuevoFlujo, { listRowId: 'ped_pago_yape' });
      expect(r.nuevoEstado).toBe('PEDIDO_PAGO_DIV_MONTO');
      expect(textos(r)).toContain('¿Cuánto pagas con Yape?');
      return r;
    };

    it('Yape 30 + resto 32.50 en efectivo, paga con 50: desglose en resumen, DTO igual al de la carta', () => {
      let r = iniciar();
      r = paso(r.nuevoFlujo, { texto: '30', textoOriginal: '30' });
      expect(r.nuevoEstado).toBe('PEDIDO_PAGO_DIV_MEDIO2');
      expect(textos(r)).toContain('Te quedan S/ 32.50');
      // el segundo medio no ofrece el primero
      expect((r.acciones[0] as any).filas.map((x: any) => x.id)).not.toContain('ped_pago_yape');
      r = paso(r.nuevoFlujo, { listRowId: 'ped_pago_efectivo' });
      expect(r.nuevoEstado).toBe('PEDIDO_MONTO_EFECTIVO');
      expect((r.acciones[0] as any).botones.map((b: any) => b.titulo)).toEqual(['Exacto (S/ 32.50)', 'S/ 40', 'S/ 50']);
      r = paso(r.nuevoFlujo, { buttonPayload: 'ped_paga_50' });
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(textos(r)).toContain('Yape S/ 30.00 + Efectivo S/ 32.50, pagas con S/ 50.00, vuelto S/ 17.50');

      const fin = paso(r.nuevoFlujo, { buttonPayload: 'ped_confirmar' });
      const accion: any = fin.acciones.find((a: any) => a.tipo === 'crearPedido');
      expect(accion.dto.pago).toEqual({
        metodo: 'YAPE',
        pagaCon: 50,
        plan: [{ medio: 'YAPE', monto: 30 }, { medio: 'EFECTIVO', monto: 32.5 }],
      });
      // mismas reglas que el servidor (suma = total, sin repetidos, medios válidos)
      const total = calcularTotales(r.nuevoFlujo.pedido as any).total;
      expect(new PagoPlanService().validar(accion.dto.pago.plan, total)).not.toBeNull();
      expect(accion.esPagoDigital).toBe(true);
      // un voucher por medio digital, con su monto
      expect(accion.dto.pago.plan.filter((f: any) => f.medio !== 'EFECTIVO' && f.medio !== 'TARJETA')).toHaveLength(1);
    });

    it('monto mayor o igual al total, cero o texto: lo rechaza y vuelve a preguntar', () => {
      const f = iniciar().nuevoFlujo;
      for (const txt of ['62.50', '100', '0', 'abc']) {
        const r = paso(f, { texto: txt, textoOriginal: txt });
        expect(r.nuevoEstado).toBe('PEDIDO_PAGO_DIV_MONTO');
        expect(textos(r)).toContain('menor a S/ 62.50');
      }
    });

    it('dos medios digitales (Yape + Plin) y Tarjeta puede ser parte del dividido', () => {
      let r = iniciar();
      r = paso(r.nuevoFlujo, { buttonPayload: 'ped_div_mitad' });
      expect(textos(r)).toContain('Te quedan S/ 31.25');
      r = paso(r.nuevoFlujo, { listRowId: 'ped_pago_tarjeta' });
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(textos(r)).toContain('Yape S/ 31.25 + Tarjeta S/ 31.25');
      expect(textos(r)).toContain('con tarjeta la pagas en caja');
      const accion: any = paso(r.nuevoFlujo, { buttonPayload: 'ped_confirmar' }).acciones.find((a: any) => a.tipo === 'crearPedido');
      expect(new PagoPlanService().validar(accion.dto.pago.plan, 62.5)).not.toBeNull();
    });

    it('mensaje de confirmación pide una captura por medio digital con su monto', () => {
      const t = TEXTOS_BOT.pedidoConfirmadoExito({
        codigo: 'CP-1', tiempoMin: 25, tiempoMax: 35, esPagoDigital: true,
        capturas: [{ medio: 'YAPE', monto: 30 }, { medio: 'PLIN', monto: 20 }],
      });
      expect(t).toContain('• Yape: S/ 30.00');
      expect(t).toContain('• Plin: S/ 20.00');
    });
  });
});
