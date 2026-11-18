import { comandosDeTrabajo } from '@caprichos/compartido';
import { ImpresionService } from './impresion.service';
import { EquipoConfigService } from './equipo-config.service';
import { aplicarCambio, configAFila, filaAConfig } from './equipo-config';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';
import { sanearCapacidades, fechaTextoLima } from './diseno-servidor';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const CAP = { comandosServidor: true, ticketColumnas: 32, etiqueta: { orientacion: 'horizontal', gapMm: 2 } };
const ticket = {
  local: { nombre: 'Caprichos' }, codigo: 'CP-1', fecha: '16/11/2026', hora: '10:15', who: 'Ana', modalidad: 'MESA',
  lineas: [{ cantidad: 1, nombre: 'Cafe', subtotal: 8 }], total: 8, pagos: [{ medio: 'EFECTIVO', monto: 8 }], comprobante: null,
};
const bebida = { codigo: 'A', hora: '10:00', persona: 'Ana', bebidaNombre: 'Latte', opciones: [], who: 'x', bebidaIndex: 1, totalBebidas: 1 };

const fila = (tamanos: any = {}) => ({
  device_key_id: 10n, configurado: true, pausado: false, ticketera: true, etiquetera: true, ticket_pago: true, comanda_salon: false,
  comanda_areas: [], sticker_general: true, sticker_areas: [], sticker_bebida_areas: [], tamanos,
});
function montar(tamanos: any) {
  const trabajos = [
    { id: 1n, tipo: 'TICKET_PAGO', payload: ticket, copia: false, intentos: 0 },
    { id: 2n, tipo: 'ETIQUETA_BEBIDA', payload: bebida, copia: false, intentos: 0 },
    { id: 3n, tipo: 'TICKET_PAGO', payload: { roto: true }, copia: false, intentos: 0 }, // no se puede armar
  ];
  const prisma: any = {
    printJob: { updateMany: jest.fn().mockResolvedValue({ count: 3 }), findMany: jest.fn().mockResolvedValue(trabajos) },
    parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    equipoImpresionConfig: { findUnique: jest.fn().mockResolvedValue(fila(tamanos)) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }, { id: 2n }, { id: 3n }]),
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  return new ImpresionService(prisma);
}

describe('diseño desde el servidor: el servidor manda comandos solo si la PC lo enciende y el programa los entiende', () => {
  it('APAGADO (de fábrica): un programa nuevo que declara la capacidad recibe EXACTAMENTE lo mismo que uno viejo, sin comandos', async () => {
    const viejo = await montar({}).tomarTrabajos(10, 10n);
    const nuevo = await montar({}).tomarTrabajos(10, 10n, undefined, null, false, CAP);
    expect(nuevo).toEqual(viejo);
    for (const t of nuevo.trabajos) expect(Object.keys(t).sort()).toEqual(['copia', 'id', 'intentos', 'payload', 'tipo']);
  });

  it('ENCENDIDO pero el programa es viejo (no declara capacidad): el payload y la respuesta son los de siempre', async () => {
    const apagado = await montar({}).tomarTrabajos(10, 10n);
    for (const capacidades of [undefined, {}, { comandosServidor: false }, 'x', { ticketColumnas: 32 }]) {
      const r = await montar({ disenoServidor: true }).tomarTrabajos(10, 10n, undefined, null, false, capacidades);
      expect(r).toEqual(apagado);
    }
  });

  it('ENCENDIDO y programa capaz: cada trabajo trae comandos iguales a los del generador compartido; el payload no cambia', async () => {
    const apagado = await montar({}).tomarTrabajos(10, 10n);
    const r = await montar({ disenoServidor: true }).tomarTrabajos(10, 10n, undefined, null, false, CAP);
    // payload idéntico al de siempre en todos los trabajos
    expect(r.trabajos.map((t) => t.payload)).toEqual(apagado.trabajos.map((t) => t.payload));
    expect(r.trabajos.map((t) => t.id)).toEqual(apagado.trabajos.map((t) => t.id));
    const por = (id: string) => r.trabajos.find((t) => t.id === id)!;
    const t1 = por('1');
    expect(t1.comandos).toEqual(comandosDeTrabajo('TICKET_PAGO', ticket, false, { ticketColumnas: 32 }));
    expect(t1.comandos?.formato).toBe('ESCPOS');
    const t2 = por('2');
    expect(t2.comandos?.formato).toBe('TSPL');
    expect(t2.comandos).toEqual(comandosDeTrabajo('ETIQUETA_BEBIDA', t2.payload, false, { etiqueta: CAP.etiqueta as any }));
    // un payload que no se puede armar sale sin comandos: el programa usa su respaldo, la entrega no se frena
    expect(por('3').comandos).toBeUndefined();
  });

  it('las capacidades se sanean: solo campos conocidos y del tipo esperado', () => {
    expect(sanearCapacidades(null)).toBeNull();
    expect(sanearCapacidades({ comandosServidor: 'true' })).toBeNull();
    expect(sanearCapacidades({ comandosServidor: true, ticketColumnas: '32', etiqueta: { orientacion: 'rara', giro: 45, anchoMm: 'x', gapMm: 2, otro: 1 } })).toEqual({
      comandosServidor: true,
      etiqueta: { gapMm: 2 },
    });
  });

  it('la fecha de las hojas de prueba sale en hora de Lima', () => {
    expect(fechaTextoLima(new Date('2026-11-16T15:30:00Z'))).toBe('16/11/2026 10:30');
  });
});

