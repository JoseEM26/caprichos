import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { CrearPedidoProveedorDto } from './dto/crear-pedido-proveedor.dto';
import { CrearCompraDto } from './dto/crear-compra.dto';
import { CompraRapidaDto } from './dto/compra-rapida.dto';
import { RecibirPedidoDto } from './dto/recibir-pedido.dto';
import { AnularCompraDto } from './dto/anular-compra.dto';
import { ComprasQueryDto } from './dto/compras-query.dto';
import { StockService } from '../stock/stock.service';

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly stockService?: StockService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'entidad'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  // ==========================================
  // RESUMEN / KPIS
  // ==========================================
  async obtenerResumen() {
    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ultimoDiaMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

    // 1. Pedidos por recibir
    const pedidosPorRecibirCount = await this.prisma.pedidoProveedor.count({
      where: { estado: { in: ['POR_RECIBIR', 'PARCIAL'] } },
    });

    // 2. Por pagar a proveedores (crédito no pagado y no anulado)
    const comprasCreditoPendientes = await this.prisma.compra.findMany({
      where: {
        condicion: 'CREDITO',
        pagada_en: null,
        anulada_en: null,
      },
      select: { total: true },
    });
    const porPagar = comprasCreditoPendientes.reduce(
      (acc, c) => acc + Number(c.total),
      0,
    );

    // 3. Comprado este mes (sin anuladas)
    const comprasMes = await this.prisma.compra.findMany({
      where: {
        anulada_en: null,
        fecha_compra: {
          gte: primerDiaMes,
          lte: ultimoDiaMes,
        },
      },
      select: { total: true },
    });
    const compradoMes = comprasMes.reduce(
      (acc, c) => acc + Number(c.total),
      0,
    );

    // 4. Insumos bajo el mínimo (lista para pedir)
    const insumos = await this.prisma.insumo.findMany({
      where: { activo: true },
      include: {
        stocks: true,
      },
    });

    let listaPedirCount = 0;
    for (const ins of insumos) {
      const stockTotal = ins.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);
      if (stockTotal <= Number(ins.minimo)) {
        listaPedirCount++;
      }
    }

    return {
      pedidosPorRecibir: pedidosPorRecibirCount,
      porPagar: Math.round(porPagar * 100) / 100,
      compradoMes: Math.round(compradoMes * 100) / 100,
      listaPedir: listaPedirCount,
    };
  }

  // ==========================================
  // PROVEEDORES
  // ==========================================
  async listarProveedores() {
    const orgs = await this.prisma.organization.findMany({
      include: {
        party: {
          include: {
            documentos: true,
            contactos: true,
            roles: {
              where: { rol: 'PROVEEDOR' },
              include: { supplier_detail: true },
            },
          },
        },
      },
    });

    const insumos = await this.prisma.insumo.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        proveedor_a: true,
        proveedor_b: true,
        proveedor_c: true,
      },
    });

    return orgs
      .filter((o) => o.party.roles.length > 0)
      .map((o) => {
        const party = o.party;
        const rucDoc = party.documentos.find((d) => d.tipo === 'RUC');
        const telContact = party.contactos.find((c) => c.tipo === 'WHATSAPP' || c.tipo === 'TELEFONO');
        const role = party.roles[0];
        const detail = role?.supplier_detail;

        const provId = party.id;
        const insumosProv = insumos
          .filter(
            (i) =>
              i.proveedor_a === provId ||
              i.proveedor_b === provId ||
              i.proveedor_c === provId,
          )
          .map((i) => {
            let tipo = 'A';
            if (i.proveedor_b === provId) tipo = 'B';
            if (i.proveedor_c === provId) tipo = 'C';
            return {
              id: i.id.toString(),
              nombre: i.nombre,
              tipo,
            };
          });

        return {
          id: party.id.toString(),
          razonSocial: o.razon_social,
          nombreComercial: o.nombre_comercial || o.razon_social,
          ruc: rucDoc?.numero || '',
          telefono: telContact?.valor || '',
          contacto: '',
          diasCredito: detail?.dias_credito ?? 0,
          cuentaPago: detail?.cuenta_pago || '',
          activo: detail?.activo ?? true,
          insumos: insumosProv,
        };
      });
  }

  async crearProveedor(dto: CrearProveedorDto, usuario?: UsuarioAutenticado, ip?: string) {
    const rucExistente = await this.prisma.partyIdentifier.findUnique({
      where: {
        tipo_numero: {
          tipo: 'RUC',
          numero: dto.ruc,
        },
      },
    });

    if (rucExistente) {
      throw new ConflictException({
        codigo: 'RUC_YA_REGISTRADO',
        mensaje: 'Ya existe un proveedor registrado con ese RUC',
      });
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          tipo: 'ORGANIZACION',
          estado: 'ACTIVO',
          documentos: {
            create: {
              tipo: 'RUC',
              numero: dto.ruc,
            },
          },
          organizacion: {
            create: {
              razon_social: dto.razonSocial,
              nombre_comercial: dto.nombreComercial || dto.razonSocial,
            },
          },
          contactos: dto.telefono
            ? {
                create: {
                  tipo: 'WHATSAPP',
                  valor: dto.telefono,
                  principal: true,
                },
              }
            : undefined,
        },
      });

      const role = await tx.partyRole.create({
        data: {
          party_id: party.id,
          rol: 'PROVEEDOR',
        },
      });

      await tx.supplierDetail.create({
        data: {
          party_role_id: role.id,
          dias_credito: dto.diasCredito ?? 0,
          cuenta_pago: dto.cuentaPago || null,
          activo: true,
        },
      });

      return party;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'proveedores',
        accion: 'CREAR_PROVEEDOR',
        entidad: 'party',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: { razonSocial: dto.razonSocial, ruc: dto.ruc },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('compras:proveedor_creado', {
      id: resultado.id.toString(),
      razonSocial: dto.razonSocial,
    });

    return {
      id: resultado.id.toString(),
      razonSocial: dto.razonSocial,
      nombreComercial: dto.nombreComercial || dto.razonSocial,
      ruc: dto.ruc,
      telefono: dto.telefono || '',
      diasCredito: dto.diasCredito ?? 0,
      cuentaPago: dto.cuentaPago || '',
      activo: true,
    };
  }

  async actualizarProveedor(
    id: string | number | bigint,
    dto: ActualizarProveedorDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const partyId = this.parsearId(id, 'proveedor');

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        organizacion: true,
        documentos: true,
        contactos: true,
        roles: {
          where: { rol: 'PROVEEDOR' },
          include: { supplier_detail: true },
        },
      },
    });

    if (!party || !party.organizacion) {
      throw new NotFoundException({
        codigo: 'PROVEEDOR_NO_ENCONTRADO',
        mensaje: 'El proveedor no existe',
      });
    }

    if (dto.ruc && dto.ruc !== party.documentos.find((d) => d.tipo === 'RUC')?.numero) {
      const otroRuc = await this.prisma.partyIdentifier.findUnique({
        where: { tipo_numero: { tipo: 'RUC', numero: dto.ruc } },
      });
      if (otroRuc && otroRuc.party_id !== partyId) {
        throw new ConflictException({
          codigo: 'RUC_YA_REGISTRADO',
          mensaje: 'Ya existe otro proveedor registrado con ese RUC',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.razonSocial || dto.nombreComercial) {
        await tx.organization.update({
          where: { party_id: partyId },
          data: {
            razon_social: dto.razonSocial ?? party.organizacion?.razon_social,
            nombre_comercial: dto.nombreComercial ?? party.organizacion?.nombre_comercial,
          },
        });
      }

      if (dto.ruc) {
        const doc = party.documentos.find((d) => d.tipo === 'RUC');
        if (doc) {
          await tx.partyIdentifier.update({
            where: { id: doc.id },
            data: { numero: dto.ruc },
          });
        } else {
          await tx.partyIdentifier.create({
            data: {
              party_id: partyId,
              tipo: 'RUC',
              numero: dto.ruc,
            },
          });
        }
      }

      if (dto.telefono !== undefined) {
        const contact = party.contactos.find((c) => c.tipo === 'WHATSAPP' || c.tipo === 'TELEFONO');
        if (contact) {
          await tx.contactMechanism.update({
            where: { id: contact.id },
            data: { valor: dto.telefono },
          });
        } else if (dto.telefono) {
          await tx.contactMechanism.create({
            data: {
              party_id: partyId,
              tipo: 'WHATSAPP',
              valor: dto.telefono,
              principal: true,
            },
          });
        }
      }

      const role = party.roles[0];
      if (role && (dto.diasCredito !== undefined || dto.cuentaPago !== undefined || dto.activo !== undefined)) {
        await tx.supplierDetail.upsert({
          where: { party_role_id: role.id },
          update: {
            dias_credito: dto.diasCredito !== undefined ? dto.diasCredito : undefined,
            cuenta_pago: dto.cuentaPago !== undefined ? dto.cuentaPago : undefined,
            activo: dto.activo !== undefined ? dto.activo : undefined,
          },
          create: {
            party_role_id: role.id,
            dias_credito: dto.diasCredito ?? 0,
            cuenta_pago: dto.cuentaPago || null,
            activo: dto.activo ?? true,
          },
        });
      }
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'proveedores',
        accion: 'ACTUALIZAR_PROVEEDOR',
        entidad: 'party',
        entidadId: partyId,
        partyId: usuario.partyId,
        despues: dto,
        ip,
      });
    }

    return { ok: true, id: partyId.toString() };
  }

  async cambiarEstadoProveedor(
    id: string | number | bigint,
    activo: boolean,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const partyId = this.parsearId(id, 'proveedor');
    const role = await this.prisma.partyRole.findFirst({
      where: { party_id: partyId, rol: 'PROVEEDOR' },
    });

    if (!role) {
      throw new NotFoundException({
        codigo: 'PROVEEDOR_NO_ENCONTRADO',
        mensaje: 'El proveedor no existe',
      });
    }

    await this.prisma.supplierDetail.update({
      where: { party_role_id: role.id },
      data: { activo },
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'proveedores',
        accion: activo ? 'ACTIVAR_PROVEEDOR' : 'DESACTIVAR_PROVEEDOR',
        entidad: 'party',
        entidadId: partyId,
        partyId: usuario.partyId,
        despues: { activo },
        ip,
      });
    }

    return { ok: true, activo };
  }

  async obtenerHistorialProveedor(id: string | number | bigint) {
    const partyId = this.parsearId(id, 'proveedor');

    const org = await this.prisma.organization.findUnique({
      where: { party_id: partyId },
    });

    if (!org) {
      throw new NotFoundException({
        codigo: 'PROVEEDOR_NO_ENCONTRADO',
        mensaje: 'El proveedor no existe',
      });
    }

    const compras = await this.prisma.compra.findMany({
      where: { proveedor_party_id: partyId },
      include: {
        lineas: {
          include: { insumo: true },
        },
      },
      orderBy: { fecha_compra: 'desc' },
    });

    const preciosPorInsumo = new Map<string, Array<{ fecha: string; costoUnit: number; unidad: string }>>();

    for (const c of compras) {
      if (c.anulada_en) continue;
      const fechaStr = c.fecha_compra.toISOString().split('T')[0];
      for (const lin of c.lineas) {
        const nombreInsumo = lin.insumo.nombre;
        if (!preciosPorInsumo.has(nombreInsumo)) {
          preciosPorInsumo.set(nombreInsumo, []);
        }
        preciosPorInsumo.get(nombreInsumo)?.push({
          fecha: fechaStr,
          costoUnit: Number(lin.costo_unit),
          unidad: lin.insumo.unidad_compra,
        });
      }
    }

    const precios = Array.from(preciosPorInsumo.entries()).map(([ins, historial]) => {
      const lineaTexto = historial
        .map((h) => `${h.fecha.slice(5).replace('-', '/')}: s/ ${h.costoUnit.toFixed(2)} por ${h.unidad.toLowerCase()}`)
        .join(' · ');
      return {
        ins,
        t: lineaTexto,
      };
    });

    const listaCompras = compras.map((c) => {
      const fechaCorta = c.fecha_compra.toISOString().split('T')[0].slice(5).replace('-', '/');
      const insumosNombres = c.lineas.map((l) => l.insumo.nombre).join(', ');
      const estadoTexto = c.anulada_en
        ? 'Anulada'
        : c.pagada_en
          ? 'Pagada'
          : c.condicion === 'CREDITO'
            ? 'A crédito (sin pagar)'
            : 'Recibida';

      return {
        id: c.id.toString(),
        t: `${fechaCorta} · ${c.comprobante_tipo} ${c.comprobante_numero} · s/ ${Number(c.total).toFixed(2)} (${insumosNombres})`,
        e: estadoTexto,
      };
    });

    return {
      nombre: org.razon_social,
      precios,
      compras: listaCompras,
    };
  }

  // ==========================================
  // PEDIR A PROVEEDORES (WHATSAPP)
  // ==========================================
  async listarInsumosParaPedir(incluirRegulares = false) {
    const insumos = await this.prisma.insumo.findMany({
      where: { activo: true },
      include: {
        stocks: true,
      },
    });

    const proveedores = await this.listarProveedores();
    const proveedoresMap = new Map<string, any>();
    for (const p of proveedores) {
      proveedoresMap.set(p.id, p);
    }

    const pedidosAbiertos = await this.prisma.pedidoProveedor.findMany({
      where: { estado: 'POR_RECIBIR' },
      include: { lineas: true },
      orderBy: { enviado_en: 'desc' },
    });

    const resultado: any[] = [];

    for (const ins of insumos) {
      const stockTotal = ins.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);
      const minimo = Number(ins.minimo);
      const intermedio = ins.intermedio ? Number(ins.intermedio) : minimo * 1.5;
      const maximo = Number(ins.maximo);
      const factorCompra = Number(ins.factor_compra) || 1;

      const bajoMinimo = stockTotal <= minimo;
      const esRegular = stockTotal > minimo && stockTotal <= intermedio;

      if (!bajoMinimo && (!incluirRegulares || !esRegular)) {
        continue;
      }

      const faltaAlmacen = Math.max(0, maximo - stockTotal);
      const sugeridoCompra = Math.max(1, Math.ceil(faltaAlmacen / factorCompra));

      let yaPedido = false;
      let fechaPedido = '';
      for (const ped of pedidosAbiertos) {
        const lin = ped.lineas.find((l) => l.insumo_id === ins.id);
        if (lin) {
          yaPedido = true;
          fechaPedido = ped.enviado_en
            ? ped.enviado_en.toISOString().split('T')[0].slice(5).replace('-', '/')
            : '';
          break;
        }
      }

      const provA = ins.proveedor_a ? proveedoresMap.get(ins.proveedor_a.toString()) : null;
      const provB = ins.proveedor_b ? proveedoresMap.get(ins.proveedor_b.toString()) : null;
      const provC = ins.proveedor_c ? proveedoresMap.get(ins.proveedor_c.toString()) : null;

      resultado.push({
        id: ins.id.toString(),
        nombre: ins.nombre,
        unidadCompra: ins.unidad_compra,
        unidadAlmacen: ins.unidad_almacen,
        factorCompra,
        stockActual: stockTotal,
        minimo,
        intermedio,
        maximo,
        sugeridoCompra,
        nivel: bajoMinimo ? 'BAJO' : 'REGULAR',
        yaPedido,
        fechaPedido,
        proveedorA: provA
          ? { id: provA.id, nombre: provA.nombreComercial, telefono: provA.telefono }
          : null,
        proveedorB: provB
          ? { id: provB.id, nombre: provB.nombreComercial, telefono: provB.telefono }
          : null,
        proveedorC: provC
          ? { id: provC.id, nombre: provC.nombreComercial, telefono: provC.telefono }
          : null,
      });
    }

    return resultado;
  }

  async crearPedidoProveedor(
    dto: CrearPedidoProveedorDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const provPartyId = this.parsearId(dto.proveedorPartyId, 'proveedor');

    const resultado = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoProveedor.create({
        data: {
          proveedor_party_id: provPartyId,
          estado: 'POR_RECIBIR',
          lineas: {
            create: dto.lineas.map((l) => ({
              insumo_id: this.parsearId(l.insumoId, 'insumo'),
              cantidad_compra: new Prisma.Decimal(l.cantidadCompra),
              recibido: new Prisma.Decimal(0),
            })),
          },
        },
        include: {
          lineas: { include: { insumo: true } },
          proveedor: { include: { organizacion: true } },
        },
      });

      return pedido;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'CREAR_PEDIDO_PROVEEDOR',
        entidad: 'pedido_proveedor',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: { proveedorId: provPartyId.toString(), lineas: dto.lineas.length },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('compras:pedido_creado', {
      id: resultado.id.toString(),
      proveedor: resultado.proveedor.organizacion?.razon_social || '',
    });

    return {
      id: resultado.id.toString(),
      estado: resultado.estado,
      enviadoEn: resultado.enviado_en,
    };
  }

  async anularPedidoProveedor(
    id: string | number | bigint,
    motivo: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id, 'pedido_proveedor');

    const pedido = await this.prisma.pedidoProveedor.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido a proveedor no existe',
      });
    }

    if (pedido.estado === 'ANULADO') {
      throw new BadRequestException({
        codigo: 'PEDIDO_YA_ANULADO',
        mensaje: 'El pedido ya fue anulado',
      });
    }

    const actualizado = await this.prisma.pedidoProveedor.update({
      where: { id: pedidoId },
      data: {
        estado: 'ANULADO',
        motivo_anulacion: motivo,
      },
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'ANULAR_PEDIDO_PROVEEDOR',
        entidad: 'pedido_proveedor',
        entidadId: pedidoId,
        partyId: usuario.partyId,
        despues: { motivo },
        ip,
      });
    }

    return { ok: true, estado: actualizado.estado };
  }

  // ==========================================
  // COMPRAS Y RECEPCIÓN
  // ==========================================
  async listarCompras(query: ComprasQueryDto) {
    const where: Prisma.CompraWhereInput = {};

    if (query.proveedorPartyId) {
      where.proveedor_party_id = this.parsearId(query.proveedorPartyId, 'proveedor');
    }

    if (query.estado) {
      if (query.estado === 'ANULADA') {
        where.anulada_en = { not: null };
      } else if (query.estado === 'PAGADA') {
        where.pagada_en = { not: null };
        where.anulada_en = null;
      } else if (query.estado === 'RECIBIDA') {
        where.anulada_en = null;
      }
    }

    if (query.condicion) {
      where.condicion = query.condicion;
    }

    if (query.fechaDesde || query.fechaHasta) {
      where.fecha_compra = {};
      if (query.fechaDesde) {
        where.fecha_compra.gte = new Date(query.fechaDesde);
      }
      if (query.fechaHasta) {
        where.fecha_compra.lte = new Date(query.fechaHasta);
      }
    }

    const compras = await this.prisma.compra.findMany({
      where,
      include: {
        proveedor: {
          include: {
            organizacion: true,
            contactos: true,
          },
        },
        lineas: {
          include: { insumo: true },
        },
      },
      orderBy: { fecha_compra: 'desc' },
    });

    let pedidosPorRecibir: any[] = [];
    if (!query.estado || query.estado === 'POR_RECIBIR' || query.estado === 'TODOS') {
      const peds = await this.prisma.pedidoProveedor.findMany({
        where: {
          estado: { in: ['POR_RECIBIR', 'PARCIAL'] },
          proveedor_party_id: query.proveedorPartyId
            ? this.parsearId(query.proveedorPartyId, 'proveedor')
            : undefined,
        },
        include: {
          proveedor: {
            include: { organizacion: true },
          },
          lineas: {
            include: { insumo: true },
          },
        },
        orderBy: { enviado_en: 'desc' },
      });

      pedidosPorRecibir = peds.map((p) => {
        const fecha = p.enviado_en
          ? p.enviado_en.toISOString().split('T')[0].slice(5).replace('-', '/')
          : '';
        const resumen = p.lineas.map((l) => l.insumo.nombre).join(', ');
        const totalAprox = p.lineas.reduce((acc, l) => {
          const costoUnit = Number(l.insumo.costo_unit || 0) * Number(l.insumo.factor_compra || 1);
          return acc + Number(l.cantidad_compra) * costoUnit;
        }, 0);

        return {
          id: `PED-${p.id.toString()}`,
          rawId: p.id.toString(),
          esPedidoPorRecibir: true,
          prov: p.proveedor.organizacion?.razon_social || 'Proveedor',
          proveedorPartyId: p.proveedor_party_id.toString(),
          estado: 'Por recibir',
          stBg: 'rgb(255, 241, 201)',
          fecha,
          resumen,
          comp: 'Pedido WhatsApp',
          pago: 'Pendiente',
          total: totalAprox,
          totalFormatted: `s/ ${totalAprox.toFixed(2)}`,
          lineas: p.lineas.map((l) => ({
            insumoId: l.insumo_id.toString(),
            nombre: l.insumo.nombre,
            cantidad: Number(l.cantidad_compra),
            recibido: Number(l.recibido),
            unidad: l.insumo.unidad_compra,
            costoUnit: Number(l.insumo.costo_unit || 0) * Number(l.insumo.factor_compra || 1),
          })),
        };
      });
    }

    const items = compras.map((c) => {
      const fecha = c.fecha_compra.toISOString().split('T')[0].slice(5).replace('-', '/');
      const resumen = c.lineas.map((l) => l.insumo.nombre).join(', ');
      let estado = 'Recibida';
      let stBg = 'var(--cp-greenbg)';

      if (c.anulada_en) {
        estado = 'Anulada';
        stBg = 'var(--cp-line)';
      } else if (c.condicion === 'CREDITO' && !c.pagada_en) {
        estado = 'Recibida';
        stBg = 'var(--cp-greenbg)';
      } else if (c.pagada_en) {
        estado = 'Pagada';
        stBg = '#E0F2FE';
      }

      return {
        id: `OC-${c.id.toString()}`,
        rawId: c.id.toString(),
        esPedidoPorRecibir: false,
        prov: c.proveedor.organizacion?.razon_social || 'Proveedor',
        proveedorPartyId: c.proveedor_party_id.toString(),
        estado,
        stBg,
        fecha,
        resumen,
        comp: `${c.comprobante_tipo} ${c.comprobante_numero}`,
        pago: c.condicion === 'CREDITO' ? 'Crédito' : 'Contado',
        condicion: c.condicion,
        total: Number(c.total),
        totalFormatted: `s/ ${Number(c.total).toFixed(2)}`,
        pagadaEn: c.pagada_en,
        anuladaEn: c.anulada_en,
        motivoAnulacion: c.motivo_anulacion,
        nota: c.nota || '',
        lineas: c.lineas.map((l) => ({
          id: l.id.toString(),
          insumoId: l.insumo_id.toString(),
          nombre: l.insumo.nombre,
          cantidad: Number(l.cantidad_compra),
          costoUnit: Number(l.costo_unit),
          subtotal: Number(l.cantidad_compra) * Number(l.costo_unit),
          unidad: l.insumo.unidad_compra,
        })),
      };
    });

    let combinados = [...pedidosPorRecibir, ...items];
    if (query.q) {
      const busq = query.q.toLowerCase();
      combinados = combinados.filter(
        (c) =>
          c.prov.toLowerCase().includes(busq) ||
          c.comp.toLowerCase().includes(busq) ||
          c.resumen.toLowerCase().includes(busq),
      );
    }

    return combinados;
  }

  async registrarCompra(dto: CrearCompraDto, usuario?: UsuarioAutenticado, ip?: string) {
    const provPartyId = this.parsearId(dto.proveedorPartyId, 'proveedor');

    const compraExistente = await this.prisma.compra.findFirst({
      where: {
        proveedor_party_id: provPartyId,
        comprobante_tipo: dto.comprobanteTipo,
        comprobante_numero: dto.comprobanteNumero,
      },
    });

    if (compraExistente) {
      throw new ConflictException({
        codigo: 'COMPROBANTE_DUPLICADO',
        mensaje: 'Ya existe una compra registrada con ese mismo tipo y número para este proveedor',
      });
    }

    let almacenLugar = await this.prisma.lugarStock.findFirst({
      where: { tipo: 'ALMACEN' },
    });
    if (!almacenLugar) {
      almacenLugar = await this.prisma.lugarStock.create({
        data: { nombre: 'Almacén central', tipo: 'ALMACEN' },
      });
    }

    const fechaCompra = dto.fechaCompra ? new Date(dto.fechaCompra) : new Date();

    const totalCalculado = dto.lineas.reduce(
      (acc, l) => acc + Number(l.cantidadCompra) * Number(l.costoUnit),
      0,
    );
    const total = dto.total !== undefined ? dto.total : totalCalculado;

    const resultado = await this.prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          proveedor_party_id: provPartyId,
          pedido_proveedor_id: dto.pedidoProveedorId
            ? this.parsearId(dto.pedidoProveedorId, 'pedido_proveedor')
            : null,
          comprobante_tipo: dto.comprobanteTipo,
          comprobante_numero: dto.comprobanteNumero,
          condicion: dto.condicion,
          total: new Prisma.Decimal(total),
          fecha_compra: fechaCompra,
          nota: dto.nota || null,
          pagada_en: dto.condicion === 'CONTADO' ? new Date() : null,
          pagada_por: dto.condicion === 'CONTADO' && usuario ? usuario.partyId : null,
          registrado_por: usuario ? usuario.partyId : null,
        },
      });

      for (const lineaDto of dto.lineas) {
        const insumoId = this.parsearId(lineaDto.insumoId, 'insumo');
        const insumo = await tx.insumo.findUnique({ where: { id: insumoId } });
        if (!insumo) {
          throw new NotFoundException({
            codigo: 'INSUMO_NO_ENCONTRADO',
            mensaje: `El insumo ${lineaDto.insumoId} no existe`,
          });
        }

        await tx.compraLinea.create({
          data: {
            compra_id: compra.id,
            insumo_id: insumoId,
            cantidad_compra: new Prisma.Decimal(lineaDto.cantidadCompra),
            costo_unit: new Prisma.Decimal(lineaDto.costoUnit),
          },
        });

        const factorCompra = Number(insumo.factor_compra) || 1;
        const cantidadAlmacen =
          lineaDto.unidad === 'almacen'
            ? Number(lineaDto.cantidadCompra)
            : Number(lineaDto.cantidadCompra) * factorCompra;

        const costoAlmacen =
          lineaDto.unidad === 'almacen'
            ? Number(lineaDto.costoUnit)
            : Number(lineaDto.costoUnit) / factorCompra;

        await tx.insumo.update({
          where: { id: insumoId },
          data: { costo_unit: new Prisma.Decimal(costoAlmacen) },
        });

        const stockActual = await tx.stock.findFirst({
          where: { insumo_id: insumoId, lugar_id: almacenLugar.id },
        });

        if (stockActual) {
          await tx.stock.update({
            where: { id: stockActual.id },
            data: { cantidad: { increment: new Prisma.Decimal(cantidadAlmacen) } },
          });
        } else {
          await tx.stock.create({
            data: {
              insumo_id: insumoId,
              lugar_id: almacenLugar.id,
              cantidad: new Prisma.Decimal(cantidadAlmacen),
            },
          });
        }

        await tx.movimientoStock.create({
          data: {
            tipo: 'ENTRADA',
            insumo_id: insumoId,
            lugar_id: almacenLugar.id,
            cantidad: new Prisma.Decimal(cantidadAlmacen),
            compra_id: compra.id,
            nota: `Compra ${dto.comprobanteTipo} ${dto.comprobanteNumero}`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
      }

      if (dto.pedidoProveedorId) {
        const pedId = this.parsearId(dto.pedidoProveedorId, 'pedido_proveedor');
        for (const lineaDto of dto.lineas) {
          const insumoId = this.parsearId(lineaDto.insumoId, 'insumo');
          await tx.pedidoProveedorLinea.updateMany({
            where: { pedido_proveedor_id: pedId, insumo_id: insumoId },
            data: { recibido: { increment: new Prisma.Decimal(lineaDto.cantidadCompra) } },
          });
        }

        const pedLineas = await tx.pedidoProveedorLinea.findMany({
          where: { pedido_proveedor_id: pedId },
        });
        const todoRecibido = pedLineas.every(
          (l) => Number(l.recibido) >= Number(l.cantidad_compra),
        );
        await tx.pedidoProveedor.update({
          where: { id: pedId },
          data: { estado: todoRecibido ? 'RECIBIDO' : 'PARCIAL' },
        });
      }

      return compra;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'REGISTRAR_COMPRA',
        entidad: 'compra',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: {
          comprobante: `${dto.comprobanteTipo} ${dto.comprobanteNumero}`,
          total,
          proveedorId: provPartyId.toString(),
        },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('compras:nueva_compra', {
      id: resultado.id.toString(),
      total,
    });

    const insumosIds = dto.lineas.map((l) => this.parsearId(l.insumoId, 'insumo'));
    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados(insumosIds, []);
    }

    return {
      id: resultado.id.toString(),
      total,
      comprobanteTipo: resultado.comprobante_tipo,
      comprobanteNumero: resultado.comprobante_numero,
    };
  }

  async recibirPedidoProveedor(
    pedidoIdRaw: string | number | bigint,
    dto: RecibirPedidoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(pedidoIdRaw, 'pedido_proveedor');
    const pedido = await this.prisma.pedidoProveedor.findUnique({
      where: { id: pedidoId },
      include: { lineas: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'El pedido a proveedor no existe',
      });
    }

    const lineasCompra = dto.lineas.map((l) => ({
      insumoId: l.insumoId,
      cantidadCompra: l.recibido,
      costoUnit: l.costoUnit,
      unidad: 'compra' as const,
    }));

    return this.registrarCompra(
      {
        proveedorPartyId: pedido.proveedor_party_id.toString(),
        pedidoProveedorId: pedidoId.toString(),
        comprobanteTipo: dto.comprobanteTipo,
        comprobanteNumero: dto.comprobanteNumero,
        condicion: dto.condicion,
        diasCredito: dto.diasCredito,
        fechaCompra: dto.fechaCompra,
        nota: dto.nota,
        lineas: lineasCompra,
      },
      usuario,
      ip,
    );
  }

  async marcarPagada(id: string | number | bigint, usuario?: UsuarioAutenticado, ip?: string) {
    const compraId = this.parsearId(id, 'compra');
    const compra = await this.prisma.compra.findUnique({ where: { id: compraId } });

    if (!compra) {
      throw new NotFoundException({
        codigo: 'COMPRA_NO_ENCONTRADA',
        mensaje: 'La compra no existe',
      });
    }

    if (compra.pagada_en) {
      throw new BadRequestException({
        codigo: 'COMPRA_YA_PAGADA',
        mensaje: 'La compra ya se encuentra pagada',
      });
    }

    const actualizada = await this.prisma.compra.update({
      where: { id: compraId },
      data: {
        pagada_en: new Date(),
        pagada_por: usuario ? usuario.partyId : null,
      },
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'MARCAR_COMPRA_PAGADA',
        entidad: 'compra',
        entidadId: compraId,
        partyId: usuario.partyId,
        despues: { pagadaEn: actualizada.pagada_en },
        ip,
      });
    }

    return { ok: true, id: compraId.toString(), pagadaEn: actualizada.pagada_en };
  }

  async anularCompra(
    id: string | number | bigint,
    dto: AnularCompraDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const compraId = this.parsearId(id, 'compra');
    const compra = await this.prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        lineas: { include: { insumo: true } },
      },
    });

    if (!compra) {
      throw new NotFoundException({
        codigo: 'COMPRA_NO_ENCONTRADA',
        mensaje: 'La compra no existe',
      });
    }

    if (compra.anulada_en) {
      throw new BadRequestException({
        codigo: 'COMPRA_YA_ANULADA',
        mensaje: 'La compra ya fue anulada anteriormente',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Marca atómica: dos anulaciones a la vez no devuelven dos veces
      const marcada = await tx.compra.updateMany({
        where: { id: compraId, anulada_en: null },
        data: { anulada_en: new Date(), motivo_anulacion: dto.motivo },
      });
      if (marcada.count === 0) {
        throw new BadRequestException({ codigo: 'COMPRA_YA_ANULADA', mensaje: 'La compra ya fue anulada anteriormente' });
      }

      // Se quita EXACTAMENTE lo que entró (el movimiento ENTRADA ya está en unidad de almacén). Recalcular con
      // cantidad_compra × factor quitaba de más cuando la compra se registró en unidad de almacén.
      const entradas = await tx.movimientoStock.findMany({
        where: { compra_id: compraId, tipo: 'ENTRADA', insumo_id: { not: null } },
      });
      for (const ent of entradas) {
        await tx.stock.updateMany({
          where: { insumo_id: ent.insumo_id!, lugar_id: ent.lugar_id },
          data: { cantidad: { decrement: ent.cantidad } },
        });

        await tx.movimientoStock.create({
          data: {
            tipo: 'ANULACION',
            insumo_id: ent.insumo_id,
            lugar_id: ent.lugar_id,
            cantidad: ent.cantidad.negated(),
            compra_id: compraId,
            nota: `Anulación compra: ${dto.motivo}`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
      }
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'ANULAR_COMPRA',
        entidad: 'compra',
        entidadId: compraId,
        partyId: usuario.partyId,
        despues: { motivo: dto.motivo },
        ip,
      });
    }

    return { ok: true, id: compraId.toString(), anulada: true };
  }

  // ==========================================
  // COMPRA RÁPIDA (SIN PROVEEDOR)
  // ==========================================
  private async obtenerOCrearProveedorGenerico(tx: Prisma.TransactionClient | PrismaService) {
    let party = await tx.party.findFirst({
      where: {
        tipo: 'ORGANIZACION',
        organizacion: {
          razon_social: 'Compras varias (sin proveedor)',
        },
      },
      include: { organizacion: true },
    });

    if (!party) {
      party = await tx.party.create({
        data: {
          tipo: 'ORGANIZACION',
          estado: 'ACTIVO',
          documentos: {
            create: {
              tipo: 'RUC',
              numero: '00000000000',
            },
          },
          organizacion: {
            create: {
              razon_social: 'Compras varias (sin proveedor)',
              nombre_comercial: 'Compra rápida',
            },
          },
          roles: {
            create: {
              rol: 'PROVEEDOR',
            },
          },
        },
        include: { organizacion: true },
      });
    }

    return party;
  }

  async registrarCompraRapida(
    dto: CompraRapidaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const insumoId = this.parsearId(dto.insumoId, 'insumo');
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
    });

    if (!insumo) {
      throw new NotFoundException({
        codigo: 'INSUMO_NO_ENCONTRADO',
        mensaje: 'El insumo no existe',
      });
    }

    let almacenLugar = await this.prisma.lugarStock.findFirst({
      where: { tipo: 'ALMACEN' },
    });
    if (!almacenLugar) {
      almacenLugar = await this.prisma.lugarStock.create({
        data: { nombre: 'Almacén central', tipo: 'ALMACEN' },
      });
    }

    const cantidadDecimal = new Prisma.Decimal(dto.cantidad);
    const costoTotalDecimal = new Prisma.Decimal(dto.costoTotal);
    const costoUnit = dto.cantidad > 0 ? Number(dto.costoTotal) / Number(dto.cantidad) : 0;
    const factorCompra = Number(insumo.factor_compra) || 1;
    const costoUnitAlmacen = costoUnit;

    const resultado = await this.prisma.$transaction(async (tx) => {
      const provGenerico = await this.obtenerOCrearProveedorGenerico(tx);
      const timestamp = Date.now();
      const comprobanteNum = `CR-${timestamp}`;

      const notaFinal = `Compra rápida (${dto.medioPago})${dto.nota ? ` · ${dto.nota}` : ''}`;

      const compra = await tx.compra.create({
        data: {
          proveedor_party_id: provGenerico.id,
          comprobante_tipo: 'COMPRA_RAPIDA',
          comprobante_numero: comprobanteNum,
          condicion: 'CONTADO',
          total: costoTotalDecimal,
          fecha_compra: new Date(),
          nota: notaFinal,
          pagada_en: new Date(),
          pagada_por: usuario ? usuario.partyId : null,
          registrado_por: usuario ? usuario.partyId : null,
        },
      });

      await tx.compraLinea.create({
        data: {
          compra_id: compra.id,
          insumo_id: insumoId,
          cantidad_compra: cantidadDecimal,
          costo_unit: new Prisma.Decimal(costoUnit),
        },
      });

      // Actualizar costo unitario del insumo
      await tx.insumo.update({
        where: { id: insumoId },
        data: { costo_unit: new Prisma.Decimal(costoUnitAlmacen) },
      });

      // Incrementar stock en almacén central
      const stockActual = await tx.stock.findFirst({
        where: { insumo_id: insumoId, lugar_id: almacenLugar.id },
      });

      let nuevoStockNum = Number(dto.cantidad);
      if (stockActual) {
        const updated = await tx.stock.update({
          where: { id: stockActual.id },
          data: { cantidad: { increment: cantidadDecimal } },
        });
        nuevoStockNum = Number(updated.cantidad);
      } else {
        await tx.stock.create({
          data: {
            insumo_id: insumoId,
            lugar_id: almacenLugar.id,
            cantidad: cantidadDecimal,
          },
        });
      }

      // Crear movimiento de stock ENTRADA
      const mov = await tx.movimientoStock.create({
        data: {
          tipo: 'ENTRADA',
          insumo_id: insumoId,
          lugar_id: almacenLugar.id,
          cantidad: cantidadDecimal,
          compra_id: compra.id,
          nota: notaFinal,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      return { compra, mov, nuevoStock: nuevoStockNum };
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'compras',
        accion: 'COMPRA_RAPIDA',
        entidad: 'compra',
        entidadId: resultado.compra.id,
        partyId: usuario.partyId,
        despues: {
          insumo: insumo.nombre,
          cantidad: dto.cantidad,
          costoTotal: dto.costoTotal,
          medioPago: dto.medioPago,
          nota: dto.nota,
        },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {
      insumoId: insumoId.toString(),
      lugarId: almacenLugar.id.toString(),
    });

    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados([insumoId], []);
    }

    return {
      ok: true,
      id: resultado.compra.id.toString(),
      movimientoId: resultado.mov.id.toString(),
      insumo: insumo.nombre,
      cantidad: dto.cantidad,
      costoTotal: dto.costoTotal,
      medioPago: dto.medioPago,
      nuevoStock: resultado.nuevoStock,
    };
  }
}
