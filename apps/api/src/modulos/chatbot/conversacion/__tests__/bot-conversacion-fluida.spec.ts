import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { iaAfirmaSinDatos } from '../escalado-ia.util';

const URL = 'https://carta.test';
const prod = (id: string, nombre: string, precio = 10) => ({ id, nombre, precio, disponible: true, fotoUrl: null, tamanos: [] });
const ctx = (extra: any = {}): any => ({
  nombreCliente: 'Carlos',
  cartaUrlPublica: URL,
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Av. Principal 1', enlaceMapa: 'm', telefono: '999' },
  categoriasCarta: [
    { id: 'c1', nombre: 'Bebidas frías', productos: [prod('1', 'Frappe Fresa', 14), prod('2', 'Limonada', 8)] },
    { id: 'c2', nombre: 'Postres', productos: [prod('3', 'Carrot cake', 12), prod('4', 'Waffle', 15)] },
  ],
  ofertas: [],
  ...extra,
});
/** Una vuelta de la conversación: devuelve el resultado y el flujo para la siguiente. */
const turno = (flujo: any, entrada: any, contexto = ctx()) => {
  const r = transicionarEstado(flujo, normalizarEntrada(entrada), contexto);
  return { r, flujo: r.nuevoFlujo as any };
};
const tipos = (r: any) => r.acciones.map((a: any) => a.tipo);
const textos = (r: any) => r.acciones.map((a: any) => a.texto).filter(Boolean);
const MENU = { version: 2, estado: 'MENU', repreguntasFallidas: 0 };

/** Flujo de pedido parado en el paso de elegir producto de «Postres». */
const enElegirProducto = () => {
  let { flujo } = turno(MENU, { listRowId: 'pedir' });
  ({ flujo } = turno(flujo, { buttonPayload: 'ped_mod_recojer' }));
  ({ flujo } = turno(flujo, { listRowId: 'ped_cat_c2' }));
  return flujo;
};

