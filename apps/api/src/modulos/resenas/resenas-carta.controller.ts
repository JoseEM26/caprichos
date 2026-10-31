import { Controller, Get, Header } from '@nestjs/common';
import { ResenasGoogleService } from './resenas-google.service';

/** Endpoint público de la carta: solo lee la base, nunca llama a la API externa. */
@Controller('carta')
export class ResenasCartaController {
  constructor(private readonly resenas: ResenasGoogleService) {}

  @Get('resenas')
  @Header('Cache-Control', 'public, max-age=600')
  async listar() {
    return this.resenas.listarPublico();
  }
}
