jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { EquipoConfigController } from './equipo-config.controller';
import { EquipoConfigService } from './equipo-config.service';
import { ImpresionService } from './impresion.service';
import { aplicarCambio, configDesdeComportamientoActual, configDesdeGeneral, filaAConfig } from './equipo-config';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';

const areas = [
  { id: 1n, nombre: 'Bebidas' },
  { id: 2n, nombre: 'Salados' },
];
const validas = new Set(['1', '2']);
const reglas = { ...REGLAS_IMPRESION_DEFECTO, comandaAreaActivo: true, generalModalidades: ['LLEVAR'] };

describe('migración: el comportamiento actual pasa a config por equipo (nada deja de imprimir)', () => {
  const caja = { id: 10n, areaId: null, roles: ['TICKETERA', 'ETIQUETERA'] as any };
  const barra = { id: 11n, areaId: 1n, roles: ['ETIQUETERA'] as any };

  it('Caja: pago, comanda de salón, general y todo lo que ninguna PC de área atendía', () => {
    const c = configDesdeComportamientoActual(caja, [caja, barra], areas, reglas, 1n);
    expect(c).toMatchObject({
      configurado: true,
      pausado: false,
      ticketera: true,
      etiquetera: true,
      ticketPago: true,
      comandaSalon: true,
      comandaAreas: ['1', '2'], // ninguna ticketera de área: Caja las atiende
      stickerGeneral: true,
      stickerAreas: ['2'], // Bebidas no lleva sticker por área
      stickerBebidaAreas: [], // Bebidas tiene su etiquetera
    });
  });

  it('PC de Bebidas: solo sus vasos; no pago ni general', () => {
    const c = configDesdeComportamientoActual(barra, [caja, barra], areas, reglas, 1n);
    expect(c).toMatchObject({
      configurado: true,
      ticketera: false,
      etiquetera: true,
      ticketPago: false,
      stickerGeneral: false,
      stickerAreas: [],
      stickerBebidaAreas: ['1'],
    });
  });

  it('respeta los interruptores del local: sticker por área apagado queda apagado', () => {
    const c = configDesdeComportamientoActual(caja, [caja], areas, { ...reglas, areaActivo: false, bebidaActivo: false }, 1n);
    expect(c.stickerAreas).toEqual([]);
    expect(c.stickerBebidaAreas).toEqual([]);
  });

  it('«Usar lo general» rellena con las reglas del local y deja la PC configurada', () => {
    const c = configDesdeGeneral({ ...REGLAS_IMPRESION_DEFECTO, comandaAreaActivo: true }, areas, 1n);
    expect(c).toMatchObject({
      configurado: true,
      ticketera: true,
      etiquetera: true,
      ticketPago: true,
      comandaSalon: true,
      comandaAreas: ['1', '2'],
      stickerGeneral: false, // apagado de fábrica
      stickerAreas: ['2'],
      stickerBebidaAreas: ['1'],
    });
  });
});

describe('aplicarCambio', () => {
  it('marca configurado y mezcla solo lo que llega', () => {
    const c = aplicarCambio(CONFIG_EQUIPO_NUEVO, { ticketera: true, ticketPago: true }, validas);
    expect(c).toMatchObject({ configurado: true, ticketera: true, ticketPago: true, etiquetera: false });
  });

  it('rechaza áreas inexistentes y valores que no son sí/no', () => {
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerAreas: ['99'] }, validas)).toThrow();
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { ticketera: 'si' }, validas)).toThrow();
  });

  it('tamaño propio: valida 30-200 mm y margen 0-10; null vuelve a heredar el general', () => {
    const t = aplicarCambio(CONFIG_EQUIPO_NUEVO, { tamanoBebida: { anchoMm: 101.6, altoMm: 63.5, orientacion: 'apaisado', margenMm: 2 } }, validas);
    expect(t.tamanoBebida).toEqual({ anchoMm: 101.6, altoMm: 63.5, orientacion: 'apaisado', margenMm: 2 });
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { tamanoBebida: { anchoMm: 20, altoMm: 40 } }, validas)).toThrow();
    expect(aplicarCambio(t, { tamanoBebida: null }, validas).tamanoBebida).toBeNull();
  });

  it('filaAConfig: sin fila = PC nueva apagada', () => {
    expect(filaAConfig(null)).toEqual(CONFIG_EQUIPO_NUEVO);
  });
});

