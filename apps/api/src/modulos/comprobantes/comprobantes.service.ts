import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Comprobante, Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { cobroVigente } from '../caja/caja.calculo';
import {
  extraerOpciones,
  enmascararDni,
  formatearCorrelativo,
  formatearFechaHoraLima,
  validarDocumentoComprobante,
} from './comprobantes.util';
import { MarcarEmitidoDto } from './dto/marcar-emitido.dto';
import { ListarPorEmitirDto } from './dto/listar-por-emitir.dto';
import { ConfigFacturacionDto } from './dto/facturacion.dto';
import { CLAVES_FACTURACION, ConfigFacturacion, interpretarConfig } from './facturacion/facturacion.config';
import { aCentimos } from './facturacion/facturacion.calculo';
import { ArchivoEmision, ComprobanteEmision, DatosEmision, EmisorElectronico, ErrorCredencialesEmisor, ErrorRedEmisor, Proveedor, ResultadoBaja, ResultadoEmision } from './emisor/emisor.tipos';
import { proveedorDe } from './emisor/proveedor';
import { SimuladoEmisor } from './emisor/simulado.emisor';
import { SunatEmisor } from './sunat/sunat.emisor';
import { ambienteSunat } from './sunat/sunat.config';
import { TIMEOUT_SUNAT_INTERACTIVO_MS, TIMEOUT_SUNAT_MS } from './sunat/sunat.soap';
import { bytes, sha256 } from './sunat/sunat.util';
import { ComprobantesSunatService } from './comprobantes-sunat.service';
import { ComprobantesSaludService, condicionProblemas } from './comprobantes-salud.service';
import { LEASE_ENVIO_MS, MAX_INTENTOS_DEFECTO, esRechazoPermanente, esperaFacturacionMs } from './comprobantes-politica';
import { siguienteCorrelativo } from './secuencia';
import { armarDatosPdf } from './pdf/comprobante-datos';
import { generarPdfComprobante } from './pdf/comprobante-pdf';
import { leerParametroNumerico } from '../impresion/estado-impresion';

/** Plazo de la comunicación de baja de una factura en SUNAT (días). */
export const PLAZO_BAJA_FACTURA_DIAS = 7;

/** Estados desde los que una boleta/factura puede enviarse (o reenviarse). */
const ESTADOS_ENVIABLES = ['PENDIENTE_ENVIO', 'RECHAZADO', 'REVISION_MANUAL'];
const TIPOS_ELECTRONICOS = ['BOLETA', 'FACTURA'];

/** Parámetro con la fecha de corte de la facturación electrónica (ISO). Antes de ella, el barrido no toca nada. */
export const CLAVE_FECHA_CORTE = 'facturacion_desde';
/** El barrido solo recupera cobros de las últimas 48 h (además del corte). */
export const VENTANA_BARRIDO_MS = 48 * 60 * 60 * 1000;

/** Series de la nota de venta interna (sin SUNAT). */
const SERIE_NOTA = 'NV01';

/** Textos que la respuesta de SUNAT deja en la fila (sin secretos: solo lo que devuelve SUNAT). */
const MAX_TEXTO_RESPUESTA = 1000;

function textoRespuesta(v: unknown): string {
  if (v == null) return '';
  const t = typeof v === 'string' ? v : JSON.stringify(v);
  return t.length > MAX_TEXTO_RESPUESTA ? t.slice(0, MAX_TEXTO_RESPUESTA) : t;
}

/** Proveedor de una fila: la columna emisor; filas sin ella: simulado o SUNAT según la marca. */
function proveedorDeFila(c: { emisor?: string | null; simulado?: boolean | null }): Proveedor {
  if (c.emisor) return proveedorDe(c.emisor);
  return c.simulado ? 'SIMULADO' : 'SUNAT';
}

@Injectable()
export class ComprobantesService {
  private readonly logger = new Logger(ComprobantesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly localService?: LocalService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly sunatEmisor?: SunatEmisor,
    @Optional() private readonly sunatResumen?: ComprobantesSunatService,
    @Optional() private readonly salud?: ComprobantesSaludService,
  ) {}

  /** Proveedor que de verdad emite: SUNAT solo con sus credenciales; si no, SIMULADO (sin red). */
  proveedorEfectivo(valor: unknown): Proveedor {
    const p = proveedorDe(valor);
    if (p === 'SUNAT' && !this.sunatEmisor?.disponible()) return 'SIMULADO';
    return p;
  }

  /** Emisor que atiende una fila según su proveedor guardado. */
  private emisorPara(proveedor: Proveedor): EmisorElectronico {
    if (proveedor === 'SUNAT') {
      if (!this.sunatEmisor) throw new ErrorRedEmisor('SUNAT no está configurado en este servidor');
      return this.sunatEmisor;
    }
    return new SimuladoEmisor();
  }

  /** Arma los datos del comprobante a partir del pedido (céntimos). Lanza si un monto no sirve. */
  private async datosDeFila(c: any, cfgIgv: number, direccion: string | null): Promise<DatosEmision> {
    const pedido: any = c.pedido;
    return {
      tipo: c.tipo,
      serie: c.serie,
      numero: c.numero,
      fecha: c.creado_en,
      documento: c.documento,
      razon: c.razon_social || pedido.cliente_nombre || null,
      direccion,
      correo: null,
      igvPct: cfgIgv,
      lineas: (pedido.lineas || []).map((l: any) => ({
        nombre: l.nombre,
        cantidad: Number(l.cantidad) || 1,
        subtotalCents: aCentimos(Number(l.subtotal ?? Number(l.precio_unit) * (Number(l.cantidad) || 1))),
      })),
      envioCents: aCentimos(Number(pedido.envio ?? 0)),
      descuentoCents: aCentimos(Number(pedido.descuento ?? 0)),
      totalCents: aCentimos(Number(pedido.total)),
    };
  }

  private async ultimoArchivo(comprobanteId: bigint, tipo: string): Promise<Buffer | null> {
    const a = await this.prisma.comprobanteArchivo?.findFirst({
      where: { comprobante_id: comprobanteId, tipo },
      orderBy: { id: 'desc' },
    });
    return a?.contenido ? Buffer.from(a.contenido) : null;
  }

  /** Guarda XML, ZIP o CDR del comprobante con su huella SHA-256. Nada se borra: cada envío agrega filas. */
  private async guardarArchivo(comprobanteId: bigint, a: { tipo: string; nombre: string; contenido: Buffer }) {
    await this.prisma.comprobanteArchivo.create({
      data: { comprobante_id: comprobanteId, tipo: a.tipo, nombre: a.nombre, contenido: bytes(a.contenido), sha256: sha256(a.contenido) },
    });
  }

  /** Archivo guardado de un comprobante (XML, ZIP o CDR), el más reciente. */
  async obtenerArchivo(idRaw: bigint | string | number, tipoRaw: string, usuario?: UsuarioAutenticado, ip?: string) {
    const id = this.parsearId(idRaw, 'comprobante');
    const tipo = (tipoRaw || '').toUpperCase();
    if (!['XML', 'ZIP', 'CDR'].includes(tipo)) {
      throw new BadRequestException({ codigo: 'TIPO_ARCHIVO_INVALIDO', mensaje: 'El archivo debe ser XML, ZIP o CDR' });
    }
    const a = await this.prisma.comprobanteArchivo.findFirst({
      where: { comprobante_id: id, tipo },
      orderBy: { id: 'desc' },
    });
    if (!a) {
      throw new NotFoundException({ codigo: 'ARCHIVO_NO_ENCONTRADO', mensaje: 'Todavía no hay ese archivo para el comprobante' });
    }
    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'comprobantes',
      accion: 'DESCARGAR_ARCHIVO_ELECTRONICO',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: id,
      despues: { tipo, nombre: a.nombre },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return { nombre: a.nombre, tipo: a.tipo, contenido: Buffer.from(a.contenido), sha256: a.sha256 };
  }

