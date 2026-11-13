import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, Logger, NotFoundException, Optional, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { inicioDiaLimaIso, sumarDiasIso } from '../../comun/fechas-lima';
import { montoACobrar } from '../../comun/monto-a-cobrar';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CobrosService } from '../caja/cobros.service';
import { aCentimos, enPesos, exigirCajaAbiertaHoy, registrarEgresoDevolucionCajaHoy } from '../caja/caja.calculo';
import { esComprobanteElegible, validarDocumentoComprobante } from '../comprobantes/comprobantes.util';
import { exigirDeliveryUbicado } from '../pedidos/delivery-ubicacion.util';
import { verificarTokenSeguimiento } from '../pedidos/seguimiento.tokens';
import { tieneRol } from '../acceso/roles-usuario';
import { usuarioSistema } from './usuario-sistema';
import { ErrorPasarela, MedioPagoOnline, PASARELA_PAGO, PasarelaPago, ResultadoCargo } from './pasarela.puerto';

export const MEDIOS_ONLINE: MedioPagoOnline[] = ['TARJETA', 'YAPE'];
const ESTADOS_VIVOS = ['CREADO', 'PROCESANDO', 'PENDIENTE', 'APROBADO'];
const MSG_PENDIENTE = 'Estamos confirmando tu pago. Te avisaremos en unos minutos.';
const MSG_COBRO_PENDIENTE = 'Recibimos tu pago. Un asesor confirmará tu pedido en unos minutos.';
const TAMANO_PAGINA = 20;

export interface Devolucion {
  id: string;
  monto_centimos: number;
  en: string;
  motivo: string;
  origen: 'SISTEMA' | 'WEBHOOK';
  /** CULQI (reembolso por la pasarela) o el medio con que se devolvió por fuera */
  medio?: string;
  movimiento_caja_id?: string;
}

export const MEDIOS_DEVOLUCION = ['CULQI', 'EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'];

function error(status: number, codigo: string, mensaje: string): HttpException {
  return new HttpException({ codigo, mensaje }, status);
}

