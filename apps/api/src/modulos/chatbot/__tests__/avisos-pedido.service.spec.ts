jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { generarTokenSeguimiento } from '../../pedidos/seguimiento.tokens';

/**
 * Los avisos ya no llaman a Meta: se encolan en el outbox dentro de la transacción del cambio de estado.
 * El envío (texto libre o plantilla según la ventana de 24 h) lo prueba outbox-whatsapp.service.spec.ts.
 */
describe('AvisosPedidoService (avisos de reparto al cliente, encolados en el outbox)', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let pedido: any;
  let parametros: Record<string, unknown>;

  beforeEach(() => {
    pedido = {
      id: BigInt(77),
      codigo: 'CP-077',
      cliente_nombre: 'Marta',
      cliente_telefono: '987654321',
      modalidad: 'DELIVERY',
      total: 30,
      pago_metodo: 'EFECTIVO',
      pago_preferido: 'EFECTIVO',
    };
    parametros = { tiempo_prometido_min: 25 };

    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido) },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => ({ valor: parametros[where.clave] ?? 'si' })),
      },
      mensajeReparto: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      conversacion: {
        upsert: jest.fn().mockResolvedValue({ id: BigInt(5), flujo: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    outbox = {
      encolar: jest.fn().mockResolvedValue(true),
      despertar: jest.fn(),
    };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  it('«Comer en el local»: el aviso de recojo listo no se envía (se le llama por su nombre)', async () => {
    pedido.modalidad = 'COMER_LOCAL';
    const res = await servicio.avisar(77, 'LISTO_RECOJO');

    expect(res).toEqual({ estado: 'OMITIDO', motivo: 'COMER_EN_LOCAL' });
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('encola el aviso con clave pedido-<id>-<ETAPA> y marca la etapa PENDIENTE, en la misma transacción', async () => {
    const res = await servicio.avisar(77, 'LLEGADA');

    expect(res.estado).toBe('ENCOLADO');
    expect(prisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pedido_id: BigInt(77), numero: 2, estado: 'PENDIENTE' }),
    });
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '51987654321',
        tipo: 'TEXTO',
        clave: 'pedido-77-LLEGADA',
        origen: 'AVISO_PEDIDO',
        carga: expect.objectContaining({
          plantillaClave: expect.any(String),
          repartoNumero: 2,
          pedidoCodigo: 'CP-077',
          etapa: 'LLEGADA',
          autor: 'BOT',
        }),
      }),
      expect.anything(),
    );
  });

  it('sin transacción propia: abre una y despierta el envío al confirmarla', async () => {
    await servicio.avisar(77, 'LLEGADA');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(outbox.despertar).toHaveBeenCalledTimes(1);
  });

  it('con transacción ajena: encola dentro de ella y no despierta (lo hace el emisor tras el commit)', async () => {
    const tx = { ...prisma, mensajeReparto: prisma.mensajeReparto };
    await servicio.avisar(77, 'LLEGADA', {}, tx as any);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.encolar).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(outbox.despertar).not.toHaveBeenCalled();
  });

  it('idempotente: si la etapa ya existe en mensaje_reparto no encola nada', async () => {
    prisma.mensajeReparto.findUnique.mockResolvedValueOnce({ numero: 2 });
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('YA_ENVIADO');
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
  });

  it('carrera (P2002 al crear la etapa): se trata como ya encolado', async () => {
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('YA_ENVIADO');
  });

  it('parámetro apagado: no encola ni registra la etapa', async () => {
    parametros.whatsapp_aviso_llegada_activo = 'no';
    prisma.parametro.findUnique.mockImplementation(async ({ where }: any) =>
      where.clave === 'whatsapp_aviso_llegada_activo' ? { valor: 'no' } : { valor: 'si' },
    );
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
  });

  it('LISTO_RECOJO: un pedido de recoger recibe «ya está listo para recoger» con la plantilla de recojo', async () => {
    pedido.modalidad = 'RECOGER';
    const res = await servicio.avisar(77, 'LISTO_RECOJO');
    expect(res.estado).toBe('ENCOLADO');
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        clave: 'pedido-77-LISTO_RECOJO',
        carga: expect.objectContaining({
          plantillaClave: 'PEDIDO_LISTO_RECOJO',
          variablesPlantilla: ['Marta', 'CP-077'],
          textoLibre: expect.stringContaining('ya está listo para recoger'),
        }),
      }),
      expect.anything(),
    );
  });

  it('pedido que no es delivery o sin teléfono: se omite sin encolar', async () => {
    pedido.modalidad = 'RECOJO';
    expect((await servicio.avisar(77, 'LLEGADA')).motivo).toBe('NO_ES_DELIVERY');
    pedido.modalidad = 'DELIVERY';
    pedido.cliente_telefono = '';
    expect((await servicio.avisar(77, 'LLEGADA')).motivo).toBe('SIN_TELEFONO');
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('pago digital en RECIBIDO: encola el aviso y anota el pedido en el chat SIN tomarlo (captura opcional: sin VALIDAR_PAGO ni urgente)', async () => {
    pedido.pago_metodo = 'YAPE';
    pedido.pago_preferido = 'YAPE';
    const res = await servicio.avisar(77, 'RECIBIDO');
    expect(res.estado).toBe('ENCOLADO');
    expect(prisma.conversacion.upsert).toHaveBeenCalled();
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({ carga: expect.objectContaining({ etapa: 'RECIBIDO' }) }),
      expect.anything(),
    );
    const data = prisma.conversacion.update.mock.calls[0][0].data;
    expect(data.flujo.pago).toMatchObject({ pedidoId: '77' });
    expect(data.estado).toBeUndefined();
    expect(data.duenio).toBeUndefined();
    expect(data.urgente).toBeUndefined();
  });

  it('retiro: el texto dice el monto exacto antes del SÍ/NO', async () => {
    await servicio.avisar(77, 'RETIRO', { recargo: 5, recargoModo: 'FIJO' });
    const carga = outbox.encolar.mock.calls[0][0].carga;
    expect(carga.textoLibre).toContain('S/ 5.00');
    expect(carga.repartoNumero).toBe(5);
  });

  it('un error al encolar fuera de transacción no se propaga: el resultado es FALLIDO', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('BD caída'));
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('FALLIDO');
  });

  it('dentro de una transacción ajena el error se propaga para que esa transacción se deshaga', async () => {
    outbox.encolar.mockRejectedValueOnce(new Error('BD caída'));
    await expect(servicio.avisar(77, 'LLEGADA', {}, prisma as any)).rejects.toThrow('BD caída');
  });
});

