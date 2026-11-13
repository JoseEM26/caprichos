import { aTextoNumerado, numeroEscrito, resolverRespuesta } from '../evolution/menu-numerado.util';
import { aRespuestaDeMenu, normalizarMensajeEvolution } from '../evolution/evolution-mensaje.util';
import { dentroDeHorario, escribiendoMs, limitarEnlaces, pausaAleatoriaMs, variarSaludo } from '../evolution/anti-bloqueo.util';

const clave = (extra: any = {}) => ({ remoteJid: '51900000001@s.whatsapp.net', fromMe: false, id: 'MSG1', ...extra });

describe('menú numerado', () => {
  it('convierte botones a texto numerado y mapea la respuesta al mismo id', () => {
    const { texto, menu } = aTextoNumerado('¿Qué deseas?', [{ id: 'menu_carta', titulo: 'Ver carta' }, { id: 'menu_pedir', titulo: 'Pedir' }, { id: 'menu_humano', titulo: 'Hablar con alguien' }], 'boton');
    expect(texto).toContain('1. Ver carta');
    expect(texto).toContain('3. Hablar con alguien');
    expect(texto).toContain('Responde 1, 2 o 3.');
    expect(resolverRespuesta('2', menu)).toMatchObject({ id: 'menu_pedir', titulo: 'Pedir' });
    expect(resolverRespuesta(' 3. ', menu)?.id).toBe('menu_humano');
    expect(resolverRespuesta('opción 1', menu)?.id).toBe('menu_carta');
  });

  it('una lista con descripción sale numerada y 2 opciones dicen «1 o 2»', () => {
    const { texto, menu } = aTextoNumerado('Elige', [{ id: 'a', titulo: 'Uno', descripcion: 'desc' }, { id: 'b', titulo: 'Dos' }], 'lista');
    expect(texto).toContain('1. Uno (desc)');
    expect(texto).toContain('Responde 1 o 2.');
    expect(menu.tipo).toBe('lista');
  });

  it('un número fuera del menú, texto libre o sin menú no se mapea', () => {
    const { menu } = aTextoNumerado('x', [{ id: 'a', titulo: 'Uno' }], 'boton');
    expect(resolverRespuesta('5', menu)).toBeNull();
    expect(resolverRespuesta('hola', menu)).toBeNull();
    expect(resolverRespuesta('2 pizzas', menu)).toBeNull();
    expect(resolverRespuesta('1', null)).toBeNull();
    expect(numeroEscrito('12')).toBe(12);
  });

  it('la respuesta numérica llega al webhook como button_reply o list_reply con el mismo id', () => {
    const base = { id: 'M', from: '51900000001', type: 'text', text: { body: '2' } };
    const boton = aRespuestaDeMenu(base, aTextoNumerado('x', [{ id: 'a', titulo: 'Uno' }, { id: 'b', titulo: 'Dos' }], 'boton').menu);
    expect(boton).toMatchObject({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'b', title: 'Dos' } } });
    expect(boton.text).toBeUndefined();
    const lista = aRespuestaDeMenu(base, aTextoNumerado('x', [{ id: 'a', titulo: 'Uno' }, { id: 'b', titulo: 'Dos' }], 'lista').menu);
    expect(lista.interactive).toMatchObject({ type: 'list_reply', list_reply: { id: 'b' } });
    expect(aRespuestaDeMenu(base, null)).toBe(base);
  });
});

