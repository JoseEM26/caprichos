import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { esErrorVentana24h, mapearErrorWhatsApp } from './utilidades/error-whatsapp.util';
import { MensajeEnviado, WHATSAPP_GATEWAY, WhatsAppGateway } from './whatsapp.gateway';

/** Estados del envío en segundo plano, guardados en mensaje_chat.contenido.estado. */
export type EstadoEnvio = 'ENCOLADO' | 'ENVIANDO' | 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'REVISAR';

/** Cuántas veces se intenta en total y cuánto se espera entre intentos (solo si Meta rechazó por límite o fallo suyo). */
export const MAX_INTENTOS_ENVIO = 3;
export const ESPERAS_ENVIO_MS = [5_000, 20_000];
/** Códigos del adaptador en los que Meta RECHAZÓ el mensaje (no salió): reenviar es seguro. Timeout o red NO están aquí: pudo salir. */
const CODIGOS_NO_ENVIADOS_TEMPORALES = new Set(['LIMITE_TASA_EXCEDIDO', 'ERROR_SERVIDOR_META']);
/** El barrido no toca lo recién encolado (lo atiende el disparo inmediato) ni un ENVIANDO que aún puede estar hablando con Meta. */
const GRACIA_ENCOLADO_MS = 10_000;
const ENVIANDO_HUERFANO_MS = 90_000;
const BARRIDO_CADA_MS = 30_000;
const ESPERA_CIERRE_MS = 20_000;

export const MOTIVO_REVISAR =
  'No se pudo confirmar si este mensaje salió (el servidor se reinició o falló a mitad del envío). Revisa en WhatsApp si el cliente lo recibió antes de reenviarlo.';

interface Origen {
  partyId?: string | null;
  ip?: string | null;
  accion?: string;
}

/**
 * Envío de texto a WhatsApp en segundo plano. El mensaje ya está guardado en mensaje_chat con estado ENCOLADO cuando se llama
 * a `despertar`; aquí se reclama de forma atómica (ENCOLADO → ENVIANDO), se habla con Meta UNA vez por intento y se deja
 * ENVIADO o FALLIDO. Un envío nunca se repite si Meta pudo haberlo aceptado: ante la duda queda «REVISAR».
 * Se eligió una cola ligera en proceso (en vez del outbox del sistema) porque el outbox decide texto/plantilla según la
 * ventana y escribe su propio registro en el chat; aquí el mensaje y su idCliente ya existen y la persona espera verlo salir YA.
 * ponytail: el barrido recorre solo lo pendiente (índice parcial); si algún día hay varios servidores, el reclamo atómico ya basta.
 */
