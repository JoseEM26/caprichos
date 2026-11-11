import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

/** Factura por WhatsApp con RUC ya guardado en la cuenta del celular que escribe. */
describe('Pedido por WhatsApp: RUC guardado en la cuenta', () => {
  const base = {
    nombreCliente: 'Carlos Test',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: 'x', telefono: '999', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0 },
    datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: { efectivo: { activo: true } } },
    categoriasCarta: [],
    ofertas: [],
  };
  const conGuardado = { ...base, facturaGuardada: { ruc: '20000000015', razonSocial: 'Empresa de Prueba SAC' } } as any as ContextoConversacion;
  const sinGuardado = base as any as ContextoConversacion;

  const flujoEn = (estado: string): FlujoConversacion =>
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
        items: [{ lineaId: 'l1', productoId: 'p1', productoNombre: 'H', categoriaId: 'c', categoriaNombre: 'C', cantidad: 1, precioUnitario: 20, subtotal: 20, opciones: [], noSumaBeneficios: false }],
      },
    }) as any;
  const paso = (f: FlujoConversacion, e: Parameters<typeof normalizarEntrada>[0], c: ContextoConversacion) =>
    transicionarEstado(f, normalizarEntrada(e), c);

  it('con RUC guardado ofrece usarlo, enmascarado (no lo muestra completo)', () => {
    const r = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_factura' }, conGuardado);
    const texto = (r.acciones[0] as any).texto as string;
    expect(texto).toMatch(/guardado/);
    expect(texto).toContain('20*******15');
    expect(texto).not.toContain('20000000015');
  });

  it('SI usa el RUC y la razón guardados y salta al resumen sin pedir nada más', () => {
    const r1 = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_factura' }, conGuardado);
    const r2 = paso(r1.nuevoFlujo, { texto: 'si', textoOriginal: 'SI' }, conGuardado);
    expect(r2.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect((r2.nuevoFlujo.pedido as any).comprobante).toMatchObject({ tipo: 'FACTURA', ruc: '20000000015', razonSocial: 'Empresa de Prueba SAC' });
  });

  it('sin RUC guardado sigue igual: pide el RUC y «si» no vale como RUC', () => {
    const r1 = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_factura' }, sinGuardado);
    expect((r1.acciones[0] as any).texto).toMatch(/escribe el RUC de tu empresa/i);
    const r2 = paso(r1.nuevoFlujo, { texto: 'si', textoOriginal: 'si' }, sinGuardado);
    expect(r2.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RUC');
  });

  it('con RUC guardado, escribir otro RUC sigue siendo posible (pasa a la razón social)', () => {
    const r1 = paso(flujoEn('PEDIDO_COMPROBANTE_TIPO'), { buttonPayload: 'ped_comp_factura' }, conGuardado);
    const r2 = paso(r1.nuevoFlujo, { texto: '20123456789', textoOriginal: '20123456789' }, conGuardado);
    expect(r2.nuevoEstado).toBe('PEDIDO_COMPROBANTE_RAZON');
  });
});
