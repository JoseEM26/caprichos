jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
    emitirPublico = jest.fn();
  },
}));

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContenidoService } from '../contenido.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { OfertasService } from '../../ofertas/ofertas.service';
import { DISPOSICION_CARTA_DEFECTO } from '../disposicion-carta';

describe('Diseño de la carta: disposición en borrador y carta pública', () => {
  let service: ContenidoService;
  let prisma: any;
  const usuario = { partyId: BigInt(10), rol: 'ADMIN', debeCambiar: false };

  beforeEach(async () => {
    prisma = {
      versionCarta: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: BigInt(1), ...data })), update: jest.fn(), updateMany: jest.fn() },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      rankingMes: { findMany: jest.fn().mockResolvedValue([]) },
      novedad: { findMany: jest.fn().mockResolvedValue([]) },
      destacada: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module = await Test.createTestingModule({
      providers: [
        ContenidoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: OfertasService, useValue: { actualizarOferta: jest.fn() } },
      ],
    }).compile();
    service = module.get(ContenidoService);
  });

  const guardar = (banner: any) => service.guardarBorradorDiseno({ contenido: { banner } } as any, usuario);
  const guardado = () => prisma.versionCarta.create.mock.calls[0][0].data.contenido.banner;

  it('guarda textos y visibilidad de los dos botones en el borrador, recortando espacios', async () => {
    await guardar({ activo: true, textoBotonPrincipal: '  Lo quiero  ', botonPrincipalActivo: false, textoBotonSecundario: 'Ir a la carta', botonSecundarioActivo: true });
    expect(guardado()).toMatchObject({ textoBotonPrincipal: 'Lo quiero', botonPrincipalActivo: false, textoBotonSecundario: 'Ir a la carta', botonSecundarioActivo: true });
  });

  it('quita HTML del texto del botón', async () => {
    await guardar({ textoBotonPrincipal: '<b>Pide</b> ya' });
    expect(guardado().textoBotonPrincipal).toBe('bPide/b ya');
  });

  it('rechaza texto vacío o de más de 24 caracteres y no guarda', async () => {
    await expect(guardar({ textoBotonPrincipal: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(guardar({ textoBotonSecundario: 'x'.repeat(25) })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.versionCarta.create).not.toHaveBeenCalled();
    await guardar({ textoBotonSecundario: 'x'.repeat(24) });
    expect(prisma.versionCarta.create).toHaveBeenCalled();
  });

  it('la carta pública completa los valores por defecto cuando faltan y respeta lo guardado', async () => {
    prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(2), decoracion: 'NINGUNO', organizacion: 'SECCIONES', publicada_en: null, contenido: { banner: { activo: true } } });
    let res: any = await service.obtenerContenidoPublicoCarta();
    expect(res.banner).toMatchObject({ textoBotonPrincipal: 'Pedir ahora', botonPrincipalActivo: true, textoBotonSecundario: 'Ver la carta', botonSecundarioActivo: true });
    prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(2), decoracion: 'NINGUNO', organizacion: 'SECCIONES', publicada_en: null, contenido: { banner: { textoBotonPrincipal: 'Quiero', botonSecundarioActivo: false, textoBotonSecundario: '' } } });
    res = await service.obtenerContenidoPublicoCarta();
    expect(res.banner).toMatchObject({ textoBotonPrincipal: 'Quiero', botonPrincipalActivo: true, textoBotonSecundario: 'Ver la carta', botonSecundarioActivo: false });
  });

  describe('modo «Mis banners»', () => {
    const img = (extra: any = {}) => ({ id: 'a', url: '/archivos/x.webp', alt: 'Promo', activo: true, ...extra });

    it('por defecto: modo MES, 5 s y sin imágenes (nada cambia hoy)', async () => {
      await guardar({ activo: true });
      expect(guardado()).toMatchObject({ modo: 'MES', intervaloSeg: 5, imagenes: [] });
    });

    it('guarda modo, intervalo e imágenes con enlace', async () => {
      await guardar({ modo: 'IMAGENES', intervaloSeg: 8, imagenes: [img({ enlace: { tipo: 'URL', valor: 'https://caprichos.pe/promo' }, urlCelular: '/archivos/m.webp' }), img({ id: 'b', activo: false, enlace: { tipo: 'CARTA' } })] });
      const b = guardado();
      expect(b.modo).toBe('IMAGENES');
      expect(b.intervaloSeg).toBe(8);
      expect(b.imagenes).toHaveLength(2);
      expect(b.imagenes[0]).toMatchObject({ urlCelular: '/archivos/m.webp', enlace: { tipo: 'URL', valor: 'https://caprichos.pe/promo' } });
      expect(b.imagenes[1].activo).toBe(false);
    });

    it.each([
      ['intervalo 2', { intervaloSeg: 2 }],
      ['intervalo 16', { intervaloSeg: 16 }],
      ['modo raro', { modo: 'X' }],
      ['más de 8', { imagenes: Array.from({ length: 9 }, (_, i) => img({ id: `i${i}` })) }],
      ['sin imagen', { imagenes: [img({ url: '' })] }],
      ['imagen javascript:', { imagenes: [img({ url: 'javascript:alert(1)' })] }],
      ['enlace http plano', { imagenes: [img({ enlace: { tipo: 'URL', valor: 'http://sitio.com' } })] }],
      ['enlace javascript', { imagenes: [img({ enlace: { tipo: 'URL', valor: 'javascript:alert(1)' } })] }],
      ['enlace con usuario', { imagenes: [img({ enlace: { tipo: 'URL', valor: 'https://a:b@sitio.com' } })] }],
      ['hasta antes que desde', { imagenes: [img({ desde: '2026-12-10', hasta: '2026-12-01' })] }],
      ['fecha inválida', { imagenes: [img({ desde: '2026-02-31' })] }],
      ['categoría con texto en vez de id', { imagenes: [img({ enlace: { tipo: 'CATEGORIA', valor: 'BEBIDAS' } })] }],
      ['categoría sin valor', { imagenes: [img({ enlace: { tipo: 'CATEGORIA' } })] }],
    ])('rechaza %s', async (_n, banner: any) => {
      await expect(guardar(banner)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.versionCarta.create).not.toHaveBeenCalled();
    });

    it('acepta exactamente 8 banners', async () => {
      await guardar({ imagenes: Array.from({ length: 8 }, (_, i) => img({ id: `i${i}` })) });
      expect(guardado().imagenes).toHaveLength(8);
    });

    it('la carta pública descarta lo inválido sin romperse y usa MES si el modo es raro', async () => {
      prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(2), decoracion: 'NINGUNO', organizacion: 'SECCIONES', publicada_en: null, contenido: { banner: { modo: 'IMAGENES', intervaloSeg: 99, imagenes: [img(), img({ url: 'javascript:x' }), img({ id: 'c', enlace: { tipo: 'URL', valor: 'http://x.com' } })] } } });
      const res: any = await service.obtenerContenidoPublicoCarta();
      expect(res.banner.modo).toBe('IMAGENES');
      expect(res.banner.intervaloSeg).toBe(5);
      expect(res.banner.imagenes).toHaveLength(2);
      expect(res.banner.imagenes[1].enlace).toBeUndefined();
    });

    it('guarda las fechas desde/hasta', async () => {
      await guardar({ imagenes: [img({ desde: '2026-12-01', hasta: '2026-12-01' })] });
      expect(guardado().imagenes[0]).toMatchObject({ desde: '2026-12-01', hasta: '2026-12-01' });
    });

    it('la carta pública solo sirve banners vigentes hoy (hora de Lima) y quita enlaces rotos', async () => {
      jest.useFakeTimers({ now: new Date('2026-12-05T03:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] }); // 04-dic 22:00 en Lima
      try {
        prisma.categoria = { findMany: jest.fn().mockResolvedValue([{ id: BigInt(1) }]) };
        prisma.producto = { findMany: jest.fn().mockResolvedValue([]) };
        prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(2), decoracion: 'NINGUNO', organizacion: 'SECCIONES', publicada_en: null, contenido: { banner: { modo: 'IMAGENES', imagenes: [
          img({ id: 'ok', desde: '2026-12-04', hasta: '2026-12-04', enlace: { tipo: 'CATEGORIA', valor: '1' } }),
          img({ id: 'futuro', desde: '2026-12-05' }),
          img({ id: 'vencido', hasta: '2026-12-03' }),
          img({ id: 'prodroto', enlace: { tipo: 'PRODUCTO', valor: '9' } }),
        ] } } });
        const res: any = await service.obtenerContenidoPublicoCarta();
        expect(res.banner.imagenes.map((b: any) => b.id)).toEqual(['ok', 'prodroto']);
        expect(res.banner.imagenes[0].enlace).toEqual({ tipo: 'CATEGORIA', valor: '1' });
        expect(res.banner.imagenes[1].enlace).toBeUndefined();
        expect(prisma.categoria.findMany.mock.calls[0][0].where.oculta).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
