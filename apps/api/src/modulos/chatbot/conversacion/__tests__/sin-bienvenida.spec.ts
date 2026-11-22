import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';

const ctx = (extra: any = {}) => ({
  nombreCliente: 'Carlos Pérez',
  cartaUrlPublica: 'https://carta.test',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: 'x', telefono: '1' } as any,
  categoriasCarta: [],
  ofertas: [],
  ...extra,
});
const flujoMenu = { estado: 'MENU', pedido: null, repreguntasFallidas: 0 } as any;

describe('Bienvenida con menú (regla del dueño)', () => {
  it('cliente con pedido de hoy escribe «hola» tras Atendido: no recibe la lista de bienvenida', () => {
    const r = transicionarEstado(flujoMenu, normalizarEntrada({ texto: 'hola' }), ctx({ sinBienvenida: true, pedidoActivo: { codigo: 'CP-0007' } }));
    expect(r.acciones.map((a: any) => a.tipo)).toEqual(['enviarBotones']);
    expect((r.acciones[0] as any).texto).toContain('CP-0007');
    expect((r.acciones[0] as any).texto).toContain('Carlos');
  });
  it('sin conversación reciente sí saluda con el menú', () => {
    const r = transicionarEstado(flujoMenu, normalizarEntrada({ texto: 'hola' }), ctx({ sinBienvenida: false }));
    expect(r.acciones.map((a: any) => a.tipo)).toEqual(['enviarLista']);
  });
  it('si el cliente pide «menú» explícitamente, se le muestra aunque haya conversación reciente', () => {
    const r = transicionarEstado(flujoMenu, normalizarEntrada({ texto: 'menu' }), ctx({ sinBienvenida: true }));
    expect(r.acciones.map((a: any) => a.tipo)).toEqual(['enviarLista']);
  });
  it('«Y las opciones son???» muestra el menú completo, no el «Hola de nuevo»', () => {
    const r = transicionarEstado({ estado: 'INICIO', pedido: null, repreguntasFallidas: 0 } as any, normalizarEntrada({ texto: 'Y las opciones son???' }), ctx({ sinBienvenida: true }));
    expect(r.acciones.map((a: any) => a.tipo)).toEqual(['enviarLista']);
  });
  it('texto libre en INICIO con conversación reciente no cae en el «Hola de nuevo» con un solo botón', () => {
    const inicio = { estado: 'INICIO', pedido: null, repreguntasFallidas: 0 } as any;
    const r = transicionarEstado(inicio, normalizarEntrada({ texto: 'que tienen' }), ctx({ sinBienvenida: true }));
    expect((r.acciones[0] as any)?.texto ?? '').not.toContain('Hola de nuevo');
  });

  it('el menú corto (ya conversamos) trae la invitación a la carta con su enlace, y respeta una frase propia', () => {
    const r = transicionarEstado(flujoMenu, normalizarEntrada({ texto: 'menu' }), ctx({ sinBienvenida: true }));
    const t: string = (r.acciones[0] as any).texto;
    expect(t).toContain('NUEVA CARTA VIRTUAL');
    expect(t).toContain('https://carta.test');
    expect(t).not.toContain('{');
    const p = transicionarEstado(flujoMenu, normalizarEntrada({ texto: 'menu' }), ctx({ sinBienvenida: true, textosPersonalizados: { chatbot_texto_mas_descuento: 'Mira {link_carta}' } }));
    expect((p.acciones[0] as any).texto).toContain('Mira https://carta.test');
  });
});
