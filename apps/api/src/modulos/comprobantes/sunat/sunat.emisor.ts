import { ArchivoEmision, ComprobanteEmision, EmisorElectronico, ErrorCredencialesEmisor, ErrorRedEmisor, ResultadoBaja, ResultadoEmision } from '../emisor/emisor.tipos';
import { ComprobanteInvalidoError } from '../facturacion/facturacion.datos';
import { esCodigoAutenticacion } from '../comprobantes-politica';
import { ConfigSunat, RUC_PRUEBA_BETA, configSunat } from './sunat.config';
import { EmisorXml, armarBajaXml, armarFacturaXml, validarEmisorXml } from './sunat.xml';
import { CertificadoFirma, digestDeFirma, firmarXml, leerCertificadoP12 } from './sunat.firma';
import { Cdr, FetchSoap, codigoFault, cuerpoEnvio, enviarSoap, esFaultCliente, estadoCdr, leerCdr, parsearSoap, sobreSoap, textoCdr } from './sunat.soap';
import { fechaIsoLima, montoXml, yyyymmddLima, zipUnico } from './sunat.util';

export interface OpcionesSunatEmisor {
  env?: NodeJS.ProcessEnv;
  /** Datos del local (razón, RUC, domicilio, ubigeo). Se leen en cada emisión: nunca fijos. */
  emisorLocal: () => Promise<Record<string, unknown>>;
  /** Siguiente correlativo de una clave (secuencia_comprobante). Para RA y RC. */
  correlativo: (clave: string) => Promise<number>;
  fetchFn?: FetchSoap;
}

/** Resultado de consultar un ticket de resumen (getStatus). */
export interface EstadoTicket {
  estado: 'EN_PROCESO' | 'ACEPTADO' | 'RECHAZADO';
  respuesta: string;
  cdr?: Cdr;
}

/** Comprobante firmado, listo para enviar o guardar. */
interface Firmado {
  nombre: string;
  xmlFirmado: string;
  zip: Buffer;
  digest: string;
  qr: string;
  totalCents: number;
  igvCents: number;
}

/**
 * Emisor SUNAT directo (SEE - Del Contribuyente). Factura: sendBill al momento. Boleta: queda firmada y
 * se reporta en el resumen diario (ComprobantesSunatService). Sin credenciales no hace red.
 */
export class SunatEmisor implements EmisorElectronico {
  readonly proveedor = 'SUNAT' as const;
  private certificado: CertificadoFirma | null = null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchFn: FetchSoap;

  constructor(private readonly opciones: OpcionesSunatEmisor) {
    this.env = opciones.env ?? process.env;
    this.fetchFn = opciones.fetchFn ?? ((u, i) => fetch(u, i));
  }

  /** Hay credenciales en el entorno (no valida la clave del certificado). */
  disponible(): boolean {
    return Boolean(this.env.SUNAT_SOL_USUARIO && this.env.SUNAT_SOL_CLAVE && this.env.SUNAT_CERT_P12_B64 && this.env.SUNAT_CERT_CLAVE);
  }

  config(): ConfigSunat {
    return configSunat(this.env);
  }

  /** Fecha de vencimiento del certificado, o null si no se puede leer. */
  certificadoVence(): Date | null {
    try {
      return this.cert().vence;
    } catch {
      return null;
    }
  }

  private cert(): CertificadoFirma {
    if (!this.certificado) {
      this.certificado = leerCertificadoP12(this.env.SUNAT_CERT_P12_B64 ?? '', this.env.SUNAT_CERT_CLAVE ?? '');
    }
    return this.certificado;
  }

  /** Datos del emisor para el XML. En beta el RUC del XML es el de pruebas de SUNAT. */
  async emisorXml(): Promise<EmisorXml> {
    const local = await this.opciones.emisorLocal();
    const texto = (v: unknown) => String(v ?? '').trim();
    const e: EmisorXml = {
      ruc: this.config().ambiente === 'beta' ? RUC_PRUEBA_BETA : texto(local.ruc),
      razon: texto(local.razon_social),
      nombreComercial: texto(local.nombre),
      direccion: texto(local.direccion_fiscal),
      ubigeo: texto(local.ubigeo),
    };
    const falta = validarEmisorXml(e);
    if (falta) throw new ComprobanteInvalidoError(falta);
    return e;
  }

