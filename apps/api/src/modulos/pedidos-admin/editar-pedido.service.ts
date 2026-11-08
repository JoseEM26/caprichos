import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PedidosService } from '../pedidos/pedidos.service';
import { PagoPlanService, PlanPagoItem } from '../pedidos/pago-plan.service';
import { ZonasService } from '../zonas/zonas.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { calcularEnvioDelivery } from '../ofertas/envio-gratis-promo';
import { ImpresionService } from '../impresion/impresion.service';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import { PartyPuntosService } from '../clientes/party-puntos.service';
import { tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { RequisitoOpcion, lineasDeRequisitosOpcion, requisitosDeOpciones } from '../stock/opcion-requiere';
import { LineaVentaProducto, ajustarVentaProductos } from '../stock/producto-controlado';
import { EditarPedidoDto, LineaEdicionDto } from './dto/editar-pedido.dto';

/** Estados en que todavía se puede editar un pedido (y solo si no está cobrado). */
export const ESTADOS_EDITABLES = ['COLA', 'PREPARANDO', 'LISTO'];
/** Una persona «está editando» hasta 2 minutos después de su última señal. */
export const EXPIRA_EDITANDO_MS = 2 * 60 * 1000;

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Ajusta el plan de pago al nuevo total a cobrar (total + propina): la diferencia la absorbe el renglón de efectivo
 * y, si no hay, el último; si un renglón queda en cero, se quita. Función pura.
 */
export function ajustarPlanAlTotal(plan: PlanPagoItem[], aCobrar: number): PlanPagoItem[] {
  const filas = plan.map((f) => ({ ...f, monto: Number(f.monto) }));
  let diff = redondear(aCobrar - redondear(filas.reduce((a, f) => a + f.monto, 0)));
  if (diff === 0 || filas.length === 0) return filas;
  const prioridad = filas
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.medio === 'EFECTIVO' ? -1 : 0) - (b.f.medio === 'EFECTIVO' ? -1 : 0) || b.i - a.i)
    .map((x) => x.f);
  if (diff > 0) {
    prioridad[0].monto = redondear(prioridad[0].monto + diff);
  } else {
    diff = -diff;
    for (const f of prioridad) {
      const quita = Math.min(f.monto, diff);
      f.monto = redondear(f.monto - quita);
      diff = redondear(diff - quita);
      if (diff <= 0) break;
    }
  }
  return filas.filter((f) => f.monto > 0.004);
}

/** Texto corto de una línea para el resumen y la auditoría. */
const textoLinea = (l: { cantidad: number; nombre: string; tamano?: string | null }) =>
  `${l.cantidad} × ${l.nombre}${l.tamano ? ` (${l.tamano})` : ''}`;

type LineaDb = any;

@Injectable()
export class EditarPedidoService {
  /** Quién tiene abierto el editor de cada pedido (en memoria: solo es un aviso, no un candado). */
  private readonly editando = new Map<string, { partyId: string; nombre: string; hasta: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosService,
    private readonly zonas: ZonasService,
    private readonly ofertas: OfertasService,
    private readonly pagoPlan: PagoPlanService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly impresion?: ImpresionService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly direcciones?: DireccionesClienteService,
    @Optional() private readonly puntosParty?: PartyPuntosService,
  ) {}

  parseId(idRaw: string | bigint | number): bigint {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    return BigInt(idRaw);
  }

  /** Por qué un pedido ya no se puede editar (mensaje en español simple), o null si se puede. */
  motivoNoEditable(
    pedido: {
      estado: string;
      pago_estado: string | null;
      cobro_mozo_en: Date | null;
      cupon_id: bigint | null;
      cupon_emitido_id: bigint | null;
      puntos_canjeados: unknown;
      salio_en: Date | null;
      lineas: Array<{ es_cortesia: boolean }>;
    },
    tieneCobroVigente: boolean,
  ): string | null {
    if (pedido.estado === 'ENTREGADO') return 'Este pedido ya fue entregado y no se puede editar.';
    if (pedido.estado === 'ANULADO' || pedido.estado === 'RECHAZADO') return 'Este pedido está anulado y no se puede editar.';
    if (!ESTADOS_EDITABLES.includes(pedido.estado)) {
      return 'Este pedido todavía no está en preparación. Confírmalo primero para poder editarlo.';
    }
    if (pedido.pago_estado === 'PAGADO' || tieneCobroVigente || pedido.cobro_mozo_en) {
      return 'Este pedido ya está cobrado y no se puede editar. Anula el cobro si necesitas cambiarlo.';
    }
    if (pedido.cupon_id || pedido.cupon_emitido_id) return 'Este pedido usó un cupón y no se puede editar.';
    if (Number(pedido.puntos_canjeados ?? 0) > 0) return 'Este pedido canjeó puntos y no se puede editar.';
    if (pedido.lineas.some((l) => l.es_cortesia)) return 'Este pedido tiene una cortesía y no se puede editar.';
    if (pedido.salio_en) return 'El repartidor ya salió con este pedido y no se puede editar.';
    return null;
  }

