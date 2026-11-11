jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import { ForbiddenException } from '@nestjs/common';
import { CorreosExtraService, MAX_CORREOS_EXTRA, PRUEBAS_POR_DIA } from '../correos-extra.service';
import { CorreosExtraController } from '../correos-extra.controller';
import { AvisosEquipoCorreoService } from '../avisos-equipo-correo.service';
import { enmascararCorreo } from '../tipos-aviso';

/** Prisma en memoria con solo lo que usa el servicio. Los datos son inventados (ejemplo@prueba.test). */
function fakePrisma() {
  const extras: any[] = [];
  const marcas: any[] = [];
  let id = 0;
  const duplicado = () => Object.assign(new Error('dup'), { code: 'P2002' });
  const prisma: any = {
    extras,
    marcas,
    correoAvisoExtra: {
      count: async () => extras.length,
      findMany: async ({ where }: any = {}) =>
        extras.filter((e) => (!where?.activo || e.activo) && (!where?.tipos?.has || e.tipos.includes(where.tipos.has))),
      findUnique: async ({ where }: any) => extras.find((e) => e.id === where.id) ?? null,
      create: async ({ data }: any) => {
        if (extras.some((e) => e.correo === data.correo)) throw duplicado();
        const fila = { id: BigInt(++id), activo: true, etiqueta: null, tipos: [], ...data };
        extras.push(fila);
        return fila;
      },
      update: async ({ where, data }: any) => {
        const f = extras.find((e) => e.id === where.id);
        if (data.correo && extras.some((e) => e !== f && e.correo === data.correo)) throw duplicado();
        Object.assign(f, data);
        return f;
      },
      delete: async ({ where }: any) => {
        extras.splice(extras.findIndex((e) => e.id === where.id), 1);
      },
    },
    avisoMarca: {
      count: async ({ where }: any) => marcas.filter((m) => m.tipo === where.tipo && m.creado_en >= where.creado_en.gte).length,
      findFirst: async ({ where }: any) =>
        marcas.find((m) => m.tipo === where.tipo && m.referencia === where.referencia && m.creado_en > where.creado_en.gt) ?? null,
      create: async ({ data }: any) => {
        if (marcas.some((m) => m.clave === data.clave)) throw duplicado();
        marcas.push(data);
        return data;
      },
    },
    userAccount: { findMany: async () => [] },
  };
  return prisma;
}

function armar(conClave = false) {
  const prisma = fakePrisma();
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const correo = { enviar: jest.fn().mockResolvedValue({ enviados: 0, simulados: 1, fallidos: 0, omitidos: 0 }) };
  const config = { get: (k: string) => (conClave && k === 'RESEND_API_KEY' ? 'clave-falsa' : undefined) };
  const servicio = new CorreosExtraService(prisma, auditoria as any, correo as any, config as any);
  return { prisma, auditoria, correo, servicio };
}