describe('normalizar messages.upsert de Evolution', () => {
  it('texto: mismo formato que Meta', () => {
    const r = normalizarMensajeEvolution({ key: clave(), pushName: 'Cliente Prueba', message: { conversation: 'hola' } });
    expect(r).toMatchObject({ ok: true, msg: { id: 'MSG1', from: '51900000001', type: 'text', text: { body: 'hola' } }, contacto: { wa_id: '51900000001', profile: { name: 'Cliente Prueba' } } });
  });
  it('ignora fromMe, grupos, estados y mensajes sin número o sin id', () => {
    expect(normalizarMensajeEvolution({ key: clave({ fromMe: true }), message: { conversation: 'x' } })).toEqual({ ok: false, razon: 'PROPIO' });
    expect(normalizarMensajeEvolution({ key: clave({ remoteJid: '1203630@g.us' }), message: { conversation: 'x' } })).toEqual({ ok: false, razon: 'GRUPO' });
    expect(normalizarMensajeEvolution({ key: clave({ remoteJid: 'status@broadcast' }), message: { conversation: 'x' } })).toEqual({ ok: false, razon: 'ESTADO' });
    expect(normalizarMensajeEvolution({ key: clave({ remoteJid: '9988@lid' }), message: { conversation: 'x' } })).toEqual({ ok: false, razon: 'SIN_NUMERO' });
    expect(normalizarMensajeEvolution({ key: clave({ id: '' }), message: { conversation: 'x' } })).toEqual({ ok: false, razon: 'SIN_ID' });
  });
  it('un @lid con número alterno se usa', () => {
    const r = normalizarMensajeEvolution({ key: clave({ remoteJid: '9988@lid', remoteJidAlt: '51900000002@s.whatsapp.net' }), message: { conversation: 'x' } });
    expect(r.ok && r.msg.from).toBe('51900000002');
  });
  it('imagen, nota de voz, ubicación y envoltorio temporal', () => {
    const img = normalizarMensajeEvolution({ key: clave(), message: { imageMessage: { mimetype: 'image/jpeg', caption: 'voucher' } } });
    expect(img.ok && img.msg).toMatchObject({ type: 'image', image: { id: 'evo:MSG1', mime_type: 'image/jpeg', caption: 'voucher' } });
    const voz = normalizarMensajeEvolution({ key: clave(), message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } } });
    expect(voz.ok && voz.msg).toMatchObject({ type: 'audio', audio: { mime_type: 'audio/ogg', voice: true } });
    const loc = normalizarMensajeEvolution({ key: clave(), message: { locationMessage: { degreesLatitude: -12.1, degreesLongitude: -77.0 } } });
    expect(loc.ok && loc.msg).toMatchObject({ type: 'location', location: { latitude: -12.1, longitude: -77 } });
    const temp = normalizarMensajeEvolution({ key: clave(), message: { ephemeralMessage: { message: { extendedTextMessage: { text: 'hola' } } } } });
    expect(temp.ok && temp.msg.text.body).toBe('hola');
  });
});

describe('reglas anti-bloqueo puras', () => {
  it('limita los enlaces', () => {
    expect(limitarEnlaces('a https://x.pe/1 b https://x.pe/2 c https://x.pe/3', 1)).toBe('a https://x.pe/1 b (enlace omitido) c (enlace omitido)');
    expect(limitarEnlaces('sin enlaces', 1)).toBe('sin enlaces');
  });
  it('varía el saludo solo si el texto empieza con uno', () => {
    expect(variarSaludo('¡Hola Ana! Tu pedido está listo', 1)).toBe('Buenas, Ana! Tu pedido está listo');
    expect(variarSaludo('Tu pedido está listo', 1)).toBe('Tu pedido está listo');
  });
  it('pausa aleatoria dentro del rango y «escribiendo» con piso y techo', () => {
    expect(pausaAleatoriaMs(2, 6, 0)).toBe(2000);
    expect(pausaAleatoriaMs(2, 6, 1)).toBe(6000);
    expect(pausaAleatoriaMs(2, 6, 0.5)).toBe(4000);
    expect(escribiendoMs('hola', 40)).toBe(1000);
    expect(escribiendoMs('x'.repeat(100), 40)).toBe(4000);
    expect(escribiendoMs('x'.repeat(1000), 40)).toBe(8000);
  });
  it('horario en hora de Lima (UTC-5)', () => {
    expect(dentroDeHorario(new Date('2026-11-13T15:00:00Z'), 9, 22)).toBe(true); // 10:00 Lima
    expect(dentroDeHorario(new Date('2026-11-13T03:00:00Z'), 9, 22)).toBe(false); // 22:00 Lima
    expect(dentroDeHorario(new Date('2026-11-13T13:59:00Z'), 9, 22)).toBe(false); // 08:59 Lima
  });
});
