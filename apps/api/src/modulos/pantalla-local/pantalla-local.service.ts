import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { hoyLimaIso, inicioDiaLimaIso } from '../../comun/fechas-lima';

export const CLAVE_MOSTRAR_NOMBRE = 'pantalla_local_mostrar_nombre';
/** Un pedido LISTO sigue en la pantalla este tiempo (si nadie lo marca entregado antes). */
export const LISTO_VISIBLE_MIN = 20;
const CACHE_MS = 8000;

export interface PedidoPantalla {
  codigo: string;
  estado: 'PREPARANDO' | 'LISTO';
  /** COMER_LOCAL (mesa o barra) o LLEVAR (recoger). Nunca delivery. */
  modalidad: 'COMER_LOCAL' | 'LLEVAR';
  /** Minutos desde que entró a cocina (PREPARANDO) o desde que quedó listo (LISTO). */
  minutos: number;
  /** Solo la primera palabra del nombre, y solo si el parámetro lo permite. */
  nombre: string | null;
  // TODO: llenar cuando la cuenta del cliente tenga `avatar_url` (otro agente lo agrega al esquema).
  avatarUrl: string | null;
}

export interface RespuestaPantalla {
  pedidos: PedidoPantalla[];
  mostrarNombre: boolean;
  /** Instante del servidor (ISO), para que la pantalla calcule sin depender de su reloj. */
  ahora: string;
}

/** Primera palabra del nombre, solo letras, con inicial mayúscula. null si no queda nada. */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const palabra = String(nombre ?? '').trim().split(/\s+/)[0] ?? '';
  const limpia = palabra.replace(/[^\p{L}'-]/gu, '').slice(0, 20);
  if (!limpia) return null;
  return limpia.charAt(0).toLocaleUpperCase('es-PE') + limpia.slice(1).toLocaleLowerCase('es-PE');
}

@Injectable()
export class PantallaLocalService {
  private cache: { hasta: number; datos: RespuestaPantalla } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async pedidos(ahora: Date = new Date()): Promise<RespuestaPantalla> {
    if (this.cache && this.cache.hasta > ahora.getTime()) return this.cache.datos;

    const param = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_MOSTRAR_NOMBRE } });
    const valor = String(param?.valor ?? 'si').replace(/"/g, '').toLowerCase().trim();
    const mostrarNombre = valor !== 'no' && valor !== 'false';

    const limiteListo = new Date(ahora.getTime() - LISTO_VISIBLE_MIN * 60000);
    const filas = await this.prisma.pedido.findMany({
      where: {
        creado_en: { gte: inicioDiaLimaIso(hoyLimaIso(ahora)) },
        modalidad: { in: ['COMER_LOCAL', 'MESA', 'LOCAL', 'LLEVAR', 'RECOGER'] },
        OR: [{ estado: { in: ['COLA', 'PREPARANDO'] } }, { estado: 'LISTO', listo_en: { gte: limiteListo } }],
      },
      // Solo lo necesario: nunca teléfono, documento ni apellidos.
      select: { codigo: true, estado: true, modalidad: true, cliente_nombre: true, creado_en: true, pasa_cocina_en: true, listo_en: true },
      orderBy: { creado_en: 'asc' },
      take: 60,
    });

    const pedidos: PedidoPantalla[] = filas.map((f) => {
      const listo = f.estado === 'LISTO';
      const desde = listo ? (f.listo_en ?? f.creado_en) : (f.pasa_cocina_en ?? f.creado_en);
      return {
        codigo: f.codigo,
        estado: listo ? 'LISTO' : 'PREPARANDO',
        modalidad: f.modalidad === 'RECOGER' || f.modalidad === 'LLEVAR' ? 'LLEVAR' : 'COMER_LOCAL',
        minutos: Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 60000)),
        nombre: mostrarNombre ? nombreDePila(f.cliente_nombre) : null,
        avatarUrl: null,
      };
    });

    const datos = { pedidos, mostrarNombre, ahora: ahora.toISOString() };
    this.cache = { hasta: ahora.getTime() + CACHE_MS, datos };
    return datos;
  }
}
