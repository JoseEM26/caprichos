import { BadRequestException, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AvisosInternosService } from '../avisos-internos/avisos-internos.service';

export type ProveedorWhatsapp = 'META' | 'EVOLUTION';

/** Parámetros de `parametro` y su valor por defecto (conservador). Meta sigue siendo el proveedor hasta que un ADMIN cambie. */
export const DEFECTOS_EVOLUTION = {
  whatsapp_proveedor: 'META',
  evolution_limite_minuto: 3,
  evolution_limite_hora: 60,
  evolution_limite_dia: 350,
  evolution_pausa_min_seg: 2,
  evolution_pausa_max_seg: 6,
  evolution_escribiendo_ms_por_caracter: 40,
  evolution_horario_desde: 9,
  evolution_horario_hasta: 22,
  evolution_exigir_contacto_previo: 'si',
  evolution_max_enlaces: 1,
  evolution_max_texto_identico: 2,
  /** Vacío = los mismos avisos que con Meta (rigen los interruptores whatsapp_aviso_*). Con valores, solo esos orígenes. */
  evolution_origenes_permitidos: '',
  /** Pausa automática: fallos de envío seguidos (dentro de la ventana en minutos) que pausan Evolution (nunca pasa a Meta solo). */
  evolution_fallos_seguidos: 5,
  evolution_fallos_ventana_min: 10,
  evolution_pausado: 'no',
} as const;

export type ClaveEvolution = keyof typeof DEFECTOS_EVOLUTION;
export type ConfigEvolution = { [K in ClaveEvolution]: (typeof DEFECTOS_EVOLUTION)[K] extends number ? number : string };

/** Límites que el ADMIN puede editar desde la pantalla (todo menos el proveedor y la pausa, que tienen su propia acción). */
export const CLAVES_LIMITES: ClaveEvolution[] = (Object.keys(DEFECTOS_EVOLUTION) as ClaveEvolution[]).filter(
  (k) => k !== 'whatsapp_proveedor' && k !== 'evolution_pausado',
);

const CLAVE_ESTADO = 'evolution_estado';
/** Motivo de la última pausa automática (vacío si la pausa es manual o no hay). */
const CLAVE_PAUSA_AUTO = 'evolution_pausa_auto';
const CACHE_MS = 15_000;
/** Códigos de cierre de sesión que significan baneo o sesión revocada: el envío se pausa solo. */
const MOTIVOS_BANEO = [401, 403, 'banned', 'logged_out', 'loggedout'];

export interface EstadoConexionEvolution {
  estado: 'CONECTADO' | 'DESCONECTADO' | 'DESCONOCIDO';
  razon: string | null;
  actualizadoEn: string | null;
}

export interface UsuarioAccion {
  partyId?: bigint | number | string | null;
  nombre?: string | null;
}

