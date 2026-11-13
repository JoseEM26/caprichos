import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { ErrorCredencialesEmisor, ErrorRedEmisor } from './emisor/emisor.tipos';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { EmisorXml, LineaResumen, armarResumenDiarioXml } from './sunat/sunat.xml';
import { bytes, fechaIsoLima, yyyymmddLima } from './sunat/sunat.util';
import { siguienteCorrelativo } from './secuencia';
import { CLAVES_FACTURACION, interpretarConfig } from './facturacion/facturacion.config';

/** Cada 2 minutos: reenvía resúmenes sin respuesta, consulta tickets pendientes y, de 22:30 a 22:39 (Lima), envía el resumen diario. */
export const INTERVALO_SUNAT_MS = 2 * 60 * 1000;
/** Máximo de boletas por resumen diario (SUNAT). */
export const MAX_LINEAS_RESUMEN = 500;

const TTL_CANDADO_MS = 280000;

/** Hora y minuto en Lima (para la ventana de 22:30). */
export function horaMinutoLima(fecha: Date): { h: number; m: number } {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  return { h: Number(p.find((x) => x.type === 'hour')?.value), m: Number(p.find((x) => x.type === 'minute')?.value) };
}

/**
 * Resúmenes de SUNAT directo: resumen diario de boletas (RC), comunicaciones de baja de facturas (RA) y
 * seguimiento de tickets. Cada resumen queda en la tabla sunat_resumen con su ZIP y su CDR.
 * ponytail: un setInterval por proceso; el candado Redis evita el doble envío entre contenedores.
 */
