import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { enmascararTelefono, telefonoEnviable } from '../utilidades/enmascarar.util';
import { CargaSaliente, OutboxWhatsappService } from './outbox-whatsapp.service';
import { EtapaAvisoReparto, ResumenRecibido, TEXTOS_REPARTO, PayloadAvisoReparto, conBienvenidaPuntos, conPlantillaUbicacion, conPuntosEntregado } from '../conversacion/textos-reparto';
import { partyClienteDelPedido } from '../../clientes/cliente-del-pedido';
import { urlPublicaCarta } from './carrusel.util';
import { parametroActivoConDefecto, whatsappSimulado } from '../utilidades/modo-whatsapp.util';
import { marcarPagoParaPersona } from './pago-para-persona.util';
import { calcularEtaEntrega, formatearEta, leerConfigEta } from '../../repartos/eta-entrega';
import { montoDigitalDePlan } from '../../pedidos/pago-plan.service';
import { mediosPagoPublicos } from '../../local/local.service';
import { detalleDatosPago } from '../conversacion/flujos/pago/textos-pago';
import { enlaceSeguimientoCarta } from '../../pedidos/seguimiento.tokens';

/**
 * Número de etapa en `mensaje_reparto` (PK pedido_id + numero = idempotencia por pedido y etapa)
 * y el parámetro de activación que la habilita.
 */
export const ETAPAS_AVISO: Record<
  EtapaAvisoReparto,
  { numero: number; parametro: string; cualquierModalidad?: boolean }
