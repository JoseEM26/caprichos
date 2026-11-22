import { Simulador, MensajeBot } from './simulador-conversacion';

/**
 * Conversaciones simuladas con la IA ENCENDIDA (decisión del dueño 22/11). El motor es el real; la IA es un reemplazo con
 * respuestas y acciones fijas. Comprueba el reparto reglas / IA: las reglas rápidas siguen igual, la IA entra en lo abierto,
 * un solo mensaje por respuesta, y si la IA falla responden las reglas.
 */
const nuevo = (op: any = {}) => new Simulador({ primerContacto: true, ...op });
const unSoloMensaje = (r: MensajeBot[]) => expect(r).toHaveLength(1);
const IA_FRIO = 'Tenemos el Frappe Oreo (S/ 14.50) y el Frappe Fresa (S/ 15.00) bien helados 🧊';

describe('Simulación con la IA encendida: reparto reglas / IA', () => {
  it('«tienen algo frío?» en el primer mensaje: lo contesta la IA, en 1 mensaje y sin menú de bienvenida', () => {
    const s = nuevo({ ia: () => ({ texto: IA_FRIO }) });
    const r = s.di('tienen algo frío?');
    unSoloMensaje(r);
    expect(r[0].texto).toBe(IA_FRIO);
    expect(s.preguntasIa).toEqual(['tienen algo frío?']);
  });

  it.each(['qué me recomiendas sin azúcar', 'quiero algo dulce y fresquito', 'tienen refrescos o iced coffee'])('«%s»: la IA lo contesta (pregunta abierta)', (pregunta) => {
    const s = nuevo({ ia: () => ({ texto: 'Te recomiendo el Mocaccino 💛' }) });
    s.di('hola');
    const r = s.di(pregunta);
    unSoloMensaje(r);
    expect(s.preguntasIa).toEqual([pregunta]);
  });

  it('lo que las reglas ya saben NO gasta IA: horario, precio de un producto y menú', () => {
    const s = nuevo({ ia: () => ({ texto: 'IA' }) });
    s.di('hola');
    expect(s.di('a que hora abren?')[0].texto).toContain('23:00');
    expect(s.di('cuanto cuesta el frape oreo')[0].texto).toContain('S/ 14.50');
    expect(s.preguntasIa).toEqual([]);
  });

  it('fuera de tema («qué clima hace»): llega a la IA, que responde una línea amable que lo devuelve al local', () => {
    const s = nuevo({ ia: () => ({ texto: 'Te ayudo con pedidos, carta, horario o tu pedido 💛' }) });
    s.di('hola');
    const r = s.di('que clima hace hoy en lima');
    unSoloMensaje(r);
    expect(r[0].texto).toContain('Te ayudo con pedidos');
  });

  it('queja o reclamo: sigue yendo a una persona (urgente), nunca a la IA', () => {
    const s = nuevo({ ia: () => ({ texto: 'IA' }) });
    s.di('hola');
    s.di('quiero hacer un reclamo, la comida llegó fría');
    expect(s.derivaciones).toEqual(['QUEJA_ESCRITA_URGENTE']);
    expect(s.quejas).toHaveLength(1);
    expect(s.preguntasIa).toEqual([]);
  });

  it('con una persona atendiendo, la IA no entra (el chat calla)', () => {
    const s = nuevo({ ia: () => ({ texto: 'IA' }) });
    s.di('quiero hablar con alguien');
    expect(s.di('tienen algo frío?')).toHaveLength(0);
    expect(s.preguntasIa).toEqual([]);
  });
});