@Injectable()
export class EvolutionConfigService implements OnModuleInit {
  private readonly logger = new Logger(EvolutionConfigService.name);
  private cache: { en: number; valores: ConfigEvolution } | null = null;
  /** Momentos de los últimos fallos de envío seguidos (en memoria; un éxito los borra). */
  private fallosSeguidos: number[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly configService?: ConfigService,
    // Se resuelve al avisar (no al construir): AvisosInternosService depende del outbox, que depende de este servicio
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  /** Calienta el cache para que el enrutador sepa el proveedor desde el primer envío. */
  onModuleInit(): void {
    void this.obtener();
  }

  /** Último proveedor leído, sin tocar la BD (META mientras no se haya leído). */
  proveedorEnCache(): ProveedorWhatsapp {
    return (this.cache?.valores.whatsapp_proveedor as ProveedorWhatsapp) ?? 'META';
  }

  /** Todos los parámetros con su defecto; un valor inválido o ausente cae al defecto. Cache corto (15 s). */
  async obtener(): Promise<ConfigEvolution> {
    if (this.cache && Date.now() - this.cache.en < CACHE_MS) return this.cache.valores;
    const claves = Object.keys(DEFECTOS_EVOLUTION);
    let filas: { clave: string; valor: unknown }[] = [];
    try {
      filas = await this.prisma.parametro.findMany({ where: { clave: { in: claves } } });
    } catch (err: any) {
      this.logger.warn(`No se pudieron leer los parámetros de Evolution: ${err?.message}`);
    }
    const porClave = new Map(filas.map((f) => [f.clave, f.valor]));
    const valores: Record<string, number | string> = {};
    for (const [clave, defecto] of Object.entries(DEFECTOS_EVOLUTION)) {
      const crudo = porClave.get(clave);
      if (typeof defecto === 'number') {
        const n = Number(crudo);
        valores[clave] = crudo !== undefined && crudo !== null && crudo !== '' && Number.isFinite(n) && n >= 0 ? n : defecto;
      } else {
        const t = typeof crudo === 'string' ? crudo.trim() : '';
        valores[clave] = t || defecto;
      }
    }
    valores.whatsapp_proveedor = String(valores.whatsapp_proveedor).toUpperCase() === 'EVOLUTION' ? 'EVOLUTION' : 'META';
    const resultado = valores as unknown as ConfigEvolution;
    this.cache = { en: Date.now(), valores: resultado };
    return resultado;
  }

  invalidar(): void {
    this.cache = null;
  }

  async proveedor(): Promise<ProveedorWhatsapp> {
    return (await this.obtener()).whatsapp_proveedor as ProveedorWhatsapp;
  }

  async estaPausado(): Promise<boolean> {
    return String((await this.obtener()).evolution_pausado).toLowerCase() === 'si';
  }

  private async guardar(clave: string, valor: unknown): Promise<void> {
    await this.prisma.parametro.upsert({ where: { clave }, update: { valor: valor as any }, create: { clave, valor: valor as any } });
    this.invalidar();
  }

  /** Cambia el proveedor activo. Solo ADMIN (lo valida el controlador); queda auditado. */
  async conmutarProveedor(destino: ProveedorWhatsapp, usuario?: UsuarioAccion): Promise<ProveedorWhatsapp> {
    if (destino !== 'META' && destino !== 'EVOLUTION') {
      throw new BadRequestException({ codigo: 'PROVEEDOR_INVALIDO', mensaje: 'El proveedor debe ser META o EVOLUTION' });
    }
    const antes = await this.proveedor();
    if (antes === destino) return antes;
    await this.guardar('whatsapp_proveedor', destino);
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'whatsapp_proveedor',
      accion: 'conmutar',
      entidad: 'parametro',
      antes: { whatsapp_proveedor: antes },
      despues: { whatsapp_proveedor: destino },
      partyId: usuario?.partyId != null ? BigInt(usuario.partyId) : undefined,
    });
    this.logger.warn(JSON.stringify({ evento: 'whatsapp_proveedor_cambiado', de: antes, a: destino }));
    return destino;
  }

  /** Actualiza límites anti-bloqueo (solo claves editables, números enteros >= 0 o textos). Auditado. */
  async actualizarLimites(cambios: Record<string, unknown>, usuario?: UsuarioAccion): Promise<ConfigEvolution> {
    const antes = await this.obtener();
    const aplicados: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(cambios)) {
      if (!CLAVES_LIMITES.includes(clave as ClaveEvolution)) continue;
      const defecto = DEFECTOS_EVOLUTION[clave as ClaveEvolution];
      if (typeof defecto === 'number') {
        const n = Number(valor);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          throw new BadRequestException({ codigo: 'LIMITE_INVALIDO', mensaje: `El valor de ${clave} debe ser un número entero, 0 o más` });
        }
        aplicados[clave] = n;
      } else {
        aplicados[clave] = String(valor ?? '').trim();
      }
    }
    for (const [clave, valor] of Object.entries(aplicados)) await this.guardar(clave, valor);
    if (Object.keys(aplicados).length) {
      await this.auditoria?.registrar({
        categoria: 'CAMBIO',
        modulo: 'whatsapp_proveedor',
        accion: 'limites',
        entidad: 'parametro',
        antes: Object.fromEntries(Object.keys(aplicados).map((k) => [k, (antes as any)[k]])),
        despues: aplicados,
        partyId: usuario?.partyId != null ? BigInt(usuario.partyId) : undefined,
      });
    }
    return this.obtener();
  }

  /** Pausa o reanuda a mano el envío por Evolution. */
  async fijarPausa(pausado: boolean, usuario?: UsuarioAccion): Promise<void> {
    await this.guardar('evolution_pausado', pausado ? 'si' : 'no');
    await this.guardar(CLAVE_PAUSA_AUTO, '');
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'whatsapp_proveedor',
      accion: pausado ? 'pausar' : 'reanudar',
      entidad: 'parametro',
      partyId: usuario?.partyId != null ? BigInt(usuario.partyId) : undefined,
    });
  }

  async estadoConexion(): Promise<EstadoConexionEvolution> {
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_ESTADO } }).catch(() => null);
    const v = (fila?.valor ?? {}) as Partial<EstadoConexionEvolution>;
    return { estado: v.estado ?? 'DESCONOCIDO', razon: v.razon ?? null, actualizadoEn: v.actualizadoEn ?? null };
  }

  /**
   * connection.update de Evolution. Al desconectarse: se guarda y, si Evolution era el proveedor activo, se pausa solo
   * (los mensajes esperan en la cola; el proveedor NO cambia) y se avisa a los ADMIN (solo en el cambio de estado).
   * Con Meta activo solo se avisa, y un cierre por baneo o sesión revocada deja Evolution pausado hasta que un ADMIN
   * lo reanude. Al volver a 'open' se reanuda solo la pausa automática por desconexión o fallos (no la manual ni el baneo).
   */
  async registrarConexion(state: string, codigoCierre?: string | number | null): Promise<void> {
    const conectado = String(state).toLowerCase() === 'open';
    if (!conectado && String(state).toLowerCase() === 'connecting') return;
    const previo = await this.estadoConexion();
    const nuevo: EstadoConexionEvolution = {
      estado: conectado ? 'CONECTADO' : 'DESCONECTADO',
      razon: conectado ? null : `Cierre ${codigoCierre ?? state}`,
      actualizadoEn: new Date().toISOString(),
    };
    await this.guardar(CLAVE_ESTADO, nuevo);
    if (conectado) {
      await this.reanudarSiPausaAutomatica();
      return;
    }
    if (previo.estado === 'DESCONECTADO') return;
    // 515 = reinicio pedido por WhatsApp (pasa al vincular): reconecta solo en segundos, no es una caída
    if (Number(codigoCierre) === 515) return;
    const baneo = codigoCierre != null && MOTIVOS_BANEO.includes(typeof codigoCierre === 'string' ? codigoCierre.toLowerCase() : codigoCierre);
    if ((await this.proveedor()) === 'EVOLUTION') {
      await this.pausarAutomatico(baneo ? 'BANEO' : 'DESCONEXION', `Cierre ${codigoCierre ?? state}`);
      return;
    }
    if (baneo) await this.guardar('evolution_pausado', 'si');
    await this.avisarAdmin(baneo);
  }

  /** Un error de envío que huele a baneo pausa el envío (lo llama el adaptador). */
  async pausarPorErrorDeEnvio(detalle: string): Promise<void> {
    if (!/ban|blocked|logged.?out|unauthori[sz]ed|forbidden/i.test(detalle)) return;
    await this.pausarAutomatico('BANEO', detalle);
  }

  /**
   * Resultado de cada envío por Evolution (lo llama el adaptador): un éxito borra la racha; N fallos seguidos dentro
   * de la ventana (evolution_fallos_seguidos en evolution_fallos_ventana_min minutos) pausan Evolution.
   * ponytail: la racha vive en memoria de este proceso; con varias réplicas de la API se cuenta por réplica.
   */
  async registrarResultadoEnvio(ok: boolean, detalle = ''): Promise<void> {
    if (ok) {
      this.fallosSeguidos = [];
      return;
    }
    const cfg = await this.obtener();
    const ahora = Date.now();
    const ventanaMs = cfg.evolution_fallos_ventana_min * 60_000;
    this.fallosSeguidos = [...this.fallosSeguidos.filter((t) => ahora - t <= ventanaMs), ahora];
    if (cfg.evolution_fallos_seguidos > 0 && this.fallosSeguidos.length >= cfg.evolution_fallos_seguidos) {
      const n = this.fallosSeguidos.length;
      this.fallosSeguidos = [];
      await this.pausarAutomatico('FALLOS', `${n} envíos fallidos seguidos en ${cfg.evolution_fallos_ventana_min} minutos. Último error: ${detalle.slice(0, 120)}`);
    }
  }

  /** Al reconectar: levanta la pausa solo si la puso el sistema (desconexión o fallos), no una manual ni un baneo. */
  private async reanudarSiPausaAutomatica(): Promise<void> {
    if (!(await this.estaPausado())) return;
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_PAUSA_AUTO } }).catch(() => null);
    if (fila?.valor !== 'DESCONEXION' && fila?.valor !== 'FALLOS') return;
    await this.guardar('evolution_pausado', 'no');
    await this.guardar(CLAVE_PAUSA_AUTO, '');
    try {
      await this.auditoria?.registrar({ categoria: 'CAMBIO', modulo: 'whatsapp_proveedor', accion: 'reanudar_automatico', entidad: 'parametro' });
    } catch (err: any) {
      this.logger.error(`No se pudo auditar la reanudación: ${err?.message}`);
    }
    this.logger.warn(JSON.stringify({ evento: 'evolution_reanudado_al_conectar' }));
  }

  /**
   * Bloqueo o caída de Evolution: solo pausa el envío (los mensajes esperan en la cola; NUNCA pasa a Meta), deja
   * constancia en la auditoría y avisa a los ADMIN (campana, y WhatsApp/correo si están activos).
   * Una sola vez: si ya estaba pausado no repite nada.
   */
  async pausarAutomatico(motivo: 'BANEO' | 'DESCONEXION' | 'FALLOS', detalle: string): Promise<void> {
    if (await this.estaPausado()) return;
    const antes = await this.proveedor();
    await this.guardar('evolution_pausado', 'si');
    await this.guardar(CLAVE_PAUSA_AUTO, motivo);
    try {
      await this.auditoria?.registrar({
        categoria: 'CAMBIO',
        modulo: 'whatsapp_proveedor',
        accion: 'pausa_automatica',
        entidad: 'parametro',
        antes: { whatsapp_proveedor: antes, evolution_pausado: 'no' },
        despues: { whatsapp_proveedor: antes, evolution_pausado: 'si', motivo, detalle: detalle.slice(0, 200) },
      });
    } catch (err: any) {
      this.logger.error(`No se pudo auditar la pausa automática de Evolution: ${err?.message}`);
    }
    this.logger.warn(JSON.stringify({ evento: 'evolution_pausa_automatica', motivo }));
    const titulo = motivo === 'BANEO' ? 'WhatsApp: posible bloqueo del número' : 'WhatsApp: el número de Evolution falló';
    const que = 'Los avisos esperan en la cola y salen cuando Evolution vuelva a conectarse o lo reanudes.';
    await this.avisarAdmin(motivo === 'BANEO', {
      titulo,
      mensaje: `Evolution se pausó solo (${detalle.slice(0, 160)}). ${que} Revisa el número en Configuración › WhatsApp.`,
    });
  }

  private async avisarAdmin(baneo: boolean, texto?: { titulo: string; mensaje: string }): Promise<void> {
    const titulo = texto?.titulo ?? 'WhatsApp: número desconectado';
    const mensaje =
      texto?.mensaje ??
      (baneo
        ? 'El número de WhatsApp (Evolution) se cerró y parece un bloqueo o sesión revocada. El envío quedó pausado. Revisa el estado en Configuración y vuelve a vincular el número.'
        : 'El número de WhatsApp (Evolution) se desconectó. Los avisos esperan hasta que vuelva. Revisa el estado en Configuración y vincula el número si hace falta.');
    try {
      let avisosInternos: AvisosInternosService | undefined;
      try {
        avisosInternos = texto ? this.moduleRef?.get(AvisosInternosService, { strict: false }) : undefined;
      } catch {
        avisosInternos = undefined; // sin el servicio (pruebas, módulo no cargado): va solo a la campana
      }
      if (texto && avisosInternos) {
        // Canal de avisos internos que ya existe: campana + los demás canales que el negocio tenga activos
        await avisosInternos.enviarAvisoAdmin(titulo, mensaje, '/admin/configuracion', undefined, `evolution-pausa:${Date.now()}`, { correo: true });
        return;
      }
      const notif = await this.prisma.notificacion.create({
        data: { tipo: 'WHATSAPP_ALERTA', rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/configuracion' },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err: any) {
      this.logger.error(`No se pudo avisar al ADMIN: ${err?.message}`);
    }
  }
}
