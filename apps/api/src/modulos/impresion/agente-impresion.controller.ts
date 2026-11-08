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
    // Cada PC toma solo lo que su configuración le asigna
    return this.impresionService.tomarTrabajos(dto.max, deviceKeyId, dto.roles, null, dto.pruebas === true);
  }

  @Post('resultado')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrarResultado(@Body() dto: ResultadoTrabajoDto) {
    await this.impresionService.registrarResultado(dto);
  }

  @Post('latido')
  @HttpCode(HttpStatus.OK)
  async registrarLatido(@Body() dto: LatidoDto, @Req() req: any) {
    const deviceKeyId = req.deviceKey?.id ? BigInt(req.deviceKey.id) : undefined;
    // Responde con lo elegido en el panel ({ seleccion }); los programas viejos aceptan 200 igual que 204
    const ipPublica = (req.headers?.['x-forwarded-for'] as string | undefined) || req.ip;
    return deviceKeyId ? this.impresionService.registrarLatido(dto, deviceKeyId, ipPublica) : {};
  }
}