describe('Simulación: su pedido (la IA ve los pedidos del chat de cualquier canal)', () => {
  const pedidoActivo = (canal: string) => ({ id: 7, codigo: 'CP-0007', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', modalidad: 'DELIVERY', eta_min: 25, eta_max: 35, canal });

  it.each(['CAJA', 'CARTA', 'WHATSAPP'])('«mi pedido ya sale?» con un pedido de %s del mismo número: va a la IA (que consulta sus pedidos), 1 mensaje', (canal) => {
    const s = nuevo({ contexto: { pedidoActivo: pedidoActivo(canal) }, ia: () => ({ texto: 'Tu pedido CP-0007 está en cocina, aprox. 25 a 35 min 💛' }) });
    s.di('hola');
    const r = s.di('mi pedido ya sale?');
    unSoloMensaje(r);
    expect(s.preguntasIa).toEqual(['mi pedido ya sale?']);
    expect(r[0].texto).toContain('CP-0007');
  });

  it('chat LID con celular vinculado: el contexto del motor ya trae el pedido por la llave común y la pregunta llega a la IA igual', () => {
    const s = nuevo({ contexto: { telefonoCliente: '51987654321', pedidoActivo: pedidoActivo('CAJA') }, ia: () => ({ texto: 'En cocina 💛' }) });
    s.di('hola');
    s.di('cuando llega mi pedido de caja?');
    expect(s.preguntasIa).toHaveLength(1);
  });

  it('«cuánto falta» (corto): lo contestan las reglas con el tiempo estimado del pedido, sin IA', () => {
    const s = nuevo({ contexto: { pedidoActivo: pedidoActivo('CAJA') }, ia: () => ({ texto: 'IA' }) });
    s.di('hola');
    const r = s.di('cuanto falta');
    unSoloMensaje(r);
    expect(r[0].texto).toContain('CP-0007');
    expect(r[0].texto).toMatch(/25 a 35/);
    expect(s.preguntasIa).toEqual([]);
  });

  it('el botón «Estado de mi pedido» sigue por reglas (rápido y probado)', () => {
    const s = nuevo({ contexto: { pedidoActivo: pedidoActivo('CARTA') }, ia: () => ({ texto: 'IA' }) });
    s.di('hola');
    const r = s.di('mi pedido');
    expect(r[0].texto).toContain('CP-0007');
    expect(s.preguntasIa).toEqual([]);
  });
});

describe('Simulación: respaldo cuando la IA falla (OpenAI caído, tiempo agotado, tope)', () => {
  it('fallo de la IA: responde el menú de las reglas (nunca silencio ni error)', () => {
    const s = nuevo({ ia: () => ({ fallo: true }) });
    s.di('hola');
    const r = s.di('tienen algo frío?');
    unSoloMensaje(r);
    expect(r[0].tipo).toBe('lista');
    expect(r[0].texto).toMatch(/Hacer pedido/);
    expect(r[0].texto).not.toMatch(/problemita|error/i);
  });

  it('dos fallos seguidos: la segunda vez pasa a una persona (como el bot de siempre)', () => {
    const s = nuevo({ ia: () => ({ fallo: true }) });
    s.di('hola');
    s.di('tienen algo frío?');
    const r = s.di('y algo dulce?');
    unSoloMensaje(r);
    expect(s.derivaciones).toEqual(['BOT_NO_ENTIENDE']);
  });

  it('cliente escribiendo muy rápido (la IA espera): no se responde cada mensaje', () => {
    const s = nuevo({ ia: () => ({ omitir: true }) });
    s.di('hola');
    expect(s.di('tienen algo frío?')).toHaveLength(0);
    expect(s.di('y refrescos?')).toHaveLength(0);
  });
});

describe('Simulación: acciones estructuradas de la IA (un solo mensaje)', () => {
  it('AGREGAR_PRODUCTO: la IA responde y el motor sigue el pedido guiado en el MISMO mensaje, sin «¿cuántas?»', () => {
    const s = nuevo({ ia: () => ({ texto: 'El Frappe Oreo cuesta S/ 14.50 💛', accion: { tipo: 'AGREGAR_PRODUCTO', productoId: 'p1', nombre: 'Frappe Oreo' } }) });
    s.di('hola');
    const r = s.di('me recomiendas algo para la tarde');
    unSoloMensaje(r);
    expect(r[0].texto).toContain('Frappe Oreo cuesta S/ 14.50');
    expect(r[0].texto).not.toMatch(/cuántas|cuantas/i);
    expect((s.flujo as any).pedido).toBeTruthy();
  });

  it('EMPEZAR_PEDIDO: texto de la IA + inicio del pedido en un mensaje', () => {
    const s = nuevo({ ia: () => ({ texto: '¡Claro, armemos tu pedido!', accion: { tipo: 'EMPEZAR_PEDIDO' } }) });
    s.di('hola');
    const r = s.di('quiero algo rico para la tarde y ya mismo');
    unSoloMensaje(r);
    expect(r[0].texto).toContain('armemos tu pedido');
  });

  it('VER_CATEGORIA: botón «Ver Frappes» (al tocarlo, el motor muestra la categoría como siempre)', () => {
    const s = nuevo({ ia: () => ({ texto: 'Mira nuestros frappes 🧊', accion: { tipo: 'VER_CATEGORIA', categoriaId: '1', nombre: 'Frappes' } }) });
    s.di('hola');
    const r = s.di('que cosas heladas tienen para esta tarde');
    unSoloMensaje(r);
    expect(r[0].texto).toContain('Ver Frappes');
  });
});

describe('Simulación: respuestas fijas cortas (sin IA) y sticker', () => {
  const sinIa = () => nuevo({ ia: () => ({ texto: 'IA' }) });

  it.each(['hacen boleta o factura?', 'emiten factura', 'puedo pedir boleta'])('«%s»: boleta o factura, texto fijo, sin IA', (pregunta) => {
    const s = sinIa();
    s.di('hola');
    const r = s.di(pregunta);
    unSoloMensaje(r);
    expect(r[0].texto).toBe('Sí, emitimos boleta o factura. Si quieres factura, pásanos tu RUC al pagar 💛');
    expect(s.preguntasIa).toEqual([]);
  });

  it.each(['tienen vuelto?', 'llevan sencillo para un billete de 100', 'tienen cambio para 50'])('«%s»: vuelto, texto fijo', (pregunta) => {
    const s = sinIa();
    s.di('hola');
    const r = s.di(pregunta);
    unSoloMensaje(r);
    expect(r[0].texto).toBe('¿Con cuánto pagas? Llevamos tu vuelto 💵');
    expect(s.preguntasIa).toEqual([]);
  });

  it.each(['puedo pagar en efectivo al delivery?', 'aceptan efectivo al repartidor', 'se paga en efectivo al recibir'])('«%s»: efectivo al repartidor, texto fijo', (pregunta) => {
    const s = sinIa();
    s.di('hola');
    const r = s.di(pregunta);
    unSoloMensaje(r);
    expect(r[0].texto).toBe('Sí, puedes pagar en efectivo al repartidor 💵');
    expect(s.preguntasIa).toEqual([]);
  });

  it('con el efectivo apagado en el local no promete efectivo: responde la lista real de pagos', () => {
    const s = sinIa();
    (s as any).ctx.datosLocalPublicos = { ...(s as any).ctx.datosLocalPublicos, mediosPago: { yape: { nombre: 'Yape', activo: true }, efectivo: { nombre: 'Efectivo', activo: false } } };
    s.di('hola');
    const r = s.di('puedo pagar en efectivo al delivery?');
    expect(r[0].texto).not.toBe('Sí, puedes pagar en efectivo al repartidor 💵');
  });

  it('una frase larga sobre SU pago («ya pagué por yape y quiero pagar el resto en efectivo al recibir») va a la IA, no al texto fijo', () => {
    const s = sinIa();
    s.di('hola');
    s.di('Ya pagué por yape una parte y quiero pagar lo restante en efectivo al recibir');
    expect(s.preguntasIa).toHaveLength(1);
  });

  it('«cambiar mi boleta por factura» no es la pregunta general: lo ve una persona o la IA, no el texto fijo', () => {
    const s = sinIa();
    s.di('hola');
    const r = s.di('quiero cambiar mi boleta por factura');
    expect(r.every((m) => !m.texto.startsWith('Sí, emitimos boleta o factura'))).toBe(true);
  });

  it('pedido guiado: no pregunta «¿cuántas?», asume 1 y dice cómo corregir', () => {
    const s = nuevo();
    s.di('hola');
    s.di('1'); // Hacer pedido
    const todo = () => s.bot.map((m) => m.texto).join('\n');
    for (let i = 0; i < 6; i++) {
      if (/Agregué/.test(todo())) break;
      s.di('1');
    }
    expect(todo()).not.toMatch(/cuántas unidades|cuantas unidades/i);
    expect(todo()).toMatch(/Agregué 1 /);
    expect(todo()).toContain('mejor que sean 3');
  });
});