  /** Arma, firma y empaqueta el comprobante (sin red). */
  private async firmar(c: ComprobanteEmision): Promise<Firmado & { codigoTipo: string; cliente: { schemeID: string; numero: string } }> {
    const emisor = await this.emisorXml();
    const arm = (() => {
      try {
        return armarFacturaXml({ tipo: c.tipo, serie: c.serie, numero: c.numero, fecha: c.datos.fecha, emisor, datos: c.datos });
      } catch (e: any) {
        throw new ComprobanteInvalidoError(e?.message || 'Montos no válidos');
      }
    })();
    const xmlFirmado = firmarXml(arm.xml, this.cert());
    const nombre = `${emisor.ruc}-${arm.codigoTipo}-${c.serie}-${c.numero}`;
    // Cadena QR: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPODOCCLIENTE|NUMDOCCLIENTE|
    const qr = [
      emisor.ruc,
      arm.codigoTipo,
      c.serie,
      c.numero,
      montoXml(arm.totales.totalIgvCents),
      montoXml(arm.totales.totalCents),
      fechaIsoLima(c.datos.fecha),
      arm.cliente.schemeID,
      arm.cliente.numero,
      '',
    ].join('|');
    return {
      nombre,
      xmlFirmado,
      zip: zipUnico(`${nombre}.xml`, xmlFirmado),
      digest: digestDeFirma(xmlFirmado),
      qr,
      totalCents: arm.totales.totalCents,
      igvCents: arm.totales.totalIgvCents,
      codigoTipo: arm.codigoTipo,
      cliente: arm.cliente,
    };
  }

  private archivosDe(f: Firmado): ArchivoEmision[] {
    return [
      { tipo: 'XML', nombre: `${f.nombre}.xml`, contenido: Buffer.from(f.xmlFirmado, 'utf8') },
      { tipo: 'ZIP', nombre: `${f.nombre}.zip`, contenido: f.zip },
    ];
  }

  /** Datos comunes del resultado. Los archivos (XML y ZIP) ya se guardaron antes de enviar (alPreparar). */
  private comun(f: Firmado) {
    return { simulado: false, hash: f.digest, cadenaQr: f.qr, totalCents: f.totalCents, igvCents: f.igvCents };
  }

  /**
   * Paso LOCAL (sin red): arma, firma y empaqueta el comprobante. Devuelve hash, cadena QR y los archivos
   * (XML y ZIP) para guardarlos. BOLETA queda PENDIENTE_RESUMEN; FACTURA PENDIENTE_ENVIO hasta transmitirla.
   * Datos inválidos: RECHAZADO sin enviar. Error de certificado: se lanza (el servicio lo avisa).
   */
  async firmarComprobante(c: ComprobanteEmision): Promise<ResultadoEmision> {
    let f: Firmado & { codigoTipo: string };
    try {
      f = await this.firmar(c);
    } catch (e) {
      if (e instanceof ComprobanteInvalidoError) return { estado: 'RECHAZADO', respuesta: `Datos: ${e.motivo}`, simulado: false };
      throw e;
    }
    const archivos = this.archivosDe(f);
    if (c.tipo === 'BOLETA') {
      return { ...this.comun(f), estado: 'PENDIENTE_RESUMEN', respuesta: 'Firmada: se reporta en el resumen diario de SUNAT', archivos };
    }
    return { ...this.comun(f), estado: 'PENDIENTE_ENVIO', respuesta: 'Firmada: pendiente de envío a SUNAT', archivos };
  }

  async generar(c: ComprobanteEmision): Promise<ResultadoEmision> {
    if (c.tipo === 'FACTURA' && c.intentos > 0) {
      // Hubo un intento antes (quizá llegó a SUNAT sin respuesta): primero se pregunta si ya la tiene.
      // Si SUNAT no responde a la consulta, lanza ErrorRedEmisor y no se reenvía nada.
      const previa = await this.consultar(c);
      if (previa) return previa;
    }
    if (c.tipo === 'FACTURA' && c.zipPrevio) {
      // Mismo ZIP del intento anterior: mismo documento, mismo número, sin volver a firmar
      const emisor = await this.emisorXml();
      return this.enviarFactura(`${emisor.ruc}-01-${c.serie}-${c.numero}`, c.zipPrevio, { simulado: false }, c.timeoutMs);
    }
    let f: Firmado & { codigoTipo: string };
    try {
      f = await this.firmar(c);
    } catch (e) {
      // Datos del comprobante no válidos: se rechaza sin enviar. Otros errores (certificado) se propagan.
      if (e instanceof ComprobanteInvalidoError) return { estado: 'RECHAZADO', respuesta: `Datos: ${e.motivo}`, simulado: false };
      throw e;
    }
    // XML y ZIP firmados a disco ANTES de la red: si el proceso muere al enviar, el reintento reenvía este mismo ZIP
    if (c.alPreparar) await c.alPreparar(this.archivosDe(f));
    // ponytail: SUNAT admite sendBill individual de boletas en ciertos casos (por confirmar); hoy todas van por resumen diario (RC)
    if (c.tipo === 'BOLETA') {
      return { ...this.comun(f), estado: 'PENDIENTE_RESUMEN', respuesta: 'Firmada: se reporta en el resumen diario de SUNAT' };
    }
    return this.enviarFactura(f.nombre, f.zip, this.comun(f), c.timeoutMs);
  }

