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
@Injectable()
export class ContenidoBaseService implements OnModuleInit {
  private readonly logger = new Logger(ContenidoBaseService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      const r = await this.asegurar();
      this.logger.log(`Contenido base: ${r.fotos} fotos de producto, ${r.destacadas} destacadas creadas`);
    } catch (err: any) {
      this.logger.warn(`No se pudo asegurar el contenido base de la carta: ${err.message}`);
    }
  }

  async asegurar() {
    const fotos = await this.enlazarFotosBase();
    const destacadas = await this.crearDestacadasSiVacio();
    return { fotos, destacadas };
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
