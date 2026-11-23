jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { PoliticaEvolutionService } from '../evolution/politica-evolution.service';
import { AutorespuestaWhatsappService } from '../servicios/autorespuesta-whatsapp.service';
import { esConformeConResumen } from '../conversacion/cortesia-entrante.util';
import { construirResumenRecibido, LINEA_CONFIRMA_RESUMEN, textoConformeConfirmada } from '../conversacion/textos-reparto';
import { SeguimientoService } from '../../pedidos/seguimiento.service';
import { generarTokenSeguimiento } from '../../pedidos/seguimiento.tokens';

const AHORA = new Date('2026-11-23T17:00:00Z'); // 12:00 Lima, abierto
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);

/** Entrantes del teléfono hace `entrantes` días; el conteo respeta el filtro `gte` como la BD. */
function prismaConEntrantes(entrantes: number[], diasParam: unknown = 180) {
  return {
    whatsappMensaje: { count: jest.fn(async ({ where }: any) => entrantes.filter((d) => dias(d) >= where.creado_en.gte).length) },
    parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave === 'evolution_resumen_contacto_dias' ? { valor: diasParam } : null)) },
    salienteWhatsapp: { count: jest.fn(async () => 0) },
    pedido: {
      findUnique: jest.fn(async () => ({ id: 7n, estado: 'COLA', canal: 'CARTA', cliente_telefono: '987654321' })),
    },
  } as any;
}

function politica(prisma: any, diasParam = 180) {
  const cfg: any = {
    obtener: async () => ({
      whatsapp_proveedor: 'EVOLUTION',
      evolution_origenes_permitidos: '',
      evolution_exigir_contacto_previo: 'si',
      evolution_resumen_contacto_dias: diasParam,
      evolution_horario_desde: 0,
      evolution_horario_hasta: 24,
      evolution_limite_minuto: 0,
      evolution_limite_hora: 0,
      evolution_limite_dia: 0,
    }),
    estaPausado: async () => false,
    estadoConexion: async () => ({ estado: 'CONECTADO' }),
  };
  const local: any = { obtenerEstadoCartaSeguro: async () => ({ abierta: true }), obtenerEstadoCarta: async () => ({ abierta: true, motivo: 'OK' }) };
  return new PoliticaEvolutionService(prisma, cfg, local);
}
const aviso = (etapa: string) => ({ telefono_destino: '51987654321', origen: 'AVISO_PEDIDO', pedido_id: 7n, carga: { etapa } });

describe('política: el resumen sale con contacto de hasta 6 meses', () => {
  it('resumen con entrante de hace 30 días sale', async () => {
    expect((await politica(prismaConEntrantes([30])).evaluar(aviso('RECIBIDO'), AHORA)).accion).toBe('ENVIAR');
  });
  it('resumen con entrante de hace 200 días o sin entrantes se descarta', async () => {
    for (const e of [[200], []]) {
      const d: any = await politica(prismaConEntrantes(e)).evaluar(aviso('RECIBIDO'), AHORA);
      expect([d.accion, d.codigo]).toEqual(['DESCARTAR', 'FUERA_DE_VENTANA_24H']);
    }
  });
  it('«listo» con entrante de hace 30 días NO sale (sigue la regla de 24 h)', async () => {
    const d: any = await politica(prismaConEntrantes([30])).evaluar(aviso('LISTO'), AHORA);
    expect([d.accion, d.codigo]).toEqual(['DESCARTAR', 'FUERA_DE_VENTANA_24H']);
  });
  it('parámetro en 0: el resumen vuelve a pedir 24 h', async () => {
    expect((await politica(prismaConEntrantes([30]), 0).evaluar(aviso('RECIBIDO'), AHORA)).accion).toBe('DESCARTAR');
    expect((await politica(prismaConEntrantes([0.2]), 0).evaluar(aviso('RECIBIDO'), AHORA)).accion).toBe('ENVIAR');
  });
});

describe('botonWhatsapp: misma regla que la política', () => {
  const svc = (entrantes: number[], diasParam: unknown = 180) => new SeguimientoService(prismaConEntrantes(entrantes, diasParam));
  const pedirBoton = (s: SeguimientoService) => s.botonWhatsapp('CP-0007', generarTokenSeguimiento(7n));
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
  });
  afterEach(() => jest.useRealTimers());
  it('con entrante de hace 30 días el resumen sale solo: sin tarjeta', async () => {
    expect((await pedirBoton(svc([30]))).requiereBoton).toBe(false);
  });
  it('con entrante de hace 200 días o sin entrantes: tarjeta', async () => {
    expect((await pedirBoton(svc([200]))).requiereBoton).toBe(true);
    expect((await pedirBoton(svc([]))).requiereBoton).toBe(true);
  });
  it('parámetro 0: entrante de hace 30 días ya no basta', async () => {
    expect((await pedirBoton(svc([30], 0))).requiereBoton).toBe(true);
  });
});