@Injectable()
export class EnvioEncoladoService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EnvioEncoladoService.name);
  private barrido?: NodeJS.Timeout;
  private cerrando = false;
  private barriendo = false;
  private readonly enCurso = new Set<Promise<void>>();
  private readonly esperas = new Set<NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGateway,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    if (process.env.JEST_WORKER_ID) return; // en las pruebas nada corre solo
    setTimeout(() => this.seguir(this.barrer()), 3_000).unref();
    this.barrido = setInterval(() => this.seguir(this.barrer()), BARRIDO_CADA_MS);
    this.barrido.unref();
  }

  /** Al apagar: no se empiezan envíos nuevos y se espera (hasta 20 s) a los que ya están hablando con Meta. Lo demás queda en BD para el barrido. */
  async onApplicationShutdown() {
    this.cerrando = true;
    if (this.barrido) clearInterval(this.barrido);
    this.esperas.forEach((t) => clearTimeout(t));
    let t: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...this.enCurso]),
      new Promise((r) => (t = setTimeout(r, ESPERA_CIERRE_MS))),
    ]);
    if (t) clearTimeout(t);
  }

  /** Dispara el envío YA (en cuanto el servidor termina de responder), sin esperar al barrido. */
  despertar(id: bigint) {
    setImmediate(() => this.seguir(this.procesar(id)));
  }

  /** Para esperar de verdad un envío en pruebas y en el cierre. */
  async esperarEnCurso() {
    await Promise.allSettled([...this.enCurso]);
  }

  private seguir(p: Promise<void>) {
    const t = p.catch((e) => this.logger.error(`Envío en segundo plano: ${e?.message ?? e}`)).finally(() => this.enCurso.delete(t));
    this.enCurso.add(t);
  }

  /** Reclamo atómico: solo UNA llamada (de este proceso o de otro) pasa de ENCOLADO a ENVIANDO. */
  private async reclamar(id: bigint) {
    const filas = await this.prisma.$queryRaw<{ id: bigint; conversacion_id: bigint; contenido: any }[]>`
      UPDATE mensaje_chat
      SET contenido = contenido || jsonb_build_object(
        'estado', 'ENVIANDO',
        'intentos', COALESCE((contenido->>'intentos')::int, 0) + 1,
        'inicioEnvio', ${Date.now()}::bigint)
      WHERE id = ${id} AND direccion = 'SALE' AND contenido->>'estado' = 'ENCOLADO'
      RETURNING id, conversacion_id, contenido`;
    return filas[0] ?? null;
  }

  async procesar(id: bigint): Promise<void> {
    if (this.cerrando) return;
    const m = await this.reclamar(id);
    if (!m) return; // otro ya lo tomó o ya terminó: jamás se manda dos veces
    const c = await this.prisma.conversacion.findUnique({ where: { id: m.conversacion_id }, select: { id: true, telefono: true } });
    if (!c || !this.gateway.transmitirTexto) {
      await this.cerrar(m, { estado: 'FALLIDO', errorCodigo: 'ENVIO_NO_DISPONIBLE', errorDetalle: 'Este canal no permite enviar en segundo plano' });
      return;
    }
    let r: MensajeEnviado;
    try {
      r = await this.gateway.transmitirTexto(c.id, c.telefono, String(m.contenido?.texto ?? ''));
    } catch (e: any) {
      // Falló a mitad: no se sabe si Meta lo aceptó. No se reenvía.
      this.logger.error(`Envío del mensaje ${m.id}: ${e?.message ?? e}`);
      await this.cerrar(m, { estado: 'REVISAR', errorCodigo: 'ENVIO_SIN_CONFIRMAR', errorDetalle: null });
      return;
    }
    if (r.estado === 'ENVIADO' || r.estado === 'SIMULADO') {
      await this.cerrar(m, { estado: r.estado, metaId: r.metaId, whatsappMensajeId: r.whatsappMensajeId, errorCodigo: null, errorDetalle: null });
      return;
    }
    const intentos = Number(m.contenido?.intentos ?? 1); // el reclamo ya lo sumó
    if (r.errorCodigo && CODIGOS_NO_ENVIADOS_TEMPORALES.has(r.errorCodigo) && intentos < MAX_INTENTOS_ENVIO) {
      await this.reencolar(m, intentos, r.errorCodigo);
      return;
    }
    await this.cerrar(m, {
      estado: 'FALLIDO',
      metaId: r.metaId,
      whatsappMensajeId: r.whatsappMensajeId,
      errorCodigo: r.errorCodigo || 'ENVIO_FALLIDO',
      errorDetalle: r.errorDetalle ?? null,
    });
  }

  /** Meta rechazó por límite o fallo suyo (el mensaje NO salió): vuelve a la cola con espera creciente. */
  private async reencolar(m: { id: bigint; conversacion_id: bigint }, intentos: number, codigo: string) {
    const espera = ESPERAS_ENVIO_MS[Math.min(intentos - 1, ESPERAS_ENVIO_MS.length - 1)];
    const cambios = JSON.stringify({ estado: 'ENCOLADO', errorCodigo: codigo, listoEn: Date.now() + espera + GRACIA_ENCOLADO_MS });
    const n = await this.prisma.$executeRaw`
      UPDATE mensaje_chat SET contenido = contenido || ${cambios}::jsonb
      WHERE id = ${m.id} AND contenido->>'estado' = 'ENVIANDO'`;
    if (!n || this.cerrando) return;
    const t = setTimeout(() => {
      this.esperas.delete(t);
      this.seguir(this.procesar(m.id));
    }, espera);
    t.unref();
    this.esperas.add(t);
  }

  /** Deja el resultado final (solo si sigue ENVIANDO), avisa a la bandeja por socket y registra la auditoría con el resultado real. */
  private async cerrar(
    m: { id: bigint; conversacion_id: bigint; contenido: any },
    r: { estado: EstadoEnvio; metaId?: string | null; whatsappMensajeId?: bigint | null; errorCodigo?: string | null; errorDetalle?: string | null },
  ) {
    const cambios = JSON.stringify({ estado: r.estado, errorCodigo: r.errorCodigo ?? null, errorDetalle: r.errorDetalle ?? null });
    let n: number;
    try {
      n = await this.prisma.$executeRaw`
        UPDATE mensaje_chat
        SET contenido = contenido || ${cambios}::jsonb,
            meta_id = COALESCE(${r.metaId ?? null}::text, meta_id),
            whatsapp_mensaje_id = COALESCE(${r.whatsappMensajeId ?? null}::bigint, whatsapp_mensaje_id)
        WHERE id = ${m.id} AND contenido->>'estado' = 'ENVIANDO'`;
    } catch (e: any) {
      // p. ej. el id de Meta ya lo tiene otra fila: el resultado igual se anota (si no, un mensaje ya enviado quedaría ENVIANDO)
      this.logger.warn(`Cierre del envío ${m.id} sin enlazar el id de Meta: ${e?.code ?? e?.message ?? e}`);
      n = await this.prisma.$executeRaw`
        UPDATE mensaje_chat SET contenido = contenido || ${cambios}::jsonb
        WHERE id = ${m.id} AND contenido->>'estado' = 'ENVIANDO'`;
    }
    if (!n) return;
    const motivoFallo =
      r.estado === 'REVISAR' ? MOTIVO_REVISAR : r.estado === 'FALLIDO' ? mapearErrorWhatsApp(r.errorCodigo, r.errorDetalle) : null;
    this.eventos?.emitirAdmin('mensajes:envio', {
      id: m.conversacion_id.toString(),
      mensajeId: m.id.toString(),
      idCliente: m.contenido?.idCliente,
      estado: r.estado,
      motivoFallo,
      puedeReintentar: r.estado === 'REVISAR' || r.estado === 'FALLIDO' ? !esErrorVentana24h(r.errorCodigo, r.errorDetalle) : undefined,
    });
    const origen: Origen = m.contenido?.origen ?? {};
    try {
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'mensajes', accion: origen.accion || 'ENVIAR', entidad: 'conversacion', entidadId: m.conversacion_id,
        partyId: origen.partyId ? BigInt(origen.partyId) : undefined,
        despues: { mensajeId: m.id.toString(), estado: r.estado }, ip: origen.ip ?? undefined,
      });
    } catch (e: any) {
      this.logger.warn(`Auditoría del envío ${m.id}: ${e?.message ?? e}`);
    }
  }

  /** Recupera lo que quedó a medias tras un reinicio: ENCOLADO se envía; ENVIANDO se resuelve SIN reenviar a ciegas. */
  async barrer(): Promise<void> {
    if (this.barriendo || this.cerrando) return;
    this.barriendo = true;
    try {
      const ahora = Date.now();
      const filas = await this.prisma.$queryRaw<{ id: bigint; conversacion_id: bigint; contenido: any }[]>`
        SELECT id, conversacion_id, contenido FROM mensaje_chat
        WHERE direccion = 'SALE' AND (contenido->>'estado') IN ('ENCOLADO', 'ENVIANDO')
        ORDER BY id LIMIT 100`;
      for (const f of filas) {
        const estado = f.contenido?.estado;
        if (estado === 'ENCOLADO') {
          const listo = Number(f.contenido?.listoEn ?? 0);
          if (listo <= ahora) await this.procesar(f.id);
        } else if (estado === 'ENVIANDO' && Number(f.contenido?.inicioEnvio ?? 0) + ENVIANDO_HUERFANO_MS <= ahora) {
          await this.resolverHuerfano(f);
        }
      }
    } finally {
      this.barriendo = false;
    }
  }

  /**
   * Un ENVIANDO viejo: el servidor cayó entre «hablar con Meta» y «anotar el resultado». Si el adaptador alcanzó a registrar
   * UN solo whatsapp_mensaje de ese intento, ese es el resultado; si no hay certeza, queda REVISAR (jamás se reenvía solo).
   */
  private async resolverHuerfano(m: { id: bigint; conversacion_id: bigint; contenido: any }) {
    const desde = new Date(Number(m.contenido?.inicioEnvio ?? 0) - 1000);
    const candidatos = await this.prisma.whatsappMensaje.findMany({
      where: { conversacion_id: m.conversacion_id, direccion: 'SALIENTE', tipo: 'TEXTO', creado_en: { gte: desde }, mensajesChat: { none: {} } },
      take: 2,
    });
    if (candidatos.length === 1) {
      const w = candidatos[0];
      if (w.estado === 'FALLIDO') {
        return this.cerrar(m, { estado: 'FALLIDO', whatsappMensajeId: w.id, errorCodigo: w.error_codigo || 'ENVIO_FALLIDO', errorDetalle: w.error_detalle });
      }
      if (w.wa_message_id) {
        return this.cerrar(m, { estado: 'ENVIADO', metaId: w.wa_message_id, whatsappMensajeId: w.id, errorCodigo: null, errorDetalle: null });
      }
    }
    return this.cerrar(m, { estado: 'REVISAR', errorCodigo: 'ENVIO_SIN_CONFIRMAR', errorDetalle: null });
  }
}
