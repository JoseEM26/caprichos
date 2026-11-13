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

  /** Sin esperar a la BD: usa el último valor leído (se refresca en cada envío). */
  estaConectado(): EstadoConexionWhatsApp {
    return (this.config.proveedorEnCache() === 'EVOLUTION' ? this.evolution : this.base).estaConectado();
  }

  async enviarTexto(t: string, texto: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarTexto(t, texto, o);
  }
  async enviarPlantilla(t: string, n: string, i: string, v?: Record<string, string> | string[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarPlantilla(t, n, i, v, o);
  }
  async enviarBotones(t: string, texto: string, b: BotonAccion[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarBotones(t, texto, b, o);
  }
  async enviarLista(t: string, texto: string, bt: string, f: FilaLista[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarLista(t, texto, bt, f, o);
  }
  async enviarCarrusel(t: string, c: CargaCarrusel, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarCarrusel(t, c, o);
  }
  async enviarImagen(t: string, u: string, c?: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarImagen(t, u, c, o);
  }
  async enviarDocumento(t: string, m: string, n: string, c?: string, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return (await this.activo()).enviarDocumento(t, m, n, c, o);
  }
  async subirMedia(a: Buffer, mime?: string, pid?: string, n?: string): Promise<string | null> {
    return (await this.activo()).subirMedia?.(a, mime, pid, n) ?? null;
  }
  async marcarLeido(id: string, pid?: string): Promise<boolean> {
    return (await this.activo()).marcarLeido(id, pid);
  }
}