describe('EquipoConfigService', () => {
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: EquipoConfigService;
  const usuario = { partyId: 7n, rol: 'ADMIN' } as any;
  const equipo = (extra: any = {}) => ({ id: 10n, tipo: 'AGENTE', activo: true, nombre: 'Caja', area_id: null, ultimo_latido: new Date(), latido_impresora: 'lista', latido_detalle: JSON.stringify({ impresoras: [{ rol: 'TICKETERA', estado: 'lista' }] }), configImpresion: null, ...extra });
  const fila = (c: any = {}) => ({ device_key_id: 10n, configurado: true, pausado: false, ticketera: true, etiquetera: false, ticket_pago: true, comanda_salon: false, comanda_areas: [], sticker_general: false, sticker_areas: [], sticker_bebida_areas: [], tamanos: {}, ...c });

  beforeEach(() => {
    prisma = {
      deviceKey: { findMany: jest.fn().mockResolvedValue([equipo()]), findUnique: jest.fn().mockResolvedValue(equipo()), update: jest.fn().mockResolvedValue({}) },
      areaCocina: { findMany: jest.fn().mockResolvedValue(areas) },
      equipoImpresionConfig: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) },
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      printJob: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }: any) => ({ id: 77n, ...data })) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    service = new EquipoConfigService(prisma, auditoria, eventos);
  });

  it('un equipo que ya imprimía se convierte (una vez) a config equivalente y configurada', async () => {
    const ctx = await service.contexto();
    expect(ctx.equipos[0].config).toMatchObject({ configurado: true, ticketera: true, ticketPago: true, comandaSalon: true });
    const creada = prisma.equipoImpresionConfig.create.mock.calls[0][0].data;
    expect(creada).toMatchObject({ device_key_id: 10n, configurado: true, ticketera: true, ticket_pago: true });
  });

  it('una PC que nunca latió llega como «Nueva · falta configurar»: todo apagado y configurado=false', async () => {
    prisma.deviceKey.findMany.mockResolvedValue([equipo({ ultimo_latido: null, latido_impresora: null, latido_detalle: null })]);
    const ctx = await service.contexto();
    expect(ctx.equipos[0].config).toEqual(CONFIG_EQUIPO_NUEVO);
    expect(prisma.equipoImpresionConfig.create.mock.calls[0][0].data).toMatchObject({ configurado: false, ticketera: false, etiquetera: false });
  });

  it('guardar: marca configurada, audita quién cambió qué, avisa en vivo y reubica la cola', async () => {
    prisma.equipoImpresionConfig.findUnique.mockResolvedValue(fila({ configurado: false, ticketera: false, ticket_pago: false }));
    const r = await service.guardar('10', { nombre: ' Caja 2 ', ticketera: true, ticketPago: true, impresoras: { TICKETERA: 'POS-80' } }, usuario, '1.2.3.4');
    expect(r.config).toMatchObject({ configurado: true, ticketera: true, ticketPago: true });
    expect(prisma.equipoImpresionConfig.upsert.mock.calls[0][0].update).toMatchObject({ configurado: true, ticket_pago: true, actualizado_por: 7n });
    expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { nombre: 'Caja 2' } });
    expect(prisma.parametro.upsert.mock.calls[0][0].update.valor).toEqual({ TICKETERA: 'POS-80' });
    const a = auditoria.registrar.mock.calls[0][0];
    expect(a).toMatchObject({ modulo: 'impresion', accion: 'CAMBIAR_CONFIG_EQUIPO_IMPRESION', partyId: 7n, ip: '1.2.3.4' });
    expect(a.antes).toMatchObject({ nombre: 'Caja', configurado: false });
    expect(a.despues).toMatchObject({ nombre: 'Caja 2', configurado: true, ticketera: true });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('impresion:estado', expect.anything());
  });

  it('guardar rechaza un equipo desvinculado (404) y un tamaño fuera de rango (400)', async () => {
    prisma.deviceKey.findUnique.mockResolvedValue(equipo({ activo: false }));
    await expect(service.guardar('10', {}, usuario)).rejects.toMatchObject({ status: 404 });
    prisma.deviceKey.findUnique.mockResolvedValue(equipo());
    prisma.equipoImpresionConfig.findUnique.mockResolvedValue(fila());
    await expect(service.guardar('10', { tamanoGeneral: { anchoMm: 500, altoMm: 40 } }, usuario)).rejects.toMatchObject({ status: 400 });
  });

  it('usarGeneral rellena con las reglas del local y conserva pausa y tamaños propios', async () => {
    prisma.equipoImpresionConfig.findUnique.mockResolvedValue(fila({ pausado: true, tamanos: { bebida: { anchoMm: 60, altoMm: 40 } } }));
    const r = await service.usarGeneral('10', usuario);
    expect(r.config).toMatchObject({ configurado: true, etiquetera: true, ticketera: true, pausado: true, stickerAreas: ['2'] });
    expect(r.config.tamanoBebida).toEqual({ anchoMm: 60, altoMm: 40 });
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('USAR_LO_GENERAL_EQUIPO_IMPRESION');
  });

  it('reasignarPendientes: lo que nadie tenía va a la PC que ahora lo imprime; lo que ya está en una PC que lo acepta no se mueve', async () => {
    prisma.deviceKey.findMany.mockResolvedValue([equipo({ configImpresion: fila() })]);
    prisma.printJob.findMany.mockResolvedValue([
      { id: 1n, tipo: 'TICKET_PAGO', area_id: null, payload: {}, destino_equipo_id: null },
      { id: 2n, tipo: 'TICKET_PAGO', area_id: null, payload: {}, destino_equipo_id: 10n },
      { id: 3n, tipo: 'ETIQUETA_GENERAL', area_id: null, payload: {}, destino_equipo_id: null },
    ]);
    expect(await service.reasignarPendientes()).toBe(1);
    expect(prisma.printJob.update).toHaveBeenCalledTimes(1);
    expect(prisma.printJob.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { destino_equipo_id: 10n, destino_area_id: null } });
  });

  it('prueba con este tamaño: va a ESA PC con el tamaño recibido (aplica orientación) y se audita', async () => {
    const r = await service.pruebaEtiqueta('10', 'bebida', { anchoMm: 50, altoMm: 30, orientacion: 'vertical' }, usuario);
    const data = prisma.printJob.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tipo: 'ETIQUETA_BEBIDA', pedido_id: null, destino_equipo_id: 10n });
    expect(data.payload.tamanoMm).toEqual({ anchoMm: 30, altoMm: 50 });
    expect(r.ok).toBe(true);
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('IMPRESION_PRUEBA_TAMANO');
  });
});

