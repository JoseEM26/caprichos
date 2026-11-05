import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AgenteImpresionGuard } from './agente-impresion.guard';
import { ImpresionService } from './impresion.service';
import {
  LatidoDto,
  ResultadoTrabajoDto,
  TomarTrabajosDto,
} from './dto';

@Controller(['agente-impresion', 'api/agente-impresion'])
@UseGuards(AgenteImpresionGuard)
export class AgenteImpresionController {
  constructor(private readonly impresionService: ImpresionService) {}

  @Post('tomar')
  @HttpCode(HttpStatus.OK)
  async tomar(@Body() dto: TomarTrabajosDto, @Req() req: any) {
    const deviceKeyId = req.deviceKey?.id ? BigInt(req.deviceKey.id) : undefined;
    // El equipo toma solo lo de su área (área NULL = Caja)
    const areaId = req.deviceKey?.area_id ? BigInt(req.deviceKey.area_id) : null;
    return this.impresionService.tomarTrabajos(dto.max, deviceKeyId, dto.roles, areaId);
  }

  @Post('resultado')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarResultado(@Body() dto: ResultadoTrabajoDto) {
    await this.impresionService.registrarResultado(dto);
  }

  @Post('latido')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarLatido(@Body() dto: LatidoDto, @Req() req: any) {
    const deviceKeyId = req.deviceKey?.id ? BigInt(req.deviceKey.id) : undefined;
    if (deviceKeyId) {
      await this.impresionService.registrarLatido(dto, deviceKeyId);
    }
  }
}
