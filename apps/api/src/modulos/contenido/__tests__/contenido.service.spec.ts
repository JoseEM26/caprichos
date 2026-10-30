jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
    emitirPublico = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Test, TestingModule } from '@nestjs/testing';
import { ContenidoService } from '../contenido.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { CrearNovedadDto } from '../contenido.dto';

describe('ContenidoService', () => {
  let service: ContenidoService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  const mockUsuario = {
    partyId: BigInt(10),
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      versionCarta: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      novedad: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      novedadFoto: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      destacada: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      destacadaFoto: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      rankingMes: {
        findMany: jest.fn(),
      },
      mensajeCarta: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      archivo: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      categoria: {
        findMany: jest.fn(),
      },
      producto: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      notificacion: {
        create: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
      emitirPublico: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContenidoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<ContenidoService>(ContenidoService);
  });

  describe('CARTA PÚBLICA (obtenerContenidoPublicoCarta)', () => {
    it('retorna la configuración de la carta con versión publicada, paleta y ranking', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue({
        id: BigInt(1),
        estado: 'PUBLICADA',
        organizacion: 'SECCIONES',
        decoracion: 'HALLOWEEN',
        contenido: { banner: { activo: true, tag: 'FESTIVO', title: 'Halloween', sub: 'Dulces' } },
        publicada_en: new Date('2026-10-20'),
      });
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.novedad.findMany.mockResolvedValue([]);
      prisma.destacada.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([
        {
          anio_mes: '2026-10',
          producto_id: BigInt(5),
          unidades: 40,
          puesto: 1,
          producto: { nombre: 'FRAPPE OREO' },
        },
        {
          anio_mes: '2026-10',
          producto_id: BigInt(6),
          unidades: 35,
          puesto: 2,
          producto: { nombre: 'LATTE COFFE' },
        },
      ]);

      const res = await service.obtenerContenidoPublicoCarta();

      expect(res.decoracion).toBe('HALLOWEEN');
      expect(res.organizacion).toBe('SECCIONES');
      expect(res.paleta).toBeDefined();
      expect(res.rankingMes).toHaveLength(2);
      expect(res.rankingMes[0].estrellas).toBe(3);
      expect(res.rankingMes[1].estrellas).toBe(1);
    });

    it('RN-CAP-064 / RQ-CON-03-08: excluye destacadas que no tengan fotos', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.novedad.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);
      prisma.destacada.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          titulo: 'Con Fotos',
          orden: 1,
          archivada: false,
          portada_archivo: null,
          fotos: [{ archivo: { id: BigInt(10), ruta: 'publico/foto1.webp' } }],
        },
        {
          id: BigInt(2),
          titulo: 'Sin Fotos',
          orden: 2,
          archivada: false,
          portada_archivo: null,
          fotos: [], // vacío
        },
      ]);

      const res = await service.obtenerContenidoPublicoCarta();

      expect(res.destacadas).toHaveLength(1);
      expect(res.destacadas[0].titulo).toBe('Con Fotos');
    });

    it('RN-CAP-063 / RQ-CON-03-03: excluye novedades fuera de vigencia', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.destacada.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);
      prisma.novedad.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          tipo: 'AVISO',
          titulo: 'Vigente',
          orden: 1,
          activo: true,
          desde: new Date('2026-01-01'),
          hasta: new Date('2026-12-31'),
          fotos: [],
        },
        {
          id: BigInt(2),
          tipo: 'PROMOCION',
          titulo: 'Vencida',
          orden: 2,
          activo: true,
          desde: new Date('2026-01-01'),
          hasta: new Date('2026-02-01'), // vencida
          fotos: [],
        },
      ]);

      const res = await service.obtenerContenidoPublicoCarta();

      expect(res.novedades).toHaveLength(1);
      expect(res.novedades[0].titulo).toBe('Vigente');
    });
  });

  describe('COMENTARIOS Y BUZÓN (crearComentarioCarta)', () => {
    it('guarda el comentario y si es QUEJA registra notificación para el dueño', async () => {
      prisma.mensajeCarta.create.mockResolvedValue({
        id: BigInt(100),
        tipo: 'QUEJA',
        texto: 'La atención tardó demasiado hoy',
        nombre: 'Carlos',
        contacto: '999888777',
      });

      const res = await service.crearComentarioCarta({
        tipo: 'QUEJA',
        texto: 'La atención tardó demasiado hoy',
        nombre: 'Carlos',
        contacto: '999888777',
      });

      expect(res.ok).toBe(true);
      expect(prisma.mensajeCarta.create).toHaveBeenCalled();
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'RECLAMO_CARTA',
          }),
        }),
      );
    });
  });

  describe('ADMINISTRATIVO: DISEÑADOR', () => {
    it('publica el borrador y archiva la versión anterior', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue({
        id: BigInt(99),
        estado: 'BORRADOR',
        organizacion: 'TARJETAS',
        decoracion: 'NAVIDAD',
        contenido: { productosConfig: {} },
      });
      prisma.versionCarta.updateMany.mockResolvedValue({ count: 1 });
      prisma.versionCarta.update.mockResolvedValue({
        id: BigInt(99),
        estado: 'PUBLICADA',
        decoracion: 'NAVIDAD',
      });

      const res = await service.publicarDiseno(mockUsuario as any);

      expect(res.ok).toBe(true);
      expect(prisma.versionCarta.updateMany).toHaveBeenCalledWith({
        where: { estado: 'PUBLICADA' },
        data: { estado: 'ARCHIVADA' },
      });
      expect(prisma.versionCarta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(99) },
          data: expect.objectContaining({ estado: 'PUBLICADA' }),
        }),
      );
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('falla al publicar si no hay borrador pendiente', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue(null);

      await expect(service.publicarDiseno(mockUsuario as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('descarta el borrador pendiente', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue({
        id: BigInt(99),
        estado: 'BORRADOR',
      });
      prisma.versionCarta.delete.mockResolvedValue({ id: BigInt(99) });

      const res = await service.descartarDiseno(mockUsuario as any);

      expect(res.ok).toBe(true);
      expect(prisma.versionCarta.delete).toHaveBeenCalledWith({
        where: { id: BigInt(99) },
      });
    });
  });

  describe('ADMINISTRATIVO: DESTACADAS (DT-06 Excepción eliminar)', () => {
    it('permite eliminar una destacada para siempre', async () => {
      prisma.destacada.delete.mockResolvedValue({ id: BigInt(5) });
      prisma.parametro.findUnique.mockResolvedValue(null);

      const res = await service.eliminarDestacada('5', mockUsuario as any);

      expect(res.ok).toBe(true);
      expect(prisma.destacada.delete).toHaveBeenCalledWith({
        where: { id: BigInt(5) },
      });
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('guarda leyenda (pie) y estado activo de una destacada en parametro carta_destacadas_meta y filtra las desactivadas en la carta pública', async () => {
      prisma.destacada.findUnique.mockResolvedValue({
        id: BigInt(1),
        titulo: 'Clientes felices',
        orden: 1,
        archivada: false,
      });
      prisma.destacada.update.mockResolvedValue({ id: BigInt(1) });
      prisma.destacadaFoto.deleteMany.mockResolvedValue({ count: 0 });
      prisma.destacadaFoto.create.mockResolvedValue({});
      prisma.archivo.findFirst.mockResolvedValue({
        id: BigInt(77),
        ruta: 'publico/foto_cliente.webp',
      });
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.parametro.upsert.mockResolvedValue({});

      const upd = await service.actualizarDestacada(
        '1',
        {
          activo: true,
          fotos: [{ url: '/archivos/publico/foto_cliente.webp', pie: 'Tarde de waffles', orden: 1 }],
        },
        mockUsuario as any,
      );

      expect(upd.ok).toBe(true);
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clave: 'carta_destacadas_meta' },
          create: expect.objectContaining({
            clave: 'carta_destacadas_meta',
            valor: expect.objectContaining({
              activos: { '1': true },
              fotosMeta: {
                '1': [
                  expect.objectContaining({
                    url: '/archivos/publico/foto_cliente.webp',
                    pie: 'Tarde de waffles',
                  }),
                ],
              },
            }),
          }),
        }),
      );

      // Ahora probamos obtenerContenidoPublicoCarta con una activa (con leyenda) y una desactivada
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.novedad.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);
      prisma.parametro.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.clave === 'carta_destacadas_meta') {
          return {
            clave: 'carta_destacadas_meta',
            valor: {
              activos: { '1': true, '2': false },
              fotosMeta: {
                '1': [{ id: '77', url: '/archivos/publico/foto_cliente.webp', pie: 'Tarde de waffles', orden: 1 }],
                '2': [{ id: '78', url: '/archivos/publico/local.webp', pie: 'Local', orden: 1 }],
              },
            },
          };
        }
        return null;
      });
      prisma.destacada.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          titulo: 'Clientes felices',
          orden: 1,
          archivada: false,
          portada_archivo: null,
          fotos: [{ archivo: { id: BigInt(77), ruta: 'publico/foto_cliente.webp' } }],
        },
        {
          id: BigInt(2),
          titulo: 'Nuestro local',
          orden: 2,
          archivada: false,
          portada_archivo: null,
          fotos: [{ archivo: { id: BigInt(78), ruta: 'publico/local.webp' } }],
        },
      ]);

      const carta = await service.obtenerContenidoPublicoCarta();
      expect(carta.destacadas).toHaveLength(1);
      expect(carta.destacadas[0].titulo).toBe('Clientes felices');
      expect((carta.destacadas[0].fotos[0] as any).pie).toBe('Tarde de waffles');
    });
  });

  describe('ADMINISTRATIVO: PALETA DE COLORES', () => {
    it('guarda borrador y publica los colores festivos', async () => {
      prisma.parametro.upsert.mockResolvedValue({});
      prisma.parametro.findUnique.mockResolvedValue({
        clave: 'carta_paleta_decoracion_borrador',
        valor: { halloween: { accent: '#ff6600' } },
      });
      prisma.parametro.delete.mockResolvedValue({});

      await service.guardarBorradorPaleta(
        { paletas: { halloween: { accent: '#ff6600' } } },
        mockUsuario as any,
      );

      const pubRes = await service.publicarPaleta(mockUsuario as any);

      expect(pubRes.ok).toBe(true);
      expect(prisma.parametro.delete).toHaveBeenCalledWith({
        where: { clave: 'carta_paleta_decoracion_borrador' },
      });
    });
  });

  describe('ADMINISTRATIVO: NOVEDADES (tamaño y eliminar)', () => {
    it('crea la novedad con el tamaño elegido y MEDIANO si no llega', async () => {
      prisma.novedad.aggregate.mockResolvedValue({ _max: { orden: 3 } });
      prisma.novedad.create.mockResolvedValue({ id: BigInt(9), titulo: 'Nueva' });

      await service.crearNovedad({ tipo: 'AVISO', titulo: 'Nueva', tamano: 'GRANDE' } as any, mockUsuario as any);
      expect(prisma.novedad.create.mock.calls[0][0].data.tamano).toBe('GRANDE');

      await service.crearNovedad({ tipo: 'AVISO', titulo: 'Sin tamaño' } as any, mockUsuario as any);
      expect(prisma.novedad.create.mock.calls[1][0].data.tamano).toBe('MEDIANO');
    });

    it('rechaza un tamaño fuera de CHICO, MEDIANO, GRANDE y ANCHO', async () => {
      const dto = Object.assign(new CrearNovedadDto(), { tipo: 'AVISO', titulo: 'X', tamano: 'XL' });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'tamano')).toBe(true);
    });

    it('actualiza el tamaño de una novedad existente', async () => {
      prisma.novedad.findUnique.mockResolvedValue({ id: BigInt(4), titulo: 'Vieja' });
      prisma.novedad.update.mockResolvedValue({});

      await service.actualizarNovedad('4', { tamano: 'ANCHO' } as any, mockUsuario as any);

      expect(prisma.novedad.update.mock.calls[0][0].data.tamano).toBe('ANCHO');
    });

    it('elimina una novedad existente y registra auditoría', async () => {
      prisma.novedad.findUnique.mockResolvedValue({ id: BigInt(4), titulo: 'Vieja', tipo: 'AVISO' });
      prisma.novedad.delete.mockResolvedValue({});

      const res = await service.eliminarNovedad('4', mockUsuario as any);

      expect(res).toEqual({ ok: true });
      expect(prisma.novedad.delete).toHaveBeenCalledWith({ where: { id: BigInt(4) } });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'novedades', accion: 'ELIMINAR_NOVEDAD' }),
      );
    });

    it('eliminar una novedad inexistente responde 404 y no borra nada', async () => {
      prisma.novedad.findUnique.mockResolvedValue(null);

      await expect(service.eliminarNovedad('99', mockUsuario as any)).rejects.toThrow(NotFoundException);
      expect(prisma.novedad.delete).not.toHaveBeenCalled();
    });

    it('la carta pública trae tamano y usa MEDIANO cuando falta o no es válido', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.destacada.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);
      prisma.novedad.findMany.mockResolvedValue([
        { id: BigInt(1), tipo: 'BANNER', titulo: 'Grande', orden: 1, activo: true, tamano: 'GRANDE', fotos: [] },
        { id: BigInt(2), tipo: 'AVISO', titulo: 'Raro', orden: 2, activo: true, tamano: 'XL', fotos: [] },
      ]);

      const res = await service.obtenerContenidoPublicoCarta();

      expect(res.novedades.map((n: any) => n.tamano)).toEqual(['GRANDE', 'MEDIANO']);
    });
  });

  describe('ADMINISTRATIVO: NOVEDADES (encabezado editable)', () => {
    it('retorna valores por defecto cuando no hay parámetro guardado', async () => {
      prisma.parametro.findUnique.mockResolvedValue(null);

      const res = await service.obtenerNovedadesEncabezadoAdmin();

      expect(res.encabezado.etiqueta).toBe('NOVEDADES');
      expect(res.encabezado.titulo).toBe('Lo nuevo en Caprichos');
      expect(res.encabezado.subtitulo).toContain('Promociones');
      expect(res.tieneBorrador).toBe(false);
    });

    it('guarda borrador de encabezado y usa defaults si los campos son vacíos', async () => {
      prisma.parametro.upsert.mockResolvedValue({});

      const res = await service.guardarBorradorNovedadesEncabezado(
        { etiqueta: '   ', titulo: 'Novedades de Verano', subtitulo: '' },
        mockUsuario as any,
      );

      expect(res.ok).toBe(true);
      expect(res.tieneBorrador).toBe(true);
      expect(res.encabezado.etiqueta).toBe('NOVEDADES'); // fallback por vacío
      expect(res.encabezado.titulo).toBe('Novedades de Verano');
      expect(res.encabezado.subtitulo).toContain('Promociones'); // fallback por vacío
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clave: 'contenido_novedades_encabezado_borrador' },
        }),
      );
    });

    it('publicarNovedades promueve el borrador del encabezado al parámetro público', async () => {
      prisma.parametro.findUnique.mockResolvedValue({
        clave: 'contenido_novedades_encabezado_borrador',
        valor: { etiqueta: 'LO NUEVO', titulo: 'Especiales', subtitulo: 'Ofertas' },
      });
      prisma.parametro.upsert.mockResolvedValue({});
      prisma.parametro.deleteMany.mockResolvedValue({});

      const pubRes = await service.publicarNovedades(mockUsuario as any);

      expect(pubRes.ok).toBe(true);
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clave: 'contenido_novedades_encabezado' },
          update: { valor: { etiqueta: 'LO NUEVO', titulo: 'Especiales', subtitulo: 'Ofertas' } },
        }),
      );
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({
        where: { clave: 'contenido_novedades_encabezado_borrador' },
      });
    });

    it('descartarNovedadesEncabezado elimina el borrador y vuelve al publicado', async () => {
      prisma.parametro.deleteMany.mockResolvedValue({});
      prisma.parametro.findUnique.mockResolvedValueOnce({
        clave: 'contenido_novedades_encabezado',
        valor: { etiqueta: 'ORIGINAL', titulo: 'Título Original', subtitulo: 'Sub Original' },
      }).mockResolvedValueOnce(null);

      const descRes = await service.descartarNovedadesEncabezado(mockUsuario as any);

      expect(descRes.ok).toBe(true);
      expect(descRes.encabezado.etiqueta).toBe('ORIGINAL');
      expect(descRes.tieneBorrador).toBe(false);
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({
        where: { clave: 'contenido_novedades_encabezado_borrador' },
      });
    });

    it('la carta pública devuelve el encabezado publicado en novedadesEncabezado', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.parametro.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.clave === 'contenido_novedades_encabezado') {
          return {
            clave: 'contenido_novedades_encabezado',
            valor: { etiqueta: 'NOVEDADES WEB', titulo: 'Descubre lo nuevo', subtitulo: 'Todo rico' },
          };
        }
        return null;
      });
      prisma.novedad.findMany.mockResolvedValue([]);
      prisma.destacada.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);

      const carta = await service.obtenerContenidoPublicoCarta();

      expect(carta.novedadesEncabezado).toEqual({
        etiqueta: 'NOVEDADES WEB',
        titulo: 'Descubre lo nuevo',
        subtitulo: 'Todo rico',
      });
    });
  });

  describe('CONÓCENOS (borrador y publicado)', () => {
    const BOR = 'contenido_conocenos_borrador';
    it('sin nada guardado devuelve los textos de hoy', async () => {
      prisma.parametro.findUnique.mockResolvedValue(null);
      const r = await service.obtenerConocenosAdmin();
      expect(r.tieneBorrador).toBe(false);
      expect(r.contenido.titulo).toBe('Cafetería artesanal en San Juan de Lurigancho');
      expect(r.contenido.bloques.map((b) => b.id)).toEqual(['donde', 'horario', 'contacto', 'redes', 'momentos']);
      expect(r.contenido.momentosCantidad).toBe(8);
    });

    it('el admin ve el borrador y la carta solo lo publicado', async () => {
      prisma.parametro.findUnique.mockImplementation(async ({ where }: any) =>
        where.clave === BOR ? { valor: { titulo: 'Borrador' } } : where.clave === 'contenido_conocenos' ? { valor: { titulo: 'Publicado' } } : null,
      );
      const r = await service.obtenerConocenosAdmin();
      expect(r.contenido.titulo).toBe('Borrador');
      expect(r.publicado.titulo).toBe('Publicado');
      prisma.versionCarta.findFirst.mockResolvedValue(null);
      prisma.novedad.findMany.mockResolvedValue([]);
      prisma.destacada.findMany.mockResolvedValue([]);
      prisma.rankingMes.findMany.mockResolvedValue([]);
      const carta = await service.obtenerContenidoPublicoCarta();
      expect(carta.conocenos.titulo).toBe('Publicado');
    });

    it('guardar borrador normaliza, respeta el orden y audita', async () => {
      const r = await service.guardarBorradorConocenos(
        { titulo: ' Nuevo ', bloques: [{ id: 'redes', titulo: 'Redes', visible: false }, { id: 'zzz' }], momentosCantidad: 99 },
        mockUsuario as any,
      );
      expect(r.contenido.titulo).toBe('Nuevo');
      expect(r.contenido.bloques.map((b) => b.id)).toEqual(['redes', 'donde', 'horario', 'contacto', 'momentos']);
      expect(r.contenido.bloques[0].visible).toBe(false);
      expect(r.contenido.momentosCantidad).toBe(24);
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { clave: BOR } }));
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GUARDAR_BORRADOR_CONOCENOS' }));
    });

    it('publicar promueve el borrador y lo borra; sin borrador falla', async () => {
      prisma.parametro.findUnique.mockResolvedValueOnce({ valor: { titulo: 'X' } }).mockResolvedValue(null);
      await service.publicarConocenos(mockUsuario as any);
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { clave: 'contenido_conocenos' } }));
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({ where: { clave: BOR } });
      prisma.parametro.findUnique.mockResolvedValue(null);
      await expect(service.publicarConocenos()).rejects.toThrow(BadRequestException);
    });

    it('descartar borra solo el borrador', async () => {
      prisma.parametro.findUnique.mockResolvedValue(null);
      await service.descartarConocenos(mockUsuario as any);
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({ where: { clave: BOR } });
    });
  });

  describe('EDITOR EN SITIO: borrador de novedades y momentos', () => {
    const BORN = 'contenido_novedades_borrador';

    it('guarda el borrador de tarjetas saneado y lo audita', async () => {
      prisma.parametro.upsert.mockResolvedValue({});
      const res = await service.guardarNovedadesBorrador(
        [
          { id: '5', tipo: 'PROMOCION', titulo: 'Martes', tamano: 'XXL', fotos: ['/a.webp', 7] },
          { id: '', titulo: 'sin id' },
          { id: 'nueva-1', titulo: 'Nueva', activo: false },
        ],
        mockUsuario as any,
      );
      expect(res.items).toHaveLength(2);
      expect(res.items[0]).toMatchObject({ id: '5', tamano: 'MEDIANO', fotos: ['/a.webp'], activo: true });
      expect(res.items[1].activo).toBe(false);
      expect(prisma.parametro.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { clave: BORN } }));
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GUARDAR_BORRADOR_NOVEDADES' }));
    });

    it('rechaza un borrador que no es lista', async () => {
      await expect(service.guardarNovedadesBorrador({}, mockUsuario as any)).rejects.toThrow(BadRequestException);
    });

    it('publicar aplica el borrador: actualiza, crea, elimina las quitadas, ordena y borra el borrador', async () => {
      prisma.parametro.findUnique.mockImplementation(async ({ where }: any) =>
        where.clave === BORN
          ? { valor: { items: [
              { id: '2', tipo: 'AVISO', titulo: 'Dos', activo: true, tamano: 'GRANDE', fotos: [] },
              { id: 'nueva-1', tipo: 'FOTOS', titulo: 'Nueva', activo: true, tamano: 'CHICO', fotos: ['/f.webp'] },
            ] } }
          : null,
      );
      prisma.novedad.findMany.mockResolvedValue([{ id: BigInt(1) }, { id: BigInt(2) }]);
      prisma.novedad.findUnique.mockImplementation(async ({ where }: any) => ({ id: where.id, titulo: 'x', tipo: 'AVISO' }));
      prisma.novedad.update.mockResolvedValue({});
      prisma.novedad.delete.mockResolvedValue({});
      prisma.novedad.aggregate.mockResolvedValue({ _max: { orden: 2 } });
      prisma.novedad.create.mockResolvedValue({ id: BigInt(9), titulo: 'Nueva' });
      prisma.archivo.findFirst.mockResolvedValue({ id: BigInt(3) });
      prisma.novedadFoto.upsert.mockResolvedValue({});
      prisma.parametro.deleteMany.mockResolvedValue({});

      const res = await service.publicarNovedades(mockUsuario as any);

      expect(res.ok).toBe(true);
      expect(prisma.novedad.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } });
      expect(prisma.novedad.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BigInt(2) }, data: expect.objectContaining({ orden: 1, tamano: 'GRANDE' }) }),
      );
      expect(prisma.novedad.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ titulo: 'Nueva', orden: 2, tamano: 'CHICO' }) }),
      );
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({ where: { clave: BORN } });
    });

    it('descartar quita también el borrador de tarjetas', async () => {
      prisma.parametro.deleteMany.mockResolvedValue({});
      prisma.parametro.findUnique.mockResolvedValue(null);
      await service.descartarNovedadesEncabezado(mockUsuario as any);
      expect(prisma.parametro.deleteMany).toHaveBeenCalledWith({ where: { clave: BORN } });
    });

    it('publicar el diseño aplica el orden de categorías y los momentos del borrador, sin arrastrarlos después', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue({
        id: BigInt(7),
        estado: 'BORRADOR',
        contenido: {
          secciones: ['POSTRES', 'FRAPPES'],
          momentos: {
            orden: ['4', 'nuevo-1', '3'],
            items: { '4': { titulo: 'Primero', activo: false } },
            nuevos: [{ id: 'nuevo-1', titulo: 'Recién', foto: '/archivos/publico/x.webp' }],
          },
        },
      });
      prisma.versionCarta.updateMany.mockResolvedValue({});
      prisma.versionCarta.update.mockResolvedValue({ id: BigInt(7), estado: 'PUBLICADA', decoracion: 'NINGUNO' });
      prisma.categoria.update = jest.fn().mockResolvedValue({});
      prisma.destacada.aggregate.mockResolvedValue({ _max: { orden: 5 } });
      prisma.destacada.create.mockResolvedValue({ id: BigInt(11), titulo: 'Recién' });
      prisma.destacada.findUnique.mockImplementation(async ({ where }: any) => ({ id: where.id }));
      prisma.destacada.update.mockResolvedValue({});
      prisma.archivo.findFirst.mockResolvedValue({ id: BigInt(2) });
      prisma.destacadaFoto.deleteMany.mockResolvedValue({});
      prisma.destacadaFoto.create.mockResolvedValue({});
      prisma.parametro.findUnique.mockResolvedValue(null);
      prisma.parametro.upsert.mockResolvedValue({});

      await service.publicarDiseno(mockUsuario as any);

      expect(prisma.categoria.update).toHaveBeenCalledWith({ where: { nombre: 'POSTRES' }, data: { orden: 1 } });
      expect(prisma.categoria.update).toHaveBeenCalledWith({ where: { nombre: 'FRAPPES' }, data: { orden: 2 } });
      const llamadas = prisma.destacada.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.orden, c[0].data.titulo]);
      expect(llamadas).toEqual(expect.arrayContaining([[BigInt(4), 1, 'Primero'], [BigInt(11), 2, undefined], [BigInt(3), 3, undefined]]));
      const ultima = prisma.versionCarta.update.mock.calls.at(-1)[0];
      expect(ultima.data.contenido.momentos).toBeUndefined();
    });
  });
});
