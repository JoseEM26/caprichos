import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

const ctx = (extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
  nombreCliente: 'Ana',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: { abierta: true, direccion: 'x', enlaceMapa: 'm' } as any,
  categoriasCarta: [],
  ofertas: [],
  ...extra,
});
const flujo = (repreguntasFallidas = 0): FlujoConversacion =>
  ({ version: 2, repreguntasFallidas, estado: 'MENU', pedido: null } as any);
const paso = (f: FlujoConversacion, e: any, c = ctx()) => transicionarEstado(f, normalizarEntrada(e), c);
const tipos = (r: any) => r.acciones.map((a: any) => a.tipo);
const pedido = { id: 7n, codigo: 'CP-0007', estado: 'PREPARANDO', modalidad: 'DELIVERY', pago_estado: 'PAGADO', eta_min: 30, eta_max: 40 };

describe('El bot no se pierde', () => {
  it.each(['dentro de cuanto tiempo llega?', 'ya viene mi pedido', 'confirma mi pedido'])('«%s» responde el estado y el tiempo del pedido activo', (t) => {
    const r: any = paso(flujo(), { texto: t }, ctx({ pedidoActivo: pedido }));
    expect(r.acciones[0].texto).toContain('CP-0007');
    expect(r.acciones[0].texto).toContain('30 a 40 min');
  });

  it('sin pedido activo (o ya entregado) lo dice y ofrece el menú', () => {
    const r: any = paso(flujo(), { texto: 'cuanto demora' }, ctx({ pedidoActivo: { ...pedido, estado: 'ENTREGADO' } }));
    expect(r.acciones[0].texto).toMatch(/no tienes un pedido activo/i);
  });

  it.each(['ok', '👍', 'listo'])('«%s» es un agradecimiento corto sin menú ni «no entendí»', (t) => {
    const r: any = paso(flujo(), { texto: t });
    expect(tipos(r)).toEqual(['enviarTexto']);
  });

  it('ubicación con delivery activo avisa al equipo', () => {
    const r: any = paso(flujo(), { tipo: 'location', ubicacion: { latitud: -12.01, longitud: -76.9 } }, ctx({ pedidoActivo: pedido }));
    expect(tipos(r)).toEqual(['crearSolicitudCambio', 'enviarTexto']);
    expect(r.acciones[0]).toMatchObject({ tipoCambio: 'DIRECCION', lat: -12.01, pedidoId: '7' });
  });

  it('texto raro: con IA encendida consulta a la IA', () => {
    const r: any = paso(flujo(), { texto: 'blablabla xyz' }, ctx({ chatbotIaActivo: true }));
    expect(tipos(r)).toEqual(['consultarIa']);
  });

  it('texto raro sin IA: primer «no entendí» muestra el menú, el segundo seguido pasa a una persona', () => {
    const r1: any = paso(flujo(), { texto: 'blablabla xyz' });
    expect(tipos(r1)).toEqual(['enviarLista']);
    expect(r1.nuevoFlujo.repreguntasFallidas).toBe(1);
    const r2: any = paso(r1.nuevoFlujo, { texto: 'blablabla xyz' });
    expect(tipos(r2)).toEqual(['pasarAPersona', 'enviarTexto']);
    expect(r2.nuevoEstado).toBe('ATENCION_PERSONA');
  });
});
