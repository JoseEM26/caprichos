import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';
import { AvisosEquipoCorreoService, enmascararTelefonoAviso } from '../correo';
import { LocalService, obtenerFechaHoraLima } from '../local';
import { aMinutosLima, enteroEnRango, inicioDiaLima, interruptorEncendido, minutosEntre, recortar } from './avisos-programados.util';
import { leerParametro, reclamarMarca } from './marcas';

export const CHAT_ESPERA_DEFECTO_MIN = 15;
export const CHAT_TOPE_POR_HORA = 10;
export const CHAT_REPETIR_HORAS = 6;
/** Chats con más de este tiempo sin actividad no se miran (acota la consulta; el índice parcial cubre lo demás). */
const VENTANA_BUSQUEDA_H = 72;
const INTERVALO_MS = 60_000;
const CLAVE_CANDADO = 'lock:avisos:chat-sin-responder';
/** Mismo valor que MOTIVO_BLOQUEO_SPAM del chatbot: un chat bloqueado por spam no espera a nadie. */
const MOTIVO_SPAM = 'BLOQUEADO_SPAM';
const TIPOS_MARCA = ['CHAT_ESPERA', 'CHAT_RESUMEN', 'CHAT_APERTURA'];

interface ChatEsperando {
  id: bigint;
  telefono: string;
  nombre_contacto: string | null;
  identificador_tipo: string;
  motivo_derivacion: string | null;
  mid: bigint;
  en: Date;
  tipo: string;
  contenido: any;
}

export interface ResultadoChats {
  accion: 'apagado' | 'fuera_de_horario' | 'nada' | 'ok';
  individuales: number;
  agrupadoApertura: number;
  resumen: number;
}

/**
 * Aviso «chat de WhatsApp sin responder». Un chat ESPERA a una persona cuando está en «Por atender» o «Validar pago»
 * (urgente o VALIDAR_PAGO, no archivado ni atendido), su último mensaje es del CLIENTE (nadie —ni persona ni bot— contestó
 * después) y ese mensaje tiene N minutos o más. Solo dentro del horario del local. Un correo por chat (idempotente por
 * chat + último mensaje del cliente), máximo uno por chat cada 6 h y un tope por hora con correo resumen.
 */
