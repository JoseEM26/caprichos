jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
  },
  JwtModule: {
    register: jest.fn().mockReturnValue({ module: class {} }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ClientesService, enmascararDoc, parsearCumpleanos } from './clientes.service';
import { CodigoRegistroService } from './codigo-registro.service';
import { AvisoCuentaService } from './aviso-cuenta.service';
import { PuntosService } from './puntos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { PayloadTooLargeException } from '@nestjs/common';

const tipoEsperado = (buf: Buffer): string => {
  if (buf[0] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89) return 'image/png';
  return 'image/webp';
};

describe('ClientesService', () => {
  let service: ClientesService;
  let prismaMock: any;
  let redisMock: any;
  let jwtMock: any;
  let auditoriaMock: any;
  let puntosMock: any;
  let archivosMock: any;
  let codigoRegistroMock: any;
  let avisoCuentaMock: any;

  beforeEach(async () => {
    prismaMock = {
      party: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      partyIdentifier: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      person: {
        create: jest.fn(),
        update: jest.fn(),
      },
      pedido: { groupBy: jest.fn().mockResolvedValue([]) },
      partyRole: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      customerDetail: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customerAccount: {
        create: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
      },
      contactMechanism: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      consent: {
        create: jest.fn(),
      },
      archivo: {
        findUnique: jest.fn(),
      },
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'terminos_version', valor: '2026-10-29' },
          { clave: 'privacidad_version', valor: '2026-10-30' },
        ]),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    const redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisClientMock),
    };

    jwtMock = {
      signAsync: jest.fn().mockResolvedValue('jwt_token_cliente_mock'),
      verifyAsync: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    puntosMock = {
      obtenerSaldo: jest.fn().mockResolvedValue(10),
    };

    codigoRegistroMock = { consumir: jest.fn().mockResolvedValue(undefined), exigirVerificado: jest.fn().mockResolvedValue(undefined), consumirVerificado: jest.fn().mockResolvedValue(undefined) };
    avisoCuentaMock = { avisar: jest.fn().mockResolvedValue(undefined) };

    archivosMock = {
      subirArchivo: jest.fn().mockResolvedValue({ id: '55', url: '/archivos/publico/2026/10/foto.webp' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: JwtService, useValue: jwtMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => def ?? 'test-secret'),
          },
        },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: PuntosService, useValue: puntosMock },
        { provide: ArchivosService, useValue: archivosMock },
        { provide: CodigoRegistroService, useValue: codigoRegistroMock },
        { provide: AvisoCuentaService, useValue: avisoCuentaMock },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
  });

  describe('listarAdmin: búsqueda por nombre y teléfono, sin DNI', () => {
    const rol = (id: number, nombres: string, tel: string) => ({
      id: BigInt(id),
      rol: 'CLIENTE',
      hasta: null,
      customer_detail: { puntos: 5, envio_tipo: null, envio_valor: null },
      party: {
        id: BigInt(id),
        estado: 'ACTIVO',
        tipo: 'PERSONA',
        usuario: null,
        persona: { nombres, apellidos: 'Test', correo: null, cumple_dia: null, cumple_mes: null },
        documentos: [],
        contactos: [{ tipo: 'TELEFONO', valor: tel }],
        pedidos: [],
        pedidosComoCliente: [],
        cuentaCliente: null as any,
        consentimientos: [] as any[],
      },
    });

    beforeEach(() => {
      prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([
        rol(1, 'Ana', '912345678'),
        rol(2, 'Luis', '987654321'),
      ]);
    });

    it('busca por teléfono parcial y nunca devuelve DNI', async () => {
      const res = await service.listarAdmin({ q: '9123' }, { rol: 'MOZO' });
      expect(res.items.map((i) => i.nombre)).toEqual(['Ana']);
      expect(res.items[0]).not.toHaveProperty('dni');
    });

    it('un número de documento ya no encuentra clientes', async () => {
      const res = await service.listarAdmin({ q: '45217890' }, { rol: 'ADMIN' });
      expect(res.items).toEqual([]);
    });

    it('busca sin distinguir tildes: «jose» encuentra José y «pena» encuentra Peña', async () => {
      prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([rol(1, 'José', '912345678'), rol(2, 'Peña', '987654321'), rol(3, 'Luis', '900000000')]);
      const a = await service.listarAdmin({ q: 'jose' }, { rol: 'MOZO' });
      expect(a.items.map((i) => i.nombre)).toEqual(['José']);
      const b = await service.listarAdmin({ q: 'PENA' }, { rol: 'MOZO' });
      expect(b.items.map((i) => i.nombre)).toEqual(['Peña']);
    });

    it('busca por nombre sin distinguir mayusculas', async () => {
      const res = await service.listarAdmin({ q: 'LUIS' }, { rol: 'MOZO' });
      expect(res.items.map((i) => i.nombre)).toEqual(['Luis']);
    });

    it('cuenta los pedidos cobrados por cliente_party_id y los de carta sin ese campo, no los de mozo ni anulados', async () => {
      prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([rol(1, 'Ana', '912345678')]);
      prismaMock.pedido.groupBy = jest.fn(async (a: any) =>
        a.by[0] === 'cliente_party_id'
          ? [{ cliente_party_id: 1n, _count: { _all: 2 }, _sum: { total: 30.5 }, _max: { creado_en: new Date('2026-11-01T15:00:00Z') } }]
          : [{ party_id: 1n, _count: { _all: 1 }, _sum: { total: 10 }, _max: { creado_en: new Date('2026-11-10T15:00:00Z') } }],
      );

      const res = await service.listarAdmin({}, { rol: 'ADMIN' });

      expect(res.items[0]).toMatchObject({ pedidos: 3, consumo: 40.5, ultimaCompra: '2026-11-10T15:00:00.000Z' });
      const [conCliente, enParty] = prismaMock.pedido.groupBy.mock.calls.map((c: any) => c[0].where);
      expect(conCliente).toMatchObject({ pago_estado: 'PAGADO', estado: { not: 'ANULADO' }, cliente_party_id: { not: null } });
      expect(enParty).toMatchObject({ pago_estado: 'PAGADO', estado: { not: 'ANULADO' }, canal: { in: ['CARTA', 'WHATSAPP', 'BOT'] }, cliente_party_id: null });
    });

    describe('filtros de compra, consumo, puntos, fechas y orden', () => {
      const dia = (n: number) => new Date(Date.now() - n * 86400000);
      beforeEach(() => {
        const p = (id: number, nombre: string, puntos: number, cumpleMes: number | null) => {
          const r: any = rol(id, nombre, `90000000${id}`);
          r.customer_detail.puntos = puntos;
          r.party.persona.cumple_mes = cumpleMes;
          r.party.persona.cumple_dia = cumpleMes ? 5 : null;
          return r;
        };
        // Nuevo: 1 pedido S/20 · Recurrente: 3 pedidos S/150 · Frecuente: 6 pedidos S/600 hace 90 días · Sin: ninguno
        const mesActual = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).slice(5, 7));
        prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([
          p(1, 'Nuevo', 0, null), p(2, 'Recurrente', 40, mesActual), p(3, 'Frecuente', 500, null), p(4, 'Sin', 10, null),
        ]);
        prismaMock.pedido.groupBy = jest.fn(async (a: any) =>
          a.by[0] === 'cliente_party_id'
            ? [
                { cliente_party_id: 1n, _count: { _all: 1 }, _sum: { total: 20 }, _max: { creado_en: dia(2) } },
                { cliente_party_id: 2n, _count: { _all: 3 }, _sum: { total: 150 }, _max: { creado_en: dia(10) } },
                { cliente_party_id: 3n, _count: { _all: 6 }, _sum: { total: 600 }, _max: { creado_en: dia(90) } },
              ]
            : [],
        );
      });
      const nombres = async (f: any) => (await service.listarAdmin({ limite: 50, ...f }, { rol: 'ADMIN' })).items.map((i) => i.nombre);

      it('recurrencia: nuevos (1), recurrentes (2+) y frecuentes (5+)', async () => {
        expect(await nombres({ pedidosMin: 1, pedidosMax: 1 })).toEqual(['Nuevo']);
        expect(await nombres({ pedidosMin: 2 })).toEqual(['Recurrente', 'Frecuente']);
        expect(await nombres({ pedidosMin: 5 })).toEqual(['Frecuente']);
        expect(await nombres({ pedidosMax: 0 })).toEqual(['Sin']);
      });
      it('consumo y puntos con mínimo y máximo', async () => {
        expect(await nombres({ consumoMin: 100, consumoMax: 200 })).toEqual(['Recurrente']);
        expect(await nombres({ puntosMin: 40 })).toEqual(['Recurrente', 'Frecuente']);
        expect(await nombres({ puntosMax: 10 })).toEqual(['Nuevo', 'Sin']);
        expect(await nombres({ conPuntos: 'no' })).toEqual(['Nuevo']);
        expect(await nombres({ conPuntos: 'si' })).toEqual(['Recurrente', 'Frecuente', 'Sin']);
      });
      it('dormidos: compraron alguna vez y su última compra fue hace más de N días', async () => {
        expect(await nombres({ sinCompraDias: 30 })).toEqual(['Frecuente']);
        expect(await nombres({ sinCompraDias: 5 })).toEqual(['Recurrente', 'Frecuente']);
      });
      it('cumpleaños este mes (Lima)', async () => {
        expect(await nombres({ cumpleMes: 'si' })).toEqual(['Recurrente']);
      });
      it('ordena por más compras, consumo, puntos, última compra y nombre', async () => {
        expect(await nombres({ orden: 'pedidos' })).toEqual(['Frecuente', 'Recurrente', 'Nuevo', 'Sin']);
        expect(await nombres({ orden: 'consumo' })).toEqual(['Frecuente', 'Recurrente', 'Nuevo', 'Sin']);
        expect(await nombres({ orden: 'puntos' })).toEqual(['Frecuente', 'Recurrente', 'Sin', 'Nuevo']);
        expect(await nombres({ orden: 'ultima' })).toEqual(['Nuevo', 'Recurrente', 'Frecuente', 'Sin']);
        expect(await nombres({ orden: 'nombre' })).toEqual(['Frecuente', 'Nuevo', 'Recurrente', 'Sin']);
      });
      it('con rango, filtra los pedidos por fecha de Lima y la última compra sigue siendo la de siempre', async () => {
        await service.listarAdmin({ desde: '2026-11-01', hasta: '2026-11-30' }, { rol: 'ADMIN' });
        const w = prismaMock.pedido.groupBy.mock.calls[0][0].where;
        expect(w.creado_en).toEqual({ gte: new Date('2026-11-01T05:00:00.000Z'), lte: new Date('2026-12-01T04:59:59.999Z') });
        // segunda pareja de consultas = historial sin rango
        expect(prismaMock.pedido.groupBy.mock.calls[2][0].where.creado_en).toBeUndefined();
      });
      it('canal: solo cuentan los pedidos de ese canal (WhatsApp incluye al bot)', async () => {
        await service.listarAdmin({ canal: 'WHATSAPP' }, { rol: 'ADMIN' });
        const [a, b] = prismaMock.pedido.groupBy.mock.calls.map((c: any) => c[0].where);
        expect(a.canal).toEqual({ in: ['WHATSAPP', 'BOT'] });
        expect(b.canal).toEqual({ in: ['WHATSAPP', 'BOT'] });
      });
      it('paginación: 24 por defecto', async () => {
        const r = await service.listarAdmin({}, { rol: 'ADMIN' });
        expect(r).toMatchObject({ total: 4, pagina: 1, paginas: 1 });
        const r2 = await service.listarAdmin({ limite: 2, pagina: 2 }, { rol: 'ADMIN' });
        expect(r2.items).toHaveLength(2);
        expect(r2.paginas).toBe(2);
      });
    });

    describe('exportar y sorteo', () => {
      beforeEach(() => {
        const r: any = rol(1, 'María García López', '987654321');
        r.party.persona.apellidos = null;
        const sinCel: any = rol(2, 'Sin Celular', '—');
        prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([r, sinCel]);
      });
      it('exportar: solo ADMIN, devuelve un .xlsx real y audita filtros y cantidad sin datos personales', async () => {
        await expect(service.exportarAdmin({}, { rol: 'CAJERO' })).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
        expect(auditoriaMock.registrar).not.toHaveBeenCalled();
        const r = await service.exportarAdmin({ pedidosMin: 0, pagina: 3, limite: 24 }, { rol: 'ADMIN', partyId: 7n }, '1.1.1.1');
        expect(Buffer.from(r.archivo.slice(0, 2)).toString()).toBe('PK');
        expect(r.nombre).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(r.filas).toBe(2);
        const reg = auditoriaMock.registrar.mock.calls[0][0];
        expect(reg).toMatchObject({ modulo: 'clientes', accion: 'EXPORTAR_CLIENTES', despues: { filtros: { pedidosMin: 0 }, filas: 2 } });
        expect(JSON.stringify(reg, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toMatch(/987654321|María|García/);
      });
      it('participantes: «María G.» y «···321»; nunca nombre completo ni celular; sin celular no entran', async () => {
        const r = await service.participantesSorteo({});
        expect(r).toEqual({ total: 1, participantes: [{ id: '1', nombre: 'María G.', detalle: '···321' }] });
        expect(JSON.stringify(r)).not.toMatch(/987654321|López|Test/);
      });
      it('participantes: con apellidos separados toma la inicial del primer apellido', async () => {
        const r2: any = rol(3, 'Ana', '911222333');
        r2.party.persona.apellidos = 'Quispe Rojas';
        prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([r2]);
        expect((await service.participantesSorteo({})).participantes[0].nombre).toBe('Ana Q.');
      });
    });

    describe('verificación del celular', () => {
      const nov = new Date('2026-11-05T12:00:00Z');
      const con = (id: number, nombre: string, party: any, puntos = 5) => {
        const r = rol(id, nombre, `9000000${id}0`);
        return { ...r, customer_detail: { ...r.customer_detail, puntos }, party: { ...r.party, ...party } };
      };
      beforeEach(() => {
        prismaMock.partyRole.findMany = jest.fn().mockResolvedValue([
          con(1, 'Verificada', { cuentaCliente: { hash: 'x', activo: true, clave_cambiada_en: null }, consentimientos: [{ canal: 'CARTA', aceptado_en: nov }] }),
          con(2, 'Mostrador', { cuentaCliente: { hash: null, activo: true, clave_cambiada_en: null }, consentimientos: [{ canal: 'CAJA', aceptado_en: nov }] }),
          con(3, 'SinSaldo', { cuentaCliente: { hash: 'x', activo: true, clave_cambiada_en: nov }, consentimientos: [] }, 0),
          con(4, 'Antigua', { cuentaCliente: { hash: 'x', activo: true, clave_cambiada_en: null }, consentimientos: [] }),
        ]);
      });

      it('devuelve los campos de verificación sin el hash y los contadores', async () => {
        const res = await service.listarAdmin({ limite: 50 }, { rol: 'ADMIN' });
        const por = Object.fromEntries(res.items.map((i) => [i.nombre, i]));
        expect(por.Verificada).toMatchObject({ verificado: true, verificadoEn: nov.toISOString(), tieneContrasena: true, puedeGastarPuntos: true });
        expect(por.Mostrador).toMatchObject({ verificado: false, razonSinVerificar: 'MOSTRADOR', puedeGastarPuntos: false });
        expect(por.SinSaldo).toMatchObject({ verificado: true, puedeGastarPuntos: false });
        expect(por.Antigua).toMatchObject({ verificado: false, estadoVerificacion: 'ANTIGUA', puedeGastarPuntos: true });
        expect(JSON.stringify(res)).not.toContain('"hash"');
        expect(res.contadores).toEqual({ verificados: 2, sinVerificar: 2, gastanPuntos: 2 });
      });

      it('filtra por verificados, sin verificar y gastaPuntos, sobre la misma consulta', async () => {
        const nombres = async (f: any) => (await service.listarAdmin({ limite: 50, ...f }, { rol: 'ADMIN' })).items.map((i) => i.nombre);
        expect(await nombres({ verificacion: 'verificados' })).toEqual(['Verificada', 'SinSaldo']);
        expect(await nombres({ verificacion: 'sin_verificar' })).toEqual(['Mostrador', 'Antigua']);
        expect(await nombres({ verificacion: 'todos' })).toHaveLength(4);
        expect(await nombres({ gastaPuntos: 'si' })).toEqual(['Verificada', 'Antigua']);
        expect(await nombres({ verificacion: 'verificados', gastaPuntos: 'si' })).toEqual(['Verificada']);
      });
    });

    it('sin coincidencias devuelve lista vacía', async () => {
      const res = await service.listarAdmin({ q: '99999999' }, { rol: 'MOZO' });
      expect(res.items).toEqual([]);
    });
  });

  describe('obtenerFichaAdmin: pedidos del cliente', () => {
    it('lee los pedidos con la regla del listado (cliente_party_id, o carta/WhatsApp/bot sin ese campo) y suma solo los pagados', async () => {
      prismaMock.party.findUnique = jest.fn().mockResolvedValue({
        id: 5n,
        persona: { nombres: 'Ana', correo: null, cumple_dia: null, cumple_mes: null },
        documentos: [],
        contactos: [],
        roles: [],
        estado: 'ACTIVO',
        cuentaCliente: { hash: 'x', activo: true, clave_cambiada_en: new Date('2026-11-05T12:00:00Z') },
        consentimientos: [],
      });
      prismaMock.pedido = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 77n,
            codigo: 'CP-077',
            modalidad: 'MESA',
            estado: 'ENTREGADO',
            total: '25.50',
            pago_estado: 'PAGADO',
            creado_en: new Date('2026-10-29T15:00:00Z'),
          },
        ]),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { total: '45.50' } }),
      };

      const ficha = await service.obtenerFichaAdmin('5', { rol: 'MOZO' });

      const where = prismaMock.pedido.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { cliente_party_id: 5n },
        { party_id: 5n, canal: { in: ['CARTA', 'WHATSAPP', 'BOT'] }, cliente_party_id: null },
      ]);
      expect(prismaMock.pedido.aggregate.mock.calls[0][0].where).toMatchObject({ pago_estado: 'PAGADO' });
      expect(ficha.pedidosPagados).toBe(2);
      expect(ficha.totalGastado).toBe(45.5);
      expect(ficha).toMatchObject({ verificado: true, verificadoEn: '2026-11-05T12:00:00.000Z', tieneContrasena: true });
      expect(ficha).toHaveProperty('puedeGastarPuntos');
      expect(JSON.stringify(ficha)).not.toContain('"hash"');
      expect(ficha.pedidos[0]).toMatchObject({ id: 'CP-077', pago: 'Cobrado', total: 's/ 25.50' });
    });
  });

  describe('utilidades', () => {
    it('enmascararDoc enmascara DNI mostrando primeros 4 dígitos y ****', () => {
      expect(enmascararDoc('45217890')).toBe('4521****');
      expect(enmascararDoc('20601234567')).toBe('2060******7');
    });

    it('parsearCumpleanos reconoce formatos YYYY-MM-DD y DD/MM', () => {
      expect(parsearCumpleanos('1995-03-14')).toEqual({ dia: 14, mes: 3 });
      expect(parsearCumpleanos('14/03')).toEqual({ dia: 14, mes: 3 });
      expect(parsearCumpleanos('invalido')).toBeNull();
    });
  });

  describe('registro por teléfono (sin DNI)', () => {
    const dtoOk = {
      nombre: 'Ana Pérez',
      contrasena: 'ClaveSegura2026',
      telefono: '912345678',
      cumpleanos: '14/03',
      aceptaDatos: true as const,
    };
    const ficha = () =>
      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana Pérez', correo: null, cumple_dia: null, cumple_mes: null },
        contactos: [{ tipo: 'TELEFONO', valor: '912345678' }],
        cuentaCliente: { telefono: '912345678' },
        roles: [],
      });

    beforeEach(() => {
      prismaMock.customerAccount.findFirst = jest.fn().mockResolvedValue(null);
      prismaMock.person.findUnique = jest.fn();
      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 100n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 1n });
    });

    it('crea la cuenta con teléfono y contraseña, con consentimiento y sin tocar party_identifier', async () => {
      ficha();
      const res = await service.registro({ ...dtoOk, cumpleanos: '1995-03-14' });

      expect(res.token).toBe('jwt_token_cliente_mock');
      expect(res.cliente.nombre).toBe('Ana Pérez');
      expect(res.cliente.telefono).toBe('912345678');
      expect(res.cliente).not.toHaveProperty('dniMascara');
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ telefono: '912345678', hash: expect.stringContaining('argon2') }),
        }),
      );
      expect(prismaMock.consent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ canal: 'CARTA', version_texto: 'celular-v1|T:2026-10-29|P:2026-10-30' }),
        }),
      );
      expect(prismaMock.consent.create.mock.calls[0][0].data.version_texto).not.toMatch(/dni/i);
      // la auditoría no lleva la contraseña ni el teléfono completo
      const aud = JSON.stringify(auditoriaMock.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      expect(aud).not.toContain('ClaveSegura2026');
      expect(aud).not.toContain('912345678');
    });

    it('acepta el celular con prefijo 51 y lo guarda de 9 dígitos', async () => {
      ficha();
      await service.registro({ ...dtoOk, telefono: '+51 912 345 678' });
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ telefono: '912345678' }) }),
      );
    });

    it('cumpleaños es opcional', async () => {
      ficha();
      await expect(service.registro(dtoOk)).resolves.toBeDefined();
    });

    it('exige nombre de 2 letras y cumpleaños válido, sin crear nada si fallan', async () => {
      await expect(service.registro({ ...dtoOk, nombre: 'A' })).rejects.toMatchObject({ response: { codigo: 'NOMBRE_REQUERIDO' } });
      await expect(service.registro({ ...dtoOk, cumpleanos: undefined })).rejects.toMatchObject({ response: { codigo: 'CUMPLEANOS_REQUERIDO' } });
      await expect(service.registro({ ...dtoOk, cumpleanos: '31/02' })).rejects.toMatchObject({ response: { codigo: 'FECHA_INVALIDA' } });
      expect(prismaMock.party.create).not.toHaveBeenCalled();
    });

    it('rechaza teléfono inválido, contraseña corta y falta de consentimiento', async () => {
      await expect(service.registro({ ...dtoOk, telefono: '812345678' })).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
      await expect(service.registro({ ...dtoOk, contrasena: 'corta' })).rejects.toMatchObject({ response: { codigo: 'CONTRASENA_CORTA' } });
      await expect(service.registro({ ...dtoOk, aceptaDatos: false as any })).rejects.toMatchObject({
        response: { codigo: 'CONSENTIMIENTO_REQUERIDO' },
      });
      expect(prismaMock.party.create).not.toHaveBeenCalled();
    });

    it('rechaza un teléfono que ya tiene cuenta con contraseña (409) sin crear nada', async () => {
      prismaMock.customerAccount.findFirst
        .mockResolvedValueOnce(null) // desactivada
        .mockResolvedValueOnce({ id: 1n, party_id: 9n, hash: '$argon2id$x', activo: true });
      await expect(service.registro(dtoOk)).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REGISTRADO' }, status: 409 });
      expect(prismaMock.party.create).not.toHaveBeenCalled();
    });

    it('no reactiva una cuenta desactivada con ese teléfono', async () => {
      prismaMock.customerAccount.findFirst.mockResolvedValueOnce({ id: 1n });
      await expect(service.registro(dtoOk)).rejects.toMatchObject({ response: { codigo: 'TELEFONO_NO_DISPONIBLE' } });
    });

    it('vincula una cuenta de mostrador sin contraseña en vez de duplicar', async () => {
      ficha();
      prismaMock.customerAccount.findFirst
        .mockResolvedValueOnce(null) // desactivada
        .mockResolvedValueOnce({ id: 1n, party_id: 77n, hash: null, activo: true });
      prismaMock.person.findUnique.mockResolvedValue({ party_id: 77n, correo: null });
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 5n, customer_detail: { party_role_id: 5n } });

      await service.registro(dtoOk);

      expect(prismaMock.party.create).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { party_id: 77n }, update: expect.objectContaining({ telefono: '912345678' }) }),
      );
    });

    it('vincula un party con ese teléfono y sin cuenta (identificado antes por WhatsApp)', async () => {
      ficha();
      prismaMock.contactMechanism.findFirst
        .mockResolvedValueOnce(null) // cuentaPorCelular: ninguna cuenta
        .mockResolvedValueOnce({ party_id: 88n }) // party suelto por contacto
        .mockResolvedValue(null);
      prismaMock.person.findUnique.mockResolvedValue(null);
      prismaMock.partyRole.findFirst.mockResolvedValue(null);
      prismaMock.partyRole.create.mockResolvedValue({ id: 6n });

      await service.registro(dtoOk);

      expect(prismaMock.party.create).not.toHaveBeenCalled();
      expect(prismaMock.person.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ party_id: 88n }) }));
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { party_id: 88n } }));
    });

    it('party con 120 puntos (acumulados por celular): se vincula el MISMO party, sin party nuevo ni tocar sus puntos', async () => {
      ficha();
      prismaMock.contactMechanism.findFirst
        .mockResolvedValueOnce(null) // cuentaPorCelular
        .mockResolvedValueOnce({ party_id: 88n, party: { usuario: null } })
        .mockResolvedValue(null);
      prismaMock.person.findUnique.mockResolvedValue({ party_id: 88n, nombres: 'Cliente', correo: null });
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 6n, customer_detail: { party_role_id: 6n, puntos: 120 } });

      await service.registro({ ...dtoOk, telefono: '+51 912 345 678' });

      expect(prismaMock.party.create).not.toHaveBeenCalled();
      expect(prismaMock.partyRole.create).not.toHaveBeenCalled();
      expect(prismaMock.customerDetail.create).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { party_id: 88n } }));
      expect(codigoRegistroMock.consumirVerificado).toHaveBeenCalledWith('912345678');
    });

    it('party de un integrante del personal con puntos: se vincula y no se pisa su nombre', async () => {
      ficha();
      prismaMock.contactMechanism.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ party_id: 90n, party: { usuario: { party_id: 90n } } })
        .mockResolvedValue(null);
      prismaMock.person.findUnique.mockResolvedValue({ party_id: 90n, nombres: 'Rosa Quispe', correo: null });
      prismaMock.partyRole.findFirst.mockResolvedValue({ id: 7n, customer_detail: { party_role_id: 7n } });

      await service.registro(dtoOk);

      expect(prismaMock.party.create).not.toHaveBeenCalled();
      expect(prismaMock.person.update.mock.calls[0][0].data.nombres).toBeUndefined();
      expect(prismaMock.customerAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { party_id: 90n } }));
    });

    it('si crear la cuenta falla, la verificación del celular NO se gasta (puede reintentar)', async () => {
      ficha();
      prismaMock.$transaction.mockRejectedValueOnce(new Error('boom'));
      await expect(service.registro(dtoOk)).rejects.toThrow('boom');
      expect(codigoRegistroMock.consumirVerificado).not.toHaveBeenCalled();
    });

    it('sin celular verificado no crea ni vincula nada (CELULAR_NO_VERIFICADO se propaga)', async () => {
      ficha();
      codigoRegistroMock.exigirVerificado.mockRejectedValueOnce(
        new BadRequestException({ codigo: 'CELULAR_NO_VERIFICADO', mensaje: 'Primero confirma tu celular con el código que llega por WhatsApp.' }),
      );
      await expect(service.registro(dtoOk)).rejects.toMatchObject({ response: { codigo: 'CELULAR_NO_VERIFICADO' } });
      expect(codigoRegistroMock.exigirVerificado).toHaveBeenCalledWith('912345678');
      expect(prismaMock.party.create).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
    });

    it('con DNI válido lo guarda como DNI del party de la cuenta', async () => {
      ficha();
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      await service.registro({ ...dtoOk, dni: '12345678' });
      expect(prismaMock.partyIdentifier.create).toHaveBeenCalledWith({
        data: { party_id: 100n, tipo: 'DNI', numero: '12345678' },
      });
    });

    it('DNI con formato inválido responde DNI_INVALIDO sin crear nada', async () => {
      await expect(service.registro({ ...dtoOk, dni: '1234567' })).rejects.toMatchObject({ response: { codigo: 'DNI_INVALIDO' } });
      expect(prismaMock.party.create).not.toHaveBeenCalled();
    });

    it('DNI ya usado por otra persona se ignora sin error y el registro sigue', async () => {
      ficha();
      prismaMock.partyIdentifier.findFirst.mockResolvedValue({ id: 9n, party_id: 555n });
      await expect(service.registro({ ...dtoOk, dni: '12345678' })).resolves.toBeDefined();
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();
    });

    it('sin DNI (vacío) el registro funciona igual y no toca party_identifier', async () => {
      ficha();
      await expect(service.registro({ ...dtoOk, dni: '  ' })).resolves.toBeDefined();
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();
    });

    it('una carrera por el mismo teléfono (índice único) responde 409', async () => {
      prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
      await expect(service.registro(dtoOk)).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REGISTRADO' } });
    });
  });

  describe('foto de perfil', () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP')]);
    const archivoFile = (buffer: Buffer, mimetype: string) => ({ buffer, size: buffer.length, mimetype, originalname: 'foto.png' }) as any;

    beforeEach(() => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue({ id: 100n, persona: { nombres: 'Ana', foto_archivo_id: 55n }, documentos: [], contactos: [], roles: [] });
      prismaMock.archivo.findUnique.mockResolvedValue({ id: 55n, ruta: 'publico/2026/10/foto.webp' });
    });

    it('acepta JPEG, PNG y WebP, verificados por bytes, y enlaza la foto a la persona de la sesión', async () => {
      for (const buf of [JPEG, PNG, WEBP]) {
        archivosMock.subirArchivo.mockClear();
        await service.subirFoto(100n, archivoFile(buf, 'image/png'), '127.0.0.1');
        expect(archivosMock.subirArchivo).toHaveBeenCalledWith(expect.objectContaining({ mimetype: tipoEsperado(buf) }), false, expect.objectContaining({ partyId: 100n }), '127.0.0.1');
      }
      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { foto_archivo_id: 55n } });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_FOTO_SUBIDA', partyId: 100n }));
    });

    it('rechaza un archivo que dice ser PNG o JPEG pero no tiene bytes de imagen', async () => {
      const texto = Buffer.from('<html>no soy una imagen</html>');
      await expect(service.subirFoto(100n, archivoFile(texto, 'image/png'))).rejects.toThrow(BadRequestException);
      await expect(service.subirFoto(100n, archivoFile(texto, 'image/jpeg'))).rejects.toThrow(BadRequestException);
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });

    it('rechaza una foto de más de 2 MB con 413', async () => {
      const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      await expect(service.subirFoto(100n, archivoFile(grande, 'image/png'))).rejects.toThrow(PayloadTooLargeException);
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
    });

    it('quitar foto desvincula la foto sin tocar el archivo', async () => {
      await service.quitarFoto(100n);
      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { foto_archivo_id: null } });
      expect(prismaMock.archivo).not.toHaveProperty('delete');
      expect(archivosMock.subirArchivo).not.toHaveBeenCalled();
    });

    it('yo devuelve fotoUrl con la ruta pública del archivo, y null sin foto', async () => {
      const conFoto = await service.yo(100n);
      expect(conFoto?.fotoUrl).toBe('/archivos/publico/2026/10/foto.webp');

      prismaMock.party.findUnique.mockResolvedValueOnce({ id: 101n, persona: { nombres: 'Luis', foto_archivo_id: null }, documentos: [], contactos: [], roles: [] });
      const sinFoto = await service.yo(101n);
      expect(sinFoto?.fotoUrl).toBeNull();
    });
  });

  describe('teléfono y perfil de la cuenta', () => {
    const cuentaYo = (extra: any = {}) => ({
      id: 100n,
      persona: { nombres: 'Ana Pérez' },
      contactos: [],
      cuentaCliente: { telefono: '912345678' },
      roles: [],
      ...extra,
    });

    it('yo devuelve el celular de la cuenta, o el contacto, o null', async () => {
      prismaMock.party.findUnique.mockResolvedValueOnce(cuentaYo());
      expect((await service.yo(100n))?.telefono).toBe('912345678');

      prismaMock.party.findUnique.mockResolvedValueOnce(
        cuentaYo({ cuentaCliente: null, contactos: [{ tipo: 'CORREO', valor: 'a@b.com' }, { tipo: 'TELEFONO', valor: '987654321' }] }),
      );
      expect((await service.yo(100n))?.telefono).toBe('987654321');

      prismaMock.party.findUnique.mockResolvedValueOnce(cuentaYo({ cuentaCliente: null }));
      expect((await service.yo(100n))?.telefono).toBeNull();
    });

    it('actualizarPerfil guarda nombre, correo y cumpleaños, y audita', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue(cuentaYo());

      await service.actualizarPerfil(100n, {
        nombre: 'Ana Pérez Gil',
        correo: 'ana.nueva@ejemplo.com',
        cumpleanos: '14/03',
      }, '127.0.0.1');

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { party_id: 100n },
        data: { nombres: 'Ana Pérez Gil', correo: 'ana.nueva@ejemplo.com', cumple_dia: 14, cumple_mes: 3 },
      });
      expect(prismaMock.contactMechanism.update).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_PERFIL_EDITADO', partyId: 100n }));
    });

    it('actualizarPerfil nunca cambia la contraseña aunque se envíe', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue(cuentaYo());

      await service.actualizarPerfil(100n, { nombre: 'Ana Pérez', contrasena: 'OtraClave2026' } as any);

      const datos = prismaMock.person.update.mock.calls[0][0].data;
      expect(datos).not.toHaveProperty('contrasena');
      expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.updateMany).not.toHaveBeenCalled();
    });

    it('actualizarPerfil agrega el DNI opcional si la cuenta no tiene uno; vacío no cambia nada; inválido responde DNI_INVALIDO', async () => {
      prismaMock.party.findUnique.mockResolvedValue(cuentaYo());
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);

      await service.actualizarPerfil(100n, { nombre: 'Ana Pérez', dni: '11111111' });
      expect(prismaMock.partyIdentifier.create).toHaveBeenCalledWith({ data: { party_id: 100n, tipo: 'DNI', numero: '11111111' } });

      prismaMock.partyIdentifier.create.mockClear();
      await service.actualizarPerfil(100n, { nombre: 'Ana Pérez', dni: '' });
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();

      await expect(service.actualizarPerfil(100n, { nombre: 'Ana Pérez', dni: '123' })).rejects.toMatchObject({
        response: { codigo: 'DNI_INVALIDO' },
      });
    });

    it('actualizarPerfil rechaza nombre corto, correo inválido y cumpleaños inválido', async () => {
      await expect(service.actualizarPerfil(100n, { nombre: 'Al' })).rejects.toThrow(BadRequestException);
      await expect(service.actualizarPerfil(100n, { correo: 'sin-arroba' })).rejects.toThrow(BadRequestException);
      await expect(service.actualizarPerfil(100n, { cumpleanos: '32/13' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });

    it('actualizarPerfil con correo vacío quita el correo', async () => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue(cuentaYo());

      await service.actualizarPerfil(100n, { correo: '' });

      expect(prismaMock.person.update).toHaveBeenCalledWith({ where: { party_id: 100n }, data: { correo: null } });
    });
  });

  describe('ingresar por teléfono', () => {
    const fichaYo = () =>
      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana Pérez', correo: null, cumple_dia: 14, cumple_mes: 3 },
        contactos: [],
        cuentaCliente: { telefono: '912345678' },
        roles: [],
      });
    const credencialesInvalidas = { response: { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Celular o contraseña incorrectos.' } };

    beforeEach(() => {
      prismaMock.customerAccount.findFirst = jest.fn();
    });

    it('ingresa con celular y contraseña correctos y retorna token', async () => {
      const hash = await argon2.hash('ClaveValida123');
      prismaMock.customerAccount.findFirst.mockResolvedValue({ party_id: 100n, hash, activo: true });
      fichaYo();

      const res = await service.ingresar({ telefono: '912345678', contrasena: 'ClaveValida123' });

      expect(res.token).toBe('jwt_token_cliente_mock');
      expect(res.cliente.nombre).toBe('Ana Pérez');
      expect(prismaMock.customerAccount.findFirst).toHaveBeenCalledWith({ where: { telefono: '912345678', activo: true } });
    });

    it('contraseña errónea y teléfono sin cuenta responden exactamente lo mismo y suman intentos', async () => {
      const hash = await argon2.hash('ClaveCorrecta');
      prismaMock.customerAccount.findFirst.mockResolvedValueOnce({ party_id: 100n, hash, activo: true });
      await expect(service.ingresar({ telefono: '912345678', contrasena: 'ClaveEquivocada' })).rejects.toMatchObject(credencialesInvalidas);

      prismaMock.customerAccount.findFirst.mockResolvedValueOnce(null);
      await expect(service.ingresar({ telefono: '955555555', contrasena: 'ClaveEquivocada' })).rejects.toMatchObject(credencialesInvalidas);

      expect(redisMock.obtenerCliente().incr).toHaveBeenCalledTimes(2);
    });

    it('una cuenta de mostrador sin contraseña no entra: ya no se crea la clave al ingresar', async () => {
      prismaMock.customerAccount.findFirst.mockResolvedValue({ party_id: 100n, hash: null, activo: true });
      await expect(service.ingresar({ telefono: '912345678', contrasena: 'PrimeraClave2026' })).rejects.toMatchObject(credencialesInvalidas);
      expect(prismaMock.customerAccount.upsert).not.toHaveBeenCalled();
    });

    it('al quinto fallo se audita el bloqueo; con 5 intentos ya no verifica', async () => {
      const hash = await argon2.hash('ClaveCorrecta');
      const redis = redisMock.obtenerCliente();
      prismaMock.customerAccount.findFirst.mockResolvedValue({ party_id: 100n, hash, activo: true });

      redis.incr.mockResolvedValueOnce(5);
      await expect(service.ingresar({ telefono: '912345678', contrasena: 'mala-mala' })).rejects.toBeDefined();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_INGRESO_BLOQUEADO' }));
      expect(JSON.stringify(auditoriaMock.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('912345678');

      redis.get.mockResolvedValueOnce('5');
      prismaMock.customerAccount.findFirst.mockClear();
      await expect(service.ingresar({ telefono: '912345678', contrasena: 'ClaveCorrecta' })).rejects.toMatchObject({
        response: { codigo: 'CREDENCIALES_INVALIDAS' },
      });
      expect(prismaMock.customerAccount.findFirst).not.toHaveBeenCalled();
    });

    it('un DNI ya no sirve como usuario', async () => {
      await expect(service.ingresar({ telefono: '45217890', contrasena: 'ClaveValida123' })).rejects.toMatchObject(credencialesInvalidas);
    });
  });

  describe('sesión del cliente (clienteDesdeRequest)', () => {
    const req = { cookies: { cp_cliente: 'tok' }, headers: {} } as any;
    beforeEach(() => {
      prismaMock.customerAccount.findUnique = jest.fn();
      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana' },
        contactos: [],
        cuentaCliente: { telefono: '912345678' },
        roles: [],
      });
    });

    it('vale una sesión emitida después del último cambio de contraseña', async () => {
      jwtMock.verifyAsync.mockResolvedValue({ partyId: '100', iat: 2000 });
      prismaMock.customerAccount.findUnique.mockResolvedValue({ activo: true, clave_cambiada_en: new Date(1_000_000) });
      expect((await service.clienteDesdeRequest(req))?.partyId).toBe('100');
    });

    it('no vale una sesión anterior al cambio de contraseña ni la de una cuenta desactivada', async () => {
      jwtMock.verifyAsync.mockResolvedValue({ partyId: '100', iat: 500 });
      prismaMock.customerAccount.findUnique.mockResolvedValue({ activo: true, clave_cambiada_en: new Date(1_000_000) });
      expect(await service.clienteDesdeRequest(req)).toBeNull();

      jwtMock.verifyAsync.mockResolvedValue({ partyId: '100', iat: 5000 });
      prismaMock.customerAccount.findUnique.mockResolvedValue({ activo: false, clave_cambiada_en: null });
      expect(await service.clienteDesdeRequest(req)).toBeNull();
    });
  });

  describe('perfil: el celular es la identidad', () => {
    beforeEach(() => {
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.party.findUnique.mockResolvedValue({
        id: 100n,
        persona: { nombres: 'Ana' },
        contactos: [],
        cuentaCliente: { telefono: '912345678' },
        roles: [],
      });
    });

    it('rechaza cambiar el celular pero acepta reenviar el mismo', async () => {
      await expect(service.actualizarPerfil(100n, { telefono: '987654321' })).rejects.toMatchObject({
        response: { codigo: 'TELEFONO_NO_EDITABLE' },
      });
      await expect(service.actualizarPerfil(100n, { nombre: 'Ana María', telefono: '912345678' })).resolves.toBeDefined();
    });
  });

  describe('registro en mostrador (RQ-CLI-01-06)', () => {
    beforeEach(() => {
      prismaMock.customerAccount.findFirst = jest.fn().mockResolvedValue(null);
      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 105n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 2n });
    });

    it('crea cliente con celular, hash=null y sin DNI, para que cree contraseña al registrarse', async () => {
      const res = await service.crearEnMostrador({
        nombre: 'Pedro Local',
        telefono: '912345678',
        cumpleanos: '1990-10-15',
        aceptaDatos: true,
      });

      expect(res.nombre).toBe('Pedro Local');
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();
      expect(prismaMock.customerAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ hash: null, telefono: '912345678' }) }),
      );
    });

    it('exige celular para una persona y rechaza uno repetido', async () => {
      await expect(
        service.crearEnMostrador({ nombre: 'Pedro Local', cumpleanos: '1990-10-15', aceptaDatos: true }),
      ).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });

      prismaMock.customerAccount.findFirst.mockResolvedValue({ id: 1n });
      await expect(
        service.crearEnMostrador({ nombre: 'Pedro Local', telefono: '912345678', cumpleanos: '1990-10-15', aceptaDatos: true }),
      ).rejects.toMatchObject({ response: { codigo: 'CLIENTE_YA_EXISTE' } });
    });

    it('una empresa lleva RUC y no exige celular', async () => {
      prismaMock.partyIdentifier.findFirst.mockResolvedValue(null);
      await service.crearEnMostrador({ nombre: 'Empresa SAC', ruc: '20601234567', aceptaDatos: true });
      expect(prismaMock.partyIdentifier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'RUC', numero: '20601234567' }),
      });
    });
  });
  describe('cuenta creada desde el bot (sin contraseña)', () => {
    beforeEach(() => {
      prismaMock.customerAccount.findFirst = jest.fn().mockResolvedValue(null);
      prismaMock.contactMechanism.findFirst.mockResolvedValue(null);
      prismaMock.party.create.mockResolvedValue({ id: 301n });
      prismaMock.partyRole.create.mockResolvedValue({ id: 3n });
    });

    it('crea con hash null, consentimiento BOT versionado y auditoría', async () => {
      const r = await service.crearCuentaDesdeBot('51912345678', '  Ana   Pérez ');
      expect(r).toEqual({ partyId: '301', primerNombre: 'Ana' });
      expect(prismaMock.customerAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ hash: null, telefono: '912345678', activo: true }),
      });
      expect(prismaMock.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ canal: 'BOT', version_texto: 'celular-v1|T:2026-10-29|P:2026-10-30' }),
      });
      expect(prismaMock.partyIdentifier.create).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_CREADO_BOT' }));
    });

    it('rechaza celular inválido, nombre corto y celular ya registrado', async () => {
      await expect(service.crearCuentaDesdeBot('123', 'Ana')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
      await expect(service.crearCuentaDesdeBot('912345678', 'A')).rejects.toMatchObject({ response: { codigo: 'NOMBRE_REQUERIDO' } });
      prismaMock.customerAccount.findFirst.mockResolvedValue({ id: 1n });
      await expect(service.crearCuentaDesdeBot('912345678', 'Ana')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REGISTRADO' } });
    });
  });
});
