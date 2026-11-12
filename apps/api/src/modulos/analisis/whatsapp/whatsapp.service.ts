import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ConsumoWhatsappService, enmascararTelefono } from '../../chatbot';
import { horaLima, resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';
import { resumirMinutos } from '../comun/estadistica';

/** Tope de rachas de mensajes del cliente leídas por consulta (si se pasa, se avisa y se miden las más antiguas). */
export const MAX_RACHAS_WHATSAPP = 20000;
const MAX_ESPERANDO = 50;
const VENTANA_ESPERANDO_H = 72;
const MOTIVO_SPAM = 'BLOQUEADO_SPAM';
const LIMA = 'America/Lima';

type Fila = Record<string, any>;

@Injectable()
export class WhatsappAnalisisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consumo: ConsumoWhatsappService,
  ) {}

  /**
   * Resumen de WhatsApp del rango (los filtros de modalidad, canal y turno no aplican a los chats; el rango sí).
   * `esAdmin` habilita el desglose por persona (el supervisor ve solo el total del equipo).
   */
  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const r = resolverFiltros(filtros, ahora);
    const [respuesta, bot, volumen, derivaciones, salientes, consumo] = await Promise.all([
      this.tiempoDeRespuesta(r.inicio, r.fin, esAdmin),
      this.botVsPersona(r.inicio, r.fin),
      this.volumenPorHora(r.inicio, r.fin),
      this.derivaciones(r.inicio, r.fin),
      this.salientesPorTipo(r.inicio, r.fin),
      this.consumo.obtener(ahora),
    ]);
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: r.desde, hasta: r.hasta, dias: r.dias },
      respuesta,
      bot,
      derivaciones,
      volumen,
      salientes,
      consumoMes: {
        mes: consumo.mes,
        total: consumo.total,
        gratisMes: consumo.gratisMes,
        porcentaje: consumo.porcentaje,
        proyeccionFinDeMes: consumo.proyeccionFinDeMes,
        costoEstimadoPen: consumo.costoEstimadoPen,
      },
    };
  }

  /**
   * Una «racha» empieza cuando el cliente escribe tras un mensaje del bot, de una persona o nada (los mensajes internos no cuentan).
   * Si lo primero que responde después es una PERSONA, la espera humana va del primer mensaje de la racha hasta esa respuesta;
   * si responde primero el BOT, la racha la atendió el bot y no entra a la mediana humana; sin respuesta, se cuenta aparte.
   */
  private async tiempoDeRespuesta(inicio: Date, fin: Date, esAdmin: boolean) {
    const desdeLectura = new Date(inicio.getTime() - 86_400_000);
    const filas = await this.prisma.$queryRaw<Fila[]>`
      WITH m AS (
        SELECT id, conversacion_id, en, autor,
               LAG(autor) OVER (PARTITION BY conversacion_id ORDER BY id) AS previo
        FROM mensaje_chat WHERE tipo <> 'SISTEMA' AND en >= ${desdeLectura} AND en < ${fin}),
      b AS (
        SELECT id, conversacion_id, en FROM m
        WHERE autor = 'CLIENTE' AND (previo IS NULL OR previo <> 'CLIENTE') AND en >= ${inicio}
        ORDER BY en LIMIT ${MAX_RACHAS_WHATSAPP + 1})
      SELECT b.en AS inicio, r.autor AS autor, r.en AS respuesta, r.persona AS persona
      FROM b LEFT JOIN LATERAL (
        SELECT autor, en, contenido->'origen'->>'partyId' AS persona FROM mensaje_chat
        WHERE conversacion_id = b.conversacion_id AND id > b.id AND tipo <> 'SISTEMA' AND autor <> 'CLIENTE' ORDER BY id LIMIT 1) r ON true`;
    const truncado = filas.length > MAX_RACHAS_WHATSAPP;
    const rachas = truncado ? filas.slice(0, MAX_RACHAS_WHATSAPP) : filas;
    const minutos = (f: Fila) => (new Date(f.respuesta).getTime() - new Date(f.inicio).getTime()) / 60000;
    const humanas = rachas.filter((f) => f.autor === 'PERSONA');
    const porHora = Array.from({ length: 24 }, (_, h) => ({
      hora: h,
      ...resumirMinutos(humanas.filter((f) => horaLima(new Date(f.inicio)) === h).map(minutos)),
    }));
    let personas: Array<{ id: string; nombre: string } & ReturnType<typeof resumirMinutos>> | null = null;
    if (esAdmin) {
      const grupos = new Map<string, number[]>();
      for (const f of humanas) grupos.set(f.persona ?? 'sin', [...(grupos.get(f.persona ?? 'sin') ?? []), minutos(f)]);
      const ids = [...grupos.keys()].filter((k) => /^\d+$/.test(k)).map((k) => BigInt(k));
      const nombres = new Map(
        (ids.length ? await this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } }) : []).map(
          (p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()],
        ),
      );
      personas = [...grupos.entries()]
        .map(([id, v]) => ({ id, nombre: id === 'sin' ? 'Sin identificar' : (nombres.get(id) ?? 'Usuario'), ...resumirMinutos(v) }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 30);
    }
    return {
      truncado,
      limite: MAX_RACHAS_WHATSAPP,
      rachas: rachas.length,
      atendidasPorPersona: humanas.length,
      atendidasPorBot: rachas.filter((f) => f.autor === 'BOT').length,
      sinRespuesta: rachas.filter((f) => !f.autor).length,
      equipo: resumirMinutos(humanas.map(minutos)),
      porHora,
      personas,
    };
  }

  /** Chats con mensajes del cliente en el rango: resueltos solo por el bot, con una persona, o sin respuesta. */
  private async botVsPersona(inicio: Date, fin: Date) {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(*)::int AS chats,
             COUNT(*) FILTER (WHERE persona)::int AS con_persona,
             COUNT(*) FILTER (WHERE NOT persona AND bot)::int AS solo_bot,
             COUNT(*) FILTER (WHERE NOT persona AND NOT bot)::int AS sin_respuesta
      FROM (SELECT conversacion_id, bool_or(autor = 'PERSONA') AS persona, bool_or(autor = 'BOT') AS bot
            FROM mensaje_chat WHERE tipo <> 'SISTEMA' AND en >= ${inicio} AND en < ${fin}
            GROUP BY conversacion_id HAVING bool_or(autor = 'CLIENTE')) c`;
    const chats = Number(f?.chats ?? 0);
    const pct = (n: number) => (chats ? Math.round((n / chats) * 1000) / 10 : null);
    const soloBot = Number(f?.solo_bot ?? 0);
    const conPersona = Number(f?.con_persona ?? 0);
    const sinRespuesta = Number(f?.sin_respuesta ?? 0);
    return { chats, soloBot, conPersona, sinRespuesta, pctSoloBot: pct(soloBot), pctConPersona: pct(conPersona), pctSinRespuesta: pct(sinRespuesta) };
  }

  /** Derivaciones = notas «Necesita asesor (MOTIVO)» que el bot deja al pasar el chat a una persona; el motivo sale de esa nota. */
  private async derivaciones(inicio: Date, fin: Date) {
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT COALESCE(substring(contenido->>'texto' from '^Necesita asesor [(]([A-Za-z0-9_]+)[)]'), 'SIN_MOTIVO') AS motivo,
             COUNT(*)::int AS n, COUNT(DISTINCT conversacion_id)::int AS chats
      FROM mensaje_chat WHERE tipo = 'SISTEMA' AND autor = 'BOT' AND contenido->>'nota_asesor' = 'true' AND en >= ${inicio} AND en < ${fin}
      GROUP BY 1 ORDER BY n DESC LIMIT 20`;
    return { total: filas.reduce((s, f) => s + Number(f.n), 0), motivos: filas.map((f) => ({ motivo: String(f.motivo), n: Number(f.n), chats: Number(f.chats) })) };
  }

  /** Mensajes por hora de Lima (0-23), de los clientes, del bot y de las personas. Sin mensajes internos. */
  private async volumenPorHora(inicio: Date, fin: Date) {
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT EXTRACT(HOUR FROM en AT TIME ZONE ${LIMA})::int AS hora,
             COUNT(*) FILTER (WHERE autor = 'CLIENTE')::int AS cliente,
             COUNT(*) FILTER (WHERE autor = 'BOT')::int AS bot,
             COUNT(*) FILTER (WHERE autor = 'PERSONA')::int AS persona
      FROM mensaje_chat WHERE tipo <> 'SISTEMA' AND en >= ${inicio} AND en < ${fin} GROUP BY 1`;
    const por = new Map(filas.map((f) => [Number(f.hora), f]));
    return Array.from({ length: 24 }, (_, hora) => {
      const f = por.get(hora);
      return { hora, cliente: Number(f?.cliente ?? 0), bot: Number(f?.bot ?? 0), persona: Number(f?.persona ?? 0) };
    });
  }

  /** Salientes enviados a Meta por tipo (texto, plantilla…) y por plantilla. No cuentan simulados, fallidos ni encolados. */
  private async salientesPorTipo(inicio: Date, fin: Date) {
    const filas = await this.prisma.whatsappMensaje.groupBy({
      by: ['tipo', 'plantilla'],
      where: { direccion: 'SALIENTE', estado: { in: ['ENVIADO', 'ENTREGADO', 'LEIDO'] }, creado_en: { gte: inicio, lt: fin } },
      _count: { _all: true },
    });
    const porTipo = new Map<string, number>();
    const plantillas = new Map<string, number>();
    for (const f of filas) {
      const n = f._count._all;
      porTipo.set(f.tipo, (porTipo.get(f.tipo) ?? 0) + n);
      if (f.tipo === 'PLANTILLA') plantillas.set(f.plantilla || 'SIN_NOMBRE', (plantillas.get(f.plantilla || 'SIN_NOMBRE') ?? 0) + n);
    }
    return {
      total: [...porTipo.values()].reduce((s, n) => s + n, 0),
      tipos: [...porTipo.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
      plantillas: [...plantillas.entries()].map(([plantilla, n]) => ({ plantilla, n })).sort((a, b) => b.n - a.n).slice(0, 15),
    };
  }

  /**
   * Chats que esperan a una persona AHORA: el último mensaje (sin contar los internos) es del cliente, el chat no está archivado
   * como atendido y es de una persona, urgente o con pago por validar. Celular enmascarado; sin nombres ni textos.
   */
  async sinRespuestaAhora(ahora: Date = new Date()) {
    const desde = new Date(ahora.getTime() - VENTANA_ESPERANDO_H * 3_600_000);
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT c.id, c.telefono, c.estado, c.duenio, c.urgente, m.en
      FROM conversacion c
      CROSS JOIN LATERAL (
        SELECT en, autor, direccion FROM mensaje_chat WHERE conversacion_id = c.id AND tipo <> 'SISTEMA' ORDER BY id DESC LIMIT 1) m
      WHERE (c.duenio = 'PERSONA' OR c.urgente OR c.estado = 'VALIDAR_PAGO')
        AND c.estado <> 'ATENDIDA'
        AND c.ultima_actividad >= ${desde}
        AND (c.atendido_en IS NULL OR m.en > c.atendido_en)
        AND COALESCE(c.motivo_derivacion, '') <> ${MOTIVO_SPAM}
        AND m.autor = 'CLIENTE' AND m.direccion = 'ENTRA'
      ORDER BY m.en ASC LIMIT ${MAX_ESPERANDO + 1}`;
    const items = filas.slice(0, MAX_ESPERANDO).map((f) => ({
      id: String(f.id),
      celular: enmascararTelefono(f.telefono),
      minutos: Math.max(0, Math.round((ahora.getTime() - new Date(f.en).getTime()) / 60000)),
      motivo: f.estado === 'VALIDAR_PAGO' ? 'Validar pago' : f.urgente ? 'Urgente' : 'Con una persona',
      enlace: '/admin/mensajes',
    }));
    return { generadoEn: ahora.toISOString(), total: items.length, hayMas: filas.length > MAX_ESPERANDO, limite: MAX_ESPERANDO, items };
  }
}
