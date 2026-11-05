import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImpresionConfigService, reglasDto } from './impresion-config.service';
import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';

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
      deviceKey: {
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
      },
      printJob: { count: jest.fn().mockResolvedValue(3) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ImpresionConfigService(prisma, auditoria);
  });

  describe('GET mapa', () => {
    it('devuelve áreas, equipos por máquina, reglas, ruteo resuelto cola por equipo', async () => {
      const m = await service.obtenerMapa();
      expect(m.areas).toEqual([{ id: '1', nombre: 'Bebidas' }, { id: '2', nombre: 'Salados' }]);
      expect(m.equipos[1]).toMatchObject({
        deviceKeyId: '11', areaId: '1', conectado: true,
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
      expect(r).toEqual({ ok: true, areaId: '2', avisos: [] });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'ASIGNAR_AREA_EQUIPO', modulo: 'impresion', antes: { areaId: null }, despues: { areaId: '2' },
      }));
    });

    it('null devuelve el equipo a Caja', async () => {
      const r = await service.asignarArea('11', null, undefined);
      expect(prisma.deviceKey.update).toHaveBeenCalledWith({ where: { id: 11n }, data: { area_id: null } });
      expect(r.areaId).toBeNull();
    });

    it('avisa (no bloquea) si otro equipo de esa área tiene la misma máquina', async () => {
      prisma.deviceKey.findUnique.mockResolvedValue({ id: 12n, tipo: 'AGENTE', activo: true, area_id: null, ...latidoOk(['ETIQUETERA']) });
      prisma.deviceKey.findMany.mockResolvedValue([
        { id: 11n, tipo: 'AGENTE', activo: true, area_id: 1n, ...latidoOk(['ETIQUETERA']) },
      ]);
      const r = await service.asignarArea('12', '1', undefined);
      expect(r.avisos.length).toBe(1);
      expect(prisma.deviceKey.update).toHaveBeenCalled();
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
});
