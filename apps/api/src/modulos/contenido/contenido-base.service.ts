import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { FOTOS } from './fotos-base';

const SEED = (...n: string[]) => n.map((x) => `publico/seed/${x}.webp`);
const MARCA = ['caprichos-del-mes', 'caprichos-de-octubre', 'donuts-halloween', 'fantasma-cafe', 'hechizo-pumpkin'].map(
  (x) => `/imagenes/caprichos/${x}.webp`,
);
// Fotos de las novedades de ejemplo (por título); antes eran un parche del front en la carta.
const FOTOS_NOVEDADES: Record<string, string[]> = {
  'Fin de semana de waffles': ['waffle_oreo'],
  'Martes de 2x1 en Latte Coffe': ['iced_latte_coffee', 'mocaccino', 'caramel_macchiato'],
  'Así preparamos nuestro Frappe Oreo': ['frappe_oreo'],
  'Nuevo: Frappe Maracuyá Tropical': ['frappe_maracuya', 'frappe_strawberry', 'frappe_berries'],
};
const DESTACADAS_BASE = [
  { titulo: 'Caprichos del mes', rutas: SEED('frappe_maracuya', 'frappe_oreo', 'duo_irresistible', 'waffle_oreo', 'iced_latte_coffee') },
  {
    titulo: 'Momentos Caprichos',
    rutas: [...MARCA, ...SEED('mocaccino', 'caramel_macchiato', 'frappe_strawberry', 'frappe_berries')],
  },
];

/**
 * Al arrancar deja la carta con contenido mínimo: fotos base de los productos que no tienen y los círculos
 * «Caprichos del mes» y «Momentos Caprichos» si no hay ninguna destacada. Solo AGREGA: nunca pisa lo del admin.
 */
const CLAVE_CONOCENOS = 'contenido_conocenos';

/** Una fila sin la clave `galeria` todavía es la versión anterior (antes de «Fotos del local» en Conócenos). */
const sinGaleria = (valor: unknown): boolean =>
  !!valor && typeof valor === 'object' && !Array.isArray(valor) && (valor as Record<string, unknown>).galeria === undefined;

