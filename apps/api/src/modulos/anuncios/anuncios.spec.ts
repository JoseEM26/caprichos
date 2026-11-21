jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnunciosAdminController, CartaAnunciosController, PersonalAnunciosController } from './anuncios.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { AnunciosService } from './anuncios.service';
import { estadoAnuncio, ReglaAnuncio, seMuestraAhora, tocaPorFrecuencia, vigenteAhora } from './anuncios.regla';
import { PERMISOS } from '../acceso/permisos';

// Lima = UTC-5. 2026-11-18 es miércoles.
const lima = (iso: string) => new Date(`${iso}-05:00`);
const base = (o: Partial<ReglaAnuncio> = {}): ReglaAnuncio => ({
  activo: true, desde: null, hasta: null, franja_desde: null, franja_hasta: null, dias_semana: [],
  frecuencia: 'UNA_VEZ', veces_por_dia: 1, cada_horas: null, ...o,
});

describe('regla: vigencia, franja y días (hora de Lima)', () => {
  it('apagado nunca; sin límites siempre', () => {
    expect(vigenteAhora(base({ activo: false }))).toBe(false);
    expect(vigenteAhora(base())).toBe(true);
  });
  it('respeta desde y hasta', () => {
    const a = base({ desde: lima('2026-11-18T08:00:00'), hasta: lima('2026-11-18T12:00:00') });
    expect(vigenteAhora(a, lima('2026-11-18T07:59:00'))).toBe(false);
    expect(vigenteAhora(a, lima('2026-11-18T10:00:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-18T12:01:00'))).toBe(false);
  });
  it('la franja se mide en Lima, no en UTC', () => {
    const a = base({ franja_desde: '07:00', franja_hasta: '11:00' });
    expect(vigenteAhora(a, lima('2026-11-18T06:59:00'))).toBe(false);
    expect(vigenteAhora(a, lima('2026-11-18T07:00:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-18T10:59:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-18T11:00:00'))).toBe(false);
    // 23:30 Lima ya es el día siguiente en UTC: sigue fuera de la franja
    expect(vigenteAhora(a, lima('2026-11-18T23:30:00'))).toBe(false);
  });
  it('franja que cruza la medianoche', () => {
    const a = base({ franja_desde: '22:00', franja_hasta: '02:00' });
    expect(vigenteAhora(a, lima('2026-11-18T23:00:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-18T01:00:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-18T12:00:00'))).toBe(false);
  });
  it('días de la semana (0 domingo)', () => {
    const a = base({ dias_semana: [3] }); // miércoles
    expect(vigenteAhora(a, lima('2026-11-18T10:00:00'))).toBe(true);
    expect(vigenteAhora(a, lima('2026-11-19T10:00:00'))).toBe(false);
    // miércoles 22:00 Lima = jueves 03:00 UTC: sigue siendo miércoles
    expect(vigenteAhora(a, lima('2026-11-18T22:00:00'))).toBe(true);
  });
});

describe('regla: frecuencia por persona', () => {
  const ahora = lima('2026-11-18T10:00:00');
  it('UNA_VEZ: solo si nunca la vio', () => {
    expect(tocaPorFrecuencia(base({ frecuencia: 'UNA_VEZ' }), [], ahora)).toBe(true);
    expect(tocaPorFrecuencia(base({ frecuencia: 'UNA_VEZ' }), [lima('2026-11-01T10:00:00')], ahora)).toBe(false);
  });
  it('CADA_INGRESO: siempre', () => {
    expect(tocaPorFrecuencia(base({ frecuencia: 'CADA_INGRESO' }), [ahora, ahora], ahora)).toBe(true);
  });
  it('VECES_POR_DIA: cuenta solo el día de hoy en Lima', () => {
    const a = base({ frecuencia: 'VECES_POR_DIA', veces_por_dia: 2 });
    const ayerNoche = lima('2026-11-17T23:00:00'); // ya es hoy en UTC, pero ayer en Lima
    expect(tocaPorFrecuencia(a, [ayerNoche, ayerNoche], ahora)).toBe(true);
    expect(tocaPorFrecuencia(a, [lima('2026-11-18T08:00:00')], ahora)).toBe(true);
    expect(tocaPorFrecuencia(a, [lima('2026-11-18T08:00:00'), lima('2026-11-18T09:00:00')], ahora)).toBe(false);
  });
  it('CADA_N_HORAS: espera N horas desde la última vista', () => {
    const a = base({ frecuencia: 'CADA_N_HORAS', cada_horas: 4 });
    expect(tocaPorFrecuencia(a, [lima('2026-11-18T07:00:00')], ahora)).toBe(false);
    expect(tocaPorFrecuencia(a, [lima('2026-11-18T05:59:00')], ahora)).toBe(true);
  });
  it('seMuestraAhora combina vigencia y frecuencia', () => {
    const a = base({ franja_desde: '07:00', franja_hasta: '11:00', frecuencia: 'UNA_VEZ' });
    expect(seMuestraAhora(a, [], ahora)).toBe(true);
    expect(seMuestraAhora(a, [ahora], ahora)).toBe(false);
    expect(seMuestraAhora(a, [], lima('2026-11-18T15:00:00'))).toBe(false);
  });
  it('estado para la lista', () => {
    const ahora2 = lima('2026-11-18T10:00:00');
    expect(estadoAnuncio({ activo: false, desde: null, hasta: null }, ahora2)).toBe('APAGADO');
    expect(estadoAnuncio({ activo: true, desde: lima('2026-11-19T00:00:00'), hasta: null }, ahora2)).toBe('PROGRAMADO');
    expect(estadoAnuncio({ activo: true, desde: null, hasta: lima('2026-11-17T00:00:00') }, ahora2)).toBe('VENCIDO');
    expect(estadoAnuncio({ activo: true, desde: null, hasta: null }, ahora2)).toBe('AL_AIRE');
  });
});

