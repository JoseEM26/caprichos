import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { aTextoNumerado } from '../evolution/menu-numerado.util';
import { MenuNumeradoStore } from '../evolution/menu-numerado.store';
import { escribiendoMs, limitarEnlaces, pausaAleatoriaMs, variarSaludo } from '../evolution/anti-bloqueo.util';
import { EvolutionApiCliente } from '../evolution/evolution-api.cliente';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import {
  BotonAccion,
  EstadoConexionWhatsApp,
  FilaLista,
  OpcionesEnvio,
  ResultadoEnvioWhatsApp,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import type { CargaCarrusel } from '../servicios/carrusel.util';
import { enmascararTelefono } from '../utilidades/enmascarar.util';

const PREFIJO_MEDIA = 'evo:';
const MEDIA_TTL_MS = 15 * 60_000;
const VENTANA_IDENTICOS_MS = 60 * 60_000;

/**
 * Adaptador de Evolution API (WhatsApp no oficial, vía Baileys). Mismo puerto que Meta, con estas diferencias:
 *  - Botones, listas y carruseles salen como TEXTO NUMERADO («Responde 1, 2 o 3»); la respuesta se mapea en el webhook.
 *  - Las plantillas salen como su texto libre equivalente (no hay plantillas ni ventana de 24 h).
 *  - Anti-bloqueo: envíos en fila con pausa aleatoria, «escribiendo…» proporcional al texto, tope de enlaces y saludo variado.
 *  - Sin EVOLUTION_API_URL/KEY/instancia: modo simulado (solo log y éxito simulado), nada sale a la red.
 */
@Injectable()
export class WhatsAppEvolutionAdaptador implements WhatsAppMensajeriaPuerto {
  private readonly logger = new Logger(WhatsAppEvolutionAdaptador.name);
  private cola: Promise<unknown> = Promise.resolve();
  private ultimoEnvio = 0;
  private identicos = new Map<string, { n: number; desde: number }>();
  private medias = new Map<string, { buffer: Buffer; mime: string; nombre?: string; vence: number }>();

  constructor(
    private readonly api: EvolutionApiCliente,
    private readonly config: EvolutionConfigService,
    private readonly menus: MenuNumeradoStore,
  ) {}

  estaConectado(): EstadoConexionWhatsApp {
    return this.api.configurado()
      ? { conectado: true, modo: 'evolution' }
      : { conectado: false, modo: 'simulado', razon: 'Evolution sin configurar (modo simulado, no se envía nada)' };
  }

  private numero = (telefono: string) => telefono.replace(/\D/g, '');

  /** Un envío a la vez, separados por una pausa aleatoria. */
  private turno<T>(fn: () => Promise<T>, minSeg: number, maxSeg: number): Promise<T> {
    const corrida = this.cola.then(async () => {
      const espera = this.ultimoEnvio + pausaAleatoriaMs(minSeg, maxSeg) - Date.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      try {
        return await fn();
      } finally {
        this.ultimoEnvio = Date.now();
      }
    });
    this.cola = corrida.catch(() => undefined);
    return corrida;
  }

  /** Mismo texto idéntico repetido en la última hora: se varía el saludo. */
  private variar(texto: string, maxIdentico: number): string {
    const ahora = Date.now();
    const k = createHash('sha1').update(texto).digest('hex');
    const previo = this.identicos.get(k);
    const entrada = previo && ahora - previo.desde < VENTANA_IDENTICOS_MS ? previo : { n: 0, desde: ahora };
    entrada.n++;
    this.identicos.set(k, entrada);
    if (this.identicos.size > 500) for (const [c, v] of this.identicos) if (ahora - v.desde > VENTANA_IDENTICOS_MS) this.identicos.delete(c);
    return entrada.n > maxIdentico ? variarSaludo(texto, entrada.n) : texto;
  }

  private async fallo(codigo: string, detalle: string): Promise<ResultadoEnvioWhatsApp> {
    await this.config.pausarPorErrorDeEnvio(detalle).catch(() => undefined);
    return { exito: false, estado: 'FALLIDO', errorCodigo: codigo, errorDetalle: detalle.slice(0, 300) };
  }

  private async post(ruta: string, cuerpo: Record<string, unknown>, tel: string, resumen: string, esperaTipeo = 0): Promise<ResultadoEnvioWhatsApp> {
    if (!this.api.configurado()) {
      this.logger.log(`[EVOLUTION SIMULADO] ${resumen} a ${enmascararTelefono(tel)}`);
      return { exito: true, estado: 'SIMULADO', waMessageId: `wamid.simulado.evo.${randomUUID()}` };
    }
    if (await this.config.estaPausado()) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_PAUSADO', errorDetalle: 'El envío por Evolution está en pausa (desconexión o bloqueo)' };
    }
    const cfg = await this.config.obtener();
    const r = await this.turno(
      () => this.api.llamar('POST', `${ruta}/${encodeURIComponent(this.api.instancia)}`, { number: this.numero(tel), ...(esperaTipeo ? { delay: esperaTipeo } : {}), ...cuerpo }),
      cfg.evolution_pausa_min_seg,
      cfg.evolution_pausa_max_seg,
    );
    if (r.ok) return { exito: true, estado: 'ENVIADO', waMessageId: r.data?.key?.id ?? r.data?.id ?? undefined };
    if (r.red) return { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_NO_DISPONIBLE', errorDetalle: 'Evolution no respondió' };
    return this.fallo('ERROR_EVOLUTION', `HTTP ${r.status}: ${JSON.stringify(r.data?.response?.message ?? r.data?.message ?? r.data ?? '')}`);
  }

  async enviarTexto(telefono: string, texto: string, _opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const cfg = await this.config.obtener();
    const final = this.variar(limitarEnlaces(texto, cfg.evolution_max_enlaces), cfg.evolution_max_texto_identico);
    await this.menus.borrar(telefono);
    return this.post('/message/sendText', { text: final }, telefono, `texto (${final.length} caracteres)`, escribiendoMs(final, cfg.evolution_escribiendo_ms_por_caracter));
  }

  private async enviarMenu(telefono: string, texto: string, items: Array<BotonAccion | FilaLista>, tipo: 'boton' | 'lista'): Promise<ResultadoEnvioWhatsApp> {
    const cfg = await this.config.obtener();
    const { texto: cuerpo, menu } = aTextoNumerado(texto, items, tipo);
    const final = limitarEnlaces(cuerpo, cfg.evolution_max_enlaces);
    // Se guarda antes de enviar: el cliente puede contestar muy rápido
    await this.menus.guardar(telefono, menu);
    const r = await this.post('/message/sendText', { text: final }, telefono, `menú numerado de ${items.length} opciones`, escribiendoMs(final, cfg.evolution_escribiendo_ms_por_caracter));
    if (!r.exito) await this.menus.borrar(telefono);
    return r;
  }

  enviarBotones(telefono: string, texto: string, botones: BotonAccion[]): Promise<ResultadoEnvioWhatsApp> {
    return this.enviarMenu(telefono, texto, botones, 'boton');
  }

  enviarLista(telefono: string, texto: string, _botonTexto: string, filas: FilaLista[]): Promise<ResultadoEnvioWhatsApp> {
    return this.enviarMenu(telefono, texto, filas, 'lista');
  }

  /** Carrusel: sin imágenes por tarjeta; sale la lista de respaldo si la hay, o una lista con los nombres de las tarjetas. */
  enviarCarrusel(telefono: string, carga: CargaCarrusel): Promise<ResultadoEnvioWhatsApp> {
    const rp = carga.respaldo;
    if (rp?.filas?.length) return this.enviarMenu(telefono, rp.texto, rp.filas.slice(0, 10), 'lista');
    if (rp?.botones?.length) return this.enviarMenu(telefono, rp.texto, rp.botones.slice(0, 3), 'boton');
    return this.enviarMenu(telefono, carga.cuerpo, carga.tarjetas.map((t) => ({ id: t.boton.id, titulo: t.nombre })), 'lista');
  }

  /** Plantilla = su texto libre equivalente del catálogo, con las variables puestas. */
  async enviarPlantilla(telefono: string, nombre: string, _idioma: string, variables?: Record<string, string> | string[], opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const def = Object.values(CATALOGO_PLANTILLAS).find((d) => d.nombre === nombre);
    if (!def) return { exito: false, estado: 'FALLIDO', errorCodigo: 'PLANTILLA_NO_CONFIGURADA', errorDetalle: `Plantilla desconocida '${nombre}'` };
    const valores = Array.isArray(variables) ? variables : Object.values(variables ?? {});
    const texto = def.texto.replace(/\{\{(\d+)\}\}/g, (_m, i) => String(valores[Number(i) - 1] ?? ''));
    if (def.botones?.length && opciones?.botonesRespuesta?.length) {
      return this.enviarBotones(telefono, texto, opciones.botonesRespuesta.map((id, i) => ({ id, titulo: def.botones![i] ?? id })));
    }
    return this.enviarTexto(telefono, texto, opciones);
  }

  /** Guarda el archivo en memoria 15 min y devuelve un id propio («evo:...») que enviarDocumento e enviarImagen entienden. */
  async subirMedia(archivo: Buffer, mime = 'application/octet-stream', _phoneNumberId?: string, nombreArchivo?: string): Promise<string | null> {
    const id = `${PREFIJO_MEDIA}${randomUUID()}`;
    const ahora = Date.now();
    for (const [k, v] of this.medias) if (v.vence < ahora) this.medias.delete(k);
    this.medias.set(id, { buffer: archivo, mime, nombre: nombreArchivo, vence: ahora + MEDIA_TTL_MS });
    return id;
  }

  private contenidoMedia(referencia: string): { media: string; mime?: string; nombre?: string } | null {
    if (referencia.startsWith(PREFIJO_MEDIA)) {
      const m = this.medias.get(referencia);
      return m && m.vence > Date.now() ? { media: m.buffer.toString('base64'), mime: m.mime, nombre: m.nombre } : null;
    }
    return /^https?:\/\//i.test(referencia) ? { media: referencia } : null;
  }

  async enviarImagen(telefono: string, urlOArchivo: string, caption?: string): Promise<ResultadoEnvioWhatsApp> {
    const c = this.contenidoMedia(urlOArchivo);
    if (!c && this.api.configurado()) return { exito: false, estado: 'FALLIDO', errorCodigo: 'MEDIA_NO_DISPONIBLE', errorDetalle: 'La imagen ya no está disponible para enviar' };
    return this.post('/message/sendMedia', { mediatype: 'image', mimetype: c?.mime ?? 'image/jpeg', media: c?.media ?? urlOArchivo, caption: caption ?? '', fileName: 'imagen.jpg' }, telefono, 'imagen');
  }

  async enviarDocumento(telefono: string, mediaId: string, nombreArchivo: string, caption?: string): Promise<ResultadoEnvioWhatsApp> {
    const c = this.contenidoMedia(mediaId);
    if (!c && this.api.configurado()) return { exito: false, estado: 'FALLIDO', errorCodigo: 'MEDIA_NO_DISPONIBLE', errorDetalle: 'El documento ya no está disponible para enviar' };
    return this.post('/message/sendMedia', { mediatype: 'document', mimetype: c?.mime ?? 'application/pdf', media: c?.media ?? mediaId, caption: caption ?? '', fileName: nombreArchivo }, telefono, 'documento');
  }

  /** Evolution marca como leído por su cuenta al recibir; no se pide nada más. */
  async marcarLeido(): Promise<boolean> {
    return true;
  }
}
