import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { rucValido } from './ruc.util';

export const RUC_API_URL = 'https://openruc.com/api/ruc/';
export const RUC_VIGENCIA_DIAS = 30;
export const RUC_VIGENCIA_NEGATIVO_HORAS = 24;
export const RUC_TOPE_MENSUAL = 90;
export const RUC_TIMEOUT_MS = 5000;

export interface RucDatos {
  ruc: string;
  razon_social: string;
  estado: string | null;
  condicion: string | null;
  direccion: string | null;
  desactualizado: boolean;
}

/** Caché y consulta de RUC a la API gratuita openruc.com (tercero sin SLA: siempre hay respaldo manual). */
@Injectable()
export class RucService {
  private readonly logger = new Logger(RucService.name);

  constructor(private readonly prisma: PrismaService) {}

  async consultar(ruc: string, ahora: Date = new Date()): Promise<RucDatos> {
    if (!rucValido(ruc)) {
      throw new HttpException({ codigo: 'RUC_INVALIDO', mensaje: 'El RUC no es válido (11 dígitos y dígito verificador)' }, HttpStatus.BAD_REQUEST);
    }
    const fila = await this.prisma.rucConsulta.findUnique({ where: { ruc } });
    const edadMs = fila ? ahora.getTime() - fila.actualizado_en.getTime() : Infinity;
    if (fila) {
      if (fila.razon_social === '') {
        // negativo cacheado
        if (edadMs < RUC_VIGENCIA_NEGATIVO_HORAS * 3600_000) this.noEncontrado();
      } else if (edadMs < RUC_VIGENCIA_DIAS * 86_400_000) {
        return this.salida(fila, false);
      }
    }

    // Tope mensual: cada llamada real a la API hace upsert, así que las filas tocadas este mes son las llamadas del mes
    // ponytail: un negativo repetido el mismo mes cuenta una sola vez; contador exacto en tabla aparte si importara.
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const usadas = await this.prisma.rucConsulta.count({ where: { actualizado_en: { gte: inicioMes } } });
    if (usadas >= RUC_TOPE_MENSUAL) {
      this.logger.warn(`Tope mensual de consultas RUC alcanzado (${usadas})`);
      return this.respaldo(fila);
    }

    let res: Response;
    try {
      res = await fetch(RUC_API_URL + ruc, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(RUC_TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.warn(`Consulta RUC falló: ${(e as Error).name}`);
      return this.respaldo(fila);
    }
    if (res.status === 404) {
      await this.prisma.rucConsulta.upsert({
        where: { ruc },
        create: { ruc, razon_social: '', fuente: 'openruc', respuesta: { error: 'not_found' }, consultado_en: ahora, actualizado_en: ahora },
        update: { razon_social: '', respuesta: { error: 'not_found' }, actualizado_en: ahora },
      });
      this.noEncontrado();
    }
    if (!res.ok) {
      this.logger.warn(`Consulta RUC respondió HTTP ${res.status}`);
      return this.respaldo(fila);
    }
    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      this.logger.warn('Consulta RUC con respuesta no JSON');
      return this.respaldo(fila);
    }
    if (!json || json.ruc !== ruc || typeof json.razon_social !== 'string' || json.razon_social.trim() === '') {
      this.logger.warn('Consulta RUC con respuesta malformada');
      return this.respaldo(fila);
    }
    const { _more, ...respuesta } = json; // _more es publicidad
    void _more;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
    const datos = {
      razon_social: json.razon_social.trim(),
      estado: str(json.estado),
      condicion: str(json.condicion),
      direccion: str(json.direccion),
      ubigeo: str(json.ubigeo),
      fuente: str(json.source) ?? 'openruc',
      as_of: str(json.as_of),
      respuesta: respuesta as object,
      actualizado_en: ahora,
    };
    const guardada = await this.prisma.rucConsulta.upsert({
      where: { ruc },
      create: { ruc, consultado_en: ahora, ...datos },
      update: datos,
    });
    return this.salida(guardada, false);
  }

  private noEncontrado(): never {
    throw new HttpException({ codigo: 'RUC_NO_ENCONTRADO', mensaje: 'SUNAT no reconoce este RUC' }, HttpStatus.NOT_FOUND);
  }

  /** API caída o tope: caché vencida marcada desactualizada, o error para ingreso manual. */
  private respaldo(fila: Record<string, any> | null): RucDatos {
    if (fila && fila.razon_social !== '') return this.salida(fila, true);
    throw new HttpException(
      { codigo: 'RUC_NO_DISPONIBLE', mensaje: 'No se pudo consultar SUNAT ahora; puedes escribir la razón social a mano' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private salida(f: Record<string, any>, desactualizado: boolean): RucDatos {
    return { ruc: f.ruc, razon_social: f.razon_social, estado: f.estado, condicion: f.condicion, direccion: f.direccion, desactualizado };
  }
}