@Injectable()
export class ComprobantesSunatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComprobantesSunatService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sunat?: SunatEmisor,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly salud?: ComprobantesSaludService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick().catch((e) => this.logger.error(`Tarea SUNAT: ${e?.message ?? e}`));
    }, INTERVALO_SUNAT_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Una pasada con candado: reenvíos, tickets y, en la ventana de 22:30, el resumen diario. */
  async tick(ahora = new Date()): Promise<{ motivo?: string }> {
    if (!this.sunat || !this.sunat.disponible()) return { motivo: 'SIN_CONFIGURAR' };
    if (await this.salud?.circuitoAbierto(ahora)) return { motivo: 'CIRCUITO_ABIERTO' };
    const cliente = this.redis?.obtenerCliente() ?? null;
    const clave = 'lock:comprobantes:sunat';
    const candado = await adquirirCandado(cliente, clave, TTL_CANDADO_MS);
    if (!candado.adquirido) return { motivo: 'OTRO_CONTENEDOR' };
    try {
      await this.reenviarPendientes();
      await this.consultarTickets();
      const { h, m } = horaMinutoLima(ahora);
      if (h === 22 && m >= 30 && m < 40) await this.resumenDiario(ahora);
    } finally {
      await liberarCandado(cliente, clave, candado.token).catch(() => {});
    }
    return {};
  }

  /** Arma y envía los resúmenes diarios de boletas pendientes (uno por fecha y hasta 500 líneas). */
  async resumenDiario(ahora = new Date()): Promise<{ resumenes: number; boletas: number }> {
    if (!this.sunat || !this.sunat.disponible()) return { resumenes: 0, boletas: 0 };
    const filas = await this.prisma.comprobante.findMany({
      where: {
        tipo: 'BOLETA',
        emisor: 'SUNAT',
        OR: [
          { facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null },
          { facturacion_estado: 'EMITIDO_SUNAT', baja_estado: 'PENDIENTE_RESUMEN' },
        ],
      },
      orderBy: { creado_en: 'asc' },
      take: 5000,
    });
    if (filas.length === 0) return { resumenes: 0, boletas: 0 };

    const porFecha = new Map<string, typeof filas>();
    for (const f of filas) {
      const dia = fechaIsoLima(f.creado_en);
      porFecha.set(dia, [...(porFecha.get(dia) ?? []), f]);
    }

    const emisor: EmisorXml = await this.sunat.emisorXml();
    const igvPct = await this.igvPct();
    let resumenes = 0;
    for (const [dia, grupo] of porFecha) {
      for (let i = 0; i < grupo.length; i += MAX_LINEAS_RESUMEN) {
        const trozo = grupo.slice(i, i + MAX_LINEAS_RESUMEN);
        const lineas: LineaResumen[] = trozo.map((b) => ({
          serie: b.serie as string,
          numero: b.numero as number,
          documento: b.documento && /^\d{8}$/.test(b.documento) ? b.documento : null,
          totalCents: b.sunat_total_cents ?? 0,
          igvCents: b.sunat_igv_cents ?? 0,
          estado: b.facturacion_estado === 'PENDIENTE_RESUMEN' && b.baja_estado === null ? 1 : 3,
        }));
        const fechaEmision = yyyymmddLima(ahora);
        const n = await siguienteCorrelativo(this.prisma, `RC${fechaEmision}`);
        const nombre = `${emisor.ruc}-RC-${fechaEmision}-${n}`;
        // El ID del XML es RC-AAAAMMDD-n; el RUC solo va en el nombre del archivo
        const xml = armarResumenDiarioXml({ idDoc: `RC-${fechaEmision}-${n}`, emisor, fechaEmision: ahora, fechaRef: dia, igvPct, lineas });
        const firmado = this.sunat.firmarDocumento(xml, nombre);
        const resumen = await this.prisma.sunatResumen.create({
          data: {
            tipo: 'RC',
            nombre,
            fecha_referencia: new Date(`${dia}T00:00:00-05:00`),
            estado: 'PENDIENTE_ENVIO',
            xml: bytes(firmado.xml),
            zip: bytes(firmado.zip),
          },
        });
        // Las boletas quedan ligadas al resumen antes de enviarlo: si la respuesta se pierde, se reenvía el mismo ZIP
        for (const b of trozo) {
          if (b.facturacion_estado === 'PENDIENTE_RESUMEN' && b.baja_estado === null) {
            await this.prisma.comprobante.update({
              where: { id: b.id },
              data: { facturacion_estado: 'ENVIADA_RESUMEN', resumen_emision_id: resumen.id, facturacion_respuesta: `En el resumen ${nombre}` },
            });
          } else {
            await this.prisma.comprobante.update({
              where: { id: b.id },
              data: { baja_estado: 'SOLICITADA', resumen_baja_id: resumen.id, baja_respuesta: `En el resumen ${nombre}` },
            });
          }
        }
        await this.enviarGuardado(resumen.id);
        resumenes++;
      }
    }
    return { resumenes, boletas: filas.length };
  }

  /** Porcentaje de IGV vigente (parámetro facturacion_igv_pct). */
  private async igvPct(): Promise<number> {
    const filas = await this.prisma.parametro.findMany({
      where: { clave: CLAVES_FACTURACION.igv },
    });
    const valores: Record<string, unknown> = {};
    for (const f of filas) valores[f.clave] = f.valor;
    return interpretarConfig(valores).igvPct;
  }

  /**
   * Envía la comunicación de baja de una factura (RA) y guarda el resumen con su ticket.
   * Sin respuesta de SUNAT lanza ErrorRedEmisor y no guarda nada (el llamador responde 503).
   */
  async enviarBajaFactura(nombre: string, xml: Buffer, zip: Buffer): Promise<{ estado: 'SOLICITADA' | 'RECHAZADA'; respuesta: string; resumenId: bigint }> {
    if (!this.sunat) throw new ErrorRedEmisor('SUNAT no está configurado');
    const r = await this.sunat.enviarResumen(nombre, zip);
    const rechazo = 'rechazo' in r;
    const resumen = await this.prisma.sunatResumen.create({
      data: {
        tipo: 'RA',
        nombre,
        fecha_referencia: new Date(),
        ticket: rechazo ? null : r.ticket,
        estado: rechazo ? 'RECHAZADO' : 'ENVIADO',
        respuesta: rechazo ? r.rechazo : 'Ticket recibido: pendiente de respuesta de SUNAT',
        xml: bytes(xml),
        zip: bytes(zip),
      },
    });
    return {
      estado: rechazo ? 'RECHAZADA' : 'SOLICITADA',
      respuesta: rechazo ? r.rechazo : `Ticket ${r.ticket}`,
      resumenId: resumen.id,
    };
  }

  /** Reenvía los resúmenes que quedaron sin respuesta, con el mismo ZIP. */
  async reenviarPendientes(): Promise<void> {
    const pendientes = await this.prisma.sunatResumen.findMany({ where: { estado: 'PENDIENTE_ENVIO' }, select: { id: true }, take: 20 });
    for (const p of pendientes) await this.enviarGuardado(p.id);
  }

  /** Envía un resumen guardado y aplica el resultado a las boletas (emisión) y facturas/boletas (baja). */
  private async enviarGuardado(id: bigint): Promise<void> {
    const fila = await this.prisma.sunatResumen.findUnique({ where: { id } });
    if (!fila || !this.sunat) return;
    let r: { ticket: string } | { rechazo: string };
    try {
      r = await this.sunat.enviarResumen(fila.nombre, Buffer.from(fila.zip));
    } catch (e) {
      if (e instanceof ErrorCredencialesEmisor) {
        await this.salud?.registrarCredenciales();
        return;
      }
      if (e instanceof ErrorRedEmisor) {
        await this.salud?.registrarFallo();
        return; // sigue PENDIENTE_ENVIO; se reintenta en el siguiente tick (mismo ZIP)
      }
      throw e;
    }
    await this.salud?.registrarExito();
    if ('rechazo' in r) {
      await this.prisma.sunatResumen.update({ where: { id }, data: { estado: 'RECHAZADO', respuesta: r.rechazo } });
      await this.aplicar(id, 'RECHAZADO', r.rechazo);
      return;
    }
    await this.prisma.sunatResumen.update({
      where: { id },
      data: { estado: 'ENVIADO', ticket: r.ticket, respuesta: 'Ticket recibido: pendiente de respuesta de SUNAT' },
    });
  }

  /** Consulta los tickets enviados y aplica el CDR cuando SUNAT responde. */
  async consultarTickets(): Promise<void> {
    if (!this.sunat) return;
    const enviados = await this.prisma.sunatResumen.findMany({ where: { estado: 'ENVIADO', ticket: { not: null } }, take: 50 });
    for (const e of enviados) {
      let estado;
      try {
        estado = await this.sunat.consultarTicket(e.ticket as string);
      } catch (err) {
        if (err instanceof ErrorCredencialesEmisor) {
          await this.salud?.registrarCredenciales();
          break;
        }
        if (err instanceof ErrorRedEmisor) {
          await this.salud?.registrarFallo();
          continue;
        }
        throw err;
      }
      await this.salud?.registrarExito();
      if (estado.estado === 'EN_PROCESO') continue;
      const aceptado = estado.estado === 'ACEPTADO';
      await this.prisma.sunatResumen.update({
        where: { id: e.id },
        data: {
          estado: aceptado ? 'ACEPTADO' : 'RECHAZADO',
          respuesta: estado.respuesta.slice(0, 1000),
          ...(estado.cdr ? { cdr: bytes(estado.cdr.xml) } : {}),
        },
      });
      await this.aplicar(e.id, aceptado ? 'ACEPTADO' : 'RECHAZADO', estado.respuesta);
    }
  }

  /** Lleva el resultado del resumen a sus comprobantes: boletas (emisión) y comprobantes con baja. */
  private async aplicar(id: bigint, estado: 'ACEPTADO' | 'RECHAZADO', respuesta: string): Promise<void> {
    const texto = respuesta.slice(0, 1000);
    const ahora = new Date();
    const aceptado = estado === 'ACEPTADO';
    const emision: Prisma.ComprobanteUpdateManyMutationInput = aceptado
      ? { facturacion_estado: 'EMITIDO_SUNAT', emision: 'EMITIDO', emitido_en: ahora, facturacion_respuesta: texto }
      : { facturacion_estado: 'RECHAZADO', emision: 'POR_EMITIR', facturacion_respuesta: texto };
    await this.prisma.comprobante.updateMany({ where: { resumen_emision_id: id, facturacion_estado: 'ENVIADA_RESUMEN' }, data: emision });
    await this.prisma.comprobante.updateMany({
      where: { resumen_baja_id: id, baja_estado: 'SOLICITADA' },
      data: { baja_estado: aceptado ? 'ACEPTADA' : 'RECHAZADA', baja_respuesta: texto, ...(aceptado ? { baja_en: ahora } : {}) },
    });
  }
}
