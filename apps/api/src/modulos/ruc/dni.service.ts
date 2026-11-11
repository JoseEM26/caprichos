import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../comun/redis/redis.service';
import { consultarApisperu, tokenApisperu, topeMensualApisperu } from './apisperu';

export const DNI_CACHE_SEGUNDOS = 24 * 3600;

export interface DniDatos {
  dni: string;
  nombre_completo: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
}

/**
 * Consulta de DNI (apisperu). PRIVACIDAD (Ley 29733): el nombre ligado a un DNI es dato personal,
 * por eso NO se guarda en la base de datos: solo caché en Redis con TTL de 24 h y nunca va a los logs.
 */
@Injectable()
export class DniService {
  private readonly logger = new Logger(DniService.name);

  constructor(private readonly redis: RedisService) {}

  async consultarDni(dni: string, ahora: Date = new Date()): Promise<DniDatos> {
    if (typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
      throw new HttpException({ codigo: 'DNI_INVALIDO', mensaje: 'El DNI debe tener 8 dígitos' }, HttpStatus.BAD_REQUEST);
    }
    const token = tokenApisperu();
    if (!token) this.noDisponible();

    const claveCache = `dni:c:${dni}`;
    const cliente = this.redisOpcional();
    if (cliente) {
      try {
        const guardado = await cliente.get(claveCache);
        if (guardado) return JSON.parse(guardado) as DniDatos;
      } catch {
        // sin Redis se consulta directo
      }
      try {
        const claveUso = `dni:uso:${ahora.getUTCFullYear()}-${ahora.getUTCMonth() + 1}`;
        const usadas = await cliente.incr(claveUso);
        if (usadas === 1) await cliente.expire(claveUso, 35 * 86_400);
        if (usadas > topeMensualApisperu()) {
          this.logger.warn('Tope mensual de consultas DNI alcanzado');
          this.noDisponible();
        }
      } catch (e) {
        if (e instanceof HttpException) throw e; // sin Redis no se cuenta
      }
    }

    const r = await consultarApisperu('dni', dni, token, this.logger);
    if (r.estado === 'no_encontrado') {
      throw new HttpException({ codigo: 'DNI_NO_ENCONTRADO', mensaje: 'No encontramos ese DNI; escribe el nombre a mano' }, HttpStatus.NOT_FOUND);
    }
    if (r.estado === 'no_disponible') this.noDisponible();
    const j = r.json;
    const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const nombres = t(j.nombres);
    const paterno = t(j.apellidoPaterno);
    const materno = t(j.apellidoMaterno);
    if (j.dni !== dni || nombres === '' || paterno === '') {
      this.logger.warn('Consulta DNI con respuesta malformada');
      this.noDisponible();
    }
    const datos: DniDatos = {
      dni,
      nombre_completo: [nombres, paterno, materno].filter(Boolean).join(' '),
      nombres,
      apellido_paterno: paterno,
      apellido_materno: materno,
    };
    if (cliente) {
      try {
        await cliente.set(claveCache, JSON.stringify(datos), 'EX', DNI_CACHE_SEGUNDOS);
      } catch {
        // la caché es opcional
      }
    }
    return datos;
  }

  private redisOpcional() {
    try {
      return this.redis.obtenerCliente();
    } catch {
      return null;
    }
  }

  private noDisponible(): never {
    throw new HttpException(
      { codigo: 'DNI_NO_DISPONIBLE', mensaje: 'No se pudo consultar el DNI ahora; puedes escribir el nombre a mano' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
