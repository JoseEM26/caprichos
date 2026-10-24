import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

@Injectable()
export class ComprobantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly localService?: LocalService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

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
    };
  }

  /**
   * Emite el comprobante para un pedido cobrado.
   * - Es idempotente: si ya existe el comprobante para el pedido, lo devuelve.
   * - Crea la fila con su correlativo interno de la serie 'NV01' (UPDATE ... RETURNING atómico).
   * - Valida los documentos con comprobantes.util.ts.
   * - Si el documento es inválido, NO bloquea el cobro: lo deja con tipo NOTA_VENTA y lo reporta en la respuesta.
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
    const existente = await db.comprobante.findUnique({
      where: { pedido_id: pedidoId },
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

    const validacion = validarDocumentoComprobante(
      tipoSolicitado,
      docSolicitado,
      razonSolicitada,
    );

    let tipoFinal = tipoSolicitado;
    let emisionFinal: 'INTERNA' | 'POR_EMITIR' | 'EMITIDO' = 'INTERNA';
    let docFinal = docSolicitado;
    let razonFinal = razonSolicitada;
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

    // 4. Obtener correlativo atómico en secuencia_comprobante para serie 'NV01'
    const serie = 'NV01';
    let filas = await db.$queryRaw<{ ultimo_numero: number }[]>`
      UPDATE secuencia_comprobante
      SET ultimo_numero = ultimo_numero + 1
      WHERE serie = ${serie}
      RETURNING ultimo_numero;
    `;

    if (!filas || filas.length === 0) {
      filas = await db.$queryRaw<{ ultimo_numero: number }[]>`
        INSERT INTO secuencia_comprobante (serie, ultimo_numero)
        VALUES (${serie}, 1)
        ON CONFLICT (serie) DO UPDATE
        SET ultimo_numero = secuencia_comprobante.ultimo_numero + 1
        RETURNING ultimo_numero;
      `;
    }

    const numero = Number(filas[0].ultimo_numero);
    const numeroTexto = formatearCorrelativo(serie, numero);

    // 5. Crear fila de comprobante
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
    });

    return {
      ...this.serializarComprobante(nuevo),
      advertencia,
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
    const local = {
      nombre: localParam.nombre || 'Caprichos',
      razon_social: localParam.razon_social || localParam.razonSocial || 'Caprichos S.A.C.',
      ruc: localParam.ruc || '20123456789',
      direccion: localParam.direccion || 'Av. Principal 123',
      telefono: localParam.telefono || '999999999',
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
    const aviso = esBoletaOFactura ? 'Por emitir en el facturador' : null;

    const cliente = {
      nombre: pedido.cliente_nombre ?? null,
      documento: comprobante.documento ?? pedido.comprobante_doc ?? null,
      razon_social: comprobante.razon_social ?? pedido.comprobante_razon ?? null,
    };

    const numeroTexto = comprobante.numero_texto;
    const tituloBase = `Nota de venta ${numeroTexto}`;
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
        comprobante: true,
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
    let comprobante = pedido.comprobante;
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
        comprobante: true,
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

    let comprobante = pedido.comprobante;
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
}
