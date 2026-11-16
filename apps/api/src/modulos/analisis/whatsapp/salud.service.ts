import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { hashTelefono } from '../../chatbot/utilidades/enmascarar.util';
import { resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';

const LIMA = 'America/Lima';
/** Valores por defecto de los topes (los mismos de Configuración › WhatsApp si el ADMIN no los cambió). */
const TOPES_DEFECTO = { minuto: 3, hora: 60, dia: 350 };
/** Orígenes del outbox que responden a algo que el cliente escribió. */
const ORIGENES_RESPUESTA = ['VOUCHER', 'BOT_ERROR', 'TOPE_SIN_PAGAR', 'AUTORESPUESTA', 'NO_COMPATIBLE'];
/** Los pidió el cliente (código, reserva, cuenta) o van al equipo: no son «mensajes que iniciamos» a un cliente. */
const ORIGENES_PEDIDOS = ['CODIGO_CUENTA', 'RESERVA', 'AVISO_CUENTA'];
const ORIGENES_EQUIPO = ['ALERTA_ADMIN', 'EQUIPO_NUEVO_PEDIDO', 'EQUIPO_ALERTA_ALMACEN'];
const MAX_NUMEROS = 5000;
const LOTE = 500;
const ACCIONES_CONEXION = ['pausa_automatica', 'reanudar_automatico', 'pausar', 'reanudar', 'desconexion', 'reconexion'];

export type NivelUso = 'ok' | 'atencion' | 'critico';
/** 70 % o más = atención; 90 % o más = crítico. Sin tope (0) no hay porcentaje. */
export const nivelDeUso = (pct: number | null): NivelUso => (pct == null ? 'ok' : pct >= 90 ? 'critico' : pct >= 70 ? 'atencion' : 'ok');
const pctDe = (n: number, tope: number) => (tope > 0 ? Math.round((n / tope) * 1000) / 10 : null);

type Fila = Record<string, any>;
export interface Recomendacion {
  nivel: 'alta' | 'media' | 'info';
  texto: string;
}

@Injectable()
export class SaludBotAnalisisService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(filtros: FiltrosAnalisis, ahora: Date = new Date()) {
    const r = resolverFiltros(filtros, ahora);
    const [topes, envio, estados, origenes, entrantes, tiposBot, ia, derivadas, eventos, encuestas, sinContacto] = await Promise.all([
      this.topes(),
      this.enviosPorHora(r.inicio, r.fin),
      this.estadosDeLaCola(r.inicio, r.fin),
      this.enviadosPorOrigen(r.inicio, r.fin),
      this.entrantes(r.inicio, r.fin),
      this.respuestasDelBot(r.inicio, r.fin),
      this.turnosIa(r.inicio, r.fin),
      this.derivadas(r.inicio, r.fin),
      this.eventosConexion(r.inicio, r.fin),
      this.encuestas(r.inicio, r.fin),
      this.sinContactoPrevio(r.inicio, r.fin),
    ]);

    // Por día (todos los días del rango, también los de cero) y por hora del día (suma y pico de una hora concreta)
    const porDia = Array.from({ length: r.dias }, (_, i) => {
      const fecha = new Date(r.inicio.getTime() + i * 86_400_000 - 5 * 3_600_000).toISOString().slice(0, 10);
      const n = envio.horas.filter((h) => h.dia === fecha).reduce((s, h) => s + h.n, 0);
      const pct = pctDe(n, topes.dia);
      return { fecha, enviados: n, pct, nivel: nivelDeUso(pct) };
    });
    const porHoraDelDia = Array.from({ length: 24 }, (_, hora) => {
      const celdas = envio.horas.filter((h) => h.hora === hora);
      const pico = Math.max(0, ...celdas.map((c) => c.n));
      const pctPico = pctDe(pico, topes.hora);
      return { hora, total: celdas.reduce((s, c) => s + c.n, 0), pico, pctPico, nivel: nivelDeUso(pctPico) };
    });
    const picoHora = Math.max(0, ...envio.horas.map((h) => h.n));
    const diaMax = porDia.reduce((a, d) => (d.enviados > a.enviados ? d : a), porDia[0]);
    const uso = {
      dia: { max: diaMax.enviados, fecha: diaMax.fecha, tope: topes.dia, pct: diaMax.pct, nivel: diaMax.nivel },
      hora: { max: picoHora, fecha: null as string | null, tope: topes.hora, pct: pctDe(picoHora, topes.hora), nivel: nivelDeUso(pctDe(picoHora, topes.hora)) },
      minuto: { max: envio.picoMinuto, fecha: null as string | null, tope: topes.minuto, pct: pctDe(envio.picoMinuto, topes.minuto), nivel: nivelDeUso(pctDe(envio.picoMinuto, topes.minuto)) },
    };

    // Salientes enviados: respuestas, pedidos por el cliente, al equipo e iniciados por nosotros (a clientes)
    const suma = (lista: string[]) => origenes.filter((o) => lista.includes(o.origen)).reduce((s, o) => s + o.n, 0);
    const totalEnviados = origenes.reduce((s, o) => s + o.n, 0);
    const respuestas = suma(ORIGENES_RESPUESTA);
    const pedidos = suma(ORIGENES_PEDIDOS);
    const equipo = suma(ORIGENES_EQUIPO);
    const iniciados = totalEnviados - respuestas - pedidos - equipo;
    const proporcion = {
      totalEnviados,
      respuestas,
      pedidosPorElCliente: pedidos,
      alEquipo: equipo,
      iniciados,
      pctIniciados: totalEnviados ? Math.round((iniciados / totalEnviados) * 1000) / 10 : null,
      entrantes,
      salientesPorEntrante: entrantes ? Math.round((totalEnviados / entrantes) * 100) / 100 : null,
      sinContactoPrevio: sinContacto,
      porOrigen: [...origenes].sort((a, b) => b.n - a.n).slice(0, 12),
    };

    const bot = {
      ...tiposBot,
      ia: ia.turnos,
      // El resto de lo que dijo el bot (menú, botones, flujos) = total - los tipos conocidos - los turnos de IA
      menu: Math.max(0, tiposBot.otros - ia.turnos),
      turnosPorConversacion: { conversaciones: ia.conversaciones, promedio: ia.conversaciones ? Math.round((ia.turnos / ia.conversaciones) * 10) / 10 : null, maximo: ia.maximo },
      derivadasAPersona: derivadas,
      iaDerivo: ia.derivados,
      iaErrores: ia.errores,
    };

    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: r.desde, hasta: r.hasta, dias: r.dias },
      proveedor: topes.proveedor,
      topes: { minuto: topes.minuto, hora: topes.hora, dia: topes.dia },
      uso,
      porDia,
      porHoraDelDia,
      cola: estados,
      proporcion,
      bot,
      conexion: eventos,
      encuestas,
      recomendaciones: this.recomendar({ uso, cola: estados, proporcion, conexion: eventos, encuestas }),
    };
  }

  /** Topes y proveedor de Configuración › WhatsApp (los de `parametro`; con 0 = sin tope). */
  private async topes() {
    const filas = await this.prisma.parametro.findMany({
      where: { clave: { in: ['evolution_limite_minuto', 'evolution_limite_hora', 'evolution_limite_dia', 'whatsapp_proveedor'] } },
      select: { clave: true, valor: true },
    });
    const v = new Map(filas.map((f) => [f.clave, f.valor]));
    const num = (clave: string, defecto: number) => {
      const crudo = v.get(clave);
      const n = Number(crudo);
      return crudo !== undefined && crudo !== null && crudo !== '' && Number.isFinite(n) && n >= 0 ? n : defecto;
    };
    return {
      proveedor: String(v.get('whatsapp_proveedor') ?? 'META').toUpperCase() === 'EVOLUTION' ? 'EVOLUTION' : 'META',
      minuto: num('evolution_limite_minuto', TOPES_DEFECTO.minuto),
      hora: num('evolution_limite_hora', TOPES_DEFECTO.hora),
      dia: num('evolution_limite_dia', TOPES_DEFECTO.dia),
    };
  }

  /** Enviados del outbox por hora de Lima (lo mismo que cuentan los topes) y el pico en un solo minuto. */
  private async enviosPorHora(inicio: Date, fin: Date) {
    const [filas, pico] = await Promise.all([
      this.prisma.$queryRaw<Fila[]>`
        SELECT to_char(date_trunc('hour', enviado_en AT TIME ZONE ${LIMA}), 'YYYY-MM-DD"T"HH24') AS h, COUNT(*)::int AS n
        FROM saliente_whatsapp WHERE estado = 'ENVIADO' AND enviado_en >= ${inicio} AND enviado_en < ${fin} GROUP BY 1`,
      this.prisma.$queryRaw<Fila[]>`
        SELECT COUNT(*)::int AS n FROM saliente_whatsapp WHERE estado = 'ENVIADO' AND enviado_en >= ${inicio} AND enviado_en < ${fin}
        GROUP BY date_trunc('minute', enviado_en) ORDER BY 1 DESC LIMIT 1`,
    ]);
    return {
      horas: filas.map((f) => ({ dia: String(f.h).slice(0, 10), hora: Number(String(f.h).slice(11)), n: Number(f.n) })),
      picoMinuto: Number(pico[0]?.n ?? 0),
    };
  }

  /** Estado de lo encolado en el período, y el motivo de los descartados y fallidos (el código entre corchetes de ultimo_error). */
  private async estadosDeLaCola(inicio: Date, fin: Date) {
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT estado,
             CASE WHEN estado IN ('DESCARTADO', 'FALLIDO') THEN COALESCE(substring(ultimo_error from '^[[]([A-Z0-9_]+)[]]'), 'SIN_CODIGO') END AS codigo,
             COUNT(*)::int AS n
      FROM saliente_whatsapp WHERE creado_en >= ${inicio} AND creado_en < ${fin} GROUP BY 1, 2`;
    const total = (e: string) => filas.filter((f) => f.estado === e).reduce((s, f) => s + Number(f.n), 0);
    const motivos = (e: string) =>
      filas.filter((f) => f.estado === e).map((f) => ({ codigo: String(f.codigo), n: Number(f.n) })).sort((a, b) => b.n - a.n);
    const enviados = total('ENVIADO');
    const fallidos = total('FALLIDO');
    const descartados = total('DESCARTADO');
    const pendientes = total('PENDIENTE') + total('ENVIANDO');
    const cierre = enviados + fallidos + descartados;
    return {
      enviados,
      fallidos,
      descartados,
      pendientes,
      pctFallidos: cierre ? Math.round((fallidos / cierre) * 1000) / 10 : null,
      motivosDescartados: motivos('DESCARTADO'),
      motivosFallidos: motivos('FALLIDO'),
    };
  }

  private async enviadosPorOrigen(inicio: Date, fin: Date) {
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT origen, COUNT(*)::int AS n FROM saliente_whatsapp
      WHERE estado = 'ENVIADO' AND enviado_en >= ${inicio} AND enviado_en < ${fin} GROUP BY 1`;
    return filas.map((f) => ({ origen: String(f.origen), n: Number(f.n) }));
  }

  private async entrantes(inicio: Date, fin: Date): Promise<number> {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(*)::int AS n FROM mensaje_chat WHERE autor = 'CLIENTE' AND direccion = 'ENTRA' AND tipo <> 'SISTEMA' AND en >= ${inicio} AND en < ${fin}`;
    return Number(f?.n ?? 0);
  }

  /**
   * Indicador clave de baneo: mensajes que INICIAMOS (avisos, encuesta, recordatorios) a un número que nunca nos había escrito
   * hasta el primer envío del período. Debe ser ~0. Se calcula con el hash del celular: nunca sale un número.
   */
  private async sinContactoPrevio(inicio: Date, fin: Date) {
    const excluidos = [...ORIGENES_RESPUESTA, ...ORIGENES_PEDIDOS, ...ORIGENES_EQUIPO];
    const filas = await this.prisma.$queryRaw<Fila[]>`
      SELECT telefono_destino AS tel, MIN(enviado_en) AS primero, COUNT(*)::int AS n FROM saliente_whatsapp
      WHERE estado = 'ENVIADO' AND enviado_en >= ${inicio} AND enviado_en < ${fin} AND origen <> ALL(${excluidos}::text[])
      GROUP BY 1 LIMIT ${MAX_NUMEROS + 1}`;
    const truncado = filas.length > MAX_NUMEROS;
    const numeros = (truncado ? filas.slice(0, MAX_NUMEROS) : filas).map((f) => ({ hash: hashTelefono(String(f.tel)), primero: new Date(f.primero), n: Number(f.n) }));
    const primerEntrante = new Map<string, Date>();
    const hashes = [...new Set(numeros.map((x) => x.hash))];
    for (let i = 0; i < hashes.length; i += LOTE) {
      const grupo = await this.prisma.whatsappMensaje.groupBy({
        by: ['telefono_hash'],
        where: { direccion: 'ENTRANTE', telefono_hash: { in: hashes.slice(i, i + LOTE) } },
        _min: { creado_en: true },
      });
      for (const g of grupo) if (g._min.creado_en) primerEntrante.set(g.telefono_hash, g._min.creado_en);
    }
    const nunca = numeros.filter((x) => {
      const e = primerEntrante.get(x.hash);
      return !e || e > x.primero;
    });
    return { numeros: nunca.length, mensajes: nunca.reduce((s, x) => s + x.n, 0), numerosRevisados: numeros.length, truncado };
  }

  /** Lo que dijo el bot (sin notas internas ni envíos fallidos), por tipo reconocible; `otros` incluye menú e IA. */
  private async respuestasDelBot(inicio: Date, fin: Date) {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE contenido->>'etapa' = 'AUTORESPUESTA_FUERA_DE_HORARIO')::int AS cerrado,
             COUNT(*) FILTER (WHERE contenido->>'etapa' = 'AUTORESPUESTA_BIENVENIDA')::int AS bienvenida,
             COUNT(*) FILTER (WHERE contenido->>'origen' = 'ENCUESTA' OR contenido->>'etapa' = 'ENCUESTA')::int AS encuesta,
             COUNT(*) FILTER (WHERE contenido->>'origen' = 'AVISO_PEDIDO')::int AS aviso_pedido
      FROM mensaje_chat WHERE autor = 'BOT' AND direccion = 'SALE' AND tipo <> 'SISTEMA' AND en >= ${inicio} AND en < ${fin}`;
    const total = Number(f?.total ?? 0);
    const cerrado = Number(f?.cerrado ?? 0);
    const bienvenida = Number(f?.bienvenida ?? 0);
    const encuesta = Number(f?.encuesta ?? 0);
    const avisoPedido = Number(f?.aviso_pedido ?? 0);
    return { total, cerrado, bienvenida, encuesta, avisoPedido, otros: Math.max(0, total - cerrado - bienvenida - encuesta - avisoPedido) };
  }

  private async turnosIa(inicio: Date, fin: Date) {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COALESCE(SUM(c), 0)::int AS turnos, COUNT(*)::int AS conversaciones, COALESCE(MAX(c), 0)::int AS maximo,
             COALESCE(SUM(derivados), 0)::int AS derivados, COALESCE(SUM(errores), 0)::int AS errores
      FROM (SELECT conversacion_id, COUNT(*) AS c,
                   COUNT(*) FILTER (WHERE resultado = 'DERIVADO_PERSONA') AS derivados,
                   COUNT(*) FILTER (WHERE resultado = 'ERROR') AS errores
            FROM ia_consumo WHERE origen = 'CHATBOT' AND conversacion_id IS NOT NULL AND fecha >= ${inicio} AND fecha < ${fin}
            GROUP BY conversacion_id) t`;
    return {
      turnos: Number(f?.turnos ?? 0),
      conversaciones: Number(f?.conversaciones ?? 0),
      maximo: Number(f?.maximo ?? 0),
      derivados: Number(f?.derivados ?? 0),
      errores: Number(f?.errores ?? 0),
    };
  }

  /** Chats que el bot pasó a una persona (nota «Necesita asesor»). */
  private async derivadas(inicio: Date, fin: Date): Promise<number> {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(DISTINCT conversacion_id)::int AS n FROM mensaje_chat
      WHERE tipo = 'SISTEMA' AND autor = 'BOT' AND contenido->>'nota_asesor' = 'true' AND en >= ${inicio} AND en < ${fin}`;
    return Number(f?.n ?? 0);
  }

  /** Pausas, desconexiones y reconexiones de Evolution, desde la auditoría (módulo whatsapp_proveedor). Sin datos personales. */
  private async eventosConexion(inicio: Date, fin: Date) {
    const filas = await this.prisma.auditoria.findMany({
      where: { modulo: 'whatsapp_proveedor', accion: { in: ACCIONES_CONEXION }, en: { gte: inicio, lt: fin } },
      orderBy: { en: 'desc' },
      take: 200,
      select: { accion: true, en: true, despues: true },
    });
    const cuenta = (a: string) => filas.filter((f) => f.accion === a).length;
    return {
      pausasAutomaticas: cuenta('pausa_automatica'),
      pausasManuales: cuenta('pausar'),
      desconexiones: cuenta('desconexion'),
      reconexiones: cuenta('reconexion'),
      reanudaciones: cuenta('reanudar_automatico') + cuenta('reanudar'),
      ultimos: filas.slice(0, 10).map((f) => ({
        accion: f.accion,
        en: f.en.toISOString(),
        motivo: typeof (f.despues as Fila | null)?.motivo === 'string' ? String((f.despues as Fila).motivo) : null,
      })),
    };
  }

  private async encuestas(inicio: Date, fin: Date) {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(*)::int AS enviadas,
             COUNT(*) FILTER (WHERE estado = 'RESPONDIDA')::int AS respondidas,
             ROUND(AVG(puntaje) FILTER (WHERE estado = 'RESPONDIDA' AND puntaje BETWEEN 1 AND 5)::numeric, 2) AS promedio
      FROM encuesta_posventa WHERE estado IN ('ENVIADA', 'RESPONDIDA', 'EXPIRADA') AND enviada_en >= ${inicio} AND enviada_en < ${fin}`;
    const enviadas = Number(f?.enviadas ?? 0);
    const respondidas = Number(f?.respondidas ?? 0);
    return {
      enviadas,
      respondidas,
      tasaRespuesta: enviadas ? Math.round((respondidas / enviadas) * 1000) / 10 : null,
      promedio: f?.promedio == null ? null : Number(f.promedio),
    };
  }

  /** Reglas simples sobre los números (sin IA), de lo más grave a lo informativo. */
  private recomendar(d: {
    uso: { dia: any; hora: any; minuto: any };
    cola: { fallidos: number; pctFallidos: number | null };
    proporcion: { pctIniciados: number | null; sinContactoPrevio: { numeros: number; mensajes: number } };
    conexion: { pausasAutomaticas: number; desconexiones: number };
    encuestas: { enviadas: number; tasaRespuesta: number | null };
  }): Recomendacion[] {
    const out: Recomendacion[] = [];
    const { uso, cola, proporcion, conexion, encuestas } = d;
    for (const [nombre, u] of [['diario', uso.dia], ['por hora', uso.hora], ['por minuto', uso.minuto]] as const) {
      if (u.nivel === 'ok' || u.pct == null) continue;
      const cuando = u.fecha ? ` el ${u.fecha}` : '';
      out.push({
        nivel: u.nivel === 'critico' ? 'alta' : 'media',
        texto: `Se usó el ${u.pct.toLocaleString('es-PE')} % del tope ${nombre}${cuando} (${u.max} de ${u.tope}). ${u.nivel === 'critico' ? 'Baja los avisos promocionales y los recordatorios hasta que se normalice.' : 'Vigila que no siga subiendo.'}`,
      });
    }
    if (proporcion.sinContactoPrevio.numeros > 0) {
      out.push({
        nivel: 'alta',
        texto: `${proporcion.sinContactoPrevio.mensajes} mensajes iniciados por nosotros a ${proporcion.sinContactoPrevio.numeros} números que nunca escribieron. Es la señal que más pesa para un baneo: revisa de dónde salen (Salientes › origen) y apaga ese aviso.`,
      });
    }
    if (proporcion.pctIniciados != null && proporcion.pctIniciados > 50) {
      out.push({ nivel: 'media', texto: `El ${proporcion.pctIniciados.toLocaleString('es-PE')} % de lo enviado lo iniciamos nosotros, no es respuesta. Lo sano es que la mayoría sea respuesta a un cliente.` });
    }
    if (conexion.pausasAutomaticas > 0) {
      out.push({ nivel: 'alta', texto: `Evolution se pausó solo ${conexion.pausasAutomaticas} ${conexion.pausasAutomaticas === 1 ? 'vez' : 'veces'} en el período. Revisa el motivo abajo y el estado del número en Configuración.` });
    }
    if (conexion.desconexiones >= 3) {
      out.push({ nivel: 'media', texto: `El número se desconectó ${conexion.desconexiones} veces: si se repite, revisa el celular vinculado y su internet.` });
    }
    if (cola.pctFallidos != null && cola.pctFallidos >= 10 && cola.fallidos >= 3) {
      out.push({ nivel: 'media', texto: `${cola.pctFallidos.toLocaleString('es-PE')} % de los mensajes fallaron (${cola.fallidos}). Mira el motivo en la tabla y los envíos fallidos en Salientes.` });
    }
    if (encuestas.enviadas >= 10 && encuestas.tasaRespuesta != null && encuestas.tasaRespuesta < 20) {
      out.push({ nivel: 'info', texto: `Solo responde el ${encuestas.tasaRespuesta.toLocaleString('es-PE')} % de las encuestas: prueba un texto más corto o enviarla más cerca de la entrega.` });
    }
    if (!out.length) out.push({ nivel: 'info', texto: 'Sin señales de riesgo en este período: topes por debajo del 70 %, sin mensajes a números desconocidos y sin pausas automáticas.' });
    return out;
  }
}