  private exigirEditable(pedido: Parameters<EditarPedidoService['motivoNoEditable']>[0], tieneCobroVigente: boolean) {
    const motivo = this.motivoNoEditable(pedido, tieneCobroVigente);
    if (motivo) throw new ConflictException({ codigo: 'PEDIDO_NO_EDITABLE', mensaje: motivo });
  }

  private incluirPedido() {
    return {
      lineas: {
        orderBy: { id: 'asc' as const },
        include: { opcionesElegidas: true, sabores: true, lineasComboHijas: { include: { sabores: true } } },
      },
      planPago: { orderBy: { orden: 'asc' as const } },
      comandas: true,
      cobros: { where: { anulado_en: null }, select: { id: true }, take: 1 },
    };
  }

  /** Datos del pedido para abrir el editor: líneas con su selección (ids), cliente, entrega, versión y quién lo edita. */
  async obtenerParaEditar(idRaw: string, usuario: UsuarioAutenticado) {
    const id = this.parseId(idRaw);
    const pedido: any = await this.prisma.pedido.findUnique({ where: { id }, include: { ...this.incluirPedido(), zona: true } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    this.exigirEditable(pedido, pedido.cobros.length > 0);

    const filas: LineaDb[] = pedido.lineas.filter((l: LineaDb) => l.linea_combo_id == null);
    const productos = await this.productosPorIds(filas.map((l) => l.producto_id).filter(Boolean));
    const vouchers = await this.prisma.voucherPago.count({ where: { pedido_id: id, reemplazado_en: null } });
    const actual = this.editando.get(String(id));
    const otro = actual && actual.hasta > Date.now() && actual.partyId !== String(usuario.partyId) ? actual : null;

    return {
      id: String(pedido.id),
      codigo: pedido.codigo,
      version: pedido.version,
      estado: pedido.estado,
      modalidad: pedido.modalidad,
      canal: pedido.canal,
      mesa: pedido.mesa_nombre,
      cliente: { nombre: pedido.cliente_nombre, telefono: tieneTelefonoReal(pedido.cliente_telefono) ? pedido.cliente_telefono : null },
      entrega: {
        direccion: pedido.entrega_direccion,
        referencia: pedido.entrega_referencia,
        lat: pedido.entrega_lat != null ? Number(pedido.entrega_lat) : null,
        lng: pedido.entrega_lng != null ? Number(pedido.entrega_lng) : null,
        origen: pedido.entrega_origen,
        zona: pedido.zona?.codigo ?? null,
      },
      subtotal: Number(pedido.subtotal),
      descuento: Number(pedido.descuento),
      envio: pedido.envio != null ? Number(pedido.envio) : null,
      total: Number(pedido.total),
      propina: Number(pedido.propina ?? 0),
      tieneVoucher: vouchers > 0,
      editandoPor: otro ? { partyId: otro.partyId, nombre: otro.nombre } : null,
      lineas: filas.map((l) => {
        const prod = l.producto_id ? productos.get(String(l.producto_id)) : undefined;
        const tam = l.tamano ? this.tamanosDe(prod).find((t) => t.nombre === l.tamano) : undefined;
        return {
          lineaId: String(l.id),
          productoId: l.producto_id != null ? String(l.producto_id) : null,
          nombre: l.nombre,
          tamano: l.tamano,
          tamanoId: tam ? String(tam.id) : null,
          cantidad: l.cantidad,
          precioUnitario: Number(l.precio_unit),
          subtotal: Number(l.subtotal ?? 0),
          opciones: l.opcionesElegidas.map((o: any) => ({
            id: o.opcion_id != null ? String(o.opcion_id) : null,
            nombre: o.opcion_nombre,
            grupo: o.grupo_nombre,
            precioExtra: Number(o.precio_extra),
          })),
          sabores: l.sabores.map((s: any) => ({ saborId: String(s.sabor_id), nombre: s.sabor_nombre, cantidad: s.cantidad })),
          nota: l.nota,
          personas: l.nombres_persona,
          ofertaId: l.oferta_id != null ? String(l.oferta_id) : null,
          // Un combo no se modifica: se puede quitar o dejar tal cual (para cambiarlo, se quita y se agrega otro)
          bloqueada: l.oferta_id != null && l.lineasComboHijas.length > 0,
          partesCombo: l.lineasComboHijas.map((h: any) => ({ nombre: h.nombre, cantidad: h.cantidad })),
        };
      }),
    };
  }

  /** Avisa que alguien abrió (o cerró) el editor de un pedido; vale 2 minutos si no vuelve a avisar. */
  async marcarEditando(idRaw: string, activo: boolean, usuario: UsuarioAutenticado) {
    const id = this.parseId(idRaw);
    const clave = String(id);
    const nombre = await this.nombreDe(usuario.partyId);
    if (activo) {
      this.editando.set(clave, { partyId: String(usuario.partyId), nombre, hasta: Date.now() + EXPIRA_EDITANDO_MS });
    } else if (this.editando.get(clave)?.partyId === String(usuario.partyId)) {
      this.editando.delete(clave);
    }
    this.emitir('pedido:editando', { id: clave, activo, partyId: String(usuario.partyId), nombre, expiraEnMs: EXPIRA_EDITANDO_MS });
    return { ok: true };
  }

  private async nombreDe(partyId: bigint | string | number): Promise<string> {
    try {
      const p = await this.prisma.person.findUnique({ where: { party_id: BigInt(partyId) }, select: { nombres: true } });
      return (p?.nombres ?? '').trim().split(/\s+/)[0] || 'Alguien';
    } catch {
      return 'Alguien';
    }
  }

  private emitir(evento: string, datos: unknown) {
    try {
      this.eventos?.emitirAdmin(evento, datos);
    } catch {
      // Sin socket (pruebas): no bloquea
    }
  }

  private tamanosDe(prod: any): Array<{ id: bigint; nombre: string; unidades: number }> {
    return (prod?.tamanos ?? []).map((t: any) => ({
      id: t.id,
      nombre: t.tamano_valor?.nombre || `Tamaño ${t.id}`,
      unidades: t.unidades ?? 1,
    }));
  }

  private async productosPorIds(ids: Array<bigint | string | number>): Promise<Map<string, any>> {
    const unicos = [...new Set(ids.filter((x) => x != null).map((x) => String(x)))].map((x) => BigInt(x));
    if (unicos.length === 0) return new Map();
    const filas = await this.prisma.producto.findMany({
      where: { id: { in: unicos } },
      select: { id: true, categoria_id: true, no_suma_beneficios: true, tamanos: { include: { tamano_valor: true } } },
    });
    return new Map(filas.map((p: any) => [String(p.id), p]));
  }

  /** La línea guardada y la que llega del editor tienen exactamente la misma selección (no hay nada que rehacer). */
  private mismaSeleccion(fila: LineaDb, l: LineaEdicionDto, productos: Map<string, any>): boolean {
    if (fila.oferta_id != null && fila.lineasComboHijas.length > 0) {
      if (Number(l.cantidad) !== fila.cantidad || String(l.ofertaId ?? '') !== String(fila.oferta_id)) {
        throw new BadRequestException({
          codigo: 'COMBO_NO_EDITABLE',
          mensaje: `El combo «${fila.nombre}» no se modifica: quítalo y agrega otro.`,
        });
      }
      return true;
    }
    if (String(l.productoId) !== String(fila.producto_id ?? '')) return false;
    if (Number(l.cantidad) !== fila.cantidad) return false;
    const prod = productos.get(String(fila.producto_id));
    const tam = l.tamanoId != null && l.tamanoId !== '' ? this.tamanosDe(prod).find((t) => String(t.id) === String(l.tamanoId)) : undefined;
    if ((tam?.nombre ?? null) !== (fila.tamano ?? null)) return false;
    if (String(l.ofertaId ?? '') !== String(fila.oferta_id ?? '')) return false;
    const ordenar = (a: string[]) => [...a].sort().join(',');
    if (ordenar((l.opciones ?? []).map(String)) !== ordenar(fila.opcionesElegidas.filter((o: any) => o.opcion_id != null).map((o: any) => String(o.opcion_id)))) return false;
    const sab = (a: Array<{ saborId: unknown; cantidad: number }>) => ordenar(a.map((s) => `${s.saborId}:${s.cantidad}`));
    if (sab(l.sabores ?? []) !== sab(fila.sabores.map((s: any) => ({ saborId: s.sabor_id, cantidad: s.cantidad })))) return false;
    if ((l.nota?.trim() || null) !== (fila.nota || null)) return false;
    if (l.personas !== undefined && JSON.stringify(l.personas.map((p) => p.trim())) !== JSON.stringify(fila.nombres_persona)) return false;
    return true;
  }

  /** Lo que una línea ya guardada tenía descontado del stock (para devolverlo si se quita o cambia). */
  private async ventaDeFila(db: Prisma.TransactionClient, fila: LineaDb, productos: Map<string, any>): Promise<LineaVentaProducto[]> {
    const unidades = (productoId: bigint | null, tamano: string | null) =>
      productoId && tamano ? (this.tamanosDe(productos.get(String(productoId))).find((t) => t.nombre === tamano)?.unidades ?? 1) : 1;
    const items: LineaVentaProducto[] = [];
    const hijas: LineaDb[] = fila.lineasComboHijas ?? [];
    const opcionIds: bigint[] = fila.opcionesElegidas.filter((o: any) => o.opcion_id != null).map((o: any) => o.opcion_id);
    const reqs = await requisitosDeOpciones(db, opcionIds);
    const requisitos: RequisitoOpcion[] = opcionIds
      .flatMap((oid) => (reqs.get(oid.toString()) ?? []).map((r) => ({ ...r, cantidad: r.cantidad * fila.cantidad })))
      .filter((r) => !hijas.some((h) => String(h.producto_id) === r.productoId));
    try {
      items.push(...(await lineasDeRequisitosOpcion(db, requisitos)));
    } catch {
      // Sin saldo para repartir el requisito entre sabores: se ignora (el ajuste usa lo que quedó anotado en el almacén)
    }
    const saboresDe = (f: LineaDb) => f.sabores.map((s: any) => ({ saborId: s.sabor_id, nombre: s.sabor_nombre, cantidad: s.cantidad }));
    if (fila.producto_id) {
      items.push({
        productoId: fila.producto_id,
        cantidad: fila.cantidad * unidades(fila.producto_id, fila.tamano),
        areaId: fila.area_id,
        sabores: saboresDe(fila),
      });
    }
    for (const h of hijas) {
      if (!h.producto_id) continue;
      items.push({ productoId: h.producto_id, cantidad: h.cantidad * unidades(h.producto_id, h.tamano), areaId: h.area_id, sabores: saboresDe(h) });
    }
    return items;
  }

  /**
   * Guarda la edición de un pedido sin cobrar, todo en UNA transacción: recalcula subtotal, descuentos, envío y total
   * con la misma lógica de la creación, ajusta stock, comanda de cocina y plan de pago, sube la versión y audita
   * antes/después. Con una versión vieja responde 409 PEDIDO_MODIFICADO.
   */
  async editar(idRaw: string, dto: EditarPedidoDto, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.parseId(idRaw);
    const pedido: any = await this.prisma.pedido.findUnique({ where: { id }, include: this.incluirPedido() });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    this.exigirVersion(pedido.version, dto.version);
    this.exigirEditable(pedido, pedido.cobros.length > 0);

    // 1. Qué líneas se quedan, cuáles se quitan y cuáles son nuevas
    const filas: LineaDb[] = pedido.lineas.filter((l: LineaDb) => l.linea_combo_id == null);
    const porId = new Map<string, LineaDb>(filas.map((f) => [String(f.id), f]));
    const anfitriones = await this.anfitrionesDeCombos(filas);
    const productos = await this.productosPorIds([
      ...filas.map((f) => f.producto_id),
      ...filas.flatMap((f) => f.lineasComboHijas.map((h: LineaDb) => h.producto_id)),
      ...anfitriones.values(),
      ...dto.lineas.map((l) => l.productoId as any),
    ]);
    const mantenidas = new Map<string, LineaDb>();
    const nuevasDto: LineaEdicionDto[] = [];
    const cambiadas: Array<{ fila: LineaDb; despues: LineaEdicionDto }> = [];
    for (const l of dto.lineas) {
      const fila = l.lineaId != null && l.lineaId !== '' ? porId.get(String(l.lineaId)) : undefined;
      if (l.lineaId != null && l.lineaId !== '' && !fila) {
        throw new BadRequestException({ codigo: 'LINEA_INVALIDA', mensaje: 'Una de las líneas no pertenece a este pedido. Vuelve a abrir el editor.' });
      }
      if (fila && !mantenidas.has(String(fila.id)) && this.mismaSeleccion(fila, l, productos)) {
        mantenidas.set(String(fila.id), fila);
      } else {
        if (fila) cambiadas.push({ fila, despues: l });
        nuevasDto.push(l);
      }
    }
    const quitadas = filas.filter((f) => !mantenidas.has(String(f.id)));

    // 2. Validar y calcular solo las líneas nuevas o cambiadas (las que no cambian conservan su precio y su stock)
    const clienteNombre = (dto.cliente?.nombre?.trim() || pedido.cliente_nombre || null) as string | null;
    if (dto.cliente?.nombre !== undefined && (dto.cliente.nombre.trim().length < 2) && pedido.canal !== 'MOZO' && pedido.canal !== 'CAJA') {
      throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe el nombre del cliente (mínimo 2 letras)' });
    }
    const calculo = nuevasDto.length > 0
      ? await this.pedidos.calcularLineasPedido(nuevasDto, clienteNombre, { canal: pedido.canal as any }, pedido.modalidad)
      : { lineasCalculadas: [] as any[], subtotalCalculado: 0 };
    const lineasNuevas = calculo.lineasCalculadas;
    const subtotal = redondear(
      [...mantenidas.values()].reduce((a, f) => a + Number(f.subtotal ?? Number(f.precio_unit) * f.cantidad), 0) + calculo.subtotalCalculado,
    );

    // 3. Descuentos automáticos con la misma lógica de la creación (sin cupón: los pedidos con cupón no se editan)
    const lineasDescuento = [
      ...[...mantenidas.values()].map((f) => {
        const productoId = f.producto_id ?? anfitriones.get(String(f.oferta_id)) ?? null;
        const prod = productoId ? productos.get(String(productoId)) : undefined;
        return productoId
          ? { productoId, categoriaId: prod?.categoria_id ?? null, cantidad: f.cantidad, subtotal: Number(f.subtotal ?? 0), precioUnitario: Number(f.precio_unit), noSumaBeneficios: !!prod?.no_suma_beneficios }
          : null;
      }),
      ...lineasNuevas.map((l) => ({
        productoId: l.productoId,
        categoriaId: l.categoriaId,
        cantidad: l.cantidad,
        subtotal: l.subtotal,
        precioUnitario: l.precioUnitario,
        noSumaBeneficios: l.noSumaBeneficios,
      })),
    ].filter(Boolean) as any[];
    const desglose = await this.ofertas.calcularDescuentosParaPedido({
      subtotal,
      lineas: lineasDescuento,
      canal: pedido.canal,
      modalidad: pedido.modalidad,
      cuponCodigo: undefined,
      clientePartyId: pedido.cliente_party_id,
      clienteConSesion: pedido.canal === 'CARTA' && !!pedido.party_id,
    });
    const descuento = desglose.descuentoTotal;

    // 4. Modalidad, entrega y envío
    const entregaNueva = await this.resolverEntrega(pedido, dto, subtotal);
    const total = redondear(Math.max(0, subtotal - descuento + (entregaNueva.envio ?? 0)));

    // 5. Datos del cliente
    let telefono: string | null = tieneTelefonoReal(pedido.cliente_telefono) ? pedido.cliente_telefono : null;
    let clientePartyId: bigint | null = pedido.cliente_party_id;
    if (dto.cliente !== undefined) {
      const tel = dto.cliente.telefono?.trim() || null;
      if (tel !== telefono) {
        telefono = tel;
        clientePartyId = tel ? ((await this.direcciones?.resolverPartyPorTelefono(tel)) ?? (await this.puntosParty?.resolverOCrear(tel)) ?? null) : null;
      }
    }

    // 6. Foto de las etiquetas de antes (para reimprimir solo las que cambien)
    const etiquetasAntes = (await this.impresion?.capturarEtiquetas(id)) ?? new Map<string, string>();

    // 7. Todo en una transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pedido WHERE id = ${id} FOR UPDATE`;
      const vivo: any = await tx.pedido.findUnique({
        where: { id },
        include: { cobros: { where: { anulado_en: null }, select: { id: true }, take: 1 }, lineas: { select: { es_cortesia: true } } },
      });
      if (!vivo) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
      this.exigirVersion(vivo.version, dto.version);
      this.exigirEditable(vivo, vivo.cobros.length > 0);

      // Líneas: se borran las quitadas/cambiadas (con sus hijas, opciones y sabores) y se escriben las nuevas
      const idsQuitar = quitadas.flatMap((f) => [f.id, ...f.lineasComboHijas.map((h: LineaDb) => h.id)]);
      const venta = await Promise.all(quitadas.map((f) => this.ventaDeFila(tx, f, productos)));
      if (idsQuitar.length > 0) {
        await tx.pedidoLineaSabor.deleteMany({ where: { pedido_linea_id: { in: idsQuitar } } });
        await tx.pedidoLineaOpcion.deleteMany({ where: { pedido_linea_id: { in: idsQuitar } } });
        await tx.pedidoLinea.deleteMany({ where: { linea_combo_id: { in: idsQuitar }, pedido_id: id } });
        await tx.pedidoLinea.deleteMany({ where: { id: { in: idsQuitar } } });
      }
      if (lineasNuevas.length > 0) {
        await this.pedidos.escribirLineasPedido(tx, id, lineasNuevas, clienteNombre, { canal: pedido.canal as any });
      }

      // Stock: devuelve lo de las líneas quitadas y descuenta lo nuevo (409 si no alcanza y todo se deshace)
      const agregar = await this.pedidos.ventaDeLineas(tx, lineasNuevas);
      const agotados = await ajustarVentaProductos(tx, id, venta.flat(), agregar, BigInt(usuario.partyId));

      // Comanda de cocina y estado
      const estadoNuevo = await this.sincronizarCocina(tx, id, pedido, lineasNuevas.length > 0, usuario);

      // Plan de pago y «pagaCon» al nuevo total
      const aCobrar = redondear(total + Number(pedido.propina ?? 0));
      let planNuevo: PlanPagoItem[] | null = null;
      const planViejo: PlanPagoItem[] = (pedido.planPago ?? []).map((f: any) => ({ medio: f.medio, monto: Number(f.monto) }));
      const datosPago: Prisma.PedidoUncheckedUpdateInput = {};
      if (planViejo.length > 0 && total !== Number(pedido.total)) {
        planNuevo = ajustarPlanAlTotal(planViejo, aCobrar);
        await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: id } });
        if (planNuevo.length > 0) {
          await this.pagoPlan.guardar(tx, id, planNuevo);
          datosPago.pago_metodo = this.pagoPlan.pagoPrincipal(planNuevo);
          datosPago.pago_preferido = this.pagoPlan.pagoPrincipal(planNuevo);
        }
      }
      const efectivo = planNuevo ? this.pagoPlan.montoEfectivo(planNuevo) : pedido.pago_metodo === 'EFECTIVO' ? aCobrar : 0;
      if (pedido.paga_con != null && (efectivo <= 0 || Number(pedido.paga_con) < efectivo)) datosPago.paga_con = null;

