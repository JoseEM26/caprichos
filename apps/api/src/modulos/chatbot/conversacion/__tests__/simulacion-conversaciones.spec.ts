import { Simulador, LOCAL_ABIERTO, MensajeBot, repetidosSeguidos } from './simulador-conversacion';

/**
 * Conversaciones simuladas de punta a punta con el motor real (todo lo que NO es armar un pedido). Cada una fija un
 * límite de mensajes del bot y comprueba que se contestó lo preguntado al primer intento, sin menús ni saludos de más.
 */
const CERRADO = { ...LOCAL_ABIERTO, abierta: false };

const esMenu = (m: MensajeBot) => m.tipo === 'lista' && /Hacer pedido/.test(m.texto);
const menus = (s: Simulador) => s.bot.filter(esMenu).length;
const nuevo = (op: any = {}) => new Simulador({ primerContacto: true, ...op });

describe('Simulación de conversaciones del bot (consultas, saludo, derivación, cierre)', () => {
  it('1. «¿a qué hora abren?» sin saludar: 1 mensaje, solo el horario, sin menú', () => {
    const s = nuevo();
    const r = s.di('a que hora abren?');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('23:00');
    expect(menus(s)).toBe(0);
  });

  it('2. «hola» tres veces: bienvenida, «hola de nuevo» y menú; nunca el mismo mensaje seguido', () => {
    const s = nuevo();
    s.di('hola');
    s.di('hola');
    s.di('hola');
    expect(s.bot).toHaveLength(3);
    expect(repetidosSeguidos(s.bot)).toBe(0);
    expect(s.bot[0].texto).toContain('Soy Capri');
    expect(s.bot[2].texto).not.toBe(s.bot[1].texto);
  });

  it('3. «gracias» y «ok» al final no reinician el menú ni piden «volver al menú»', () => {
    const s = nuevo();
    s.di('hola');
    const a = s.di('gracias');
    const b = s.di('ok');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].tipo).toBe('texto');
    expect(a[0].texto).not.toMatch(/Responde/);
    expect(menus(s)).toBe(1);
  });

  it('4. precio de un producto con faltas: contesta el precio, 1 mensaje cada vez', () => {
    const s = nuevo();
    expect(s.di('cuanto cuesta el frape oreo')[0].texto).toContain('S/ 14.50');
    expect(s.di('y el capucino?')[0].texto).toContain('S/ 11.00');
    const r = s.di('cuanto vale el mocacino');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('S/ 12.00');
    expect(menus(s)).toBe(0);
    expect(s.derivaciones).toEqual([]);
  });

  it('5. producto agotado: lo dice sin ofrecer pedirlo', () => {
    const s = nuevo({
      contexto: { categoriasCarta: [{ id: '1', nombre: 'Frappes', productos: [{ id: 'p2', nombre: 'Frappe Fresa', precio: 15, disponible: false, agotadoHasta: '22:00' }] }] },
    });
    const r = s.di('precio del frappe fresa');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toMatch(/agotado hasta las 22:00/);
    expect(r[0].tipo).toBe('texto');
  });

  it('6. «¿hay bebidas calientes?»: lista los productos de la categoría en 1 mensaje', () => {
    const s = nuevo();
    const r = s.di('hay bebidas calientes?');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('Mocaccino');
  });

  it('7. «quiero hablar con alguien»: deriva con 1 mensaje y luego calla (sin responder «hola?»/«gracias»)', () => {
    const s = nuevo();
    const r = s.di('quiero hablar con alguien');
    expect(r).toHaveLength(1);
    expect(s.derivaciones).toEqual(['CLIENTE_SOLICITO_PERSONA']);
    expect(s.di('hola?')).toHaveLength(0);
    expect(s.di('gracias')).toHaveLength(0);
  });

  it('8. cuando la persona devuelve el chat, el bot vuelve a atender', () => {
    const s = nuevo();
    s.di('quiero hablar con alguien');
    s.personaDevuelveAlBot();
    const r = s.di('a que hora cierran');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('23:00');
  });

  it('9. «ok» suelto: 1 línea sin menú', () => {
    const s = nuevo();
    const r = s.di('ok');
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('texto');
  });

  it('10. fuera de horario preguntando por delivery: dice que está cerrado y la hora de apertura, 1 mensaje', () => {
    const s = nuevo({ contexto: { datosLocal: CERRADO } });
    const r = s.di('hacen delivery?');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toMatch(/cerrados/);
    expect(r[0].texto).toContain('17:00');
    expect(r[0].texto).toMatch(/delivery/);
  });

  it('11. costo del envío después de «delivery»: no repite la misma respuesta', () => {
    const s = nuevo();
    s.di('hacen delivery?');
    s.di('cuanto cuesta el envio');
    expect(s.bot).toHaveLength(2);
    expect(repetidosSeguidos(s.bot)).toBe(0);
    expect(s.bot[1].texto).toMatch(/depende de tu zona/);
  });

  it('12. reserva con datos («para 4 el sábado 7pm»): 1 mensaje y pasa directo a una persona', () => {
    const s = nuevo();
    const r = s.di('quiero reservar para 4 el sabado a las 7pm');
    expect(r).toHaveLength(1);
    expect(s.derivaciones).toEqual(['RESERVA_NUEVA']);
    expect(s.di('gracias')).toHaveLength(0);
  });

  it('13. «reservar» sin datos: 1 mensaje con teléfono y opción de persona', () => {
    const s = nuevo();
    const r = s.di('quiero reservar una mesa');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('987 654 321');
  });

  it('14. cancelar una reserva no se trata como cancelar un pedido', () => {
    const s = nuevo();
    const r = s.di('quiero cancelar mi reserva');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toMatch(/reserva/);
    expect(s.derivaciones).toEqual(['RESERVA_CAMBIO']);
  });

  it('15. queja por demora: 1 mensaje, urgente y con queja registrada', () => {
    const s = nuevo();
    const r = s.di('mi pedido se demora mucho, es un reclamo');
    expect(r).toHaveLength(1);
    expect(s.derivaciones).toEqual(['QUEJA_ESCRITA_URGENTE']);
    expect(s.quejas).toHaveLength(1);
  });

  it('16. «¿dónde quedan?»: solo la dirección, sin saludo ni menú', () => {
    const s = nuevo();
    const r = s.di('donde quedan?');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('Av. Las Flores 456');
    expect(r[0].texto).not.toMatch(/Soy Capri/);
  });

  it('17. «¿aceptan yape?» y «¿y tarjeta?»: sí o no concreto, respuestas distintas', () => {
    const s = nuevo();
    expect(s.di('aceptan yape?')[0].texto).toMatch(/Sí, aceptamos Yape/);
    expect(s.di('y tarjeta?')[0].texto).toMatch(/Tarjeta no está disponible/);
    expect(repetidosSeguidos(s.bot)).toBe(0);
  });

  it('18. promociones: 1 mensaje; luego «ok» una línea', () => {
    const s = nuevo();
    expect(s.di('tienen promociones?')).toHaveLength(1);
    expect(s.di('ok')).toHaveLength(1);
  });

  it('19. insulto: responde con calma y ofrece una persona; el segundo seguido deriva sin repetir', () => {
    const s = nuevo();
    s.di('hola');
    const a = s.di('eres una mierda bot de porqueria');
    expect(a).toHaveLength(1);
    expect(a[0].texto).toMatch(/Lamento/);
    expect(menus(s)).toBe(1);
    const b = s.di('basura de bot');
    expect(b).toHaveLength(1);
    expect(s.derivaciones).toEqual(['INSULTOS']);
  });

  it('20. texto que no entiende: una vez con menú, a la segunda a una persona; sin mensajes idénticos', () => {
    const s = nuevo();
    s.di('hola');
    s.di('jkl zxc');
    s.di('qwe rty');
    expect(s.derivaciones).toEqual(['BOT_NO_ENTIENDE']);
    expect(repetidosSeguidos(s.bot)).toBe(0);
  });

  it('21. «¿cómo estás?» tras la bienvenida: 1 línea, sin menú', () => {
    const s = nuevo();
    s.di('hola');
    const r = s.di('que tal');
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('texto');
  });

  it('22. «¿están atendiendo?» / «¿se puede pedir aún?»: contesta el estado del local, no abre el pedido', () => {
    const s = nuevo();
    const r = s.di('hola estan atendiendo?');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toMatch(/estamos atendiendo/);
    const r2 = s.di('se puede pedir aun');
    expect(r2).toHaveLength(1);
    expect(r2[0].texto).toMatch(/estamos atendiendo/);
  });

  it('23. cliente que vuelve al día siguiente: una bienvenida completa, no un «hola de nuevo»', () => {
    const s = nuevo();
    s.di('hola');
    s.nuevoDia();
    const r = s.di('hola');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('Soy Capri');
  });

  it('24. primer mensaje con local cerrado: 1 mensaje que dice la hora de apertura; «¿a qué hora abren?» después, 1 línea', () => {
    const s = nuevo({ contexto: { datosLocal: CERRADO } });
    const a = s.di('hola');
    expect(a).toHaveLength(1);
    expect(a[0].texto).toMatch(/cerrados/);
    const b = s.di('a que hora abren');
    expect(b).toHaveLength(1);
    expect(b[0].texto).toContain('17:00');
  });

  it('25. cada número del menú lleva a lo que dice (4 = preguntas frecuentes, 5 = persona)', () => {
    const s = nuevo();
    s.di('hola');
    const faq = s.di('4');
    expect(faq).toHaveLength(1);
    const s2 = nuevo();
    s2.di('hola');
    s2.di('5');
    expect(s2.derivaciones).toEqual(['CLIENTE_SOLICITO_PERSONA']);
  });

  it('26. «chau» tras el saludo: una línea de cierre, sin botones', () => {
    const s = nuevo();
    s.di('hola');
    const r = s.di('chau');
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('texto');
  });

  it('27. conversación larga mezclada: nunca más de 1 mensaje por turno ni mensajes idénticos seguidos', () => {
    const s = nuevo();
    const turnos = ['hola', 'a que hora abren', 'donde quedan', 'cuanto cuesta el mocacino', 'aceptan yape', 'hacen delivery', 'gracias', 'ok', 'chau'];
    for (const t of turnos) expect(s.di(t).length).toBeLessThanOrEqual(1);
    expect(repetidosSeguidos(s.bot)).toBe(0);
    expect(menus(s)).toBe(1);
  });
});
