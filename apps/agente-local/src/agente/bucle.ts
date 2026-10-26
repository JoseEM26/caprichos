import type { EstadoImpresora, TrabajoImpresion } from '@caprichos/compartido';
import type { ConfiguracionAgente } from '../config';
import type { IClienteApiImpresion } from '../api/clienteApi';
import type { IDispositivoImpresora } from '../impresora/dispositivo.interface';
import { ErrorImpresora } from '../impresora/dispositivo.interface';
import { generarBytesTrabajo } from '../tspl/generadorTspl';

export interface OpcionesAgenteLocalServicio {
  config: ConfiguracionAgente;
  clienteApi: IClienteApiImpresion;
  impresora: IDispositivoImpresora;
  logger?: (nivel: 'info' | 'warn' | 'error' | 'debug', mensaje: string) => void;
  temporizador?: (ms: number) => Promise<void>;
}

export class AgenteLocalServicio {
  private readonly config: ConfiguracionAgente;
  private readonly clienteApi: IClienteApiImpresion;
  private readonly impresora: IDispositivoImpresora;
  private readonly logger: (
    nivel: 'info' | 'warn' | 'error' | 'debug',
    mensaje: string
  ) => void;
  private readonly temporizador: (ms: number) => Promise<void>;

  private corriendo: boolean = false;
  private ultimoLatidoTs: number = 0;
  private factorEsperaRed: number = 1;
  private estadoImpresora: EstadoImpresora = 'lista';
  private detalleEstadoImpresora?: string;

  constructor(opciones: OpcionesAgenteLocalServicio) {
    this.config = opciones.config;
    this.clienteApi = opciones.clienteApi;
    this.impresora = opciones.impresora;
    this.logger =
      opciones.logger ||
      ((nivel, msg) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${nivel.toUpperCase()}] ${msg}`);
      });
    this.temporizador =
      opciones.temporizador ||
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  obtenerEstadoImpresora(): EstadoImpresora {
    return this.estadoImpresora;
  }

  obtenerEsperaActualMs(): number {
    return Math.min(
      30000,
      Math.round(this.config.intervaloConsultaMs * this.factorEsperaRed)
    );
  }

  forzarTiempoUltimoLatido(ts: number): void {
    this.ultimoLatidoTs = ts;
  }

  /**
   * Ejecuta un ciclo único del bucle:
   * 1. Verifica si corresponde emitir el latido (cada 20 s o inicial)
   * 2. Consulta y toma trabajos pendientes
   * 3. Imprime cada trabajo y reporta resultado individual
   * 4. Maneja fallos de red con espera exponencial sin caerse
   */
  async ejecutarCiclo(): Promise<{
    trabajosProcesados: number;
    errorRed: boolean;
  }> {
    const ahora = Date.now();

    // 1. Emitir latido si corresponde
    if (ahora - this.ultimoLatidoTs >= this.config.intervaloLatidoMs) {
      try {
        const estadoDispositivo = await this.impresora.verificarEstado();
        this.estadoImpresora = estadoDispositivo.estado;
        this.detalleEstadoImpresora = estadoDispositivo.detalle;

        await this.clienteApi.enviarLatido(
          this.config.version,
          this.estadoImpresora,
          this.detalleEstadoImpresora
        );
        this.ultimoLatidoTs = ahora;
        this.logger(
          'debug',
          `Latido enviado. Estado impresora: ${this.estadoImpresora}`
        );
      } catch (err: any) {
        this.logger(
          'warn',
          `No se pudo enviar latido al servidor: ${err.message}`
        );
      }
    }

    // 2. Tomar trabajos pendientes
    let trabajos: TrabajoImpresion[] = [];
    try {
      trabajos = await this.clienteApi.tomarTrabajos(
        this.config.maxTrabajosPorLote
      );
      // Conexión exitosa: restablecemos el multiplicador de espera
      this.factorEsperaRed = 1;
    } catch (err: any) {
      this.logger(
        'warn',
        `Fallo al tomar trabajos (reintentando con espera creciente): ${err.message}`
      );
      // Incremento exponencial de backoff limitado a 30s
      this.factorEsperaRed = Math.min(10, this.factorEsperaRed * 1.5);
      return { trabajosProcesados: 0, errorRed: true };
    }

    if (trabajos.length === 0) {
      return { trabajosProcesados: 0, errorRed: false };
    }

    this.logger('info', `Tomados ${trabajos.length} trabajo(s) de impresión`);

    // 3. Procesar cada trabajo en serie
    for (const trabajo of trabajos) {
      await this.procesarTrabajo(trabajo);
    }

    return { trabajosProcesados: trabajos.length, errorRed: false };
  }

  /**
   * Procesa un trabajo individual: genera TSPL, escribe al dispositivo y reporta resultado.
   */
  private async procesarTrabajo(trabajo: TrabajoImpresion): Promise<void> {
    this.logger(
      'info',
      `Imprimiendo trabajo ${trabajo.id} (tipo: ${trabajo.tipo}, copia: ${trabajo.copia})`
    );

    try {
      const bytes = generarBytesTrabajo(
        trabajo.tipo,
        trabajo.payload,
        trabajo.copia
      );
      await this.impresora.escribir(bytes);

      this.estadoImpresora = 'lista';
      this.detalleEstadoImpresora = undefined;

      // Reportar éxito
      await this.clienteApi.reportarResultado(trabajo.id, true);
      this.logger('info', `Trabajo ${trabajo.id} impreso y confirmado con éxito`);
    } catch (err: any) {
      let mensajeError = err.message || 'Error desconocido al imprimir';

      if (err instanceof ErrorImpresora) {
        this.estadoImpresora = err.estado;
        this.detalleEstadoImpresora = err.message;
      } else {
        this.estadoImpresora = 'error';
        this.detalleEstadoImpresora = mensajeError;
      }

      this.logger(
        'error',
        `Fallo al imprimir trabajo ${trabajo.id} (${this.estadoImpresora}): ${mensajeError}`
      );

      // Reportar fallo al servidor para que contabilice el intento sin perder el trabajo
      try {
        await this.clienteApi.reportarResultado(trabajo.id, false, mensajeError);
      } catch (errReporte: any) {
        this.logger(
          'warn',
          `No se pudo reportar el fallo del trabajo ${trabajo.id} al servidor: ${errReporte.message}`
        );
      }
    }
  }

  /**
   * Arranca el bucle continuo del servicio. Se detiene llamando a detener().
   */
  async iniciar(): Promise<void> {
    this.corriendo = true;
    this.logger(
      'info',
      `Iniciando Agente Local de Impresión Caprichos v${this.config.version}`
    );
    this.logger('info', `Servidor API: ${this.config.apiUrl}`);
    this.logger('info', `Dispositivo impresora: ${this.config.impresoraRuta}`);

    while (this.corriendo) {
      await this.ejecutarCiclo();
      const esperaMs = this.obtenerEsperaActualMs();
      await this.temporizador(esperaMs);
    }

    this.logger('info', 'Agente Local de Impresión detenido ordenadamente');
  }

  /**
   * Solicita detener el bucle de forma limpia.
   */
  detener(): void {
    this.corriendo = false;
  }
}
