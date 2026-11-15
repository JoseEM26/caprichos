jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';

/**
 * WhatsApp en todos los pedidos: recibido, pago confirmado y entregado salen por cualquier canal y modalidad
 * con celular válido; un aviso por evento y pedido; sin celular, del personal o con el interruptor apagado, nada.
 */
describe('AvisosPedidoService: avisos en todos los pedidos', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let pedido: any;
  let parametros: Record<string, unknown>;
  let etapasCreadas: Set<number>;

  beforeEach(() => {
    pedido = {
      id: BigInt(55), codigo: 'CP-055', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'COMER_LOCAL',
      canal: 'CAJA', es_personal: false, total: 20, pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO',
    };
    parametros = {};
    etapasCreadas = new Set();
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido) },
      parametro: { findUnique: jest.fn(async ({ where }: any) => ({ valor: parametros[where.clave] ?? 'si' })) },
      mensajeReparto: {
        findUnique: jest.fn(async ({ where }: any) => (etapasCreadas.has(where.pedido_id_numero.numero) ? { numero: 1 } : null)),
        create: jest.fn(async ({ data }: any) => { etapasCreadas.add(data.numero); return {}; }),
        createMany: jest.fn(async ({ data }: any) => { for (const d of data) etapasCreadas.add(d.numero); return { count: data.length }; }),
      },
      salienteWhatsapp: { findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 1 })) },
      conversacion: { upsert: jest.fn().mockResolvedValue({ id: BigInt(5), flujo: null }), update: jest.fn() },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  const casos: [string, string, string][] = [
    ['CARTA', 'RECOGER', 'recojo de la carta'],
    ['CAJA', 'COMER_LOCAL', 'Caja en el local'],
    ['CAJA', 'PARA_LLEVAR', 'Caja para llevar'],
    ['MOZO', 'MESA', 'mozo en mesa'],
    ['CARTA', 'DELIVERY', 'delivery de la carta'],
  ];

  it.each(casos)('canal %s / %s (%s): recibido, pago confirmado y entregado se encolan, uno por evento', async (canal, modalidad) => {
    pedido.canal = canal;
    pedido.modalidad = modalidad;
    for (const etapa of ['RECIBIDO', 'ACEPTADO', 'ENTREGADO'] as const) {
      expect((await servicio.avisar(55, etapa)).estado).toBe('ENCOLADO');
    }
    const claves = outbox.encolar.mock.calls.map((c: any[]) => c[0].clave);
    expect(claves).toEqual(['pedido-55-RECIBIDO', 'pedido-55-ACEPTADO', 'pedido-55-ENTREGADO']);
  });

  it('pago confirmado en un pedido que no es delivery usa el texto y la plantilla de «recibimos tu pago»', async () => {
    await servicio.avisar(55, 'ACEPTADO');
    const carga = outbox.encolar.mock.calls[0][0].carga;
    expect(carga.plantillaClave).toBe('PAGO_CONFIRMADO');
    expect(carga.textoLibre).toContain('recibimos tu pago');
  });

  it('sin duplicados: repetir el mismo evento no vuelve a encolar', async () => {
    await servicio.avisar(55, 'ENTREGADO');
    const otra = await servicio.avisar(55, 'ENTREGADO');
    expect(otra.estado).toBe('YA_ENVIADO');
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });

  it.each([['vacío', ''], ['relleno 999999999', '999999999'], ['nulo', null]])('celular %s: no sale nada', async (_n, tel) => {
    pedido.cliente_telefono = tel;
    for (const etapa of ['RECIBIDO', 'ACEPTADO', 'ENTREGADO'] as const) {
      expect(await servicio.avisar(55, etapa)).toEqual({ estado: 'OMITIDO', motivo: 'SIN_TELEFONO' });
    }
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('pedido del personal: no sale nada', async () => {
    pedido.es_personal = true;
    expect(await servicio.avisar(55, 'RECIBIDO')).toEqual({ estado: 'OMITIDO', motivo: 'PEDIDO_PERSONAL' });
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('interruptor general apagado: Caja y mozo no reciben nada, pero la carta delivery sigue como hoy', async () => {
    parametros.whatsapp_aviso_todos_pedidos_activo = 'no';
    expect((await servicio.avisar(55, 'ENTREGADO')).motivo).toBe('DESACTIVADO');
    pedido.canal = 'CARTA';
    pedido.modalidad = 'DELIVERY';
    expect((await servicio.avisar(55, 'ENTREGADO')).estado).toBe('ENCOLADO');
  });

  it('interruptor propio apagado (pago confirmado): ese aviso no sale', async () => {
    parametros.whatsapp_aviso_pago_confirmado_activo = 'no';
    expect((await servicio.avisar(55, 'ACEPTADO')).motivo).toBe('DESACTIVADO');
  });

  it.each(['BOT', 'WHATSAPP'])('canal %s: no manda «recibido» extra (lo confirma el bot) pero sí pago confirmado y entregado', async (canal) => {
    pedido.canal = canal;
    expect(await servicio.avisar(55, 'RECIBIDO')).toEqual({ estado: 'OMITIDO', motivo: 'LO_CONFIRMA_EL_BOT' });
    expect((await servicio.avisar(55, 'ACEPTADO')).estado).toBe('ENCOLADO');
    expect((await servicio.avisar(55, 'ENTREGADO')).estado).toBe('ENCOLADO');
    expect(outbox.encolar.mock.calls.map((c: any[]) => c[0].clave)).toEqual(['pedido-55-ACEPTADO', 'pedido-55-ENTREGADO']);
  });

  it('pago confirmado en mesa o ya entregado: texto libre sin «en preparación»; en recojo en preparación sí lo dice', async () => {
    pedido.modalidad = 'MESA';
    await servicio.avisar(55, 'ACEPTADO');
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toBe('Hola Rosa, recibimos tu pago del pedido CP-055. ¡Gracias!');
    expect(outbox.encolar.mock.calls[0][0].carga.plantillaClave).toBe('PAGO_CONFIRMADO');

    outbox.encolar.mockClear(); etapasCreadas.clear();
    pedido.modalidad = 'RECOGER'; pedido.estado = 'ENTREGADO';
    await servicio.avisar(55, 'ACEPTADO');
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).not.toContain('preparacion');

    outbox.encolar.mockClear(); etapasCreadas.clear();
    pedido.estado = 'COLA';
    await servicio.avisar(55, 'ACEPTADO');
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toContain('esta en preparacion');
  });

  describe('menos mensajes: «recibido» y «pago confirmado» en uno solo si el pedido ya está pagado', () => {
    const conLineas = (extra: any = {}) => {
      Object.assign(pedido, {
        pago_estado: 'PAGADO', estado: 'COLA',
        lineas: [{ id: BigInt(1), linea_combo_id: null, nombre: 'Dona', cantidad: 2, tamano: null, sabor: null, nota: null, opciones: null, opcionesElegidas: [], sabores: [] }],
        planPago: [], ...extra,
      });
    };
    const textos = () => outbox.encolar.mock.calls.map((c: any[]) => c[0].carga.textoLibre as string);

    it('pagado al crearse: un solo mensaje con el pago, y el aviso de pago confirmado ya no sale aparte', async () => {
      conLineas();
      expect((await servicio.avisar(55, 'RECIBIDO')).estado).toBe('ENCOLADO');
      expect(textos()).toHaveLength(1);
      expect(textos()[0]).toMatch(/pago (recibido|confirmado)/i);
      expect(etapasCreadas.has(6)).toBe(true);
      expect(await servicio.avisar(55, 'ACEPTADO')).toMatchObject({ estado: 'YA_ENVIADO' });
      expect(outbox.encolar).toHaveBeenCalledTimes(1);
    });

    it('sin pagar al crearse: recibido sale solo y el pago confirmado sale después, como dos mensajes', async () => {
      conLineas({ pago_estado: 'PENDIENTE' });
      await servicio.avisar(55, 'RECIBIDO');
      expect(etapasCreadas.has(6)).toBe(false);
      pedido.pago_estado = 'PAGADO';
      expect((await servicio.avisar(55, 'ACEPTADO')).estado).toBe('ENCOLADO');
      expect(textos()).toHaveLength(2);
    });

    it('delivery pagado: no se junta (su «aceptado» avisa que ya lo preparan, otra cosa)', async () => {
      conLineas({ modalidad: 'DELIVERY', canal: 'CARTA' });
      await servicio.avisar(55, 'RECIBIDO');
      expect(etapasCreadas.has(6)).toBe(false);
    });

    it('con el interruptor de pago confirmado apagado no se inventa nada que juntar', async () => {
      parametros.whatsapp_aviso_pago_confirmado_activo = 'no';
      conLineas();
      await servicio.avisar(55, 'RECIBIDO');
      expect(etapasCreadas.has(6)).toBe(false);
    });

    it('el pago se confirma cuando «recibido» aún espera en la cola: se le suma la línea y no sale otro mensaje', async () => {
      prisma.salienteWhatsapp.findUnique.mockResolvedValueOnce({ id: BigInt(9), estado: 'PENDIENTE', carga: { textoLibre: 'Recibimos tu pedido CP-055.', plantillaClave: 'CARTA_RECIBIDO_EFECTIVO' } });
      expect(await servicio.avisar(55, 'ACEPTADO')).toMatchObject({ estado: 'YA_ENVIADO', motivo: 'COMBINADO_CON_RECIBIDO' });
      const data = prisma.salienteWhatsapp.updateMany.mock.calls[0][0].data;
      expect(data.carga.textoLibre).toContain('Recibimos tu pedido CP-055.');
      expect(data.carga.textoLibre).toContain('Tu pago ya está confirmado');
      expect(etapasCreadas.has(6)).toBe(true);
      expect(outbox.encolar).not.toHaveBeenCalled();
    });

    it('si «recibido» ya salió, el pago confirmado va en su propio mensaje', async () => {
      prisma.salienteWhatsapp.findUnique.mockResolvedValueOnce({ id: BigInt(9), estado: 'ENVIADO', carga: { textoLibre: 'x' } });
      expect((await servicio.avisar(55, 'ACEPTADO')).estado).toBe('ENCOLADO');
      expect(prisma.salienteWhatsapp.updateMany).not.toHaveBeenCalled();
    });
  });
});