describe('AvisosPedidoService: puntos en los avisos de la carta', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let marcas: Set<string>;
  let parametrosPuntos: Record<string, unknown>;

  beforeEach(() => {
    process.env.CARTA_URL_PUBLICA = 'https://carta.test';
    marcas = new Set<string>();
    parametrosPuntos = {
      whatsapp_aviso_bienvenida_puntos_activo: 'si',
      whatsapp_aviso_puntos_ganados_activo: 'si',
      whatsapp_plantilla_recibido_seguimiento_activa: 'no',
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: {
        findUnique: jest.fn(async () => ({
          id: BigInt(90),
          codigo: 'CP-090',
          cliente_nombre: 'Lucia',
          cliente_telefono: '987654321',
          modalidad: 'DELIVERY',
          total: 30,
          pago_metodo: 'EFECTIVO',
          pago_preferido: 'EFECTIVO',
          canal: 'CARTA',
          party_id: BigInt(500),
          cliente_party_id: BigInt(500),
          puntos_ganados: 12.5,
        })),
      },
      parametro: { findUnique: jest.fn(async ({ where }: any) => ({ valor: parametrosPuntos[where.clave] ?? 'si' })) },
      mensajeReparto: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      avisoClienteUnico: {
        // Primer aviso del celular: la marca se inserta; después ya existe y no se vuelve a insertar
        createMany: jest.fn(async ({ data }: any) => {
          const clave = `${data.telefono}:${data.aviso}`;
          if (marcas.has(clave)) return { count: 0 };
          marcas.add(clave);
          return { count: 1 };
        }),
      },
      customerDetail: { findFirst: jest.fn(async () => ({ puntos: 40 })) },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  afterEach(() => {
    delete process.env.CARTA_URL_PUBLICA;
  });

  const cargaEncolada = () => outbox.encolar.mock.calls.at(-1)[0].carga;

  it('primer pedido de un celular: RECIBIDO con la línea de puntos y el enlace, en plantilla con variable', async () => {
    const r = await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(r.estado).toBe('ENCOLADO');
    expect(cargaEncolada().textoLibre).toContain('Ya sumas puntos con este número. Ve tus puntos aquí: https://carta.test/?puntos=1');
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_BIENVENIDA_PUNTOS');
    expect(cargaEncolada().variablesPlantilla).toEqual(['Lucia', 'CP-090', 'https://carta.test/?puntos=1']);
    expect(prisma.avisoClienteUnico.createMany).toHaveBeenCalledWith({ data: { telefono: '987654321', aviso: 'BIENVENIDA_PUNTOS' }, skipDuplicates: true });
  });

  it('segundo pedido del mismo celular: RECIBIDO normal, sin la línea de puntos', async () => {
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().textoLibre).not.toContain('Ya sumas puntos');
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
  });

  it('con el parámetro en «no» el RECIBIDO sale como siempre y no marca nada', async () => {
    parametrosPuntos.whatsapp_aviso_bienvenida_puntos_activo = 'no';
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    expect(prisma.avisoClienteUnico.createMany).not.toHaveBeenCalled();
  });

  describe('enlace de seguimiento en RECIBIDO', () => {
    beforeEach(() => {
      parametrosPuntos.whatsapp_aviso_bienvenida_puntos_activo = 'no';
    });

    it('efectivo con ventana abierta: el texto libre trae el enlace con código y token firmado', async () => {
      await servicio.avisar(90, 'RECIBIDO', {}, undefined);
      const token = generarTokenSeguimiento(BigInt(90));
      expect(cargaEncolada().textoLibre).toContain(`Sigue tu pedido aquí: https://carta.test/?seguimiento=CP-090&t=${token}`);
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    });

    it('efectivo fuera de la ventana: la plantilla nueva solo con el parámetro en «Sí»', async () => {
      parametrosPuntos.whatsapp_plantilla_recibido_seguimiento_activa = 'si';
      await servicio.avisar(90, 'RECIBIDO', {}, undefined);
      const token = generarTokenSeguimiento(BigInt(90));
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_SEGUIMIENTO');
      expect(cargaEncolada().variablesPlantilla).toEqual(['Lucia', 'CP-090', `https://carta.test/?seguimiento=CP-090&t=${token}`]);
    });

    it('sin origen público configurado: sin enlace y con la plantilla vigente aunque el parámetro esté en «Sí»', async () => {
      delete process.env.CARTA_URL_PUBLICA;
      parametrosPuntos.whatsapp_plantilla_recibido_seguimiento_activa = 'si';
      await servicio.avisar(90, 'RECIBIDO', {}, undefined);
      expect(cargaEncolada().textoLibre).not.toContain('Sigue tu pedido');
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    });

    it('pago digital: el texto libre trae el enlace y la plantilla de voucher no cambia', async () => {
      prisma.pedido.findUnique = jest.fn(async () => ({
        id: BigInt(92), codigo: 'CP-092', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
        pago_metodo: 'YAPE', pago_preferido: 'YAPE', canal: 'CARTA', party_id: null, cliente_party_id: null, puntos_ganados: 0,
      }));
      parametrosPuntos.whatsapp_plantilla_recibido_seguimiento_activa = 'si';
      await servicio.avisar(92, 'RECIBIDO', {}, undefined);
      expect(cargaEncolada().textoLibre).toContain('Sigue tu pedido aquí: https://carta.test/?seguimiento=CP-092&t=');
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_DIGITAL');
    });
  });

  it('pago dividido Yape 38 + efectivo 2: el aviso pide yapear S/ 38.00 (no 40) y anota los S/ 2.00 al recibir', async () => {
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(93), codigo: 'CP-093', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 40, lineas: [{ nombre: 'Dona', cantidad: 2 }], envio: 5, entrega_lat: -12.1, entrega_lng: -77, zona_id: 3,
      pago_metodo: 'YAPE', pago_preferido: 'YAPE', canal: 'CARTA', party_id: null, cliente_party_id: null, puntos_ganados: 0,
    }));
    prisma.parametro.findMany = jest.fn(async () => [{ clave: 'voucher_yape_numero', valor: '977503006' }]);
    prisma.pedidoPagoPlan = { findMany: jest.fn(async () => [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }]) };
    await servicio.avisar(93, 'RECIBIDO', {}, undefined);
    const texto = cargaEncolada().textoLibre as string;
    expect(texto).toContain('Monto: S/ 38.00');
    expect(texto).not.toContain('Monto: S/ 40.00');
    expect(texto).toContain('S/ 2.00 restantes');
  });

  describe('plantillas de delivery con ubicación en RECIBIDO', () => {
    const pedidoSinUbicar = (pago: 'EFECTIVO' | 'YAPE', extra: Record<string, unknown> = {}) => {
      prisma.pedido.findUnique = jest.fn(async () => ({
        id: BigInt(95), codigo: 'CP-095', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
        pago_metodo: pago, pago_preferido: pago, canal: 'CARTA', party_id: null, cliente_party_id: null, puntos_ganados: 0,
        envio: null, entrega_lat: null, entrega_lng: null, zona_id: null,
        lineas: [{ nombre: 'Dona', cantidad: 2 }], ...extra,
      }));
    };

    beforeEach(() => {
      parametrosPuntos.whatsapp_aviso_bienvenida_puntos_activo = 'no';
      parametrosPuntos.whatsapp_plantilla_delivery_ubicacion_activa = 'si';
    });

    it('efectivo, sin ubicación e interruptor en «Sí»: plantilla de ubicación con respaldo a la vigente', async () => {
      pedidoSinUbicar('EFECTIVO');
      await servicio.avisar(95, 'RECIBIDO', {}, undefined);
      const c = cargaEncolada();
      expect(c.plantillaClave).toBe('CARTA_DELIVERY_UBICACION_EFECTIVO');
      expect(c.variablesPlantilla).toEqual(['Ana', 'CP-095']);
      expect(c.plantillaRespaldo).toEqual({ plantillaClave: 'CARTA_RECIBIDO_EFECTIVO', variablesPlantilla: ['Ana', 'CP-095'] });
      // Con ventana abierta sale este texto libre, que ya pide la ubicación
      expect(c.textoLibre).toContain('Envíanos tu ubicación');
    });

    it('pago digital, sin ubicación: plantilla digital con el medio y respaldo a la digital vigente', async () => {
      pedidoSinUbicar('YAPE');
      await servicio.avisar(95, 'RECIBIDO', {}, undefined);
      const c = cargaEncolada();
      expect(c.plantillaClave).toBe('CARTA_DELIVERY_UBICACION_DIGITAL');
      expect(c.variablesPlantilla).toEqual(['Ana', 'CP-095', 'Yape']);
      expect(c.plantillaRespaldo.plantillaClave).toBe('CARTA_RECIBIDO_DIGITAL');
    });

    it('interruptor en «No»: plantilla vigente y sin respaldo', async () => {
      parametrosPuntos.whatsapp_plantilla_delivery_ubicacion_activa = 'no';
      pedidoSinUbicar('EFECTIVO');
      await servicio.avisar(95, 'RECIBIDO', {}, undefined);
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
      expect(cargaEncolada().plantillaRespaldo).toBeUndefined();
    });

    it('con ubicación ya registrada: no usa la plantilla de ubicación', async () => {
      pedidoSinUbicar('EFECTIVO', { entrega_lat: -12.1, entrega_lng: -77, zona_id: 3, envio: 5 });
      await servicio.avisar(95, 'RECIBIDO', {}, undefined);
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    });

    it('recojo: no usa la plantilla de ubicación', async () => {
      pedidoSinUbicar('EFECTIVO', { modalidad: 'RECOJO' });
      await servicio.avisar(95, 'RECIBIDO', {}, undefined);
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    });
  });

  describe('resumen completo de «Recibimos tu pedido»', () => {
    const completo = (extra: Record<string, unknown> = {}) => ({
      id: BigInt(99), codigo: 'CP-W099', cliente_nombre: 'Alejandro', cliente_telefono: '987654321', modalidad: 'RECOJO', canal: 'CARTA',
      party_id: null, cliente_party_id: null, puntos_ganados: 0, total: 28, subtotal: 30, descuento: 2, descuento_detalle: [{ nombre: '2x1 Frappés' }], propina: 0,
      envio: null, entrega_lat: null, entrega_lng: null, zona_id: null, mesa_nombre: null, entrega_direccion: null, entrega_referencia: null,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', paga_con: 50, pago_estado: 'PENDIENTE', planPago: [],
      comprobante_tipo: 'BOLETA', comprobante_doc: null, comprobante_razon: null, eta_min: null, eta_max: null,
      lineas: [
        { id: BigInt(1), linea_combo_id: null, nombre: 'COMBO DÚO', cantidad: 1, tamano: 'Grande', sabor: null, nota: 'sin azúcar', opciones: [], opcionesElegidas: [{ opcion_nombre: 'Leche de almendra' }], sabores: [] },
        { id: BigInt(2), linea_combo_id: BigInt(1), nombre: 'Frappé', cantidad: 1, tamano: null, sabor: 'Caramelo', nota: null, opciones: [], opcionesElegidas: [], sabores: [] },
        { id: BigInt(3), linea_combo_id: null, nombre: 'Dona', cantidad: 2, tamano: null, sabor: null, nota: null, opciones: [], opcionesElegidas: [], sabores: [] },
      ],
      ...extra,
    });

    beforeEach(() => {
      parametrosPuntos.whatsapp_aviso_bienvenida_puntos_activo = 'no';
      prisma.parametro.findMany = jest.fn(async () => [
        { clave: 'local_datos', valor: { direccion: 'Av. Los Cedros 456' } },
        { clave: 'tiempo_prometido_min', valor: 25 },
      ]);
    });

    it('recoger con efectivo: una sola lectura del pedido para el resumen y todos los datos', async () => {
      prisma.pedido.findUnique = jest.fn(async () => completo());
      await servicio.avisar(99, 'RECIBIDO', {}, undefined);
      const t = cargaEncolada().textoLibre as string;
      expect(t).toContain('Recibimos tu pedido *CP-W099*');
      expect(t).toContain('🏪 Recoger en el local\n📍 Recoges en: Av. Los Cedros 456');
      expect(t).toContain('• 1 x COMBO DÚO (Grande, Leche de almendra)\n   📝 sin azúcar\n   ◦ 1 x Frappé (Caramelo)\n• 2 x Dona');
      expect(t).toContain('Descuento (2x1 Frappés): -S/ 2.00');
      expect(t).toContain('Pagas con S/ 50.00 · vuelto S/ 22.00');
      expect(t).toContain('🧾 Comprobante: Boleta');
      expect(t).toContain('⏱️ Tiempo estimado: 25 minutos');
      expect(t).not.toMatch(/undefined|null|\n{3,}/);
      // Pedido (resumen) + cabecera del aviso: sin consultas por línea
      expect(prisma.pedido.findUnique).toHaveBeenCalledTimes(2);
      expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
      expect(cargaEncolada().variablesPlantilla).toEqual(['Alejandro', 'CP-W099']);
    });

    it('sin la dirección del local, recoger no inventa una', async () => {
      prisma.parametro.findMany = jest.fn(async () => []);
      prisma.pedido.findUnique = jest.fn(async () => completo());
      await servicio.avisar(99, 'RECIBIDO', {}, undefined);
      const t = cargaEncolada().textoLibre as string;
      expect(t).not.toContain('Recoges en');
      expect(t).not.toContain('Tiempo estimado');
    });
  });

  it('pedido sin cliente con cuenta o de invitado: sin línea de puntos', async () => {
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(91), codigo: 'CP-091', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: null, cliente_party_id: null, puntos_ganados: 0,
    }));
    await servicio.avisar(91, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().textoLibre).not.toContain('Ya sumas puntos');
  });

  it('ENTREGADO de un pedido que sumó puntos: agrega «Ganaste N puntos. Total: M» con plantilla de puntos', async () => {
    await servicio.avisar(90, 'ENTREGADO');
    expect(cargaEncolada().textoLibre).toContain('Ganaste 12.5 puntos. Total: 40.');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO_PUNTOS');
    expect(cargaEncolada().variablesPlantilla).toEqual(['Lucia', 'CP-090', '12.5', '40']);
  });

  it('ENTREGADO sin puntos ganados o con el parámetro apagado: aviso normal', async () => {
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(92), codigo: 'CP-092', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: BigInt(500), cliente_party_id: BigInt(500), puntos_ganados: 0,
    }));
    await servicio.avisar(92, 'ENTREGADO');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO');
    parametrosPuntos.whatsapp_aviso_puntos_ganados_activo = 'no';
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(93), codigo: 'CP-093', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: BigInt(500), cliente_party_id: BigInt(500), puntos_ganados: 5,
    }));
    await servicio.avisar(93, 'ENTREGADO');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO');
  });
});