  /** Envía la factura (sendBill) y arma el resultado. Sin respuesta: PENDIENTE_ENVIO con los comunes. */
  private async enviarFactura(
    nombre: string,
    zip: Buffer,
    comunes: Omit<ResultadoEmision, 'estado' | 'respuesta'>,
    timeoutMs?: number,
  ): Promise<ResultadoEmision> {
    const cfg = this.config();
    try {
      const xml = await enviarSoap(cfg.urlFactura, sobreSoap('sendBill', cuerpoEnvio(`${nombre}.zip`, zip), cfg.usuario, cfg.clave), this.fetchFn, timeoutMs);
      const r = parsearSoap(xml);
      if (r.fault) {
        const codigo = codigoFault(r.fault);
        if (esCodigoAutenticacion(codigo)) throw new ErrorCredencialesEmisor(`SUNAT rechazó las credenciales (${codigo})`);
        if (esFaultCliente(r.fault)) return { ...comunes, estado: 'RECHAZADO', respuesta: `${codigo}: ${r.fault.mensaje}`, codigoRechazo: codigo };
        throw new ErrorRedEmisor('SUNAT devolvió un error del servidor');
      }
      const cdr = leerCdr(r.textos.applicationResponse ?? '');
      const estado = estadoCdr(cdr);
      return {
        ...comunes,
        estado: estado === 'RECHAZADA' ? 'RECHAZADO' : 'EMITIDO_SUNAT',
        respuesta: textoCdr(cdr),
        codigoRechazo: estado === 'RECHAZADA' ? String(cdr.codigo) : null,
        archivos: [{ tipo: 'CDR', nombre: cdr.nombre, contenido: cdr.xml }],
      };
    } catch (e) {
      if (e instanceof ErrorRedEmisor) return { ...comunes, estado: 'PENDIENTE_ENVIO', respuesta: 'Sin respuesta de SUNAT: se reintenta' };
      throw e;
    }
  }

  /**
   * Factura: pregunta a SUNAT por su CDR (getStatusCdr). Devuelve el resultado si SUNAT ya la tiene,
   * o null si no consta. Un error del servidor o la red lanza ErrorRedEmisor: en ese caso no se reenvía.
   */
  async consultar(c: ComprobanteEmision): Promise<ResultadoEmision | null> {
    if (c.tipo !== 'FACTURA') return null;
    const cfg = this.config();
    const emisor = await this.emisorXml();
    const cuerpo =
      `<rucComprobante>${emisor.ruc}</rucComprobante><tipoComprobante>01</tipoComprobante>` +
      `<serieComprobante>${c.serie}</serieComprobante><numeroComprobante>${c.numero}</numeroComprobante>`;
    const xml = await enviarSoap(cfg.urlConsulta, sobreSoap('getStatusCdr', cuerpo, cfg.usuario, cfg.clave), this.fetchFn, c.timeoutMs);
    const r = parsearSoap(xml);
    if (r.fault) {
      const codigo = codigoFault(r.fault);
      if (esCodigoAutenticacion(codigo)) throw new ErrorCredencialesEmisor(`SUNAT rechazó las credenciales (${codigo})`);
      // Observado en beta: la consulta devuelve "Internal Error" (Client) también para facturas que SUNAT sí tiene.
      // Un fault NO prueba que falte el comprobante: no se reenvía (evita duplicados); se trata como sin respuesta.
      throw new ErrorRedEmisor('SUNAT no pudo confirmar si ya tiene el comprobante');
    }
    if (r.textos.statusCode !== '0' || !r.textos.content) return null;
    const cdr = leerCdr(r.textos.content);
    return {
      estado: estadoCdr(cdr) === 'RECHAZADA' ? 'RECHAZADO' : 'EMITIDO_SUNAT',
      respuesta: textoCdr(cdr),
      simulado: false,
      codigoRechazo: estadoCdr(cdr) === 'RECHAZADA' ? String(cdr.codigo) : null,
      archivos: [{ tipo: 'CDR', nombre: cdr.nombre, contenido: cdr.xml }],
    };
  }

