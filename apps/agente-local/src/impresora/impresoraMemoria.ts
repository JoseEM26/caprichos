import type {
  IDispositivoImpresora,
  EstadoDispositivo,
} from './dispositivo.interface';
import { ErrorImpresora } from './dispositivo.interface';

export class ImpresoraMemoria implements IDispositivoImpresora {
  private trabajosEscritos: Buffer[] = [];
  private estadoActual: EstadoDispositivo = { estado: 'lista' };
  private errorSimulado?: ErrorImpresora;

  constructor(private readonly ruta: string = 'memoria://impresora-falsa') {}

  obtenerRuta(): string {
    return this.ruta;
  }

  simularErrorAlEscribir(error?: ErrorImpresora): void {
    this.errorSimulado = error;
  }

  establecerEstado(estado: EstadoDispositivo): void {
    this.estadoActual = estado;
  }

  obtenerEstadoActual(): EstadoDispositivo {
    return this.estadoActual;
  }

  obtenerTrabajosEscritos(): Buffer[] {
    return this.trabajosEscritos;
  }

  limpiarTrabajos(): void {
    this.trabajosEscritos = [];
  }

  async escribir(datos: Buffer): Promise<void> {
    if (this.errorSimulado) {
      this.estadoActual = {
        estado: this.errorSimulado.estado,
        detalle: this.errorSimulado.message,
      };
      const err = this.errorSimulado;
      this.errorSimulado = undefined;
      throw err;
    }

    this.trabajosEscritos.push(Buffer.from(datos));
    this.estadoActual = { estado: 'lista' };
  }

  async verificarEstado(): Promise<EstadoDispositivo> {
    return this.estadoActual;
  }
}
