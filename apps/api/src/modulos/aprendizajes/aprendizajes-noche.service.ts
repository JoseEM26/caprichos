import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { finDiaLimaIso, hoyLimaIso, inicioDiaLimaIso, sumarDiasIso } from '../../comun/fechas-lima';
import { ChatbotIaService } from '../chatbot';
import { anonimizar, palabrasDeNombre } from './anonimizador';
import { claveIntencion, leerPropuestas, leerTemas, PropuestaIa } from './propuesta-json';

export const TIPO_NOTIFICACION_APRENDIZAJES = 'APRENDIZAJES_PROPUESTAS';
export const CLAVE_CANDADO_APRENDIZAJES = 'lock:aprendizajes:noche';
const CLAVE_CANDADO = CLAVE_CANDADO_APRENDIZAJES;
const MAX_CHATS = 300;
const MAX_MENSAJES_CHAT = 40;
const MAX_CARACTERES_CHAT = 1500;
const LOTE_TEMAS = 30;
const LOTE_PROPUESTAS = 15;
const SALIDA_TEMAS = 600;
const SALIDA_PROPUESTAS = 1800;
const MAX_EVIDENCIA = 10;

export interface ParametrosAprendizaje {
  activo: boolean;
  topeUsd: number;
  topeHistoricoUsd: number;
  hora: number;
  minRepeticiones: number;
  usdEntrada: number;
  usdSalida: number;
}

export interface ResumenNoche {
  fecha: string;
  estado: string;
  chatsLeidos: number;
  descartadosFueraTema: number;
  propuestas: number;
  tokens: number;
  usd: number;
}

interface ChatAnonimo {
  id: bigint;
  texto: string;
}

export interface OpcionesDia {
  /** Tope en US$ para este día (el de la noche, o lo que queda de la corrida histórica). */
  topeUsd: number;
  /** Días hacia atrás para sumar a una propuesta previa; null = todo el historial. */
  ventanaDias: number | null;
  avisar: boolean;
  soloOk?: boolean;
}

class TopeAlcanzado extends Error {}