describe('tamaño por PC en la entrega de trabajos y config en el latido', () => {
  const fila = (tamanos: any = {}) => ({ device_key_id: 10n, configurado: true, pausado: false, ticketera: true, etiquetera: true, ticket_pago: true, comanda_salon: false, comanda_areas: [], sticker_general: true, sticker_areas: [], sticker_bebida_areas: [], tamanos });
  const montar = (cfgFila: any) => {
    const trabajos = [
      { id: 1n, tipo: 'ETIQUETA_BEBIDA', payload: { codigo: 'A' }, copia: false, intentos: 0 },
      { id: 2n, tipo: 'ETIQUETA_GENERAL', payload: { codigo: 'A' }, copia: false, intentos: 0 },
      { id: 3n, tipo: 'ETIQUETA_BEBIDA', payload: { codigo: 'P', tamanoMm: { anchoMm: 50, altoMm: 30 } }, copia: false, intentos: 0 },
    ];
    const prisma: any = {
      printJob: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), findMany: jest.fn().mockResolvedValue(trabajos) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equipoImpresionConfig: { findUnique: jest.fn().mockResolvedValue(cfgFila) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }, { id: 2n }, { id: 3n }]),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    prisma.printJob.updateMany.mockResolvedValue({ count: 3 });
    return new ImpresionService(prisma);
  };

  it('el tamaño propio de la PC reemplaza al general solo allí; el que no tiene valor propio hereda el general', async () => {
    const r = await montar(fila({ bebida: { anchoMm: 101.6, altoMm: 63.5, margenMm: 2 } })).tomarTrabajos(10, 10n);
    expect((r.trabajos[0].payload as any).tamanoMm).toEqual({ anchoMm: 101.6, altoMm: 63.5, margenMm: 2 });
    // general: sin valor propio, hereda 100 x 100 del local
    expect((r.trabajos[1].payload as any).tamanoMm).toEqual({ anchoMm: 100, altoMm: 100 });
    // una prueba con tamaño ya trae el suyo y no se pisa
    expect((r.trabajos[2].payload as any).tamanoMm).toEqual({ anchoMm: 50, altoMm: 30 });
  });

  it('la orientación vertical deja el lado largo como alto', async () => {
    const r = await montar(fila({ general: { anchoMm: 100, altoMm: 60, orientacion: 'vertical' } })).tomarTrabajos(10, 10n);
    expect((r.trabajos[1].payload as any).tamanoMm).toEqual({ anchoMm: 60, altoMm: 100 });
  });

  it('el latido devuelve la config de la PC (máquinas, pausa, configurada y tamaños) para aplicarla sin reiniciar', async () => {
    const svc = montar(fila({ bebida: { anchoMm: 60, altoMm: 40 } }));
    const prisma = (svc as any).prisma;
    prisma.deviceKey = { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) };
    prisma.printJob.count = jest.fn().mockResolvedValue(0);
    const r = await svc.registrarLatido({ version: '1', impresora: 'lista', equipo: { hostname: 'CAJA-PC', sistema: 'win32', ipLocal: ['192.168.1.20'] } } as any, 10n, '200.1.1.1, 10.0.0.1');
    expect(r.equipo).toEqual({ ticketera: true, etiquetera: true, pausado: false, configurado: true, tamanoGeneral: null, tamanoBebida: { anchoMm: 60, altoMm: 40 } });
    const data = prisma.deviceKey.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ latido_hostname: 'CAJA-PC', latido_sistema: 'win32', latido_ip_local: '192.168.1.20', latido_ip_publica: '200.1.1.1' });
  });
});

describe('permisos del controlador por PC', () => {
  const proto = EquipoConfigController.prototype as any;
  it('ver la config exige configuracion/ver; cambiarla, usar lo general y probar exigen configuracion/editar', () => {
    expect(Reflect.getMetadata(CLAVE_PERMISO, proto.obtener)).toEqual({ modulo: 'configuracion', accion: 'ver' });
    for (const m of ['guardar', 'usarGeneral', 'pruebaEtiqueta']) {
      expect(Reflect.getMetadata(CLAVE_PERMISO, proto[m])).toEqual({ modulo: 'configuracion', accion: 'editar' });
    }
  });

  it('guardar pasa quién y desde qué IP (auditoría)', async () => {
    const svc: any = { guardar: jest.fn().mockResolvedValue({ ok: true }) };
    const ctrl = new EquipoConfigController(svc);
    await ctrl.guardar('10', { ticketera: true }, { usuario: { partyId: 7n }, ip: '9.9.9.9', headers: {} });
    expect(svc.guardar).toHaveBeenCalledWith('10', { ticketera: true }, { partyId: 7n }, '9.9.9.9');
  });
});
