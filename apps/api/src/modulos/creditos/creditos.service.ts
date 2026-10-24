import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { FiltrarCreditosDto } from './dto/filtrar-creditos.dto';

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
   * Calcula el rango de fechas de una semana (Lunes 00:00:00 a Domingo 23:59:59).
   */
  calcularRangoSemana(offsetSemanas: number = 0): RangoFechas {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = Domingo, 1 = Lunes...
    const difLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + difLunes + offsetSemanas * 7);
    lunes.setHours(0, 0, 0, 0);

    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);

    const fLunes = `${String(lunes.getDate()).padStart(2, '0')}/${String(lunes.getMonth() + 1).padStart(2, '0')}`;
    const fDomingo = `${String(domingo.getDate()).padStart(2, '0')}/${String(domingo.getMonth() + 1).padStart(2, '0')}`;
    const etiqueta = `Lun ${fLunes} – Dom ${fDomingo}`;

    return { inicio: lunes, fin: domingo, etiqueta, navegable: true };
  }

  /**
   * Calcula el rango de fechas de un mes.
   */
  calcularRangoMes(offsetMeses: number = 0): RangoFechas {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth() + offsetMeses;

    const inicio = new Date(anio, mes, 1, 0, 0, 0, 0);
    const fin = new Date(anio, mes + 1, 0, 23, 59, 59, 999);

    const etiqueta = `${NOMBRES_MESES[inicio.getMonth()]} ${inicio.getFullYear()}`;
    return { inicio, fin, etiqueta, navegable: true };
  }

  /**
   * Calcula el rango de fechas personalizado.
   */
  calcularRangoPersonalizado(desdeStr?: string, hastaStr?: string): RangoFechas {
    const hoy = new Date();
    let inicio: Date;
    let fin: Date;

    if (desdeStr) {
      const [y, m, d] = desdeStr.split('-').map(Number);
      inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
    }

    if (hastaStr) {
      const [y, m, d] = hastaStr.split('-').map(Number);
      fin = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const fDesde = `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')}/${inicio.getFullYear()}`;
    const fHasta = `${String(fin.getDate()).padStart(2, '0')}/${String(fin.getMonth() + 1).padStart(2, '0')}/${fin.getFullYear()}`;
    const etiqueta = `Del ${fDesde} al ${fHasta}`;

    return { inicio, fin, etiqueta, navegable: false };
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
  ) {
    const pId = this.parsearId(pedidoId);
    const parId = this.parsearId(partyId);

    // 1. Validar que el pedido exista
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        lineas: true,
        consumoPersonal: true,
        cobro: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido no existe',
      });
    }

    // un pedido ya cobrado en caja no se carga también a crédito (dos cobros del mismo pedido)
    if (pedido.pago_estado === 'PAGADO' || (pedido.cobro && !pedido.cobro.anulado_en)) {
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

    // 2. Validar que el colaborador exista y esté activo
    const party = await this.prisma.party.findUnique({
      where: { id: parId },
      include: {
        persona: true,
        usuario: true,
        roles: {
          include: { employee_detail: true },
        },
      },
    });

    if (!party) {
      throw new NotFoundException({
        codigo: 'COLABORADOR_NO_ENCONTRADO',
        mensaje: 'El colaborador no existe en el sistema',
      });
    }

    const tieneCuentaActiva = party.usuario?.activo ?? true;
    if (!tieneCuentaActiva) {
      throw new BadRequestException({
        codigo: 'COLABORADOR_DESACTIVADO',
        mensaje: 'El colaborador se encuentra desactivado',
      });
    }

    // RQ-USR-03-08: el crédito es solo para el personal (con cuenta o con rol de empleado), no para clientes
    const esPersonal = Boolean(party.usuario) || Boolean(party.roles?.some((r) => r.employee_detail));
    if (!esPersonal) {
      throw new BadRequestException({
        codigo: 'NO_ES_PERSONAL',
        mensaje: 'El crédito del personal solo se da a trabajadores del local',
      });
    }

    // 3. Calcular el descuento del personal
    const pctConfigurado = await this.obtenerPorcentajeDescuento();
    const rolEmpleado = party.roles?.find((r) => r.employee_detail);
    const pct = rolEmpleado?.employee_detail?.descuento_pct
      ? Number(rolEmpleado.employee_detail.descuento_pct)
      : pctConfigurado;

    let subtotalElegible = 0;
    const regexExcluidos = /combo|promoci[oó]n|docena/i;

    for (const linea of pedido.lineas) {
      const esCombo = linea.oferta_id !== null || linea.linea_combo_id !== null;
      const esExcluidoPorNombre = regexExcluidos.test(linea.nombre);
      const sub = Number(linea.subtotal ?? (Number(linea.precio_unit) * linea.cantidad));

      if (!esCombo && !esExcluidoPorNombre) {
        subtotalElegible += sub;
      }
    }

    if (pedido.lineas.length === 0) {
      subtotalElegible = Number(pedido.total);
    }

    const descuentoCalculado = Math.round(subtotalElegible * (pct / 100) * 100) / 100;
    const montoNeto = Math.max(0, Math.round((Number(pedido.total) - descuentoCalculado) * 100) / 100);

    const ahora = new Date();

    // 4. Registrar en transacción
    const [consumo, pedidoActualizado] = await this.prisma.$transaction(async (tx) => {
      const nuevoConsumo = await tx.consumoPersonal.create({
        data: {
          party_id: parId,
          pedido_id: pId,
          fecha: ahora,
          monto: montoNeto,
        },
      });

      const pActualizado = await tx.pedido.update({
        where: { id: pId },
        data: {
          party_id: parId,
          es_personal: true,
          pago_metodo: 'CREDITO_PERSONAL',
          pago_estado: 'PAGADO',
          descuento: descuentoCalculado,
          total: montoNeto,
        },
      });

      return [nuevoConsumo, pActualizado];
    });

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
        const d = new Date(item.fecha);
        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const codigo = item.pedido?.codigo || `P-${item.pedido_id}`;

        const lineasTexto: string[] = [];
        if (item.pedido?.lineas && item.pedido.lineas.length > 0) {
          for (const l of item.pedido.lineas) {
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
