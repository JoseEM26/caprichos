import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';

// Conversación real (20/11): el cliente se ríe, dice «ok» o pregunta por las opciones en medio del pedido
const ctx: any = {
  nombreCliente: 'Ana',
  cartaUrlPublica: 'https://c.t',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: 'x', telefono: '1' },
  categoriasCarta: [
    { id: 1, nombre: 'COMBOS', productos: [{ id: 5, nombre: 'Dúo', precio: 33 }] },
    { id: 2, nombre: 'FRAPPES', productos: [{ id: 6, nombre: 'Oreo', precio: 12 }] },
  ],
  ofertas: [],
};

function enCategorias() {
  let flujo: any = { estado: 'MENU', pedido: null, repreguntasFallidas: 0 };
  flujo = transicionarEstado(flujo, normalizarEntrada({ texto: 'quiero pedir' }), ctx).nuevoFlujo;
  const r = transicionarEstado(flujo, normalizarEntrada({ texto: 'Para recoger' }), ctx);
  return r.nuevoFlujo;
}

describe('Pedido por WhatsApp: el cliente no se equivocó', () => {
  it.each([
    ['Xd', '😄'],
    ['jaja', '😄'],
    ['ok', '¡Con gusto!'],
    ['Y las opciones son???', '¡Claro!'],
  ])('«%s» repite las categorías con un inicio amable, sin ofrecer una persona', (texto, inicio) => {
    let flujo = enCategorias();
    // dos veces seguidas: nunca cae en «¿Quieres que te atienda una persona?»
    for (let i = 0; i < 2; i++) {
      const r = transicionarEstado(flujo, normalizarEntrada({ texto }), ctx);
      const a: any = r.acciones[r.acciones.length - 1];
      expect(r.acciones).toHaveLength(1);
      expect(a.tipo).toBe('enviarLista');
      expect(a.texto.startsWith(inicio)).toBe(true);
      expect(a.texto).not.toContain('no te entendí');
      flujo = r.nuevoFlujo;
    }
  });

  it('un texto que de verdad no se entiende sigue diciendo «no te entendí» en un solo mensaje', () => {
    const r = transicionarEstado(enCategorias(), normalizarEntrada({ texto: 'asdfgh' }), ctx);
    expect(r.acciones).toHaveLength(1);
    expect((r.acciones[0] as any).texto).toContain('no te entendí');
  });
});
