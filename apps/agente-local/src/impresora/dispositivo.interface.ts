import type { EstadoImpresora } from '@caprichos/compartido';

export interface EstadoDispositivo {
  estado: EstadoImpresora;
  detalle?: string;
}

export class ErrorImpresora extends Error {
  constructor(
    mensaje: string,
    public readonly estado: EstadoImpresora,
    public readonly codigoOriginal?: string
  ) {
    super(mensaje);
    this.name = 'ErrorImpresora';
  }
}

export interface IDispositivoImpresora {
  escribir(datos: Buffer): Promise<void>;
  verificarEstado(): Promise<EstadoDispositivo>;
  obtenerRuta(): string;
}
