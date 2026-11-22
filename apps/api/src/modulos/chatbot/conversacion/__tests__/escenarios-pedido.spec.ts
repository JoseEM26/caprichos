import { appendFileSync } from 'fs';
import { correrDocil, metricas, Objetivo } from './cliente-docil';
import { CARTA, CTX_BASE, Simulador } from './simulador-pedido';

/**
 * Escenarios de punta a punta del PEDIDO por WhatsApp con el motor real. Cada uno mide mensajes del bot y exige éxito
 * dentro de un límite (maxBot) y sin mensajes idénticos seguidos. Con TABLA=ruta se agrega una fila por escenario.
 */
const ZONA = { lat: -12.0, lng: -77.0, radio: 0.05, tarifa: 5 };
const DENTRO = { latitud: -12.001, longitud: -77.001 };
const FUERA = { latitud: -12.5, longitud: -77.5 };
const lineas = (s: Simulador) => (s.pedidos[0]?.dto?.lineas ?? []) as any[];
const dto = (s: Simulador) => s.pedidos[0]?.dto ?? {};
const pidio = (s: Simulador, productoId: string, cantidad: number, tamanoId?: string) =>
  lineas(s).some((l) => l.productoId === productoId && l.cantidad === cantidad && (tamanoId === undefined || l.tamanoId === tamanoId));
const nuevo = (o: any = {}) => new Simulador({ zona: ZONA, ...o });
const base = (p: Partial<Objetivo> = {}): Objetivo => ({
  items: [{ producto: 'moka', tamano: 'grande', cantidad: 1 }],
  modalidad: 'RECOGER',
  pago: 'EFECTIVO',
  ubicacion: DENTRO,
  ...p,
});

interface Escenario {
  id: string;
  nombre: string;
  maxBot: number;
  correr: (s: Simulador) => void;
  ok: (s: Simulador) => boolean;
  opciones?: any;
}