describe('AvisosPedidoService: ciclo de avisos del delivery (asignado, salió, llegó, entregado)', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let parametros: Record<string, unknown>;
  let yaEnviadas: Set<number>;

  const textoEncolado = (i = 0) => outbox.encolar.mock.calls[i][0].carga.textoLibre as string;

  beforeEach(() => {
    parametros = {};
    yaEnviadas = new Set();
    const pedido = {
      id: BigInt(88), codigo: 'CP-088', cliente_nombre: 'Marta', cliente_telefono: '987654321', modalidad: 'DELIVERY',
      total: 30, pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'WEB', repartidor_party_id: BigInt(5),
      puntos_ganados: 0, party_id: null, cliente_party_id: null,
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Luis Alberto' }) },
      // Sin fila del parámetro (undefined) = nunca configurado
      parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave in parametros ? { valor: parametros[where.clave] } : null)) },
      mensajeReparto: {
        findUnique: jest.fn(async ({ where }: any) => (yaEnviadas.has(where.pedido_id_numero.numero) ? { numero: 1 } : null)),
        create: jest.fn(async ({ data }: any) => { yaEnviadas.add(data.numero); return {}; }),
      },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  it('los cuatro avisos del ciclo se encolan cuando están encendidos, con su plantilla para ventana cerrada', async () => {
    parametros = {
      whatsapp_aviso_asignado_activo: 'si', whatsapp_aviso_salida_activo: 'si',
      whatsapp_aviso_llegada_activo: 'si', whatsapp_aviso_entregado_activo: 'si',
    };
    for (const etapa of ['ASIGNADO', 'SALIDA', 'LLEGADA', 'ENTREGADO'] as const) {
      expect((await servicio.avisar(88, etapa)).estado).toBe('ENCOLADO');
    }
    const plantillas = outbox.encolar.mock.calls.map((c: any) => c[0].carga.plantillaClave);
    expect(plantillas).toEqual(['DELIVERY_ASIGNADO', 'DELIVERY_SALIDA', 'DELIVERY_LLEGADA', 'DELIVERY_ENTREGADO']);
    expect(textoEncolado(0)).toContain('Luis');
    expect(textoEncolado(0)).not.toContain('Alberto');
  });

  it('regresión: con el aviso de salida apagado (como dejó la migración de 02/11) el «salió» no se mandaba y el «llegó» sí', async () => {
    parametros = { whatsapp_aviso_salida_activo: 'no', whatsapp_aviso_llegada_activo: 'si' };
    expect(await servicio.avisar(88, 'SALIDA')).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect((await servicio.avisar(88, 'LLEGADA')).estado).toBe('ENCOLADO');
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });

  it('ASIGNADO viene encendido por defecto si el parámetro no existe, y se apaga con «no»', async () => {
    expect((await servicio.avisar(88, 'ASIGNADO')).estado).toBe('ENCOLADO');
    yaEnviadas.clear();
    parametros.whatsapp_aviso_asignado_activo = 'no';
    expect(await servicio.avisar(88, 'ASIGNADO')).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });

  it('idempotente por pedido y evento: el repartidor toca dos veces y el cliente recibe un solo aviso', async () => {
    parametros.whatsapp_aviso_salida_activo = 'si';
    expect((await servicio.avisar(88, 'SALIDA')).estado).toBe('ENCOLADO');
    expect((await servicio.avisar(88, 'SALIDA')).estado).toBe('YA_ENVIADO');
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });

  it('ASIGNADO sin repartidor en el pedido se omite con motivo', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ ...(await prisma.pedido.findUnique()), repartidor_party_id: null });
    expect(await servicio.avisar(88, 'ASIGNADO')).toEqual({ estado: 'OMITIDO', motivo: 'SIN_REPARTIDOR' });
  });

  it('nuevo intento tras un retiro: la clave del outbox ya existía y el aviso no se pierde (sale con otra clave)', async () => {
    parametros.whatsapp_aviso_salida_activo = 'si';
    outbox.encolar.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await servicio.avisar(88, 'SALIDA')).estado).toBe('ENCOLADO');
    expect(outbox.encolar).toHaveBeenCalledTimes(2);
    expect(outbox.encolar.mock.calls[1][0].clave).toMatch(/^pedido-88-SALIDA-\d+$/);
  });

  it('fallo al encolar: queda registrado como FALLIDO con motivo y no lanza (no frena el reparto)', async () => {
    parametros.whatsapp_aviso_salida_activo = 'si';
    outbox.encolar.mockRejectedValue(new Error('db caída'));
    const res = await servicio.avisar(88, 'SALIDA');
    expect(res).toEqual({ estado: 'FALLIDO', motivo: 'db caída' });
  });

  it('un aviso omitido deja registro estructurado para soporte, sin teléfono ni nombre', async () => {
    const aviso = jest.spyOn((servicio as any).logger, 'warn').mockImplementation(() => undefined);
    parametros.whatsapp_aviso_salida_activo = 'no';
    await servicio.avisar(88, 'SALIDA');
    const registro = aviso.mock.calls.map((c: any) => String(c[0])).find((t: string) => t.includes('aviso_pedido_omitido')) ?? '';
    expect(registro).toContain('aviso_pedido_omitido');
    expect(registro).toContain('DESACTIVADO');
    expect(registro).not.toMatch(/987654321|Marta/);
  });
});
