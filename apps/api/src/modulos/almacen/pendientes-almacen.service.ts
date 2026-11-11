import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { controlAlmacenActivo } from '../stock';
import { EmitirPendientesDto, RecuentoInsumosDto } from './dto/pendientes-almacen.dto';
import { bloquearInsumo, lugarCocina, lugarPorNombre, moverInsumo, NOMBRE_ALMACEN, redondear3, saldoPendiente } from './stock-cocina';

const id = (v: string | number | bigint, que: string) => {
  try {
    return BigInt(v);
  } catch {
    throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: `El identificador de ${que} no es válido` });
  }
};

/**
 * «Pendientes de almacén»: lo que Cocina consumió sin tener (Cocina le debe a Almacén). Se emiten como traslado real
 * Almacén → Cocina y el recuento nocturno los puede resolver (AJUSTADO). Permisos del controlador: ver = almacen/ver,
 * emitir = almacen/emitir, ajustar el recuento = almacen/ajustar (solo Administrador y Almacén; Cocina no los tiene).
 */
@Injectable()
export class PendientesAlmacenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** Pendientes agrupados por insumo con el saldo de Cocina y de Almacén. `todos`: incluye los ya resueltos (últimos 200). */
  async listar(todos = false) {
    const activo = await controlAlmacenActivo(this.prisma);
    const filas = await this.prisma.pendienteAlmacen.findMany({
      where: todos ? {} : { estado: 'PENDIENTE' },
      include: { insumo: true },
      orderBy: { creado_en: 'asc' },
      take: todos ? 200 : 1000,
    });
    const insumoIds = [...new Set(filas.map((f) => f.insumo_id))];
    const stocks = insumoIds.length ? await this.prisma.stock.findMany({ where: { insumo_id: { in: insumoIds } }, include: { lugar: true } }) : [];
    const pedidoIds = [...new Set(filas.map((f) => f.pedido_id).filter((x): x is bigint => x != null))];
    const pedidos = pedidoIds.length ? await this.prisma.pedido.findMany({ where: { id: { in: pedidoIds } }, select: { id: true, codigo: true } }) : [];
    const codigo = new Map(pedidos.map((p) => [p.id.toString(), p.codigo]));

    const cocina = await lugarCocina(this.prisma);
    const grupos = new Map<string, any>();
    for (const f of filas) {
      const k = f.insumo_id.toString();
      if (!grupos.has(k)) {
        const sIns = stocks.filter((s) => s.insumo_id === f.insumo_id);
        grupos.set(k, {
          insumoId: k,
          nombre: f.insumo.nombre,
          unidad: f.insumo.unidad_almacen,
          saldoPendiente: 0,
          stockCocina: redondear3(sIns.filter((s) => s.lugar_id === cocina.id).reduce((a, s) => a + Number(s.cantidad), 0)),
          stockAlmacen: redondear3(sIns.filter((s) => s.lugar.tipo === 'ALMACEN').reduce((a, s) => a + Number(s.cantidad), 0)),
          pendientes: [],
        });
      }
      const g = grupos.get(k);
      const saldo = f.estado === 'PENDIENTE' ? saldoPendiente(f) : 0;
      g.saldoPendiente = redondear3(g.saldoPendiente + saldo);
      g.pendientes.push({
        id: f.id.toString(),
        cantidad: Number(f.cantidad),
        emitido: Number(f.emitido),
        ajustado: Number(f.ajustado),
        saldo,
        estado: f.estado,
        origen: f.origen_tipo === 'TANDA' ? `Tanda PRD-${f.produccion_id}` : `Pedido ${f.pedido_id ? (codigo.get(f.pedido_id.toString()) ?? f.pedido_id) : ''}`,
        pedidoId: f.pedido_id?.toString() ?? null,
        lineaId: f.pedido_linea_id?.toString() ?? null,
        produccionId: f.produccion_id?.toString() ?? null,
        creadoEn: f.creado_en,
        resueltoEn: f.resuelto_en,
      });
    }
    return { activo, grupos: [...grupos.values()] };
  }

  /**
   * Convierte el faltante en un traslado real Almacén → Cocina (se envía y se recibe en el acto: el insumo ya se usó).
   * Si Almacén no alcanza, emite lo que haya (parcial) y lo dice. Uno por uno, varios, o todos los de un insumo.
   */
  async emitir(dto: EmitirPendientesDto, usuario: UsuarioAutenticado, ip?: string) {
    if (!dto.ids?.length && (dto.insumoId === undefined || dto.insumoId === null || dto.insumoId === '')) {
      throw new BadRequestException({ codigo: 'NADA_QUE_EMITIR', mensaje: 'Indica qué pendientes emitir' });
    }
    const where: Prisma.PendienteAlmacenWhereInput = { estado: 'PENDIENTE' };
    if (dto.ids?.length) where.id = { in: dto.ids.map((x) => id(x, 'pendiente')) };
    else where.insumo_id = id(dto.insumoId!, 'insumo');
    const candidatos = await this.prisma.pendienteAlmacen.findMany({ where, select: { insumo_id: true, lugar_id: true } });
    const claves = new Map<string, { insumoId: bigint; lugarId: bigint }>();
    for (const c of candidatos) claves.set(`${c.insumo_id}|${c.lugar_id}`, { insumoId: c.insumo_id, lugarId: c.lugar_id });
    if (claves.size === 0) throw new BadRequestException({ codigo: 'SIN_PENDIENTES', mensaje: 'No hay pendientes por emitir' });

    const resultados: any[] = [];
    for (const { insumoId, lugarId } of [...claves.values()].sort((a, b) => (a.insumoId < b.insumoId ? -1 : 1))) {
      const r = await this.prisma.$transaction(async (tx) => {
        const almacen = await lugarPorNombre(tx, NOMBRE_ALMACEN);
        // El bloqueo del insumo serializa dos emisiones a la vez: la segunda ya no ve el saldo emitido
        await bloquearInsumo(tx, insumoId);
        const abiertos = (
          await tx.pendienteAlmacen.findMany({
            where: { ...where, insumo_id: insumoId, lugar_id: lugarId, estado: 'PENDIENTE' },
            orderBy: { creado_en: 'asc' },
          })
        ).filter((p) => saldoPendiente(p) > 0);
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId } });
        const total = redondear3(abiertos.reduce((a, p) => a + saldoPendiente(p), 0));
        const base = { insumoId: insumoId.toString(), nombre: insumo.nombre, unidad: insumo.unidad_almacen };
        if (total <= 0) return { ...base, emitido: 0, faltaAlmacen: 0, parcial: false };
        const stAlm = await tx.stock.findFirst({ where: { insumo_id: insumoId, lugar_id: almacen.id } });
        const disponible = Math.max(0, Number(stAlm?.cantidad ?? 0));
        const emitir = redondear3(Math.min(total, disponible));
        if (emitir > 0) {
          const ahora = new Date();
          const traslado = await tx.traslado.create({
            data: {
              insumo_id: insumoId,
              destino_lugar_id: lugarId,
              enviado: new Prisma.Decimal(emitir),
              recibido: new Prisma.Decimal(emitir),
              diferencia: new Prisma.Decimal(0),
              estado: 'RECIBIDO',
              enviado_por: usuario.partyId,
              enviado_en: ahora,
              recibido_por: usuario.partyId,
              recibido_en: ahora,
              nota: `Emisión de pendientes de almacén (${abiertos.map((p) => `#${p.id}`).join(', ')})`,
            },
          });
          await moverInsumo(tx, { insumoId, lugarId: almacen.id, delta: -emitir, tipo: 'TRASLADO_SALIDA', por: usuario.partyId, trasladoId: traslado.id, nota: `Emisión de pendientes a Cocina · TR-${traslado.id}` });
          await moverInsumo(tx, { insumoId, lugarId, delta: emitir, tipo: 'TRASLADO_ENTRADA', por: usuario.partyId, trasladoId: traslado.id, nota: `Emisión de pendientes de almacén · TR-${traslado.id}` });
          let resto = emitir;
          for (const p of abiertos) {
            if (resto <= 0) break;
            const saldo = saldoPendiente(p);
            const x = Math.min(saldo, resto);
            resto = redondear3(resto - x);
            await tx.pendienteAlmacen.update({
              where: { id: p.id },
              data: {
                emitido: { increment: new Prisma.Decimal(x) },
                traslado_id: traslado.id,
                ...(saldo - x <= 0 ? { estado: 'EMITIDO', resuelto_en: ahora, resuelto_por: usuario.partyId } : {}),
              },
            });
          }
        }
        const falta = redondear3(total - emitir);
        return { ...base, emitido: emitir, faltaAlmacen: falta, parcial: falta > 0 };
      });
      resultados.push(r);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'almacen',
      accion: 'EMITIR_PENDIENTES',
      entidad: 'pendiente_almacen',
      partyId: usuario.partyId,
      despues: { resultados },
      ip,
    });
    this.eventosGateway?.emitirAdmin('stock:cambio', {});
    return { ok: true, resultados };
  }

  /** Insumos para el recuento nocturno de un lugar, con lo que dice el sistema y lo pendiente (solo Cocina). */
  async listarRecuento(lugar: 'COCINA' | 'ALMACEN') {
    const esAlmacen = lugar === 'ALMACEN';
    const insumos = await this.prisma.insumo.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
    const lugar_ = esAlmacen ? await lugarPorNombre(this.prisma, NOMBRE_ALMACEN) : await lugarCocina(this.prisma);
    const stocks = await this.prisma.stock.findMany({ where: { insumo_id: { not: null }, lugar_id: lugar_.id } });
    const pend = esAlmacen ? [] : await this.prisma.pendienteAlmacen.findMany({ where: { estado: 'PENDIENTE' } });
    return insumos.map((i) => ({
      insumoId: i.id.toString(),
      nombre: i.nombre,
      unidad: i.unidad_almacen,
      sistema: redondear3(stocks.filter((s) => s.insumo_id === i.id).reduce((a, s) => a + Number(s.cantidad), 0)),
      pendiente: redondear3(pend.filter((p) => p.insumo_id === i.id).reduce((a, p) => a + saldoPendiente(p), 0)),
    }));
  }

  /**
   * Ajusta el stock del lugar a lo contado (movimiento DIFERENCIA_CONTEO con quién, motivo y auditoría). En Cocina, si
   * se contó MÁS de lo que decía el sistema, esa diferencia cubre los pendientes del insumo (del más viejo al más nuevo)
   * y los resueltos pasan a AJUSTADO.
   */
  async aplicarRecuento(dto: RecuentoInsumosDto, usuario: UsuarioAutenticado, ip?: string) {
    const esAlmacen = dto.lugar === 'ALMACEN';
    const motivo = dto.motivo?.trim() || '';
    const detalle: any[] = [];
    await this.prisma.$transaction(async (tx) => {
      const lugar = esAlmacen ? await lugarPorNombre(tx, NOMBRE_ALMACEN) : await lugarCocina(tx);
      const filas = [...dto.filas].sort((a, b) => (id(a.insumoId, 'insumo') < id(b.insumoId, 'insumo') ? -1 : 1));
      for (const fila of filas) {
        const insumoId = id(fila.insumoId, 'insumo');
        await bloquearInsumo(tx, insumoId);
        const st = await tx.stock.findFirst({ where: { insumo_id: insumoId, lugar_id: lugar.id } });
        const sistema = redondear3(Number(st?.cantidad ?? 0));
        const diff = redondear3(Number(fila.contado) - sistema);
        let resueltos = 0;
        if (diff !== 0) {
          await moverInsumo(tx, {
            insumoId,
            lugarId: lugar.id,
            delta: diff,
            tipo: 'DIFERENCIA_CONTEO',
            por: usuario.partyId,
            nota: `Recuento nocturno · ${esAlmacen ? 'Almacén' : 'Cocina'} · sistema ${sistema} → contado ${fila.contado}${motivo ? ` · ${motivo}` : ''}`,
          });
          if (!esAlmacen && diff > 0) {
            let resto = diff;
            const abiertos = await tx.pendienteAlmacen.findMany({ where: { insumo_id: insumoId, estado: 'PENDIENTE' }, orderBy: { creado_en: 'asc' } });
            for (const p of abiertos) {
              const saldo = saldoPendiente(p);
              if (resto <= 0 || saldo <= 0) continue;
              const x = Math.min(saldo, resto);
              resto = redondear3(resto - x);
              const cierra = saldo - x <= 0;
              await tx.pendienteAlmacen.update({
                where: { id: p.id },
                data: {
                  ajustado: { increment: new Prisma.Decimal(x) },
                  ...(cierra ? { estado: 'AJUSTADO', resuelto_en: new Date(), resuelto_por: usuario.partyId } : {}),
                },
              });
              if (cierra) resueltos++;
            }
          }
        }
        detalle.push({ insumoId: insumoId.toString(), sistema, contado: Number(fila.contado), diferencia: diff, pendientesResueltos: resueltos });
      }
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'almacen',
      accion: 'RECUENTO_INSUMOS',
      entidad: 'insumo',
      partyId: usuario.partyId,
      motivo: motivo || undefined,
      despues: { lugar: dto.lugar, filas: detalle },
      ip,
    });
    this.eventosGateway?.emitirAdmin('stock:cambio', {});
    return { ok: true, lugar: dto.lugar, filas: detalle };
  }
}
