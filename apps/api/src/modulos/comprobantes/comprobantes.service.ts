import {
  BadRequestException,
  ConflictException,
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
  esComprobanteElegible,
  validarDocumentoComprobante,
} from './comprobantes.util';
import { MarcarEmitidoDto } from './dto/marcar-emitido.dto';
import { ListarPorEmitirDto } from './dto/listar-por-emitir.dto';
import { coincideTexto } from '../../comun/normalizar-busqueda';
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
import { LEASE_ENVIO_MS, MAX_INTENTOS_DEFECTO, TEXTO_REGISTRADA_SIN_CDR, esRechazoPermanente, esperaFacturacionMs } from './comprobantes-politica';
import { siguienteCorrelativo } from './secuencia';
import { armarDatosPdf } from './pdf/comprobante-datos';
import { generarPdfComprobante } from './pdf/comprobante-pdf';
import { leerParametroNumerico } from '../impresion/estado-impresion';
import { lineasParaComprobante } from '../pedidos/lineas-combo.util';
import { descuentoParaComprobante } from '../../comun/total-pedido';

/** Plazo de la comunicación de baja de una factura en SUNAT (días). */
export const PLAZO_BAJA_FACTURA_DIAS = 7;

/** Estados desde los que una boleta/factura puede enviarse (o reenviarse). */
const ESTADOS_ENVIABLES = ['PENDIENTE_ENVIO', 'RECHAZADO', 'REVISION_MANUAL'];
const TIPOS_ELECTRONICOS = ['BOLETA', 'FACTURA'];