  /**
   * Representación impresa (PDF) de una BOLETA/FACTURA electrónica, generada al vuelo desde lo guardado.
   * Nada se guarda en base. Audita la lectura (datos personales). DNI/RUC completos solo para ADMIN.
   */
  async pdfComprobante(idRaw: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string): Promise<{ nombre: string; contenido: Buffer }> {
    const id = this.parsearId(idRaw, 'comprobante');
    const c = await this.prisma.comprobante.findUnique({
      where: { id },
      include: { pedido: { include: { lineas: true } } },
    });
    if (!c) {
      throw new NotFoundException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' });
    }
    if (!TIPOS_ELECTRONICOS.includes(c.tipo)) {
      throw new HttpException(
        { codigo: 'COMPROBANTE_NO_ELECTRONICO', mensaje: 'Solo las boletas y facturas electrónicas tienen representación en PDF' },
        HttpStatus.CONFLICT,
      );
    }
    const local = ((await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }))?.valor ?? {}) as Record<string, unknown>;
    const datos = armarDatosPdf(c, c.pedido, local, {
      esAdmin: usuario?.rol === 'ADMIN',
      ambiente: this.sunatEmisor?.config().ambiente ?? ambienteSunat(),
    });
    const contenido = await generarPdfComprobante(datos);
    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'comprobantes',
      accion: 'VER_PDF_ELECTRONICO',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: id,
      despues: { tipo: c.tipo, numero_texto: c.numero_texto, situacion: datos.situacion },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return { nombre: `${c.numero_texto}.pdf`, contenido };
  }

  private parsearId(id: bigint | string | number, entidad = 'comprobante'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  /**
   * Serializa un objeto comprobante convirtiendo campos BigInt a string.
   */
  private serializarComprobante(c: any) {
    return {
      id: c.id.toString(),
      pedido_id: c.pedido_id.toString(),
      tipo: c.tipo,
      serie: c.serie,
      numero: c.numero,
      numero_texto: c.numero_texto,
      documento: c.documento ?? null,
      razon_social: c.razon_social ?? null,
      emision: c.emision,
      copias_impresas: c.copias_impresas,
      emitido_en: c.emitido_en ?? null,
      emitido_por: c.emitido_por ? c.emitido_por.toString() : null,
      referencia_externa: c.referencia_externa ?? null,
      creado_en: c.creado_en,
      facturacion_estado: c.facturacion_estado ?? null,
      facturacion_intentos: c.facturacion_intentos ?? 0,
      enlace_pdf: c.facturacion_enlace_pdf ?? null,
      cadena_qr: c.facturacion_cadena_qr ?? null,
      hash: c.facturacion_hash ?? null,
      respuesta_sunat: c.facturacion_respuesta ?? null,
      revision_motivo: c.revision_motivo ?? null,
      simulado: c.simulado ?? false,
      baja_estado: c.baja_estado ?? null,
      baja_motivo: c.baja_motivo ?? null,
      baja_en: c.baja_en ?? null,
      emisor: c.emisor ?? null,
    };
  }

  /** Series y IGV de la facturación electrónica (parámetros; defecto B002, F002 y 10.5 %). */
  async leerConfigFacturacion(db: any = this.prisma): Promise<ConfigFacturacion> {
    const valores: Record<string, unknown> = {};
    for (const clave of Object.values(CLAVES_FACTURACION)) {
      try {
        const p = await db.parametro.findUnique({ where: { clave } });
        valores[clave] = p?.valor;
      } catch {
        valores[clave] = undefined; // sin lectura: valor por defecto
      }
    }
    return interpretarConfig(valores);
  }

  /**
   * Emite el comprobante para un pedido cobrado.
   * - Es idempotente: si ya existe el comprobante para el pedido, lo devuelve.
   * - NOTA_VENTA: serie NV01 interna. BOLETA/FACTURA válidas: serie B002/F002 (parámetros) y se envían a SUNAT.
   * - Si el documento es inválido, NO bloquea el cobro: lo deja con tipo NOTA_VENTA y lo reporta en la respuesta.
   * - Con tx (transacción externa) no hace red: la boleta/factura queda PENDIENTE_ENVIO y la tarea la envía.
   */
  async emitirParaPedido(
    pedidoIdRaw: bigint | string | number,
    tx?: Prisma.TransactionClient | any,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');
    const db = tx ?? this.prisma;

    // 1. Idempotencia: verificar si ya existe
    // La anulada (anulado_en) no cuenta: si el pedido se vuelve a cobrar, la nota nueva es otra fila
    const existente = await db.comprobante.findFirst({
      where: { pedido_id: pedidoId, anulado_en: null },
    });

    if (existente) {
      return {
        ...this.serializarComprobante(existente),
        advertencia: null,
      };
    }

    // 2. Obtener datos del pedido
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      include: { lineas: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido no existe',
      });
    }

    // 3. Validar tipo y documentos
    const tipoSolicitado = (pedido.comprobante_tipo || 'NOTA_VENTA').trim().toUpperCase();
    const docSolicitado = pedido.comprobante_doc?.trim() || null;
    const razonSolicitada = pedido.comprobante_razon?.trim() || null;
    const direccionSolicitada = pedido.comprobante_direccion?.trim() || null;

    const validacion = validarDocumentoComprobante(
      tipoSolicitado,
      docSolicitado,
      razonSolicitada,
      Number(pedido.total),
    );

    let tipoFinal = tipoSolicitado;
    let emisionFinal: 'INTERNA' | 'POR_EMITIR' = 'INTERNA';
    const docFinal = docSolicitado;
    const razonFinal = razonSolicitada;
    let advertencia: string | null = null;

    if (!validacion.valido) {
      tipoFinal = 'NOTA_VENTA';
      emisionFinal = 'INTERNA';
      advertencia = `Documento inválido para ${tipoSolicitado}: ${validacion.motivo}. Se emitió NOTA_VENTA interna.`;
    } else if (tipoFinal === 'BOLETA' || tipoFinal === 'FACTURA') {
      emisionFinal = 'POR_EMITIR';
    } else {
      tipoFinal = 'NOTA_VENTA';
      emisionFinal = 'INTERNA';
    }

    // 4. Serie y correlativo propio de la serie (atómico)
    const electronico = tipoFinal === 'BOLETA' || tipoFinal === 'FACTURA';
    const cfg = electronico ? await this.leerConfigFacturacion(db) : null;
    const proveedor: Proveedor = cfg ? this.proveedorEfectivo(cfg.proveedor) : 'SIMULADO';
    const serie = !cfg ? SERIE_NOTA : tipoFinal === 'BOLETA' ? cfg.serieBoleta : cfg.serieFactura;
    const numero = await siguienteCorrelativo(db, serie);
    const numeroTexto = formatearCorrelativo(serie, numero);

    // 5. Crear fila de comprobante (BOLETA/FACTURA quedan PENDIENTE_ENVIO hasta que SUNAT responda)
    const nuevo = await db.comprobante.create({
      data: {
        pedido_id: pedidoId,
        tipo: tipoFinal,
        serie,
        numero,
        numero_texto: numeroTexto,
        documento: docFinal,
        razon_social: razonFinal,
        emision: emisionFinal,
        copias_impresas: 0,
        ...(electronico ? { facturacion_estado: 'PENDIENTE_ENVIO', emisor: proveedor, simulado: proveedor === 'SIMULADO' } : {}),
      },
    });

    // 6. Auditar emisión
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'EMITIR',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: nuevo.id,
      despues: {
        pedidoId: pedidoId.toString(),
        tipo: tipoFinal,
        serie,
        numero,
        numero_texto: numeroTexto,
        emision: emisionFinal,
        advertencia,
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    }, db);

    if (!electronico) {
      return { ...this.serializarComprobante(nuevo), advertencia };
    }

    // 7. Envío a SUNAT. Con tx no hay red: la fila PENDIENTE_ENVIO es el outbox y el envío lo hace el worker
    // (o el envío post-commit de Caja). Sin tx, se envía al momento.
    let enviado: any = nuevo;
    if (!tx) {
      try {
        enviado = await this.enviarElectronico(nuevo.id, { direccion: direccionSolicitada, usuario, ip, automatico: true, interactivo: !!usuario });
      } catch {
        // Error inesperado: el cobro sigue; el comprobante queda pendiente con su número y la tarea lo reenvía
        enviado = await this.prisma.comprobante
          .update({ where: { id: nuevo.id }, data: { facturacion_estado: 'PENDIENTE_ENVIO', emision: 'POR_EMITIR' } })
          .catch(() => nuevo);
      }
    }
    return { ...this.serializarComprobante(enviado), advertencia };
  }

  /**
   * Envía (o reenvía) una BOLETA/FACTURA al emisor que la atiende (SUNAT o simulado) y guarda el resultado.
   * - Boleta SUNAT: queda PENDIENTE_RESUMEN (firmada); el resumen diario la envía.
   * - Sin respuesta (red o tiempo agotado): PENDIENTE_ENVIO con el mismo número; la tarea lo reenvía.
   * - Si ya hubo un intento, el emisor consulta antes de reenviar para no duplicar.
   * El cobro nunca se deshace por esta llamada: los errores de red no salen de aquí.
   */
  async enviarElectronico(
    comprobanteId: bigint,
    opciones: { direccion?: string | null; usuario?: UsuarioAutenticado; ip?: string; automatico?: boolean; interactivo?: boolean } = {},
  ): Promise<any> {
    // Pausa del circuito: el envío automático no sale; la fila queda PENDIENTE_ENVIO con su número
    if (opciones.automatico && (await this.salud?.circuitoAbierto())) {
      return this.prisma.comprobante.findUnique({ where: { id: comprobanteId } });
    }
    // Reclamo de la fila: solo si está enviable y sin envío en curso. Estado y lease se miran en el mismo UPDATE,
    // así dos caminos (worker y envío post-commit) no mandan el mismo comprobante.
    const ahora = new Date();
    const reclamo = await this.prisma.comprobante.updateMany({
      where: {
        id: comprobanteId,
        tipo: { in: TIPOS_ELECTRONICOS },
        facturacion_estado: { in: ESTADOS_ENVIABLES },
        OR: [{ enviando_hasta: null }, { enviando_hasta: { lt: ahora } }],
      },
      data: { enviando_hasta: new Date(ahora.getTime() + LEASE_ENVIO_MS) },
    });
    const c = await this.prisma.comprobante.findUnique({
      where: { id: comprobanteId },
      include: { pedido: { include: { lineas: true } } },
    });
    if (!c || !TIPOS_ELECTRONICOS.includes(c.tipo)) return c;
    if (reclamo.count === 0) {
      if (opciones.automatico || !ESTADOS_ENVIABLES.includes(c.facturacion_estado ?? '')) return c;
      throw new HttpException(
        { codigo: 'COMPROBANTE_EN_ENVIO', mensaje: 'Ese comprobante se está enviando ahora: espere y revise su estado' },
        HttpStatus.CONFLICT,
      );
    }
    try {
      return await this.enviarReclamado(c, opciones);
    } finally {
      // Libera el lease aunque algo falle a mitad (si guardarResultado llegó, ya quedó en null)
      await this.prisma.comprobante.updateMany({ where: { id: comprobanteId }, data: { enviando_hasta: null } }).catch(() => undefined);
    }
  }

  private async enviarReclamado(
    c: any,
    opciones: { direccion?: string | null; usuario?: UsuarioAutenticado; ip?: string; interactivo?: boolean },
  ): Promise<any> {
    const cfg = await this.leerConfigFacturacion();
    const pedido: any = c.pedido;
    const direccion = opciones.direccion ?? pedido.comprobante_direccion ?? null;
    const proveedor = proveedorDeFila(c);

    let datos: DatosEmision;
    try {
      datos = await this.datosDeFila(c, cfg.igvPct, direccion);
    } catch {
      return this.guardarResultado(c, { estado: 'RECHAZADO', respuesta: 'Datos: Datos del comprobante no válidos', simulado: false }, opciones);
    }

    const intentosPrevios = c.facturacion_intentos ?? 0;
    const maxIntentos = await leerParametroNumerico(this.prisma, 'facturacion_max_intentos', MAX_INTENTOS_DEFECTO);
    let res: ResultadoEmision;
    try {
      // Un intento previo sin respuesta, o una factura ya firmada en el cobro: se reenvía el ZIP guardado tal cual
      // (mismo documento, mismo número, mismo hash). Nunca se vuelve a firmar algo ya firmado.
      const yaFirmada = intentosPrevios > 0 || !!c.facturacion_hash;
      const zipPrevio = c.facturacion_estado === 'PENDIENTE_ENVIO' && yaFirmada ? await this.ultimoArchivo(c.id, 'ZIP') : null;
      if (proveedor !== 'SIMULADO') {
        // Se cuenta ANTES de llamar a SUNAT: si el proceso muere en la llamada, el próximo intento consulta antes de reenviar
        await this.prisma.comprobante.update({ where: { id: c.id }, data: { facturacion_intentos: { increment: 1 } } });
      }
      const emision: ComprobanteEmision = {
        id: c.id,
        tipo: c.tipo as 'BOLETA' | 'FACTURA',
        serie: c.serie,
        numero: c.numero,
        intentos: intentosPrevios,
        datos,
        zipPrevio,
        alPreparar: (archivos: ArchivoEmision[]) => this.guardarArchivos(c.id, archivos),
        timeoutMs: opciones.interactivo ? TIMEOUT_SUNAT_INTERACTIVO_MS : TIMEOUT_SUNAT_MS,
      };
      res = await this.emisorPara(proveedor).generar(emision);
      // El emisor convierte la falla de red en PENDIENTE_ENVIO (no la lanza): ahí se cuenta el fallo para el circuito
      if (c.tipo === 'FACTURA' && proveedor === 'SUNAT') {
        if (res.estado === 'PENDIENTE_ENVIO') await this.salud?.registrarFallo();
        else await this.salud?.registrarExito();
      }
    } catch (e: any) {
      if (e instanceof ErrorCredencialesEmisor) {
        await this.salud?.registrarCredenciales();
        res = { estado: 'PENDIENTE_ENVIO', respuesta: 'SUNAT rechazó las credenciales: envío en pausa', simulado: false };
      } else {
        if (e instanceof ErrorRedEmisor && proveedor === 'SUNAT') await this.salud?.registrarFallo();
        if (!(e instanceof ErrorRedEmisor)) this.logger.error(`Emisor ${proveedor}: ${e?.message ?? e}`);
        res = { estado: 'PENDIENTE_ENVIO', respuesta: 'Sin respuesta del emisor electrónico: se reintenta', simulado: false };
      }
    }

    // Decisión: sin respuesta muchas veces, o rechazo que no se arregla reintentando, pasa a REVISION_MANUAL (cola de fallos)
    const intentosTras = intentosPrevios + (proveedor !== 'SIMULADO' ? 1 : 0);
    let estado: string = res.estado;
    let revisionMotivo: string | null = null;
    if (estado === 'PENDIENTE_ENVIO' && intentosTras >= maxIntentos) {
      estado = 'REVISION_MANUAL';
      revisionMotivo = `Sin respuesta de SUNAT tras ${intentosTras} intentos: ${res.respuesta}`;
    } else if (estado === 'RECHAZADO' && esRechazoPermanente(res.codigoRechazo)) {
      estado = 'REVISION_MANUAL';
      revisionMotivo = `Rechazo permanente ${res.codigoRechazo}: ${res.respuesta}`;
    }
    const proximoIntentoEn = estado === 'PENDIENTE_ENVIO' ? new Date(Date.now() + esperaFacturacionMs(intentosTras)) : null;
    return this.guardarResultado(c, res, opciones, { estado, revisionMotivo, proximoIntentoEn });
  }

  /** Guarda XML y ZIP firmados ANTES de la llamada de red (así el reintento puede reenviar el mismo ZIP). */
  private async guardarArchivos(comprobanteId: bigint, archivos: ArchivoEmision[]): Promise<void> {
    for (const a of archivos) await this.guardarArchivo(comprobanteId, a);
  }

  /** Guarda el resultado del envío, sus archivos y la emisión en la fila (y audita). */
  private async guardarResultado(
    c: any,
    res: ResultadoEmision,
    opciones: { usuario?: UsuarioAutenticado; ip?: string },
    extra: { estado?: string; revisionMotivo?: string | null; proximoIntentoEn?: Date | null } = {},
  ) {
    const estado = extra.estado ?? res.estado;
    const aceptado = estado === 'EMITIDO_SUNAT';
    const ahora = new Date();
    const respuesta = textoRespuesta(res.respuesta || 'Sin detalle de SUNAT');
    const data: any = {
      facturacion_estado: estado,
      emision: aceptado ? 'EMITIDO' : 'POR_EMITIR',
      facturacion_respuesta: respuesta,
      simulado: res.simulado === true,
      enviando_hasta: null,
      proximo_intento_en: estado === 'PENDIENTE_ENVIO' ? (extra.proximoIntentoEn ?? null) : null,
      revision_motivo: estado === 'REVISION_MANUAL' ? (extra.revisionMotivo ?? null) : null,
      revision_en: estado === 'REVISION_MANUAL' ? ahora : null,
    };
    if (res.hash) data.facturacion_hash = res.hash;
    if (res.cadenaQr) data.facturacion_cadena_qr = res.cadenaQr;
    if (res.totalCents !== undefined) {
      data.sunat_total_cents = res.totalCents;
      data.sunat_igv_cents = res.igvCents ?? null;
    }
    if (aceptado) {
      data.emitido_en = ahora;
      data.facturacion_enlace_pdf = res.enlacePdf || null;
    }
    const actualizado = await this.prisma.comprobante.update({ where: { id: c.id }, data });
    for (const a of res.archivos ?? []) await this.guardarArchivo(c.id, a);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: `FACTURACION_${estado}`,
      resultado: estado === 'RECHAZADO' || estado === 'REVISION_MANUAL' ? 'RECHAZADO' : 'OK',
      entidad: 'comprobante',
      entidadId: c.id,
      antes: { estado: c.facturacion_estado ?? null },
      despues: {
        numero_texto: c.numero_texto,
        emisor: data.simulado ? 'SIMULADO' : proveedorDeFila(c),
        estado,
        simulado: data.simulado,
        respuesta: respuesta.slice(0, 300),
      },
      partyId: opciones.usuario?.partyId ? BigInt(opciones.usuario.partyId) : undefined,
      ip: opciones.ip,
    });

    if (estado === 'RECHAZADO' || estado === 'REVISION_MANUAL') {
      await this.salud?.avisar({
        clave: `comprobante:${c.id}:${estado}:${actualizado.facturacion_intentos}`,
        titulo: `${c.numero_texto} ${estado === 'RECHAZADO' ? 'rechazado por SUNAT' : 'pasó a revisión manual'}`,
        mensaje: extra.revisionMotivo ?? respuesta.slice(0, 300),
        prioridad: 'alta',
        enlace: '/admin/comprobantes',
      });
    }
    return actualizado;
  }

  /** Reintenta el envío de una BOLETA/FACTURA rechazada o pendiente. Opcional: corrige documento, razón y dirección antes. */
  async reintentarElectronico(
    idRaw: bigint | string | number,
    correccion: { documento?: string | null; razon?: string | null; direccion?: string | null } = {},
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parsearId(idRaw, 'comprobante');
    const c = await this.prisma.comprobante.findUnique({ where: { id } });
    if (!c || (c.tipo !== 'BOLETA' && c.tipo !== 'FACTURA')) {
      throw new NotFoundException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' });
    }
    if (c.facturacion_estado === 'EMITIDO_SUNAT') {
      throw new HttpException(
        { codigo: 'COMPROBANTE_YA_EMITIDO', mensaje: 'El comprobante ya fue aceptado por SUNAT' },
        HttpStatus.CONFLICT,
      );
    }
    if (c.facturacion_estado === 'PENDIENTE_RESUMEN' || c.facturacion_estado === 'ENVIADA_RESUMEN') {
      throw new HttpException(
        { codigo: 'COMPROBANTE_EN_RESUMEN', mensaje: 'La boleta ya está en el resumen diario de SUNAT: espere la respuesta' },
        HttpStatus.CONFLICT,
      );
    }
    const cambios: any = {};
    if (correccion.documento !== undefined) cambios.documento = correccion.documento || null;
    if (correccion.razon !== undefined) cambios.razon_social = correccion.razon || null;
    if (Object.keys(cambios).length > 0) {
      const valido = validarDocumentoComprobante(c.tipo, cambios.documento ?? c.documento, cambios.razon_social ?? c.razon_social);
      if (!valido.valido) {
        throw new BadRequestException({ codigo: 'COMPROBANTE_INVALIDO', mensaje: valido.motivo });
      }
      await this.prisma.comprobante.update({ where: { id }, data: cambios });
    }
    if (correccion.direccion !== undefined) {
      await this.prisma.pedido.update({
        where: { id: c.pedido_id },
        data: { comprobante_direccion: correccion.direccion?.trim() || null },
      });
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'REINTENTO_MANUAL',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: id,
      antes: { estado: c.facturacion_estado ?? null, intentos: c.facturacion_intentos ?? 0 },
      despues: { correcciones: Object.keys(cambios).concat(correccion.direccion !== undefined ? ['direccion'] : []) },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    const enviado = await this.enviarElectronico(id, { direccion: correccion.direccion ?? undefined, usuario, ip, interactivo: true });
    return this.serializarComprobante(enviado);
  }

  /**
   * Tarea automática (worker): reenvía las BOLETA/FACTURA PENDIENTE_ENVIO cuyo próximo intento ya llegó
   * (lotes de 20, las más antiguas primero). Con el circuito abierto no envía nada.
   */
  async reintentarPendientes(): Promise<{ revisados: number; motivo?: string }> {
    if (await this.salud?.circuitoAbierto()) return { revisados: 0, motivo: 'CIRCUITO_ABIERTO' };
    const ahora = new Date();
    const pendientes = await this.prisma.comprobante.findMany({
      where: {
        facturacion_estado: 'PENDIENTE_ENVIO',
        tipo: { in: TIPOS_ELECTRONICOS },
        OR: [{ proximo_intento_en: null }, { proximo_intento_en: { lte: ahora } }],
      },
      orderBy: { creado_en: 'asc' },
      take: 20,
      select: { id: true },
    });
    for (const p of pendientes) {
      try {
        await this.enviarElectronico(p.id, { automatico: true });
      } catch (e: any) {
        this.logger.error(`Reenvío del comprobante ${p.id}: ${e?.message ?? e}`);
      }
    }
    return { revisados: pendientes.length };
  }

  /**
   * Paso LOCAL del cobro (sin red): firma y guarda el comprobante electrónico del pedido, para que el ticket
   * salga con hash y QR. Usa el mismo lease que el envío: el worker no firma ni envía la misma fila a la vez.
   * Nunca lanza. Si la firma falla (p. ej. certificado), la fila queda PENDIENTE_ENVIO con aviso y el envío la reintenta.
   */
  async firmarPorPedido(pedidoIdRaw: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string): Promise<void> {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');
    const base = await this.prisma.comprobante.findFirst({
      where: { pedido_id: pedidoId, anulado_en: null, tipo: { in: TIPOS_ELECTRONICOS } },
      select: { id: true, facturacion_estado: true, facturacion_hash: true, emisor: true, simulado: true },
    });
    if (!base || base.facturacion_hash || base.facturacion_estado !== 'PENDIENTE_ENVIO') return;
    // SIMULADO no tiene red: se emite de una vez (local)
    if (proveedorDeFila(base) === 'SIMULADO') {
      await this.enviarElectronico(base.id, { automatico: true, usuario, ip }).catch(() => undefined);
      return;
    }
    if (!this.sunatEmisor) return;
    const ahora = new Date();
    const reclamo = await this.prisma.comprobante.updateMany({
      where: {
        id: base.id,
        facturacion_hash: null,
        facturacion_estado: 'PENDIENTE_ENVIO',
        OR: [{ enviando_hasta: null }, { enviando_hasta: { lt: ahora } }],
      },
      data: { enviando_hasta: new Date(ahora.getTime() + LEASE_ENVIO_MS) },
    });
    if (reclamo.count === 0) return;
    try {
      const c = await this.prisma.comprobante.findUnique({
        where: { id: base.id },
        include: { pedido: { include: { lineas: true } } },
      });
      if (!c) return;
      const cfg = await this.leerConfigFacturacion();
      let datos: DatosEmision;
      try {
        datos = await this.datosDeFila(c, cfg.igvPct, c.pedido.comprobante_direccion ?? null);
      } catch {
        await this.guardarResultado(c, { estado: 'RECHAZADO', respuesta: 'Datos: Datos del comprobante no válidos', simulado: false }, { usuario, ip });
        return;
      }
      const res = await this.sunatEmisor.firmarComprobante({
        id: c.id,
        tipo: c.tipo as 'BOLETA' | 'FACTURA',
        serie: c.serie,
        numero: c.numero,
        intentos: c.facturacion_intentos ?? 0,
        datos,
      });
      await this.guardarResultado(c, res, { usuario, ip });
    } catch (e: any) {
      this.logger.error(`Firma del comprobante ${base.id}: ${e?.message ?? e}`);
      await this.salud
        ?.avisar({
          clave: `comprobante:${base.id}:firma`,
          titulo: 'Comprobante sin firmar',
          mensaje: 'No se pudo firmar el comprobante electrónico (revisar el certificado de SUNAT). El envío lo reintentará.',
          prioridad: 'alta',
          enlace: '/admin/comprobantes',
        })
        .catch(() => undefined);
    } finally {
      await this.prisma.comprobante.updateMany({ where: { id: base.id }, data: { enviando_hasta: null } }).catch(() => undefined);
    }
  }

  /**
   * Paso de RED del cobro: se dispara sin esperarlo, fuera del camino del cobro y del ticket.
   * Lo que falle queda PENDIENTE_ENVIO y el worker lo reintenta (con el ZIP ya firmado, sin duplicar).
   */
  transmitirEnSegundoPlano(pedidoIdRaw: bigint | string | number): void {
    this.enviarPorPedido(pedidoIdRaw).catch((e: any) =>
      this.logger.error(`Transmisión en segundo plano del pedido ${String(pedidoIdRaw)}: ${e?.message ?? e}`),
    );
  }

  /**
   * Envío inmediato de la boleta/factura de un pedido, justo después del commit del cobro.
   * Si no sale, la fila queda PENDIENTE_ENVIO y el worker la reenvía.
   */
  async enviarPorPedido(pedidoIdRaw: bigint | string | number) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');
    const c = await this.prisma.comprobante.findFirst({ where: { pedido_id: pedidoId, anulado_en: null }, select: { id: true } });
    if (!c) return null;
    return this.enviarElectronico(c.id, { automatico: true });
  }

  /**
   * Barrido de recuperación: crea UNA vez el comprobante de los pedidos cobrados como boleta/factura que no lo tienen
   * (caída entre el cobro y su emisión). Reglas:
   *  - Sin parámetro facturacion_desde (fecha de corte) no hace nada: los pedidos históricos nunca salen a SUNAT.
   *  - Solo cobros posteriores al corte y dentro de las últimas 48 h.
   *  - En modo SIMULADO solo registra lo que encontró; no crea filas.
   */
  async barrerPedidosSinComprobante(ahora = new Date()): Promise<{ creados: number; encontrados: number; motivo?: string }> {
    const corte = await this.leerFechaCorteFacturacion();
    if (!corte) return { creados: 0, encontrados: 0, motivo: 'SIN_FECHA_DE_CORTE' };
    const cfg = await this.leerConfigFacturacion();
    const simulado = this.proveedorEfectivo(cfg.proveedor) === 'SIMULADO';
    const desde = new Date(Math.max(corte.getTime(), ahora.getTime() - VENTANA_BARRIDO_MS));
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        pago_estado: 'PAGADO',
        comprobante_tipo: { in: TIPOS_ELECTRONICOS },
        cobros: { some: { anulado_en: null, en: { gte: desde } } },
        comprobante: { none: { anulado_en: null } },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 20,
    });
    if (simulado) {
      this.logger.log(JSON.stringify({ evento: 'barrido_comprobantes_simulado', encontrados: pedidos.length }));
      return { creados: 0, encontrados: pedidos.length, motivo: 'SIMULADO' };
    }
    let creados = 0;
    for (const p of pedidos) {
      try {
        await this.emitirParaPedido(p.id);
        creados++;
        await this.auditoria.registrar({
          categoria: 'CAMBIO',
          modulo: 'comprobantes',
          accion: 'BARRIDO_CREAR_COMPROBANTE',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: p.id,
          despues: { pedidoId: p.id.toString(), corte: corte.toISOString() },
        });
      } catch (e: any) {
        this.logger.error(`Barrido del pedido ${p.id}: ${e?.message ?? e}`);
      }
    }
    return { creados, encontrados: pedidos.length };
  }

  /** Fecha de corte de la facturación electrónica (parámetro facturacion_desde), o null si no está fijada. */
  async leerFechaCorteFacturacion(): Promise<Date | null> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_FECHA_CORTE } });
      const d = typeof p?.valor === 'string' ? new Date(p.valor) : null;
      return d && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  /** Datos de emisión de una fila (para anular o reenviar). Lanza BadRequest si un monto no sirve. */
  private async emisionDeFila(c: any): Promise<ComprobanteEmision> {
    const cfg = await this.leerConfigFacturacion();
    const direccion = c.pedido?.comprobante_direccion ?? null;
    let datos: DatosEmision;
    try {
      datos = await this.datosDeFila(c, cfg.igvPct, direccion);
    } catch {
      throw new BadRequestException({ codigo: 'COMPROBANTE_INVALIDO', mensaje: 'Los datos del comprobante no son válidos para anularlo' });
    }
    return { id: c.id, tipo: c.tipo, serie: c.serie, numero: c.numero, intentos: c.facturacion_intentos ?? 0, datos };
  }

  /**
   * Anula una BOLETA/FACTURA aceptada. Pide motivo. Nada se borra: guarda baja_estado, motivo y respuesta.
   * - Factura SUNAT: comunicación de baja (RA) con ticket, dentro de 7 días.
   * - Boleta SUNAT aceptada: entra al resumen diario como anulada (estado 3).
   * - Boleta SUNAT aún sin resumen: se anula sin enviar nada (SUNAT nunca la recibió).
   * - SUNAT: comunicación de baja. Sin respuesta: 503 y no se registra nada.
   * ponytail: notas de crédito y débito fuera de alcance; la boleta anulada espera la respuesta del resumen (no se reenvía sola).
   */
  async anularElectronico(
    idRaw: bigint | string | number,
    motivoRaw: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parsearId(idRaw, 'comprobante');
    const motivo = (motivoRaw || '').trim();
    if (motivo.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'El motivo es obligatorio y debe tener al menos 5 caracteres' });
    }
    const c = await this.prisma.comprobante.findUnique({
      where: { id },
      include: { pedido: { include: { lineas: true } } },
    });
    if (!c || (c.tipo !== 'BOLETA' && c.tipo !== 'FACTURA')) {
      throw new NotFoundException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' });
    }
    const proveedor = proveedorDeFila(c);
    const pendienteResumen = c.tipo === 'BOLETA' && c.facturacion_estado === 'PENDIENTE_RESUMEN' && proveedor === 'SUNAT';
    const emitida = c.facturacion_estado === 'EMITIDO_SUNAT';
    const bajaEnCurso = ['SOLICITADA', 'ACEPTADA', 'PENDIENTE_RESUMEN'].includes(c.baja_estado ?? '');
    if ((!emitida && !pendienteResumen) || bajaEnCurso) {
      throw new HttpException(
        { codigo: 'COMPROBANTE_NO_ANULABLE', mensaje: 'Solo se anula una boleta o factura aceptada y que no esté ya dada de baja' },
        HttpStatus.CONFLICT,
      );
    }

    let bajaEstado: 'SOLICITADA' | 'ACEPTADA' | 'RECHAZADA' | 'PENDIENTE_RESUMEN';
    let respuesta: string;
    let resumenId: bigint | null = null;
    try {
      if (pendienteResumen) {
        bajaEstado = 'ACEPTADA';
        respuesta = 'Anulada antes de reportarla a SUNAT: no se envió nada';
      } else if (c.simulado || proveedor === 'SIMULADO') {
        bajaEstado = 'ACEPTADA';
        respuesta = 'SIMULADO: baja de prueba, no enviada a SUNAT';
      } else {
        if (c.tipo === 'BOLETA') {
          bajaEstado = 'PENDIENTE_RESUMEN';
          respuesta = 'Se reporta en el resumen diario de SUNAT';
        } else {
          const dias = (Date.now() - new Date(c.creado_en).getTime()) / 86400000;
          if (dias > PLAZO_BAJA_FACTURA_DIAS) {
            throw new HttpException(
              { codigo: 'COMUNICACION_FUERA_PLAZO', mensaje: `La baja de una factura se comunica dentro de ${PLAZO_BAJA_FACTURA_DIAS} días` },
              HttpStatus.CONFLICT,
            );
          }
          const r: ResultadoBaja = await this.emisorPara('SUNAT').anular(await this.emisionDeFila(c), motivo);
          if (!r.resumen || !this.sunatResumen) throw new ErrorRedEmisor('SUNAT no está configurado en este servidor');
          const env = await this.sunatResumen.enviarBajaFactura(r.resumen.nombre, r.resumen.xml, r.resumen.zip);
          bajaEstado = env.estado;
          respuesta = env.respuesta;
          resumenId = env.resumenId;
        }
      }
    } catch (e) {
      if (e instanceof ErrorRedEmisor || e instanceof ErrorCredencialesEmisor) {
        throw new HttpException(
          { codigo: 'EMISOR_SIN_RESPUESTA', mensaje: 'El emisor electrónico no respondió: la baja no se registró, intenta de nuevo' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw e;
    }

    const ahora = new Date();
    const actualizado = await this.prisma.comprobante.update({
      where: { id },
      data: {
        baja_estado: bajaEstado,
        baja_motivo: motivo,
        baja_en: ahora,
        baja_respuesta: textoRespuesta(respuesta) || null,
        ...(resumenId ? { resumen_baja_id: resumenId } : {}),
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'ANULAR_ELECTRONICO',
      resultado: bajaEstado === 'RECHAZADA' ? 'RECHAZADO' : 'OK',
      entidad: 'comprobante',
      entidadId: c.id,
      motivo,
      antes: { baja_estado: c.baja_estado ?? null },
      despues: { numero_texto: c.numero_texto, emisor: proveedor, baja_estado: bajaEstado },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return this.serializarComprobante(actualizado);
  }

  /** Lista de BOLETA/FACTURA ya enviadas (aceptadas, rechazadas o pendientes), más recientes primero. */
  async listarElectronicos(pagina = 1, limite = 20, soloProblemas = false) {
    const where: any = soloProblemas
      ? condicionProblemas(new Date())
      : { tipo: { in: ['BOLETA', 'FACTURA'] }, facturacion_estado: { not: null } };
    const [total, filas] = await Promise.all([
      this.prisma.comprobante.count({ where }),
      this.prisma.comprobante.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { creado_en: 'desc' },
        include: { pedido: { select: { codigo: true, total: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      elementos: filas.map((c) => ({
        ...this.serializarComprobante(c),
        codigo_pedido: c.pedido.codigo,
        total: Number(c.pedido.total),
        numero_texto: c.numero_texto,
        fecha_lima: formatearFechaHoraLima(c.creado_en),
      })),
    };
  }

  /**
   * Construye el documento listo para impresión física o visualización de Nota de Venta.
   */
  private async construirDatosImpresion(pedido: any, comprobante: any, esCopia: boolean) {
    // Encabezado del local
    let datosLocal: any = null;
    if (this.localService) {
      datosLocal = await this.localService.obtenerDatosLocal();
    } else {
      const param = await this.prisma.parametro.findUnique({
        where: { clave: 'local_datos' },
      });
      datosLocal = param?.valor;
    }

    const localParam = datosLocal || {};
    // Nunca se imprimen datos de ejemplo: si falta razón social o RUC, el comprobante lo dice.
    const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const razonSocial = texto(localParam.razon_social) || texto(localParam.razonSocial);
    const rucLocal = texto(localParam.ruc);
    const faltan = [!razonSocial && 'razón social', !rucLocal && 'RUC'].filter(Boolean) as string[];
    const local = {
      nombre: localParam.nombre || 'Caprichos',
      razon_social: razonSocial || null,
      ruc: rucLocal || null,
      direccion: texto(localParam.direccion) || null,
      telefono: texto(localParam.telefono) || null,
      direccion_fiscal: texto(localParam.direccion_fiscal) || null,
      datos_fiscales_completos: faltan.length === 0,
      aviso_datos_fiscales: faltan.length
        ? `Falta ${faltan.join(' y ')} del local: complétalo en Configuración > Empresa`
        : null,
    };

    const fechaCobro = cobroVigente<any>(pedido.cobros)?.en ?? comprobante.creado_en ?? pedido.creado_en;
    const fechaLima = formatearFechaHoraLima(new Date(fechaCobro));

    // Detalle de productos con opciones y cantidades
    const detalle = (pedido.lineas || []).map((l: any) => ({
      id: l.id.toString(),
      nombre: l.nombre,
      cantidad: l.cantidad,
      tamano: l.tamano ?? null,
      sabor: l.sabor ?? null,
      precio_unit: Number(l.precio_unit),
      subtotal: Number(l.subtotal ?? (Number(l.precio_unit) * l.cantidad)),
      opciones: extraerOpciones(l),
      nota: l.nota ?? null,
    }));

    // Medios de pago y vuelto
    const cobro = cobroVigente<any>(pedido.cobros);
    const pagos = (cobro?.pagos || []).map((p: any) => ({
      id: p.id.toString(),
      medio: p.medio,
      monto: Number(p.monto),
      recibido: p.recibido !== null && p.recibido !== undefined ? Number(p.recibido) : null,
      vuelto: p.vuelto !== null && p.vuelto !== undefined ? Number(p.vuelto) : null,
    }));
    const totalVuelto = pagos.reduce((acc: number, p: any) => acc + (p.vuelto || 0), 0);

    const esBoletaOFactura = comprobante.tipo === 'BOLETA' || comprobante.tipo === 'FACTURA';
    const aceptadoSunat = comprobante.facturacion_estado === 'EMITIDO_SUNAT';
    const aviso = !esBoletaOFactura || aceptadoSunat
      ? null
      : comprobante.facturacion_estado === 'RECHAZADO'
        ? 'Rechazado por SUNAT: revisar en Comprobantes'
        : comprobante.facturacion_estado === 'PENDIENTE_ENVIO'
          ? 'Pendiente de envío a SUNAT'
          : 'Por emitir en el facturador';
    const representacion = aceptadoSunat
      ? `Representación impresa de la ${comprobante.tipo === 'FACTURA' ? 'Factura' : 'Boleta'} de venta electrónica`
      : null;

    const cliente = {
      nombre: pedido.cliente_nombre ?? null,
      documento: comprobante.documento ?? pedido.comprobante_doc ?? null,
      razon_social: comprobante.razon_social ?? pedido.comprobante_razon ?? null,
    };

    const numeroTexto = comprobante.numero_texto;
    const nombreDocumento = aceptadoSunat
      ? comprobante.tipo === 'FACTURA' ? 'Factura electrónica' : 'Boleta de venta electrónica'
      : 'Nota de venta';
    const tituloBase = `${nombreDocumento} ${numeroTexto}`;
    const titulo = esCopia ? `${tituloBase} - COPIA ${comprobante.copias_impresas}` : tituloBase;

    return {
      titulo,
      local,
      comprobante: {
        id: comprobante.id.toString(),
        pedido_id: comprobante.pedido_id.toString(),
        tipo: comprobante.tipo,
        serie: comprobante.serie,
        numero: comprobante.numero,
        numero_texto: comprobante.numero_texto,
        documento: comprobante.documento,
        razon_social: comprobante.razon_social,
        emision: comprobante.emision,
        copias_impresas: comprobante.copias_impresas,
        es_copia: esCopia,
        copia_numero: esCopia ? comprobante.copias_impresas : null,
        marca_copia: esCopia ? 'COPIA' : null,
        aviso,
        representacion,
        facturacion_estado: comprobante.facturacion_estado ?? null,
        hash: comprobante.facturacion_hash ?? null,
        cadena_qr: comprobante.facturacion_cadena_qr ?? null,
        enlace_pdf: comprobante.facturacion_enlace_pdf ?? null,
        simulado: comprobante.simulado ?? false,
      },
      pedido: {
        id: pedido.id.toString(),
        codigo: pedido.codigo,
        canal: pedido.canal,
        modalidad: pedido.modalidad,
        mesa_nombre: pedido.mesa_nombre ?? null,
      },
      cliente,
      cliente_nombre: cliente.nombre,
      cliente_documento: cliente.documento,
      fecha: fechaLima,
      fecha_iso: new Date(fechaCobro).toISOString(),
      detalle,
      items: detalle,
      subtotal: Number(pedido.subtotal),
      descuento: Number(pedido.descuento ?? 0),
      envio: Number(pedido.envio ?? 0),
      total: Number(pedido.total),
      pagos,
      pago_metodo: pedido.pago_metodo ?? (pagos.length > 1 ? 'MIXTO' : pagos[0]?.medio ?? 'EFECTIVO'),
      vuelto: totalVuelto,
      aviso,
      cupones: [],
      es_copia: esCopia,
      copia_numero: esCopia ? comprobante.copias_impresas : null,
      marca_copia: esCopia ? 'COPIA' : null,
    };
  }

  /**
   * Obtiene los datos para imprimir la nota de venta de un pedido cobrado.
   * Lanza 409 PEDIDO_SIN_COBRAR si el pedido no ha sido cobrado.
   */
  async obtenerPorPedido(
    pedidoIdRaw: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        cobros: {
          include: { pagos: true },
        },
        lineas: {
          include: { opcionesElegidas: true },
        },
        comprobante: { where: { anulado_en: null } },
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido no existe',
      });
    }

    // RN-CAP-037: Si el pedido aún no se cobró -> 409 PEDIDO_SIN_COBRAR
    if (pedido.pago_estado !== 'PAGADO' || !cobroVigente(pedido.cobros)) {
      throw new HttpException(
        {
          codigo: 'PEDIDO_SIN_COBRAR',
          mensaje: 'El pedido aún no ha sido cobrado',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Si por algún motivo aún no existe la fila comprobante (ej. cobro previo), emitirla
    let comprobante: Comprobante | null = pedido.comprobante[0] ?? null;
    if (!comprobante) {
      const emitido = await this.emitirParaPedido(pedido.id, undefined, usuario, ip);
      comprobante = await this.prisma.comprobante.findUnique({
        where: { id: BigInt(emitido.id) },
      });
    }

    // Auditar lectura de comprobante completo si es ADMIN
    if (usuario?.rol === 'ADMIN') {
      await this.auditoria.registrar({
        categoria: 'LECTURA_SENSIBLE',
        modulo: 'comprobantes',
        accion: 'VER_COMPROBANTE',
        resultado: 'OK',
        entidad: 'comprobante',
        entidadId: comprobante?.id,
        partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
        ip,
      });
    }

    return this.construirDatosImpresion(pedido, comprobante, false);
  }

  /**
   * Reimprime la nota de venta de un pedido cobrado.
   * Incrementa en 1 copias_impresas, audita REIMPRIMIR y devuelve los datos marcados «COPIA».
   */
  async reimprimirPorPedido(
    pedidoIdRaw: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        cobros: {
          include: { pagos: true },
        },
        lineas: {
          include: { opcionesElegidas: true },
        },
        comprobante: { where: { anulado_en: null } },
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido no existe',
      });
    }

    if (pedido.pago_estado !== 'PAGADO' || !cobroVigente(pedido.cobros)) {
      throw new HttpException(
        {
          codigo: 'PEDIDO_SIN_COBRAR',
          mensaje: 'El pedido aún no ha sido cobrado',
        },
        HttpStatus.CONFLICT,
      );
    }

    let comprobante: Comprobante | null = pedido.comprobante[0] ?? null;
    if (!comprobante) {
      const emitido = await this.emitirParaPedido(pedido.id, undefined, usuario, ip);
      comprobante = await this.prisma.comprobante.findUnique({
        where: { id: BigInt(emitido.id) },
      });
    }

    // Incrementar copias_impresas
    const comprobanteActualizado = await this.prisma.comprobante.update({
      where: { id: comprobante!.id },
      data: {
        copias_impresas: { increment: 1 },
      },
    });

    // Auditar reimpresión
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'REIMPRIMIR',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: comprobanteActualizado.id,
      despues: {
        pedidoId: pedido.id.toString(),
        copias_impresas: comprobanteActualizado.copias_impresas,
        numero_texto: comprobanteActualizado.numero_texto,
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    return this.construirDatosImpresion(pedido, comprobanteActualizado, true);
  }

  /**
   * Lista paginada de boletas y facturas con estado POR_EMITIR (más antiguas primero).
   * El documento (DNI o RUC) se enmascara en la lista salvo para el rol ADMIN.
   */
  async listarPorEmitir(
    dto: ListarPorEmitirDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pagina = Math.max(1, Number(dto.pagina) || 1);
    const limite = Math.max(1, Math.min(100, Number(dto.limite) || 20));
    const skip = (pagina - 1) * limite;

    const where = {
      tipo: { in: ['BOLETA', 'FACTURA'] },
      emision: 'POR_EMITIR',
    };

    const [total, comprobantes] = await Promise.all([
      this.prisma.comprobante.count({ where }),
      this.prisma.comprobante.findMany({
        where,
        skip,
        take: limite,
        orderBy: { creado_en: 'asc' }, // Más antiguas primero
        include: {
          pedido: {
            select: {
              id: true,
              codigo: true,
              total: true,
              creado_en: true,
            },
          },
        },
      }),
    ]);

    const esAdmin = usuario?.rol === 'ADMIN';

    // Auditar lectura de lista completa con DNI/RUC visibles solo si es ADMIN
    if (esAdmin) {
      await this.auditoria.registrar({
        categoria: 'LECTURA_SENSIBLE',
        modulo: 'comprobantes',
        accion: 'LISTAR_POR_EMITIR_ADMIN',
        resultado: 'OK',
        partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
        ip,
      });
    }

    const elementos = comprobantes.map((c) => ({
      id: c.id.toString(),
      pedido_id: c.pedido_id.toString(),
      codigo: c.pedido.codigo,
      codigo_pedido: c.pedido.codigo,
      tipo: c.tipo,
      serie: c.serie,
      numero: c.numero,
      numero_texto: c.numero_texto,
      documento: esAdmin ? c.documento : (c.documento ? enmascararDni(c.documento) : null),
      razon_social: c.razon_social,
      total: Number(c.pedido.total),
      fecha: c.creado_en,
      fecha_lima: formatearFechaHoraLima(c.creado_en),
      emision: c.emision,
      copias_impresas: c.copias_impresas,
    }));

    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      elementos,
    };
  }

  /**
   * Marca un comprobante como EMITIDO en el facturador externo.
   * Exige referencia externa (3 o más caracteres).
   * Un comprobante emitido no puede volver a POR_EMITIR.
   * Audita la acción y emite el evento 'comprobante:cambio'.
   */
  async marcarEmitido(
    idRaw: bigint | string | number,
    dto: MarcarEmitidoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const comprobanteId = this.parsearId(idRaw, 'comprobante');

    const ref = dto?.referenciaExterna?.trim();
    if (!ref || ref.length < 3) {
      throw new BadRequestException({
        codigo: 'REFERENCIA_REQUERIDA',
        mensaje: 'La referencia externa es obligatoria y debe tener al menos 3 caracteres',
      });
    }

    const comprobante = await this.prisma.comprobante.findUnique({
      where: { id: comprobanteId },
      include: { pedido: true },
    });

    if (!comprobante) {
      throw new NotFoundException({
        codigo: 'COMPROBANTE_NO_ENCONTRADO',
        mensaje: 'El comprobante no existe',
      });
    }

    if (comprobante.emision === 'EMITIDO') {
      throw new HttpException(
        {
          codigo: 'COMPROBANTE_YA_EMITIDO',
          mensaje: 'El comprobante ya fue emitido y no puede volver a emitirse',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Con envío pendiente, emitirlo a mano en el facturador duplicaría el comprobante al reenviarse
    if (comprobante.facturacion_estado === 'PENDIENTE_ENVIO' || comprobante.facturacion_estado === 'REVISION_MANUAL') {
      throw new HttpException(
        {
          codigo: 'COMPROBANTE_PENDIENTE_ENVIO',
          mensaje: 'Está pendiente de envío a SUNAT: reinténtelo desde Electrónicos SUNAT',
        },
        HttpStatus.CONFLICT,
      );
    }

    const ahora = new Date();
    const emitidoPor = usuario?.partyId ? BigInt(usuario.partyId) : null;

    const actualizado = await this.prisma.comprobante.update({
      where: { id: comprobanteId },
      data: {
        emision: 'EMITIDO',
        emitido_en: ahora,
        emitido_por: emitidoPor,
        referencia_externa: ref,
      },
      include: { pedido: true },
    });

    // Auditar
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'MARCAR_EMITIDO',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: comprobante.id,
      antes: {
        emision: comprobante.emision,
        referencia_externa: comprobante.referencia_externa,
      },
      despues: {
        emision: 'EMITIDO',
        referencia_externa: ref,
        emitido_en: ahora.toISOString(),
        emitido_por: emitidoPor ? emitidoPor.toString() : null,
      },
      partyId: emitidoPor ? emitidoPor : undefined,
      ip,
    });

    // Emitir WebSocket
    try {
      this.eventosGateway?.emitirAdmin?.('comprobante:cambio', {
        id: actualizado.id.toString(),
        pedido_id: actualizado.pedido_id.toString(),
        codigo_pedido: actualizado.pedido.codigo,
        tipo: actualizado.tipo,
        emision: 'EMITIDO',
        referenciaExterna: ref,
        emitido_en: ahora.toISOString(),
      });
    } catch {
      // Ignorar fallo de socket
    }

    return this.serializarComprobante(actualizado);
  }

  /** Configuración de facturación (IGV, series, proveedor) y su estado. Nunca muestra claves ni rutas. */
  async obtenerConfigFacturacion() {
    const cfg = await this.leerConfigFacturacion();
    const sunat = this.sunatEmisor;
    const vence = sunat?.certificadoVence() ?? null;
    const corte = await this.leerFechaCorteFacturacion();
    return {
      facturacion_desde: corte ? corte.toISOString() : null,
      igvPct: cfg.igvPct,
      serieBoleta: cfg.serieBoleta,
      serieFactura: cfg.serieFactura,
      proveedor: cfg.proveedor,
      proveedor_efectivo: this.proveedorEfectivo(cfg.proveedor),
      sunat: {
        ambiente: sunat ? sunat.config().ambiente : ambienteSunat(),
        credenciales: sunat?.disponible() ?? false,
        vence_certificado: vence ? vence.toISOString().slice(0, 10) : null,
      },
    };
  }

  /** Guarda IGV, series y proveedor (ADMIN, con Sí/No en la web). Audita el cambio; nada se borra. */
  async guardarConfigFacturacion(dto: ConfigFacturacionDto, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.leerConfigFacturacion();
    const nueva = interpretarConfig({
      [CLAVES_FACTURACION.igv]: dto.igvPct,
      [CLAVES_FACTURACION.serieBoleta]: dto.serieBoleta,
      [CLAVES_FACTURACION.serieFactura]: dto.serieFactura,
      [CLAVES_FACTURACION.proveedor]: dto.proveedor ?? antes.proveedor,
    });
    const valores: Array<[string, unknown]> = [
      [CLAVES_FACTURACION.igv, nueva.igvPct],
      [CLAVES_FACTURACION.serieBoleta, nueva.serieBoleta],
      [CLAVES_FACTURACION.serieFactura, nueva.serieFactura],
      [CLAVES_FACTURACION.proveedor, nueva.proveedor],
    ];
    for (const [clave, valor] of valores) {
      await this.prisma.parametro.upsert({ where: { clave }, update: { valor: valor as any }, create: { clave, valor: valor as any } });
    }
    // Primera vez que el selector pasa a SUNAT: se fija la fecha de corte. Los pedidos anteriores no se emiten nunca.
    let corteFijado: string | null = null;
    if (nueva.proveedor === 'SUNAT' && antes.proveedor !== 'SUNAT' && !(await this.leerFechaCorteFacturacion())) {
      corteFijado = new Date().toISOString();
      await this.prisma.parametro.upsert({
        where: { clave: CLAVE_FECHA_CORTE },
        update: { valor: corteFijado },
        create: { clave: CLAVE_FECHA_CORTE, valor: corteFijado },
      });
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'CONFIG_FACTURACION',
      resultado: 'OK',
      entidad: 'parametro',
      antes: { ...antes },
      despues: { ...nueva, ...(corteFijado ? { facturacion_desde: corteFijado } : {}) },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return this.obtenerConfigFacturacion();
  }
}
