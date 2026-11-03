import { esSoloMozo } from '../acceso/roles-usuario';
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
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { CocinaQueryDto } from './dto/cocina-query.dto';
import { MisPedidosQueryDto } from './dto/mis-pedidos-query.dto';
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';
import { UbicarPedidoService } from './ubicar-pedido.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { ImpresionService } from '../impresion/impresion.service';
import { ReimprimirDto } from '../impresion/dto/reimprimir.dto';
import { VouchersService } from '../vouchers/vouchers.service';
import { PedidoComprobanteService } from './pedido-comprobante.service';
import { CambiarComprobanteDto } from './dto/cambiar-comprobante.dto';

@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class PedidosAdminController {
  constructor(
    private readonly pedidosEstadoService: PedidosEstadoService,
    private readonly ubicarPedidoService: UbicarPedidoService,
    @Optional() private readonly pedidosService?: PedidosService,
    @Optional() private readonly impresionService?: ImpresionService,
    @Optional() private readonly vouchersService?: VouchersService,
    @Optional() private readonly pedidoComprobante?: PedidoComprobanteService,
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
      omitirChequeoCarta: true,
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
  @Permiso('pedidos', 'cambiar_estado')
  @RequiereCodigoSupervisor('pedidos/anular', {
    condicion: (req) => req.body?.estado === 'ANULADO',
  })
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const codigo =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.pedidosEstadoService.cambiarEstado(
      id,
      dto,
      req.usuario,
      codigo,
      ip,
      ...(req.codigoSupervisorVerificado ? [true] : []),
    );
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
  ) {
    if (!this.impresionService) {
      return { ok: false, mensaje: 'Módulo de impresión no configurado' };
    }
    return this.impresionService.reimprimirEtiqueta(id, dto);
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