@Injectable()
export class ContenidoBaseService implements OnModuleInit {
  private readonly logger = new Logger(ContenidoBaseService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      const r = await this.asegurar();
      this.logger.log(`Contenido base: ${r.fotos} fotos de producto, ${r.novedades} novedades con foto, ${r.destacadas} destacadas creadas`);
    } catch (err: any) {
      this.logger.warn(`No se pudo asegurar el contenido base de la carta: ${err.message}`);
    }
    try {
      const copiadas = await this.copiarFotosLocalAConocenos();
      if (copiadas > 0) this.logger.log(`Conócenos: ${copiadas} fila(s) recibieron la galería copiada de Fotos del local`);
    } catch (err: any) {
      this.logger.warn(`No se pudo copiar Fotos del local a Conócenos: ${err.message}`);
    }
  }

  /**
   * Copia UNA vez las fotos activas de «Fotos del local» a la galería de Conócenos (publicada y borrador).
   * Una vez copiada, la fila ya tiene la clave `galeria` y no se vuelve a tocar: desde ahí son independientes.
   */
  async copiarFotosLocalAConocenos(): Promise<number> {
    const filas = await this.prisma.fotoLocal.findMany({
      where: { activo: true, slot: { not: null } },
      include: { archivo: { select: { ruta: true } } },
      orderBy: { orden: 'asc' },
    });
    const galeria = filas.map((f) => ({
      id: `local-${f.archivo_id.toString()}`,
      url: `/archivos/${f.archivo.ruta}`,
      activo: true,
      origen: f.slot as string,
    }));

    let copiadas = 0;
    const publicado = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_CONOCENOS } });
    if (!publicado) {
      if (galeria.length > 0) {
        await this.prisma.parametro.create({ data: { clave: CLAVE_CONOCENOS, valor: { galeria } as any } });
        copiadas++;
      }
    } else if (sinGaleria(publicado.valor)) {
      await this.prisma.parametro.update({
        where: { clave: CLAVE_CONOCENOS },
        data: { valor: { ...(publicado.valor as object), galeria } as any },
      });
      copiadas++;
    }

    const borrador = await this.prisma.parametro.findUnique({ where: { clave: `${CLAVE_CONOCENOS}_borrador` } });
    if (borrador && sinGaleria(borrador.valor)) {
      await this.prisma.parametro.update({
        where: { clave: `${CLAVE_CONOCENOS}_borrador` },
        data: { valor: { ...(borrador.valor as object), galeria } as any },
      });
      copiadas++;
    }
    return copiadas;
  }

  async asegurar() {
    const fotos = await this.enlazarFotosBase();
    const novedades = await this.enlazarFotosNovedades();
    const destacadas = await this.crearDestacadasSiVacio();
    return { fotos, novedades, destacadas };
  }

  /** Enlaza la foto base SOLO a productos sin foto y cuyo archivo exista en disco. */
  async enlazarFotosBase(): Promise<number> {
    const dir = path.resolve(this.config.get<string>('UPLOADS_DIR', './data/uploads'), 'publico/seed');
    const sinFoto = await this.prisma.producto.findMany({
      where: { foto_archivo_id: null, nombre: { in: Object.keys(FOTOS) } },
      select: { id: true, nombre: true },
    });
    let n = 0;
    for (const p of sinFoto) {
      const archivoFoto = FOTOS[p.nombre];
      const fuente = path.join(dir, `${archivoFoto}.webp`);
      if (!fs.existsSync(fuente)) continue;
      const ruta = `publico/seed/${archivoFoto}.webp`;
      const archivo = await this.prisma.archivo.upsert({
        where: { ruta },
        update: {},
        create: { ruta, tipo_mime: 'image/webp', bytes: fs.statSync(fuente).size, privado: false },
      });
      await this.prisma.producto.update({ where: { id: p.id }, data: { foto_archivo_id: archivo.id } });
      n++;
    }
    return n;
  }

  /** Registra las fotos de las novedades de ejemplo SOLO si no tienen ninguna (nunca pisa ni duplica lo del admin). */
  async enlazarFotosNovedades(): Promise<number> {
    const dir = path.resolve(this.config.get<string>('UPLOADS_DIR', './data/uploads'), 'publico/seed');
    const sinFoto = await this.prisma.novedad.findMany({
      where: { titulo: { in: Object.keys(FOTOS_NOVEDADES) }, fotos: { none: {} } },
      select: { id: true, titulo: true },
    });
    let n = 0;
    for (const nov of sinFoto) {
      const nombres = FOTOS_NOVEDADES[nov.titulo].filter((f) => fs.existsSync(path.join(dir, `${f}.webp`)));
      for (const [orden, f] of nombres.entries()) {
        const ruta = `publico/seed/${f}.webp`;
        const archivo = await this.prisma.archivo.upsert({
          where: { ruta },
          update: {},
          create: { ruta, tipo_mime: 'image/webp', bytes: fs.statSync(path.join(dir, `${f}.webp`)).size, privado: false },
        });
        await this.prisma.novedadFoto.create({ data: { novedad_id: nov.id, archivo_id: archivo.id, orden } });
      }
      if (nombres.length) n++;
    }
    return n;
  }

  /**
   * Con la tabla de destacadas vacía (ni siquiera archivadas) crea los dos círculos base, cada uno con
   * varias fotos ya existentes: las de Novedades (seed) y las de marca que usa Conócenos (/imagenes/caprichos).
   */
  async crearDestacadasSiVacio(): Promise<number> {
    if ((await this.prisma.destacada.count()) > 0) return 0;
    const dir = path.resolve(this.config.get<string>('UPLOADS_DIR', './data/uploads'), 'publico/seed');
    let creadas = 0;
    for (const [i, base] of DESTACADAS_BASE.entries()) {
      const rutas = base.rutas.filter((r) => r.startsWith('/imagenes/') || fs.existsSync(path.join(dir, path.basename(r))));
      if (rutas.length === 0) continue;
      const archivos: { id: bigint }[] = [];
      for (const ruta of rutas) {
        archivos.push(
          await this.prisma.archivo.upsert({
            where: { ruta },
            update: {},
            create: { ruta, tipo_mime: 'image/webp', bytes: 0, privado: false },
          }),
        );
      }
      await this.prisma.destacada.create({
        data: {
          titulo: base.titulo,
          orden: i + 1,
          portada_archivo_id: archivos[0].id,
          fotos: { create: archivos.map((a, k) => ({ archivo_id: a.id, orden: k + 1 })) },
        },
      });
      creadas++;
    }
    return creadas;
  }
}
