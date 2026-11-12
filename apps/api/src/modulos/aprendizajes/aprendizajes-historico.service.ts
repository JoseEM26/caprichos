import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { hoyLimaIso } from '../../comun/fechas-lima';
import { AprendizajesNocheService, CLAVE_CANDADO_APRENDIZAJES } from './aprendizajes-noche.service';

const CLAVE_PARAMETRO = 'aprendizaje_historico';
const TTL_CANDADO_MS = 6 * 3600_000;

export interface ResumenHistorico {
  estado: 'NUNCA' | 'EN_CURSO' | 'OK' | 'TOPE' | 'ERROR';
  diasProcesados: number;
  diasTotales: number;
  usd: number;
}

interface EstadoGuardado {
  estado: ResumenHistorico['estado'];
  /** US$ gastados en todas las corridas del histórico. */
  usd: number;
  propuestas: number;
  inicio?: string;
  error?: string;
}

/**
 * Análisis ÚNICO de todo el historial de chats derivados a una persona, día por día, con el mismo proceso de cada
 * noche (anonimizar, tema, proponer, agrupar). Corre en segundo plano, con el mismo candado que el nocturno, con un tope
 * total en US$ por corrida y sin repetir las noches ya OK. El umbral de repeticiones aplica sobre todo el historial.
 */
@Injectable()
export class AprendizajesHistoricoService {
  private readonly logger = new Logger(AprendizajesHistoricoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly noche: AprendizajesNocheService,
  ) {}

  private async leer(): Promise<EstadoGuardado> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_PARAMETRO } });
    return (p?.valor as unknown as EstadoGuardado) ?? { estado: 'NUNCA', usd: 0, propuestas: 0 };
  }

  private async guardar(e: EstadoGuardado): Promise<void> {
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_PARAMETRO },
      update: { valor: e as any },
      create: { clave: CLAVE_PARAMETRO, valor: e as any },
    });
  }

  /** Días (Lima) hasta ayer en que una persona escribió en un chat, del más antiguo al más reciente. */
  async diasConChats(): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<Array<{ d: string }>>`
      SELECT DISTINCT to_char((en AT TIME ZONE 'America/Lima')::date, 'YYYY-MM-DD') AS d
      FROM mensaje_chat
      WHERE autor = 'PERSONA' AND direccion = 'SALE'
        AND (en AT TIME ZONE 'America/Lima')::date < ${hoyLimaIso()}::date
      ORDER BY d`;
    return filas.map((f) => f.d);
  }

  async resumen(): Promise<ResumenHistorico> {
    const [g, dias] = await Promise.all([this.leer(), this.diasConChats()]);
    const ok = dias.length
      ? await this.prisma.aprendizajeNoche.count({
          where: { estado: 'OK', fecha: { in: dias.map((d) => new Date(`${d}T00:00:00.000Z`)) } },
        })
      : 0;
    let estado = g.estado;
    // Una corrida «en curso» de hace más de 6 h se cayó (reinicio del servidor): se puede volver a lanzar
    if (estado === 'EN_CURSO' && g.inicio && Date.now() - Date.parse(g.inicio) > TTL_CANDADO_MS) estado = 'ERROR';
    return { estado, diasProcesados: ok, diasTotales: dias.length, usd: Number(g.usd.toFixed(4)) };
  }

  /** Lanza el análisis en segundo plano y responde enseguida. 409 si ya corre o si corre el nocturno. */
  async ejecutar(): Promise<ResumenHistorico> {
    const r = await this.resumen();
    if (r.estado === 'EN_CURSO') {
      throw new ConflictException({ codigo: 'HISTORICO_EN_CURSO', mensaje: 'El análisis del historial ya está corriendo.' });
    }
    const cand = await adquirirCandado(this.redis.obtenerCliente(), CLAVE_CANDADO_APRENDIZAJES, TTL_CANDADO_MS);
    if (!cand.adquirido) {
      throw new ConflictException({
        codigo: 'APRENDIZAJE_OCUPADO',
        mensaje: 'El aprendizaje de la noche está corriendo. Intenta de nuevo en unos minutos.',
      });
    }
    const previo = await this.leer();
    await this.guardar({ ...previo, estado: 'EN_CURSO', propuestas: 0, inicio: new Date().toISOString(), error: undefined });
    // ponytail: segundo plano dentro del mismo proceso (sin cola); si el servidor se reinicia se vuelve a lanzar y retoma
    void this.correr(cand).catch((e) => this.logger.error(`Histórico: ${e?.message}`));
    return { ...r, estado: 'EN_CURSO' };
  }

  /** Recorre los días. Público para las pruebas; quien llama ya tiene el candado. */
  async correr(cand: { token: string; fallback: boolean }): Promise<ResumenHistorico> {
    const g = await this.leer();
    let estado: EstadoGuardado['estado'] = 'OK';
    let error: string | undefined;
    let usdCorrida = 0;
    let propuestas = 0;
    try {
      const par = await this.noche.parametros();
      for (const dia of await this.diasConChats()) {
        const restante = par.topeHistoricoUsd - usdCorrida;
        if (restante <= 0) {
          estado = 'TOPE';
          break;
        }
        const r = await this.noche.correrDia(dia, { topeUsd: restante, ventanaDias: null, avisar: false, soloOk: true });
        usdCorrida += r.usd;
        propuestas += r.nuevas;
        await this.guardar({ ...g, estado: 'EN_CURSO', usd: g.usd + usdCorrida, propuestas, inicio: g.inicio });
        if (r.resumen.estado === 'TOPE') {
          estado = 'TOPE';
          break;
        }
        if (r.resumen.estado === 'ERROR' || r.resumen.estado === 'SIN_IA') {
          estado = 'ERROR';
          error = r.resumen.estado === 'SIN_IA' ? 'La IA no está configurada' : `Falló el día ${dia}`;
          break;
        }
      }
    } catch (e: any) {
      estado = 'ERROR';
      error = String(e?.message ?? e).slice(0, 300);
    } finally {
      if (!cand.fallback) await liberarCandado(this.redis.obtenerCliente(), CLAVE_CANDADO_APRENDIZAJES, cand.token).catch(() => false);
    }
    await this.guardar({ estado, usd: g.usd + usdCorrida, propuestas, inicio: g.inicio, error });
    if (propuestas > 0) await this.noche.avisarAdmin(propuestas).catch((e) => this.logger.warn(`Aviso del histórico: ${e?.message}`));
    return this.resumen();
  }
}