      const ofertaId = desglose.ofertaId
        ? BigInt(desglose.ofertaId)
        : ([...mantenidas.values()].find((f) => f.oferta_id)?.oferta_id ?? lineasNuevas.find((l) => l.ofertaId)?.ofertaId ?? null);
      const actualizado = await tx.pedido.update({
        where: { id },
        data: {
          ...datosPago,
          modalidad: entregaNueva.modalidad,
          cliente_nombre: clienteNombre,
          cliente_telefono: telefono,
          cliente_party_id: clientePartyId,
          entrega_direccion: entregaNueva.direccion,
          entrega_referencia: entregaNueva.referencia,
          entrega_lat: entregaNueva.lat != null ? new Prisma.Decimal(entregaNueva.lat) : null,
          entrega_lng: entregaNueva.lng != null ? new Prisma.Decimal(entregaNueva.lng) : null,
          entrega_origen: entregaNueva.origen,
          zona_id: entregaNueva.zonaId,
          subtotal: new Prisma.Decimal(subtotal),
          descuento: new Prisma.Decimal(descuento),
          envio: entregaNueva.envio !== null ? new Prisma.Decimal(entregaNueva.envio) : null,
          total: new Prisma.Decimal(total),
          oferta_id: ofertaId,
          descuento_detalle: desglose.detalles.length > 0 ? (desglose.detalles as any) : Prisma.DbNull,
          version: { increment: 1 },
        },
      });

