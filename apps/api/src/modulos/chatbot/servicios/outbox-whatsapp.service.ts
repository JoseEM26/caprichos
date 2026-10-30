import { ConflictException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { leerParametroNumerico } from '../../impresion/estado-impresion';
import {
  ResultadoEnvioWhatsApp,
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { enmascararTelefono } from '../utilidades/enmascarar.util';
import { PayloadMensajeNegocio, Ventana24hService } from './ventana-24h.service';
import { enviarCarruselConRespaldo, resumenCarrusel } from './carrusel.util';
import { CargaInteractivo, normalizarInteractivo, textoConVinetas } from './interactivo.util';

export type TipoSaliente = 'TEXTO' | 'PLANTILLA' | 'INTERACTIVO';
export type EstadoSaliente = 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'FALLIDO' | 'DESCARTADO';

/** Lo que el emisor quiere decir. Texto libre o plantilla se decide al enviar, según la ventana de 24 h. */
export interface CargaSaliente extends PayloadMensajeNegocio {
  autor?: 'BOT' | 'PERSONA';
  nombre?: string | null;
  /** Etapa de mensaje_reparto (AVISO_PEDIDO) que se marca al enviar o al fallar. */
  repartoNumero?: number;
  /** Código del pedido y etapa, solo para el registro en el chat. */
  pedidoCodigo?: string;
  etapa?: string;
  /** Solo tipo INTERACTIVO: botones (máx. 3) o lista (máx. 10 filas). textoLibre lleva el mismo cuerpo. */
  interactivo?: CargaInteractivo;
}

export interface DatosEncolar {
  /** Teléfono ya normalizado (51XXXXXXXXX). */
  telefono: string;
  tipo: TipoSaliente;
  /** Clave de idempotencia determinista por evento: si ya existe, no se duplica. */
  clave: string;
  origen: string;
  pedidoId?: bigint | string | null;
  carga: CargaSaliente;
}

export interface UsuarioAccion {
  partyId?: bigint | number | string | null;
  nombre?: string | null;
}

/** Espera entre intentos temporales: 30 s, 2 min, 10 min y 1 h. */
export const ESPERAS_REINTENTO_MS = [30_000, 120_000, 600_000, 3_600_000];
/** Un ENVIANDO sin cerrar más de esto se da por huérfano (proceso caído a mitad de envío). */
const ENVIANDO_MAX_MS = 5 * 60_000;
/** Tope de filas por corrida de limpieza, para no bloquear la BD. */
export const LOTE_LIMPIEZA = 500;
/** Cuántos lotes encadena una corrida del planificador (así una cadena LISTO, SALIDA... sale seguida). */
const LOTES_POR_CORRIDA = 10;

/** Errores que no mejoran reintentando: el número, la plantilla o la BAJA del cliente. */
const CODIGOS_PERMANENTES = new Set([
  'NUMERO_INVALIDO',
  'PLANTILLA_NO_APROBADA',
  'PLANTILLA_NO_CONFIGURADA',
  'CLIENTE_BAJA',
  'DESTINATARIO_NO_VERIFICADO',
  'FUERA_DE_VENTANA_24H',
  'BSUID_NO_PERMITIDO',
  'ERROR_META',
]);

/** Lo que no está en la lista permanente se trata como temporal: se reintenta hasta agotar intentos. */
export const esErrorPermanente = (codigo?: string | null): boolean => !!codigo && CODIGOS_PERMANENTES.has(codigo);

/** Clasificación del motivo de FALLIDO para el admin y el registro. */
export const clasificarFallo = (codigo: string | null | undefined, agotado: boolean): 'PERMANENTE' | 'AGOTADO' | 'TEMPORAL' => {
  if (esErrorPermanente(codigo)) return 'PERMANENTE';
  return agotado ? 'AGOTADO' : 'TEMPORAL';
};

const esParametroActivo = (valor: unknown) => valor === true || String(valor).toLowerCase() === 'si';

type FilaSaliente = {
  id: bigint;
  secuencia: bigint;
  telefono_destino: string;
  tipo: string;
  carga: Prisma.JsonValue;
  intentos: number;
  max_intentos: number;
  pedido_id: bigint | null;
  origen: string;
};

interface ResumenLote {
  tomados: number;
  enviados: number;
  reintentos: number;
  fallidos: number;
}

/**
 * Outbox de WhatsApp (entrega at-least-once). Los emisores encolan el mensaje en la misma transacción
 * que su cambio de estado y el planificador (o un despertar tras el commit) lo envía.
 *  - Si Meta falla con un error temporal, se reintenta con espera creciente.
 *  - Un error permanente o el agotamiento de intentos deja el mensaje FALLIDO (cola de muertos).
 *  - Un mensaje no sale si uno anterior del mismo destino y pedido sigue PENDIENTE o ENVIANDO.
 * WhatsApp no ofrece clave de idempotencia: si la API cae entre "Meta aceptó" y "marcar ENVIADO",
 * el mensaje puede repetirse. Es raro y se acepta: es preferible a perder el aviso.
 */
@Injectable()
export class OutboxWhatsappService {
  private readonly logger = new Logger(OutboxWhatsappService.name);
  private procesando = false;
  private repetir = false;
  private encoladosEnProceso = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ventana24h: Ventana24hService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  /**
   * Encola un mensaje. Con `tx`, el INSERT va en la misma transacción que el cambio de estado.
   * Idempotente por clave: devuelve false si la clave ya existía (no duplica).
   */
  async encolar(datos: DatosEncolar, tx?: Prisma.TransactionClient): Promise<boolean> {
    const db = tx ?? this.prisma;
    if (datos.tipo === 'INTERACTIVO') {
      const i = datos.carga.interactivo && normalizarInteractivo(datos.carga.interactivo);
      const filas = i?.lista?.secciones.reduce((n, s) => n + s.filas.length, 0) ?? 0;
      if (!i || !i.cuerpo || (!i.botones?.length && !filas && !i.carrusel)) {
        throw new Error('Un mensaje interactivo necesita cuerpo y botones o filas');
      }
      datos = { ...datos, carga: { ...datos.carga, interactivo: i, textoLibre: i.cuerpo } };
    }
    const maxIntentos = await leerParametroNumerico(this.prisma, 'outbox_max_intentos', 5);
    const r = await db.salienteWhatsapp.createMany({
      data: [
        {
          telefono_destino: datos.telefono,
          tipo: datos.tipo,
          carga: datos.carga as unknown as Prisma.InputJsonValue,
          clave_idempotencia: datos.clave,
          max_intentos: maxIntentos,
          origen: datos.origen,
          pedido_id: datos.pedidoId ? BigInt(datos.pedidoId) : null,
        },
      ],
      skipDuplicates: true,
    });
    if (r.count === 1) this.encoladosEnProceso++;
    return r.count === 1;
  }

  /**
   * Dispara el envío del lote justo después del commit, sin bloquear al emisor.
   * Si ya hay un lote en marcha en este proceso, pide otra pasada al terminar.
   */
  despertar(): void {
    if (this.procesando) {
      this.repetir = true;
      return;
    }
    this.procesando = true;
    setImmediate(() => {
      void this.drenar();
    });
  }

  private async drenar(): Promise<void> {
    try {
      do {
        this.repetir = false;
        await this.procesarLote();
      } while (this.repetir);
    } catch (err: any) {
      this.logger.error(`Error al enviar el lote de WhatsApp: ${err?.message}`, err?.stack);
    } finally {
      this.procesando = false;
    }
  }

  /**
   * Procesa hasta LOTES_POR_CORRIDA lotes seguidos mientras haya filas enviables.
   * Cada lote: recupera huérfanos, toma filas con SELECT ... FOR UPDATE SKIP LOCKED (solo las que no
   * tienen un anterior del mismo destino y pedido en PENDIENTE o ENVIANDO), las marca ENVIANDO con un
   * token de intento y las envía fuera de la transacción.
   */
  async procesarLote(limite = 20): Promise<ResumenLote & { lagSegundos: number }> {
    const total: ResumenLote = { tomados: 0, enviados: 0, reintentos: 0, fallidos: 0 };
    const ahora = new Date();
    await this.recuperarHuerfanos(ahora);
    for (let i = 0; i < LOTES_POR_CORRIDA; i++) {
      const lote = await this.procesarUnLote(limite);
      total.tomados += lote.tomados;
      total.enviados += lote.enviados;
      total.reintentos += lote.reintentos;
      total.fallidos += lote.fallidos;
      if (lote.tomados === 0) break;
    }
    const lagSegundos = await this.lagSegundos();
    this.logger.log(
      JSON.stringify({
        evento: 'outbox_whatsapp',
        encolados: this.encoladosEnProceso,
        enviados: total.enviados,
        reintentos: total.reintentos,
        fallidos: total.fallidos,
        lagSegundos,
      }),
    );
    this.encoladosEnProceso = 0;
    return { ...total, lagSegundos };
  }

  private async procesarUnLote(limite: number): Promise<ResumenLote> {
    const ahora = new Date();
    const filas = await this.prisma.$transaction(async (tx) => {
      const tomadas = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT s."id" FROM "saliente_whatsapp" s
        WHERE s."estado" = 'PENDIENTE'
          AND s."proximo_intento_en" <= ${ahora}
          AND NOT EXISTS (
            SELECT 1 FROM "saliente_whatsapp" a
            WHERE s."pedido_id" IS NOT NULL
              AND a."telefono_destino" = s."telefono_destino"
              AND a."pedido_id" = s."pedido_id"
              AND a."secuencia" < s."secuencia"
              AND a."estado" IN ('PENDIENTE', 'ENVIANDO')
          )
        ORDER BY s."secuencia"
        LIMIT ${limite}
        FOR UPDATE SKIP LOCKED`;
      if (tomadas.length === 0) return [];
      const ids = tomadas.map((f) => f.id);
      const token = randomUUID();
      await tx.salienteWhatsapp.updateMany({
        where: { id: { in: ids } },
        data: { estado: 'ENVIANDO', intento_token: token, actualizado_en: ahora },
      });
      return tx.salienteWhatsapp.findMany({ where: { id: { in: ids } } }).then((r) =>
        r.map((f) => ({ ...f, intento_token: token })),
      );
    });

    const resumen: ResumenLote = { tomados: filas.length, enviados: 0, reintentos: 0, fallidos: 0 };
    for (const fila of filas) {
      const token = (fila as { intento_token?: string | null }).intento_token ?? '';
      // Un mensaje que ya agotó sus intentos (p. ej. proceso caído en cada envío) no vuelve a salir
      if (fila.intentos >= fila.max_intentos) {
        await this.cerrarFallido(fila, token, 'Intentos agotados', null, fila.intentos);
        resumen.fallidos++;
        continue;
      }
      const estado = await this.enviarFila(fila, token);
      if (estado === 'ENVIADO') resumen.enviados++;
      else if (estado === 'REINTENTO') resumen.reintentos++;
      else if (estado === 'FALLIDO') resumen.fallidos++;
    }
    return resumen;
  }

  private async enviarFila(fila: FilaSaliente, token: string): Promise<'ENVIADO' | 'REINTENTO' | 'FALLIDO' | 'PERDIDO'> {
    const carga = (fila.carga ?? {}) as unknown as CargaSaliente;
    let resultado: ResultadoEnvioWhatsApp;
    try {
      resultado = await this.enviarAlPuerto(fila, carga);
    } catch (err: any) {
      resultado = { exito: false, estado: 'FALLIDO', errorCodigo: 'EXCEPCION', errorDetalle: err?.message };
    }

    const intentos = fila.intentos + 1;

    if (resultado.exito) {
      // Una sola actualización tras la respuesta de Meta: wa_message_id y ENVIADO juntos.
      // Filtra por el token: si el intento fue recuperado por otro proceso, no pisa su estado.
      const r = await this.prisma.salienteWhatsapp.updateMany({
        where: { id: fila.id, intento_token: token },
        data: {
          estado: 'ENVIADO',
          intentos,
          enviado_en: new Date(),
          wa_message_id: resultado.waMessageId ?? null,
          ultimo_error: null,
          intento_token: null,
        },
      });
      if (r.count === 0) return 'PERDIDO';
      await this.marcarReparto(fila, 'ENVIADO');
      await this.registrarEnChat(fila, carga, resultado);
      return 'ENVIADO';
    }

    const error = `[${resultado.errorCodigo ?? 'ERROR'}] ${resultado.errorDetalle ?? ''}`.trim();
    if (esErrorPermanente(resultado.errorCodigo) || intentos >= fila.max_intentos) {
      await this.cerrarFallido(fila, token, error, resultado, intentos);
      return 'FALLIDO';
    }

    const espera = ESPERAS_REINTENTO_MS[Math.min(intentos - 1, ESPERAS_REINTENTO_MS.length - 1)];
    await this.prisma.salienteWhatsapp.updateMany({
      where: { id: fila.id, intento_token: token },
      data: {
        estado: 'PENDIENTE',
        intentos,
        ultimo_error: error,
        proximo_intento_en: new Date(Date.now() + espera),
        intento_token: null,
      },
    });
    this.logger.warn(
      JSON.stringify({ evento: 'outbox_reintento', id: fila.id.toString(), origen: fila.origen, esperaSeg: espera / 1000, error }),
    );
    return 'REINTENTO';
  }

  /** Decide texto libre o plantilla al enviar: la ventana de 24 h la mira Ventana24hService. */
  private async enviarAlPuerto(fila: FilaSaliente, carga: CargaSaliente): Promise<ResultadoEnvioWhatsApp> {
    const opciones = { pedidoId: fila.pedido_id ?? undefined };
    if (fila.tipo === 'INTERACTIVO' && carga.interactivo) return this.enviarInteractivo(fila, carga, opciones);
    if (fila.tipo !== 'PLANTILLA') {
      return this.ventana24h.enviarMensajeNegocio(fila.telefono_destino, carga, opciones);
    }

    // PLANTILLA: sin texto libre. La BAJA del cliente se respeta igual que en el resto de avisos.
    if (!(await this.ventana24h.tieneConsentimiento(fila.telefono_destino))) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'CLIENTE_BAJA', errorDetalle: 'Cliente en estado BAJA' };
    }
    const definicion = carga.plantillaClave ? CATALOGO_PLANTILLAS[carga.plantillaClave] : undefined;
    if (!definicion) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'PLANTILLA_NO_CONFIGURADA',
        errorDetalle: `No existe plantilla configurada para la clave '${String(carga.plantillaClave)}'`,
      };
    }
    return this.mensajeria.enviarPlantilla(
      fila.telefono_destino,
      definicion.nombre,
      definicion.idioma,
      carga.variablesPlantilla,
      opciones,
    );
  }

  /**
   * Interactivo: botones o lista solo con la ventana de 24 h abierta. Fuera de ella no sale como interactivo:
   * degrada igual que el TEXTO (texto con viñetas o plantilla, según Ventana24hService) y queda registrado.
   * ponytail: la lista se manda en una sola sección (la del primer grupo); el puerto no admite varias.
   */
  private async enviarInteractivo(
    fila: FilaSaliente,
    carga: CargaSaliente,
    opciones: { pedidoId?: bigint },
  ): Promise<ResultadoEnvioWhatsApp & { degradado?: boolean }> {
    const i = normalizarInteractivo(carga.interactivo!);
    const tel = fila.telefono_destino;
    if (!(await this.ventana24h.tieneConsentimiento(tel))) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'CLIENTE_BAJA', errorDetalle: 'Cliente en estado BAJA' };
    }
    if (await this.ventana24h.esVentanaAbierta(tel)) {
      // Carrusel (no plantilla): si Meta lo rechaza o no hay URL pública, sale el respaldo (lista o botones)
      if (i.carrusel) return enviarCarruselConRespaldo(this.mensajeria, tel, i.carrusel, opciones);
      if (i.botones?.length) return this.mensajeria.enviarBotones(tel, i.cuerpo, i.botones, opciones);
      const secciones = i.lista?.secciones ?? [];
      return this.mensajeria.enviarLista(
        tel,
        i.cuerpo,
        i.lista?.boton ?? 'Ver opciones',
        secciones.flatMap((s) => s.filas),
        { ...opciones, tituloSeccion: secciones[0]?.titulo },
      );
    }
    this.logger.warn(JSON.stringify({ evento: 'outbox_interactivo_degradado', id: fila.id.toString(), origen: fila.origen }));
    const r = await this.ventana24h.enviarMensajeNegocio(tel, { ...carga, textoLibre: textoConVinetas(i), botones: undefined }, opciones);
    return { ...r, degradado: true };
  }

  private async cerrarFallido(
    fila: FilaSaliente,
    token: string,
    error: string,
    resultado: ResultadoEnvioWhatsApp | null,
    intentos: number,
  ): Promise<void> {
    const r = await this.prisma.salienteWhatsapp.updateMany({
      where: { id: fila.id, intento_token: token },
      data: { estado: 'FALLIDO', intentos, ultimo_error: error, intento_token: null },
    });
    if (r.count === 0) return;
    await this.marcarReparto(fila, 'FALLIDO');
    const carga = (fila.carga ?? {}) as unknown as CargaSaliente;
    await this.registrarEnChat(fila, carga, resultado ?? { exito: false, estado: 'FALLIDO', errorDetalle: error });
    this.logger.error(
      JSON.stringify({
        evento: 'outbox_fallido',
        id: fila.id.toString(),
        origen: fila.origen,
        clasificacion: clasificarFallo(resultado?.errorCodigo, intentos >= fila.max_intentos),
        error,
      }),
    );
    // La BAJA es un resultado esperado (el cliente pidió no recibir mensajes), no una falla que atender
    if (!error.includes('CLIENTE_BAJA')) {
      await this.notificarFallido(fila, error);
    }
  }

  /** Estado de la etapa de reparto: ENVIADO cuando sale, FALLIDO cuando se agota. No pisa respuestas del cliente. */
  private async marcarReparto(fila: FilaSaliente, estado: 'ENVIADO' | 'FALLIDO'): Promise<void> {
    const carga = (fila.carga ?? {}) as unknown as CargaSaliente;
    if (!carga.repartoNumero || !fila.pedido_id) return;
    await this.prisma.mensajeReparto.updateMany({
      where: {
        pedido_id: fila.pedido_id,
        numero: carga.repartoNumero,
        estado: { in: estado === 'ENVIADO' ? ['PENDIENTE', 'FALLIDO'] : ['PENDIENTE'] },
      },
      data: { estado },
    });
  }

  /** Copia el mensaje terminal (enviado o fallido) al hilo de chat del cliente (mensaje_chat). */
  private async registrarEnChat(
    fila: FilaSaliente,
    carga: CargaSaliente,
    resultado: ResultadoEnvioWhatsApp & { degradado?: boolean; respaldo?: boolean },
  ): Promise<void> {
    const i = fila.tipo === 'INTERACTIVO' ? carga.interactivo : undefined;
    const conversacion = await this.prisma.conversacion.upsert({
      where: { telefono: fila.telefono_destino },
      update: { ultima_actividad: new Date() },
      create: { telefono: fila.telefono_destino, nombre_contacto: carga.nombre ?? null },
      select: { id: true },
    });

    let whatsappMensajeId: bigint | null = null;
    if (resultado.id && /^\d+$/.test(resultado.id)) whatsappMensajeId = BigInt(resultado.id);

    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacion.id,
        direccion: 'SALE',
        autor: carga.autor ?? 'BOT',
        tipo: !resultado.exito ? 'SISTEMA' : i && !resultado.degradado ? (i.botones?.length || (i.carrusel && !resultado.respaldo) ? 'BOTON' : 'LISTA') : 'TEXTO',
        contenido: {
          origen: fila.origen,
          etapa: carga.etapa ?? null,
          pedido: carga.pedidoCodigo ?? null,
          texto: i?.carrusel ? resumenCarrusel(i.carrusel) : (carga.textoLibre ?? null),
          plantilla: carga.plantillaClave ?? null,
          ...(i
            ? {
                botones: i.botones ?? i.carrusel?.tarjetas.map((t) => ({ id: t.boton.id, titulo: t.nombre })),
                carrusel: i.carrusel ? !resultado.respaldo : undefined,
                botonTexto: i.lista?.boton,
                filas: i.lista ? i.lista.secciones.flatMap((s) => s.filas) : i.carrusel?.respaldo?.filas,
                degradado: resultado.degradado ?? undefined,
              }
            : {}),
          estado: resultado.estado,
          errorCodigo: resultado.errorCodigo ?? null,
        } as unknown as Prisma.InputJsonValue,
        whatsapp_mensaje_id: whatsappMensajeId,
      },
    });
  }

  /** Avisa a Caja y Admin (campana) por cada mensaje que queda FALLIDO. Se apaga con outbox_alerta_fallidos. */
  private async notificarFallido(fila: FilaSaliente, error: string): Promise<void> {
    try {
      const flag = await this.prisma.parametro.findUnique({ where: { clave: 'outbox_alerta_fallidos' } });
      if (!esParametroActivo(flag?.valor)) return;

      const carga = (fila.carga ?? {}) as unknown as CargaSaliente;
      const pedido = carga.pedidoCodigo ? ` del pedido ${carga.pedidoCodigo}` : '';
      const titulo = 'WhatsApp: mensaje no enviado';
      const mensaje =
        `No se pudo enviar un mensaje${pedido} (${fila.origen}) a ${enmascararTelefono(fila.telefono_destino)}: ${error}. ` +
        'Revísalo en Mensajes, pestaña Salientes, y reenvíalo o descártalo.';

      for (const rol of ['CAJERO', 'ADMIN']) {
        const notif = await this.prisma.notificacion.create({
          data: { tipo: 'WHATSAPP_ALERTA', rol_destino: rol, titulo, mensaje, enlace: '/admin/mensajes' },
        });
        this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
      }
    } catch (err: any) {
      this.logger.error(`No se pudo avisar el fallo del mensaje saliente ${fila.id}: ${err?.message}`);
    }
  }

  /**
   * ENVIANDO sin cerrar (proceso caído a mitad de envío). Si ya tiene wa_message_id, Meta lo aceptó:
   * pasa a ENVIADO y no se reenvía. Si no, vuelve a PENDIENTE contando un intento.
   */
  private async recuperarHuerfanos(ahora: Date): Promise<void> {
    const corte = new Date(ahora.getTime() - ENVIANDO_MAX_MS);
    await this.prisma.salienteWhatsapp.updateMany({
      where: { estado: 'ENVIANDO', actualizado_en: { lt: corte }, wa_message_id: { not: null } },
      data: { estado: 'ENVIADO', enviado_en: ahora, intento_token: null },
    });
    await this.prisma.salienteWhatsapp.updateMany({
      where: { estado: 'ENVIANDO', actualizado_en: { lt: corte }, wa_message_id: null },
      data: {
        estado: 'PENDIENTE',
        proximo_intento_en: ahora,
        intentos: { increment: 1 },
        intento_token: null,
        ultimo_error: 'Envío interrumpido, se reintenta',
      },
    });
  }

  /** Antigüedad en segundos del PENDIENTE más viejo: el retraso (lag) de la cola. 0 si no hay. */
  async lagSegundos(ahora = new Date()): Promise<number> {
    const viejo = await this.prisma.salienteWhatsapp.findFirst({
      where: { estado: 'PENDIENTE' },
      orderBy: { creado_en: 'asc' },
      select: { creado_en: true },
    });
    if (!viejo) return 0;
    return Math.max(0, Math.floor((ahora.getTime() - viejo.creado_en.getTime()) / 1000));
  }

  /** Reenvía un FALLIDO: vuelve a PENDIENTE con los intentos en cero. Queda auditado. */
  async reenviar(id: string | bigint, usuario?: UsuarioAccion): Promise<void> {
    await this.cambiarDesdeFallido(id, 'reenviar', usuario, async () => {
      await this.prisma.salienteWhatsapp.update({
        where: { id: BigInt(id) },
        data: { estado: 'PENDIENTE', intentos: 0, proximo_intento_en: new Date(), ultimo_error: null },
      });
    });
    this.despertar();
  }

  /**
   * Descarta un FALLIDO (dead letter): queda DESCARTADO con motivo y quién lo hizo. Nada se borra
   * desde la UI; la limpieza de DESCARTADO solo ocurre tras outbox_retencion_fallidos_dias.
   */
  async descartar(id: string | bigint, motivo: string, usuario?: UsuarioAccion): Promise<void> {
    await this.cambiarDesdeFallido(id, 'descartar', usuario, async () => {
      await this.prisma.salienteWhatsapp.update({
        where: { id: BigInt(id) },
        data: {
          estado: 'DESCARTADO',
          descartado_en: new Date(),
          descartado_por: usuario?.nombre ?? (usuario?.partyId != null ? String(usuario.partyId) : null),
          motivo_descarte: motivo,
        },
      });
    });
  }

  private async cambiarDesdeFallido(
    id: string | bigint,
    accion: 'reenviar' | 'descartar',
    usuario: UsuarioAccion | undefined,
    aplicar: () => Promise<void>,
  ): Promise<void> {
    const fila = await this.prisma.salienteWhatsapp.findUnique({ where: { id: BigInt(id) }, select: { estado: true } });
    if (!fila) throw new NotFoundException({ codigo: 'NO_ENCONTRADO', mensaje: 'Mensaje saliente no encontrado' });
    if (fila.estado !== 'FALLIDO') {
      throw new ConflictException({ codigo: 'NO_FALLIDO', mensaje: 'Solo se puede reenviar o descartar un mensaje fallido' });
    }
    await aplicar();
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'whatsapp_salientes',
      accion,
      entidad: 'saliente_whatsapp',
      entidadId: BigInt(id),
      partyId: usuario?.partyId != null ? BigInt(usuario.partyId) : undefined,
    });
  }

  /**
   * Planificador: borra ENVIADO más viejos que outbox_retencion_dias y DESCARTADO más viejos que
   * outbox_retencion_fallidos_dias. Cada corrida borra como máximo LOTE_LIMPIEZA filas por tipo.
   */
  async limpiar(ahora = new Date()): Promise<{ enviados: number; descartados: number }> {
    const diasEnviados = await leerParametroNumerico(this.prisma, 'outbox_retencion_dias', 30);
    const diasDescartados = await leerParametroNumerico(this.prisma, 'outbox_retencion_fallidos_dias', 90);
    const corteEnviados = new Date(ahora.getTime() - diasEnviados * 86400000);
    const corteDescartados = new Date(ahora.getTime() - diasDescartados * 86400000);
    const enviados = await this.prisma.$executeRaw`
      DELETE FROM "saliente_whatsapp" WHERE "id" IN (
        SELECT "id" FROM "saliente_whatsapp"
        WHERE "estado" = 'ENVIADO' AND "enviado_en" < ${corteEnviados}
        LIMIT ${LOTE_LIMPIEZA})`;
    const descartados = await this.prisma.$executeRaw`
      DELETE FROM "saliente_whatsapp" WHERE "id" IN (
        SELECT "id" FROM "saliente_whatsapp"
        WHERE "estado" = 'DESCARTADO' AND "descartado_en" < ${corteDescartados}
        LIMIT ${LOTE_LIMPIEZA})`;
    return { enviados, descartados };
  }

  /** Lista para la pestaña Salientes: mensajes por estado, con teléfono enmascarado y paginado. */
  async listar(estado?: string, pagina = 1, limite = 20) {
    const where: Prisma.SalienteWhatsappWhereInput = estado ? { estado } : {};
    const [filas, total] = await Promise.all([
      this.prisma.salienteWhatsapp.findMany({
        where,
        orderBy: [{ actualizado_en: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { pedido: { select: { codigo: true } } },
      }),
      this.prisma.salienteWhatsapp.count({ where }),
    ]);
    return {
      pagina,
      limite,
      total,
      filas: filas.map((f) => {
        const carga = (f.carga ?? {}) as unknown as CargaSaliente;
        return {
          id: f.id.toString(),
          telefono: enmascararTelefono(f.telefono_destino),
          origen: f.origen,
          tipo: f.tipo,
          estado: f.estado,
          intentos: f.intentos,
          maxIntentos: f.max_intentos,
          ultimoError: f.ultimo_error,
          clasificacion: f.estado === 'FALLIDO' ? clasificarFallo(f.ultimo_error?.match(/^\[([A-Z_]+)\]/)?.[1], f.intentos >= f.max_intentos) : null,
          texto: carga.textoLibre ?? null,
          pedidoCodigo: f.pedido?.codigo ?? null,
          motivoDescarte: f.motivo_descarte,
          creadoEn: f.creado_en,
          actualizadoEn: f.actualizado_en,
          enviadoEn: f.enviado_en,
        };
      }),
    };
  }

  /** Resumen para el panel: conteos por estado y el lag (edad del PENDIENTE más viejo, en segundos). */
  async resumen(ahora = new Date()) {
    const grupos = await this.prisma.salienteWhatsapp.groupBy({ by: ['estado'], _count: { _all: true } });
    const conteo: Record<EstadoSaliente, number> = { PENDIENTE: 0, ENVIANDO: 0, ENVIADO: 0, FALLIDO: 0, DESCARTADO: 0 };
    for (const g of grupos) conteo[g.estado as EstadoSaliente] = g._count._all;
    const lagAlertaMin = await leerParametroNumerico(this.prisma, 'outbox_lag_alerta_min', 5);
    const lag = await this.lagSegundos(ahora);
    return {
      pendientes: conteo.PENDIENTE,
      enviando: conteo.ENVIANDO,
      enviados: conteo.ENVIADO,
      fallidos: conteo.FALLIDO,
      descartados: conteo.DESCARTADO,
      lagSegundos: lag,
      lagAlertaMin,
      lagAlerta: lag > lagAlertaMin * 60,
    };
  }
}
