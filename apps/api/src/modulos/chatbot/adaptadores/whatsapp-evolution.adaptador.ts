import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { enmascararTelefono as mascara, hashTelefono } from '../utilidades/enmascarar.util';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { textoDePlantilla } from '../catalogo/texto-plantilla';
import { destinoEvolution, paresLidCelular } from '../evolution/evolution-mensaje.util';
import { aTextoNumerado, completarEscalaEncuesta } from '../evolution/menu-numerado.util';
import { MenuNumeradoStore } from '../evolution/menu-numerado.store';
import { escribiendoMs, limitarEnlaces, pausaAleatoriaMs, variarSaludo } from '../evolution/anti-bloqueo.util';
import { EvolutionApiCliente } from '../evolution/evolution-api.cliente';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { ContadorSalientesService } from '../evolution/contador-salientes.service';
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
import type { ResultadoConfirmacionLid } from '../../clientes/verificacion-whatsapp.util';
import { aplanarEnlacesMarkdown, textoSinBotonPedirEste } from '../utilidades/texto-whatsapp.util';

const PREFIJO_MEDIA = 'evo:';
/** Consultas de LID (verificación sin número): corta, el cliente espera la respuesta. */
const TIMEOUT_LID_MS = 5000;
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
  /** Último mensaje del cliente al que se respondió: la pausa humana se aplica una vez por respuesta, no por cada mensaje de ella. */
  private ultimaRespondida: string | undefined;
  private identicos = new Map<string, { n: number; desde: number }>();
  private medias = new Map<string, { buffer: Buffer; mime: string; nombre?: string; vence: number }>();

  constructor(
    private readonly api: EvolutionApiCliente,
    private readonly config: EvolutionConfigService,
    private readonly menus: MenuNumeradoStore,
    private readonly prisma: PrismaService,
    @Optional() private readonly contador?: ContadorSalientesService,
  ) {}

  estaConectado(): EstadoConexionWhatsApp {
    return this.api.configurado()
      ? { conectado: true, modo: 'evolution' }
      : { conectado: false, modo: 'simulado', razon: 'Evolution sin configurar (modo simulado, no se envía nada)' };
  }

  private numero = (telefono: string) => destinoEvolution(telefono);

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

  /**
   * Respuesta a un mensaje del cliente (lleva replyToWaMessageId; los avisos de pedidos no): «escribiendo…» y espera aleatoria
   * antes del primer envío de la respuesta. Corre dentro del turno de la fila, así que no reordena ni frena al webhook.
   */
  private async pausaHumana(tel: string, o: OpcionesEnvio | undefined, minSeg: number, maxSeg: number): Promise<void> {
    const id = o?.replyToWaMessageId;
    if (!id || id === this.ultimaRespondida || maxSeg <= 0) return;
    this.ultimaRespondida = id;
    const ms = pausaAleatoriaMs(minSeg, maxSeg);
    // Presencia «escribiendo…» (Evolution v2: /chat/sendPresence); si falla, igual se espera
    await this.api
      .llamar('POST', `/chat/sendPresence/${encodeURIComponent(this.api.instancia)}`, { number: this.numero(tel), presence: 'composing', delay: ms }, 3000)
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, ms));
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

  private async post(ruta: string, cuerpo: Record<string, unknown>, tel: string, resumen: string, esperaTipeo = 0, opciones?: OpcionesEnvio, tipo = 'TEXTO'): Promise<ResultadoEnvioWhatsApp> {
    if (!this.api.configurado()) {
      this.logger.log(`[EVOLUTION SIMULADO] ${resumen} a ${enmascararTelefono(tel)}`);
      return { exito: true, estado: 'SIMULADO', waMessageId: `wamid.simulado.evo.${randomUUID()}` };
    }
    if (await this.config.estaPausado()) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_PAUSADO', errorDetalle: 'El envío por Evolution está en pausa (desconexión o bloqueo)' };
    }
    const cfg = await this.config.obtener();
    const r = await this.turno(
      async () => {
        await this.pausaHumana(tel, opciones, cfg.evolution_humana_min_seg, cfg.evolution_humana_max_seg);
        return this.api.llamar('POST', `${ruta}/${encodeURIComponent(this.api.instancia)}`, { number: this.numero(tel), ...(esperaTipeo ? { delay: esperaTipeo } : {}), ...cuerpo });
      },
      cfg.evolution_pausa_min_seg,
      cfg.evolution_pausa_max_seg,
    );
    if (r.ok) {
      const waMessageId: string | undefined = r.data?.key?.id ?? r.data?.id ?? undefined;
      await this.config.registrarResultadoEnvio(true).catch(() => undefined);
      await this.registrar(tel, tipo, waMessageId, opciones);
      void this.contador?.vigilar(hashTelefono(tel), mascara(tel));
      return { exito: true, estado: 'ENVIADO', waMessageId };
    }
    // Cuentan para la pausa automática la red caída, los 5xx y 401/403; un 400/404 (p. ej. número sin WhatsApp) es del destinatario
    if (r.red || r.status >= 500 || r.status === 401 || r.status === 403) {
      await this.config.registrarResultadoEnvio(false, r.red ? 'Evolution no respondió' : `HTTP ${r.status}`).catch(() => undefined);
    }
    if (r.red) return { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_NO_DISPONIBLE', errorDetalle: 'Evolution no respondió' };
    return this.fallo('ERROR_EVOLUTION', `HTTP ${r.status}: ${JSON.stringify(r.data?.response?.message ?? r.data?.message ?? r.data ?? '')}`);
  }

  /**
   * Deja el envío en whatsapp_mensaje para que el contador de consumo de WhatsApp lo cuente (no hay campo de proveedor:
   * cuenta igual que los de Meta). Un fallo al registrar no afecta al envío.
   */
  private async registrar(tel: string, tipo: string, waMessageId: string | undefined, o?: OpcionesEnvio): Promise<void> {
    try {
      await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId ?? null,
          telefono_enmascarado: mascara(tel),
          telefono_hash: hashTelefono(tel),
          tipo,
          estado: 'ENVIADO',
          pedido_id: o?.pedidoId ? BigInt(o.pedidoId) : null,
          conversacion_id: o?.conversacionId ? BigInt(o.conversacionId) : null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo registrar el envío para el consumo: ${err?.message}`);
    }
  }

  async enviarTexto(telefono: string, texto: string, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const cfg = await this.config.obtener();
    const final = this.variar(limitarEnlaces(aplanarEnlacesMarkdown(texto), cfg.evolution_max_enlaces), cfg.evolution_max_texto_identico);
    await this.menus.borrar(telefono);
    return this.post('/message/sendText', { text: final }, telefono, `texto (${final.length} caracteres)`, escribiendoMs(final, cfg.evolution_escribiendo_ms_por_caracter), opciones);
  }

  private async enviarMenu(telefono: string, texto: string, items: Array<BotonAccion | FilaLista>, tipo: 'boton' | 'lista', opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const cfg = await this.config.obtener();
    const { texto: cuerpo, menu } = aTextoNumerado(aplanarEnlacesMarkdown(texto), completarEscalaEncuesta(items), tipo);
    const final = limitarEnlaces(cuerpo, cfg.evolution_max_enlaces);
    // Se guarda antes de enviar: el cliente puede contestar muy rápido
    await this.menus.guardar(telefono, menu);
    const r = await this.post('/message/sendText', { text: final }, telefono, `menú numerado de ${items.length} opciones`, escribiendoMs(final, cfg.evolution_escribiendo_ms_por_caracter), opciones, 'BOTON');
    if (!r.exito) await this.menus.borrar(telefono);
    return r;
  }

  enviarBotones(telefono: string, texto: string, botones: BotonAccion[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.enviarMenu(telefono, texto, botones, 'boton', o);
  }

  enviarLista(telefono: string, texto: string, _botonTexto: string, filas: FilaLista[], o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    return this.enviarMenu(telefono, texto, filas, 'lista', o);
  }

  /**
   * Carrusel: sin imágenes ni botones por tarjeta. Sale una lista numerada con los productos (nombre y precio) y, al final,
   * las opciones de salida del respaldo («Volver al menú»); elegir un número equivale a «Pedir este». El texto no manda a tocar botones.
   */
  enviarCarrusel(telefono: string, carga: CargaCarrusel, o?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const rp = carga.respaldo;
    const filas: FilaLista[] = rp?.filas?.length
      ? rp.filas.slice(0, 10)
      : carga.tarjetas.slice(0, 10).map((t) => ({ id: t.boton.id, titulo: t.nombre, descripcion: t.cuerpo.split('\n')[1] ?? '' }));
    const salidas = rp?.botones?.length ? rp.botones : carga.botonComun ? [carga.botonComun] : [];
    // respaldo: el chat la registra como la lista que es (no como «Carrusel: …») y no se manda el «Ver más» aparte
    return this.enviarMenu(telefono, textoSinBotonPedirEste(rp?.texto ?? carga.cuerpo), [...filas, ...salidas], 'lista', o).then((r) => ({ ...r, respaldo: true }));
  }

  /** Plantilla = su texto libre equivalente del catálogo, con las variables puestas. */
  async enviarPlantilla(telefono: string, nombre: string, _idioma: string, variables?: Record<string, string> | string[], opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const def = Object.values(CATALOGO_PLANTILLAS).find((d) => d.nombre === nombre);
    if (!def) return { exito: false, estado: 'FALLIDO', errorCodigo: 'PLANTILLA_NO_CONFIGURADA', errorDetalle: `Plantilla desconocida '${nombre}'` };
    const texto = textoDePlantilla(def.nombre, variables) ?? '';
    if (def.botones?.length && opciones?.botonesRespuesta?.length) {
      return this.enviarBotones(telefono, texto, opciones.botonesRespuesta.map((id, i) => ({ id, titulo: def.botones![i] ?? id })), opciones);
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

  async enviarImagen(telefono: string, urlOArchivo: string, caption?: string, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const c = this.contenidoMedia(urlOArchivo);
    if (!c && this.api.configurado()) return { exito: false, estado: 'FALLIDO', errorCodigo: 'MEDIA_NO_DISPONIBLE', errorDetalle: 'La imagen ya no está disponible para enviar' };
    return this.post('/message/sendMedia', { mediatype: 'image', mimetype: c?.mime ?? 'image/jpeg', media: c?.media ?? urlOArchivo, caption: caption ?? '', fileName: 'imagen.jpg' }, telefono, 'imagen', 0, opciones, 'IMAGEN');
  }

  async enviarDocumento(telefono: string, mediaId: string, nombreArchivo: string, caption?: string, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const c = this.contenidoMedia(mediaId);
    if (!c && this.api.configurado()) return { exito: false, estado: 'FALLIDO', errorCodigo: 'MEDIA_NO_DISPONIBLE', errorDetalle: 'El documento ya no está disponible para enviar' };
    return this.post('/message/sendMedia', { mediatype: 'document', mimetype: c?.mime ?? 'application/pdf', media: c?.media ?? mediaId, caption: caption ?? '', fileName: nombreArchivo }, telefono, 'documento', 0, opciones, 'DOCUMENTO');
  }

  /** Reacción a un mensaje del cliente (Evolution v2: POST /message/sendReaction/{instancia}); no pasa por la fila de anti-bloqueo de textos. */
  async reaccionar(telefono: string, waMessageId: string, emoji: string): Promise<ResultadoEnvioWhatsApp> {
    if (!this.api.configurado()) {
      this.logger.log(`[EVOLUTION SIMULADO] reacción ${emoji} a ${enmascararTelefono(telefono)}`);
      return { exito: true, estado: 'SIMULADO' };
    }
    if (await this.config.estaPausado()) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_PAUSADO', errorDetalle: 'El envío por Evolution está en pausa' };
    }
    const r = await this.api.llamar('POST', `/message/sendReaction/${encodeURIComponent(this.api.instancia)}`, {
      key: { remoteJid: this.numero(telefono).includes('@') ? this.numero(telefono) : `${this.numero(telefono)}@s.whatsapp.net`, fromMe: false, id: waMessageId },
      reaction: emoji,
    });
    if (r.ok) return { exito: true, estado: 'ENVIADO', waMessageId: r.data?.key?.id };
    return { exito: false, estado: 'FALLIDO', errorCodigo: r.red ? 'EVOLUTION_NO_DISPONIBLE' : 'ERROR_EVOLUTION', errorDetalle: r.red ? 'Evolution no respondió' : `HTTP ${r.status}` };
  }

  /** Evolution marca como leído por su cuenta al recibir; no se pide nada más. */
  async marcarLeido(): Promise<boolean> {
    return true;
  }

  /**
   * Celular (dígitos) que Evolution asocia a un LID, o null si no lo sabe. Para verificar un mensaje sin número visible.
   * HIPÓTESIS, no verificada contra la API real (la documentación v2 no fue accesible): POST /chat/findContacts/{instancia}
   * con body { where: { id: "<lid>@lid" } }; del array de contactos se toma el par LID↔celular que traiga cada uno
   * (paresLidCelular: un campo «<dígitos>@lid» junto a otro «<dígitos>@s.whatsapp.net», p. ej. remoteJid, remoteJidAlt, senderPn).
   * Si el formato no coincide, devuelve null y la verificación pasa al código de 6 dígitos (no se verifica por eso).
   * Timeout corto; nunca lanza.
   */
  async resolverLid(lid: string): Promise<string | null> {
    if (!this.api.configurado()) return null;
    const dl = String(lid ?? '').replace(/\D/g, '');
    if (!dl) return null;
    const r = await this.api.llamar('POST', `/chat/findContacts/${encodeURIComponent(this.api.instancia)}`, { where: { id: `${dl}@lid` } }, TIMEOUT_LID_MS);
    if (!r.ok || !Array.isArray(r.data)) return null;
    for (const item of r.data) {
      const par = paresLidCelular(item).find((x) => x.lid === dl);
      if (par) return par.celular;
    }
    return null;
  }

  /**
   * Prueba de propiedad: ¿Evolution confirma que ese número tiene ese LID?
   * Documentado (v2): POST /chat/whatsappNumbers/{instancia} con body { numbers: ["51…"] }, respuesta [{ exists, jid, number }].
   * HIPÓTESIS: que la respuesta traiga el LID del número en algún campo «<dígitos>@lid» (lid o jid). Si hay LID y coincide →
   * CONFIRMADO; si hay LID y es otro → OTRO; si no hay ningún LID en la respuesta, error o timeout → NO_RESUELTO (nunca se
   * verifica por esto: el llamador pasa al código de 6 dígitos).
   */
  async confirmarLid(numero: string, lid: string): Promise<ResultadoConfirmacionLid> {
    if (!this.api.configurado()) return 'NO_RESUELTO';
    const dl = String(lid ?? '').replace(/\D/g, '');
    const dn = String(numero ?? '').replace(/\D/g, '');
    if (!dl || !dn) return 'NO_RESUELTO';
    const r = await this.api.llamar('POST', `/chat/whatsappNumbers/${encodeURIComponent(this.api.instancia)}`, { numbers: [dn] }, TIMEOUT_LID_MS);
    if (!r.ok || !Array.isArray(r.data)) return 'NO_RESUELTO';
    const lids = r.data.flatMap((it: any) =>
      Object.values(it ?? {})
        .filter((v): v is string => typeof v === 'string' && /@lid$/i.test(v))
        .map((v) => v.replace(/\D/g, '')),
    );
    if (lids.includes(dl)) return 'CONFIRMADO';
    return lids.length ? 'OTRO' : 'NO_RESUELTO';
  }
}