@Injectable()
export class ChatSinResponderAvisoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatSinResponderAvisoService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly avisos: AvisosEquipoCorreoService,
    private readonly local: LocalService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.ciclo().catch((err) => this.logger.error(`Aviso de chat sin responder: ${err.message}`, err.stack));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async ciclo(ahora = new Date()): Promise<ResultadoChats | null> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), CLAVE_CANDADO, INTERVALO_MS - 5000);
    if (!candado.adquirido) return null;
    return this.revisar(ahora);
  }

  /** Chats que esperan respuesta humana desde hace `minutos` o más (una consulta; el índice parcial deja fuera a casi todos). */
  async chatsEsperando(ahora: Date, minutos: number): Promise<ChatEsperando[]> {
    const corte = new Date(ahora.getTime() - minutos * 60_000);
    const desde = new Date(ahora.getTime() - VENTANA_BUSQUEDA_H * 3600_000);
    const filas = await this.prisma.$queryRaw<ChatEsperando[]>`
      SELECT c.id, c.telefono, c.nombre_contacto, c.identificador_tipo, c.motivo_derivacion,
             m.id AS mid, m.en, m.tipo, m.contenido
      FROM conversacion c
      CROSS JOIN LATERAL (
        SELECT id, en, tipo, autor, direccion, contenido
        FROM mensaje_chat WHERE conversacion_id = c.id AND tipo <> 'SISTEMA' ORDER BY id DESC LIMIT 1
      ) m
      WHERE (c.urgente OR c.estado = 'VALIDAR_PAGO')
        AND c.estado <> 'ATENDIDA'
        AND c.ultima_actividad >= ${desde}
        AND (c.atendido_en IS NULL OR m.en > c.atendido_en)
        AND m.autor = 'CLIENTE' AND m.direccion = 'ENTRA'
        AND m.en <= ${corte}
      ORDER BY m.en ASC
      LIMIT 200`;
    return filas.filter((f) => f.motivo_derivacion !== MOTIVO_SPAM);
  }

  async revisar(ahora: Date): Promise<ResultadoChats> {
    const vacio: ResultadoChats = { accion: 'nada', individuales: 0, agrupadoApertura: 0, resumen: 0 };
    if (!interruptorEncendido(await leerParametro(this.prisma, 'aviso_chat_sin_responder_activo'))) return { ...vacio, accion: 'apagado' };
    const minutos = enteroEnRango(await leerParametro(this.prisma, 'aviso_chat_sin_responder_min'), CHAT_ESPERA_DEFECTO_MIN, 5, 120);

    // Solo dentro del horario del local (la pausa por alta demanda sigue siendo horario de atención)
    const estado = await this.local.obtenerEstadoCartaSeguro(ahora);
    if (!estado.abierta && estado.motivo !== 'PAUSA') return { ...vacio, accion: 'fuera_de_horario' };

    const candidatos = await this.chatsEsperando(ahora, minutos);
    if (candidatos.length === 0) return vacio;

    const { fechaIso } = obtenerFechaHoraLima(ahora);
    const apertura = estado.abre ? new Date(inicioDiaLima(fechaIso).getTime() + aMinutosLima(estado.abre) * 60_000) : null;

    // Ya avisados en las últimas 6 horas (cualquier forma de aviso)
    const recientes = await this.prisma.avisoMarca.findMany({
      where: { tipo: { in: TIPOS_MARCA }, referencia: { in: candidatos.map((c) => String(c.id)) }, creado_en: { gte: new Date(ahora.getTime() - CHAT_REPETIR_HORAS * 3600_000) } },
      select: { referencia: true },
    });
    const yaAvisados = new Set(recientes.map((r) => r.referencia));
    const pendientes = candidatos.filter((c) => !yaAvisados.has(String(c.id)));
    const res = { ...vacio, accion: 'ok' as const };
    if (pendientes.length === 0) return vacio;

    // 1) Los que ya esperaban cuando abrió el local: UN correo agrupado al abrir
    const acumulados = apertura ? pendientes.filter((c) => c.en < apertura) : [];
    if (acumulados.length > 0 && (await reclamarMarca(this.prisma, `chat-apertura:${fechaIso}`, 'CHAT_APERTURA', 'DIA', ahora))) {
      for (const c of acumulados) await reclamarMarca(this.prisma, `chat-apertura:${fechaIso}:${c.id}`, 'CHAT_APERTURA', String(c.id), ahora);
      await this.avisos.avisar({
        clave: `chat-apertura:${fechaIso}`,
        origen: 'CHAT_SIN_RESPONDER',
        tipo: 'CHAT_SIN_RESPONDER',
        asunto: `${acumulados.length} chat${acumulados.length === 1 ? '' : 's'} de WhatsApp esperan respuesta desde antes de abrir`,
        texto: this.textoLista(`Al abrir el local hay ${acumulados.length} chat${acumulados.length === 1 ? '' : 's'} sin responder:`, acumulados, ahora),
        ahora,
      });
      res.agrupadoApertura = acumulados.length;
    }
    const gestionados = new Set(acumulados.map((c) => c.id));

    // 2) Los demás: un correo por chat, con tope por hora (lo que sobra va en un correo resumen)
    let enviadosHora = await this.prisma.avisoMarca.count({ where: { tipo: 'CHAT_ESPERA', creado_en: { gte: new Date(ahora.getTime() - 3600_000) } } });
    const excedidos: ChatEsperando[] = [];
    for (const c of pendientes.filter((x) => !gestionados.has(x.id))) {
      if (enviadosHora >= CHAT_TOPE_POR_HORA) {
        excedidos.push(c);
        continue;
      }
      // idempotente por (chat, último mensaje del cliente)
      if (!(await reclamarMarca(this.prisma, `chat-espera:${c.id}:${c.mid}`, 'CHAT_ESPERA', String(c.id), ahora))) continue;
      enviadosHora++;
      const espera = minutosEntre(c.en, ahora);
      await this.avisos.avisar({
        clave: `chat-espera:${c.id}:${c.mid}`,
        origen: 'CHAT_SIN_RESPONDER',
        tipo: 'CHAT_SIN_RESPONDER',
        asunto: `Chat de WhatsApp sin responder hace ${espera} min: ${this.nombreDe(c)}`,
        texto:
          `${this.nombreDe(c)} espera respuesta hace ${espera} minutos.\n\n` +
          `Último mensaje: "${this.mensajeDe(c)}"\n\n` +
          `Abrir el chat: ${this.enlaceDe(c)}`,
        ahora,
      });
      res.individuales++;
    }

    if (excedidos.length > 0) {
      const hora = Math.floor(ahora.getTime() / 3600_000);
      if (await reclamarMarca(this.prisma, `chat-resumen:${hora}`, 'CHAT_RESUMEN', 'HORA', ahora)) {
        for (const c of excedidos) await reclamarMarca(this.prisma, `chat-resumen:${hora}:${c.id}`, 'CHAT_RESUMEN', String(c.id), ahora);
        await this.avisos.avisar({
          clave: `chat-resumen:${hora}`,
          origen: 'CHAT_SIN_RESPONDER',
          tipo: 'CHAT_SIN_RESPONDER',
          asunto: `${excedidos.length} chats de WhatsApp esperan respuesta`,
          texto: this.textoLista(`Hay ${excedidos.length} chats más esperando respuesta:`, excedidos, ahora),
          ahora,
        });
        res.resumen = excedidos.length;
      }
    }
    this.logger.log(JSON.stringify({ evento: 'aviso_chat_sin_responder', individuales: res.individuales, agrupadoApertura: res.agrupadoApertura, resumen: res.resumen }));
    return res;
  }

  private nombreDe(c: ChatEsperando): string {
    const n = (c.nombre_contacto ?? '').trim();
    return n ? recortar(n, 40) : enmascararTelefonoAviso(c.telefono);
  }

  /** Último mensaje del cliente, sin adjuntos y de máximo 120 caracteres. */
  private mensajeDe(c: ChatEsperando): string {
    if (c.tipo === 'TEXTO' || c.tipo === 'BOTON') {
      const t = recortar(String(c.contenido?.texto ?? ''), 120);
      if (t) return t;
    }
    return c.tipo === 'IMAGEN' ? '(envió una imagen)' : c.tipo === 'AUDIO' ? '(envió un audio)' : '(envió un mensaje sin texto)';
  }

  /** Enlace a la bandeja con el chat seleccionado (el celular de 9 dígitos, como ya usa MensajesView). */
  private enlaceDe(c: ChatEsperando): string {
    const digitos = String(c.telefono).replace(/\D/g, '');
    const ruta = c.identificador_tipo === 'TELEFONO' && digitos.length >= 9 ? `/admin/mensajes?telefono=${digitos.slice(-9)}` : '/admin/mensajes';
    const base = (this.config.get<string>('CARTA_URL_PUBLICA') ?? '').trim() || (this.config.get<string>('DOMINIO_BASE') ? `https://${this.config.get<string>('DOMINIO_BASE')!.trim()}` : '');
    return `${base.replace(/\/$/, '')}${ruta}`;
  }

  private textoLista(titulo: string, chats: ChatEsperando[], ahora: Date): string {
    const lineas = chats.slice(0, 15).map((c) => `- ${this.nombreDe(c)}: hace ${minutosEntre(c.en, ahora)} min · "${this.mensajeDe(c)}"`);
    const mas = chats.length > 15 ? `\n... y ${chats.length - 15} más.` : '';
    const base = this.enlaceDe({ ...chats[0], telefono: '', identificador_tipo: 'USUARIO_WA' });
    return `${titulo}\n\n${lineas.join('\n')}${mas}\n\nAbrir la bandeja: ${base}`;
  }
}