describe('texto del resumen', () => {
  it('termina con la línea de OK / CONFORME', () => {
    const r: any = { lineas: ['1 x Dona'], total: 10, medioPago: 'efectivo', modalidad: 'LLEVAR', subtotal: 10 };
    const partes = construirResumenRecibido(r, { nombre: 'Ana', codigo: 'CP-0007', enlace: 'https://x/y' });
    expect(partes[partes.length - 1]).toBe(LINEA_CONFIRMA_RESUMEN);
    expect(LINEA_CONFIRMA_RESUMEN).toBe('Responde *OK* o *CONFORME* para confirmar que todo está bien 🙌');
  });
});

describe('esConformeConResumen', () => {
  it.each(['ok', 'OK', 'Okey', 'oki', 'Conforme 👍', 'confirmo', 'Todo bien', 'Sí, conforme', '👍 ok', 'ok!!'])('«%s» confirma', (t) => expect(esConformeConResumen(t)).toBe(true));
  it.each(['ok pero cambia la dirección', 'no', 'quiero otro pedido', '1', 'hola', ''])('«%s» no', (t) => expect(esConformeConResumen(t)).toBe(false));
});

describe('respuesta al «ok» del cliente', () => {
  function montar(opts: { pedido?: any; flujo?: string; tomado?: unknown; conteoMarca?: number } = {}) {
    const prisma: any = {
      parametro: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
      pedido: {
        findFirst: jest.fn(async () => ('pedido' in opts ? opts.pedido : { id: 7n, codigo: 'CP-0007' })),
        updateMany: jest.fn(async () => ({ count: opts.conteoMarca ?? 1 })),
        count: jest.fn(async () => 0),
      },
      salienteWhatsapp: { findFirst: jest.fn(async () => null) },
      horarioDia: { findUnique: jest.fn(async () => ({ cerrado: false, abre: '09:00' })) },
    };
    const outbox: any = { encolar: jest.fn(async () => true), despertar: jest.fn() };
    const evolution: any = { proveedor: async () => 'EVOLUTION', obtener: async () => ({ evolution_horario_desde: 0, evolution_horario_hasta: 24 }) };
    const svc = new AutorespuestaWhatsappService(prisma, outbox, {} as any, { get: () => undefined } as any, evolution);
    const hablar = (texto: string) =>
      svc.atender({
        telefono: '51987654321',
        nombre: 'Ana Pérez',
        texto,
        puedeProcesarMotor: true,
        conversacion: { id: 1n, flujo: { estado: opts.flujo ?? 'MENU' }, estado: 'ABIERTA', duenio: 'BOT', tomado_por: opts.tomado ?? null },
      });
    return { hablar, outbox, prisma };
  }

  it('«Conforme 👍» agradece, una sola vez por pedido', async () => {
    const m = montar();
    expect(await m.hablar('Conforme 👍')).toBe(true);
    expect(m.outbox.encolar).toHaveBeenCalledTimes(1);
    const arg = m.outbox.encolar.mock.calls[0][0];
    expect(arg.origen).toBe('AUTORESPUESTA');
    expect(arg.carga.textoLibre).toBe('¡Gracias, Ana Pérez! 🙌 Tu pedido CP-0007 quedó confirmado. Te avisamos cuando esté listo.');
    // segundo «ok»: el pedido ya tiene la marca (la consulta no lo devuelve) → no vuelve a agradecer
    const m2 = montar({ pedido: null });
    await m2.hablar('ok');
    expect(m2.outbox.encolar).not.toHaveBeenCalled();
    // carrera: otra transacción ya puso la marca
    const m3 = montar({ conteoMarca: 0 });
    await m3.hablar('ok');
    expect(m3.outbox.encolar).not.toHaveBeenCalled();
  });
  it('en medio de otro flujo no lo dispara', async () => {
    const m = montar({ flujo: 'PAGO_MEDIO' });
    await m.hablar('ok');
    expect(m.prisma.pedido.updateMany).not.toHaveBeenCalled();
  });
  it('con el chat tomado por una persona no responde', async () => {
    const m = montar({ tomado: { id: 3 } });
    await m.hablar('ok');
    expect(m.outbox.encolar).not.toHaveBeenCalled();
  });
  it('sin nombre queda sin «, nombre»', () => {
    expect(textoConformeConfirmada('', 'CP-1')).toBe('¡Gracias! 🙌 Tu pedido CP-1 quedó confirmado. Te avisamos cuando esté listo.');
  });
});
