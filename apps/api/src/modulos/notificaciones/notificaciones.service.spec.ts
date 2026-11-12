jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { NotificacionesService } from './notificaciones.service';

/** Evalúa el subconjunto de `where` que usa el servicio (AND, OR, igualdad, null, in, notIn, gte). */
const cumple = (fila: any, where: any): boolean => {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'AND') {
      if (!(cond as any[]).every((c) => cumple(fila, c))) return false;
      continue;
    }
    if (k === 'OR') {
      if (!(cond as any[]).some((c) => cumple(fila, c))) return false;
      continue;
    }
    const v = fila[k];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (typeof cond === 'object' && !(cond instanceof Date) && typeof cond !== 'bigint') {
      if ('startsWith' in (cond as any) && !String(v).startsWith((cond as any).startsWith)) return false;
      if ('in' in (cond as any) && !(cond as any).in.includes(v)) return false;
      if ('notIn' in (cond as any) && (cond as any).notIn.includes(v)) return false;
      if ('gte' in (cond as any) && !(v && v >= (cond as any).gte)) return false;
      continue;
    }
    if (v !== cond) return false;
  }
  return true;
};

describe('NotificacionesService', () => {
  const hace = (min: number) => new Date(Date.now() - min * 60000);
  const ADMIN = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
  const CAJERO_A = { partyId: 3n, rol: 'CAJERO', debeCambiar: false };
  const CAJERO_B = { partyId: 4n, rol: 'CAJERO', debeCambiar: false };
  const MOZO = { partyId: 2n, rol: 'MOZO', debeCambiar: false };

  let notifs: any[];
  let lecturas: any[];
  let pedidosPorCobrar: any[];
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: NotificacionesService;

  const cargarFake = () => {
    notifs = [
      { id: 1n, tipo: 'STOCK_BAJO', rol_destino: null, titulo: 'Stock bajo', mensaje: 'Crema chantilly', enlace: null, leida_en: null, en: hace(50) },
      // dato anterior: marcada leída para todos (columna heredada)
      { id: 2n, tipo: 'ERROR_IMPRESORA', rol_destino: null, titulo: 'Impresora', mensaje: 'No responde', enlace: null, leida_en: hace(60), en: hace(70) },
      { id: 3n, tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: 'Pedido nuevo CP-W015', mensaje: 'CARTA', enlace: '/admin/pedidos', leida_en: null, en: hace(5) },
      { id: 4n, tipo: 'MENSAJE_INTERNO', rol_destino: 'CAJERO', titulo: 'Solo caja', mensaje: 'x', enlace: null, leida_en: null, en: hace(8) },
      { id: 5n, tipo: 'WHATSAPP_CONSUMO', rol_destino: null, titulo: 'Consumo', mensaje: 'x', enlace: null, leida_en: null, en: hace(9) },
    ];
    lecturas = [];
    pedidosPorCobrar = [
      { id: 10n, creado_en: hace(30) },
      { id: 11n, creado_en: hace(5) },
    ];
  };

  beforeEach(() => {
    cargarFake();
    prisma = {
      parametro: {
        findUnique: jest.fn().mockResolvedValue({ valor: 'si' }),
        // ajustes de avisos: sin filas = valores por defecto
        findMany: jest.fn().mockResolvedValue([]),
      },
      // el cajero tiene caja/ver; el mozo y el resto no tienen permisos
      rolPermiso: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve((where?.rol?.in ?? [where?.rol]).includes('CAJERO') ? [{ permiso: { modulo: 'caja', accion: 'ver' } }] : []),
        ),
      },
      pedido: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where.pago_estado) return Promise.resolve(pedidosPorCobrar);
          if (where.entrega_lat === null) return Promise.resolve([]);
          if (where.estado?.in?.includes('COLA')) return Promise.resolve([{ id: 20n, creado_en: hace(20) }]);
          if (where.estado === 'LISTO') return Promise.resolve([{ id: 21n, creado_en: hace(40), entrega_lat: 1 }]);
          return Promise.resolve([]);
        }),
      },
      comprobante: { count: jest.fn().mockResolvedValue(3) },
      reclamo: { findMany: jest.fn().mockResolvedValue([{ id: 30n, creado_en: hace(60) }]) },
      solicitudReserva: { findMany: jest.fn().mockResolvedValue([{ id: 40n, creado_en: hace(30) }]) },
      insumo: { findMany: jest.fn().mockResolvedValue([]) },
      notificacion: {
        findMany: jest.fn().mockImplementation(({ where, take }: any = {}) => {
          let r = notifs.filter((n) => cumple(n, where));
          r = [...r].sort((a, b) => b.en.getTime() - a.en.getTime());
          return Promise.resolve(take ? r.slice(0, take) : r);
        }),
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(notifs.find((n) => n.id === where.id) ?? null)),
        findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(notifs.find((n) => cumple(n, where)) ?? null)),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 99n, titulo: 'Mensaje de prueba' }),
        delete: jest.fn(),
      },
      notificacionLectura: {
        findMany: jest.fn().mockImplementation(({ where, select }: any) => {
          const r = lecturas.filter((l) => cumple(l, where));
          return Promise.resolve(r.map((l) => ({ clave: l.clave, leida_en: l.leida_en })));
        }),
        deleteMany: jest.fn().mockImplementation(({ where }: any) => {
          lecturas = lecturas.filter((l) => !(l.party_id === where.party_id && where.clave.in.includes(l.clave)));
          return Promise.resolve({});
        }),
        createMany: jest.fn().mockImplementation(({ data }: any) => {
          lecturas.push(...data.map((d: any) => ({ ...d })));
          return Promise.resolve({ count: data.length });
        }),
        upsert: jest.fn().mockImplementation(({ where, create, update }: any) => {
          const k = where.party_id_clave;
          const existente = lecturas.find((l) => l.party_id === k.party_id && l.clave === k.clave);
          if (existente) {
            Object.assign(existente, update);
            return Promise.resolve(existente);
          }
          const nueva = { ...create };
          lecturas.push(nueva);
          return Promise.resolve(nueva);
        }),
      },
      $transaction: jest.fn().mockImplementation((operaciones: any[]) => Promise.all(operaciones)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn(), emitirAParty: jest.fn() };
    service = new NotificacionesService(prisma, auditoria, eventos);
  });

  it('el administrador ve todo: contadores, y las calculadas llevan clave de contenido', async () => {
    const r = await service.resumen(ADMIN);
    expect(r.conteos).toEqual({ caja: 2, cocina: 1, repartos: 1, comprobantes: 3, reservas: 1, reclamos: 1 });
    const claves = r.notificaciones.map((n) => n.clave);
    expect(claves).toEqual(expect.arrayContaining(['n:1', 'n:3', 'n:4', 'n:5']));
    expect(claves.some((c) => c.startsWith('c:por-cobrar:'))).toBe(true);
    // la impresora heredada leída para todos no aparece como no leída
    expect(r.notificaciones.find((n) => n.clave === 'n:2')).toMatchObject({ leida: true });
  });

  it('un rol sin permisos no recibe avisos calculados, solo los guardados que le tocan', async () => {
    const r = await service.resumen(MOZO);
    expect(r.conteos).toEqual({});
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
    // sin permisos solo ve los tipos libres (mensaje interno, y solo si es para todos o para su rol)
    expect(r.notificaciones.map((n) => n.clave)).toEqual([]);
  });

  describe('asistencia: avisos de corrección', () => {
    const marcar = { partyId: 7n, rol: 'MOZO', roles: ['MOZO'], debeCambiar: false };
    const conAsistencia = (correcciones: any) => {
      prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'asistencia', accion: 'marcar' } }]);
      return new NotificacionesService(prisma, auditoria, eventos, correcciones);
    };

    it('la persona recibe un aviso con la inconsistencia sin corregir (no la ya enviada) y la clave no cambia mientras siga igual', async () => {
      const correcciones = {
        inconsistencias: jest.fn().mockResolvedValue([
          { estado: 'SIN_CORREGIR', jornada: '2026-11-06', texto: 'No marcaste tu salida (viernes 6)' },
          { estado: 'ENVIADA', jornada: '2026-11-05', texto: 'No marcaste tu entrada (jueves 5)' },
        ]),
        contarPendientes: jest.fn(),
      };
      const svc = conAsistencia(correcciones);
      const a = await svc.resumen(marcar);
      const b = await svc.resumen(marcar);
      const aviso = a.notificaciones.find((n) => n.clave.startsWith('c:asistencia-inc:'));
      expect(aviso).toMatchObject({ titulo: 'No marcaste tu salida (viernes 6)', modulo: 'mi-asistencia' });
      expect(b.notificaciones.find((n) => n.clave.startsWith('c:asistencia-inc:'))!.clave).toBe(aviso!.clave); // sin spam
      expect(a.conteos['mi-asistencia']).toBe(1);
      expect(correcciones.contarPendientes).not.toHaveBeenCalled(); // no es admin
    });

    it('sin inconsistencias no hay aviso; el ADMIN no recibe el de la persona y sí el contador de solicitudes', async () => {
      const correcciones = { inconsistencias: jest.fn().mockResolvedValue([]), contarPendientes: jest.fn().mockResolvedValue(2) };
      const svc = conAsistencia(correcciones);
      expect((await svc.resumen(marcar)).notificaciones.some((n) => n.clave.startsWith('c:asistencia-inc:'))).toBe(false);
      const admin = await svc.resumen(ADMIN);
      expect(correcciones.inconsistencias).toHaveBeenCalledTimes(1); // solo la persona, no el admin
      expect(admin.conteos.asistencia).toBe(2);
      expect(admin.notificaciones.find((n) => n.clave.startsWith('c:asistencia-solicitudes:'))!.titulo).toMatch(/2 solicitudes de corrección/);
    });
  });

  it('un aviso dirigido a CAJERO lo ve quien tiene CAJERO como rol extra, aunque su principal sea MOZO', async () => {
    const mozoConCaja = { partyId: 9n, rol: 'MOZO', roles: ['MOZO', 'CAJERO'], debeCambiar: false };
    const r = await service.resumen(mozoConCaja);
    expect(r.notificaciones.map((n) => n.clave)).toContain('n:4');
    // sin el extra no lo ve
    const soloMozo = await service.resumen({ partyId: 8n, rol: 'MOZO', roles: ['MOZO'], debeCambiar: false });
    expect(soloMozo.notificaciones.map((n) => n.clave)).not.toContain('n:4');
  });

  it('un pedido nuevo lo ve quien tiene caja o pedidos, no el mozo', async () => {
    const mozo = await service.resumen(MOZO);
    expect(mozo.notificaciones.map((n) => n.clave)).not.toContain('n:3');
    const cajero = await service.resumen(CAJERO_A);
    expect(cajero.notificaciones.map((n) => n.clave)).toContain('n:3');
    // el historial y marcar también aplican el filtro
    const historialMozo = await service.historial({}, MOZO);
    expect(historialMozo.items.map((i) => i.id)).not.toContain('3');
    await expect(service.marcarClave('n:3', true, MOZO)).rejects.toMatchObject({
      response: { codigo: 'NOTIFICACION_NO_ENCONTRADA' },
    });
  });

  it('orden: no leídas por prioridad y más nuevas primero; las leídas van al final, marcadas', async () => {
    await service.marcarClave('n:3', true, ADMIN);
    const r = await service.resumen(ADMIN);
    const noLeidas = r.notificaciones.filter((n) => !n.leida);
    const leidas = r.notificaciones.filter((n) => n.leida);
    // las leídas van al final
    expect(r.notificaciones.slice(0, noLeidas.length)).toEqual(noLeidas);
    expect(leidas.map((n) => n.clave)).toEqual(expect.arrayContaining(['n:3']));
    // urgencia: ALTA antes que MEDIA antes que BAJA
    const rango = { ALTA: 0, MEDIA: 1, BAJA: 2 } as const;
    const prioridades = noLeidas.map((n) => rango[n.prioridad]);
    expect(prioridades).toEqual([...prioridades].sort((a, b) => a - b));
    // BAJA (consumo de WhatsApp) va al final de las no leídas
    expect(noLeidas[noLeidas.length - 1].clave).toBe('n:5');
    // dentro de la misma prioridad, lo más nuevo arriba: n:4 (hace 8 min) antes que n:1 (hace 50 min) si ambas MEDIA
    const medias = noLeidas.filter((n) => n.prioridad === 'MEDIA').map((n) => n.clave);
    expect(medias.indexOf('n:4')).toBeLessThan(medias.indexOf('n:1'));
  });

  it('la lectura es por usuario: si A marca, B sigue viendo el aviso no leído', async () => {
    await service.marcarClave('n:3', true, CAJERO_A);
    const a = await service.resumen(CAJERO_A);
    const b = await service.resumen(CAJERO_B);
    expect(a.notificaciones.find((n) => n.clave === 'n:3')).toMatchObject({ leida: true });
    expect(b.notificaciones.find((n) => n.clave === 'n:3')).toMatchObject({ leida: false });
  });

  it('las leídas de las últimas 24 h se muestran; las más antiguas no', async () => {
    await service.marcarClave('n:1', true, ADMIN);
    lecturas.find((l) => l.clave === 'n:1').leida_en = hace(60 * 25); // hace 25 h
    const r = await service.resumen(ADMIN);
    expect(r.notificaciones.map((n) => n.clave)).not.toContain('n:1');
  });

  it('una calculada marcada vuelve a no leída si cambia su contenido', async () => {
    const primera = (await service.resumen(ADMIN)).notificaciones.find((n) => n.clave.startsWith('c:por-cobrar:'))!;
    await service.marcarClave(primera.clave, true, ADMIN);
    const mismaFirma = (await service.resumen(ADMIN)).notificaciones.find((n) => n.clave === primera.clave);
    expect(mismaFirma?.leida).toBe(true);

    // llega un pedido más por cobrar: la firma cambia y el aviso vuelve como no leído
    pedidosPorCobrar.push({ id: 12n, creado_en: hace(1) });
    const r = await service.resumen(ADMIN);
    const nueva = r.notificaciones.find((n) => n.clave.startsWith('c:por-cobrar:'))!;
    expect(nueva.clave).not.toBe(primera.clave);
    expect(nueva.leida).toBe(false);
    expect(nueva.titulo).toBe('3 pedidos por cobrar');
  });

  it('marcar y desmarcar solo escribe la fila del usuario, nunca toca la notificación', async () => {
    await service.marcarClave('n:3', true, CAJERO_A);
    await service.marcarClave('n:3', false, CAJERO_A);
    expect(prisma.notificacion.update).not.toHaveBeenCalled();
    expect(prisma.notificacion.updateMany).not.toHaveBeenCalled();
    expect(prisma.notificacion.delete).not.toHaveBeenCalled();
    expect(lecturas).toEqual([{ party_id: 3n, clave: 'n:3', leida_en: null }]);
    const r = await service.resumen(CAJERO_A);
    expect(r.notificaciones.find((n) => n.clave === 'n:3')).toMatchObject({ leida: false });
    expect(eventos.emitirAParty).toHaveBeenCalledWith(CAJERO_A.partyId, 'notificaciones:actualizada', {});
  });

  it('desmarcar un aviso heredado leído para todos lo deja no leído para ese usuario', async () => {
    await service.marcarClave('n:2', false, ADMIN);
    const r = await service.resumen(ADMIN);
    expect(r.notificaciones.find((n) => n.clave === 'n:2')).toMatchObject({ leida: false });
  });

  it('rechaza claves con formato inválido o de un aviso que no existe', async () => {
    await expect(service.marcarClave('por-cobrar', true, ADMIN)).rejects.toMatchObject({
      response: { codigo: 'NOTIFICACION_NO_ENCONTRADA' },
    });
    await expect(service.marcarClave('n:999', true, ADMIN)).rejects.toMatchObject({
      response: { codigo: 'NOTIFICACION_NO_ENCONTRADA' },
    });
    await expect(service.marcarLeida('abc', true, ADMIN)).rejects.toMatchObject({
      response: { codigo: 'NOTIFICACION_NO_ENCONTRADA' },
    });
  });

  it('marcar todas deja leído lo que el usuario ve como no leído, sin afectar a otro', async () => {
    const r = await service.marcarTodasLeidas(CAJERO_A);
    expect(r.ok).toBe(true);
    const a = await service.resumen(CAJERO_A);
    expect(a.notificaciones.filter((n) => !n.leida)).toEqual([]);
    const b = await service.resumen(CAJERO_B);
    expect(b.notificaciones.some((n) => !n.leida)).toBe(true);
    expect(prisma.notificacion.updateMany).not.toHaveBeenCalled();
  });

  it('marcar todas alcanza también las guardadas que el resumen no muestra (más de 100), solo para ese usuario', async () => {
    for (let i = 0; i < 150; i++) {
      notifs.push({ id: BigInt(100 + i), tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: `P${i}`, mensaje: '', enlace: null, leida_en: null, en: hace(100 + i) });
    }
    const r = await service.marcarTodasLeidas(CAJERO_A);
    expect(r.marcadas).toBeGreaterThan(150);
    const h = await service.historial({ estado: 'nuevas', limite: 50 }, CAJERO_A);
    expect(h.total).toBe(0);
    expect(h.metricas.sinLeerHistorial).toBe(0);
    const hb = await service.historial({ estado: 'nuevas', limite: 50 }, CAJERO_B);
    expect(hb.total).toBeGreaterThan(150);
    expect(lecturas.every((l) => l.party_id === CAJERO_A.partyId)).toBe(true);
  });

  it('la búsqueda del historial ignora tildes y mayúsculas', async () => {
    notifs.push({ id: BigInt(900), tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: 'Pedido de José Peña', mensaje: '', enlace: null, leida_en: null, en: hace(1) });
    const h = await service.historial({ q: 'JOSE pena' }, ADMIN);
    expect(h.items.map((i: any) => i.titulo)).toContain('Pedido de José Peña');
    const nada = await service.historial({ q: 'zzzzz' }, ADMIN);
    expect(nada.items).toHaveLength(0);
  });

  it('el historial se pagina por cursor: 10 por defecto, máximo 50, sin repetir aunque entren avisos nuevos', async () => {
    for (let i = 0; i < 25; i++) {
      notifs.push({ id: BigInt(200 + i), tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: `P${i}`, mensaje: '', enlace: null, leida_en: null, en: hace(200 + i) });
    }
    const p1 = await service.historial({}, ADMIN);
    expect(p1.items).toHaveLength(10);
    expect(p1.total).toBe(30);
    expect(p1.hayMas).toBe(true);
    expect(p1.metricas.sinLeerHistorial).toBeGreaterThan(0);
    // entra un aviso nuevo arriba: la segunda página no lo repite ni salta ninguno
    notifs.push({ id: 999n, tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: 'Nuevo', mensaje: '', enlace: null, leida_en: null, en: hace(0) });
    const p2 = await service.historial({ cursor: p1.siguienteCursor! }, ADMIN);
    expect(p2.items).toHaveLength(10);
    expect(p2.pendientes).toEqual([]);
    const ids = [...p1.items, ...p2.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(20);
    const p3 = await service.historial({ cursor: p2.siguienteCursor! }, ADMIN);
    expect(p3.items).toHaveLength(10);
    expect(p3.hayMas).toBe(false);
    expect((await service.historial({ limite: 500 }, ADMIN)).items).toHaveLength(31);
    expect((await service.historial({ limite: 2 }, ADMIN)).items).toHaveLength(2);
  });

  it('un cajero solo ve caja y sus avisos de rol', async () => {
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]);
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    const r = await service.resumen(CAJERO_A);
    expect(r.conteos).toEqual({ caja: 0 });
    // caja/ver: ve el pedido nuevo, el mensaje de caja y el error de impresora; no el stock bajo ni el consumo de WhatsApp
    expect(r.notificaciones.map((n) => n.clave)).toEqual(expect.arrayContaining(['n:3', 'n:4', 'n:2']));
    expect(r.notificaciones.map((n) => n.clave)).not.toContain('n:1');
    expect(r.notificaciones.map((n) => n.clave)).not.toContain('n:5');
  });

  it('lista el historial con métricas, conteos y el estado de este usuario', async () => {
    await service.marcarClave('n:1', true, ADMIN);
    const res = await service.historial({}, ADMIN);
    expect(res.metricas).toBeDefined();
    expect(res.items.length).toBe(5);
    expect(res.conteosPorTipo).toHaveProperty('Stock bajo');
    expect(res.conteosPorEstado).toEqual({ todas: 5, nuevas: 3, leidas: 2 });
    expect(res.pendientes.every((p) => !p.leida)).toBe(true);
  });

  it('crea un mensaje interno y lo audita', async () => {
    const r = await service.crearMensajeInterno({ titulo: 'Reunión de equipo', mensaje: 'Cierre a las 22:00' }, ADMIN);
    expect(r.ok).toBe(true);
    expect(prisma.notificacion.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.any(Object));
  });

  it('incluye aviso de stock bajo, con clave por insumos, cuando hay insumos bajo su mínimo', async () => {
    prisma.insumo.findMany.mockResolvedValue([
      { id: 10n, nombre: 'Harina', minimo: 10, stocks: [{ cantidad: 4 }] },
      { id: 11n, nombre: 'Azúcar', minimo: 5, stocks: [{ cantidad: 2 }] },
    ]);
    const r = await service.resumen(ADMIN);
    expect(r.conteos.compras).toBe(2);
    const aviso = r.notificaciones.find((n) => n.clave.startsWith('c:stock-bajo:'));
    expect(aviso?.titulo).toBe('2 insumos con stock bajo');
    expect(aviso?.ruta).toBe('/admin/compras?tab=pedir');
  });

  it('con el control de almacén apagado no muestra el aviso de stock bajo', async () => {
    prisma.parametro.findUnique.mockResolvedValue(null);
    prisma.insumo.findMany.mockResolvedValue([{ id: 10n, nombre: 'Harina', minimo: 10, stocks: [{ cantidad: 0 }] }]);
    const r = await service.resumen(ADMIN);
    expect(r.notificaciones.find((n) => n.clave.startsWith('c:stock-bajo:'))).toBeUndefined();
    expect(prisma.insumo.findMany).not.toHaveBeenCalled();
  });

  it('el SUPERVISOR ve los avisos dirigidos a CAJERO, y el MOZO no', async () => {
    const SUPERVISOR = { partyId: 5n, rol: 'SUPERVISOR', debeCambiar: false };
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]);
    const sup = await service.resumen(SUPERVISOR);
    expect(sup.notificaciones.map((n) => n.clave)).toContain('n:4');
    const mozo = await service.resumen(MOZO);
    expect(mozo.notificaciones.map((n) => n.clave)).not.toContain('n:4');
  });

  it('el SUPERVISOR marca su propio Leído sin afectar al cajero', async () => {
    const SUPERVISOR = { partyId: 5n, rol: 'SUPERVISOR', debeCambiar: false };
    await service.marcarClave('n:4', true, SUPERVISOR);
    const sup = await service.resumen(SUPERVISOR);
    expect(sup.notificaciones.find((n) => n.clave === 'n:4')).toMatchObject({ leida: true });
    const cajero = await service.resumen(CAJERO_A);
    expect(cajero.notificaciones.find((n) => n.clave === 'n:4')).toMatchObject({ leida: false });
  });

  it('el resumen trae los ajustes de sonido con sus valores por defecto', async () => {
    const r = await service.resumen(CAJERO_A);
    expect(r.ajustes).toEqual({ sonidoActivo: true, sonidoIntervaloSeg: 15, sonidoAlcance: 'TODOS_NO_LEIDOS', marcarTodasActivo: true });
  });

  it('con «Marcar todas» apagado, responde 403 y no marca nada; cada aviso se marca por separado', async () => {
    prisma.parametro.findMany.mockResolvedValue([{ clave: 'notif_marcar_todas_activo', valor: 'no' }]);
    await expect(service.marcarTodasLeidas(CAJERO_A)).rejects.toMatchObject({
      status: 403,
      response: { codigo: 'MARCAR_TODAS_DESACTIVADO' },
    });
    await expect(service.marcarTodasLeidas(CAJERO_A, ['3'])).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const r = await service.marcarClave('n:3', true, CAJERO_A);
    expect(r.ok).toBe(true);
  });

  it('los ajustes inválidos en la tabla vuelven a su valor por defecto', async () => {
    prisma.parametro.findMany.mockResolvedValue([
      { clave: 'notif_sonido_intervalo_seg', valor: 1 },
      { clave: 'notif_sonido_alcance', valor: 'MAL' },
      { clave: 'notif_sonido_activo', valor: 'no' },
    ]);
    const r = await service.resumen(CAJERO_A);
    expect(r.ajustes).toMatchObject({ sonidoActivo: false, sonidoIntervaloSeg: 15, sonidoAlcance: 'TODOS_NO_LEIDOS' });
  });

  it('un mensaje interno dirigido a SUPERVISOR se guarda para ese rol y lo ve el supervisor', async () => {
    const SUPERVISOR = { partyId: 5n, rol: 'SUPERVISOR', debeCambiar: false };
    await service.crearMensajeInterno({ rol_destino: 'supervisor', titulo: 'Turno', mensaje: 'Revisar mesas' }, ADMIN);
    expect(prisma.notificacion.create.mock.calls[0][0].data.rol_destino).toBe('SUPERVISOR');
  });
  it('lo dirigido a una persona (party_destino) solo lo ve, cuenta y marca esa persona', async () => {
    notifs.push({ id: 7n, tipo: 'MESA_LISTA', rol_destino: null, party_destino: 2n, titulo: 'Mesa lista', mensaje: 'x', enlace: null, leida_en: null, en: hace(1) });
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'mesas', accion: 'ver' } }]);
    const otroMozo = { partyId: 9n, rol: 'MOZO', debeCambiar: false };
    expect((await service.resumen(MOZO)).notificaciones.map((n) => n.clave)).toContain('n:7');
    expect((await service.resumen(otroMozo)).notificaciones.map((n) => n.clave)).not.toContain('n:7');
    expect((await service.resumen(ADMIN)).notificaciones.map((n) => n.clave)).not.toContain('n:7');
    expect((await service.historial({}, otroMozo)).items.map((i) => i.id)).not.toContain('7');
    await expect(service.marcarClave('n:7', true, otroMozo)).rejects.toMatchObject({ status: 404 });
    await expect(service.marcarClave('n:7', true, ADMIN)).rejects.toMatchObject({ status: 404 });
    expect((await service.marcarClave('n:7', true, MOZO)).ok).toBe(true);
  });

  it('un tipo sin mapa solo lo ve el ADMIN; «marcar todas» con ids ignora lo que no le toca', async () => {
    notifs.push({ id: 8n, tipo: 'TIPO_NUEVO_SIN_MAPA', rol_destino: null, titulo: 'x', mensaje: 'x', enlace: null, leida_en: null, en: hace(1) });
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]);
    expect((await service.resumen(ADMIN)).notificaciones.map((n) => n.clave)).toContain('n:8');
    expect((await service.resumen(CAJERO_A)).notificaciones.map((n) => n.clave)).not.toContain('n:8');
    await expect(service.marcarClave('n:8', true, CAJERO_A)).rejects.toMatchObject({ status: 404 });
    const r = await service.marcarTodasLeidas(CAJERO_A, ['3', '8', '5']);
    expect(r.marcadas).toBe(1);
    expect(lecturas.map((l) => l.clave)).toEqual(['n:3']);
  });
});
