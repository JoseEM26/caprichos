import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { transicionarEstado } from '../maquina-estados';

// Propina opcional del bot (paso PEDIDO_PROPINA). Va aparte de la venta: el monto se valida y el interruptor
// propina.bot decide si el paso aparece. Se fija el pedido antes del medio de pago para no repetir el resto.
const clasica = {
  lineaId: 'lin_1',
  productoId: '1',
  productoNombre: 'Clásica',
  categoriaId: 'cat_hamb',
  categoriaNombre: 'Hamburguesas',
  cantidad: 2,
  precioUnitario: 20,
  subtotal: 40,
  opciones: [],
  noSumaBeneficios: false,
};

const contextoCon = (bot: boolean, tope = 50): ContextoConversacion =>
  ({
    nombreCliente: 'Ana',
    telefonoCliente: '51987654321',
    cartaUrlPublica: 'https://carta.test',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00' } as any,
    datosLocalPublicos: { propina: { carta: false, bot, tope } },
    categoriasCarta: [],
    ofertas: [],
    vistaPreviaPedido: { subtotal: 40, descuento: 0, descuentoNombre: null, envio: 0, envioGratis: false },
  }) as any;

const flujoEnCarrito = (): FlujoConversacion =>
  ({
    version: 1,
    estado: 'PEDIDO_ACCION_CARRITO',
    repreguntasFallidas: 0,
    pedido: {
      estadoInterno: 'PEDIDO_ACCION_CARRITO',
      modalidad: 'RECOGER',
      items: [clasica],
      cliente: { nombre: 'Ana', telefono: '987654321' },
      comprobante: { tipo: 'NINGUNO' },
    },
  }) as any;

const flujoEnPropina = (estado: 'PEDIDO_PROPINA' | 'PEDIDO_PROPINA_MONTO'): FlujoConversacion =>
  ({
    version: 1,
    estado,
    repreguntasFallidas: 0,
    pedido: { estadoInterno: estado, modalidad: 'RECOGER', items: [clasica], cliente: { nombre: 'Ana', telefono: '987654321' }, comprobante: { tipo: 'NINGUNO' } },
  }) as any;

const boton = (id: string) => normalizarEntrada({ buttonPayload: id, texto: id });
const texto = (t: string) => normalizarEntrada({ texto: t });

describe('Propina opcional en el bot de WhatsApp', () => {
  it('con el interruptor del bot encendido, antes de pagar pregunta por la propina con «Sin propina» y «Dejar propina»', () => {
    const r = transicionarEstado(flujoEnCarrito(), boton('ped_cart_continuar'), contextoCon(true));
    expect(r.nuevoEstado).toBe('PEDIDO_PROPINA');
    const accion = r.acciones[0] as any;
    expect(accion.texto).toContain('Máximo S/ 50.00');
    expect(accion.botones.map((b: any) => b.titulo)).toEqual(['Sin propina', 'Dejar propina']);
  });

  it('con el interruptor apagado no aparece el paso y el pedido sigue hacia el pago', () => {
    const r = transicionarEstado(flujoEnCarrito(), boton('ped_cart_continuar'), contextoCon(false));
    expect(r.nuevoEstado).not.toBe('PEDIDO_PROPINA');
  });

  it('«Sin propina» deja la propina en 0 y sigue el pedido', () => {
    const r = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA'), boton('ped_propina_no'), contextoCon(true));
    expect((r.nuevoFlujo.pedido as any).propina).toBe(0);
    expect(r.nuevoEstado).not.toBe('PEDIDO_PROPINA');
  });

  it('«Dejar propina» pide el monto en soles con un mensaje claro', () => {
    const r = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA'), boton('ped_propina_si'), contextoCon(true));
    expect(r.nuevoEstado).toBe('PEDIDO_PROPINA_MONTO');
    expect((r.acciones[0] as any).texto).toContain('¿Cuánto quieres dejar de propina?');
  });

  it('un monto válido («2,50») se guarda como 2.5 y sigue el pedido', () => {
    const r = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA_MONTO'), texto('2,50'), contextoCon(true));
    expect((r.nuevoFlujo.pedido as any).propina).toBe(2.5);
    expect(r.nuevoEstado).not.toBe('PEDIDO_PROPINA_MONTO');
  });

  it('«5 soles» no se acepta como monto: vuelve a pedir un número con un aviso claro', () => {
    const r = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA_MONTO'), texto('5 soles'), contextoCon(true));
    expect(r.nuevoEstado).toBe('PEDIDO_PROPINA_MONTO');
    expect((r.acciones[0] as any).texto).toContain('Escribe un monto en soles entre 0 y S/ 50.00');
    expect((r.nuevoFlujo.pedido as any).propina).toBeUndefined();
  });

  it('un monto sobre el tope o con más de 2 decimales se rechaza', () => {
    const sobre = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA_MONTO'), texto('60'), contextoCon(true, 50));
    expect(sobre.nuevoEstado).toBe('PEDIDO_PROPINA_MONTO');
    const decimales = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA_MONTO'), texto('1.234'), contextoCon(true));
    expect(decimales.nuevoEstado).toBe('PEDIDO_PROPINA_MONTO');
  });

  it('«sin propina» escrito también cuenta como cero', () => {
    const r = transicionarEstado(flujoEnPropina('PEDIDO_PROPINA_MONTO'), texto('sin propina'), contextoCon(true));
    expect((r.nuevoFlujo.pedido as any).propina).toBe(0);
  });
});