describe('el interruptor por PC', () => {
  it('apagado por defecto: una PC nueva y una fila sin la clave no lo tienen', () => {
    expect(CONFIG_EQUIPO_NUEVO.disenoServidor).toBeUndefined();
    expect(filaAConfig(fila({})).disenoServidor).toBeUndefined();
    expect(filaAConfig(fila({ disenoServidor: false })).disenoServidor).toBeUndefined();
  });

  it('se enciende y se apaga con un cambio de la PC (y sobrevive al guardar la fila)', () => {
    const base = { ...CONFIG_EQUIPO_NUEVO, configurado: true };
    const on = aplicarCambio(base, { disenoServidor: true }, new Set());
    expect(on.disenoServidor).toBe(true);
    expect(filaAConfig({ ...fila(), ...configAFila(on) }).disenoServidor).toBe(true);
    const off = aplicarCambio(on, { disenoServidor: false }, new Set());
    expect(filaAConfig({ ...fila(), ...configAFila(off) }).disenoServidor).toBeUndefined();
    expect(() => aplicarCambio(base, { disenoServidor: 'si' }, new Set())).toThrow();
  });
});

describe('respaldo automático: 2 fallos seguidos apagan solos el interruptor y avisan en la campanita', () => {
  let tamanos: any;
  let prisma: any;
  let svc: EquipoConfigService;
  beforeEach(() => {
    tamanos = { disenoServidor: true };
    prisma = {
      equipoImpresionConfig: {
        findUnique: jest.fn(async () => ({ device_key_id: 10n, tamanos })),
        update: jest.fn(async ({ data }: any) => { tamanos = data.tamanos; }),
      },
      deviceKey: { findUnique: jest.fn().mockResolvedValue({ id: 10n, nombre: 'Caja' }) },
      notificacion: { create: jest.fn().mockResolvedValue({}) },
    };
    svc = new EquipoConfigService(prisma, { registrar: jest.fn().mockResolvedValue(undefined) } as any, { emitirAdmin: jest.fn() } as any);
  });

  it('un solo respaldo no apaga; uno bueno del servidor reinicia la cuenta', async () => {
    await svc.anotarDisenoServidor(10n, 'respaldo');
    expect(tamanos).toEqual({ disenoServidor: true, disenoFallos: 1 });
    await svc.anotarDisenoServidor(10n, 'servidor');
    expect(tamanos).toEqual({ disenoServidor: true, disenoFallos: 0 });
    await svc.anotarDisenoServidor(10n, 'respaldo');
    expect(tamanos.disenoServidor).toBe(true);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('dos respaldos seguidos apagan el interruptor de ESA PC y avisan a Caja y Admin', async () => {
    await svc.anotarDisenoServidor(10n, 'respaldo');
    await svc.anotarDisenoServidor(10n, 'respaldo');
    expect(tamanos.disenoServidor).toBeUndefined();
    expect(filaAConfig(fila(tamanos)).disenoServidor).toBeUndefined();
    const avisos = prisma.notificacion.create.mock.calls.map((c: any) => c[0].data);
    expect(avisos.map((a: any) => a.rol_destino).sort()).toEqual(['ADMIN', 'CAJERO']);
    expect(avisos[0]).toMatchObject({ tipo: 'ERROR_IMPRESORA', titulo: 'Diseño desde el servidor apagado' });
  });

  it('con el interruptor ya apagado no cuenta ni avisa', async () => {
    tamanos = {};
    await svc.anotarDisenoServidor(10n, 'respaldo');
    await svc.anotarDisenoServidor(10n, 'respaldo');
    expect(prisma.equipoImpresionConfig.update).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});

describe('resultado del programa con el diseño usado', () => {
  const montarRes = () => {
    const prisma: any = {
      printJob: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, estado: 'IMPRIMIENDO', intentos: 0, device_key_id: 10n, payload: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const s = new ImpresionService(prisma);
    const anotar = jest.fn().mockResolvedValue(undefined);
    (s as any).equipos = { anotarDisenoServidor: anotar };
    return { s, prisma, anotar };
  };

  it('un programa viejo (sin campo diseno) se confirma como siempre y no toca contadores', async () => {
    const { s, prisma, anotar } = montarRes();
    await s.registrarResultado({ id: '7', ok: true } as any);
    expect(prisma.printJob.update.mock.calls[0][0].data).toMatchObject({ estado: 'IMPRESO', error: null });
    expect(anotar).not.toHaveBeenCalled();
  });

  it('«respaldo» queda anotado en el trabajo como impreso con diseño de respaldo y suma un fallo a la PC', async () => {
    const { s, prisma, anotar } = montarRes();
    await s.registrarResultado({ id: '7', ok: true, diseno: 'respaldo', error: 'la impresora rechazó los comandos' } as any);
    const data = prisma.printJob.update.mock.calls[0][0].data;
    expect(data.estado).toBe('IMPRESO');
    expect(data.error).toContain('diseño de respaldo');
    expect(anotar).toHaveBeenCalledWith(10n, 'respaldo');
  });

  it('«servidor» imprime limpio y reinicia la cuenta', async () => {
    const { s, prisma, anotar } = montarRes();
    await s.registrarResultado({ id: '7', ok: true, diseno: 'servidor' } as any);
    expect(prisma.printJob.update.mock.calls[0][0].data.error).toBeNull();
    expect(anotar).toHaveBeenCalledWith(10n, 'servidor');
  });
});

describe('«Imprimir prueba» del diseño desde el servidor', () => {
  const montarPrueba = (tamanos: any) => {
    const prisma: any = {
      deviceKey: { findUnique: jest.fn().mockResolvedValue({ id: 10n, tipo: 'AGENTE', activo: true, nombre: 'Caja', area_id: null }) },
      equipoImpresionConfig: { findUnique: jest.fn().mockResolvedValue(fila(tamanos)) },
      printJob: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }: any) => ({ id: 99n, ...data })) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    return { prisma, svc: new EquipoConfigService(prisma, { registrar: jest.fn() } as any) };
  };

  it('con el interruptor apagado no imprime nada', async () => {
    const { prisma, svc } = montarPrueba({});
    await expect(svc.pruebaDisenoServidor('10')).rejects.toMatchObject({ response: { codigo: 'DISENO_SERVIDOR_APAGADO' } });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
  });

  it('encendido: encola ticket y etiquetas de prueba, sin pedido, a esa PC', async () => {
    const { prisma, svc } = montarPrueba({ disenoServidor: true });
    const r = await svc.pruebaDisenoServidor('10');
    const datos = prisma.printJob.create.mock.calls.map((c: any) => c[0].data);
    expect(datos.map((d: any) => d.tipo)).toEqual(['TICKET_PAGO', 'ETIQUETA_GENERAL', 'ETIQUETA_BEBIDA']);
    for (const d of datos) expect(d).toMatchObject({ pedido_id: null, destino_equipo_id: 10n, estado: 'PENDIENTE' });
    expect(r.ok).toBe(true);
  });
});

describe('diseño desde el servidor: el mismo tope de cabezal (104 mm) y la medida de cada PC', () => {
  const porId = (r: { trabajos: any[] }, id: string) => r.trabajos.find((t) => t.id === id)!;
  const generalDe = (tamanos: any) => {
    const trabajos = [{ id: 1n, tipo: 'ETIQUETA_GENERAL', payload: { codigo: 'G-1', titulo: 'Torta', fecha: '16/11/2026' }, copia: false, intentos: 0 }];
    const prisma: any = {
      printJob: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue(trabajos) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equipoImpresionConfig: { findUnique: jest.fn().mockResolvedValue(fila(tamanos)) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }]),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    return new ImpresionService(prisma);
  };

  it('un sticker de mas de 104 mm no sale con comandos (saldria cortado): el trabajo va sin ellos y el programa da el motivo', async () => {
    const r = await generalDe({ disenoServidor: true, general: { anchoMm: 115, altoMm: 59.8 } }).tomarTrabajos(10, 10n, undefined, null, false, CAP);
    expect(porId(r, '1').comandos).toBeUndefined();
    expect(porId(r, '1').payload.tamanoMm.anchoMm).toBe(115);
  });

  it('104 mm exactos (el maximo) si salen con comandos, con el tamano y el margen de esa PC', async () => {
    const r = await generalDe({ disenoServidor: true, general: { anchoMm: 104, altoMm: 59.8, margenMm: 3 } }).tomarTrabajos(10, 10n, undefined, null, false, CAP);
    const t = porId(r, '1');
    expect(t.comandos?.formato).toBe('TSPL');
    expect(t.comandos).toEqual(comandosDeTrabajo('ETIQUETA_GENERAL', t.payload, false, { etiqueta: CAP.etiqueta as any }));
    const script = Buffer.from(t.comandos!.base64, 'base64').toString('latin1');
    expect(script).toContain('SIZE 104 mm,59.8 mm');
  });

  it('el programa que declara la capacidad queda marcado; uno viejo (o que deja de declararla) se desmarca', async () => {
    const svc = montar({});
    await svc.tomarTrabajos(10, 10n, undefined, null, false, CAP);
    expect((svc as any).programasConDiseno.has('10')).toBe(true);
    await svc.tomarTrabajos(10, 10n, undefined, null, false, {});
    expect((svc as any).programasConDiseno.has('10')).toBe(false);
  });
});
