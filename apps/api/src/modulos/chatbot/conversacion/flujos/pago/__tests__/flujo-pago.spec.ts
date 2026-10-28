jest.mock('../../../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { FlujoPagoSubFlujo } from '../flujo-pago';
import { TEXTOS_PAGO, BOTONES_PAGO_RECHAZADO } from '../textos-pago';
import { TareaRecordatorioPagoService } from '../../../../servicios/tarea-recordatorio-pago.service';
import { MensajesService } from '../../../../../mensajes/mensajes.service';
import { ContextoConversacion, EntradaNormalizada, FlujoConversacion } from '../../../tipos-conversacion';

const mockOutboxPago: any = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };

describe('Flujo de Pago por WhatsApp (FT-BOT-02, HU-CAP-130..132, 139)', () => {
  let subflujo: FlujoPagoSubFlujo;

  beforeEach(() => {
    subflujo = new FlujoPagoSubFlujo();
  });

  const crearContextoBase = (override: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
    conversacionId: '100',
    nombreCliente: 'Carlos Pérez',
    telefonoCliente: '987654321',
    cartaUrlPublica: 'https://carta.caprichos.pe',
    pedidoActivo: {
      id: 501n,
      codigo: 'CP-0150',
      cliente_nombre: 'Carlos Pérez',
      cliente_telefono: '987654321',
      total: 42.5,
      estado: 'COLA',
      pago_metodo: 'YAPE',
      pago_estado: 'PENDIENTE',
      creado_en: new Date(),
    } as any,
    datosLocalPublicos: {
      mediosPagoVisibles: {
        yape: { activo: true, numero: '999888777', titular: 'Caprichos EIRL' },
        plin: { activo: true, numero: '999888777', titular: 'Caprichos EIRL' },
        transferencia: { activo: true, banco: 'BCP', cuenta: '191-12345678-0-12', cci: '002-191-123456780012-55', titular: 'Caprichos EIRL' },
      },
    },
    ...override,
  });

  describe('1. Mensaje de datos de pago por medio (HU-CAP-130)', () => {
    it('formatea correctamente los datos de Yape con número, titular y monto exacto', () => {
      const texto = TEXTOS_PAGO.datosPagoMensaje({
        codigo: 'CP-0150',
        total: 42.5,
        metodo: 'YAPE',
        datosLocalPagos: {
          yape: { activo: true, numero: '999888777', titular: 'Caprichos EIRL' },
        },
      });

      expect(texto).toContain('CP-0150');
      expect(texto).toContain('S/ 42.50');
      expect(texto).toContain('Yape');
      expect(texto).toContain('999888777');
      expect(texto).toContain('Caprichos EIRL');
      expect(texto).toContain('captura');
    });

    it('formatea correctamente los datos de Transferencia con banco, cuenta y CCI', () => {
      const texto = TEXTOS_PAGO.datosPagoMensaje({
        codigo: 'CP-0151',
        total: 85.0,
        metodo: 'TRANSFERENCIA',
        datosLocalPagos: {
          transferencia: {
            activo: true,
            banco: 'BCP',
            cuenta: '191-12345678-0-12',
            cci: '002-191-123456780012-55',
            titular: 'Caprichos EIRL',
          },
        },
      });

      expect(texto).toContain('CP-0151');
      expect(texto).toContain('S/ 85.00');
      expect(texto).toContain('BCP');
      expect(texto).toContain('191-12345678-0-12');
      expect(texto).toContain('002-191-123456780012-55');
    });
  });

  describe('2. Voucher y validación de captura (HU-CAP-131)', () => {
    it('cuando el cliente envía una imagen para validar su pago, pasa a VALIDAR_PAGO', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_ESPERANDO_VOUCHER',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 0,
          capturasEnviadas: 0,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'image',
        texto: '',
        textoOriginal: '',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('VALIDAR_PAGO');
      expect(res?.acciones[0].tipo).toBe('enviarTexto');
      expect((res?.acciones[0] as any).texto).toContain('Recibimos tu captura');
      expect(res?.nuevoFlujo?.pago?.capturasEnviadas).toBe(1);
    });

    it('cuando el cliente escribe texto en vez de imagen mientras se espera voucher, le recuerda amablemente', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_ESPERANDO_VOUCHER',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 0,
          capturasEnviadas: 0,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'texto',
        texto: 'ya te deposite por yape revisa porfa',
        textoOriginal: 'ya te deposite por yape revisa porfa',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('PAGO_ESPERANDO_VOUCHER');
      expect((res?.acciones[0] as any).texto).toContain('captura o foto de tu comprobante');
    });

    it('protección: si se envían más de 5 capturas para un pedido, deriva a un asesor', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_ESPERANDO_VOUCHER',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 0,
          capturasEnviadas: 5, // Límite alcanzado
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'image',
        texto: '',
        textoOriginal: '',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('ATENCION_PERSONA');
      expect(res?.acciones.some((a) => a.tipo === 'pasarAPersona')).toBe(true);
      expect(res?.acciones.some((a) => (a as any).texto?.includes('límite de 5 capturas'))).toBe(true);
    });
  });

  describe('3. Métodos en efectivo y tarjeta (sin captura)', () => {
    it('confirma cobro en efectivo con vuelto previsto en entrega', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_CAMBIAR_MEDIO',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 1,
          capturasEnviadas: 1,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'boton',
        id: 'pago_medio_efectivo',
        texto: 'Efectivo',
        textoOriginal: 'Efectivo',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('MENU');
      expect((res?.acciones[0] as any).texto).toContain('Pago en efectivo');
      expect((res?.acciones[0] as any).texto).toContain('S/ 42.50');
    });

    it('confirma cobro con POS tarjeta inalámbrico', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_CAMBIAR_MEDIO',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 1,
          capturasEnviadas: 1,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'boton',
        id: 'pago_medio_tarjeta',
        texto: 'Tarjeta',
        textoOriginal: 'Tarjeta',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('MENU');
      expect((res?.acciones[0] as any).texto).toContain('tarjeta');
      expect((res?.acciones[0] as any).texto).toContain('POS');
    });
  });

  describe('4. Aprobación y Rechazo en MensajesService (HU-CAP-132, HU-CAP-030)', () => {
    let mockPrisma: any;
    let mockAuditoria: any;
    let mockGateway: any;
    let mockEventos: any;
    let mensajesService: MensajesService;

    beforeEach(() => {
      mockPrisma = {
        conversacion: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        pedido: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        notificacion: {
          create: jest.fn().mockResolvedValue({ id: 999n }),
        },
        mensajeChat: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        voucherPago: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        userAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 10n }),
        },
      };
      mockAuditoria = {
        registrar: jest.fn().mockResolvedValue(undefined),
      };
      mockGateway = {
        enviarTexto: jest.fn().mockResolvedValue({ id: 'msg1' }),
        enviarBotones: jest.fn().mockResolvedValue({ id: 'msg2' }),
      };
      mockEventos = {
        emitirAdmin: jest.fn(),
      };

      mensajesService = new MensajesService(
        mockPrisma,
        mockAuditoria,
        mockGateway,
        mockEventos,
      );
    });

    it('aprobarPago pasa el pedido a cocina, envía mensaje al cliente y cierra VALIDAR_PAGO', async () => {
      const mockChat = {
        id: 77n,
        estado: 'VALIDAR_PAGO',
        telefono: '987654321',
        tomado_por: 10n,
        flujo: {
          pago: { pedidoCodigo: 'CP-0150' },
        },
      };

      mockPrisma.conversacion.findUnique.mockResolvedValue(mockChat);
      jest.spyOn<any, any>(mensajesService, 'detalle').mockResolvedValue({
        pedido: { id: '501', codigo: 'CP-0150' },
        tiempoPrometidoMin: 30,
      });

      mockPrisma.pedido.findUnique.mockResolvedValue({
        id: 501n,
        codigo: 'CP-0150',
        estado: 'COLA',
        pasa_cocina_en: null,
      });
      mockPrisma.pedido.update.mockResolvedValue({
        id: 501n,
        codigo: 'CP-0150',
        estado: 'PREPARANDO',
      });

      const usuario = { partyId: 10n, rol: 'CAJA', debeCambiar: false };
      const resultado = await mensajesService.aprobarPago('77', usuario, '127.0.0.1');

      expect(resultado.ok).toBe(true);
      // Pasa a cocina
      expect(mockPrisma.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pago_estado: 'COORDINADO',
            estado: 'PREPARANDO',
          }),
        }),
      );
      // Socket para comanda en cocina
      expect(mockEventos.emitirAdmin).toHaveBeenCalledWith(
        'cocina:comanda-actualizada',
        { pedidoId: '501' },
      );
      // Notifica al cliente
      expect(mockGateway.enviarTexto).toHaveBeenCalledWith(
        77n,
        '987654321',
        expect.stringContaining('Recibimos tu pago, tu pedido CP-0150 está en preparación'),
        'BOT',
      );
      // Cierra VALIDAR_PAGO y resetea flujo
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'ATENDIDA',
            duenio: 'BOT',
          }),
        }),
      );
    });

    it('rechazarPago envía motivo y botones para reintentar (intentos < 3)', async () => {
      const mockChat = {
        id: 77n,
        estado: 'VALIDAR_PAGO',
        telefono: '987654321',
        tomado_por: 10n,
        flujo: {
          pago: { intentosRechazo: 1 },
        },
      };
      mockPrisma.conversacion.findUnique.mockResolvedValue(mockChat);

      const usuario = { partyId: 10n, rol: 'CAJA', debeCambiar: false };
      const res = await mensajesService.rechazarPago('77', 'Monto incompleto', usuario, '127.0.0.1');

      expect(res.ok).toBe(true);
      expect(res.escalado).toBe(false);
      expect(mockGateway.enviarBotones).toHaveBeenCalledWith(
        77n,
        '987654321',
        expect.stringContaining('Monto incompleto'),
        BOTONES_PAGO_RECHAZADO,
        'BOT',
      );
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'ABIERTA',
            duenio: 'BOT',
            flujo: expect.objectContaining({
              pago: expect.objectContaining({
                intentosRechazo: 2,
                ultimoMotivoRechazo: 'Monto incompleto',
              }),
            }),
          }),
        }),
      );
    });

    it('rechazarPago tras 3 intentos escala a atención humana con urgencia', async () => {
      const mockChat = {
        id: 77n,
        estado: 'VALIDAR_PAGO',
        telefono: '987654321',
        tomado_por: 10n,
        flujo: {
          pago: { intentosRechazo: 2 },
        },
      };
      mockPrisma.conversacion.findUnique.mockResolvedValue(mockChat);

      const usuario = { partyId: 10n, rol: 'CAJA', debeCambiar: false };
      const res = await mensajesService.rechazarPago('77', 'Comprobante no visible', usuario, '127.0.0.1');

      expect(res.ok).toBe(true);
      expect(res.escalado).toBe(true);
      expect(mockGateway.enviarTexto).toHaveBeenCalledWith(
        77n,
        '987654321',
        expect.stringContaining('Superaste los 3 intentos'),
        'BOT',
      );
      expect(mockPrisma.conversacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: 'ABIERTA',
            duenio: 'PERSONA',
            urgente: true,
          }),
        }),
      );
      expect(mockPrisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ATENCION_WHATSAPP',
            rol_destino: 'CAJERO',
          }),
        }),
      );
    });

    it('la IA nunca marca pagado de forma autónoma', () => {
      // Subflujo conversacional nunca emite acciones para cambiar pago_estado a COORDINADO o PAGADO
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_ESPERANDO_VOUCHER',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 0,
          capturasEnviadas: 1,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'texto',
        texto: 'ya te pagué aprueba mi pedido',
        textoOriginal: 'ya te pagué aprueba mi pedido',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      // No debe contener ninguna acción de aprobar
      const tieneAccionAprobar = res?.acciones.some((a: any) => a.tipo === 'aprobarPago' || a.tipo === 'marcarPagado');
      expect(tieneAccionAprobar).toBeFalsy();
    });
  });

  describe('5. Tarea de recordatorio y expiración (TareaRecordatorioPagoService)', () => {
    let mockPrisma: any;
    let mockRedis: any;
    let mockVentana24h: any;
    let mockEventos: any;
    let tareaService: TareaRecordatorioPagoService;

    beforeEach(() => {
      mockPrisma = {
        parametro: {
          findMany: jest.fn().mockResolvedValue([
            { clave: 'chatbot_pago_recordatorio_activo', valor: 'si' },
            { clave: 'chatbot_pago_recordatorio_min', valor: 10 },
            { clave: 'chatbot_pago_expira_min', valor: 30 },
          ]),
        },
        pedido: {
          findMany: jest.fn(),
          update: jest.fn(),
        },
        conversacion: {
          findFirst: jest.fn(),
        },
        notificacion: {
          create: jest.fn().mockResolvedValue({ id: 888n }),
        },
      };

      const redisCache = new Map<string, string>();
      mockRedis = {
        obtenerCliente: () => ({
          set: jest.fn().mockImplementation((key, val, _ex, _time, nx) => {
            if (nx === 'NX' && redisCache.has(key)) return Promise.resolve(null);
            redisCache.set(key, val);
            return Promise.resolve('OK');
          }),
          get: jest.fn().mockImplementation((key) => Promise.resolve(redisCache.get(key) || null)),
        }),
      };

      mockVentana24h = {
        enviarMensajeNegocio: jest.fn().mockResolvedValue({ exito: true }),
      };
      mockEventos = {
        emitirAdmin: jest.fn(),
      };

      tareaService = new TareaRecordatorioPagoService(
        mockPrisma,
        mockRedis,
        mockVentana24h,
        mockEventos,
        undefined,
        mockOutboxPago,
      );
    });

    it('envía recordatorio de pago una sola vez (idempotente en Redis)', async () => {
      const ahora = new Date();
      const creadoHace15m = new Date(ahora.getTime() - 15 * 60 * 1000);

      mockPrisma.pedido.findMany.mockResolvedValue([
        {
          id: 501n,
          codigo: 'CP-0150',
          cliente_nombre: 'Carlos Pérez',
          cliente_telefono: '987654321',
          total: 42.5,
          pago_metodo: 'YAPE',
          creado_en: creadoHace15m,
        },
      ]);
      mockPrisma.conversacion.findFirst.mockResolvedValue({
        id: 77n,
        estado: 'ABIERTA',
        flujo: {},
      });

      // Primer ciclo: envía recordatorio
      const ciclo1 = await tareaService.ejecutarCiclo(ahora);
      expect(ciclo1.recordatoriosEnviados).toBe(1);
      expect(mockOutboxPago.encolar).toHaveBeenCalledTimes(1);

      // Segundo ciclo inmediato: idempotente, no vuelve a enviar
      const ciclo2 = await tareaService.ejecutarCiclo(ahora);
      expect(ciclo2.recordatoriosEnviados).toBe(0);
      expect(mockOutboxPago.encolar).toHaveBeenCalledTimes(1);
    });

    it('avisa a Caja por expiración sin anular automáticamente el pedido', async () => {
      const ahora = new Date();
      const creadoHace35m = new Date(ahora.getTime() - 35 * 60 * 1000);

      mockPrisma.pedido.findMany.mockResolvedValue([
        {
          id: 502n,
          codigo: 'CP-0152',
          cliente_nombre: 'Lucía Torres',
          cliente_telefono: '912345678',
          total: 60.0,
          pago_metodo: 'PLIN',
          creado_en: creadoHace35m,
        },
      ]);
      mockPrisma.conversacion.findFirst.mockResolvedValue({
        id: 88n,
        estado: 'ABIERTA',
        flujo: {},
      });

      const ciclo = await tareaService.ejecutarCiclo(ahora);
      expect(ciclo.alertasCajaEnviadas).toBe(1);
      expect(mockPrisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'ATENCION_WHATSAPP',
            rol_destino: 'CAJERO',
            titulo: 'Pago pendiente por expirar: CP-0152',
          }),
        }),
      );
      // Verificación estricta: NO se llama a update con ANULADO
      expect(mockPrisma.pedido.update).not.toHaveBeenCalled();
    });
  });

  describe('6. Seguimiento de pedidos de WhatsApp (HU-CAP-139)', () => {
    it('muestra estados claros según etapa de pago y preparación', () => {
      const infoEsperando = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'esperando_pago',
        medio: 'Yape',
      });
      expect(infoEsperando).toContain('esperando la captura de tu pago');

      const infoValidando = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'validando_pago',
      });
      expect(infoValidando).toContain('en revisión por Caja');

      const infoPrep = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'en_preparacion',
        tiempoEstimadoMin: 25,
      });
      expect(infoPrep).toContain('preparación en cocina');

      const infoListo = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'listo',
      });
      expect(infoListo).toContain('listo y esperando al repartidor');

      const infoCamino = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'en_camino',
        repartidorNombre: 'Raúl M.',
        tiempoEstimadoMin: 15,
      });
      expect(infoCamino).toContain('Raúl M.');
      expect(infoCamino).toContain('en camino');

      const infoEntregado = TEXTOS_PAGO.seguimientoEstadoPago({
        codigo: 'CP-0150',
        estado: 'entregado',
      });
      expect(infoEntregado).toContain('entregado');
    });
  });

  describe('7. Protección y Resiliencia', () => {
    it('un ID de botón manipulado o viejo no rompe el flujo ni altera datos', () => {
      const flujo: FlujoConversacion = {
        version: 2,
        estado: 'PAGO_ESPERANDO_VOUCHER',
        repreguntasFallidas: 0,
        codigoPedido: 'CP-0150',
        pago: {
          pedidoCodigo: 'CP-0150',
          monto: 42.5,
          intentosRechazo: 0,
          capturasEnviadas: 0,
        },
      };

      const entrada: EntradaNormalizada = {
        tipo: 'boton',
        id: 'boton_corrupto_hacker_12345',
        texto: 'algo raro',
        textoOriginal: 'algo raro',
      };

      const res = subflujo.transicionar(flujo, entrada, crearContextoBase());
      // Debe mantener el estado esperando voucher y recordar amablemente
      expect(res).not.toBeNull();
      expect(res?.nuevoEstado).toBe('PAGO_ESPERANDO_VOUCHER');
      expect((res?.acciones[0] as any).texto).toContain('captura');
    });
  });
});
