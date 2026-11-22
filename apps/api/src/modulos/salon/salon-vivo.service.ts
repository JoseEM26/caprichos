import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { obtenerRangoHoyLima } from '../plano/plano.util';
import { celularValido } from '../clientes/party-puntos.service';
import { armarSalonVivo, AvatarVivo, SalonVivo } from './salon-vivo.util';

/** Salón en vivo (solo lectura): plano real + estado de mesas, cocina, despacho y reparto del día de Lima. */
@Injectable()
export class SalonVivoService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(ahora: Date = new Date()): Promise<SalonVivo> {
    const { inicio, fin } = obtenerRangoHoyLima(ahora);

    const [pisos, pedidos, reservas, caja] = await Promise.all([
      this.prisma.piso.findMany({
        where: { activo: true },
        orderBy: { id: 'asc' },
        include: { elementos: { orderBy: [{ numero: 'asc' }, { id: 'asc' }] } },
      }),
      this.prisma.pedido.findMany({
        where: { creado_en: { gte: inicio, lte: fin }, es_personal: false },
        select: {
          id: true, codigo: true, modalidad: true, estado: true, cliente_nombre: true, pago_estado: true,
          creado_en: true, pasa_cocina_en: true, listo_en: true, entregado_mesa_en: true, entregado_en: true,
          cobro_mozo_en: true, despachado_en: true, espera_personas: true, party_id: true, cliente_telefono: true,
          mesas: { select: { mesa_id: true, mesa_nombre: true, abierta: true } },
          comandas: { select: { estado: true, area: { select: { nombre: true } } } },
          lineas: { select: { nombre: true, cantidad: true, producto: { select: { categoria: { select: { nombre: true } } } } } },
        },
      }),
      this.prisma.reserva.findMany({
        where: { estado: 'ACTIVA', hora: { gte: inicio, lte: fin } },
        orderBy: { hora: 'asc' },
        select: { id: true, nombre: true, personas: true, hora: true, pedido_id: true, mesas: { select: { mesa_id: true, mesa: { select: { nombre: true, numero: true } } } } },
      }),
      this.prisma.caja.findFirst({ where: { estado: 'ABIERTA' }, select: { id: true } }),
    ]);

    // Pedido sin party: se une por el celular del pedido con la cuenta de cliente de ese celular (solo para sacar su avatar)
    const celulares = [...new Set(pedidos.filter((p) => p.party_id == null).map((p) => celularValido(p.cliente_telefono)).filter((x): x is string => !!x))];
    const partyPorCelular = new Map<string, bigint>();
    if (celulares.length) {
      const cuentas = await this.prisma.customerAccount.findMany({ where: { telefono: { in: celulares }, activo: true }, select: { telefono: true, party_id: true } });
      for (const c of cuentas) if (c.telefono) partyPorCelular.set(c.telefono, c.party_id);
    }
    const partyDe = (p: { party_id: bigint | null; cliente_telefono: string | null }): bigint | null =>
      p.party_id ?? partyPorCelular.get(celularValido(p.cliente_telefono) ?? '') ?? null;

    // Avatares de los clientes de todos los pedidos en UNA consulta (sin N+1); solo retrato y configuración
    const partyIds = [...new Set(pedidos.map(partyDe).filter((x): x is bigint => x != null))];
    const avatares = new Map<string, AvatarVivo>();
    if (partyIds.length) {
      const personas = await this.prisma.person.findMany({
        where: { party_id: { in: partyIds } },
        select: { party_id: true, avatar_url: true, avatar_config: true },
      });
      for (const pe of personas) {
        if (pe.avatar_url || pe.avatar_config) avatares.set(String(pe.party_id), { url: pe.avatar_url ?? null, config: (pe.avatar_config as object | null) ?? null });
      }
    }

    return armarSalonVivo({
      ahora,
      avatares,
      cajaAbierta: !!caja,
      pisos: pisos.map((p) => ({
        id: String(p.id),
        nombre: p.nombre,
        cuadriculaAncho: p.cuadricula_ancho,
        cuadriculaAlto: p.cuadricula_alto,
        elementos: p.elementos.map((e) => ({
          id: String(e.id), tipo: e.tipo, nombre: e.nombre, x: e.x, y: e.y, ancho: e.ancho, alto: e.alto,
          numero: e.numero, asientos: e.asientos, activo: e.activo,
        })),
      })),
      pedidos: pedidos.map((p) => ({
        ...p,
        party_id: partyDe(p),
        mesas: p.mesas.map((m) => ({ mesaId: m.mesa_id, nombre: m.mesa_nombre, abierta: m.abierta })),
      })),
      reservas: reservas.map((r) => ({
        id: r.id, nombre: r.nombre, personas: r.personas, hora: r.hora, pedido_id: r.pedido_id,
        mesas: r.mesas.map((m) => ({ mesaId: m.mesa_id, nombre: m.mesa?.nombre ?? (m.mesa?.numero ? `Mesa ${m.mesa.numero}` : null) })),
      })),
    });
  }
}