@Injectable()
export class PagosOnlineService {
  private readonly logger = new Logger(PagosOnlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly cobros: CobrosService,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  // ---------------------------------------------------------------- configuración

  async estaActivo(): Promise<boolean> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'pago_online_activo' } }).catch(() => null);
    const v = String(p?.valor ?? 'no').replace(/"/g, '').toLowerCase().trim();
    return v === 'si' || v === 'sí' || v === 'true';
  }

  async config() {
    return {
      activo: await this.estaActivo(),
      publicKey: this.pasarela.publicKey,
      modo: this.pasarela.modo,
      medios: MEDIOS_ONLINE,
    };
  }

  private async exigirActivo() {
    if (!(await this.estaActivo())) {
      throw error(403, 'PAGO_ONLINE_APAGADO', 'El pago en línea no está disponible por ahora. Elige otro medio de pago.');
    }
  }

  // ---------------------------------------------------------------- intento

  /** Pedido apto para cobrarse en línea; el monto SIEMPRE sale de aquí (nunca del cliente). */
  private async validarPedido(pedidoId: bigint) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { planPago: true, cobros: { where: { anulado_en: null }, take: 1 } },
    });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'No encontramos tu pedido' });
    if (pedido.canal !== 'CARTA') throw error(409, 'PEDIDO_NO_APLICA', 'Este pedido no se puede pagar en línea');
    if (pedido.estado === 'ANULADO') throw error(409, 'PEDIDO_ANULADO', 'Este pedido fue anulado');
    if (pedido.es_personal || (pedido.planPago ?? []).length > 1) {
      throw error(409, 'PEDIDO_NO_APLICA', 'Este pedido no se puede pagar en línea');
    }
    if (pedido.pago_estado !== 'PENDIENTE_ONLINE' || (pedido.cobros ?? []).length) {
      throw error(409, 'YA_PAGADO', 'Este pedido ya tiene su pago registrado');
    }
    const montoCentimos = aCentimos(montoACobrar(pedido)) + aCentimos(pedido.propina ?? 0);
    if (montoCentimos <= 0) throw error(409, 'PEDIDO_NO_APLICA', 'Este pedido no tiene nada por pagar');
    // Lo que el cobro de Caja exigiría después: se revisa ANTES de cobrar al cliente
    const doc = validarDocumentoComprobante(pedido.comprobante_tipo, pedido.comprobante_doc, pedido.comprobante_razon, Number(pedido.total));
    if (!esComprobanteElegible(pedido.comprobante_tipo) || !doc.valido) {
      throw error(409, 'COMPROBANTE_INCOMPLETO', 'Faltan datos de tu comprobante. Un asesor te ayudará a completar el pago.');
    }
    try {
      exigirDeliveryUbicado(pedido);
    } catch {
      throw error(409, 'DELIVERY_SIN_UBICACION', 'Primero confirmamos la dirección de tu entrega. Un asesor te escribirá.');
    }
    try {
      await exigirCajaAbiertaHoy(this.prisma as any);
    } catch {
      throw error(409, 'LOCAL_SIN_CAJA', 'El local no está recibiendo pagos en línea ahora. Intenta más tarde o elige otro medio de pago.');
    }
    return { pedido, montoCentimos };
  }

  private respuestaIntento(i: { clave: string; monto_centimos: number; moneda: string }, codigo: string) {
    return {
      intentoId: i.clave,
      montoCentimos: i.monto_centimos,
      moneda: 'PEN' as const,
      descripcion: `Pedido ${codigo} - Caprichos`,
      publicKey: this.pasarela.publicKey,
      modo: this.pasarela.modo,
      medios: MEDIOS_ONLINE,
    };
  }

  /** Dueño del pedido: trae su token de seguimiento o tiene la sesión de cliente que lo creó. */
  async crearIntento(pedidoIdTexto: string | number, acceso: { seguimientoToken?: string; clientePartyId?: bigint | null }) {
    await this.exigirActivo();
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(pedidoIdTexto);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El pedido no es válido' });
    }
    const { pedido, montoCentimos } = await this.validarPedido(pedidoId);
    const esDuenoPorSesion = acceso.clientePartyId != null && pedido.cliente_party_id != null && BigInt(pedido.cliente_party_id) === BigInt(acceso.clientePartyId);
    if (!verificarTokenSeguimiento(pedido.id, acceso.seguimientoToken) && !esDuenoPorSesion) {
      throw new ForbiddenException({ codigo: 'SIN_ACCESO', mensaje: 'No puedes pagar este pedido desde aquí' });
    }

    const vivo = await this.prisma.pagoOnlineIntento.findFirst({ where: { pedido_id: pedido.id, estado: { in: ESTADOS_VIVOS } } });
    if (vivo) {
      if (vivo.estado === 'CREADO' && vivo.monto_centimos === montoCentimos && vivo.modo === this.pasarela.modo) {
        return this.respuestaIntento(vivo, pedido.codigo);
      }
      if (vivo.estado !== 'CREADO') throw error(409, 'PAGO_EN_CURSO', 'Ya hay un pago en curso o aprobado para este pedido');
      await this.prisma.pagoOnlineIntento.update({ where: { id: vivo.id }, data: { estado: 'FALLIDO', mensaje: 'Reemplazado: cambió el monto' } });
    }
    try {
      const nuevo = await this.prisma.pagoOnlineIntento.create({
        data: { clave: randomUUID(), pedido_id: pedido.id, modo: this.pasarela.modo, monto_centimos: montoCentimos },
      });
      return this.respuestaIntento(nuevo, pedido.codigo);
    } catch (e: any) {
      if (e?.code === 'P2002') throw error(409, 'PAGO_EN_CURSO', 'Ya hay un pago en curso o aprobado para este pedido');
      throw e;
    }
  }

  // ---------------------------------------------------------------- cargo

  private resultado(i: { estado: string; mensaje: string | null; cobro_error?: string | null }, pedidoCodigo: string) {
    let estado: ResultadoCargo;
    let mensaje: string;
    if (i.estado === 'APROBADO' || i.estado === 'DEVUELTO') {
      estado = i.cobro_error ? 'PENDIENTE' : 'APROBADO';
      mensaje = i.cobro_error?.startsWith('PEDIDO_ANULADO_DEVOLVER')
        ? 'Tu pedido ya se había anulado por falta de pago a tiempo. Te devolveremos el dinero.'
        : i.cobro_error ? MSG_COBRO_PENDIENTE : 'Pago aprobado. Tu pedido ya pasó a cocina.';
    } else if (i.estado === 'RECHAZADO' || i.estado === 'FALLIDO') {
      estado = 'RECHAZADO';
      mensaje = i.mensaje || 'No pudimos procesar tu pago. Prueba con otro medio.';
    } else {
      estado = 'PENDIENTE';
      mensaje = MSG_PENDIENTE;
    }
    return { estado, mensaje, pedidoCodigo };
  }

  async cargar(dto: { intentoId: string; token: string; medio: string; email?: string }) {
    await this.exigirActivo();
    const medio = String(dto.medio ?? '').toUpperCase() as MedioPagoOnline;
    if (!MEDIOS_ONLINE.includes(medio)) throw error(400, 'MEDIO_INVALIDO', 'Elige tarjeta o Yape');
    const token = String(dto.token ?? '').trim();
    if (token.length < 5 || token.length > 200) throw error(400, 'TOKEN_INVALIDO', 'No pudimos leer los datos de tu pago. Intenta de nuevo.');

    const intento = await this.prisma.pagoOnlineIntento.findUnique({ where: { clave: String(dto.intentoId ?? '') }, include: { pedido: { select: { id: true, codigo: true } } } });
    if (!intento) throw new NotFoundException({ codigo: 'INTENTO_NO_ENCONTRADO', mensaje: 'Este pago ya no existe. Vuelve a intentarlo.' });
    const codigo = intento.pedido.codigo;
    // Idempotencia: solo un intento CREADO se cobra; cualquier otro estado devuelve lo ya decidido
    if (intento.estado !== 'CREADO') return this.resultado(intento, codigo);

    // Revalida con el pedido de hoy: si cambió el monto o ya se pagó, no se cobra
    let montoCentimos: number;
    try {
      ({ montoCentimos } = await this.validarPedido(intento.pedido_id));
    } catch (e) {
      await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intento.id, estado: 'CREADO' }, data: { estado: 'FALLIDO', mensaje: (e as any)?.response?.mensaje ?? 'El pedido ya no se puede pagar en línea' } });
      throw e;
    }
    if (montoCentimos !== intento.monto_centimos) {
      await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intento.id, estado: 'CREADO' }, data: { estado: 'FALLIDO', mensaje: 'El total del pedido cambió' } });
      throw error(409, 'MONTO_CAMBIO', 'El total de tu pedido cambió. Vuelve a intentar el pago.');
    }

    // Toma el intento: de dos pedidos a la vez solo uno pasa a PROCESANDO y llama a Culqi
    const tomado = await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intento.id, estado: 'CREADO' }, data: { estado: 'PROCESANDO', medio } });
    if (tomado.count === 0) {
      const actual = await this.prisma.pagoOnlineIntento.findUnique({ where: { id: intento.id } });
      return this.resultado(actual ?? intento, codigo);
    }

    let cargo;
    try {
      cargo = await this.pasarela.cargar({
        montoCentimos: intento.monto_centimos,
        moneda: 'PEN',
        token,
        medio,
        email: this.correo(dto.email),
        descripcion: `Pedido ${codigo} - Caprichos`,
        metadata: { intento: intento.clave, pedido: codigo },
      });
    } catch (e) {
      // Resultado desconocido (red o tiempo agotado): puede haberse cobrado. NO se rechaza: el webhook lo concilia.
      this.logger.warn(`Cargo sin respuesta del proveedor (intento ${intento.id}): ${e instanceof ErrorPasarela ? 'sin respuesta' : 'error interno'}`);
      await this.prisma.pagoOnlineIntento.update({ where: { id: intento.id }, data: { estado: 'PENDIENTE', mensaje: MSG_PENDIENTE } });
      return { estado: 'PENDIENTE' as const, mensaje: MSG_PENDIENTE, pedidoCodigo: codigo };
    }

    const actualizado = await this.prisma.pagoOnlineIntento.update({
      where: { id: intento.id },
      data: {
        estado: cargo.estado,
        mensaje: cargo.mensaje,
        culqi_cargo_id: cargo.cargoId,
        marca: cargo.marca,
        ultimos4: cargo.ultimos4,
        aprobado_en: cargo.estado === 'APROBADO' ? new Date() : null,
      },
    });
    if (cargo.estado === 'APROBADO') await this.cobrarPedido(actualizado.id);
    const final = await this.prisma.pagoOnlineIntento.findUnique({ where: { id: intento.id } });
    return this.resultado(final ?? actualizado, codigo);
  }

  private correo(e?: string): string {
    const v = String(e ?? '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 120 ? v : process.env.CULQI_EMAIL_RESPALDO || 'pedidos@caprichos.pe';
  }

  /**
   * Pago aprobado -> cobro del pedido con el MISMO flujo de Caja (CobrosService.cobrar: cobro, comprobante, puntos),
   * y el pedido queda aprobado para cocina sin voucher ni revisión. Idempotente: un solo proceso lo toma.
   */
  async cobrarPedido(intentoId: bigint): Promise<void> {
    const toma = await this.prisma.pagoOnlineIntento.updateMany({
      where: { id: intentoId, estado: { in: ['APROBADO'] }, cobrado_en: null, cobro_error: null },
      data: { cobro_error: 'EN_CURSO' },
    });
    if (toma.count === 0) return;
    const intento = await this.prisma.pagoOnlineIntento.findUniqueOrThrow({ where: { id: intentoId } });
    try {
      const pedido = await this.prisma.pedido.findUniqueOrThrow({ where: { id: intento.pedido_id } });
      if (pedido.estado === 'ANULADO') {
        // Pagó cuando el pedido ya se había anulado (p. ej. por tiempo): no se revive; queda marcado para devolver y se avisa al ADMIN
        const motivo = 'PEDIDO_ANULADO_DEVOLVER: el cliente pagó con el pedido ya anulado';
        await this.prisma.pagoOnlineIntento.update({ where: { id: intentoId }, data: { cobro_error: motivo } });
        await this.prisma.notificacion
          .create({ data: { tipo: 'PAGO_ONLINE_A_DEVOLVER', rol_destino: 'ADMIN', titulo: 'Pago en línea de un pedido anulado: devolver', mensaje: `El pedido ${pedido.codigo} ya estaba anulado y el cliente pagó S/ ${enPesos(intento.monto_centimos).toFixed(2)}. Devuélvelo en Pagos en línea.`, enlace: '/admin/pagos-online' } })
          .catch(() => undefined);
        await this.auditoria.registrar({ categoria: 'CAMBIO', modulo: 'pagos_online', accion: 'PAGO_ONLINE_PEDIDO_ANULADO', resultado: 'OK', entidad: 'pedido', entidadId: pedido.id, despues: { cargo: intento.culqi_cargo_id, monto_centimos: intento.monto_centimos } });
        return;
      }
      const usuario = await usuarioSistema(this.prisma);
      const partyId = usuario.partyId;
      await this.cobros.cobrar(
        { pedidoId: pedido.id.toString(), pagos: [{ medio: intento.medio!, monto: enPesos(intento.monto_centimos) }] } as any,
        { ...usuario, partyId: usuario.partyId.toString() },
      );
      const ahora = new Date();
      await this.prisma.pedido.update({
        where: { id: pedido.id },
        data: {
          pago_coordinado_en: ahora,
          pago_coordinado_por: BigInt(partyId),
          pasa_cocina_en: pedido.pasa_cocina_en ?? ahora,
          // Recién ahora el pedido entra a cocina (la sincronización de comandas lo toma como a cualquier pedido en cola)
          ...(pedido.estado === 'POR_PAGAR' ? { estado: 'COLA' } : {}),
        },
      });
      if (pedido.estado === 'POR_PAGAR') {
        await this.prisma.pedidoEstadoHistorial
          .create({ data: { pedido_id: pedido.id, estado_anterior: 'POR_PAGAR', estado_nuevo: 'COLA', motivo: 'Pago en línea aprobado', por_party_id: BigInt(partyId) } })
          .catch(() => undefined);
        await this.prisma.notificacion
          .create({ data: { tipo: 'PEDIDO_NUEVO', rol_destino: null, titulo: `Pedido nuevo ${pedido.codigo}`, mensaje: `CARTA · pagado en línea · S/ ${enPesos(intento.monto_centimos).toFixed(2)}`, enlace: `/admin/caja?pedido=${pedido.id}` } })
          .catch(() => undefined);
        try {
          this.eventos?.emitirAdmin('pedido:estado', { id: pedido.id.toString(), codigo: pedido.codigo, estado: 'COLA' });
        } catch {
          // accesorio
        }
      }
      await this.prisma.pagoOnlineIntento.update({ where: { id: intentoId }, data: { cobrado_en: ahora, cobro_error: null } });
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'pagos_online', accion: 'PAGO_ONLINE_APROBADO', resultado: 'OK',
        entidad: 'pedido', entidadId: pedido.id,
        despues: { medio: intento.medio, monto_centimos: intento.monto_centimos, cargo: intento.culqi_cargo_id, modo: intento.modo },
      });
      try {
        this.eventos?.emitirAdmin('pedido:pago', { id: pedido.id.toString(), codigo: pedido.codigo, pago_estado: 'PAGADO', cambio: 'pago_online' });
        this.eventos?.emitirAdmin('cocina:comanda-actualizada', { pedidoId: pedido.id.toString() });
      } catch {
        // el aviso en vivo es accesorio
      }
    } catch (e: any) {
      const motivo = String(e?.response?.mensaje ?? e?.message ?? 'Error desconocido').slice(0, 300);
      this.logger.error(`Pago aprobado sin cobro registrado (intento ${intentoId}): ${motivo}`);
      await this.prisma.pagoOnlineIntento.update({ where: { id: intentoId }, data: { cobro_error: motivo } });
      await this.prisma.notificacion
        .create({
          data: {
            tipo: 'PAGO_ONLINE_SIN_COBRO',
            titulo: 'Pago en línea aprobado sin registrar',
            mensaje: `El cliente pagó pero el cobro no se registró (${motivo}). Revisa Pagos en línea.`,
            enlace: `/admin/pagos-online`,
          },
        })
        .catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------- webhook

  /** Autenticidad: firma HMAC-SHA256 del cuerpo o secreto compartido. En simulado (sin llaves) se acepta. */
  verificarWebhook(raw: Buffer | undefined, cab: Record<string, string | string[] | undefined>, secretoQuery?: string): void {
    if (this.pasarela.modo === 'SIMULADO') return;
    const secreto = process.env.CULQI_WEBHOOK_SECRET;
    if (!secreto) throw new UnauthorizedException({ codigo: 'WEBHOOK_SIN_SECRETO', mensaje: 'Webhook no configurado' });
    const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
    const firma = String(cab['x-culqi-signature'] ?? '').replace(/^sha256=/, '');
    if (firma && raw && igual(firma, createHmac('sha256', secreto).update(raw).digest('hex'))) return;
    const compartido = String(cab['x-webhook-secret'] ?? secretoQuery ?? '');
    if (compartido && igual(compartido, secreto)) return;
    throw new UnauthorizedException({ codigo: 'WEBHOOK_INVALIDO', mensaje: 'Firma no válida' });
  }

  async recibirWebhook(evento: any): Promise<{ recibido: true; duplicado?: boolean }> {
    const eventoId = typeof evento?.id === 'string' ? evento.id.slice(0, 120) : '';
    const tipo = typeof evento?.type === 'string' ? evento.type.slice(0, 80) : '';
    if (!eventoId || !tipo) throw error(400, 'EVENTO_INVALIDO', 'Evento no válido');
    try {
      await this.prisma.pagoOnlineEvento.create({ data: { evento_id: eventoId, tipo, payload: evento as Prisma.InputJsonValue } });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      const previo = await this.prisma.pagoOnlineEvento.findUnique({ where: { evento_id: eventoId } });
      // Ya procesado: se confirma sin repetir. Con error previo, se reintenta.
      if (previo && previo.estado !== 'ERROR') return { recibido: true, duplicado: true };
    }
    try {
      const estado = await this.conciliar(tipo, evento?.data);
      await this.prisma.pagoOnlineEvento.update({ where: { evento_id: eventoId }, data: { estado, error: null, procesado_en: new Date() } });
    } catch (e: any) {
      await this.prisma.pagoOnlineEvento.update({ where: { evento_id: eventoId }, data: { estado: 'ERROR', error: String(e?.message ?? e).slice(0, 300) } });
      throw e; // 500: Culqi reintenta
    }
    return { recibido: true };
  }

  private async conciliar(tipo: string, data: any): Promise<'PROCESADO' | 'IGNORADO'> {
    let d = data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch { return 'IGNORADO'; }
    }
    if (!d || typeof d !== 'object') return 'IGNORADO';

    if (tipo.startsWith('charge.')) {
      const clave = d.metadata?.intento;
      const intento = await this.prisma.pagoOnlineIntento.findFirst({
        where: { OR: [...(typeof d.id === 'string' ? [{ culqi_cargo_id: d.id }] : []), ...(typeof clave === 'string' ? [{ clave }] : [])] },
      });
      if (!intento) return 'IGNORADO';
      if (tipo === 'charge.creation.succeeded') {
        if (intento.estado === 'APROBADO' || intento.estado === 'DEVUELTO') return 'PROCESADO';
        if (!['PROCESANDO', 'PENDIENTE', 'CREADO'].includes(intento.estado)) return 'IGNORADO';
        // Nunca se aprueba por el webhook un monto distinto del que fijó el servidor
        if (typeof d.amount === 'number' && d.amount !== intento.monto_centimos) throw new Error('Monto del evento distinto al del intento');
        await this.prisma.pagoOnlineIntento.update({
          where: { id: intento.id },
          data: { estado: 'APROBADO', culqi_cargo_id: intento.culqi_cargo_id ?? (typeof d.id === 'string' ? d.id : null), medio: intento.medio ?? 'TARJETA', aprobado_en: new Date(), mensaje: 'Pago aprobado.' },
        });
        await this.cobrarPedido(intento.id);
        return 'PROCESADO';
      }
      if (tipo === 'charge.creation.failed' && ['PROCESANDO', 'PENDIENTE'].includes(intento.estado)) {
        await this.prisma.pagoOnlineIntento.update({ where: { id: intento.id }, data: { estado: 'RECHAZADO', mensaje: 'No pudimos procesar tu pago. Prueba con otro medio.' } });
        return 'PROCESADO';
      }
      return 'IGNORADO';
    }

    if (tipo === 'refund.creation.succeeded' && typeof d.charge_id === 'string' && typeof d.id === 'string') {
      const intento = await this.prisma.pagoOnlineIntento.findUnique({ where: { culqi_cargo_id: d.charge_id } });
      if (!intento) return 'IGNORADO';
      const lista = (intento.devoluciones as unknown as Devolucion[]) ?? [];
      if (lista.some((x) => x.id === d.id)) return 'PROCESADO';
      const monto = Number(d.amount);
      if (!Number.isInteger(monto) || monto <= 0) return 'IGNORADO';
      const nueva = [...lista, { id: d.id, monto_centimos: monto, en: new Date().toISOString(), motivo: 'Devolución hecha en Culqi', origen: 'WEBHOOK' as const, medio: 'CULQI' }];
      // max(): si la devolución la hizo este sistema, el monto ya estaba reservado y no se cuenta dos veces
      const total = Math.min(intento.monto_centimos, Math.max(intento.devuelto_centimos, nueva.reduce((s, x) => s + x.monto_centimos, 0)));
      await this.prisma.pagoOnlineIntento.update({
        where: { id: intento.id },
        data: { devoluciones: nueva as unknown as Prisma.InputJsonValue, devuelto_centimos: total, estado: total >= intento.monto_centimos ? 'DEVUELTO' : intento.estado },
      });
      return 'PROCESADO';
    }
    return 'IGNORADO';
  }

  // ---------------------------------------------------------------- admin

  async listar(q: { desde?: string; hasta?: string; estado?: string; pagina?: string | number }) {
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const donde: Prisma.PagoOnlineIntentoWhereInput = {};
    const rango: { gte?: Date; lt?: Date } = {};
    if (q.desde && /^\d{4}-\d{2}-\d{2}$/.test(q.desde)) rango.gte = inicioDiaLimaIso(q.desde);
    if (q.hasta && /^\d{4}-\d{2}-\d{2}$/.test(q.hasta)) rango.lt = inicioDiaLimaIso(sumarDiasIso(q.hasta, 1));
    if (rango.gte || rango.lt) donde.creado_en = rango;
    if (q.estado) donde.estado = String(q.estado).toUpperCase();
    const [total, filas] = await Promise.all([
      this.prisma.pagoOnlineIntento.count({ where: donde }),
      this.prisma.pagoOnlineIntento.findMany({
        where: donde,
        orderBy: { creado_en: 'desc' },
        skip: (pagina - 1) * TAMANO_PAGINA,
        take: TAMANO_PAGINA,
        include: { pedido: { select: { codigo: true, estado: true } } },
      }),
    ]);
    return {
      total,
      items: filas.map((f) => ({
        id: f.id.toString(),
        pedidoCodigo: f.pedido.codigo,
        pedidoEstado: f.pedido.estado,
        monto: enPesos(f.monto_centimos),
        medio: f.medio,
        estado: f.estado,
        culqiId: f.culqi_cargo_id,
        creadoEn: f.creado_en,
        devuelto: f.devuelto_centimos > 0,
        montoDevuelto: enPesos(f.devuelto_centimos),
        cobroPendiente: f.estado === 'APROBADO' && f.cobrado_en == null && !f.cobro_error?.startsWith('PEDIDO_ANULADO_DEVOLVER'),
        requiereDevolucion: f.cobro_error?.startsWith('PEDIDO_ANULADO_DEVOLVER') ?? false,
        devoluciones: ((f.devoluciones as unknown as Devolucion[]) ?? []).map((d) => ({ monto: enPesos(d.monto_centimos), medio: d.medio ?? 'CULQI', en: d.en })),
        modo: f.modo,
      })),
    };
  }

  async devolver(id: string, dto: { monto?: number; motivo: string; medio?: string; confirmar?: boolean }, usuario: any, ip?: string) {
    if (!tieneRol(usuario, 'ADMIN')) throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede devolver un pago' });
    const motivo = String(dto?.motivo ?? '').trim();
    if (motivo.length < 5) throw error(400, 'MOTIVO_REQUERIDO', 'El motivo debe tener al menos 5 caracteres');
    let intentoId: bigint;
    try { intentoId = BigInt(id); } catch { throw error(400, 'ID_INVALIDO', 'El identificador no es válido'); }
    const intento = await this.prisma.pagoOnlineIntento.findUnique({ where: { id: intentoId }, include: { pedido: { select: { codigo: true, estado: true } } } });
    if (!intento) throw new NotFoundException({ codigo: 'PAGO_NO_ENCONTRADO', mensaje: 'El pago no existe' });
    const medio = String(dto.medio ?? 'CULQI').toUpperCase();
    if (!MEDIOS_DEVOLUCION.includes(medio)) throw error(400, 'MEDIO_INVALIDO', 'El medio de devolución no es válido');
    if (!['APROBADO', 'DEVUELTO'].includes(intento.estado) || (medio === 'CULQI' && !intento.culqi_cargo_id)) throw error(409, 'PAGO_NO_APROBADO', 'Solo se devuelven pagos aprobados');
    // Pedido no anulado: el ADMIN debe confirmarlo de forma explícita
    if (intento.pedido.estado !== 'ANULADO' && dto.confirmar !== true) {
      throw error(409, 'CONFIRMAR_DEVOLUCION', 'El pedido no está anulado. Confirma que quieres devolver el dinero igual.');
    }
    const restante = intento.monto_centimos - intento.devuelto_centimos;
    const monto = dto.monto == null ? restante : aCentimos(dto.monto);
    if (!Number.isInteger(monto) || monto <= 0) throw error(400, 'MONTO_INVALIDO', 'El monto a devolver no es válido');
    if (monto > restante) throw error(409, 'MONTO_EXCEDE', `Solo se pueden devolver S/ ${enPesos(restante).toFixed(2)} más`);

    // Reserva el monto antes de llamar a Culqi: dos devoluciones a la vez no pasan del total
    const reserva = await this.prisma.pagoOnlineIntento.updateMany({
      where: { id: intento.id, devuelto_centimos: intento.devuelto_centimos },
      data: { devuelto_centimos: intento.devuelto_centimos + monto },
    });
    if (reserva.count === 0) throw error(409, 'DEVOLUCION_EN_CURSO', 'Hay otra devolución en curso. Intenta de nuevo.');
    let devolucionId: string;
    let movimientoCajaId: string | undefined;
    try {
      if (medio === 'CULQI') {
        ({ devolucionId } = await this.pasarela.devolver({ cargoId: intento.culqi_cargo_id!, montoCentimos: monto, motivo }));
      } else {
        // Devuelta por fuera de Culqi: solo se registra. En efectivo sale de la caja de hoy (egreso) para que el cierre cuadre.
        devolucionId = `${medio.toLowerCase()}_${intento.id}_${Date.now()}`;
        if (medio === 'EFECTIVO') {
          const mov = await this.prisma.$transaction((tx) => registrarEgresoDevolucionCajaHoy(tx, enPesos(monto), `Devolución pago en línea ${intento.pedido.codigo}`));
          movimientoCajaId = mov.id.toString();
        }
      }
    } catch (e: any) {
      await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intento.id }, data: { devuelto_centimos: { decrement: monto } } });
      await this.auditoria.registrar({ categoria: 'CAMBIO', modulo: 'pagos_online', accion: 'DEVOLUCION_FALLIDA', resultado: 'RECHAZADO', entidad: 'pago_online_intento', entidadId: intento.id, motivo, partyId: usuario?.partyId, ip, despues: { medio } });
      if (medio !== 'CULQI') throw e;
      throw error(502, 'DEVOLUCION_RECHAZADA', `Culqi no aceptó la devolución: ${String(e?.message ?? 'sin detalle').slice(0, 150)}`);
    }
    const actual = await this.prisma.pagoOnlineIntento.findUniqueOrThrow({ where: { id: intento.id } });
    const lista = (actual.devoluciones as unknown as Devolucion[]) ?? [];
    const nueva = lista.some((x) => x.id === devolucionId) ? lista : [...lista, { id: devolucionId, monto_centimos: monto, en: new Date().toISOString(), motivo, origen: 'SISTEMA' as const, medio, ...(movimientoCajaId ? { movimiento_caja_id: movimientoCajaId } : {}) }];
    await this.prisma.pagoOnlineIntento.update({
      where: { id: intento.id },
      data: { devoluciones: nueva as unknown as Prisma.InputJsonValue, estado: actual.devuelto_centimos >= actual.monto_centimos ? 'DEVUELTO' : actual.estado },
    });
    // Devolución TOTAL: se anula también el cobro de Caja (y con él la boleta o factura se da de baja) por el mismo
    // camino de «anular cobro». Parcial: el cobro queda. El efectivo no se resta dos veces: el cobro es TARJETA o YAPE
    // (sin efectivo), así que anularlo no mueve el efectivo; solo el egreso de esta devolución lo baja.
    let cobroAnulado: { anulado: boolean; aviso: string | null } = { anulado: false, aviso: null };
    if (actual.devuelto_centimos >= actual.monto_centimos) cobroAnulado = await this.anularCobroDeCaja(intento.pedido_id, motivo, usuario, ip);

    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'pagos_online', accion: 'DEVOLUCION_PAGO_ONLINE', resultado: 'OK',
      entidad: 'pago_online_intento', entidadId: intento.id, motivo, partyId: usuario?.partyId, ip,
      antes: { devuelto_centimos: intento.devuelto_centimos },
      despues: {
        cobro_anulado: cobroAnulado.anulado, aviso_cobro: cobroAnulado.aviso, devuelto_centimos: actual.devuelto_centimos, devolucion: devolucionId, medio, movimiento_caja_id: movimientoCajaId ?? null, monto_centimos: monto, pedido: intento.pedido.codigo, pedido_anulado: intento.pedido.estado === 'ANULADO' },
    });
    return { id: intento.id.toString(), devolucionId, medio, cobroAnulado: cobroAnulado.anulado, avisoCobro: cobroAnulado.aviso, montoDevuelto: enPesos(monto), totalDevuelto: enPesos(actual.devuelto_centimos), restante: enPesos(actual.monto_centimos - actual.devuelto_centimos) };
  }

  /**
   * Anula el cobro vigente del pedido con el flujo de Caja. Caja del cobro abierta: anulación normal. Caja ya cerrada:
   * anulación de caja cerrada (solo ADMIN, motivo de 10+ caracteres; necesita la caja de hoy abierta). Si no se puede,
   * la devolución ya hecha se conserva y se explica por qué quedó el cobro: se resuelve a mano en Caja.
   */
  private async anularCobroDeCaja(pedidoId: bigint, motivo: string, usuario: any, ip?: string): Promise<{ anulado: boolean; aviso: string | null }> {
    const cobro = await this.prisma.cobro.findFirst({ where: { pedido_id: pedidoId, anulado_en: null }, select: { id: true, caja: { select: { estado: true } } } });
    if (!cobro) return { anulado: false, aviso: null }; // ya anulado (p. ej. al anular el pedido)
    const dto = { motivo: `Devolución total del pago en línea: ${motivo}`.slice(0, 250) };
    try {
      if (cobro.caja.estado === 'ABIERTA') await this.cobros.anularCobro(cobro.id, dto, usuario, ip);
      else await this.cobros.anularCobroCajaCerrada(cobro.id, dto, usuario, ip);
      return { anulado: true, aviso: null };
    } catch (e: any) {
      const aviso = `El dinero se devolvió, pero el cobro en Caja no se pudo anular (${String(e?.response?.mensaje ?? e?.message ?? 'sin detalle').slice(0, 150)}). Anúlalo en Caja.`;
      this.logger.warn(`Devolución total sin anular el cobro (pedido ${pedidoId}): ${aviso}`);
      return { anulado: false, aviso };
    }
  }
}
