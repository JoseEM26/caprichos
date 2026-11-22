import { Simulador } from './simulador-conversacion';

const pedido = (codigo: string, estado = 'COLA', extra: any = {}) => ({ id: 1n, codigo, estado, pago_estado: 'PENDIENTE', total: 25, es_personal: false, ...extra });
const nuevo = (contexto: any) => { const s = new Simulador({ contexto }); s.di('hola'); const di = s.di.bind(s); return s; };
const texto = (r: { texto: string }[]) => r.map((m) => m.texto).join('\n');

describe('bot: «Estado de mi pedido»', () => {
  it('pedido del equipo (descuento) en cola del mismo celular: lo muestra', () => {
    const p = pedido('CP-W435', 'COLA', { es_personal: true });
    const r = texto(nuevo({ pedidoActivo: p, pedidosEnCurso: [p] }).di('estado de mi pedido'));
    expect(r).toContain('CP-W435');
    expect(r).not.toMatch(/No tienes un pedido activo/);
  });

  it('varios en curso: lista corta para elegir', () => {
    const lista = [pedido('CP-0002', 'PREPARANDO'), pedido('CP-0001', 'COLA')];
    const r = nuevo({ pedidoActivo: lista[0], pedidosEnCurso: lista }).di('estado de mi pedido');
    expect(r[0].tipo).toBe('lista');
    expect(r[0].texto).toContain('CP-0002');
    expect(r[0].texto).toContain('CP-0001');
  });

  it('chat LID sin llave: no dice «no tienes pedido», lo manda al botón de la carta', () => {
    const t = texto(nuevo({ pedidoActivo: null, pedidosEnCurso: [], chatSinLlave: true }).di('estado de mi pedido'));
    expect(t).toMatch(/Recibir mi pedido por WhatsApp/);
    expect(t).not.toMatch(/No tienes un pedido activo/);
  });

  it('con llave y sin pedidos en curso: sí dice que no hay pedido activo', () => {
    expect(texto(nuevo({ pedidoActivo: null, pedidosEnCurso: [], chatSinLlave: false }).di('estado de mi pedido'))).toMatch(/No tienes un pedido activo/);
  });

  it('«Hola, mi pedido CP-W435 (clave X)» con IA encendida: responde por reglas con el resumen, no por la IA', () => {
    const p = pedido('CP-W435', 'COLA', { es_personal: true });
    const s = new Simulador({ contexto: { pedidoActivo: p, pedidosEnCurso: [p] }, ia: () => ({ texto: 'No tengo información sobre el pedido' }) });
    const r = texto(s.di('Hola, mi pedido CP-W435 (clave CQP9E)'));
    expect(s.preguntasIa).toHaveLength(0);
    expect(r).toContain('CP-W435');
  });
});