> = {
  // Un repartidor tomó el pedido (o caja lo reasignó). Activo por defecto aunque el parámetro no exista.
  ASIGNADO: { numero: 15, parametro: 'whatsapp_aviso_asignado_activo' },
  SALIDA: { numero: 1, parametro: 'whatsapp_aviso_salida_activo' },
  LLEGADA: { numero: 2, parametro: 'whatsapp_aviso_llegada_activo' },
  INSISTENCIA: { numero: 3, parametro: 'whatsapp_aviso_llegada_activo' },
  ESPERA_AGOTADA: { numero: 4, parametro: 'whatsapp_aviso_espera_activo' },
  RETIRO: { numero: 5, parametro: 'whatsapp_aviso_espera_activo' },
  ACEPTADO: { numero: 6, parametro: 'whatsapp_aviso_pago_confirmado_activo' },
  LISTO: { numero: 7, parametro: 'whatsapp_aviso_listo_activo' },
  ENTREGADO: { numero: 8, parametro: 'whatsapp_aviso_entregado_activo' },
  // Pedido de la carta virtual recién creado: vale para cualquier modalidad
  RECIBIDO: { numero: 9, parametro: 'whatsapp_aviso_recibido_activo', cualquierModalidad: true },
  // Reprogramación tras el retiro: el reenvío y los cierres comparten la activación de espera/retiro
  REENVIADO: { numero: 10, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_RECIBIDA: { numero: 11, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_CANCELADA: { numero: 12, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_SIN_RESPUESTA: { numero: 13, parametro: 'whatsapp_aviso_espera_activo' },
  // Recordatorio del voucher de un pedido digital de la carta que aún no lo envió (una vez por pedido)
  // Recojo / para llevar listo (Despacho): comparte el parámetro del aviso de recojo. Usa el numero 7 del LISTO:
  // un pedido es delivery o recojo, así no hace falta ampliar el CHECK de mensaje_reparto con una migración.
  LISTO_RECOJO: { numero: 7, parametro: 'whatsapp_aviso_recojo_activo', cualquierModalidad: true },
  VOUCHER_RECORDATORIO: { numero: 14, parametro: 'whatsapp_aviso_voucher_recordatorio_activo', cualquierModalidad: true },
};

type ExtraPuntos =
  | { tipo: 'BIENVENIDA'; enlace: string }
  | { tipo: 'PUNTOS'; ganados: number; total: number };

/** Medios digitales que llevan voucher y pasan la conversación a una persona. Nombre que se lee al cliente. */
const MEDIOS_DIGITALES: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'transferencia',
};

/**
 * Etapas del intento de entrega: al retirar la movilidad se borran para que el nuevo intento avise otra vez.
 * La 5 (pregunta RETIRO) guarda la respuesta del cliente; la 10 (REENVIADO) es el aviso de reenvío.
 */
export const NUMEROS_INTENTO = [1, 2, 3, 4, 5, 10, 15];

export const esParametroActivo = (valor: unknown) =>
  valor === true || String(valor).toLowerCase() === 'si';

export interface ResultadoAviso {
  /** ENCOLADO: queda en el outbox y sale al enviarse el lote (o al reintentarse). */
  estado: 'ENCOLADO' | 'FALLIDO' | 'OMITIDO' | 'YA_ENVIADO';
  motivo?: string;
}

export interface DatosAviso {
  /** INSISTENCIA: minutos esperando en la puerta. */
  minutos?: number;
  /** RETIRO: recargo de reprogramación en soles (el mismo que se cobra al reenviar). */
  recargo?: number;
  /** RETIRO: modo del recargo, solo para explicar al cliente que es el costo del delivery. */
  recargoModo?: 'IGUAL_ENVIO' | 'FIJO' | 'SIN_COSTO';
  /** ASIGNADO: nombre de pila del repartidor (se lee del pedido al avisar). */
  repartidorNombre?: string;
  /** SALIDA: rango del tiempo estimado («25 a 30»), calculado al avisar. */
  tiempoTexto?: string | null;
  /** RECIBIDO: enlace de seguimiento del pedido (null si no hay origen público configurado). */
  enlaceSeguimiento?: string | null;
  /** RECIBIDO efectivo: usar la plantilla con enlace (solo si Meta ya la aprobó y el parámetro está en «Sí»). */
  plantillaSeguimiento?: boolean;
  /** RECIBIDO delivery sin ubicación: usar las plantillas que piden la ubicación (parámetro whatsapp_plantilla_delivery_ubicacion_activa). */
  plantillaUbicacion?: boolean;
  /** RECIBIDO: productos, total, medio y estado del envío (se arma al avisar). */
  resumen?: ResumenRecibido | null;
  /** RECIBIDO con pago digital: bloque «número, titular y monto» (se arma al avisar). */
  datosPago?: string | null;
}

/**
 * Único punto que envía avisos al cliente en cada etapa de un pedido delivery.
 * Idempotente: el registro en mensaje_reparto (pedido_id, numero) se inserta antes de enviar;
 * si ya existe, no se vuelve a enviar. Nunca lanza error: un aviso fallido no debe frenar el reparto.
 */
@Injectable()
export class AvisosPedidoService {
  private readonly logger = new Logger(AvisosPedidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWhatsappService,
  ) {}

  /**
   * Encola el aviso de una etapa del reparto. Sin `tx` abre su propia transacción y despierta el envío
   * al confirmarla. Con `tx` (el emisor ya tiene una transacción de cambio de estado) el encolado va en
   * esa misma transacción y el emisor debe llamar a `outbox.despertar()` después del commit.
   */
  async avisar(
    pedidoId: bigint | string | number,
    etapa: EtapaAvisoReparto,
    datos: DatosAviso = {},
    tx?: Prisma.TransactionClient,
  ): Promise<ResultadoAviso> {
    try {
      const res = await this.avisarSinProteger(BigInt(pedidoId), etapa, datos, tx);
      // Registro para soporte: por qué un aviso no salió (sin teléfono, apagado, sin repartidor...), sin datos personales
      if (res.estado === 'OMITIDO' && res.motivo !== 'NO_ES_DELIVERY') {
        this.logger.warn(JSON.stringify({ evento: 'aviso_pedido_omitido', pedidoId: String(pedidoId), etapa, motivo: res.motivo }));
      }
      return res;
    } catch (err: any) {
      this.logger.error(`Aviso ${etapa} del pedido ${pedidoId} falló: ${err?.message}`, err?.stack);
      // Dentro de una transacción ajena el error debe propagarse para que esa transacción se deshaga
      if (tx) throw err;
      return { estado: 'FALLIDO', motivo: err?.message };
    }
  }

  /** Despierta el envío del outbox después de un commit que encoló avisos con `tx`. */
  despertar(): void {
    this.outbox.despertar();
  }

  private async avisarSinProteger(
    pedidoId: bigint,
    etapa: EtapaAvisoReparto,
    datosEntrada: DatosAviso,
    tx?: Prisma.TransactionClient,
  ): Promise<ResultadoAviso> {
    let datos = datosEntrada;
    const cfg = ETAPAS_AVISO[etapa];
    // Con `tx` las lecturas van en la misma transacción: el pedido puede estar recién creado y sin commit
    const db = tx ?? this.prisma;

    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        codigo: true,
        cliente_nombre: true,
        cliente_telefono: true,
        modalidad: true,
        total: true,
        pago_metodo: true,
        pago_preferido: true,
        canal: true,
        party_id: true,
        cliente_party_id: true,
        puntos_ganados: true,
        repartidor_party_id: true,
      },
    });
    if (!pedido) return { estado: 'OMITIDO', motivo: 'PEDIDO_NO_ENCONTRADO' };
    if (pedido.modalidad !== 'DELIVERY' && !cfg.cualquierModalidad) return { estado: 'OMITIDO', motivo: 'NO_ES_DELIVERY' };

    // SALIDA: el tiempo prometido se calcula y guarda (eta_min/eta_max) aunque el aviso esté apagado
    // o el cliente no tenga teléfono: el seguimiento cuenta desde ese rango. Un fallo no frena el aviso.
    if (etapa === 'SALIDA') {
      datos = { ...datos, tiempoTexto: await this.tiempoEstimadoSalida(db, pedidoId).catch((err: any) => {
        // Un fallo del cálculo no frena el aviso: sale el respaldo tiempo_prometido_min
        this.logger.warn(`Tiempo estimado del pedido ${pedidoId} no calculado: ${err?.message}`);
        return null;
      }) };
    }

    const telefono = telefonoEnviable(pedido.cliente_telefono);
    if (!telefono) return { estado: 'OMITIDO', motivo: 'SIN_TELEFONO' };

    const flag = await db.parametro.findUnique({ where: { clave: cfg.parametro } });
    // ASIGNADO viene encendido si el parámetro aún no existe; el resto exige «Sí» explícito
    if (!parametroActivoConDefecto(flag?.valor, etapa === 'ASIGNADO')) return { estado: 'OMITIDO', motivo: 'DESACTIVADO' };
    if (etapa === 'ASIGNADO') {
      if (!pedido.repartidor_party_id) return { estado: 'OMITIDO', motivo: 'SIN_REPARTIDOR' };
      const persona = await db.person.findUnique({ where: { party_id: pedido.repartidor_party_id }, select: { nombres: true } });
      datos = { ...datos, repartidorNombre: (persona?.nombres ?? '').trim().split(/\s+/)[0] || 'nuestro repartidor' };
    }

    const nombre = pedido.cliente_nombre || 'Cliente';
    const medio = etapa === 'RECIBIDO' ? MEDIOS_DIGITALES[String(pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase()] ?? null : null;
    if (etapa === 'RECIBIDO') {
      // Enlace de seguimiento en el aviso de pedido recibido; la plantilla nueva solo si Meta ya la aprobó
      const flagPlantilla = await db.parametro.findUnique({ where: { clave: 'whatsapp_plantilla_recibido_seguimiento_activa' } });
      datos = {
        ...datos,
        enlaceSeguimiento: this.enlaceSeguimiento(pedidoId, pedido.codigo),
        plantillaSeguimiento: esParametroActivo(flagPlantilla?.valor),
        plantillaUbicacion: esParametroActivo((await db.parametro.findUnique({ where: { clave: 'whatsapp_plantilla_delivery_ubicacion_activa' } }))?.valor),
        resumen: await this.resumenRecibido(db, pedidoId),
        datosPago: medio ? await this.bloqueDatosPago(db, pedidoId, pedido) : null,
      };
    }
    // Línea de puntos (bienvenida o puntos ganados): se decide aquí y el marcador «una sola vez» se escribe en encolar
    const extraPuntos = await this.extraPuntos(db, etapa, pedido);

    // Idempotencia: la fila (pedido, etapa) se crea una sola vez; si ya existe, el aviso ya se encoló
    const encolar = async (t: Prisma.TransactionClient): Promise<boolean> => {
      const previa = await t.mensajeReparto.findUnique({
        where: { pedido_id_numero: { pedido_id: pedidoId, numero: cfg.numero } },
        select: { numero: true },
      });
      if (previa) return false;
      let extra = extraPuntos;
      if (extra?.tipo === 'BIENVENIDA') {
        // Una sola bienvenida por celular: si otra transacción ya la marcó, este aviso sale sin la línea
        const marca = await t.avisoClienteUnico.createMany({ data: { telefono: telefono.slice(-9), aviso: 'BIENVENIDA_PUNTOS' }, skipDuplicates: true });
        if (marca.count === 0) extra = null;
      }
      const payload = await this.payloadConPuntos(etapa, nombre, pedido.codigo, datos, medio, extra);
      const carga: CargaSaliente = {
        ...payload,
        autor: 'BOT',
        nombre,
        repartoNumero: cfg.numero,
        pedidoCodigo: pedido.codigo,
        etapa,
      };
      await t.mensajeReparto.create({
        data: { pedido_id: pedidoId, numero: cfg.numero, enviado_en: new Date(), estado: 'PENDIENTE' },
      });
      const mensaje = { telefono, tipo: 'TEXTO' as const, origen: 'AVISO_PEDIDO', pedidoId, carga };
      if (await this.outbox.encolar({ ...mensaje, clave: `pedido-${pedidoId}-${etapa}` }, t)) return true;
      // La etapa se borró para un nuevo intento (retiro, reasignación) pero la clave del outbox sigue: sin
      // sufijo el aviso se perdía en silencio. La fila de mensaje_reparto ya garantiza una sola vez por intento.
      return this.outbox.encolar({ ...mensaje, clave: `pedido-${pedidoId}-${etapa}-${Date.now()}` }, t);
    };

    let nuevo: boolean;
    try {
      nuevo = tx ? await encolar(tx) : await this.prisma.$transaction((t) => encolar(t));
    } catch (err: any) {
      if (err?.code === 'P2002') return { estado: 'YA_ENVIADO' };
      throw err;
    }
    if (!nuevo) return { estado: 'YA_ENVIADO' };

    if (medio) {
      // Pago digital: la conversación pasa a una persona de Caja (aunque el envío falle)
      await this.marcarParaPersona(telefono, pedido, nombre);
    }

    if (!tx) this.outbox.despertar();
    this.logger.log(`Aviso ${etapa} del pedido ${pedido.codigo} encolado a ${enmascararTelefono(telefono)}`);
    return { estado: 'ENCOLADO' };
  }

  /** Monto, número o cuenta y titular del medio digital del pedido (mismos datos que ve la carta). */
  private async bloqueDatosPago(
    db: Prisma.TransactionClient | PrismaService,
    pedidoId: bigint,
    pedido: { total: unknown; pago_metodo: string | null; pago_preferido: string | null; puntos_ganados?: unknown },
  ): Promise<string | null> {
    try {
      const med = String(pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase();
      const parametros = await db.parametro.findMany({
        where: { clave: { in: ['local_pagos', 'voucher_titular_nombre', 'voucher_yape_numero', 'voucher_plin_numero'] } },
      });
      // Pago dividido: solo la parte digital se yapea; el resto se paga al recibir
      const plan = (await db.pedidoPagoPlan.findMany({ where: { pedido_id: pedidoId }, select: { medio: true, monto: true } })).map((f) => ({
        medio: f.medio,
        monto: Number(f.monto),
      }));
      const digital = plan.length > 0 ? montoDigitalDePlan(plan) : 0;
      const montoNum = digital > 0 ? digital : Number(pedido.total);
      const tot = montoNum.toFixed(2);
      const resto = digital > 0 ? Math.round((plan.reduce((a, f) => a + f.monto, 0) - digital) * 100) / 100 : 0;
      const lineaResto = resto > 0 ? `\n• Los S/ ${resto.toFixed(2)} restantes los pagas al recibir tu pedido` : '';
      return `${detalleDatosPago(med, { ...mediosPagoPublicos(parametros) }, tot)}\n• Monto: S/ ${tot}${lineaResto}`;
    } catch (err: any) {
      this.logger.warn(`Datos de pago no incluidos en el aviso: ${err?.message}`);
      return null;
    }
  }

  /** Productos (sin las partes de un combo), total, medio de pago y estado del envío para el aviso de pedido recibido. */
  private async resumenRecibido(db: Prisma.TransactionClient | PrismaService, pedidoId: bigint): Promise<ResumenRecibido | null> {
    const p = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        modalidad: true, total: true, envio: true, entrega_lat: true, entrega_lng: true, zona_id: true,
        pago_metodo: true, pago_preferido: true,
        lineas: { where: { linea_combo_id: null }, orderBy: { id: 'asc' }, select: { nombre: true, cantidad: true } },
      },
    });
    if (!p || !Array.isArray(p.lineas) || p.lineas.length === 0) return null;
    const metodo = String(p.pago_preferido || p.pago_metodo || '').toUpperCase();
    const nombresMedio: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'transferencia', EFECTIVO: 'efectivo', TARJETA: 'tarjeta' };
    const delivery = p.modalidad === 'DELIVERY';
    const sinUbicar = delivery && (p.entrega_lat == null || p.entrega_lng == null || p.zona_id == null);
    return {
      lineas: p.lineas.map((l) => `${l.cantidad} x ${l.nombre}`),
      total: Number(p.total),
      medioPago: nombresMedio[metodo] ?? (metodo ? metodo.toLowerCase() : 'por coordinar'),
      envioPorConfirmar: sinUbicar,
      envio: delivery && !sinUbicar && p.envio != null ? Number(p.envio) : null,
    };
  }

  /** Enlace a la carta con el seguimiento del pedido (código y token firmado). Null sin origen público. */
  private enlaceSeguimiento(pedidoId: bigint, codigo: string): string | null {
    const origen = urlPublicaCarta((clave) => process.env[clave]);
    if (!origen) return null;
    return enlaceSeguimientoCarta(origen, codigo, pedidoId);
  }

  /**
   * Rango «25 a 30» del aviso SALIDA: zona del pedido, recorrido de la ruta del repartidor (pedidos EN_CAMINO)
   * y empaque. Sin datos suficientes devuelve null y el aviso usa tiempo_prometido_min.
   */
  private async tiempoEstimadoSalida(db: Prisma.TransactionClient | PrismaService, pedidoId: bigint): Promise<string | null> {
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        entrega_lat: true,
        entrega_lng: true,
        repartidor_party_id: true,
        zona: { select: { minutos_min: true, minutos_max: true } },
        lineas: { select: { cantidad: true } },
      },
    });
    if (!pedido) return null;
    const cfg = await leerConfigEta(db as PrismaService);
    const ruta = pedido.repartidor_party_id
      ? await db.pedido.findMany({
          where: { repartidor_party_id: pedido.repartidor_party_id, estado: 'EN_CAMINO' },
          select: { id: true, entrega_lat: true, entrega_lng: true },
        })
      : [];
    const lat = pedido.entrega_lat == null ? null : Number(pedido.entrega_lat);
    const lng = pedido.entrega_lng == null ? null : Number(pedido.entrega_lng);
    const rango = calcularEtaEntrega(
      {
        id: pedido.id.toString(),
        zonaMin: pedido.zona?.minutos_min ?? null,
        zonaMax: pedido.zona?.minutos_max ?? null,
        lat,
        lng,
        unidades: pedido.lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0),
        ruta: ruta
          .filter((p) => p.entrega_lat != null && p.entrega_lng != null)
          .map((p) => ({ id: p.id.toString(), lat: Number(p.entrega_lat), lng: Number(p.entrega_lng) })),
      },
      cfg,
    );
    if (!rango) return null;
    // Lo prometido queda guardado: el seguimiento cuenta desde la salida con este mismo rango
    await db.pedido.update({ where: { id: pedidoId }, data: { eta_min: rango.min, eta_max: rango.max } });
    return formatearEta(rango, cfg.respaldoMin);
  }

  /**
   * Línea de puntos del aviso: RECIBIDO del primer pedido de un celular con puntos (bienvenida, con enlace a la carta)
   * y ENTREGADO de un pedido que ya sumó puntos («Ganaste N puntos. Total: M»). Solo lee; la marca se escribe al encolar.
   */
  private async extraPuntos(
    db: Prisma.TransactionClient | PrismaService,
    etapa: EtapaAvisoReparto,
    pedido: { canal: string; party_id: bigint | null; cliente_party_id: bigint | null; puntos_ganados: unknown },
  ): Promise<ExtraPuntos | null> {
    const cliente = partyClienteDelPedido(pedido);
    if (!cliente) return null;
    if (etapa === 'RECIBIDO') {
      const flag = await db.parametro.findUnique({ where: { clave: 'whatsapp_aviso_bienvenida_puntos_activo' } });
      if (!parametroActivoConDefecto(flag?.valor, whatsappSimulado())) return null;
      const origen = urlPublicaCarta((clave) => process.env[clave]);
      if (!origen) return null;
      return { tipo: 'BIENVENIDA', enlace: `${origen}/?puntos=1` };
    }
    if (etapa === 'ENTREGADO') {
      const ganados = Number(pedido.puntos_ganados ?? 0);
      if (ganados <= 0) return null;
      const flag = await db.parametro.findUnique({ where: { clave: 'whatsapp_aviso_puntos_ganados_activo' } });
      if (!parametroActivoConDefecto(flag?.valor, whatsappSimulado())) return null;
      const saldo = await db.customerDetail.findFirst({
        where: { party_role: { party_id: cliente, rol: 'CLIENTE', hasta: null } },
        select: { puntos: true },
      });
      return { tipo: 'PUNTOS', ganados, total: Number(saldo?.puntos ?? 0) };
    }
    return null;
  }

  private async payloadConPuntos(
    etapa: EtapaAvisoReparto,
    nombre: string,
    codigo: string,
    datos: DatosAviso,
    medio: string | null,
    extra: ExtraPuntos | null,
  ): Promise<PayloadAvisoReparto> {
    let base = await this.construirPayload(etapa, nombre, codigo, datos, medio);
    if (extra?.tipo === 'BIENVENIDA') base = conBienvenidaPuntos(base, nombre, codigo, extra.enlace, !medio);
    if (extra?.tipo === 'PUNTOS') return conPuntosEntregado(base, nombre, codigo, extra.ganados, extra.total);
    // Con ventana abierta sale el texto libre (ya pide la ubicación); la plantilla solo rige fuera de ella
    if (etapa === 'RECIBIDO' && datos.plantillaUbicacion && datos.resumen?.envioPorConfirmar) {
      return conPlantillaUbicacion(base, nombre, codigo, medio);
    }
    return base;
  }

  /** Mismo efecto que un voucher recibido por WhatsApp: la conversación queda para una persona (VALIDAR_PAGO, urgente). */
  private async marcarParaPersona(
    telefono: string,
    pedido: { id: bigint; codigo: string; total: unknown; pago_metodo: string | null; pago_preferido: string | null },
    nombre: string,
  ) {
    try {
      const conversacion = await this.prisma.conversacion.upsert({
        where: { telefono },
        update: { ultima_actividad: new Date() },
        create: { telefono, nombre_contacto: nombre },
        select: { id: true, flujo: true },
      });
      await marcarPagoParaPersona(this.prisma, conversacion, pedido);
    } catch (err: any) {
      this.logger.error(`No se pudo dejar el pedido ${pedido.codigo} para revisión de pago: ${err?.message}`, err?.stack);
    }
  }

  private async construirPayload(
    etapa: EtapaAvisoReparto,
    nombre: string,
    codigo: string,
    datos: DatosAviso,
    medioDigital: string | null,
  ): Promise<PayloadAvisoReparto> {
    switch (etapa) {
      case 'RECIBIDO':
        return medioDigital
          ? TEXTOS_REPARTO.recibidoDigital(nombre, codigo, medioDigital, datos.enlaceSeguimiento, datos.resumen, datos.datosPago)
          : TEXTOS_REPARTO.recibidoEfectivo(nombre, codigo, datos.enlaceSeguimiento, datos.plantillaSeguimiento, datos.resumen);
      case 'ACEPTADO':
        return TEXTOS_REPARTO.aceptado(nombre, codigo);
      case 'LISTO':
        return TEXTOS_REPARTO.listo(nombre, codigo);
      case 'LISTO_RECOJO':
        return TEXTOS_REPARTO.listoRecojo(nombre, codigo);
      case 'ASIGNADO':
        return TEXTOS_REPARTO.asignado(nombre, codigo, datos.repartidorNombre ?? 'nuestro repartidor');
      case 'SALIDA': {
        if (datos.tiempoTexto) return TEXTOS_REPARTO.salida(nombre, codigo, datos.tiempoTexto);
        const p = await this.prisma.parametro.findUnique({ where: { clave: 'tiempo_prometido_min' } });
        return TEXTOS_REPARTO.salida(nombre, codigo, String(Number(p?.valor ?? 30)));
      }
      case 'LLEGADA':
        return TEXTOS_REPARTO.llegada(nombre, codigo);
      case 'INSISTENCIA':
        return TEXTOS_REPARTO.insistencia(nombre, codigo, String(Math.floor(datos.minutos ?? 0)));
      case 'ESPERA_AGOTADA':
        return TEXTOS_REPARTO.esperaAgotada(nombre, codigo);
      case 'RETIRO':
        return TEXTOS_REPARTO.retiro(nombre, codigo, this.costoReprogramacion(datos.recargo, datos.recargoModo));
      case 'REENVIADO':
        return TEXTOS_REPARTO.reenviado(nombre, codigo);
      case 'REPROG_RECIBIDA':
        return TEXTOS_REPARTO.reprogramacionRecibida(nombre, codigo);
      case 'REPROG_CANCELADA':
        return TEXTOS_REPARTO.reprogramacionCancelada(nombre, codigo);
      case 'REPROG_SIN_RESPUESTA':
        return TEXTOS_REPARTO.reprogramacionSinRespuesta(nombre, codigo);
      case 'ENTREGADO':
        return TEXTOS_REPARTO.entregado(nombre, codigo);
      case 'VOUCHER_RECORDATORIO':
        return TEXTOS_REPARTO.voucherRecordatorio(nombre, codigo);
    }
  }

  private montoSoles(monto?: number): string {
    return `S/ ${(monto ?? 0).toFixed(2)}`;
  }

  /** Frase exacta del costo que se le dice al cliente antes de su SÍ/NO (el mismo monto que se cobra). */
  private costoReprogramacion(recargo?: number, modo?: DatosAviso['recargoModo']): string {
    if ((recargo ?? 0) <= 0) return 'Volver a enviarlo no tiene costo adicional.';
    const detalle = modo === 'IGUAL_ENVIO' ? ' (el mismo del delivery)' : '';
    return `Volver a enviarlo tiene un costo de ${this.montoSoles(recargo)}${detalle}, que pagarías en la puerta o a Caja.`;
  }
}
