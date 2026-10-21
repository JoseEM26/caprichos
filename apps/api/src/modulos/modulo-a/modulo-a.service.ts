import { Injectable } from '@nestjs/common';
import { SECRETO_INTERNO_MODULO_A } from './modulo-a.interno';

@Injectable()
export class ModuloAService {
  obtenerDatos(): string {
    return `Datos desde Modulo A (usando interno: ${SECRETO_INTERNO_MODULO_A})`;
  }
}