      // Auditoría: quién, cuándo (marca de tiempo de la fila) y qué cambió, antes y después, por línea y por dato
      const cambios = this.armarCambios(pedido, { clienteNombre, telefono, entrega: entregaNueva, subtotal, descuento, total }, quitadas, cambiadas, lineasNuevas, nuevasDto);
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: 'EDITAR_PEDIDO',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: id,
          antes: { version: pedido.version, subtotal: Number(pedido.subtotal), descuento: Number(pedido.descuento), envio: pedido.envio != null ? Number(pedido.envio) : null, total: Number(pedido.total), plan: planViejo },
          despues: { version: actualizado.version, subtotal, descuento, envio: entregaNueva.envio, total, plan: planNuevo, cambios: cambios.detalle, resumen: cambios.resumen },
          partyId: usuario.partyId,
          ip,
        },
        tx,
      );
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: id,
          estado_anterior: pedido.estado,
          estado_nuevo: estadoNuevo,
          motivo: `Pedido editado: ${cambios.resumen.join('; ') || 'sin cambios en productos'}`.slice(0, 480),
          por_party_id: BigInt(usuario.partyId),
        },
      });
      return { actualizado, agotados, cambios, estadoNuevo, planNuevo };
    });

    // 8. Fuera de la transacción: etiquetas nuevas, disponibilidad de la carta y tiempo real
    await this.impresion?.encolarEtiquetasEditadas(id, etiquetasAntes);
    const huboStock = resultado.agotados.agotados.length > 0 || resultado.agotados.saboresAgotados.length > 0;
    if (huboStock || quitadas.length > 0 || lineasNuevas.length > 0) this.emitir('stock:cambio', {});
    if (huboStock) await this.emitirDisponibilidad();
    this.editando.delete(String(id));
    this.emitir('pedido:editando', { id: String(id), activo: false, partyId: String(usuario.partyId), nombre: '' });
    this.emitir('pedido:editado', {
      id: String(id),
      codigo: pedido.codigo,
      estado: resultado.estadoNuevo,
      version: resultado.actualizado.version,
      por: String(usuario.partyId),
    });
    if (resultado.estadoNuevo !== pedido.estado) {
      this.emitir('pedido:estado', { id: String(id), codigo: pedido.codigo, estado: resultado.estadoNuevo });
    }

    return {
      id: String(id),
      codigo: pedido.codigo,
      version: resultado.actualizado.version,
      estado: resultado.estadoNuevo,
      subtotal,
      descuento,
      envio: entregaNueva.envio,
      total,
      totalAnterior: Number(pedido.total),
      cambios: resultado.cambios.resumen,
      mensaje: 'Pedido actualizado',
    };
  }

  private exigirVersion(actual: number, vista: number) {
    if (actual !== vista) {
      throw new ConflictException({
        codigo: 'PEDIDO_MODIFICADO',
        mensaje: 'Alguien más cambió este pedido mientras lo editabas. Revisa los cambios y vuelve a intentar.',
        version: actual,
      });
    }
  }

  /** Oferta COMBO → producto anfitrión (la línea madre guarda producto_id nulo). */
  private async anfitrionesDeCombos(filas: LineaDb[]): Promise<Map<string, bigint>> {
    const ids = [...new Set(filas.filter((f) => f.producto_id == null && f.oferta_id != null).map((f) => f.oferta_id as bigint))];
    if (ids.length === 0) return new Map();
    const ofertas = await this.prisma.oferta.findMany({ where: { id: { in: ids } }, select: { id: true, alcance_producto_id: true } });
    return new Map(ofertas.filter((o) => o.alcance_producto_id != null).map((o) => [String(o.id), o.alcance_producto_id as bigint]));
  }

  /** Modalidad, dirección, zona y envío del pedido editado (misma lógica de la creación y del cambio de ubicación). */
  private async resolverEntrega(pedido: any, dto: EditarPedidoDto, subtotal: number) {
    const modalidad = dto.modalidad ?? pedido.modalidad;
    if ((pedido.modalidad === 'MESA') !== (modalidad === 'MESA')) {
      throw new ConflictException({
        codigo: 'MODALIDAD_NO_EDITABLE',
        mensaje: 'Un pedido de mesa no puede pasar a llevar o delivery (ni al revés). Anúlalo y crea uno nuevo.',
      });
    }
    const base = { modalidad, direccion: null as string | null, referencia: null as string | null, lat: null as number | null, lng: null as number | null, origen: null as string | null, zonaId: null as bigint | null, envio: 0 as number | null, promoId: null as string | null };
    if (modalidad !== 'DELIVERY') return base;

    const e = dto.entrega;
    const direccion = (e ? e.direccion : pedido.entrega_direccion)?.trim() || null;
    const referencia = (e ? e.referencia : pedido.entrega_referencia)?.trim() || null;
    const lat = e ? (typeof e.lat === 'number' ? e.lat : null) : pedido.entrega_lat != null ? Number(pedido.entrega_lat) : null;
    const lng = e ? (typeof e.lng === 'number' ? e.lng : null) : pedido.entrega_lng != null ? Number(pedido.entrega_lng) : null;

    let envio: number | null = 0;
    let zonaId: bigint | null = null;
    let origen: string | null;
    let promoId: string | null = null;
    if (lat !== null && lng !== null) {
      const zona = await this.zonas.detectar(lat, lng);
      if (!zona) {
        throw new ConflictException({ codigo: 'FUERA_DE_COBERTURA', mensaje: 'La ubicación indicada se encuentra fuera de nuestra zona de cobertura' });
      }
      zonaId = zona.zonaId;
      const calculo = await calcularEnvioDelivery(this.prisma, { subtotal, tarifaZona: Number(zona.tarifa), canal: pedido.canal, ahora: pedido.creado_en, envioGratisCupon: false });
      envio = calculo.envio;
      promoId = calculo.promo ? String(calculo.promo.id) : null;
      origen = e?.origen ?? pedido.entrega_origen ?? 'GPS';
    } else if (direccion && direccion.length >= 5) {
      if (pedido.canal === 'CARTA' && (referencia?.length ?? 0) < 3) {
        throw new BadRequestException({ codigo: 'REFERENCIA_REQUERIDA', mensaje: 'Para delivery escribe una referencia (por ejemplo: frente al parque, portón negro)' });
      }
      envio = null;
      origen = 'ESCRITA';
    } else {
      throw new BadRequestException({
        codigo: 'UBICACION_REQUERIDA',
        mensaje: 'Para delivery se requiere ubicación en el mapa o una dirección escrita de al menos 5 caracteres',
      });
    }

    const param = await this.prisma.parametro.findUnique({ where: { clave: 'pedido_minimo' } });
    const minimo = typeof param?.valor === 'number' ? param.valor : Number(param?.valor) || 0;
    if (minimo > 0 && subtotal < minimo) {
      const faltante = redondear(minimo - subtotal);
      throw new BadRequestException({
        codigo: 'PEDIDO_MINIMO',
        mensaje: `El pedido mínimo para delivery es S/ ${minimo.toFixed(2)}; te faltan S/ ${faltante.toFixed(2)}`,
        minimo,
        faltante,
      });
    }
    return { modalidad, direccion, referencia, lat, lng, origen, zonaId, envio, promoId };
  }

  /**
   * Deja la comanda de cocina al día: crea la de un área nueva, quita la de un área que ya no tiene líneas y reabre
   * la despejada si le llegó una línea sin preparar. Las líneas que no cambian conservan sus listas y despachadas.
   * Solo toca comandas si el pedido ya tenía (si no, se crean al llegar a cocina). Devuelve el estado resultante.
   */
  private async sincronizarCocina(tx: Prisma.TransactionClient, id: bigint, pedido: any, hayLineasNuevas: boolean, usuario: UsuarioAutenticado): Promise<string> {
    const lineas = await tx.pedidoLinea.findMany({
      where: { pedido_id: id },
      select: { id: true, cantidad: true, listas: true, area_id: true, producto: { select: { categoria: { select: { area_id: true } } } } },
    });
    const conArea = lineas
      .map((l) => ({ ...l, area: l.area_id ?? l.producto?.categoria?.area_id ?? null }))
      .filter((l) => l.area !== null) as Array<{ cantidad: number; listas: number; area: bigint }>;
    const existentes: any[] = pedido.comandas ?? [];
    if (existentes.length > 0) {
      const requeridas = new Set(conArea.map((l) => String(l.area)));
      for (const area of requeridas) {
        const comanda = existentes.find((c) => String(c.area_id) === area);
        const pendiente = conArea.some((l) => String(l.area) === area && l.listas < l.cantidad);
        if (!comanda) {
          await tx.comandaArea.create({ data: { pedido_id: id, area_id: BigInt(area), estado: 'EN_COCINA' } });
        } else if (comanda.estado === 'DESPEJADA' && pendiente) {
          await tx.comandaArea.update({
            where: { pedido_id_area_id: { pedido_id: id, area_id: BigInt(area) } },
            data: { estado: 'EN_COCINA', despejada_en: null, despejada_por: null },
          });
        }
      }
      const sobran = existentes.filter((c) => !requeridas.has(String(c.area_id))).map((c) => c.area_id);
      if (sobran.length > 0) await tx.comandaArea.deleteMany({ where: { pedido_id: id, area_id: { in: sobran } } });
    }
    let estado = pedido.estado as string;
    if (estado === 'LISTO' && conArea.some((l) => l.listas < l.cantidad)) {
      estado = 'PREPARANDO';
      await tx.pedido.update({ where: { id }, data: { estado, listo_en: null } });
    }
    if (hayLineasNuevas && pedido.atendido_despacho_en) {
      await tx.pedido.update({ where: { id }, data: { atendido_despacho_en: null, atendido_despacho_por: null } });
    }
    return estado;
  }

  /** Cambios del pedido, antes y después, por línea y por dato (para la auditoría y el aviso en pantalla). */
  private armarCambios(
    pedido: any,
    nuevo: { clienteNombre: string | null; telefono: string | null; entrega: any; subtotal: number; descuento: number; total: number },
    quitadas: LineaDb[],
    cambiadas: Array<{ fila: LineaDb; despues: LineaEdicionDto }>,
    lineasNuevas: any[],
    nuevasDto: LineaEdicionDto[],
  ) {
    const resumen: string[] = [];
    const detalle: any[] = [];
    const idsCambiadas = new Set(cambiadas.map((c) => String(c.fila.id)));
    const antesDe = (f: LineaDb) => ({
      lineaId: String(f.id),
      nombre: f.nombre,
      tamano: f.tamano,
      cantidad: f.cantidad,
      opciones: f.opcionesElegidas.map((o: any) => o.opcion_nombre),
      sabores: f.sabores.map((s: any) => `${s.cantidad} ${s.sabor_nombre}`),
      nota: f.nota,
      personas: f.nombres_persona,
      subtotal: Number(f.subtotal ?? 0),
    });
    const despuesDe = (l: any) => ({
      nombre: l.nombre,
      tamano: l.tamano,
      cantidad: l.cantidad,
      opciones: l.opciones.map((o: any) => o.nombre),
      sabores: l.sabores.map((s: any) => `${s.cantidad} ${s.nombre}`),
      nota: l.nota,
      personas: l.nombresPersona,
      subtotal: l.subtotal,
    });
    for (const f of quitadas) {
      if (idsCambiadas.has(String(f.id))) {
        const idx = nuevasDto.indexOf(cambiadas.find((c) => String(c.fila.id) === String(f.id))!.despues);
        detalle.push({ tipo: 'LINEA_CAMBIADA', antes: antesDe(f), despues: despuesDe(lineasNuevas[idx]) });
        resumen.push(`Cambió ${textoLinea(f)} por ${textoLinea(lineasNuevas[idx])}`);
      } else {
        detalle.push({ tipo: 'LINEA_QUITADA', antes: antesDe(f) });
        resumen.push(`Quitó ${textoLinea(f)}`);
      }
    }
    const idxCambiadas = new Set(cambiadas.map((c) => nuevasDto.indexOf(c.despues)));
    lineasNuevas.forEach((l, i) => {
      if (idxCambiadas.has(i)) return;
      detalle.push({ tipo: 'LINEA_AGREGADA', despues: despuesDe(l) });
      resumen.push(`Agregó ${textoLinea(l)}`);
    });
    const dato = (campo: string, antes: unknown, despues: unknown) => {
      if ((antes ?? null) === (despues ?? null)) return;
      detalle.push({ tipo: 'DATO', campo, antes: antes ?? null, despues: despues ?? null });
      resumen.push(`${campo}: «${antes ?? '—'}» → «${despues ?? '—'}»`);
    };
    dato('Modalidad', pedido.modalidad, nuevo.entrega.modalidad);
    dato('Nombre', pedido.cliente_nombre, nuevo.clienteNombre);
    dato('Celular', tieneTelefonoReal(pedido.cliente_telefono) ? pedido.cliente_telefono : null, nuevo.telefono);
    dato('Dirección', pedido.entrega_direccion, nuevo.entrega.direccion);
    dato('Referencia', pedido.entrega_referencia, nuevo.entrega.referencia);
    dato('Zona', pedido.zona_id != null ? String(pedido.zona_id) : null, nuevo.entrega.zonaId != null ? String(nuevo.entrega.zonaId) : null);
    dato('Envío', pedido.envio != null ? Number(pedido.envio) : null, nuevo.entrega.envio);
    dato('Descuento', Number(pedido.descuento), nuevo.descuento);
    dato('Total', Number(pedido.total), nuevo.total);
    return { resumen, detalle };
  }

  /** Productos y sabores agotados por esta edición: carta al día (igual que al crear el pedido). */
  private async emitirDisponibilidad() {
    try {
      const productos = await this.prisma.producto.findMany({ where: { agotado_hasta: { gt: new Date() } }, select: { id: true } });
      const sabores = await this.prisma.sabor.findMany({ where: { agotado_hasta: { gt: new Date() } }, select: { id: true } });
      const p = productos.map((x) => x.id.toString());
      const s = sabores.map((x) => x.id.toString());
      this.emitir('carta:disponibilidad', { productos: p, sabores: s, opciones: [], productoIds: p, saborIds: s, opcionIds: [] });
    } catch {
      // No bloquea la edición
    }
  }
}
