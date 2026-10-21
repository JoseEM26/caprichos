import { Injectable } from '@nestjs/common';
import { ModuloAService } from '../modulo-a';

@Injectable()
export class ModuloBService {
  constructor(private readonly moduloAService: ModuloAService) {}

  obtenerResumen(): string {
    return `Modulo B coordinando: ${this.moduloAService.obtenerDatos()}`;
  }
}
