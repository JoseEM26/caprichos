import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { obtenerRangoHoyLima } from '../plano/plano.util';
import { armarSalonVivo, SalonVivo } from './salon-vivo.util';

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
          cobro_mozo_en: true, despachado_en: true, espera_personas: true,
          mesas: { select: { mesa_id: true, mesa_nombre: true, abierta: true } },
          comandas: { select: { estado: true, area: { select: { nombre: true } } } },
          lineas: { select: { nombre: true, cantidad: true } },
        },
      }),
      this.prisma.reserva.findMany({
        where: { estado: 'ACTIVA', hora: { gte: inicio, lte: fin } },
        orderBy: { hora: 'asc' },
        select: { id: true, nombre: true, personas: true, hora: true, pedido_id: true, mesas: { select: { mesa_id: true, mesa: { select: { nombre: true, numero: true } } } } },
      }),
      this.prisma.caja.findFirst({ where: { estado: 'ABIERTA' }, select: { id: true } }),
    ]);

    return armarSalonVivo({
      ahora,
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
        mesas: p.mesas.map((m) => ({ mesaId: m.mesa_id, nombre: m.mesa_nombre, abierta: m.abierta })),
      })),
      reservas: reservas.map((r) => ({
        id: r.id, nombre: r.nombre, personas: r.personas, hora: r.hora, pedido_id: r.pedido_id,
        mesas: r.mesas.map((m) => ({ mesaId: m.mesa_id, nombre: m.mesa?.nombre ?? (m.mesa?.numero ? `Mesa ${m.mesa.numero}` : null) })),
      })),
    });
  }
}
