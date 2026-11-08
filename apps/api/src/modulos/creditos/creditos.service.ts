import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { cobroVigente } from '../caja/caja.calculo';
import { FiltrarCreditosDto } from './dto/filtrar-creditos.dto';
import { StockService } from '../stock/stock.service';
import { ImpresionService } from '../impresion/impresion.service';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';
import { fechaLima, planDescuentoPersonalDePedido, validarColaborador } from './descuento-personal';

const NOMBRES_MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Descuento del personal que lleva el pedido: el de su detalle o, en pedidos viejos, el descuento total. */
function descuentoPersonalDe(pedido: any): number {
  const d = Array.isArray(pedido?.descuento_detalle) ? pedido.descuento_detalle.find((x: any) => x?.tipo === 'PERSONAL') : null;
  return Number(d?.montoDescontado ?? pedido?.descuento ?? 0);
}

/** Medianoche UTC del día de calendario (así se guarda y se compara una columna DATE). */
const diaUtc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const ddmm = (dt: Date) => `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;

export interface RangoFechas {
  inicio: Date;
  fin: Date;
  etiqueta: string;
  navegable: boolean;
}

@Injectable()
export class CreditosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly impresion?: ImpresionService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  /**
   * Obtiene el porcentaje de descuento del personal configurado en el local (25% por defecto).
   */
  async obtenerPorcentajeDescuento(): Promise<number> {
    try {
      const param = await this.prisma.parametro.findUnique({
        where: { clave: 'descuento_personal_pct' },
      });
      if (param && typeof param.valor === 'number') {
        return param.valor;
      }
    } catch {
      // Valor por defecto si no existe
    }
    return 25;
  }

  /**
   * Semana de lunes a domingo (calendario de Lima). Las fechas son medianoche UTC del día: así se comparan
   * contra la columna DATE sin que la zona del servidor cambie la semana.
   */
  calcularRangoSemana(offsetSemanas: number = 0, ahora: Date = new Date()): RangoFechas {
    const h = fechaLima(ahora);
    const hoy = diaUtc(h.y, h.m, h.d);
    const dia = hoy.getUTCDay(); // 0 = Domingo
    const lunes = diaUtc(h.y, h.m, h.d + (dia === 0 ? -6 : 1 - dia) + offsetSemanas * 7);
    const domingo = diaUtc(lunes.getUTCFullYear(), lunes.getUTCMonth(), lunes.getUTCDate() + 6);
    return { inicio: lunes, fin: domingo, etiqueta: `Lun ${ddmm(lunes)} – Dom ${ddmm(domingo)}`, navegable: true };
  }

  /** Mes calendario (Lima). */
  calcularRangoMes(offsetMeses: number = 0, ahora: Date = new Date()): RangoFechas {
    const h = fechaLima(ahora);
    const inicio = diaUtc(h.y, h.m + offsetMeses, 1);
    const fin = diaUtc(h.y, h.m + offsetMeses + 1, 0);
    return { inicio, fin, etiqueta: `${NOMBRES_MESES[inicio.getUTCMonth()]} ${inicio.getUTCFullYear()}`, navegable: true };
  }

  /** Rango elegido por el usuario (fechas AAAA-MM-DD, inclusivas). */
  calcularRangoPersonalizado(desdeStr?: string, hastaStr?: string): RangoFechas {
    const h = fechaLima();
    let inicio = diaUtc(h.y, h.m, 1);
    let fin = diaUtc(h.y, h.m + 1, 0);
    if (desdeStr) {
      const [y, m, d] = desdeStr.split('-').map(Number);
      inicio = diaUtc(y, m - 1, d);
    }
    if (hastaStr) {
      const [y, m, d] = hastaStr.split('-').map(Number);
      fin = diaUtc(y, m - 1, d);
    }
    const largo = (dt: Date) => `${ddmm(dt)}/${dt.getUTCFullYear()}`;
    return { inicio, fin, etiqueta: `Del ${largo(inicio)} al ${largo(fin)}`, navegable: false };
  }

  /**
   * Lista todos los colaboradores/personal activo para selección y desglose.
   */
  async listarPersonalActivo() {
    const [usuarios, rolesEmpleado] = await Promise.all([
      this.prisma.userAccount.findMany({
        where: { activo: true },
        include: {
          party: {
            include: { persona: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.partyRole.findMany({
        where: {
          employee_detail: { isNot: null },
        },
        include: {
          party: {
            include: { persona: true },
          },
          employee_detail: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const mapa = new Map<
      string,
      { partyId: string; nombre: string; rol: string; descuentoPct: number }
    >();

    for (const u of usuarios) {
      const persona = u.party?.persona;
      const nombre = persona
        ? `${persona.nombres || ''} ${persona.apellidos || ''}`.trim()
        : 'Colaborador';
      const key = u.party_id.toString();
      if (!mapa.has(key)) {
        mapa.set(key, {
          partyId: key,
          nombre,
          rol: u.rol,
          descuentoPct: 25,
        });
      }
    }

    for (const r of rolesEmpleado) {
      const persona = r.party?.persona;
      const nombre = persona
        ? `${persona.nombres || ''} ${persona.apellidos || ''}`.trim()
        : 'Colaborador';
      const key = r.party_id.toString();
      const desc = r.employee_detail?.descuento_pct
        ? Number(r.employee_detail.descuento_pct)
        : 25;

      if (!mapa.has(key)) {
        mapa.set(key, {
          partyId: key,
          nombre,
          rol: r.rol || 'TRABAJADOR',
          descuentoPct: desc,
        });
      }
    }

    return Array.from(mapa.values());
  }

  /**
   * Registra el consumo a crédito del personal (FT-USR-03, RN-CAP-131, DT-63).
   * Expuesto para ser llamado por caja / cobros o directamente.
   */
  async registrarConsumo(
    pedidoId: string | bigint | number,
    partyId: string | bigint | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
    /** false = solo acumula el consumo; el total y el descuento del pedido no se tocan (regularización) */
    ajustarPedido = true,
  ) {
    const pId = this.parsearId(pedidoId);
    const parId = this.parsearId(partyId);

    // 1. Validar que el pedido exista
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        lineas: true,
        consumoPersonal: true,
        cobros: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido no existe',
      });
    }

    // un pedido ya cobrado en caja no se carga también a crédito (dos cobros del mismo pedido)
    // (el pedido del personal sí: su «cobro» es a crédito, no entra dinero a caja)
    if (!pedido.es_personal && (pedido.pago_estado === 'PAGADO' || cobroVigente(pedido.cobros))) {
      throw new ConflictException({
        codigo: 'YA_COBRADO',
        mensaje: 'El pedido ya fue cobrado',
      });
    }

    // RN-CAP-131 / RQ-USR-03-06: por la carta virtual no se consume crédito del personal
    if (['CARTA', 'BOT', 'CHATBOT'].includes(pedido.canal)) {
      throw new BadRequestException({
        codigo: 'CANAL_NO_PERMITIDO',
        mensaje: 'Por la carta virtual no se consume crédito del personal',
      });
    }

    if (pedido.estado === 'ANULADO') {
      throw new BadRequestException({
        codigo: 'PEDIDO_ANULADO',
        mensaje: 'No se puede cobrar a crédito un pedido anulado',
      });
    }

    if (pedido.consumoPersonal) {
      throw new ConflictException({
        codigo: 'YA_COBRADO_A_CREDITO',
        mensaje: 'Este pedido ya fue registrado como crédito del personal',
      });
    }

    // 2. Validar que el colaborador exista, esté activo y sea personal (RQ-USR-03-08)
    const party = await validarColaborador(this.prisma, parId);

    // 3. Descuento del personal. Si el pedido ya lo trae (se aplicó al crearlo), no se vuelve a calcular
    const { yaTraeDescuento, descuento: descuentoCalculado, montoNeto, nuevosDetalles } =
      await planDescuentoPersonalDePedido(this.prisma, pedido, parId);

    const ahora = new Date();
    const hoyLima = fechaLima(ahora);
    const fechaConsumo = diaUtc(hoyLima.y, hoyLima.m, hoyLima.d);

    // 4. Registrar en transacción
    const [consumo, pedidoActualizado] = await this.prisma.$transaction(async (tx) => {
      const nuevoConsumo = await tx.consumoPersonal.create({
        data: {
          party_id: parId,
          pedido_id: pId,
          fecha: fechaConsumo,
          monto: montoNeto,
        },
      });

      if (!ajustarPedido) return [nuevoConsumo, pedido] as const;

      const pActualizado = await tx.pedido.update({
        where: { id: pId },
        data: {
          es_personal: true,
          pago_metodo: 'CREDITO_PERSONAL',
          pago_estado: 'PAGADO',
          // el descuento del personal se SUMA al que ya tenga el pedido (no lo pisa)
          ...(yaTraeDescuento
            ? {}
            : {
                descuento: Number((Number(pedido.descuento ?? 0) + descuentoCalculado).toFixed(2)),
                total: montoNeto,
                ...(nuevosDetalles ? { descuento_detalle: nuevosDetalles } : {}),
              }),
        },
      });

      return [nuevoConsumo, pActualizado];
    });

    // Pasa a PAGADO sin cobro de Caja (que es quien descuenta los insumos por receta): se descuentan aquí.
    // Idempotente (si ya se cobró no repite) y, si falla, no deshace el consumo.
    if (ajustarPedido) {
      try {
        await this.stockService?.descontarPorPedido(pId);
      } catch {
        // se puede regularizar con el descuento por receta
      }
    }

    // El pedido pasa a ser del personal sin Cobro: sale su ticket (idempotente; si ya salió al crearlo no se repite)
    if (ajustarPedido) {
      try {
        await this.impresion?.encolarTicketPedido(pId);
      } catch {
        // se puede reimprimir desde el pedido
      }
    }

    // 5. Auditar la acción (DT-49, RQ-USR-03-03)
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'creditos',
      accion: 'REGISTRAR_CONSUMO',
      resultado: 'OK',
      entidad: 'consumo_personal',
      entidadId: consumo.id,
      partyId: usuarioActual?.partyId ? BigInt(usuarioActual.partyId) : parId,
      despues: {
        consumoId: consumo.id.toString(),
        pedidoId: pedido.id.toString(),
        partyId: parId.toString(),
        montoNeto,
        descuentoCalculado,
      },
      ip,
    });

    const nombreColaborador = party.persona
      ? `${party.persona.nombres || ''} ${party.persona.apellidos || ''}`.trim()
      : 'Colaborador';

    return {
      id: consumo.id.toString(),
      pedidoId: pedidoActualizado.id.toString(),
      pedidoCodigo: pedidoActualizado.codigo,
      partyId: parId.toString(),
      colaborador: nombreColaborador,
      monto: Number(consumo.monto),
      descuento: descuentoCalculado,
      fecha: consumo.fecha.toISOString(),
    };
  }

  /**
   * Obtiene el resumen por período (semana, mes o rango) para la pantalla Créditos del personal.
   */
  async obtenerResumen(filtros: FiltrarCreditosDto) {
    const periodoTipo = filtros.periodo || 'semana';
    let rango: RangoFechas;

    if (periodoTipo === 'mes') {
      const offset = Number(filtros.mesOffset || 0);
      rango = this.calcularRangoMes(offset);
    } else if (periodoTipo === 'rango') {
      rango = this.calcularRangoPersonalizado(filtros.desde, filtros.hasta);
    } else {
      const offset = Number(filtros.semanaOffset || 0);
      rango = this.calcularRangoSemana(offset);
    }

    const [descuentoPct, personalActivo, consumosEnRango] = await Promise.all([
      this.obtenerPorcentajeDescuento(),
      this.listarPersonalActivo(),
      this.prisma.consumoPersonal.findMany({
        where: {
          fecha: {
            gte: rango.inicio,
            lte: rango.fin,
          },
          // un pedido anulado o rechazado no se le cobra al trabajador
          pedido: { estado: { notIn: ['ANULADO', 'RECHAZADO'] } },
        },
        include: {
          party: {
            include: { persona: true },
          },
          pedido: {
            include: { lineas: true },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
    ]);

    const nombresCobradores = await this.nombresDeCobradores(consumosEnRango);

    // Agrupar consumos por partyId
    const consumosPorParty = new Map<string, any[]>();
    for (const c of consumosEnRango) {
      const key = c.party_id.toString();
      if (!consumosPorParty.has(key)) {
        consumosPorParty.set(key, []);
      }
      consumosPorParty.get(key)!.push(c);
    }

    let totalPeriodo = 0;
    let trabajadoresConConsumo = 0;
    const totalConsumos = consumosEnRango.length;

    const filasTrabajadores = personalActivo.map((colaborador) => {
      const consumos = consumosPorParty.get(colaborador.partyId) || [];
      const totalTrabajador = consumos.reduce(
        (acc, item) => acc + Number(item.monto),
        0,
      );

      if (totalTrabajador > 0) {
        trabajadoresConConsumo++;
      }
      totalPeriodo += totalTrabajador;

      const itemsMapeados = consumos.map((item) => {
        const fechaStr = ddmm(new Date(item.fecha));
        const codigo = item.pedido?.codigo || `P-${item.pedido_id}`;

        const lineasTexto: string[] = [];
        if (item.pedido?.lineas && item.pedido.lineas.length > 0) {
          for (const l of lineasDeCuenta<(typeof item.pedido.lineas)[number]>(item.pedido.lineas)) {
            const tam = l.tamano ? ` (${l.tamano})` : '';
            lineasTexto.push(`${l.cantidad} × ${l.nombre}${tam}`);
          }
        } else {
          lineasTexto.push(`1 × Consumo en local (pedido ${codigo})`);
        }

        return {
          id: item.id.toString(),
          pedidoId: item.pedido_id.toString(),
          pedidoCodigo: codigo,
          fecha: fechaStr,
          fechaIso: item.fecha.toISOString(),
          monto: Number(item.monto),
          montoFormateado: `s/ ${Number(item.monto).toFixed(2)}`,
          lineas: lineasTexto,
          descuento: descuentoPersonalDe(item.pedido),
          ...this.datosCobro(item, nombresCobradores),
        };
      });

      return {
        partyId: colaborador.partyId,
        nombre: colaborador.nombre,
        rol: colaborador.rol,
        total: Number(totalTrabajador.toFixed(2)),
        totalFormateado: `s/ ${totalTrabajador.toFixed(2)}`,
        tieneConsumo: totalTrabajador > 0,
        cantidadConsumos: consumos.length,
        // Lo que sigue sin pagarse (se paga en su cuenta semanal/mensual)
        pendiente: Number(consumos.filter((c) => !c.pagado_en).reduce((a, c) => a + Number(c.monto), 0).toFixed(2)),
        items: itemsMapeados,
      };
    });

    filasTrabajadores.sort((a, b) => {
      if (a.tieneConsumo && !b.tieneConsumo) return -1;
      if (!a.tieneConsumo && b.tieneConsumo) return 1;
      if (a.tieneConsumo && b.tieneConsumo) return b.total - a.total;
      return a.nombre.localeCompare(b.nombre);
    });

    return {
      descuentoPct,
      periodo: {
        tipo: periodoTipo,
        etiqueta: rango.etiqueta,
        desde: rango.inicio.toISOString().split('T')[0],
        hasta: rango.fin.toISOString().split('T')[0],
        navegable: rango.navegable,
      },
      totales: {
        totalMonto: Number(totalPeriodo.toFixed(2)),
        totalFormateado: `s/ ${totalPeriodo.toFixed(2)}`,
        totalConsumos,
        trabajadoresConConsumo,
        totalTrabajadores: personalActivo.length,
        resumenTrabajadores: `${trabajadoresConConsumo} de ${personalActivo.length}`,
      },
      trabajadores: filasTrabajadores,
    };
  }

  /** Nombres de quienes cobraron (pagado_por) para mostrar «cobró: X» sin una consulta por consumo. */
  private async nombresDeCobradores(consumos: any[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(consumos.map((c) => c.pagado_por).filter((x) => x != null).map((x) => x.toString()))).map((x) => BigInt(x));
    const mapa = new Map<string, string>();
    if (ids.length === 0) return mapa;
    const personas = await this.prisma.person.findMany({ where: { party_id: { in: ids } } }).catch(() => []);
    for (const p of personas) mapa.set(p.party_id.toString(), `${p.nombres || ''} ${p.apellidos || ''}`.trim());
    return mapa;
  }

  /** Campos del check «Cobrado / Pendiente» de un consumo (los mismos en el resumen y en la cuenta). */
  private datosCobro(c: any, nombres: Map<string, string>) {
    return {
      estadoPago: c.pagado_en ? 'PAGADO' : 'PENDIENTE',
      pagadoEn: c.pagado_en ? c.pagado_en.toISOString() : null,
      pagoModo: c.pago_modo ?? null,
      pagoMedio: c.pago_medio ?? null,
      pagoDetalle: c.pago_motivo ?? null,
      cobradoPor: c.pagado_por != null ? (nombres.get(c.pagado_por.toString()) ?? `Usuario ${c.pagado_por}`) : null,
    };
  }

  private formatoConsumo(c: any, nombres: Map<string, string> = new Map()) {
    const lineas = lineasDeCuenta<any>(c.pedido?.lineas ?? []).map((l) => `${l.cantidad} × ${l.nombre}${l.tamano ? ` (${l.tamano})` : ''}`);
    return {
      id: c.id.toString(),
      pedidoId: c.pedido_id.toString(),
      pedidoCodigo: c.pedido?.codigo ?? `P-${c.pedido_id}`,
      fecha: ddmm(new Date(c.fecha)),
      fechaIso: new Date(c.fecha).toISOString(),
      monto: Number(c.monto),
      lineas,
      descuento: descuentoPersonalDe(c.pedido),
      ...this.datosCobro(c, nombres),
    };
  }

  /**
   * Cuenta del trabajador: lo que debe esta semana (lunes a domingo) y este mes (calendario, Lima), y la lista de sus
   * consumos del mes, de la semana y todo lo que sigue pendiente (incluido lo anterior a este mes).
   */
  async obtenerCuenta(partyIdInput: string | number | bigint, ahora: Date = new Date()) {
    const partyId = this.parsearId(partyIdInput);
    const semana = this.calcularRangoSemana(0, ahora);
    const mes = this.calcularRangoMes(0, ahora);
    const desde = semana.inicio < mes.inicio ? semana.inicio : mes.inicio;
    const consumos = await this.prisma.consumoPersonal.findMany({
      where: {
        party_id: partyId,
        pedido: { estado: { notIn: ['ANULADO', 'RECHAZADO'] } },
        OR: [{ fecha: { gte: desde } }, { pagado_en: null }],
      },
      include: { pedido: { include: { lineas: true } } },
      orderBy: { fecha: 'desc' },
    });
    const nombresCobradores = await this.nombresDeCobradores(consumos);
    const suma = (lista: any[]) => Number(lista.reduce((a, c) => a + Number(c.monto), 0).toFixed(2));
    const en = (r: RangoFechas) => consumos.filter((c) => c.fecha >= r.inicio && c.fecha <= r.fin);
    const pend = (lista: any[]) => lista.filter((c) => !c.pagado_en);
    const enSemana = en(semana);
    const enMes = en(mes);
    return {
      partyId: partyId.toString(),
      semana: { etiqueta: semana.etiqueta, total: suma(enSemana), debe: suma(pend(enSemana)) },
      mes: { etiqueta: mes.etiqueta, total: suma(enMes), debe: suma(pend(enMes)) },
      debeTotal: suma(pend(consumos)),
      resumen: `Debe esta semana: S/ ${suma(pend(enSemana)).toFixed(2)} · Este mes: S/ ${suma(pend(enMes)).toFixed(2)}`,
      consumos: consumos.map((c) => this.formatoConsumo(c, nombresCobradores)),
    };
  }

  /**
   * El trabajador paga en Caja consumos pendientes (uno o varios, de una misma persona). Efectivo: ingreso en la caja
   * abierta con el motivo «Pago de crédito del personal»; digital (Yape, Plin, tarjeta…): se anota el medio y no mueve el efectivo.
   * Todo o nada: si alguno ya estaba pagado responde 409 y no se toca nada (sin doble cobro).
   */
  async saldar(
    dto: { consumoIds?: Array<string | number>; pedidoIds?: Array<string | number>; medio: string; motivo?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    let idsEntrada: Array<string | number | bigint> = dto.consumoIds ?? [];
    if (dto.pedidoIds?.length) {
      const porPedido = await this.prisma.consumoPersonal.findMany({
        where: { pedido_id: { in: dto.pedidoIds.map((i) => this.parsearId(i)) } },
        select: { id: true },
      });
      idsEntrada = [...idsEntrada, ...porPedido.map((c) => c.id)];
    }
    const ids = Array.from(new Set(idsEntrada.map((i) => this.parsearId(i).toString()))).map((i) => BigInt(i));
    if (ids.length === 0) {
      throw new BadRequestException({ codigo: 'SIN_CONSUMOS', mensaje: 'Elige al menos un consumo para pagar' });
    }
    const medio = String(dto.medio ?? '').trim().toUpperCase();
    if (!medio) throw new BadRequestException({ codigo: 'MEDIO_REQUERIDO', mensaje: 'Elige con qué paga el trabajador' });
    const consumos = await this.prisma.consumoPersonal.findMany({ where: { id: { in: ids } }, include: { pedido: true } });
    if (consumos.length !== ids.length) {
      throw new NotFoundException({ codigo: 'CONSUMO_NO_ENCONTRADO', mensaje: 'Alguno de los consumos no existe' });
    }
    if (consumos.some((c) => c.pagado_en)) {
      throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Alguno de esos consumos ya estaba pagado' });
    }
    if (new Set(consumos.map((c) => c.party_id.toString())).size > 1) {
      throw new BadRequestException({ codigo: 'VARIOS_TRABAJADORES', mensaje: 'Cada pago es de un solo trabajador' });
    }
    const total = Number(consumos.reduce((a, c) => a + Number(c.monto), 0).toFixed(2));
    const partyId = consumos[0].party_id;
    const persona = await this.prisma.person.findUnique({ where: { party_id: partyId } }).catch(() => null);
    const nombre = persona ? `${persona.nombres || ''} ${persona.apellidos || ''}`.trim() : `trabajador ${partyId}`;
    const codigos = consumos.map((c) => c.pedido?.codigo ?? `P-${c.pedido_id}`);
    const ahora = new Date();
    const cobrador = BigInt(usuario.partyId);

    const movimientoId = await this.prisma.$transaction(async (tx) => {
      let movId: bigint | null = null;
      if (medio === 'EFECTIVO' && total > 0) {
        const caja = await tx.caja.findFirst({ where: { estado: 'ABIERTA' } });
        if (!caja) {
          throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para recibir el pago en efectivo' });
        }
        const mov = await tx.movimientoCaja.create({
          data: {
            caja_id: caja.id,
            tipo: 'INGRESO',
            monto: total,
            motivo: `Pago de crédito del personal · ${nombre} · ${codigos.join(', ')}`.slice(0, 250),
          },
        });
        movId = mov.id;
      }
      const r = await tx.consumoPersonal.updateMany({
        where: { id: { in: ids }, pagado_en: null },
        data: {
          pagado_en: ahora,
          pagado_por: cobrador,
          pago_modo: 'CAJA',
          pago_medio: medio,
          pago_motivo: dto.motivo?.trim() || 'Pago de crédito del personal',
          movimiento_caja_id: movId,
        },
      });
      // Otra persona lo pagó entre medio: se deshace todo (incluido el ingreso a caja)
      if (r.count !== ids.length) {
        throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Alguno de esos consumos ya estaba pagado' });
      }
      return movId;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'creditos',
      accion: 'SALDAR_CONSUMOS',
      resultado: 'OK',
      entidad: 'consumo_personal',
      entidadId: ids[0],
      partyId: cobrador,
      despues: { consumos: ids.map(String), pedidos: codigos, total, medio, trabajador: nombre, movimientoCajaId: movimientoId?.toString() ?? null },
      ip,
    });

    // Ticket de pago por cada pedido saldado (ahora dice «Pagado ahora»); si falla, el pago ya está registrado
    for (const c of consumos) {
      try {
        await this.impresion?.reimprimirEtiqueta(c.pedido_id.toString(), { tipo: 'TICKET_PAGO' } as any, usuario, ip);
      } catch {
        // se puede reimprimir desde el pedido
      }
    }
    return { ok: true, total, cantidad: ids.length, medio, movimientoCajaId: movimientoId?.toString() ?? null };
  }

  /**
   * Marcar / desmarcar a mano un consumo como «Ya se le descontó» (solo ADMIN). Marcar no mueve caja. Desmarcar lo devuelve
   * a Pendiente, salvo un cobro en efectivo ya registrado en caja (ese se corrige con un movimiento de caja). Todo auditado.
   */
  async marcarCobrado(dto: { consumoId: string | number; cobrado: boolean; motivo?: string }, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.parsearId(dto.consumoId);
    const c = await this.prisma.consumoPersonal.findUnique({ where: { id }, include: { pedido: true } });
    if (!c) throw new NotFoundException({ codigo: 'CONSUMO_NO_ENCONTRADO', mensaje: 'El consumo no existe' });
    const por = BigInt(usuario.partyId);
    if (dto.cobrado) {
      if (c.pagado_en) throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Ese consumo ya estaba cobrado' });
      const r = await this.prisma.consumoPersonal.updateMany({
        where: { id, pagado_en: null },
        data: { pagado_en: new Date(), pagado_por: por, pago_modo: 'PLANILLA', pago_medio: 'PLANILLA', pago_motivo: dto.motivo?.trim() || 'Ya se le descontó (marcado a mano)' },
      });
      if (r.count !== 1) throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Ese consumo ya estaba cobrado' });
    } else {
      if (!c.pagado_en) throw new ConflictException({ codigo: 'YA_PENDIENTE', mensaje: 'Ese consumo ya está pendiente' });
      if (c.movimiento_caja_id != null) {
        throw new ConflictException({
          codigo: 'COBRO_EN_CAJA',
          mensaje: 'Ese cobro entró a la caja en efectivo; no se desmarca desde aquí (corrígelo con un movimiento de caja)',
        });
      }
      await this.prisma.consumoPersonal.update({
        where: { id },
        data: { pagado_en: null, pagado_por: null, pago_modo: null, pago_medio: null, pago_motivo: null, movimiento_caja_id: null },
      });
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'creditos',
      accion: dto.cobrado ? 'MARCAR_COBRADO' : 'DESMARCAR_COBRADO',
      resultado: 'OK',
      entidad: 'consumo_personal',
      entidadId: id,
      partyId: por,
      despues: { consumo: id.toString(), pedido: c.pedido?.codigo ?? null, monto: Number(c.monto), cobrado: dto.cobrado },
      ip,
    });
    return { ok: true, cobrado: dto.cobrado };
  }

  /**
   * Cierre de periodo opcional: el descuento se hizo por planilla/sueldo. Marca como pagados los consumos pendientes
   * del rango (de un trabajador o de todos) SIN mover caja. Exige motivo.
   */
  async marcarPeriodoPlanilla(
    dto: { desde: string; hasta: string; partyId?: string | number; motivo: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const motivo = String(dto.motivo ?? '').trim();
    if (motivo.length < 3) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo (por ejemplo: descontado en la planilla de la semana)' });
    }
    const rango = this.calcularRangoPersonalizado(dto.desde, dto.hasta);
    const donde: any = { fecha: { gte: rango.inicio, lte: rango.fin }, pagado_en: null };
    if (dto.partyId !== undefined && dto.partyId !== null && dto.partyId !== '') donde.party_id = this.parsearId(dto.partyId);
    const pendientes = await this.prisma.consumoPersonal.findMany({ where: donde, select: { id: true, monto: true } });
    if (pendientes.length === 0) {
      throw new ConflictException({ codigo: 'NADA_PENDIENTE', mensaje: 'No hay consumos pendientes en ese periodo' });
    }
    const r = await this.prisma.consumoPersonal.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) }, pagado_en: null },
      data: { pagado_en: new Date(), pagado_por: BigInt(usuario.partyId), pago_modo: 'PLANILLA', pago_medio: 'PLANILLA', pago_motivo: motivo },
    });
    const total = Number(pendientes.reduce((a, p) => a + Number(p.monto), 0).toFixed(2));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'creditos',
      accion: 'MARCAR_PLANILLA',
      resultado: 'OK',
      entidad: 'consumo_personal',
      partyId: BigInt(usuario.partyId),
      motivo,
      despues: { periodo: rango.etiqueta, cantidad: r.count, total, partyId: dto.partyId ?? null },
      ip,
    });
    return { ok: true, cantidad: r.count, total, periodo: rango.etiqueta };
  }

  /**
   * Exporta a formato CSV compatible con Excel para liquidar el pago fuera del sistema (RQ-USR-03-09).
   */
  async exportar(
    filtros: FiltrarCreditosDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ nombreArchivo: string; contenidoCsv: string }> {
    const resumen = await this.obtenerResumen(filtros);

    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'creditos',
      accion: 'EXPORTAR',
      resultado: 'OK',
      partyId: usuarioActual?.partyId ? BigInt(usuarioActual.partyId) : undefined,
      despues: {
        periodo: resumen.periodo.etiqueta,
        totalMonto: resumen.totales.totalMonto,
        totalConsumos: resumen.totales.totalConsumos,
      },
      ip,
    });

    const filas: string[] = [];
    filas.push('Fecha,Código Pedido,Colaborador,Rol,Detalle,Monto (S/)');

    for (const t of resumen.trabajadores) {
      if (t.items.length === 0) {
        filas.push(`"—","—","${t.nombre}","${t.rol}","Sin consumos en el período",0.00`);
      } else {
        for (const it of t.items) {
          const detalleLimpio = it.lineas.join('; ').replace(/"/g, '""');
          filas.push(
            `"${it.fecha}","${it.pedidoCodigo}","${t.nombre}","${t.rol}","${detalleLimpio}",${it.monto.toFixed(2)}`,
          );
        }
      }
    }

    filas.push('');
    filas.push(`"TOTAL GENERAL",,"${resumen.periodo.etiqueta}",,,${resumen.totales.totalMonto.toFixed(2)}`);

    const contenidoCsv = `\uFEFF${filas.join('\r\n')}`;
    const nombreArchivo = `creditos-personal-${resumen.periodo.desde}-al-${resumen.periodo.hasta}.csv`;

    return { nombreArchivo, contenidoCsv };
  }
}