describe('Bot conversacional fluido', () => {
  describe('conversación A (bebidas frías, «por favor 1»)', () => {
    it('«Bebidas frias» responde con la categoría y precios reales, con el saludo y el enlace de la carta', () => {
      const { r } = turno({ version: 2, estado: 'INICIO', repreguntasFallidas: 0 }, { texto: 'Bebidas frias' });
      const t = textos(r).join('\n');
      expect(t).toContain('Frappe Fresa S/ 14.00');
      expect(t).toContain('Limonada S/ 8.00');
      expect(t).toContain(URL);
      expect(t).toContain('¡Hola!');
    });

    it('«Por favor 1» sin menú vigente muestra el menú, no la frase fría', () => {
      const { r } = turno(MENU, { texto: 'Por favor 1' });
      expect(tipos(r)).toEqual(['enviarLista']);
      expect(textos(r).join(' ')).not.toContain('Te ayudo con pedidos');
    });
  });

  describe('conversación B (torta de cumpleaños, atrapado en elegir producto)', () => {
    const mensajes = [
      'una consulta, haces tortas pequeñas de cumpleaños?',
      'y tienes foto?',
      'me envías las fotos por fa',
      'un carrot cake pero para cumpleaños uno pequeño',
      'me ibas a pasar alguna torta de feliz cumpleaños pequeña',
    ];
    it.each(mensajes)('«%s» pasa a asesor, urgente, con mensaje cálido', (m) => {
      const { r } = turno(MENU, { texto: m });
      const pase: any = r.acciones.find((a: any) => a.tipo === 'pasarAPersona');
      expect(pase.esUrgente).toBe(true);
      expect(pase.motivo).toBe('PEDIDO_ESPECIAL');
      expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(textos(r).join(' ')).toContain('💛');
    });

    it('también si el cliente estaba atrapado en el paso de elegir producto', () => {
      const { r } = turno(enElegirProducto(), { texto: 'una consulta, haces tortas pequeñas de cumpleaños?' });
      expect(tipos(r)).toContain('pasarAPersona');
    });

    it('con el local cerrado avisa la hora de apertura', () => {
      const c = ctx({ datosLocal: { abierta: false, abre: '15:00', cierra: '23:00' } });
      const { r } = turno(MENU, { texto: 'quiero una torta de cumpleaños' }, c);
      expect(textos(r).join(' ')).toContain('apenas abramos a las 15:00');
    });

    it('«gracias =D» y textos sin sentido en elegir producto no repiten «Por favor elige»: nunca atrapa', () => {
      const flujo = enElegirProducto();
      expect(flujo.estado).toBe('PEDIDO_PRODUCTOS');
      const g = turno(flujo, { texto: 'gracias =D' });
      expect(textos(g.r).join(' ')).not.toContain('Por favor elige');
      expect(textos(g.r)).toHaveLength(1);
      expect(g.flujo.estado).toBe('PEDIDO_PRODUCTOS');
      // dos textos sin sentido seguidos (sin IA): primero re-muestra, luego ofrece una persona
      const a = turno(flujo, { texto: 'blablabla' });
      expect(tipos(a.r).length).toBeGreaterThan(0);
      const b = turno(a.flujo, { texto: 'xyzxyz' });
      expect(textos(b.r)[0]).toContain('¿Quieres que te atienda una persona?');
      expect((b.r.acciones[0] as any).botones.map((x: any) => x.id)).toEqual(['asesor_si', 'asesor_no']);
      // 1 = Sí → asesor
      const si = turno(b.flujo, { buttonPayload: 'asesor_si' });
      expect(tipos(si.r)).toContain('pasarAPersona');
      // 2 = Seguir pidiendo → vuelve al pedido, sin la oferta
      const no = turno(b.flujo, { buttonPayload: 'asesor_no' });
      expect(no.flujo.ofertaAsesor).toBeUndefined();
      expect(no.flujo.estado).toBe('PEDIDO_PRODUCTOS');
    });

    it('en el paso de producto una pregunta libre va a la IA (si está activa) y el flujo sigue', () => {
      const { r, flujo } = turno(enElegirProducto(), { texto: 'tienen algo sin azucar?' }, ctx({ chatbotIaActivo: true }));
      expect(tipos(r)).toEqual(['consultarIa']);
      expect(flujo.estado).toBe('PEDIDO_PRODUCTOS');
    });
  });

  it('«asesor», «cancelar» y «menú» siempre responden dentro de un paso del pedido', () => {
    const flujo = enElegirProducto();
    expect(tipos(turno(flujo, { texto: 'asesor' }).r)).toContain('pasarAPersona');
    expect(turno(flujo, { texto: 'cancelar' }).r.acciones.length).toBeGreaterThan(0);
    expect(turno(flujo, { texto: 'menu' }).r.acciones.length).toBeGreaterThan(0);
  });

  it('oferta de asesor fuera de pedido: «si xfa» pasa a asesor y «2» vuelve al menú', () => {
    const base = { ...MENU, ofertaAsesor: { tipo: 'menu' } };
    expect(tipos(turno(base, { texto: 'si xfa' }).r)).toContain('pasarAPersona');
    expect(tipos(turno(base, { texto: '2' }).r)).toEqual(['enviarLista']);
  });

  describe('la IA no inventa', () => {
    it('afirmar precios o disponibilidad sin herramientas se descarta', () => {
      expect(iaAfirmaSinDatos('Sí, hacemos tortas pequeñas desde S/ 40', [])).toBe(true);
      expect(iaAfirmaSinDatos('Sí, tenemos tortas pequeñas', ['pasarAPersona'])).toBe(true);
    });
    it('con datos de una herramienta o sin afirmaciones se deja pasar', () => {
      expect(iaAfirmaSinDatos('El frappe cuesta S/ 14', ['buscarEnCarta'])).toBe(false);
      expect(iaAfirmaSinDatos('Con gusto te ayudo 💛', [])).toBe(false);
    });
  });
});