const num = (v: unknown, defecto: number, min: number, max: number): number => {
  const n = Number(typeof v === 'string' ? v.replace(/"/g, '') : v);
  return v == null || !Number.isFinite(n) ? defecto : Math.min(max, Math.max(min, n));
};

const SISTEMA_TEMAS = `Clasificas chats de una pastelería y cafetería. Para cada chat responde su tema:
VENTA (pregunta por carta, precios, tortas, pedidos, delivery, pagos, reservas, promociones),
ATENCION (horarios, ubicación, estado del pedido, dudas del servicio al cliente) o
FUERA (cualquier otra cosa: saludos sueltos, spam, personal, temas ajenos).
Responde SOLO JSON: {"temas":[{"i":0,"tema":"VENTA"}]}`;

const SISTEMA_PROPUESTAS = `Eres analista de atención al cliente de una pastelería y cafetería. Recibes chats anonimizados (C = cliente, P = persona del local, B = bot) que una persona tuvo que atender.
Agrupa los casos que se repiten y propone cómo debería responder el bot. Reglas:
- Una propuesta por caso repetido. "evidencia" son los índices [n] de los chats donde ocurre.
- tipo: FAQ (pregunta frecuente con respuesta fija), FRASES (formas distintas de pedir lo mismo, con "frases") o DERIVAR (casos que el bot debe pasar a una persona).
- NUNCA incluyas precios, stock, horarios ni promociones concretas en la respuesta: eso lo da el sistema.
- No incluyas datos personales (ni <CEL>, <NOMBRE>, <DIR>, <DOC>, <MAIL>).
- Español peruano cálido y breve (máx. 3 frases).
Responde SOLO JSON: {"propuestas":[{"tipo":"FAQ","intencion":"palabra_clave","pregunta":"...","respuesta":"...","frases":[],"evidencia":[0,2]}]}`;

@Injectable()
export class AprendizajesNocheService {
  private readonly logger = new Logger(AprendizajesNocheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ia: ChatbotIaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async parametros(): Promise<ParametrosAprendizaje> {
    const filas = await this.prisma.parametro.findMany({ where: { clave: { startsWith: 'aprendizaje_' } } });
    const p = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
    return {
      activo: String(p.aprendizaje_activo ?? 'si').replace(/"/g, '').toLowerCase() === 'si',
      topeUsd: num(p.aprendizaje_tope_usd_noche, 3, 0, 1000),
      topeHistoricoUsd: num(p.aprendizaje_tope_usd_historico, 10, 0, 10000),
      hora: Math.round(num(p.aprendizaje_hora, 3, 0, 23)),
      minRepeticiones: Math.round(num(p.aprendizaje_min_repeticiones, 3, 1, 50)),
      usdEntrada: num(p.aprendizaje_usd_por_millon_entrada, 0.15, 0, 1000),
      usdSalida: num(p.aprendizaje_usd_por_millon_salida, 0.6, 0, 1000),
    };
  }

  static resumir(n: any): ResumenNoche {
    return {
      fecha: n.fecha.toISOString().slice(0, 10),
      estado: n.estado,
      chatsLeidos: n.chats_leidos,
      descartadosFueraTema: n.descartados_fuera_tema,
      propuestas: n.propuestas,
      tokens: n.tokens_entrada + n.tokens_salida,
      usd: Number(n.usd_estimado),
    };
  }

  /** Día (Lima) de los chats que se leen en la corrida de hoy. */
  ayer(ahora: Date = new Date()): string {
    return sumarDiasIso(hoyLimaIso(ahora), -1);
  }

  /**
   * Procesa los chats de `fecha`. Idempotente: si la noche ya existe no se repite (solo se repiten ERROR y SIN_IA, o un
   * EN_CURSO abandonado hace más de 2 horas). Con candado en Redis para que dos réplicas no corran a la vez.
   */
  async ejecutarNoche(fecha: string): Promise<ResumenNoche> {
    const fechaDb = new Date(`${fecha}T00:00:00.000Z`);
    const previa = await this.prisma.aprendizajeNoche.findUnique({ where: { fecha: fechaDb } });
    if (previa && !this.sePuedeRepetir(previa)) return AprendizajesNocheService.resumir(previa);

    const cand = await adquirirCandado(this.redis.obtenerCliente(), CLAVE_CANDADO, 30 * 60_000);
    if (!cand.adquirido) {
      if (previa) return AprendizajesNocheService.resumir(previa);
      throw new Error('Otra copia del servidor está haciendo el aprendizaje de esta noche');
    }
    try {
      const par = await this.parametros();
      return (await this.correrDia(fecha, { topeUsd: par.topeUsd, ventanaDias: 7, avisar: true })).resumen;
    } finally {
      if (!cand.fallback) await liberarCandado(this.redis.obtenerCliente(), CLAVE_CANDADO, cand.token).catch(() => false);
    }
  }

  /**
   * Un día completo con el candado ya tomado por quien llama. `soloOk`: en el histórico solo las noches OK se saltan
   * (una noche que paró por TOPE se retoma).
   */
  async correrDia(
    fecha: string,
    opc: OpcionesDia,
  ): Promise<{ resumen: ResumenNoche; nuevas: number; usd: number }> {
    const fechaDb = new Date(`${fecha}T00:00:00.000Z`);
    const previa = await this.prisma.aprendizajeNoche.findUnique({ where: { fecha: fechaDb } });
    if (previa && (opc.soloOk ? previa.estado === 'OK' : !this.sePuedeRepetir(previa))) {
      return { resumen: AprendizajesNocheService.resumir(previa), nuevas: 0, usd: 0 };
    }
    const noche = previa
      ? await this.prisma.aprendizajeNoche.update({
          where: { id: previa.id },
          data: { estado: 'EN_CURSO', error: null, terminado_en: null, creado_en: new Date() },
        })
      : await this.prisma.aprendizajeNoche.create({ data: { fecha: fechaDb, estado: 'EN_CURSO' } });
    return this.procesar(noche.id, fecha, opc);
  }

  private sePuedeRepetir(n: { estado: string; creado_en: Date }): boolean {
    if (n.estado === 'ERROR' || n.estado === 'SIN_IA') return true;
    return n.estado === 'EN_CURSO' && Date.now() - n.creado_en.getTime() > 2 * 3600_000;
  }

  private async procesar(
    nocheId: bigint,
    fecha: string,
    opc: OpcionesDia,
  ): Promise<{ resumen: ResumenNoche; nuevas: number; usd: number }> {
    const par = await this.parametros();
    const gasto = { entrada: 0, salida: 0, usd: 0 };
    let estado = 'OK';
    let error: string | null = null;
    let chatsLeidos = 0;
    let fuera = 0;
    let nuevas = 0;
    try {
      if (!this.ia.tieneApiKey()) {
        estado = 'SIN_IA';
      } else {
        const chats = await this.cargarChats(fecha);
        chatsLeidos = chats.length;
        const llamar = async (sistema: string, usuario: string, maxTokens: number) => {
          const estimado = ((sistema.length + usuario.length) / 3.5) * par.usdEntrada / 1e6 + (maxTokens * par.usdSalida) / 1e6;
          if (gasto.usd + estimado > opc.topeUsd) throw new TopeAlcanzado();
          const r = await this.ia.completarJson([{ role: 'system', content: sistema }, { role: 'user', content: usuario }], maxTokens);
          gasto.entrada += r.tokensEntrada;
          gasto.salida += r.tokensSalida;
          gasto.usd = (gasto.entrada * par.usdEntrada + gasto.salida * par.usdSalida) / 1e6;
          return r.texto;
        };
        try {
          // Paso 1: tema en lote. FUERA se descarta.
          const utiles: ChatAnonimo[] = [];
          for (let i = 0; i < chats.length; i += LOTE_TEMAS) {
            const lote = chats.slice(i, i + LOTE_TEMAS);
            const crudo = await llamar(SISTEMA_TEMAS, lote.map((c, k) => `[${k}] ${c.texto.slice(0, 400)}`).join('\n'), SALIDA_TEMAS);
            const temas = leerTemas(crudo, lote.length);
            lote.forEach((c, k) => (temas[k] === 'FUERA' ? fuera++ : utiles.push(c)));
          }
          // Paso 2: agrupar y proponer. Se junta por intención dentro de la noche.
          const candidatas = new Map<string, { p: PropuestaIa; evidencia: Map<string, string> }>();
          let invalidas = 0;
          for (let i = 0; i < utiles.length; i += LOTE_PROPUESTAS) {
            const lote = utiles.slice(i, i + LOTE_PROPUESTAS);
            const crudo = await llamar(SISTEMA_PROPUESTAS, lote.map((c, k) => `[${k}] ${c.texto}`).join('\n\n'), SALIDA_PROPUESTAS);
            const { validas, invalidas: malas } = leerPropuestas(crudo, lote.length);
            invalidas += malas;
            for (const p of validas) {
              const k = claveIntencion(p.intencion);
              const c = candidatas.get(k) ?? { p, evidencia: new Map<string, string>() };
              for (const idx of p.evidencia) c.evidencia.set(lote[idx].id.toString(), lote[idx].texto.slice(0, 300));
              candidatas.set(k, c);
            }
          }
          if (invalidas > 0) error = `${invalidas} respuesta(s) de la IA con formato inválido descartadas`;
          nuevas = await this.guardar(nocheId, candidatas, par.minRepeticiones, opc.ventanaDias);
        } catch (e) {
          if (e instanceof TopeAlcanzado) estado = 'TOPE';
          else throw e;
        }
      }
    } catch (e: any) {
      estado = 'ERROR';
      error = String(e?.message ?? e).slice(0, 500);
      this.logger.error(`Aprendizaje de ${fecha}: ${error}`);
    }
    const fin = await this.prisma.aprendizajeNoche.update({
      where: { id: nocheId },
      data: {
        estado,
        chats_leidos: chatsLeidos,
        descartados_fuera_tema: fuera,
        propuestas: nuevas,
        tokens_entrada: gasto.entrada,
        tokens_salida: gasto.salida,
        usd_estimado: gasto.usd.toFixed(4),
        error,
        terminado_en: new Date(),
      },
    });
    if (opc.avisar && nuevas > 0) await this.avisarAdmin(nuevas).catch((e) => this.logger.warn(`Aviso de propuestas: ${e?.message}`));
    return { resumen: AprendizajesNocheService.resumir(fin), nuevas, usd: gasto.usd };
  }

  /**
   * Chats del día que una persona atendió (escribió ella) y quedaron archivados como atendidos, ya anonimizados.
   * No se filtra por dueño actual: a las 00:01 el bot los retoma.
   */
  async cargarChats(fecha: string): Promise<ChatAnonimo[]> {
    const desde = inicioDiaLimaIso(fecha);
    const hasta = finDiaLimaIso(fecha);
    const convs = await this.prisma.conversacion.findMany({
      where: {
        OR: [{ estado: 'ATENDIDA' }, { atendido_en: { not: null } }],
        mensajes: { some: { autor: 'PERSONA', direccion: 'SALE', en: { gte: desde, lte: hasta } } },
      },
      select: {
        id: true,
        nombre_contacto: true,
        party: { select: { persona: { select: { nombres: true, apellidos: true } } } },
        mensajes: {
          where: { en: { gte: desde, lte: hasta }, tipo: { in: ['TEXTO', 'BOTON'] } },
          orderBy: { id: 'asc' },
          take: MAX_MENSAJES_CHAT,
          select: { autor: true, contenido: true },
        },
      },
      orderBy: { id: 'asc' },
      take: MAX_CHATS,
    });
    const salida: ChatAnonimo[] = [];
    for (const c of convs) {
      const nombres = palabrasDeNombre(c.nombre_contacto, c.party?.persona?.nombres, c.party?.persona?.apellidos);
      const lineas = c.mensajes
        .map((m) => {
          const t = anonimizar((m.contenido as any)?.texto, nombres);
          return t ? `${m.autor === 'CLIENTE' ? 'C' : m.autor === 'PERSONA' ? 'P' : 'B'}: ${t}` : '';
        })
        .filter(Boolean);
      if (lineas.length) salida.push({ id: c.id, texto: lineas.join('\n').slice(0, MAX_CARACTERES_CHAT) });
    }
    return salida;
  }

  /**
   * Guarda las candidatas. Si hay una propuesta de los últimos 7 días con la misma intención (PENDIENTE, visible o en
   * observación) se le suman repeticiones y pruebas en vez de duplicar. Las que no llegan al mínimo quedan «en
   * observación» (PENDIENTE con pocas repeticiones, ocultas en la lista) hasta que otra noche las complete.
   * Se omiten las intenciones ya vigentes o descartadas hace menos de 30 días. Devuelve cuántas llegaron al mínimo ahora.
   */
  private async guardar(
    nocheId: bigint,
    candidatas: Map<string, { p: PropuestaIa; evidencia: Map<string, string> }>,
    minimo: number,
    ventanaDias: number | null,
  ): Promise<number> {
    // ventanaDias null (histórico): se acumula con todo el historial pendiente
    const hace7 = ventanaDias == null ? new Date(0) : new Date(Date.now() - ventanaDias * 86400_000);
    const hace30 = new Date(Date.now() - 30 * 86400_000);
    const [pendientes, vigentes, descartadas] = await Promise.all([
      this.prisma.aprendizajePropuesto.findMany({ where: { estado: 'PENDIENTE', creado_en: { gte: hace7 } } }),
      this.prisma.conocimientoBot.findMany({ where: { estado: 'VIGENTE' }, select: { intencion: true } }),
      this.prisma.aprendizajePropuesto.findMany({ where: { estado: 'DESCARTADO', decidido_en: { gte: hace30 } }, select: { intencion: true } }),
    ]);
    const bloqueadas = new Set([...vigentes, ...descartadas].map((x) => claveIntencion(x.intencion)));
    let nuevas = 0;
    for (const [clave, c] of candidatas) {
      if (bloqueadas.has(clave)) continue;
      const previa = pendientes.find((x) => claveIntencion(x.intencion) === clave);
      const evid = new Map<string, string>();
      for (const e of ((previa?.evidencia as any[]) ?? [])) evid.set(String(e.conversacionId), String(e.extracto));
      for (const [id, ext] of c.evidencia) evid.set(id, ext);
      const evidencia = [...evid].slice(0, MAX_EVIDENCIA).map(([conversacionId, extracto]) => ({ conversacionId, extracto }));
      const repeticiones = evid.size;
      const antes = previa ? previa.repeticiones : 0;
      if (previa) {
        await this.prisma.aprendizajePropuesto.update({ where: { id: previa.id }, data: { repeticiones, evidencia: evidencia as any } });
      } else {
        await this.prisma.aprendizajePropuesto.create({
          data: {
            noche_id: nocheId, tipo: c.p.tipo, intencion: c.p.intencion, pregunta: c.p.pregunta, respuesta: c.p.respuesta,
            frases: c.p.frases as any, repeticiones, evidencia: evidencia as any,
          },
        });
      }
      if (repeticiones >= minimo && antes < minimo) nuevas++;
    }
    return nuevas;
  }

  async avisarAdmin(n: number): Promise<void> {
    const titulo = n === 1 ? '1 propuesta nueva para revisar' : `${n} propuestas nuevas para revisar`;
    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: TIPO_NOTIFICACION_APRENDIZAJES,
        rol_destino: 'ADMIN',
        titulo,
        mensaje: 'El bot aprendió de los chats de ayer. Revisa y aprueba lo que sirva.',
        enlace: '/admin/aprendizajes',
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
  }
}
