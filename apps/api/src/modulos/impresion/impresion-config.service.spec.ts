jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({ signAsync: jest.fn(), verifyAsync: jest.fn() })),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ImpresionConfigService, reglasDto } from './impresion-config.service';
import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { ImpresionConfigController } from './impresion-config.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const latidoOk = (roles: string[]) => ({
  latido_impresora: 'lista',
  latido_detalle: JSON.stringify({ detalle: null, impresoras: roles.map((rol) => ({ rol, estado: 'lista' })) }),
});

describe('ImpresionConfigService', () => {
  let prisma: any;
  let auditoria: any;
  let service: ImpresionConfigService;

  beforeEach(() => {
    prisma = {
      areaCocina: {
        findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Bebidas' }, { id: 2n, nombre: 'Salados' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 1n }),
        findUnique: jest.fn().mockResolvedValue({ id: 2n, activo: true }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      deviceKey: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 10n, tipo: 'AGENTE', nombre: 'Caja', activo: true, area_id: null, ultimo_latido: new Date(), ...latidoOk(['ETIQUETERA', 'TICKETERA']) },
          { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ultimo_latido: new Date(), ...latidoOk(['ETIQUETERA']) },
        ]),
        findUnique: jest.fn().mockResolvedValue({ id: 11n, tipo: 'AGENTE', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) }),
        update: jest.fn().mockResolvedValue({}),
      },
      parametro: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      printJob: { count: jest.fn().mockResolvedValue(3) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ImpresionConfigService(prisma, auditoria);
  });

  describe('GET mapa', () => {
    it('devuelve áreas, equipos por máquina, reglas, ruteo resuelto cola por equipo', async () => {
      const m = await service.obtenerMapa();
      expect(m.areas).toEqual([
        { id: '1', nombre: 'Bebidas', equiposPorRol: { ETIQUETERA: '11', TICKETERA: null } },
        { id: '2', nombre: 'Salados', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } },
      ]);
      expect(m.equipos[1]).toMatchObject({
        deviceKeyId: '11', areaId: '1', conectado: true, maquinas: ['ETIQUETERA'],
        roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'no_configurada' }],
      });
      expect(m.reglas).toEqual(reglasDto(REGLAS_IMPRESION_DEFECTO));
      expect(m.colaPendientePorEquipo).toEqual([
        { deviceKeyId: '10', pendientes: 3 },
        { deviceKeyId: '11', pendientes: 3 },
      ]);
    });

    it('el sticker general sale en Caja; el de vaso va a Bebidas si tiene etiquetera; el de área, apagado', async () => {
      const m = await service.obtenerMapa();
      const general = m.ruteo.find((r) => r.tipo === 'ETIQUETA_GENERAL')!;
      expect(general).toMatchObject({ destinoAreaId: null, destinoNombre: 'Caja', activo: true });
      const vaso = m.ruteo.find((r) => r.tipo === 'ETIQUETA_BEBIDA')!;
      expect(vaso).toMatchObject({ destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'Barra' });
      const area = m.ruteo.filter((r) => r.tipo === 'ETIQUETA_AREA');
      expect(area.every((r) => r.activo === false)).toBe(true);
      // Bebidas no lleva sticker por área (ya tiene uno por vaso): el ruteo solo lista las demás áreas
      expect(area.map((r) => r.areaId)).toEqual(['2']);
      const comanda = m.ruteo.find((r) => r.tipo === 'TICKET_COMANDA_SALON')!;
      expect(comanda).toMatchObject({ destinoAreaId: null, destinoNombre: 'Caja' });
    });

    it('no existe ruteo de ticketera por área: el pago y la comanda siempre son de Caja', async () => {
      const m = await service.obtenerMapa();
      const deArea = m.ruteo.filter((r) => ['TICKET_PAGO', 'TICKET_COMANDA_SALON'].includes(r.tipo) && r.destinoAreaId !== null);
      expect(deArea).toEqual([]);
    });
  });

  describe('PUT equipos/:id/area', () => {
    it('asigna un área a un equipo y audita el cambio', async () => {
      const r = await service.asignarArea('11', '2', { partyId: 1n } as any, '10.1.1.1');
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 11n }, data: { area_id: 2n } });
      expect(r).toEqual({ ok: true, areaId: '2', avisos: [], reemplazados: [] });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'ASIGNAR_AREA_EQUIPO', modulo: 'impresion', antes: { areaId: null }, despues: { areaId: '2' },
      }));
    });

    it('null devuelve el equipo a Caja (si Caja está libre)', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 11n, tipo: 'AGENTE', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.asignarArea('11', null, undefined);
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 11n }, data: { area_id: null } });
      expect(r.areaId).toBeNull();
    });

    it('si el área ya tiene equipo con esa máquina responde 409 AREA_OCUPADA y no cambia nada', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const err = await service.asignarArea('12', '1', undefined).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ codigo: 'AREA_OCUPADA', ocupadoPor: { deviceKeyId: '11', nombre: 'Barra' } });
      expect(prisma.deviceKey.update).not.toHaveBeenCalled();
      expect(prisma.deviceKey.updateMany).not.toHaveBeenCalled();
    });

    it('un área con equipo de OTRA máquina no choca: ticketera y etiquetera pueden convivir', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 12n, tipo: 'AGENTE', activo: true, area_id: null, ...latidoOk(['TICKETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.asignarArea('12', '1', undefined);
      expect(r.areaId).toBe('1');
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 12n }, data: { area_id: 1n } });
    });

    it('Caja solo admite un equipo: si ya hay otro en Caja responde 409', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) });
      const err = await service.asignarArea('11', null, undefined).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'AREA_OCUPADA', ocupadoPor: { deviceKeyId: '10', nombre: 'Caja' } });
      expect(prisma.deviceKey.update).not.toHaveBeenCalled();
    });

    it('con reemplazar: el anterior se desactiva y el nuevo queda en el área, en una sola transacción, auditado', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.asignarArea('12', '1', { partyId: 1n } as any, '10.0.0.1', true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.deviceKey.updateMany).toHaveBeenCalledWith({ where: { id: { in: [11n] } }, data: { activo: false } });
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 12n }, data: { area_id: 1n } });
      expect(r.reemplazados).toEqual(['11']);
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'REEMPLAZAR_EQUIPO',
        entidadId: 12n,
        antes: { areaId: null, anterioresIds: ['11'] },
        despues: { equipoNuevoId: '12', areaId: '1', desactivadosIds: ['11'] },
      }));
    });

    it('reemplazar en Caja desactiva el equipo de Caja anterior y deja el nuevo en Caja', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) });
      const r = await service.asignarArea('11', null, undefined, undefined, true);
      expect(prisma.deviceKey.updateMany).toHaveBeenCalledWith({ where: { id: { in: [10n] } }, data: { activo: false } });
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 11n }, data: { area_id: null } });
      expect(r.areaId).toBeNull();
    });

    it('el atajo reemplazar: el nuevo hereda el área del viejo y el viejo se desactiva', async () => {
      prisma.deviceKey.findUnique
        .mockResolvedValueOnce({ id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) })
        .mockResolvedValueOnce({ id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.reemplazarEquipo('11', '12', { partyId: 1n } as any);
      expect(prisma.deviceKey.updateMany).toHaveBeenCalledWith({ where: { id: { in: [11n] } }, data: { activo: false } });
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 12n }, data: { area_id: 1n } });
      expect(r).toMatchObject({ areaId: '1', porEquipoId: '12', reemplazados: ['11'] });
    });

    it('el atajo rechaza reemplazarse a sí mismo', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 11n, tipo: 'AGENTE', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) });
      await expect(service.reemplazarEquipo('11', '11', undefined)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('el reemplazo no toca los trabajos pendientes: siguen con su área de destino y los toma el nuevo', async () => {
      prisma.printJob = { updateMany: jest.fn(), update: jest.fn() };
      prisma.deviceKey.findUnique
        .mockResolvedValueOnce({ id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) })
        .mockResolvedValueOnce({ id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      await service.reemplazarEquipo('11', '12', undefined);
      // Ningún trabajo se reescribe: el área de destino de cada trabajo sigue igual y el nuevo equipo la hereda
      expect(prisma.printJob.updateMany).not.toHaveBeenCalled();
      expect(prisma.printJob.update).not.toHaveBeenCalled();
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 12n }, data: { area_id: 1n } });
    });

    it('quedarse con un equipo desactiva los duplicados que chocan con él', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
        { id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.quedarseCon('11', undefined);
      expect(prisma.deviceKey.updateMany).toHaveBeenCalledWith({ where: { id: { in: [12n] } }, data: { activo: false } });
      expect(r.desactivados).toEqual(['12']);
    });

    it('el mapa avisa de los duplicados por área y en Caja', async () => {
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 10n, tipo: 'AGENTE', nombre: 'Caja', activo: true, area_id: null, ultimo_latido: new Date(), ...latidoOk(['ETIQUETERA']) },
        { id: 13n, tipo: 'AGENTE', nombre: 'Caja 2', activo: true, area_id: null, ultimo_latido: new Date(), ...latidoOk(['TICKETERA']) },
        { id: 11n, tipo: 'AGENTE', nombre: 'Barra', activo: true, area_id: 1n, ultimo_latido: new Date(), ...latidoOk(['ETIQUETERA']) },
        { id: 12n, tipo: 'AGENTE', nombre: 'Barra 2', activo: true, area_id: 1n, ultimo_latido: new Date(), ...latidoOk(['ETIQUETERA']) },
      ]);
      const m = await service.obtenerMapa();
      expect(m.duplicados).toEqual([
        { areaId: null, nombre: 'Caja', equipos: [{ deviceKeyId: '10', nombre: 'Caja' }, { deviceKeyId: '13', nombre: 'Caja 2' }] },
        { areaId: '1', nombre: 'Bebidas', equipos: [{ deviceKeyId: '11', nombre: 'Barra' }, { deviceKeyId: '12', nombre: 'Barra 2' }] },
      ]);
    });

    it('el mapa no marca duplicados si cada máquina tiene un solo equipo', async () => {
      const m = await service.obtenerMapa();
      expect(m.duplicados).toEqual([]);
    });

    it('rechaza un equipo que no es agente o inactivo, un área inactiva o un id inválido', async () => {
      prisma.deviceKey.findUnique.mockResolvedValueOnce({ id: 13n, tipo: 'TV', activo: true });
      await expect(service.asignarArea('13', '1', undefined)).rejects.toThrow(NotFoundException);
      prisma.deviceKey.findUnique.mockResolvedValueOnce({ id: 14n, tipo: 'AGENTE', activo: false });
      await expect(service.asignarArea('14', '1', undefined)).rejects.toThrow(NotFoundException);
      prisma.areaCocina.findUnique.mockResolvedValueOnce({ id: 2n, activo: false });
      await expect(service.asignarArea('11', '2', undefined)).rejects.toThrow(BadRequestException);
      await expect(service.asignarArea('11', 'abc', undefined)).rejects.toThrow(BadRequestException);
      await expect(service.asignarArea('x1', '2', undefined)).rejects.toThrow(BadRequestException);
      expect(prisma.deviceKey.update).not.toHaveBeenCalled();
    });
  });

  describe('PUT reglas', () => {
    it('guarda solo lo que llega, con claves impresion_*, y audita antes y después', async () => {
      const r = await service.guardarReglas({ areaActivo: true, generalModalidades: ['DELIVERY'] }, { partyId: 1n } as any);
      const claves = prisma.parametro.upsert.mock.calls.map((c: any) => c[0].where.clave).sort();
      expect(claves).toEqual(['impresion_etiqueta_area_activo', 'impresion_etiqueta_general_modalidades'].sort());
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CAMBIAR_REGLAS_IMPRESION', modulo: 'impresion' }));
      expect(r.ok).toBe(true);
    });

    it('rechaza una modalidad que no existe y no guarda nada', async () => {
      await expect(service.guardarReglas({ generalModalidades: ['PLANETA'] }, undefined)).rejects.toThrow(BadRequestException);
      await expect(service.guardarReglas({ bebidaActivo: 'no' as any }, undefined)).rejects.toThrow(BadRequestException);
      expect(prisma.parametro.upsert).not.toHaveBeenCalled();
    });
  });

  describe('POST reglas/restablecer', () => {
    const CLAVES_BORRADAS = [
      'impresion_etiqueta_general_modalidades',
      'impresion_etiqueta_bebida_activo',
      'impresion_etiqueta_area_activo',
      'impresion_ticket_comanda_salon_activo',
      'impresion_ticket_comanda_area_activo',
    ].sort();

    it('borra solo las claves de reglas (no impresion_vence_min) y devuelve los defectos', async () => {
      // Tras cambiar reglas, la tabla tiene valores distintos a los defectos.
      // Primera lectura (antes): valores cambiados. Segunda (después de borrar): sin filas.
      prisma.parametro.findMany
        .mockResolvedValueOnce([
          { clave: 'impresion_etiqueta_bebida_activo', valor: false },
          { clave: 'impresion_etiqueta_area_activo', valor: true },
        ])
        .mockResolvedValueOnce([]);
      const r = await service.restablecerReglas({ partyId: 1n } as any);
      const where = prisma.parametro.deleteMany.mock.calls[0][0].where.clave.in;
      expect([...where].sort()).toEqual(CLAVES_BORRADAS);
      expect(where).not.toContain('impresion_vence_min');
      expect(prisma.parametro.upsert).not.toHaveBeenCalled();
      expect(r).toEqual({ ok: true, reglas: reglasDto(REGLAS_IMPRESION_DEFECTO) });
    });

    it('es idempotente: sin filas guardadas responde los defectos y no falla', async () => {
      const primera = await service.restablecerReglas(undefined);
      const segunda = await service.restablecerReglas(undefined);
      expect(primera).toEqual(segunda);
      expect(primera.reglas).toEqual(reglasDto(REGLAS_IMPRESION_DEFECTO));
    });

    it('audita con RESTABLECER_REGLAS_IMPRESION con antes y después', async () => {
      prisma.parametro.findMany
        .mockResolvedValueOnce([{ clave: 'impresion_etiqueta_bebida_activo', valor: false }])
        .mockResolvedValueOnce([]);
      await service.restablecerReglas({ partyId: 7n } as any, '10.0.0.1');
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'RESTABLECER_REGLAS_IMPRESION',
        entidad: 'parametro',
        partyId: 7n,
        ip: '10.0.0.1',
        antes: expect.objectContaining({ bebidaActivo: false }),
        despues: reglasDto(REGLAS_IMPRESION_DEFECTO),
      }));
    });

    it('exige configuracion/editar', () => {
      const permiso = Reflect.getMetadata(CLAVE_PERMISO, ImpresionConfigController.prototype.restablecerReglas);
      expect(permiso).toEqual({ modulo: 'configuracion', accion: 'editar' });
    });
  });
});
