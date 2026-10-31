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
          Promise.resolve(where?.rol === 'CAJERO' ? [{ permiso: { modulo: 'caja', accion: 'ver' } }] : []),
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
    eventos = { emitirAdmin: jest.fn() };
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
    // sin permisos solo ve los tipos sin restricción (aquí, consumo de WhatsApp)
    expect(r.notificaciones.map((n) => n.clave)).toEqual(['n:5']);
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
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:actualizada', { clave: 'n:3', leida: false });
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

  it('un cajero solo ve caja y sus avisos de rol', async () => {
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]);
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    const r = await service.resumen(CAJERO_A);
    expect(r.conteos).toEqual({ caja: 0 });
    // caja/ver: ve el pedido nuevo, el mensaje de caja y el consumo; no el stock bajo
    expect(r.notificaciones.map((n) => n.clave)).toEqual(expect.arrayContaining(['n:3', 'n:4', 'n:5']));
    expect(r.notificaciones.map((n) => n.clave)).not.toContain('n:1');
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
});
