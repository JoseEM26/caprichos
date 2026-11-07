import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { BOTONES_PEDIDO_COMPROBANTE } from '../textos-bot';

/** Paso «¿Cómo quieres tu comprobante?» del pedido por WhatsApp: simple / boleta / factura. */
describe('Pedido por WhatsApp: comprobante simple, boleta o factura', () => {
  const contexto: ContextoConversacion = {
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy', enlaceMapa: 'x', telefono: '999', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: { efectivo: { activo: true } } },
    categoriasCarta: [],
    ofertas: [],
  } as any;

  const flujoEn = (estado: string, precio = 20, comprobante?: any): FlujoConversacion =>
    ({
      version: 1,
      estado,
      repreguntasFallidas: 0,
      pedido: {
        estadoInterno: estado,
        modalidad: 'RECOGER',
        cliente: { nombre: 'Carlos Test', telefono: '987654321' },
        pago: { metodo: 'EFECTIVO', pagaCon: 1000 },
        propina: 0,
        ...(comprobante ? { comprobante } : {}),
        items: [
          {
            lineaId: 'l1', productoId: 'p1', productoNombre: 'Hamburguesa', categoriaId: 'c', categoriaNombre: 'C',
            cantidad: 1, precioUnitario: precio, subtotal: precio, opciones: [], noSumaBeneficios: false,
          },
        ],
      },
    }) as any;

  const paso = (f: FlujoConversacion, e: Parameters<typeof normalizarEntrada>[0]) => transicionarEstado(f, normalizarEntrada(e), contexto);
  const dtoDe = (r: ReturnType<typeof paso>) => (r.acciones.find((a) => a.tipo === 'crearPedido') as any)?.dto;

  it('ofrece tres botones de hasta 20 caracteres: simple, boleta y factura', () => {
    expect(BOTONES_PEDIDO_COMPROBANTE.map((b) => b.id)).toEqual(['ped_comp_simple', 'ped_comp_boleta', 'ped_comp_factura']);
    for (const b of BOTONES_PEDIDO_COMPROBANTE) expect(b.titulo.length).toBeLessThanOrEqual(20);
  });

  it('simple no pide datos: pasa al resumen y el pedido sale con comprobante SIMPLE sin documento', () => {
    let r = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_simple' });
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_confirmar_si' });
    expect(dtoDe(r).comprobante).toEqual({ tipo: 'SIMPLE', dni: undefined, ruc: undefined, razonSocial: undefined });
  });

  it('boleta pide DNI, repregunta si es inválido y acepta 8 dígitos', () => {
    let r = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_boleta' });
    expect(r.nuevoEstado).toBe('PEDIDO_COMPROBANTE_DNI');
    r = paso(r.nuevoFlujo, { texto: '1234', textoOriginal: '1234' });
    expect(r.nuevoEstado).toBe('PEDIDO_COMPROBANTE_DNI');
    expect((r.acciones[0] as any).texto).toMatch(/8 dígitos/);
    r = paso(r.nuevoFlujo, { texto: '12345678', textoOriginal: '12345678' });
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_confirmar_si' });
    expect(dtoDe(r).comprobante).toMatchObject({ tipo: 'BOLETA', dni: '12345678' });
  });

  it('boleta: «omitir» sigue sin DNI hasta S/ 700, pero por más de S/ 700 el DNI es obligatorio', () => {
    const omitir = { texto: 'omitir', textoOriginal: 'omitir' };
    const ok = paso(flujoEn('PEDIDO_COMPROBANTE_DNI', 20, { tipo: 'BOLETA' }), omitir);
    expect(ok.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect(ok.nuevoFlujo.pedido?.comprobante).toEqual({ tipo: 'BOLETA' });
    const caro = paso(flujoEn('PEDIDO_COMPROBANTE_DNI', 900, { tipo: 'BOLETA' }), omitir);
    expect(caro.nuevoEstado).toBe('PEDIDO_COMPROBANTE_DNI');
    expect((caro.acciones[0] as any).texto).toMatch(/700/);
  });

  it('factura pide RUC válido (11 dígitos con prefijo 10/15/17/20) y razón social', () => {
    let r = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_factura' });
    expect(r.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RUC');
    for (const malo of ['12345', '30123456789', 'abc']) {
      const x = paso(r.nuevoFlujo, { texto: malo, textoOriginal: malo });
      expect(x.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RUC');
    }
    r = paso(r.nuevoFlujo, { texto: '20123456789', textoOriginal: '20123456789' });
    expect(r.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RAZON');
    const vacia = paso(r.nuevoFlujo, { texto: 'a', textoOriginal: 'a' });
    expect(vacia.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RAZON');
    r = paso(r.nuevoFlujo, { texto: 'Acme SAC', textoOriginal: 'Acme SAC' });
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_confirmar_si' });
    expect(dtoDe(r).comprobante).toMatchObject({ tipo: 'FACTURA', ruc: '20123456789', razonSocial: 'Acme SAC' });
  });

  it('un texto que no es ninguna opción vuelve a preguntar el comprobante', () => {
    const r = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { texto: 'hola', textoOriginal: 'hola' });
    expect(r.nuevoEstado).toBe('PEDIDO_COMPROBANTE_TIPO');
  });

  it('cancelar en medio del paso de DNI pregunta Sí/No y «No» regresa al mismo paso', () => {
    const f = flujoEn('PEDIDO_COMPROBANTE_DNI', 20, { tipo: 'BOLETA' });
    const c = paso(f, { buttonPayload: 'ped_cancelar' });
    expect(c.nuevoEstado).not.toBe('PEDIDO_COMPROBANTE_DNI');
    const no = paso(c.nuevoFlujo, { buttonPayload: 'ped_cancelar_no' });
    expect(no.nuevoEstado).toBe('PEDIDO_COMPROBANTE_DNI');
    const si = paso(c.nuevoFlujo, { buttonPayload: 'ped_cancelar_si' });
    expect(si.nuevoFlujo.pedido).toBeNull();
  });
});
