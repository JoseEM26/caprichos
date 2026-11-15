import { BadRequestException, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../../auditoria/auditoria.service';

export type ProveedorWhatsapp = 'META' | 'EVOLUTION';

/** Parámetros de `parametro` y su valor por defecto (conservador). Meta sigue siendo el proveedor hasta que un ADMIN cambie. */
export const DEFECTOS_EVOLUTION = {
  whatsapp_proveedor: 'META',
  evolution_limite_minuto: 3,
  evolution_limite_hora: 30,
  evolution_limite_dia: 150,
  evolution_pausa_min_seg: 2,
  evolution_pausa_max_seg: 6,
  evolution_escribiendo_ms_por_caracter: 40,
  evolution_horario_desde: 9,
  evolution_horario_hasta: 22,
  evolution_exigir_contacto_previo: 'si',
  evolution_max_enlaces: 1,
  evolution_max_texto_identico: 2,
  evolution_origenes_permitidos: 'AVISO_PEDIDO,ENCUESTA,CODIGO_CUENTA,RESERVA,AVISO_CUENTA',
  evolution_pausado: 'no',
} as const;

export type ClaveEvolution = keyof typeof DEFECTOS_EVOLUTION;
export type ConfigEvolution = { [K in ClaveEvolution]: (typeof DEFECTOS_EVOLUTION)[K] extends number ? number : string };

/** Límites que el ADMIN puede editar desde la pantalla (todo menos el proveedor y la pausa, que tienen su propia acción). */
export const CLAVES_LIMITES: ClaveEvolution[] = (Object.keys(DEFECTOS_EVOLUTION) as ClaveEvolution[]).filter(
  (k) => k !== 'whatsapp_proveedor' && k !== 'evolution_pausado',
);

const CLAVE_ESTADO = 'evolution_estado';
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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly auditoria?: AuditoriaService,
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
   * connection.update de Evolution. Al desconectarse: se guarda, se avisa a los ADMIN (solo en el cambio de estado)
   * y, si el motivo parece baneo o sesión revocada, el envío queda pausado hasta que un ADMIN lo reanude.
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
    if (conectado || previo.estado === 'DESCONECTADO') return;
    const baneo = codigoCierre != null && MOTIVOS_BANEO.includes(typeof codigoCierre === 'string' ? codigoCierre.toLowerCase() : codigoCierre);
    if (baneo) await this.guardar('evolution_pausado', 'si');
    await this.avisarAdmin(baneo);
  }

  /** Un error de envío que huele a baneo pausa el envío (lo llama el adaptador). */
  async pausarPorErrorDeEnvio(detalle: string): Promise<void> {
    if (!/ban|blocked|logged.?out|unauthori[sz]ed|forbidden/i.test(detalle)) return;
    if (await this.estaPausado()) return;
    await this.guardar('evolution_pausado', 'si');
    await this.avisarAdmin(true);
  }

  private async avisarAdmin(baneo: boolean): Promise<void> {
    try {
      const titulo = 'WhatsApp: número desconectado';
      const mensaje = baneo
        ? 'El número de WhatsApp (Evolution) se cerró y parece un bloqueo o sesión revocada. El envío quedó pausado. Revisa el estado en Configuración y vuelve a vincular el número.'
        : 'El número de WhatsApp (Evolution) se desconectó. Los avisos esperan hasta que vuelva. Revisa el estado en Configuración y vincula el número si hace falta.';
      const notif = await this.prisma.notificacion.create({
        data: { tipo: 'WHATSAPP_ALERTA', rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/configuracion' },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err: any) {
      this.logger.error(`No se pudo avisar al ADMIN de la desconexión: ${err?.message}`);
    }
  }
}
