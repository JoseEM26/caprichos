import {
  Body,
  Controller,
  Get,
  Headers,
  Optional,
  Param,
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
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';
import { UbicarPedidoService } from './ubicar-pedido.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { ImpresionService } from '../impresion/impresion.service';
import { ReimprimirDto } from '../impresion/dto/reimprimir.dto';

@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class PedidosAdminController {
  constructor(
    private readonly pedidosEstadoService: PedidosEstadoService,
    private readonly ubicarPedidoService: UbicarPedidoService,
    @Optional() private readonly pedidosService?: PedidosService,
    @Optional() private readonly impresionService?: ImpresionService,
  ) {}

  @Post()
  @Permiso('pedidos', 'ver')
  async crear(
    @Body() dto: CrearPedidoDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    const key =
      idempotencyKey ||
      `adm-${req.usuario?.partyId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const canal =
      dto.canal || (req.usuario?.rol === 'MOZO' ? 'MOZO' : 'CAJA');
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
}
