import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';

export const VISTAS_TV = ['SALON_VIVO', 'COCINA'] as const;
export type VistaTv = (typeof VISTAS_TV)[number];

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
export const VIGENCIA_CODIGO_MS = 10 * 60_000;
const NOMBRE_POR_VISTA: Record<VistaTv, string> = { SALON_VIVO: 'TV Salón en vivo', COCINA: 'TV Cocina' };

export const hashLlave = (llave: string) => crypto.createHash('sha256').update(llave).digest('hex');
const generarCodigo = () => Array.from({ length: 6 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');

@Injectable()
export class TvService {
  constructor(private readonly prisma: PrismaService) {}

  /** La TV pide un código nuevo: queda pendiente (inactiva) hasta que el admin lo escriba en Pantallas. */
  async crearCodigo(vista: string) {
    if (!(VISTAS_TV as readonly string[]).includes(vista)) {
      throw new HttpException({ codigo: 'VISTA_INVALIDA', mensaje: 'Vista de TV no válida' }, HttpStatus.BAD_REQUEST);
    }
    const v = vista as VistaTv;
    // Limpieza: pendientes que nadie vinculó
    await this.prisma.deviceKey.deleteMany({
      where: { tipo: 'TV', activo: false, codigo_vinculo: { not: null }, codigo_expira_en: { lt: new Date() } },
    });
    const llave = crypto.randomBytes(24).toString('hex');
    const expiraEn = new Date(Date.now() + VIGENCIA_CODIGO_MS);
    for (let intento = 0; intento < 5; intento++) {
      const codigo = generarCodigo();
      try {
        await this.prisma.deviceKey.create({
          data: {
            tipo: 'TV',
            nombre: NOMBRE_POR_VISTA[v],
            vista: v,
            llave_hash: hashLlave(llave),
            activo: false,
            codigo_vinculo: codigo,
            codigo_expira_en: expiraEn,
          },
        });
        return { codigo, expiraEn: expiraEn.toISOString(), llave };
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // código repetido: otro intento
      }
    }
    throw new HttpException({ codigo: 'SIN_CODIGO', mensaje: 'No se pudo generar un código. Intenta de nuevo.' }, HttpStatus.SERVICE_UNAVAILABLE);
  }

  /** Estado de la TV según su llave. Llave desconocida: 401 y la TV pide otro código. */
  async estado(llave: string | undefined) {
    const tv = llave ? await this.prisma.deviceKey.findFirst({ where: { llave_hash: hashLlave(llave), tipo: 'TV' } }) : null;
    if (!tv) {
      throw new UnauthorizedException({ codigo: 'LLAVE_INVALIDA', mensaje: 'Llave de la pantalla inválida' });
    }
    await this.prisma.deviceKey.update({ where: { id: tv.id }, data: { ultima_conexion: new Date() } });
    return {
      vinculada: !tv.codigo_vinculo,
      activa: tv.activo,
      vista: tv.vista,
      areaId: tv.area_id ? tv.area_id.toString() : null,
      nombre: tv.nombre,
    };
  }
}
