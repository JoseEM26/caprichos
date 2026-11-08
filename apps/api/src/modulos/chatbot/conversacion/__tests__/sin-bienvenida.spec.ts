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
});