/** Parámetro con la fecha de corte de la facturación electrónica (ISO). Antes de ella, el barrido no toca nada. */
export const CLAVE_FECHA_CORTE = 'facturacion_desde';
/** El barrido solo recupera cobros de las últimas 48 h (además del corte). */
export const VENTANA_BARRIDO_MS = 48 * 60 * 60 * 1000;


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

  /**
   * Aviso de «factura aceptada por SUNAT» (lo registra FacturaWhatsappService al iniciar). Se llama una vez por transición
   * y no debe lanzar ni esperar: el envío por WhatsApp nunca retrasa ni cambia la emisión.
   */
  alAceptarFactura: ((comprobanteId: bigint) => void) | null = null;

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
      lineas: lineasParaComprobante(pedido.lineas || []).map((l: any) => ({
        nombre: l.nombre,
        cantidad: Number(l.cantidad) || 1,
        subtotalCents: aCentimos(Number(l.subtotal ?? Number(l.precio_unit) * (Number(l.cantidad) || 1))),
      })),
      envioCents: aCentimos(Number(pedido.envio ?? 0)),
      descuentoCents: aCentimos(descuentoParaComprobante(pedido)),
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
    const { c, datos, contenido } = await this.generarPdf(idRaw, usuario?.rol === 'ADMIN');
    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'comprobantes',
      accion: 'VER_PDF_ELECTRONICO',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: c.id,
      despues: { tipo: c.tipo, numero_texto: c.numero_texto, situacion: datos.situacion },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return { nombre: `${c.numero_texto}.pdf`, contenido };
  }

  /**
   * PDF de una factura para enviarlo al propio cliente por WhatsApp: su RUC completo (es su documento) y sin auditar
   * una «lectura» de persona (el envío audita aparte). Se genera una vez por envío.
   */
  async pdfParaEnvio(idRaw: bigint | string | number): Promise<{ nombre: string; contenido: Buffer }> {
    const { c, contenido } = await this.generarPdf(idRaw, true);
    return { nombre: `${c.numero_texto}.pdf`, contenido };
  }

  private async generarPdf(idRaw: bigint | string | number, esAdmin: boolean) {
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
      esAdmin,
      ambiente: this.sunatEmisor?.config().ambiente ?? ambienteSunat(),
    });
    const contenido = await generarPdfComprobante(datos);
    return { c, datos, contenido };
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
   * - SIMPLE (ticket interno): no emite nada y devuelve null.
   * - BOLETA o FACTURA: serie B002/F002 (parámetros) y se envían a SUNAT.
   * - Sin tipo válido o con documento inválido, falla: nunca sale como nota de venta.
   * - Con tx (transacción externa) no hace red: la boleta/factura queda PENDIENTE_ENVIO y la tarea la envía.
   */
  async emitirParaPedido(
    pedidoIdRaw: bigint | string | number,
    tx?: Prisma.TransactionClient | any,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<any> {
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

    // 3. Comprobante simple: ticket interno, no se emite nada ni se envía a SUNAT
    if (pedido.comprobante_tipo === 'SIMPLE') return null;
    // Boleta o factura; el documento se valida (la nota de venta ya no es comprobante)
    if (!esComprobanteElegible(pedido.comprobante_tipo)) {
      throw new BadRequestException({
        codigo: 'COMPROBANTE_OBLIGATORIO',
        mensaje: 'Elige comprobante simple, boleta o factura antes de emitir el comprobante',
      });
    }
    const tipoFinal = pedido.comprobante_tipo;
    const docFinal = pedido.comprobante_doc?.trim() || null;
    const razonFinal = pedido.comprobante_razon?.trim() || null;
    const direccionSolicitada = pedido.comprobante_direccion?.trim() || null;
    const validacion = validarDocumentoComprobante(tipoFinal, docFinal, razonFinal, Number(pedido.total));
    if (!validacion.valido) {
      throw new BadRequestException({ codigo: 'COMPROBANTE_DATOS_FALTANTES', mensaje: validacion.motivo });
    }
    const emisionFinal = 'POR_EMITIR' as const;
    const advertencia: string | null = null;

    // 4. Serie y correlativo propio de la serie (atómico)
    const cfg = await this.leerConfigFacturacion(db);
    const proveedor: Proveedor = this.proveedorEfectivo(cfg.proveedor);
    const serie = tipoFinal === 'BOLETA' ? cfg.serieBoleta : cfg.serieFactura;
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
        facturacion_estado: 'PENDIENTE_ENVIO',
        emisor: proveedor,
        simulado: proveedor === 'SIMULADO',
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
    opciones: { direccion?: string | null; usuario?: UsuarioAutenticado; ip?: string; automatico?: boolean; interactivo?: boolean; corregido?: boolean } = {},
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
    opciones: { direccion?: string | null; usuario?: UsuarioAutenticado; ip?: string; interactivo?: boolean; corregido?: boolean; automatico?: boolean },
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
    // Tope duro del envío automático: si un guardado anterior falló, la fila sigue PENDIENTE_ENVIO con intentos >= máximo.
    // No se vuelve a llamar a SUNAT: solo se intenta dejarla en REVISION_MANUAL (un click manual sí envía, una vez).
    if (opciones.automatico && proveedor !== 'SIMULADO' && c.facturacion_estado === 'PENDIENTE_ENVIO' && intentosPrevios >= maxIntentos) {
      const respuesta = c.facturacion_respuesta ?? 'Sin respuesta de SUNAT';
      return this.guardarSeguro(
        c,
        { estado: 'PENDIENTE_ENVIO', respuesta, simulado: false },
        opciones,
        { estado: 'REVISION_MANUAL', revisionMotivo: `Sin respuesta de SUNAT tras ${intentosPrevios} intentos: ${respuesta}`, proximoIntentoEn: null },
        intentosPrevios,
      );
    }
    let res: ResultadoEmision;
    try {
      // Un intento previo sin respuesta, o una factura ya firmada en el cobro: se reenvía el ZIP guardado tal cual
      // (mismo documento, mismo número, mismo hash). Nunca se vuelve a firmar algo ya firmado.
      const yaFirmada = intentosPrevios > 0 || !!c.facturacion_hash;
      // Un RECHAZADO por 0133 (falla interna de SUNAT) sin correcciones también reenvía el mismo ZIP: SUNAT nunca lo procesó
      // REVISION_MANUAL por "Rechazo permanente" (SUNAT rechazó con 2xxx/3xxx): el ZIP guardado tiene el defecto, reenviarlo
      // fallaría siempre. Se regenera y se vuelve a firmar con el mismo número y fecha (SUNAT no registra esos rechazos).
      const rechazoDeSunat = /^Rechazo permanente/.test(c.revision_motivo ?? '');
      const reenviaTalCual = c.facturacion_estado === 'PENDIENTE_ENVIO' || (c.facturacion_estado === 'REVISION_MANUAL' && !opciones.corregido && !rechazoDeSunat) || (c.facturacion_estado === 'RECHAZADO' && !opciones.corregido && /\b0133\b/.test(c.facturacion_respuesta ?? ''));
      const zipPrevio = reenviaTalCual && yaFirmada ? await this.ultimoArchivo(c.id, 'ZIP') : null;
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

    // Consulta previa que falló: se reenvió el mismo ZIP; se audita una sola vez por comprobante
    if (res.consultaCdrFallo) await this.auditarConsultaFallo(c, opciones);

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
    return this.guardarSeguro(c, res, opciones, { estado, revisionMotivo, proximoIntentoEn }, intentosTras);
  }

  /**
   * guardarResultado con red de seguridad: si el guardado falla (p. ej. un CHECK de la base), SUNAT ya fue llamada y el
   * intento ya se contó. Se aparta la fila con la espera normal y se suelta el lease, con un UPDATE mínimo que no toca
   * el estado, para que el barrido no la vuelva a enviar en cada pasada. El error original se relanza.
   */
  private async guardarSeguro(
    c: any,
    res: ResultadoEmision,
    opciones: { usuario?: UsuarioAutenticado; ip?: string },
    extra: { estado?: string; revisionMotivo?: string | null; proximoIntentoEn?: Date | null },
    intentos: number,
  ) {
    try {
      return await this.guardarResultado(c, res, opciones, extra);
    } catch (e: any) {
      this.logger.error(`Guardado del resultado del comprobante ${c.id} (${extra.estado ?? res.estado}): ${e?.message ?? e}`);
      await this.prisma.comprobante
        .update({
          where: { id: c.id },
          data: { enviando_hasta: null, proximo_intento_en: new Date(Date.now() + esperaFacturacionMs(intentos)), facturacion_respuesta: textoRespuesta(res.respuesta || 'Sin detalle de SUNAT') },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  /** Una sola vez por comprobante: la consulta getStatusCdr falló y se reenvió el mismo ZIP. */
  private async auditarConsultaFallo(c: any, opciones: { usuario?: UsuarioAutenticado; ip?: string }): Promise<void> {
    const previas = await this.prisma.auditoria.count({ where: { accion: 'CONSULTA_CDR_FALLO', entidad: 'comprobante', entidad_id: c.id } });
    if (previas > 0) return;
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'CONSULTA_CDR_FALLO',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: c.id,
      despues: { numero_texto: c.numero_texto, accion: 'La consulta a SUNAT falló: se reenvió el mismo ZIP (SUNAT no admite dos veces el mismo número)' },
      partyId: opciones.usuario?.partyId ? BigInt(opciones.usuario.partyId) : undefined,
      ip: opciones.ip,
    });
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

    // Factura aceptada por SUNAT con su CDR (no simulada): el WhatsApp al cliente sale aparte, sin esperar ni afectar la emisión
    if (aceptado && c.tipo === 'FACTURA' && !data.simulado && !res.yaRegistrado) {
      try {
        this.alAceptarFactura?.(c.id);
      } catch (e: any) {
        this.logger.warn(`Aviso de factura aceptada no entregado: ${e?.message ?? e}`);
      }
    }

    if (estado === 'RECHAZADO' || estado === 'REVISION_MANUAL') {
      await this.salud?.avisar({
        clave: `comprobante:${c.id}:${estado}:${actualizado.facturacion_intentos}`,
        titulo: `${c.numero_texto} ${estado === 'RECHAZADO' ? 'rechazado por SUNAT' : 'pasó a revisión manual'}`,
        mensaje: extra.revisionMotivo ?? respuesta.slice(0, 300),
        prioridad: 'alta',
        enlace: '/admin/comprobantes',
      });
    }
    if (res.yaRegistrado) {
      await this.salud?.avisar({
        clave: `registrada-previa:${c.id}`,
        titulo: `${c.numero_texto} registrada previamente en SUNAT`,
        mensaje:
          `SUNAT respondió «registrado previamente» y no entregó su constancia (CDR). Podría tener un documento DISTINTO con esa serie-número ` +
          `(«con otros datos»). No se reenvió. Antes de seguir, compárelo en SOL (Consultar Envío de Comprobante de Pago Electrónicos) con ` +
          `hash ${res.hash ?? 'sin hash'}, total S/ ${((res.totalCents ?? 0) / 100).toFixed(2)} y fecha de emisión ${new Date(c.creado_en).toISOString().slice(0, 10)}. ` +
          `El sistema seguirá pidiendo la constancia en las próximas pasadas.`,
        prioridad: 'media',
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
    try {
      return await this.reintentarElectronicoInterno(idRaw, correccion, usuario, ip);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      // Error inesperado: se registra completo y la pantalla recibe un motivo legible en vez de un 500 sin cuerpo
      this.logger.error(`Reintento del comprobante ${String(idRaw)}: ${e?.stack ?? e?.message ?? e}`);
      const motivo = String(e?.message ?? 'error interno').split('\n')[0].slice(0, 120);
      throw new HttpException(
        { codigo: 'REENVIO_FALLIDO', mensaje: `No pudimos reenviar a SUNAT: ${motivo}; reintenta en unos minutos` },
        // 500 y no 502: los proxies de borde reemplazan el cuerpo de un 502/504 por su página y la pantalla perdía el mensaje
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async reintentarElectronicoInterno(
    idRaw: bigint | string | number,
    correccion: { documento?: string | null; razon?: string | null; direccion?: string | null },
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
    const enviado = await this.enviarElectronico(id, { direccion: correccion.direccion ?? undefined, usuario, ip, interactivo: true, corregido: Object.keys(cambios).length > 0 || correccion.direccion !== undefined });
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
        // el anulado sin haber salido no se envía; si ya hubo intento (SUNAT pudo recibirlo) sale para poder darlo de baja
        AND: [
          { OR: [{ proximo_intento_en: null }, { proximo_intento_en: { lte: ahora } }] },
          { OR: [{ anulado_en: null }, { facturacion_intentos: { gt: 0 } }] },
        ],
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
    await this.reintentarBajasPendientes();
    await this.recuperarConstancias();
    return { revisados: pendientes.length };
  }

  /**
   * Facturas que SUNAT ya tenía (1033) sin su CDR: en cada pasada se pide la constancia con getStatusCdr.
   * Sin CDR no cambia nada (queda el aviso). Solo las de los últimos 7 días: ceiling de llamadas a SUNAT.
   * ponytail: si hiciera falta más, pasar a un contador de intentos por comprobante.
   */
  private async recuperarConstancias(): Promise<void> {
    if (!this.sunatEmisor) return;
    try {
      const filas = await this.prisma.comprobante.findMany({
        where: {
          tipo: 'FACTURA',
          facturacion_estado: 'EMITIDO_SUNAT',
          facturacion_respuesta: TEXTO_REGISTRADA_SIN_CDR,
          emitido_en: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { creado_en: 'asc' },
        take: 5,
      });
      for (const f of filas) {
        try {
          const r = await this.sunatEmisor.consultar({ tipo: 'FACTURA', serie: f.serie, numero: f.numero, timeoutMs: TIMEOUT_SUNAT_MS });
          if (!r) continue;
          await this.guardarArchivos(f.id, r.archivos ?? []);
          const respuesta = textoRespuesta(r.respuesta);
          if (r.estado === 'RECHAZADO') {
            // La constancia dice que SUNAT rechaza lo que tiene registrado: no es una emisión válida, cola de fallos
            const ahora = new Date();
            await this.prisma.comprobante.update({
              where: { id: f.id },
              data: { facturacion_estado: 'REVISION_MANUAL', emision: 'POR_EMITIR', facturacion_respuesta: respuesta, revision_motivo: respuesta, revision_en: ahora },
            });
            await this.auditoria.registrar({
              categoria: 'CAMBIO',
              modulo: 'comprobantes',
              accion: 'CDR_RECHAZADA_EN_RECUPERACION',
              resultado: 'RECHAZADO',
              entidad: 'comprobante',
              entidadId: f.id,
              antes: { estado: f.facturacion_estado ?? null },
              despues: { numero_texto: f.numero_texto, estado: 'REVISION_MANUAL', respuesta: respuesta.slice(0, 300) },
            });
            await this.salud?.avisar({
              clave: `cdr-rechazada:${f.id}`,
              titulo: `${f.numero_texto} rechazada por SUNAT al recuperar su constancia`,
              mensaje: `SUNAT rechazó el comprobante en su constancia (CDR): ${respuesta}`,
              prioridad: 'alta',
              enlace: '/admin/comprobantes',
            });
            continue;
          }
          await this.prisma.comprobante.update({ where: { id: f.id }, data: { facturacion_respuesta: respuesta } });
          await this.auditoria.registrar({
            categoria: 'CAMBIO',
            modulo: 'comprobantes',
            accion: 'CONSTANCIA_RECUPERADA',
            resultado: 'OK',
            entidad: 'comprobante',
            entidadId: f.id,
            despues: { numero_texto: f.numero_texto, respuesta: respuesta.slice(0, 300) },
          });
        } catch (e: any) {
          // Sin constancia por ahora (SUNAT no responde o falla la consulta): se reintenta en la próxima pasada
          this.logger.warn(`Constancia del comprobante ${f.id} aún no recuperada: ${e?.message ?? e}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`Recuperación de constancias: ${e?.message ?? e}`);
    }
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

  /**
   * «Emitir real»: reemplaza una boleta/factura SIMULADA (nunca salió a SUNAT) por un comprobante nuevo del mismo pedido.
   * Una sola transacción: baja simulada (sin red) de la fila vieja + comprobante nuevo con la siguiente numeración de la
   * serie (el índice único es parcial sobre anulado_en IS NULL, por eso primero se anula la vieja). El envío a SUNAT
   * va después, por el camino normal (boleta: resumen diario; factura: sendBill). Fecha de emisión: hoy.
   * El barrido no duplica: pide pedidos sin comprobante vigente y el nuevo ya existe al confirmar.
   */
  async emitirReal(idRaw: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const id = this.parsearId(idRaw, 'comprobante');
    const c = await this.prisma.comprobante.findUnique({ where: { id } });
    if (!c || !TIPOS_ELECTRONICOS.includes(c.tipo)) {
      throw new NotFoundException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' });
    }
    if (c.anulado_en) {
      throw new HttpException({ codigo: 'COMPROBANTE_ANULADO', mensaje: 'El comprobante ya está anulado' }, HttpStatus.CONFLICT);
    }
    if (!c.simulado) {
      throw new HttpException({ codigo: 'COMPROBANTE_YA_REAL', mensaje: 'Solo se reemite un comprobante marcado como Simulado' }, HttpStatus.CONFLICT);
    }
    const cfg = await this.leerConfigFacturacion();
    if (this.proveedorEfectivo(cfg.proveedor) !== 'SUNAT') {
      throw new HttpException(
        { codigo: 'PROVEEDOR_NO_SUNAT', mensaje: 'Cambia el proveedor a SUNAT en Facturación primero' },
        HttpStatus.CONFLICT,
      );
    }
    const motivo = 'Reemitido como comprobante real';
    const partyId = usuario?.partyId ? BigInt(usuario.partyId) : undefined;
    const nuevo = await this.prisma.$transaction(async (tx: any) => {
      // Reclamo atómico: dos clics a la vez no reemiten dos veces
      const baja = await tx.comprobante.updateMany({
        where: { id, anulado_en: null, simulado: true },
        data: {
          anulado_en: new Date(),
          anulado_motivo: motivo,
          baja_estado: 'ACEPTADA',
          baja_motivo: motivo,
          baja_en: new Date(),
          baja_respuesta: 'SIMULADO: baja de prueba, no enviada a SUNAT',
        },
      });
      if (baja.count === 0) {
        throw new HttpException({ codigo: 'COMPROBANTE_ANULADO', mensaje: 'El comprobante ya fue reemitido o anulado' }, HttpStatus.CONFLICT);
      }
      const creado: any = await this.emitirParaPedido(c.pedido_id, tx, usuario, ip);
      // Conserva lo corregido en la fila simulada (la emisión toma los datos del pedido)
      const fila = await tx.comprobante.update({
        where: { id: BigInt(creado.id) },
        data: { documento: c.documento, razon_social: c.razon_social },
      });
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'comprobantes',
        accion: 'EMITIR_REAL',
        resultado: 'OK',
        entidad: 'comprobante',
        entidadId: fila.id,
        motivo,
        antes: { comprobante_origen: c.numero_texto, comprobante_origen_id: c.id.toString(), simulado: true },
        despues: { comprobante_nuevo: fila.numero_texto, comprobante_nuevo_id: fila.id.toString(), tipo: fila.tipo, emisor: fila.emisor },
        partyId,
        ip,
      }, tx);
      return fila;
    });
    let enviado: any = nuevo;
    try {
      enviado = await this.enviarElectronico(nuevo.id, { usuario, ip, interactivo: true });
    } catch (e: any) {
      // El comprobante nuevo ya existe PENDIENTE_ENVIO: la tarea de reintentos lo envía
      this.logger.warn(`Emitir real ${nuevo.numero_texto}: envío diferido (${e?.message ?? e})`);
    }
    return this.serializarComprobante(enviado);
  }

  /**
   * Baja de la boleta/factura vigente de un pedido cuyo cobro se anula (o cuyo pedido se anula). NUNCA lanza:
   * la anulación del cobro no depende de SUNAT.
   * - Nunca salió a SUNAT (pendiente sin intentos o rechazada): se anula aquí y no se envía.
   * - Ya aceptada o reportada: comunicación de baja; si SUNAT no responde queda baja_estado PENDIENTE_BAJA y
   *   el barrido de reintentos la repite (reintentarBajasPendientes).
   * En todos los casos el comprobante queda con anulado_en: un nuevo cobro emite otro, nunca reutiliza este.
   */
  async darDeBajaPorAnulacion(
    pedidoIdRaw: bigint | string | number,
    motivoRaw: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ comprobante: string; estado: string } | null> {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');
    const c = await this.prisma.comprobante.findFirst({
      where: { pedido_id: pedidoId, anulado_en: null, tipo: { in: TIPOS_ELECTRONICOS } },
    });
    if (!c) return null;
    const motivo = (motivoRaw || '').trim().length >= 5 ? motivoRaw.trim() : 'Cobro anulado en caja';
    const sinSalir = c.facturacion_estado === 'RECHAZADO' || (c.facturacion_estado === 'PENDIENTE_ENVIO' && !((c.facturacion_intentos ?? 0) > 0));
    let estado: string;
    if (sinSalir) {
      estado = 'ANULADO_SIN_ENVIAR';
    } else {
      try {
        const r = await this.anularElectronico(c.id, motivo, usuario, ip);
        estado = r.baja_estado ?? 'ACEPTADA';
      } catch (e: any) {
        estado = 'PENDIENTE_BAJA';
        this.logger.warn(`Baja del comprobante ${c.id} pendiente: ${e?.message ?? e}`);
        await this.prisma.comprobante
          .update({ where: { id: c.id }, data: { baja_estado: estado, baja_motivo: motivo, baja_en: new Date() } })
          .catch(() => undefined);
      }
    }
    const ahora = new Date();
    await this.prisma.comprobante.update({ where: { id: c.id }, data: { anulado_en: ahora, anulado_motivo: motivo } });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'BAJA_POR_ANULACION',
      resultado: 'OK',
      entidad: 'comprobante',
      entidadId: c.id,
      motivo,
      antes: { facturacion_estado: c.facturacion_estado, baja_estado: c.baja_estado ?? null },
      despues: { numero_texto: c.numero_texto, estado },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return { comprobante: c.numero_texto, estado };
  }

  /** Repite las bajas que SUNAT no recibió (PENDIENTE_BAJA). Una pasada del barrido; nunca lanza. */
  async reintentarBajasPendientes(): Promise<number> {
    const filas = await this.prisma.comprobante.findMany({
      where: { baja_estado: 'PENDIENTE_BAJA', facturacion_estado: { in: ['EMITIDO_SUNAT', 'PENDIENTE_RESUMEN'] } },
      orderBy: { baja_en: 'asc' },
      take: 10,
      select: { id: true, baja_motivo: true },
    });
    for (const f of filas) {
      try {
        await this.anularElectronico(f.id, f.baja_motivo ?? 'Cobro anulado en caja');
      } catch (e: any) {
        this.logger.warn(`Reintento de baja del comprobante ${f.id}: ${e?.message ?? e}`);
      }
    }
    return filas.length;
  }

  /** Estado del envío por WhatsApp de cada factura (solo FACTURA); sin la tabla o con error de lectura, nada (la pantalla sigue). */
  private async enviosWhatsapp(filas: Array<{ id: bigint; tipo: string }>): Promise<Map<string, any>> {
    const ids = filas.filter((f) => f.tipo === 'FACTURA').map((f) => f.id);
    const mapa = new Map<string, any>();
    if (ids.length === 0) return mapa;
    try {
      const envios = await (this.prisma as any).facturaWhatsappEnvio?.findMany({ where: { comprobante_id: { in: ids } } });
      for (const e of envios ?? []) {
        mapa.set(e.comprobante_id.toString(), { estado: e.estado, via: e.via ?? null, enviado_en: e.enviado_en ?? null, intentos: e.intentos, detalle: e.detalle ?? null });
      }
    } catch (e: any) {
      this.logger.warn(`No se pudo leer el envío de facturas por WhatsApp: ${e?.message ?? e}`);
    }
    return mapa;
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
    const envios = await this.enviosWhatsapp(filas);
    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      elementos: filas.map((c) => ({
        ...this.serializarComprobante(c),
        envio_whatsapp: envios.get(c.id.toString()) ?? null,
        codigo_pedido: c.pedido.codigo,
        total: Number(c.pedido.total),
        numero_texto: c.numero_texto,
        fecha_lima: formatearFechaHoraLima(c.creado_en),
      })),
    };
  }

  /**
   * Comprobantes de un pedido y de sus pedidos extra, solo lectura (no emite nada): vigentes primero, luego los anulados.
   * DNI/RUC enmascarado salvo para ADMIN. Dice si hay XML y CDR guardados, sin leer su contenido.
   */
  async listarPorPedido(pedidoIdRaw: bigint | string | number, usuario?: UsuarioAutenticado) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido');
    const pedidos = await this.prisma.pedido.findMany({
      where: { OR: [{ id: pedidoId }, { pedido_origen_id: pedidoId }] },
      select: { id: true, codigo: true, total: true },
    });
    const porId = new Map<string, { codigo: string; total: number }>(pedidos.map((p: any) => [p.id.toString(), { codigo: p.codigo, total: Number(p.total) }]));
    const ids = pedidos.map((p: any) => p.id);
    if (ids.length === 0) return { elementos: [] };
    const filas = await this.prisma.comprobante.findMany({ where: { pedido_id: { in: ids } } });
    const archivos = filas.length
      ? await this.prisma.comprobanteArchivo.findMany({ where: { comprobante_id: { in: filas.map((c: any) => c.id) } }, select: { comprobante_id: true, tipo: true } })
      : [];
    const esAdmin = usuario?.rol === 'ADMIN';
    const envios = await this.enviosWhatsapp(filas);
    const tiene = (id: bigint, tipo: string) => archivos.some((a: any) => a.comprobante_id === id && a.tipo === tipo);
    const orden = (c: any) => new Date(c.creado_en).getTime();
    const elementos = [...filas]
      .sort((a: any, b: any) => (a.anulado_en ? 1 : 0) - (b.anulado_en ? 1 : 0) || orden(b) - orden(a))
      .map((c: any) => {
        const ped = porId.get(c.pedido_id.toString());
        return {
          ...this.serializarComprobante(c),
          envio_whatsapp: envios.get(c.id.toString()) ?? null,
          documento: esAdmin ? c.documento ?? null : c.documento ? enmascararDni(c.documento) : null,
          anulado_en: c.anulado_en ?? null,
          anulado_motivo: c.anulado_motivo ?? null,
          codigo_pedido: ped?.codigo ?? null,
          total: ped?.total ?? 0,
          fecha_lima: formatearFechaHoraLima(c.creado_en),
          tiene_xml: tiene(c.id, 'XML'),
          tiene_cdr: tiene(c.id, 'CDR'),
        };
      });
    return { elementos };
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
    const detalle = lineasParaComprobante(pedido.lineas || []).map((l: any) => ({
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
      if (!emitido) {
        throw new ConflictException({
          codigo: 'COMPROBANTE_SIMPLE',
          mensaje: 'Este pedido es con comprobante simple: no tiene boleta ni factura. Usa el ticket del pedido.',
        });
      }
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
      if (!emitido) {
        throw new ConflictException({
          codigo: 'COMPROBANTE_SIMPLE',
          mensaje: 'Este pedido es con comprobante simple: no tiene boleta ni factura. Usa el ticket del pedido.',
        });
      }
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
      tipo: dto.tipo ? dto.tipo : { in: ['BOLETA', 'FACTURA'] },
      emision: 'POR_EMITIR',
    };
    const incluir = {
      pedido: { select: { id: true, codigo: true, total: true, creado_en: true } },
    };
    const buscar = dto.buscar?.trim() ?? '';

    let total: number;
    let comprobantes;
    if (buscar) {
      // La cola por emitir es corta: se busca en memoria (sin tildes) y luego se pagina con el total real.
      const todos = await this.prisma.comprobante.findMany({
        where,
        orderBy: { creado_en: 'asc' },
        include: incluir,
      });
      const coinciden = todos.filter((c) =>
        coincideTexto(buscar, c.numero_texto, c.pedido.codigo, c.documento, c.razon_social),
      );
      total = coinciden.length;
      comprobantes = coinciden.slice(skip, skip + limite);
    } else {
      [total, comprobantes] = await Promise.all([
        this.prisma.comprobante.count({ where }),
        this.prisma.comprobante.findMany({
          where,
          skip,
          take: limite,
          orderBy: { creado_en: 'asc' }, // Más antiguas primero
          include: incluir,
        }),
      ]);
    }

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
