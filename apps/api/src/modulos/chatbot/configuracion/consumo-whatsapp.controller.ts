import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { ConsumoWhatsappService } from './consumo-whatsapp.service';

export class ActualizarConsumoWhatsappDto {
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000)
  gratisMes?: number;

  @IsOptional() @IsInt() @Min(1) @Max(99)
  avisoPct?: number;
}

@Controller('admin/chatbot/configuracion/consumo-whatsapp')
@UseGuards(AccesoGuard)
export class ConsumoWhatsappController {
  constructor(private readonly consumo: ConsumoWhatsappService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  async obtener() {
    const c = await this.consumo.obtener();
    await this.consumo.revisarAvisos().catch(() => undefined);
    return c;
  }

  @Put()
  @Permiso('configuracion', 'editar')
  actualizar(@Body() dto: ActualizarConsumoWhatsappDto) {
    return this.consumo.actualizarParametros(dto);
  }
}
