import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { construirLineaTiempo } from './linea-tiempo.util';

/** Canales donde party_id es quien tomó el pedido (en el resto es el cliente). */
export const CANALES_CON_ATENDIDO = ['MOZO', 'CAJA'];

/** Nombre completo por party_id (sin consultar si no hay ids). */
export async function nombresDePersonas(prisma: PrismaService, ids: bigint[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.map(String))].map((x) => BigInt(x));
  if (unicos.length === 0) return new Map();
  const personas = await prisma.person.findMany({
    where: { party_id: { in: unicos } },
    select: { party_id: true, nombres: true, apellidos: true },
  });
  return new Map(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos || ''}`.trim()]));
}

@Injectable()
export class LineaTiempoService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(id: string, usuario?: UsuarioAutenticado) {
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    const p = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: { select: { listo_en: true, area: { select: { nombre: true } } } },
        historial: { orderBy: { en: 'asc' }, select: { estado_nuevo: true, en: true, por_party_id: true } },
        cobros: { where: { anulado_en: null }, orderBy: { en: 'desc' }, take: 1, select: { en: true } },
      },
    });
    if (!p) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    // Mismo aislamiento que el detalle: el repartidor solo ve lo suyo
    if (usuario?.rol === 'REPARTIDOR' && (p.repartidor_party_id == null || BigInt(p.repartidor_party_id) !== BigInt(usuario.partyId))) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }

    // Quién lo tomó: party_id si el canal es MOZO/CAJA; si falta, quien lo registró en el primer renglón del historial
    let atendidoPor: { partyId: string; nombre: string | null; rol: string | null; en: string } | null = null;
    if (CANALES_CON_ATENDIDO.includes(p.canal)) {
      const partyId = p.party_id ?? p.historial[0]?.por_party_id ?? null;
      if (partyId != null) {
        const [nombres, cuenta] = await Promise.all([
          nombresDePersonas(this.prisma, [partyId]),
          this.prisma.userAccount.findUnique({ where: { party_id: partyId }, select: { rol: true } }),
        ]);
        atendidoPor = {
          partyId: String(partyId),
          nombre: nombres.get(String(partyId)) ?? null,
          rol: cuenta?.rol ?? p.canal,
          en: p.creado_en.toISOString(),
        };
      }
    }

    const { etapas, totalSeg, completo } = construirLineaTiempo({
      ...p,
      lineas: p.lineas.map((l) => ({ area: l.area?.nombre ?? null, listo_en: l.listo_en })),
      cobro_en: p.cobros[0]?.en ?? null,
    });

    return {
      pedidoId: String(p.id),
      atendidoPor,
      canal: p.canal,
      modalidad: p.modalidad,
      mesa: p.mesa_nombre ?? null,
      etapas,
      totalSeg,
      completo,
    };
  }
}