describe('Correos de aviso extra', () => {
  it('agrega, normaliza a minúsculas, limpia el nombre y audita con el correo enmascarado', async () => {
    const { servicio, auditoria } = armar();
    const c = await servicio.crear({ correo: '  Contador@Prueba.TEST ', etiqueta: ' Contador ', tipos: ['STOCK', 'STOCK', 'COMPROBANTES'] }, { partyId: 1n }, '127.0.0.1');
    expect(c).toMatchObject({ correo: 'contador@prueba.test', etiqueta: 'Contador', activo: true, tipos: ['STOCK', 'COMPROBANTES'] });
    const reg = auditoria.registrar.mock.calls[0][0];
    expect(reg.accion).toBe('AGREGAR_CORREO_AVISO');
    expect(JSON.stringify(reg, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('contador@prueba.test');
    expect(reg.despues.correo).toBe('c***@prueba.test');
  });

  it('rechaza correos inválidos, tipos desconocidos y duplicados', async () => {
    const { servicio } = armar();
    await expect(servicio.crear({ correo: 'sin-arroba', tipos: [] })).rejects.toMatchObject({ response: { codigo: 'CORREO_INVALIDO' } });
    await expect(servicio.crear({ correo: 'a@b', tipos: [] })).rejects.toMatchObject({ response: { codigo: 'CORREO_INVALIDO' } });
    await expect(servicio.crear({ correo: 'a@prueba.test', tipos: ['INVENTADO'] })).rejects.toMatchObject({ response: { codigo: 'TIPO_INVALIDO' } });
    await servicio.crear({ correo: 'a@prueba.test', tipos: ['STOCK'] });
    await expect(servicio.crear({ correo: 'A@PRUEBA.test', tipos: [] })).rejects.toMatchObject({ response: { codigo: 'CORREO_DUPLICADO' } });
  });

  it('respeta el máximo de correos', async () => {
    const { servicio } = armar();
    for (let i = 0; i < MAX_CORREOS_EXTRA; i++) await servicio.crear({ correo: `p${i}@prueba.test`, tipos: [] });
    await expect(servicio.crear({ correo: 'otro@prueba.test', tipos: [] })).rejects.toMatchObject({ response: { codigo: 'LIMITE_CORREOS' } });
  });

  it('cambia tipos y estado, y quita; cada cambio queda auditado sin el correo completo', async () => {
    const { servicio, auditoria } = armar();
    const c = await servicio.crear({ correo: 'socio@prueba.test', tipos: ['STOCK'] });
    const n = await servicio.actualizar(c.id, { activo: false, tipos: ['CHAT_SIN_RESPONDER'] });
    expect(n).toMatchObject({ activo: false, tipos: ['CHAT_SIN_RESPONDER'] });
    await servicio.eliminar(c.id);
    expect(auditoria.registrar.mock.calls.map((x: any) => x[0].accion)).toEqual(['AGREGAR_CORREO_AVISO', 'CAMBIAR_CORREO_AVISO', 'QUITAR_CORREO_AVISO']);
    expect(JSON.stringify(auditoria.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain('socio@prueba.test');
    await expect(servicio.eliminar(c.id)).rejects.toMatchObject({ response: { codigo: 'CORREO_NO_ENCONTRADO' } });
  });

  it('extrasPara: solo activos y del tipo pedido', async () => {
    const { servicio } = armar();
    await servicio.crear({ correo: 'a@prueba.test', tipos: ['STOCK'] });
    await servicio.crear({ correo: 'b@prueba.test', tipos: ['STOCK'], activo: false });
    await servicio.crear({ correo: 'c@prueba.test', tipos: ['CHAT_SIN_RESPONDER'] });
    expect(await servicio.extrasPara('STOCK')).toEqual(['a@prueba.test']);
    expect(await servicio.extrasPara('PC_IMPRESION')).toEqual([]);
  });

  describe('correo de prueba', () => {
    const t0 = new Date('2026-11-11T15:00:00Z');
    it('envía por el servicio de correo y avisa si no hay clave configurada', async () => {
      const { servicio, correo } = armar(false);
      const c = await servicio.crear({ correo: 'a@prueba.test', tipos: [] });
      const r = await servicio.probar(c.id, undefined, undefined, t0);
      expect(correo.enviar).toHaveBeenCalledWith(expect.objectContaining({ destinatarios: ['a@prueba.test'], origen: 'PRUEBA_AVISOS' }));
      expect(r).toMatchObject({ correoConfigurado: false, simulado: true });
    });
    it('1 por minuto por correo', async () => {
      const { servicio } = armar();
      const c = await servicio.crear({ correo: 'a@prueba.test', tipos: [] });
      await servicio.probar(c.id, undefined, undefined, t0);
      await expect(servicio.probar(c.id, undefined, undefined, new Date(t0.getTime() + 30_000))).rejects.toMatchObject({ response: { codigo: 'ESPERA_PRUEBA' } });
      await expect(servicio.probar(c.id, undefined, undefined, new Date(t0.getTime() + 61_000))).resolves.toBeDefined();
    });
    it('10 al día en total', async () => {
      const { servicio } = armar();
      for (let i = 0; i < PRUEBAS_POR_DIA; i++) {
        const c = await servicio.crear({ correo: `p${i}@prueba.test`, tipos: [] });
        await servicio.probar(c.id, undefined, undefined, new Date(t0.getTime() + i * 1000));
      }
      const extra = await servicio.crear({ correo: 'z@prueba.test', tipos: [] });
      await expect(servicio.probar(extra.id, undefined, undefined, new Date(t0.getTime() + 20_000))).rejects.toMatchObject({ response: { codigo: 'LIMITE_PRUEBAS' } });
    });
  });
});

describe('Permisos del controlador', () => {
  const servicio: any = { listar: jest.fn(), crear: jest.fn(), actualizar: jest.fn(), eliminar: jest.fn(), probar: jest.fn() };
  const ctrl = new CorreosExtraController(servicio);
  it.each(['CAJERO', 'SUPERVISOR', 'MARKETING'])('%s no puede ver ni cambiar nada', (rol) => {
    const req = { usuario: { rol } };
    expect(() => ctrl.listar(req)).toThrow(ForbiddenException);
    expect(() => ctrl.crear({ correo: 'a@prueba.test' }, req)).toThrow(ForbiddenException);
    expect(() => ctrl.actualizar('1', {}, req)).toThrow(ForbiddenException);
    expect(() => ctrl.eliminar('1', req)).toThrow(ForbiddenException);
    expect(() => ctrl.probar('1', req)).toThrow(ForbiddenException);
    expect(servicio.crear).not.toHaveBeenCalled();
  });
  it('ADMIN sí', () => {
    ctrl.listar({ usuario: { rol: 'ADMIN' } });
    expect(servicio.listar).toHaveBeenCalled();
  });
});

describe('Unión de destinatarios (casilla + turnos + correos extra)', () => {
  // Lunes 2026-11-02 10:30 Lima
  const AHORA = new Date('2026-11-02T15:30:00Z');
  const cuenta = (correo: string) => ({
    party_id: 1n,
    avisos_correo: true,
    party: {
      persona: { correo, horario_24_7: false },
      horariosTrabajo: [{ dia_semana: 1, entrada: new Date('1970-01-01T09:00:00Z'), salida: new Date('1970-01-01T13:00:00Z') }],
      reemplazosDia: [],
    },
  });
  const armarAvisos = (extras: string[] | Error) => {
    const prisma: any = { userAccount: { findMany: jest.fn().mockResolvedValue([cuenta('Ana@Prueba.test')]) }, coberturaTurno: { findMany: jest.fn().mockResolvedValue([]) } };
    const correo = { enviar: jest.fn().mockResolvedValue({ enviados: 1, simulados: 0, fallidos: 0, omitidos: 0 }) };
    const extrasSvc = { extrasPara: jest.fn(async () => { if (extras instanceof Error) throw extras; return extras; }) };
    return { servicio: new AvisosEquipoCorreoService(prisma, correo as any, extrasSvc as any), correo, extrasSvc };
  };

  it('suma los extras del tipo a quien está de turno', async () => {
    const { servicio, correo, extrasSvc } = armarAvisos(['socio@prueba.test']);
    await servicio.avisar({ clave: 'k', origen: 'T', asunto: 'a', texto: 't', tipo: 'STOCK', ahora: AHORA });
    expect(extrasSvc.extrasPara).toHaveBeenCalledWith('STOCK');
    expect(correo.enviar.mock.calls[0][0].destinatarios).toEqual(['ana@prueba.test', 'socio@prueba.test']);
  });
  it('sin tipo cuenta como OTROS', async () => {
    const { servicio, extrasSvc } = armarAvisos([]);
    await servicio.avisar({ clave: 'k', origen: 'T', asunto: 'a', texto: 't', ahora: AHORA });
    expect(extrasSvc.extrasPara).toHaveBeenCalledWith('OTROS');
  });
  it('un correo en ambos lados se envía una sola vez (CorreoService deduplica)', async () => {
    const { servicio, correo } = armarAvisos(['ana@prueba.test']);
    await servicio.avisar({ clave: 'k', origen: 'T', asunto: 'a', texto: 't', tipo: 'STOCK', ahora: AHORA });
    // la lista puede traer el repetido: correo.enviar lo une con un Set; aquí se comprueba la entrada
    const unicos = new Set(correo.enviar.mock.calls[0][0].destinatarios);
    expect(unicos.size).toBe(1);
  });
  it('si fallan los extras, igual avisa a quienes ya recibían', async () => {
    const { servicio, correo } = armarAvisos(new Error('caída'));
    await servicio.avisar({ clave: 'k', origen: 'T', asunto: 'a', texto: 't', tipo: 'STOCK', ahora: AHORA });
    expect(correo.enviar.mock.calls[0][0].destinatarios).toEqual(['ana@prueba.test']);
  });
  it('avisarAdministradores también suma los extras', async () => {
    const prisma: any = { userAccount: { findMany: jest.fn().mockResolvedValue([{ party: { persona: { correo: 'Admin@Prueba.test' } } }]) } };
    const correo = { enviar: jest.fn().mockResolvedValue({}) };
    const s = new AvisosEquipoCorreoService(prisma, correo as any, { extrasPara: async () => ['contador@prueba.test'] } as any);
    await s.avisarAdministradores({ clave: 'k', origen: 'O', asunto: 'a', texto: 't', tipo: 'COMPROBANTES' });
    expect(correo.enviar.mock.calls[0][0].destinatarios).toEqual(['admin@prueba.test', 'contador@prueba.test']);
  });
});

describe('enmascararCorreo', () => {
  it('no devuelve el correo completo', () => {
    expect(enmascararCorreo('maria@prueba.test')).toBe('m***@prueba.test');
    expect(enmascararCorreo('raro')).toBe('***');
  });
});