describe('AnunciosService', () => {
  const crearFila = (o: any = {}) => ({
    id: 1n, publico: 'AMBOS', roles: [], plantilla: 'NOVEDAD', titulo: 'Hola', texto: null, imagen_url: null,
    boton_texto: null, boton_enlace: null, detalle: null, color: 'CREMA', desde: null, hasta: null,
    franja_desde: null, franja_hasta: null, dias_semana: [], frecuencia: 'UNA_VEZ', veces_por_dia: 1, cada_horas: null,
    cierre_segundos: 8, puede_cerrar: true, prioridad: 0, activo: true, creado_por: null, actualizado_por: null,
    creado_en: new Date(), actualizado_en: new Date(), ...o,
  });
  let prisma: any;
  let auditoria: { registrar: jest.Mock };
  let svc: AnunciosService;
  const usuario: any = { partyId: 7n, rol: 'CAJERO', roles: ['CAJERO'], debeCambiar: false };
  const dto: any = { publico: 'PERSONAL', plantilla: 'COMUNICADO_INTERNO', titulo: ' Reunión ' };

  beforeEach(() => {
    prisma = {
      anuncio: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      anuncioVista: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
    };
    auditoria = { registrar: jest.fn() };
    svc = new AnunciosService(prisma, auditoria as any);
  });

  it('carta: solo vigentes y sin datos internos', async () => {
    prisma.anuncio.findMany.mockResolvedValue([crearFila({ id: 1n }), crearFila({ id: 2n, hasta: new Date('2020-01-01') })]);
    const r = await svc.vigentesCarta();
    expect(r.map((x) => x.id)).toEqual(['1']);
    expect(r[0]).not.toHaveProperty('creado_por');
    expect(r[0]).not.toHaveProperty('roles');
  });

  it('personal: filtra por rol y por lo que ya vio, máximo 3', async () => {
    prisma.anuncio.findMany.mockResolvedValue([
      crearFila({ id: 1n, roles: ['MOZO'] }), // no es su rol
      crearFila({ id: 2n }), // ya lo vio (UNA_VEZ)
      crearFila({ id: 3n }), crearFila({ id: 4n }), crearFila({ id: 5n }), crearFila({ id: 6n }),
    ]);
    prisma.anuncioVista.findMany.mockResolvedValue([{ anuncio_id: 2n, creado_en: new Date() }]);
    const r = await svc.vigentesPersonal(usuario);
    expect(r.map((x) => x.id)).toEqual(['3', '4', '5']);
    expect(prisma.anuncioVista.findMany.mock.calls[0][0].where.party_id).toBe(7n);
  });

  it('personal: un rol extra también cuenta', async () => {
    prisma.anuncio.findMany.mockResolvedValue([crearFila({ id: 1n, roles: ['MOZO'] })]);
    const r = await svc.vigentesPersonal({ ...usuario, roles: ['CAJERO', 'MOZO'] });
    expect(r).toHaveLength(1);
  });

  it('evento de personal guarda la persona; el de carta no guarda a nadie', async () => {
    prisma.anuncio.findFirst.mockResolvedValue({ id: 1n });
    await svc.eventoPersonal('1', 'ENTENDIDO', usuario);
    expect(prisma.anuncioVista.create).toHaveBeenLastCalledWith({ data: { anuncio_id: 1n, tipo: 'ENTENDIDO', origen: 'PERSONAL', party_id: 7n } });
    await svc.eventoCarta('1', 'VISTA', '1.1.1.1');
    expect(prisma.anuncioVista.create).toHaveBeenLastCalledWith({ data: { anuncio_id: 1n, tipo: 'VISTA', origen: 'CARTA' } });
  });

  it('evento: anuncio inexistente da 404 y la carta limita por IP', async () => {
    prisma.anuncio.findFirst.mockResolvedValue(null);
    await expect(svc.eventoPersonal('9', 'VISTA', usuario)).rejects.toBeInstanceOf(NotFoundException);
    prisma.anuncio.findFirst.mockResolvedValue({ id: 1n });
    for (let i = 0; i < 60; i++) await svc.eventoCarta('1', 'VISTA', '2.2.2.2');
    await expect(svc.eventoCarta('1', 'VISTA', '2.2.2.2')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.eventoCarta('1', 'VISTA', '3.3.3.3')).resolves.toEqual({ ok: true });
  });

  it('crear: guarda normalizado, con autor y auditoría', async () => {
    prisma.anuncio.create.mockResolvedValue(crearFila({ id: 5n }));
    prisma.anuncio.findUnique.mockResolvedValue(crearFila({ id: 5n }));
    await svc.crear({ ...dto, roles: ['CAJERO', 'CAJERO'] }, usuario, '1.1.1.1');
    const data = prisma.anuncio.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ titulo: 'Reunión', roles: ['CAJERO'], creado_por: 7n, activo: true, frecuencia: 'UNA_VEZ' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'anuncios', accion: 'CREAR', partyId: 7n }));
  });

  it('validaciones cruzadas', () => {
    const mal = (o: any) => expect(() => svc.armarDatos({ ...dto, ...o })).toThrow(BadRequestException);
    mal({ desde: '2026-11-18T10:00:00Z', hasta: '2026-11-18T09:00:00Z' });
    mal({ franja_desde: '07:00' });
    mal({ frecuencia: 'CADA_N_HORAS' });
    mal({ boton_texto: 'Ver' });
    mal({ plantilla: 'SOLO_IMAGEN' });
    mal({ puede_cerrar: false, cierre_segundos: 5 });
    mal({ desde: 'no-es-fecha' });
  });

  it('a los clientes siempre se les deja cerrar y la carta no lleva roles', () => {
    const d = svc.armarDatos({ ...dto, publico: 'CARTA', roles: ['MOZO'], puede_cerrar: false });
    expect(d.puede_cerrar).toBe(true);
    expect(d.roles).toEqual([]);
  });

  it('duplicar deja la copia apagada', async () => {
    prisma.anuncio.findUnique.mockResolvedValue(crearFila({ id: 1n, titulo: 'Promo' }));
    prisma.anuncio.create.mockResolvedValue(crearFila({ id: 2n }));
    await svc.duplicar('1', usuario);
    expect(prisma.anuncio.create.mock.calls[0][0].data).toMatchObject({ titulo: 'Promo (copia)', activo: false });
    expect(prisma.anuncio.create.mock.calls[0][0].data).not.toHaveProperty('id');
  });

  it('listar filtra por estado y trae estadísticas', async () => {
    prisma.anuncio.findMany.mockResolvedValue([crearFila({ id: 1n }), crearFila({ id: 2n, activo: false })]);
    prisma.anuncioVista.groupBy.mockResolvedValue([{ anuncio_id: 1n, tipo: 'VISTA', _count: { _all: 4 } }]);
    const r = await svc.listar({ estado: 'AL_AIRE' });
    expect(r).toHaveLength(1);
    expect(r[0].estadisticas).toEqual({ vistas: 4, cierres: 0, clics: 0, entendidos: 0 });
  });

  it('id inválido da 400', async () => {
    await expect(svc.obtener('abc')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Controladores: permisos', () => {
  const permisoDe = (metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, (AnunciosAdminController.prototype as any)[metodo]);
  it('el admin exige el permiso de cada acción', () => {
    expect(permisoDe('listar')).toEqual({ modulo: 'anuncios', accion: 'ver' });
    expect(permisoDe('obtener')).toEqual({ modulo: 'anuncios', accion: 'ver' });
    expect(permisoDe('vistaPrevia')).toEqual({ modulo: 'anuncios', accion: 'ver' });
    expect(permisoDe('crear')).toEqual({ modulo: 'anuncios', accion: 'crear' });
    expect(permisoDe('duplicar')).toEqual({ modulo: 'anuncios', accion: 'crear' });
    expect(permisoDe('actualizar')).toEqual({ modulo: 'anuncios', accion: 'editar' });
    expect(permisoDe('activar')).toEqual({ modulo: 'anuncios', accion: 'editar' });
    expect(permisoDe('eliminar')).toEqual({ modulo: 'anuncios', accion: 'eliminar' });
  });
  it('carta pública sin guard; personal con guard pero sin permiso de módulo', () => {
    expect(Reflect.getMetadata('__guards__', CartaAnunciosController)).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', PersonalAnunciosController)).toHaveLength(1);
    expect(Reflect.getMetadata(CLAVE_PERMISO, PersonalAnunciosController)).toBeUndefined();
  });
  it('los permisos existen en el catálogo y los controladores delegan en el servicio', async () => {
    const claves = PERMISOS.map((p) => `${p.modulo}/${p.accion}`);
    for (const a of ['ver', 'crear', 'editar', 'eliminar']) expect(claves).toContain(`anuncios/${a}`);
    const s: any = { vigentesPersonal: jest.fn().mockResolvedValue([]), eventoPersonal: jest.fn(), vigentesCarta: jest.fn(), eventoCarta: jest.fn() };
    const personal = new PersonalAnunciosController(s);
    await personal.vigentes({ usuario: { partyId: 1n } });
    expect(s.vigentesPersonal).toHaveBeenCalledWith({ partyId: 1n });
    new CartaAnunciosController(s).evento('3', { tipo: 'CLIC' }, { ip: '9.9.9.9' });
    expect(s.eventoCarta).toHaveBeenCalledWith('3', 'CLIC', '9.9.9.9');
  });
});
