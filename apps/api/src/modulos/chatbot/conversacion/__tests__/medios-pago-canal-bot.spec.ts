import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { mediosActivos } from '../flujos/pedido/pago-bot.util';
import { mediosPagoPorDefecto } from '@caprichos/compartido';

const TODOS = { efectivo: { activo: true }, yape: { activo: true }, plin: { activo: true }, tarjeta: { activo: true }, transferencia: { activo: true } };
const canalBot = (activos: string[]) => {
  const c = mediosPagoPorDefecto();
  for (const m of Object.keys(c.BOT)) (c.BOT as any)[m] = activos.includes(m);
  return c;
};
const ctx = (activos?: string[]): ContextoConversacion => ({
  nombreCliente: 'Cliente Prueba',
  telefonoCliente: '900000000',
  cartaUrlPublica: 'https://carta.prueba.test',
  datosLocal: { abierta: true, direccion: 'x', enlaceMapa: 'm' } as any,
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, envioGratis: 1, mediosPago: TODOS, ...(activos ? { mediosPagoCanal: canalBot(activos) } : {}) },
  categoriasCarta: [],
  ofertas: [],
});
const flujo = (estado = 'PEDIDO_MEDIO_PAGO'): FlujoConversacion =>
  ({
    version: 2, repreguntasFallidas: 0, estado: estado as any,
    pedido: {
      estadoInterno: estado, modalidad: 'RECOGER',
      items: [{ lineaId: 'a', productoId: 'a', productoNombre: 'Dona', categoriaId: 'c', categoriaNombre: 'C', cantidad: 2, precioUnitario: 10, subtotal: 20, opciones: [], noSumaBeneficios: false }],
      cliente: { nombre: 'Cliente Prueba', telefono: '900000000' }, telefonoSugerido: '900000000',
      comprobante: { tipo: 'NINGUNO' },
    },
  }) as any;
const paso = (f: FlujoConversacion, e: any, c: ContextoConversacion) => transicionarEstado(f, normalizarEntrada(e), c);
const ids = (r: any) => (r.acciones.flatMap((a: any) => [...(a.botones ?? []), ...(a.filas ?? [])]) as any[]).map((b) => b.id);
const textos = (r: any) => r.acciones.map((a: any) => a.texto).join('\n');

describe('Bot: medios de pago por canal', () => {
  it('sin configuración ofrece todos, como siempre', () => {
    expect(mediosActivos(ctx().datosLocalPublicos)).toHaveLength(5);
  });

  it('el menú no ofrece un medio apagado en BOT y no hay «pagar con 2 medios» si queda uno', () => {
    const r = paso(flujo('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_simple' }, ctx(['EFECTIVO', 'YAPE', 'TARJETA']));
    expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
    const o = ids(r);
    expect(o).toEqual(expect.arrayContaining(['ped_pago_efectivo', 'ped_pago_yape', 'ped_pago_tarjeta', 'ped_pago_dividir']));
    expect(o).not.toContain('ped_pago_plin');
    expect(o).not.toContain('ped_pago_transf');
  });

  it('«pago con plin» apagado: no se acepta, responde amable con los medios disponibles', () => {
    const r = paso(flujo(), { texto: 'pago con plin' }, ctx(['EFECTIVO', 'YAPE']));
    expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
    expect(textos(r)).toContain('Plin no está disponible por ahora. Puedes pagar con Efectivo y Yape.');
    expect(r.nuevoFlujo.pedido?.pago?.metodo).toBeUndefined();
  });

  it('pago dividido: el segundo medio apagado tampoco se acepta', () => {
    const f = flujo('PEDIDO_PAGO_DIV_MEDIO1');
    const r = paso(f, { buttonPayload: 'ped_pago_plin' }, ctx(['EFECTIVO', 'YAPE', 'TARJETA']));
    expect(r.nuevoEstado).toBe('PEDIDO_PAGO_DIV_MEDIO1');
    expect(ids(r)).not.toContain('ped_pago_plin');
  });

  it('con un solo medio encendido no pregunta: lo aplica y avisa', () => {
    const r = paso(flujo('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_simple' }, ctx(['YAPE']));
    expect(textos(r)).toContain('Por ahora pagas con Yape.');
    expect(r.nuevoEstado).not.toBe('PEDIDO_MEDIO_PAGO');
    expect(r.nuevoFlujo.pedido?.pago?.metodo).toBe('YAPE');
  });

  it('sin ningún medio encendido deriva a una persona', () => {
    const r = paso(flujo('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_simple' }, ctx([]));
    expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
    expect(r.acciones.some((a: any) => a.tipo === 'pasarAPersona')).toBe(true);
  });
});