  /**
   * Anulación. Factura: arma y firma la comunicación de baja (RA); el servicio la envía y guarda el ticket.
   * Boleta: no se envía sola; queda PENDIENTE_RESUMEN y entra al resumen diario como estado 3.
   */
  async anular(c: ComprobanteEmision, motivo: string): Promise<ResultadoBaja> {
    if (c.tipo === 'BOLETA') return { estado: 'PENDIENTE_RESUMEN', respuesta: 'Anulación: se reporta en el resumen diario' };
    const emisor = await this.emisorXml();
    const hoy = new Date();
    const fecha = yyyymmddLima(hoy);
    const n = await this.opciones.correlativo(`RA${fecha}`);
    const nombre = `${emisor.ruc}-RA-${fecha}-${n}`;
    const xml = firmarXml(
      armarBajaXml({ idDoc: `RA-${fecha}-${n}`, emisor, fechaEmision: hoy, fechaRef: fechaIsoLima(c.datos.fecha), lineas: [{ serie: c.serie, numero: c.numero, motivo }] }),
      this.cert(),
    );
    return {
      estado: 'SOLICITADA',
      respuesta: 'Comunicación de baja firmada: pendiente de envío',
      resumen: { nombre, xml: Buffer.from(xml, 'utf8'), zip: zipUnico(`${nombre}.xml`, xml) },
    };
  }

  /** Firma un resumen (RC) ya armado y lo empaqueta en ZIP. */
  firmarDocumento(xml: string, nombre: string): { xml: Buffer; zip: Buffer } {
    const firmado = firmarXml(xml, this.cert());
    return { xml: Buffer.from(firmado, 'utf8'), zip: zipUnico(`${nombre}.xml`, firmado) };
  }

  /** Envía un resumen o comunicación de baja ya firmada (sendSummary). Devuelve el ticket o el rechazo. */
  async enviarResumen(nombre: string, zip: Buffer): Promise<{ ticket: string } | { rechazo: string }> {
    const cfg = this.config();
    const xml = await enviarSoap(cfg.urlFactura, sobreSoap('sendSummary', cuerpoEnvio(`${nombre}.zip`, zip), cfg.usuario, cfg.clave), this.fetchFn);
    const r = parsearSoap(xml);
    if (r.fault) {
      if (esCodigoAutenticacion(codigoFault(r.fault))) throw new ErrorCredencialesEmisor(`SUNAT rechazó las credenciales (${codigoFault(r.fault)})`);
      if (esFaultCliente(r.fault)) return { rechazo: `${codigoFault(r.fault)}: ${r.fault.mensaje}` };
      throw new ErrorRedEmisor('SUNAT devolvió un error del servidor');
    }
    if (!r.textos.ticket) throw new ErrorRedEmisor('SUNAT no devolvió ticket');
    return { ticket: r.textos.ticket };
  }

  /** Consulta un ticket (getStatus): statusCode 0 aceptado (con CDR), 98 en proceso, 99 con error. */
  async consultarTicket(ticket: string): Promise<EstadoTicket> {
    const cfg = this.config();
    const xml = await enviarSoap(cfg.urlFactura, sobreSoap('getStatus', `<ticket>${ticket}</ticket>`, cfg.usuario, cfg.clave), this.fetchFn);
    const r = parsearSoap(xml);
    if (r.fault) {
      if (esCodigoAutenticacion(codigoFault(r.fault))) throw new ErrorCredencialesEmisor(`SUNAT rechazó las credenciales (${codigoFault(r.fault)})`);
      if (esFaultCliente(r.fault)) return { estado: 'RECHAZADO', respuesta: `${codigoFault(r.fault)}: ${r.fault.mensaje}` };
      throw new ErrorRedEmisor('SUNAT devolvió un error del servidor');
    }
    const code = r.textos.statusCode;
    if (code === '98') return { estado: 'EN_PROCESO', respuesta: 'En proceso en SUNAT' };
    if (!r.textos.content) throw new ErrorRedEmisor('SUNAT no devolvió CDR del ticket');
    const cdr = leerCdr(r.textos.content);
    if (code === '0' && estadoCdr(cdr) !== 'RECHAZADA') return { estado: 'ACEPTADO', respuesta: textoCdr(cdr), cdr };
    return { estado: 'RECHAZADO', respuesta: textoCdr(cdr), cdr };
  }
}
