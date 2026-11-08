import {
  BIENVENIDA_ANTIGUA_PRODUCTO_DEL_MES,
  TEXTOS_BOT_DEFECTO,
} from '../../configuracion/chatbot-configuracion.tipos';
import { armarBienvenida, lineasPromosVigentes } from '../bienvenida.util';
import { TEXTOS_BOT } from '../textos-bot';

const oferta = (o: any) => ({ activo: true, vigenteAhora: true, visibleCarta: true, orden: 0, tipo: 'DESCUENTO', descuentoTipo: 'PORCENTAJE', ...o });
const LINK = 'https://caprichos.pe';

describe('Bienvenida del bot (fuente única)', () => {
  it('ya no incluye el producto del mes y trae la frase y el enlace de la carta virtual', () => {
    const t = armarBienvenida('Ana', { abierta: true }, { linkCarta: LINK });
    expect(t).not.toMatch(/DEL MES|Frappe/i);
    expect(t).toContain('¡Hola Ana!');
    expect(t).toContain('MÁS DESCUENTO');
    expect(t).toContain('CARTA VIRTUAL');
    expect(t).toContain(LINK);
  });

  it('sin nombre no deja «¡Hola !» ni coma colgada', () => {
    expect(armarBienvenida(null, { abierta: true }, { linkCarta: LINK })).toContain('¡Hola! ☕');
  });

  it('incluye hasta N promociones vigentes ordenadas y omite la sección si no hay', () => {
    const ofertas = [
      oferta({ nombre: 'C', orden: 3, descuentoValor: 5 }),
      oferta({ nombre: 'A', orden: 1, descuentoValor: 10 }),
      oferta({ nombre: 'B', orden: 1, descuentoValor: 20 }),
      oferta({ nombre: 'D', orden: 4, descuentoValor: 1 }),
    ];
    const lineas = lineasPromosVigentes(ofertas, 3);
    expect(lineas).toEqual(['• B — 20 % de descuento', '• A — 10 % de descuento', '• C — 5 % de descuento']);
    const t = armarBienvenida('Ana', { abierta: true }, { promos: lineas, linkCarta: LINK });
    expect(t).toContain('🔥 Hoy tenemos:');
    expect(t.indexOf('• B')).toBeLessThan(t.indexOf('• A'));

    const sin = armarBienvenida('Ana', { abierta: true }, { promos: [], linkCarta: LINK });
    expect(sin).not.toContain('Hoy tenemos');
    expect(sin).not.toMatch(/\n\n\n/);
  });

  it('descarta vencidas, inactivas, ocultas y combos no armables; formatea combos y monto', () => {
    const lineas = lineasPromosVigentes(
      [
        oferta({ nombre: 'Vencida', vigenteAhora: false }),
        oferta({ nombre: 'Inactiva', activo: false }),
        oferta({ nombre: 'Oculta', visibleCarta: false }),
        oferta({ nombre: 'Combo agotado', tipo: 'COMBO', disponible: false, combosPrecio: [{ precio: 30 }] }),
        oferta({ nombre: 'Dúo', tipo: 'COMBO', combosPrecio: [{ precio: 37 }] }),
        oferta({ nombre: 'Cinco', descuentoTipo: 'MONTO', descuentoValor: 5 }),
        oferta({ nombre: '2x1', tipo: 'LLEVA_PAGA', lleva: 2, paga: 1 }),
      ],
      5,
    );
    expect(lineas).toEqual(['• Cinco — S/ 5 de descuento', '• Dúo — S/ 37', '• 2x1 — lleva 2, paga 1']);
  });

  it('respeta el tope configurado y el interruptor «no mostrar»', () => {
    const promos = ['• A', '• B', '• C', '• D'];
    const dos = armarBienvenida('Ana', { abierta: true }, { promos, linkCarta: LINK, textos: { chatbot_promos_max: '2' } });
    expect(dos).toContain('• B');
    expect(dos).not.toContain('• C');
    const off = armarBienvenida('Ana', { abierta: true }, { promos, linkCarta: LINK, textos: { chatbot_promos_mostrar: 'no' } });
    expect(off).not.toContain('• A');
    expect(off).toContain('MÁS DESCUENTO');
  });

  it('cerrado: dice la hora de apertura, no muestra promociones ni invita a pedir', () => {
    const t = armarBienvenida('Ana', { abierta: false, abre: '14:00' }, { promos: ['• A'], linkCarta: LINK });
    expect(t).toContain('Abrimos hoy a las 14:00.');
    expect(t).toContain('No tomamos pedidos fuera de horario');
    expect(t).not.toContain('• A');
    expect(t).not.toContain('MÁS DESCUENTO');
  });

  it('pausa por alta demanda no muestra promociones', () => {
    const t = armarBienvenida('Ana', { abierta: true, pausaAltaDemanda: true, motivoPausa: 'mucho pedido' }, { promos: ['• A'], linkCarta: LINK });
    expect(t).toContain('mucho pedido');
    expect(t).not.toContain('• A');
  });

  it('los textos editados reemplazan a los defectos y {promociones} coloca el bloque donde se pida', () => {
    const t = armarBienvenida('Ana', { abierta: true }, {
      linkCarta: LINK,
      promos: ['• A'],
      textos: {
        chatbot_texto_bienvenida: 'Hola {nombre}, bienvenida a {local}.\n{promociones}\nPide aquí.',
        chatbot_texto_mas_descuento: 'Más ofertas en {link_carta}',
      },
    });
    expect(t).toBe(`Hola Ana, bienvenida a Caprichos.\n🔥 Hoy tenemos:\n• A\nPide aquí.\n\nMás ofertas en ${LINK}`);
  });

  it('un texto vacío o la bienvenida antigua con producto del mes se tratan como sin personalizar', () => {
    for (const v of ['', '  ', BIENVENIDA_ANTIGUA_PRODUCTO_DEL_MES]) {
      const t = armarBienvenida('Ana', { abierta: true }, { linkCarta: LINK, textos: { chatbot_texto_bienvenida: v } });
      expect(t).not.toMatch(/DEL MES/i);
      expect(t.startsWith('¡Hola Ana!')).toBe(true);
    }
  });

  it('nunca pasa de 1024 caracteres: quita promociones antes que cortar una línea', () => {
    const promos = Array.from({ length: 5 }, (_, i) => `• ${'X'.repeat(80)}${i}`);
    const t = armarBienvenida('Ana', { abierta: true }, {
      linkCarta: LINK,
      promos,
      textos: { chatbot_texto_bienvenida: 'H'.repeat(700) },
    });
    expect(t.length).toBeLessThanOrEqual(1024);
    expect(t).toContain('MÁS DESCUENTO');
    const n = (t.match(/•/g) ?? []).length;
    expect(n).toBeLessThan(5);
  });

  it('TEXTOS_BOT.saludoBienvenida (menú e IA comparten) usa el mismo armado', () => {
    const extra = { linkCarta: LINK, promos: ['• A'] };
    expect(TEXTOS_BOT.saludoBienvenida('Ana', { abierta: true } as any, null, extra)).toBe(
      armarBienvenida('Ana', { abierta: true }, extra),
    );
    expect(TEXTOS_BOT_DEFECTO.chatbot_texto_bienvenida).toContain('{nombre}');
  });
});
