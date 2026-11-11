import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { enmascararTelefono } from '../utilidades/enmascarar.util';

export const CLAVE_NUMEROS_PROPIOS = 'whatsapp_numeros_propios';
export type MotivoOmision = 'DESTINO_NUMERO_PROPIO' | 'DESTINO_BLOQUEADO';

export const TEXTO_OMISION: Record<MotivoOmision, string> = {
  DESTINO_NUMERO_PROPIO: 'Omitido: es el número del negocio',
  DESTINO_BLOQUEADO: 'Omitido: número bloqueado',
};

/** Últimos 9 dígitos de un celular peruano (quita +51, espacios, guiones, ceros a la izquierda). '' si no hay 9 dígitos (p. ej. un BSUID). */
export function celular9(tel: unknown): string {
  const raw = String(tel ?? '').trim();
  if (/^wa-user:/i.test(raw) || raw.includes('.')) return '';
  const d = raw.replace(/\D/g, '').replace(/^0+/, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

/**
 * Identificador con el que se bloquea un destino. Celular peruano → sus 9 dígitos (con o sin +51);
 * cualquier otro número (internacional, fijo, de una plataforma) → todos sus dígitos; identificador de WhatsApp
 * (BSUID) → tal cual en minúsculas. '' si no es nada utilizable. Es el mismo criterio al bloquear y al comprobar.
 */
export function destinoBloqueo(tel: unknown): string {
  const raw = String(tel ?? '').trim();
  if (!raw) return '';
  if (/^wa-user:/i.test(raw) || raw.includes('.')) {
    const id = raw.toLowerCase().replace(/\s+/g, '');
    return /^[a-z0-9:._-]{3,40}$/.test(id) ? id : '';
  }
  const d = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 11 && d.startsWith('519')) return d.slice(2);
  return /^\d{6,20}$/.test(d) ? d : '';
}

/** Lista «987654321, +51 912 345 678» a celulares de 9 dígitos únicos (descarta lo que no sea celular). */
export function listaCelulares(valor: unknown): string[] {
  const partes = Array.isArray(valor) ? valor : String(valor ?? '').split(/[,;\n]/);
  return [...new Set(partes.map((p) => celular9(p)).filter((c) => /^9\d{8}$/.test(c)))];
}

const TTL_MS = 30_000;

type UsuarioBasico = { partyId?: any; nombre?: string; usuario?: string } | undefined;

/**
 * Números a los que el sistema NO escribe: los del propio negocio (para que los bots no se contesten entre sí)
 * y los de la lista manual de bloqueados. Sin secretos: el número del negocio sale de parámetros públicos.
 */
@Injectable()
export class NumerosWhatsappService {
  private readonly logger = new Logger(NumerosWhatsappService.name);
  private cache: { en: number; propios: Set<string>; bloqueados: Set<string> } | null = null;
  /** Números visibles que Meta informó en el webhook (metadata.display_phone_number): el número del negocio sin configurar nada. */
  private readonly aprendidos = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Anota el número visible del negocio que Meta trae en cada evento firmado. */
  aprenderNumeroVisible(display: unknown): void {
    const c = celular9(display);
    if (/^9\d{8}$/.test(c)) {
      if (!this.aprendidos.has(c)) this.cache = null;
      this.aprendidos.add(c);
    }
  }

  /** Lectura en curso: llamadas simultáneas con la caché fría comparten UNA sola lectura (antes cada una leía por su lado). */
  private leyendo: Promise<{ en: number; propios: Set<string>; bloqueados: Set<string> }> | null = null;

  private async cargar() {
    if (this.cache && Date.now() - this.cache.en < TTL_MS) return this.cache;
    if (!this.leyendo) this.leyendo = this.leerListas().finally(() => (this.leyendo = null));
    return this.leyendo;
  }

  private async leerListas() {
    const propios = new Set<string>(this.aprendidos);
    const bloqueados = new Set<string>();
    const leer = async (clave: string) => (await this.prisma.parametro.findUnique({ where: { clave } }))?.valor;
    const local = ((await leer('local_datos')) ?? {}) as { whatsapp?: unknown };
    for (const v of [await leer(CLAVE_NUMEROS_PROPIOS), local.whatsapp, await leer('verificacion_whatsapp_numero'), process.env.VERIFICACION_WHATSAPP_NUMERO]) {
      for (const c of listaCelulares(v)) propios.add(c);
    }
    // 999999999 es el relleno de «sin teléfono», no un número del negocio
    propios.delete('999999999');
    for (const b of await this.prisma.numeroBloqueado.findMany({ where: { activo: true }, select: { celular: true } })) bloqueados.add(b.celular);
    this.cache = { en: Date.now(), propios, bloqueados };
    return this.cache;
  }

  /** Un error de lectura NO frena el envío: se registra y se deja pasar (el guardia nunca rompe el flujo). */
  async motivoOmision(tel: unknown): Promise<MotivoOmision | null> {
    const c = celular9(tel);
    const d = destinoBloqueo(tel);
    if (!c && !d) return null;
    try {
      const { propios, bloqueados } = await this.cargar();
      if (c && propios.has(c)) return 'DESTINO_NUMERO_PROPIO';
      if (d && bloqueados.has(d)) return 'DESTINO_BLOQUEADO';
    } catch (e: any) {
      this.logger.warn(`No se pudo leer números propios/bloqueados: ${e?.message}`);
    }
    return null;
  }

  async esPropio(tel: unknown): Promise<boolean> {
    return (await this.motivoOmision(tel)) === 'DESTINO_NUMERO_PROPIO';
  }

  async estaBloqueado(tel: unknown): Promise<boolean> {
    return (await this.motivoOmision(tel)) === 'DESTINO_BLOQUEADO';
  }

  /** Lista efectiva de números propios (para mostrarla en Configuración). */
  async listarPropios(): Promise<string[]> {
    this.cache = null;
    return [...(await this.cargar()).propios].sort();
  }

  logOmitido(motivo: MotivoOmision, tel: string, origen: string): void {
    this.logger.warn(JSON.stringify({ evento: 'whatsapp_omitido', motivo, destino: enmascararTelefono(tel), origen }));
  }

  // --- Lista manual de bloqueados ---

  async listar() {
    const filas = await this.prisma.numeroBloqueado.findMany({ where: { activo: true }, orderBy: { bloqueado_en: 'desc' } });
    return filas.map((f) => ({
      id: f.id.toString(),
      celular: f.celular,
      motivo: f.motivo,
      bloqueadoPor: f.bloqueado_por,
      bloqueadoEn: f.bloqueado_en.toISOString(),
    }));
  }

  async bloquear(numero: unknown, motivo: unknown, usuario: UsuarioBasico, ip?: string) {
    const c = destinoBloqueo(numero);
    if (!c) {
      throw new BadRequestException({ codigo: 'NUMERO_INVALIDO', mensaje: 'Escribe un número válido (con código de país si no es peruano)' });
    }
    const motivoTexto = typeof motivo === 'string' ? motivo.trim() : '';
    if (motivoTexto.length > 120) {
      throw new BadRequestException({ codigo: 'MOTIVO_LARGO', mensaje: 'El motivo admite hasta 120 caracteres' });
    }
    this.cache = null;
    if (/^9\d{8}$/.test(c) && (await this.esPropio(c))) {
      throw new BadRequestException({ codigo: 'NUMERO_PROPIO', mensaje: 'Ese número es del propio negocio: no se le envía nada' });
    }
    const quien = (usuario?.nombre || usuario?.usuario || '').slice(0, 120) || null;
    const previo = await this.prisma.numeroBloqueado.findUnique({ where: { celular: c } });
    if (previo?.activo) throw new ConflictException({ codigo: 'YA_BLOQUEADO', mensaje: 'Ese número ya está bloqueado' });
    const fila = previo
      ? await this.prisma.numeroBloqueado.update({
          where: { celular: c },
          data: { activo: true, motivo: motivoTexto || null, bloqueado_por: quien, bloqueado_en: new Date() },
        })
      : await this.prisma.numeroBloqueado.create({ data: { celular: c, motivo: motivoTexto || null, bloqueado_por: quien } });
    this.cache = null;
    this.logger.log(JSON.stringify({ evento: 'numero_bloqueado', destino: enmascararTelefono(c) }));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mensajes',
      accion: 'NUMERO_BLOQUEADO',
      resultado: 'OK',
      entidad: 'numero_bloqueado',
      entidadId: fila.id,
      partyId: usuario?.partyId,
      ip,
      despues: { celular: c, motivo: motivoTexto || null },
    });
    return { ok: true, id: fila.id.toString(), celular: c };
  }

  async desbloquear(numero: unknown, usuario: UsuarioBasico, ip?: string) {
    const c = destinoBloqueo(numero);
    const fila = c ? await this.prisma.numeroBloqueado.findUnique({ where: { celular: c } }) : null;
    if (!fila || !fila.activo) throw new NotFoundException({ codigo: 'NO_BLOQUEADO', mensaje: 'Ese número no está bloqueado' });
    await this.prisma.numeroBloqueado.update({ where: { celular: c }, data: { activo: false } });
    this.cache = null;
    this.logger.log(JSON.stringify({ evento: 'numero_desbloqueado', destino: enmascararTelefono(c) }));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mensajes',
      accion: 'NUMERO_DESBLOQUEADO',
      resultado: 'OK',
      entidad: 'numero_bloqueado',
      entidadId: fila.id,
      partyId: usuario?.partyId,
      ip,
      antes: { celular: c, motivo: fila.motivo },
    });
    return { ok: true };
  }
}
