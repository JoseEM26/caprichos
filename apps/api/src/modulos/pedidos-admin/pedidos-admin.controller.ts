import { esSoloMozo } from '../acceso/roles-usuario';
import { puedeDarCortesia } from '../cortesias/cortesia.tipos';
import { puedeCobrarAhoraPersonal } from '../creditos/descuento-personal';
import {
  Body,
  Controller,
  Get,
  Headers,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { AjustarPagoService } from './ajustar-pago.service';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { CocinaQueryDto } from './dto/cocina-query.dto';
import { MisPedidosQueryDto } from './dto/mis-pedidos-query.dto';
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';
import { UbicarPedidoService } from './ubicar-pedido.service';
import { CorregirClienteService } from './corregir-cliente.service';
import { ReabrirPedidoService } from './reabrir-pedido.service';
import { ReabrirPedidoDto } from './dto/reabrir-pedido.dto';
import { CorregirClienteDto } from './dto/corregir-cliente.dto';
import { PedidosService } from '../pedidos/pedidos.service';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { ImpresionService } from '../impresion/impresion.service';
import { ReimprimirDto, ReimprimirPedidoDto } from '../impresion/dto/reimprimir.dto';
import { VouchersService } from '../vouchers/vouchers.service';
import { PedidoComprobanteService } from './pedido-comprobante.service';
import { CambiarComprobanteDto } from './dto/cambiar-comprobante.dto';
import { DevolucionPedidoService } from './devolucion-pedido.service';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';

@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class PedidosAdminController {
  constructor(
    private readonly pedidosEstadoService: PedidosEstadoService,
    private readonly ubicarPedidoService: UbicarPedidoService,
    private readonly corregirCliente: CorregirClienteService,
    @Optional() private readonly pedidosService?: PedidosService,
    @Optional() private readonly reabrirPedido?: ReabrirPedidoService,
    @Optional() private readonly impresionService?: ImpresionService,
    @Optional() private readonly vouchersService?: VouchersService,
    @Optional() private readonly pedidoComprobante?: PedidoComprobanteService,
    @Optional() private readonly devolucionPedido?: DevolucionPedidoService,
    @Optional() private readonly ajustarPagoService?: AjustarPagoService,
  ) {}

  @Post()
  @Permiso('pedidos', 'crear')
  async crear(
    @Body() dto: CrearPedidoDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    const key =
      idempotencyKey ||
      `adm-${req.usuario?.partyId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const canal =
      dto.canal || (req.usuario && esSoloMozo(req.usuario) ? 'MOZO' : 'CAJA');
    const res = await this.pedidosService!.crear(dto, key, {
      canal,
      usuarioPartyId: req.usuario?.partyId,
      clientePartyId: dto.colaboradorPartyId,
      esPersonal: dto.esPersonal,
      pagoPersonal: dto.pagoPersonal,
      puedeCobrarAhora: puedeCobrarAhoraPersonal(req.usuario),
      omitirChequeoCarta: true,
      puedeCortesia: puedeDarCortesia(req.usuario),
    });
    if (res?.id && this.impresionService) {
      try {
        await this.impresionService.encolarEtiquetasPedido(res.id);
      } catch {
        // Encolado no bloqueante
      }
    }
    return res;
  }

  @Get()
  @Permiso('pedidos', 'ver')
  async listar(@Query() filtros: FiltrarPedidosDto, @Req() req: any) {
    return this.pedidosEstadoService.listar(filtros, req.usuario);
  }

  @Get('cocina')
  @Permiso('pedidos', 'ver')
  async listarCocina(@Query() query: CocinaQueryDto, @Req() req: any) {
    return this.pedidosEstadoService.listarCocina(query.historial, req.usuario);
  }

  @Get('no-entregados')
  @Permiso('pedidos', 'ver')
  async listarNoEntregados() {
    return this.pedidosEstadoService.listarNoEntregados();
  }

  @Get('mis-pedidos')
  @Permiso('pedidos', 'crear')
  async misPedidos(@Query() query: MisPedidosQueryDto, @Req() req: any) {
    return this.pedidosEstadoService.misPedidos(req.usuario, query.rango ?? 'hoy');
  }

  /** Historial de vouchers del pedido (vigentes y reemplazados). Declarada antes de GET ':id'. */
  @Get(':id/vouchers/historial')
  @Permiso([
    { modulo: 'pedidos', accion: 'crear' },
    { modulo: 'vouchers', accion: 'ver' },
    { modulo: 'pedidos', accion: 'ver' },
  ])
  async historialVouchers(@Param('id') id: string, @Req() req: any) {
    return this.vouchersService?.historialPedido(id, req.usuario);
  }

  @Get(':id')
  @Permiso('pedidos', 'ver')
  async obtenerPorId(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.obtenerPorId(id, req.usuario, ip);
  }

  @Post(':id/estado')
  // Anular (estado ANULADO): el servicio aplica el alcance por rol (ANULAR_SIN_ALCANCE)
  @Permiso([
    { modulo: 'pedidos', accion: 'cambiar_estado' },
    { modulo: 'pedidos', accion: 'anular' },
  ])
  async cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.cambiarEstado(id, dto, req.usuario, ip);
  }

  /** «Volver atrás» de un pedido entregado por error (solo Caja y Administrador: lo valida el servicio con puedeVolverAtrasPedidos). */
  @Post(':id/reabrir')
  @Permiso('pedidos', 'anular')
  async reabrir(@Param('id') id: string, @Body() dto: ReabrirPedidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reabrirPedido!.reabrir(id, dto?.motivo, req.usuario, ip);
  }

  /** Datos para la devolución de un pedido cancelado por no recibir y pagado (monto sugerido, medio, comprobante). */
  @Get(':id/devolucion/sugerencia')
  @Permiso('pedidos', 'ver')
  async sugerenciaDevolucion(@Param('id') id: string) {
    return this.devolucionPedido!.sugerencia(id);
  }

  /** Registra la devolución manual (motivo y monto validados; queda auditada a nombre de quien la registra). */
  @Post(':id/devolucion')
  @Permiso('pedidos', 'cambiar_estado')
  async registrarDevolucion(@Param('id') id: string, @Body() dto: RegistrarDevolucionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.devolucionPedido!.registrar(id, dto, req.usuario, BigInt(req.usuario.partyId), ip);
  }

  /** Plan de pago que arma el mozo antes de subir cada captura (el servidor deriva el monto por medio). */
  /** PATCH /admin/pedidos/:id/comprobante: cambia el comprobante antes de cobrar (Caja). */
  @Patch(':id/comprobante')
  @Permiso('caja', 'cobrar')
  async cambiarComprobante(@Param('id') id: string, @Body() dto: CambiarComprobanteDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidoComprobante!.cambiar(id, dto, req.usuario, ip);
  }

  @Post(':id/plan-pago')
  @Permiso('pedidos', 'crear')
  async guardarPlanPago(@Param('id') id: string, @Body('plan') plan: unknown, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.vouchersService?.guardarPlanMozo(id, plan, req.usuario, ip);
  }

  @Post(':id/pago')
  @Permiso('pedidos', 'cambiar_estado')
  async registrarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.registrarPago(id, dto, req.usuario, ip);
  }

  /** Corrige nombre, celular y (delivery) dirección/referencia. */
  @Patch(':id/cliente')
  @Permiso('pedidos', 'corregir_cliente')
  async corregirDatosCliente(@Param('id') id: string, @Body() dto: CorregirClienteDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.corregirCliente.corregir(id, dto, req.usuario, ip);
  }

  /**
   * Cambiar o agregar medios de pago del pedido, en cualquier estado salvo anulado y sin código de supervisor
   * ni aprobación. Repartidor: solo los asignados a él; mozo: solo los suyos (se valida en el servicio).
   */
  @Post(':id/pago/ajustar')
  @Permiso('pedidos', 'ajustar_pago')
  async ajustarPago(@Param('id') id: string, @Body() dto: { plan?: unknown; pagaCon?: unknown; motivo?: unknown }, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ajustarPagoService?.ajustar(id, dto ?? {}, req.usuario, ip);
  }

  @Post(':id/ubicacion')
  @Permiso('pedidos', 'cambiar_estado')
  async ubicar(@Param('id') id: string, @Body() dto: UbicarPedidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ubicarPedidoService.ubicar(id, dto, req.usuario, ip);
  }

  @Post(':id/etiquetas/reimprimir')
  @Permiso('pedidos', 'cambiar_estado')
  async reimprimirEtiquetas(
    @Param('id') id: string,
    @Body() dto: ReimprimirDto,
    @Req() req?: any,
  ) {
    if (!this.impresionService) {
      return { ok: false, mensaje: 'Módulo de impresión no configurado' };
    }
    return this.impresionService.reimprimirEtiqueta(id, dto, req?.usuario, req?.ip);
  }

  /** Reimpresión rápida (todo, stickers, ticket de cocina o de pago) de cualquier pedido; `vista_previa` solo calcula. */
  @Post(':id/reimprimir')
  @Permiso('pedidos', 'cambiar_estado')
  async reimprimirPedido(@Param('id') id: string, @Body() dto: ReimprimirPedidoDto, @Req() req?: any) {
    if (!this.impresionService) {
      return { ok: false, mensaje: 'Módulo de impresión no configurado' };
    }
    return this.impresionService.reimprimirPedido(id, dto, req?.usuario, req?.ip);
  }

  /**
   * Precuenta de una mesa/pedido sin cobrar: encola SOLO el ticket «PRE-CUENTA - SIN PAGAR» en la ticketera con «Ticket de pago».
   * Lo piden también el mozo y la tablet, que no tienen `cambiar_estado`; por eso permiso propio y tipo fijo.
   */
  @Post(':id/precuenta/imprimir')
  @Permiso('pedidos', 'imprimir_precuenta')
  async imprimirPrecuenta(@Param('id') id: string, @Body() dto: { vista_previa?: boolean } = {}, @Req() req?: any) {
    if (!this.impresionService) {
      return { ok: false, mensaje: 'Módulo de impresión no configurado' };
    }
    return this.impresionService.imprimirPrecuenta(id, Boolean(dto?.vista_previa), req?.usuario, req?.ip);
  }

  /** Estado de impresión de cada etiqueta del pedido (cola, impresa, fallida, vencida). */
  @Get(':id/etiquetas-estado')
  @Permiso('pedidos', 'ver')
  async estadoEtiquetas(@Param('id') id: string) {
    if (!this.impresionService) {
      return { pedidoId: id, codigo: '', etiquetas: [], resumen: { total: 0, impresas: 0, enCola: 0, fallidas: 0, vencidas: 0, sinTrabajo: 0 } };
    }
    return this.impresionService.estadoEtiquetasPedido(id);
  }
}
