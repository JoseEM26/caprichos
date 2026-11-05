import { rolDeTrabajo } from '@caprichos/compartido';
import type { EstadoImpresora, ImpresoraReportada, RolImpresora, TrabajoImpresion } from '@caprichos/compartido';
import type { ConfiguracionAgente } from '../config';
import type { IClienteApiImpresion } from '../api/clienteApi';
import type { IDispositivoImpresora } from '../impresora/dispositivo.interface';
import { ErrorImpresora } from '../impresora/dispositivo.interface';
import { generarBytesTrabajo } from '../tspl/generadorTspl';
import { generarTicketEscPos, generarComandaSalonEscPos } from '../escpos/generadorTicket';

export interface OpcionesAgenteLocalServicio {
  config: ConfiguracionAgente;
  clienteApi: IClienteApiImpresion;
  /** Modo de una sola impresora (etiquetera); se mantiene por compatibilidad. */
  impresora?: IDispositivoImpresora;
  /** Una impresora por rol: la de cada máquina configurada. */
  impresoras?: Partial<Record<RolImpresora, IDispositivoImpresora>>;
  logger?: (nivel: 'info' | 'warn' | 'error' | 'debug', mensaje: string) => void;
  temporizador?: (ms: number) => Promise<void>;
}

export class AgenteLocalServicio {
  private readonly config: ConfiguracionAgente;
  private readonly clienteApi: IClienteApiImpresion;
  private readonly impresora: IDispositivoImpresora;
  private readonly impresoras: Partial<Record<RolImpresora, IDispositivoImpresora>>;
  private readonly modoPorRol: boolean;
  /** Roles cuya impresora respondió lista en el último latido: solo esos toman trabajos. */
  private rolesListos: RolImpresora[] = [];
  private estadosRol: ImpresoraReportada[] = [];
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
    this.modoPorRol = Boolean(opciones.impresoras);
    this.impresoras = opciones.impresoras ?? (opciones.impresora ? { ETIQUETERA: opciones.impresora } : {});
    this.impresora = (this.impresoras.ETIQUETERA ?? opciones.impresora) as IDispositivoImpresora;
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
        const reportadas: ImpresoraReportada[] = [];
        for (const rol of ['ETIQUETERA', 'TICKETERA'] as RolImpresora[]) {
          const dispositivo = this.impresoras[rol];
          if (!dispositivo) continue;
          const e = await dispositivo.verificarEstado().catch((err: any) => ({
            estado: 'error' as EstadoImpresora,
            detalle: err.message as string | undefined,
          }));
          reportadas.push({ rol, estado: e.estado, detalle: e.detalle });
        }
        this.estadosRol = reportadas;
        this.rolesListos = reportadas.filter((r) => r.estado === 'lista').map((r) => r.rol);
        const etiquetera = reportadas.find((r) => r.rol === 'ETIQUETERA') ?? reportadas[0];
        this.estadoImpresora = etiquetera ? etiquetera.estado : 'desconectada';
        this.detalleEstadoImpresora = etiquetera?.detalle;

        await this.clienteApi.enviarLatido(
          this.config.version,
          this.estadoImpresora,
          this.detalleEstadoImpresora,
          ...(this.modoPorRol ? [reportadas] : [])
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
      // Una máquina que falla o no está lista no toma trabajos: los suyos esperan en la cola del servidor
      trabajos = this.modoPorRol
        ? this.rolesListos.length === 0
          ? []
          : await this.clienteApi.tomarTrabajos(this.config.maxTrabajosPorLote, this.rolesListos)
        : await this.clienteApi.tomarTrabajos(this.config.maxTrabajosPorLote);
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
      const rol: RolImpresora = rolDeTrabajo(trabajo.tipo);
      const dispositivo = this.impresoras[rol];
      if (!dispositivo) {
        throw new ErrorImpresora(`La ${rol.toLowerCase()} no está configurada en este equipo`, 'desconectada');
      }
      const bytes =
        trabajo.tipo === 'TICKET_PAGO'
          ? generarTicketEscPos(trabajo.payload as any, this.config.ticketColumnas)
          : trabajo.tipo === 'TICKET_COMANDA_SALON'
            ? generarComandaSalonEscPos(trabajo.payload as any, this.config.ticketColumnas)
            : generarBytesTrabajo(trabajo.tipo, trabajo.payload as any, trabajo.copia, this.config.etiqueta);
      await dispositivo.escribir(bytes);

      if (rol === 'ETIQUETERA') {
        this.estadoImpresora = 'lista';
        this.detalleEstadoImpresora = undefined;
      }

      // Reportar éxito
      await this.clienteApi.reportarResultado(trabajo.id, true);
      this.logger('info', `Trabajo ${trabajo.id} impreso y confirmado con éxito`);
    } catch (err: any) {
      const mensajeError = err.message || 'Error desconocido al imprimir';

      // Una máquina que falla deja de tomar trabajos hasta que el próximo latido la vea lista
      const rolFallido: RolImpresora = rolDeTrabajo(trabajo.tipo);
      this.rolesListos = this.rolesListos.filter((r) => r !== rolFallido);
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
    this.logger(
      'info',
      `Etiquetera: ${this.config.etiquetera ?? this.config.impresoraRuta} | Ticketera: ${this.config.ticketera ?? 'sin configurar'}`
    );

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
