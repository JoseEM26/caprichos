import { Injectable } from '@nestjs/common';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import type {
  BotonAccion,
  EstadoConexionWhatsApp,
  FilaLista,
  OpcionesEnvio,
  ResultadoEnvioWhatsApp,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import type { CargaCarrusel } from '../servicios/carrusel.util';
import { WhatsAppEvolutionAdaptador } from './whatsapp-evolution.adaptador';

/**
 * Elige el proveedor en cada envío según el parámetro whatsapp_proveedor (META por defecto), sin redesplegar.
 * `base` es el adaptador de Meta, o el simulado si faltan sus credenciales (lo decide el provider).
 */
@Injectable()
export class WhatsAppEnrutadorAdaptador implements WhatsAppMensajeriaPuerto {
  constructor(
    private readonly base: WhatsAppMensajeriaPuerto,
    private readonly evolution: WhatsAppEvolutionAdaptador,
    private readonly config: EvolutionConfigService,
  ) {}

  private async activo(): Promise<WhatsAppMensajeriaPuerto> {
    return (await this.config.proveedor()) === 'EVOLUTION' ? this.evolution : this.base;
  }

  /**
   * Con EVOLUTION nunca se llama a Meta, salvo que un ADMIN encienda `evolution_meta_respaldo` (apagado por defecto): entonces
   * Meta solo recoge lo que Evolution no pudo entregar por estar caído o en pausa. Con META todo va por Meta como siempre.
   */
  private async conRespaldo(enviar: (p: WhatsAppMensajeriaPuerto) => Promise<ResultadoEnvioWhatsApp>): Promise<ResultadoEnvioWhatsApp> {
    if ((await this.config.proveedor()) !== 'EVOLUTION') return enviar(this.base);
    const r = await enviar(this.evolution);
    const caido = !r.exito && (r.errorCodigo === 'EVOLUTION_NO_DISPONIBLE' || r.errorCodigo === 'EVOLUTION_PAUSADO');
    if (!caido) return r;
    const cfg = await this.config.obtener();
    return String(cfg.evolution_meta_respaldo).toLowerCase() === 'si' ? enviar(this.base) : r;
  }

  /** Sin esperar a la BD: usa el último valor leído (se refresca en cada envío). */
  estaConectado(): EstadoConexionWhatsApp {
    return (this.config.proveedorEnCache() === 'EVOLUTION' ? this.evolution : this.base).estaConectado();
  }

  async enviarTexto(t: string, texto: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarTexto(t, texto, o));
  }
  async enviarPlantilla(t: string, n: string, i: string, v?: Record<string, string> | string[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarPlantilla(t, n, i, v, o));
  }
  async enviarBotones(t: string, texto: string, b: BotonAccion[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarBotones(t, texto, b, o));
  }
  async enviarLista(t: string, texto: string, bt: string, f: FilaLista[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarLista(t, texto, bt, f, o));
  }
  async enviarCarrusel(t: string, c: CargaCarrusel, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarCarrusel(t, c, o));
  }
  async enviarImagen(t: string, u: string, c?: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarImagen(t, u, c, o));
  }
  async enviarDocumento(t: string, m: string, n: string, c?: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.conRespaldo((p) => p.enviarDocumento(t, m, n, c, o));
  }
  async subirMedia(a: Buffer, mime?: string, pid?: string, n?: string): Promise<string | null> {
    return (await this.activo()).subirMedia?.(a, mime, pid, n) ?? null;
  }
  async reaccionar(t: string, id: string, emoji: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const p = await this.activo();
    return p.reaccionar ? p.reaccionar(t, id, emoji, o) : { exito: false, estado: 'OMITIDO', errorCodigo: 'REACCION_NO_SOPORTADA', errorDetalle: 'El proveedor no admite reacciones' };
  }
  async marcarLeido(id: string, pid?: string): Promise<boolean> {
    return (await this.activo()).marcarLeido(id, pid);
  }
}