const ESCENARIOS: Escenario[] = [
  {
    id: 'E01', nombre: 'Guiado feliz: 1 frappé moka grande, recoger, efectivo', maxBot: 11,
    correr: (s) => { s.decir('hola'); correrDocil(s, base()); },
    ok: (s) => pidio(s, 'p_moka', 1, 't_gr') && dto(s).modalidad === 'RECOGER',
  },
  {
    id: 'E02', nombre: 'Frase única: «2 frappé moka grande para llevar»', maxBot: 5,
    correr: (s) => { s.decir('2 frappé moka grande para llevar'); correrDocil(s, base({ items: [{ producto: 'moka', tamano: 'grande', cantidad: 2 }] })); },
    ok: (s) => pidio(s, 'p_moka', 2, 't_gr') && dto(s).modalidad === 'RECOGER',
  },
  {
    id: 'E03', nombre: 'Frase única delivery con dos productos y Yape', maxBot: 4,
    correr: (s) => {
      s.decir('quiero 1 latte mediano y 1 cheesecake a domicilio');
      correrDocil(s, base({ items: [{ producto: 'latte', tamano: 'mediano' }, { producto: 'cheesecake' }], modalidad: 'DELIVERY', pago: 'YAPE' }));
    },
    ok: (s) => pidio(s, 'p_late', 1, 't_me') && pidio(s, 'p_chee', 1) && dto(s).modalidad === 'DELIVERY' && dto(s).pago.metodo === 'YAPE',
  },
  {
    id: 'E04', nombre: 'Se equivoca de producto: lo quita y pide otro', maxBot: 12,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('2');
      s.decir('cheesecake'); // por nombre, en lugar de elegir categoría
      s.decir('quitar cheesecake');
      correrDocil(s, base({ items: [{ producto: 'carrot' }] }));
    },
    ok: (s) => pidio(s, 'p_carr', 1) && !lineas(s).some((l) => l.productoId === 'p_chee'),
  },
  {
    id: 'E05', nombre: 'Corrige la cantidad: «mejor que sean 3»', maxBot: 6,
    correr: (s) => {
      s.decir('2 americano para recoger'); s.decir('mejor que sean 3');
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 3 }] }));
    },
    ok: (s) => pidio(s, 'p_amer', 3),
  },
  {
    id: 'E06', nombre: 'Escribe el nombre del producto en cada paso', maxBot: 11,
    correr: (s) => {
      s.decir('hola'); s.decir('pedir'); s.decir('recoger'); s.decir('frappes'); s.decir('frappe oreo'); s.decir('grande'); s.decir('mejor que sean 2');
      correrDocil(s, base({ items: [{ producto: 'oreo', tamano: 'grande', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_oreo', 2, 't_gr'),
  },
  {
    id: 'E07', nombre: 'Manda sticker y audio a mitad del pedido', maxBot: 11,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('2'); s.decir('3'); s.decir('1');
      s.decir({ tipo: 'sticker', texto: '👍' });
      correrDocil(s, base({ items: [{ producto: 'cheesecake' }] }));
    },
    ok: (s) => pidio(s, 'p_chee', 1),
  },
  {
    id: 'E08', nombre: 'Pide «menú» a la mitad y vuelve: no pierde el carrito', maxBot: 7,
    correr: (s) => {
      s.decir('2 americano para recoger');
      s.decir('menu');
      s.decir('hacer pedido');
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_amer', 2) && lineas(s).length === 1,
  },
  {
    id: 'E09', nombre: 'Cambia de delivery a recoger sin dar ubicación', maxBot: 12,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('1'); // delivery, pide ubicación
      s.decir('mejor para recoger');
      correrDocil(s, base());
    },
    ok: (s) => dto(s).modalidad === 'RECOGER' && pidio(s, 'p_moka', 1, 't_gr'),
  },
  {
    id: 'E10', nombre: 'Delivery fuera de zona: recoge en el local', maxBot: 13,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('delivery');
      s.decir({ tipo: 'location', ubicacion: FUERA });
      s.decir('para recoger');
      correrDocil(s, base());
    },
    ok: (s) => dto(s).modalidad === 'RECOGER',
  },
  {
    id: 'E11', nombre: 'Pide un producto agotado y elige otro', maxBot: 8,
    correr: (s) => {
      s.decir('quiero un tiramisú para llevar');
      correrDocil(s, base({ items: [{ producto: 'carrot' }] }));
    },
    ok: (s) => pidio(s, 'p_carr', 1) && !lineas(s).some((l) => l.productoId === 'p_agot'),
  },
  {
    id: 'E12', nombre: 'Producto con opción obligatoria dicha en la frase', maxBot: 4,
    correr: (s) => {
      s.decir('un cappuccino grande con leche de almendra para llevar');
      correrDocil(s, base({ items: [{ producto: 'cappuccino', tamano: 'grande', opcion: 'almendra' }] }));
    },
    ok: (s) => pidio(s, 'p_capu', 1, 't_gr') && lineas(s)[0]?.opciones?.includes('l_alm'),
  },
  {
    id: 'E13', nombre: 'Opción obligatoria sin decirla: se pregunta una sola vez', maxBot: 6,
    correr: (s) => {
      s.decir('un cappuccino mediano para recoger');
      correrDocil(s, base({ items: [{ producto: 'cappuccino', tamano: 'mediano', opcion: 'entera' }] }));
    },
    ok: (s) => pidio(s, 'p_capu', 1, 't_me') && lineas(s)[0]?.opciones?.length === 1,
  },
  {
    id: 'E14', nombre: 'Paga con Yape y luego manda la foto del voucher', maxBot: 3,
    correr: (s) => {
      s.decir('1 cheesecake para recoger');
      correrDocil(s, base({ items: [{ producto: 'cheesecake' }], pago: 'YAPE' }));
      // La foto del voucher la recibe el webhook (whatsapp-voucher.spec); aquí se exige que la confirmación diga qué mandar, en un solo mensaje
    },
    ok: (s) => dto(s).pago?.metodo === 'YAPE' && /captura/i.test(s.ultimo) && s.turnos[s.turnos.length - 1].bot.length === 1,
  },
  {
    id: 'E15', nombre: '«sí / ok / dale» confirman el resumen', maxBot: 5,
    correr: (s) => {
      s.decir('1 cheesecake para recoger'); s.decir('continuar');
      correrDocil(s, base({ items: [{ producto: 'cheesecake' }] }), 5);
      // el cliente responde con palabras en vez de pulsar «Confirmar»
      for (const w of ['dale', 'ok', 'sí']) if (!s.pedidos.length && /confirmar pedido/i.test(s.ultimo)) s.decir(w);
    },
    ok: (s) => pidio(s, 'p_chee', 1),
  },
  {
    id: 'E16', nombre: 'Tarjeta: sin voucher ni vuelto', maxBot: 11,
    correr: (s) => { s.decir('hola'); correrDocil(s, base({ pago: 'TARJETA' })); },
    ok: (s) => dto(s).pago?.metodo === 'TARJETA',
  },
  {
    id: 'E17', nombre: 'Efectivo: «pago con 50»', maxBot: 2,
    correr: (s) => { s.decir('1 frappé moka grande para recoger, pago con 50'); correrDocil(s, base({ paga: 50 })); },
    ok: (s) => pidio(s, 'p_moka', 1, 't_gr') && dto(s).pago?.pagaCon === 50,
  },
  {
    id: 'E18', nombre: 'Varios productos en una frase', maxBot: 4,
    correr: (s) => {
      s.decir('un cheesecake, un carrot cake y 2 americanos para recoger');
      correrDocil(s, base({ items: [{ producto: 'cheesecake' }, { producto: 'carrot' }, { producto: 'americano', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_chee', 1) && pidio(s, 'p_carr', 1) && pidio(s, 'p_amer', 2),
  },
  {
    id: 'E19', nombre: 'Escribe la cantidad con letras/número suelto', maxBot: 10,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('2'); s.decir('3'); s.decir('1'); s.decir('5');
      correrDocil(s, base({ items: [{ producto: 'cheesecake', cantidad: 5 }] }));
    },
    ok: (s) => pidio(s, 'p_chee', 5),
  },
  {
    id: 'E20', nombre: 'Vuelve horas después con carrito a medias', maxBot: 6,
    correr: (s) => {
      s.decir('2 americano para recoger');
      (s as any).o.ctx = { ...(s as any).o.ctx, inactividadExpirada: true };
      s.decir('hola');
      (s as any).o.ctx = { ...(s as any).o.ctx, inactividadExpirada: false };
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_amer', 2),
  },
  {
    id: 'E21', nombre: 'Fuera de horario: programa su pedido para llevar', maxBot: 12,
    opciones: {
      ctx: {
        datosLocal: { ...CTX_BASE.datosLocal!, abierta: false },
        soloProgramar: true,
        programacion: { dias: [{ fecha: '2026-11-22', horas: [{ hora: '12:00', iso: '2026-11-22T12:00:00-05:00' }, { hora: '13:00', iso: '2026-11-22T13:00:00-05:00' }] }] },
      },
    },
    correr: (s) => { s.decir('hola'); correrDocil(s, base({ items: [{ producto: 'cheesecake' }] })); },
    ok: (s) => !!dto(s).programadoPara && pidio(s, 'p_chee', 1),
  },
  {
    id: 'E22', nombre: 'Delivery guiado completo con Yape', maxBot: 11,
    correr: (s) => { s.decir('hola'); correrDocil(s, base({ modalidad: 'DELIVERY', pago: 'YAPE' })); },
    ok: (s) => dto(s).modalidad === 'DELIVERY' && dto(s).entrega?.lat === DENTRO.latitud,
  },
  {
    id: 'E23', nombre: 'Delivery: escribe su dirección en vez de enviar ubicación', maxBot: 13,
    correr: (s) => {
      s.decir('hola'); s.decir('1'); s.decir('delivery');
      s.decir('av. los jazmines 123, san juan');
      correrDocil(s, base({ modalidad: 'DELIVERY' }));
    },
    ok: (s) => dto(s).modalidad === 'DELIVERY' || dto(s).modalidad === 'RECOGER',
  },
  {
    id: 'E24', nombre: 'Pregunta el estado del pedido recién hecho', maxBot: 12,
    correr: (s) => {
      s.decir('hola'); correrDocil(s, base());
      s.decir('cuanto demora mi pedido');
    },
    ok: (s) => s.pedidos.length === 1 && /CP-0001/.test(s.ultimo),
  },
  {
    id: 'E25', nombre: 'Producto con nombre parcial: «un moka»', maxBot: 4,
    correr: (s) => { s.decir('un moka mediano para recoger'); correrDocil(s, base({ items: [{ producto: 'moka', tamano: 'mediano' }] })); },
    ok: (s) => pidio(s, 'p_moka', 1, 't_me'),
  },
  {
    id: 'E26', nombre: 'Contesta escribiendo el título de las opciones (no el número)', maxBot: 10,
    correr: (s) => { s.decir('hola'); correrDocil(s, base({ escribeTitulos: true, modalidad: 'DELIVERY', pago: 'EFECTIVO' })); },
    ok: (s) => pidio(s, 'p_moka', 1, 't_gr') && dto(s).modalidad === 'DELIVERY',
  },
  {
    id: 'E27', nombre: '«delivery» como primer mensaje', maxBot: 10,
    correr: (s) => { s.decir('delivery'); correrDocil(s, base({ modalidad: 'DELIVERY' })); },
    ok: (s) => dto(s).modalidad === 'DELIVERY' && pidio(s, 'p_moka', 1, 't_gr') && !/Soy Capri/.test(s.botTextos[0]),
  },
  {
    id: 'E28', nombre: 'Producto con dos grupos opcionales: una sola pregunta de personalizar', maxBot: 5,
    correr: (s) => { s.decir('un chai latte grande para recoger'); correrDocil(s, base({ items: [{ producto: 'chai', tamano: 'grande' }] })); },
    ok: (s) => pidio(s, 'p_chai', 1, 't_gr') && s.botTextos.filter((t) => /personalizar/i.test(t)).length === 1,
  },
  {
    id: 'E29', nombre: 'Sale al menú desde la ubicación y vuelve: conserva el carrito', maxBot: 8,
    correr: (s) => {
      s.decir('2 americano delivery');
      s.decir('menu');
      s.decir('hacer pedido');
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 2 }], modalidad: 'DELIVERY' }));
    },
    ok: (s) => pidio(s, 'p_amer', 2) && lineas(s).length === 1 && dto(s).modalidad === 'DELIVERY',
  },
  {
    id: 'E30', nombre: 'Pregunta el horario a medio pedido y sigue donde iba', maxBot: 6,
    correr: (s) => {
      s.decir('2 americano para recoger');
      s.decir('a que hora cierran');
      s.decir('seguir con mi pedido');
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_amer', 2),
  },
  {
    id: 'E31', nombre: 'Escribe cosas que el bot no entiende y se le ofrece una persona sin perder el pedido', maxBot: 7,
    correr: (s) => {
      s.decir('2 americano para recoger');
      s.decir('asdf qwer'); s.decir('zxcv uiop');
      s.decir('seguir pidiendo');
      correrDocil(s, base({ items: [{ producto: 'americano', cantidad: 2 }] }));
    },
    ok: (s) => pidio(s, 'p_amer', 2),
  },
];

describe('Escenarios de pedido por WhatsApp (simulador de punta a punta)', () => {
  it.each(ESCENARIOS.map((e) => [e.id, e] as const))('%s', (_id, e) => {
    const s = nuevo(e.opciones);
    e.correr(s);
    const m = metricas(s);
    const exito = e.ok(s);
    if (process.env.TABLA) {
      appendFileSync(process.env.TABLA, `${e.id}\t${e.nombre}\t${m.botMensajes}\t${m.turnosCliente}\t${m.repetidosSeguidos}\t${m.seEnreda}\t${exito ? 'SI' : 'NO'}\n`);
    }
    if (process.env.VER === e.id) console.log(s.transcripcion());
    if (process.env.TABLA) return; // en modo medición no se exige nada
    expect(exito).toBe(true);
    expect(m.botMensajes).toBeLessThanOrEqual(e.maxBot);
    expect(m.repetidosSeguidos).toBe(0);
    expect(m.seEnreda).toBe(0);
  });

  it('la carta de pruebas tiene productos', () => {
    expect(CARTA.length).toBeGreaterThan(0);
  });
});
