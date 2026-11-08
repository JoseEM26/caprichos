import * as os from 'os';
import { rolDeTrabajo, tamanoEfectivo, TAMANO_BEBIDA_DEFECTO, TAMANO_GENERAL_DEFECTO } from '@caprichos/compartido';
import type { ConfigEquipoParaAgente, EstadoImpresora, ImpresoraReportada, InfoEquipoLatido, RolImpresora, TrabajoImpresion } from '@caprichos/compartido';
import type { ConfiguracionAgente } from '../config';
import { ErrorRespuestaApi } from '../api/clienteApi';
import type { IClienteApiImpresion } from '../api/clienteApi';
import type { IDispositivoImpresora } from '../impresora/dispositivo.interface';
import { ErrorImpresora } from '../impresora/dispositivo.interface';
import { generarBytesTrabajo } from '../tspl/generadorTspl';
import { generarTicketEscPos, generarComandaSalonEscPos } from '../escpos/generadorTicket';
import { generarPruebaEtiqueta, generarPruebaTicket } from '../pruebaImpresora';
import { paraServidor } from '../candidatas';
import type { CandidataLocal } from '../candidatas';
import { decidirAutomatica, mensajeConexion, NOMBRE_ROL_AUTO } from '../autoUsb';

/** Lo que el programa sabe de este equipo: qué impresoras ve y cómo guardar la elegida (desde el panel). */
export interface EquipoLocal {
  listar(): Promise<CandidataLocal[]>;
  crear(candidata: CandidataLocal, rol: RolImpresora): IDispositivoImpresora;
  /** Identificación estable de la impresora guardada para ese rol. */
  idActual(rol: RolImpresora): string | undefined;
  /** Guarda la elección en la configuración del programa (sobrevive a reinicios). */
  guardar(rol: RolImpresora, candidata: CandidataLocal): void;
}

/** Con una impresora guardada que no aparece, se reintenta más seguido que el latido normal. */
const REINTENTO_FALTANTE_MS = 5000;
/** Sin impresora USB para un rol: se vuelve a buscar (hot-plug) como mucho cada 30 s. */
const REESCANEO_SIN_IMPRESORA_MS = 30000;
/** Tras imprimir algo, se consulta cada 1 s durante este tiempo (para que el ticket de pago salga enseguida). */
const VENTANA_ACTIVIDAD_MS = 60000;
const ESPERA_ACTIVA_MS = 1000;

/** Nombre, sistema y direcciones de red de esta computadora (interfaces no internas, solo IPv4). */
export function leerInfoEquipo(): InfoEquipoLatido {
  const ipLocal: string[] = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista ?? []) if (i.family === 'IPv4' && !i.internal) ipLocal.push(i.address);
  }
  return { hostname: os.hostname(), sistema: `${process.platform} ${os.release()}`, ipLocal };
}

export interface OpcionesAgenteLocalServicio {
  config: ConfiguracionAgente;
  clienteApi: IClienteApiImpresion;
  /** Modo de una sola impresora (etiquetera); se mantiene por compatibilidad. */
  impresora?: IDispositivoImpresora;
  /** Una impresora por rol: la de cada máquina configurada. */
  impresoras?: Partial<Record<RolImpresora, IDispositivoImpresora>>;
  logger?: (nivel: 'info' | 'warn' | 'error' | 'debug', mensaje: string) => void;
  temporizador?: (ms: number) => Promise<void>;
  /** Datos de la computadora para el latido (por defecto, los reales; se inyecta en las pruebas). */
  infoEquipo?: () => InfoEquipoLatido;
  /** Habilita pruebas por impresora concreta y la elección desde el panel (sin él, el programa se comporta como antes). */
  equipo?: EquipoLocal;
}

export class AgenteLocalServicio {
  private readonly config: ConfiguracionAgente;
  private readonly clienteApi: IClienteApiImpresion;
  private readonly impresora: IDispositivoImpresora;
  private readonly equipo?: EquipoLocal;
  private readonly infoEquipo: () => InfoEquipoLatido;
  /** Lo que el dueño configuró para esta PC (llega en cada latido y se aplica sin reiniciar). */
  private configEquipo?: ConfigEquipoParaAgente;
  private candidatas: CandidataLocal[] = [];
  private algunaFalla = false;
  private readonly impresoras: Partial<Record<RolImpresora, IDispositivoImpresora>>;
  private readonly modoPorRol: boolean;
  /** Roles cuya impresora respondió lista en el último latido: solo esos toman trabajos. */
  private rolesListos: RolImpresora[] = [];
  /** Trabajos ya impresos cuya confirmación (ok=true) aún no llegó al servidor. */
  // ponytail: en memoria; si el programa se reinicia con alguno sin confirmar, puede salir dos veces (persistir en archivo si pasa)
  private reportesPendientes: string[] = [];
  private estadosRol: ImpresoraReportada[] = [];
  private readonly logger: (
    nivel: 'info' | 'warn' | 'error' | 'debug',
    mensaje: string
  ) => void;
  private readonly temporizador: (ms: number) => Promise<void>;

  private corriendo: boolean = false;
  private ultimaActividadTs = 0;
  /** Roles de los que ya se avisó «no encuentro impresora USB» (para no repetirlo cada escaneo). */
  private avisoSinUsb = new Set<RolImpresora>();
  private ultimoLatidoTs: number = 0;
  private factorEsperaRed: number = 1;
  private estadoImpresora: EstadoImpresora = 'lista';
  private detalleEstadoImpresora?: string;

  constructor(opciones: OpcionesAgenteLocalServicio) {
    this.config = opciones.config;
    this.clienteApi = opciones.clienteApi;
    this.equipo = opciones.equipo;
    this.infoEquipo = opciones.infoEquipo ?? leerInfoEquipo;
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
    const base = Date.now() - this.ultimaActividadTs < VENTANA_ACTIVIDAD_MS
      ? Math.min(this.config.intervaloConsultaMs, ESPERA_ACTIVA_MS)
      : this.config.intervaloConsultaMs;
    return Math.min(30000, Math.round(base * this.factorEsperaRed));
  }

  /** Conecta solo la ticketera/etiquetera USB de cada rol sin impresora válida (ver autoUsb.ts). */
  private autoConectar(): void {
    const equipo = this.equipo!;
    const decisiones = decidirAutomatica(this.candidatas, (r) => equipo.idActual(r));
    for (const d of decisiones) {
      // Con la PC ya configurada, una máquina apagada en el panel no se conecta sola
      if (!this.rolHabilitado(d.rol)) continue;
      try {
        equipo.guardar(d.rol, d.candidata);
        this.impresoras[d.rol] = equipo.crear(d.candidata, d.rol);
        this.avisoSinUsb.delete(d.rol);
        this.logger('info', mensajeConexion(d));
        this.imprimirPruebaDeConexion(d.rol, d.candidata);
      } catch (err: any) {
        this.logger('warn', `No pude conectar la ${NOMBRE_ROL_AUTO[d.rol]} ${d.candidata.nombre}: ${err.message}`);
      }
    }
    if (this.candidatas.length === 0) return;
    for (const rol of ['TICKETERA', 'ETIQUETERA'] as RolImpresora[]) {
      if (this.impresoras[rol] || this.avisoSinUsb.has(rol) || !this.rolHabilitado(rol)) continue;
      this.avisoSinUsb.add(rol);
      this.logger('info', `Aún no veo una ${NOMBRE_ROL_AUTO[rol]} por USB. Sigo buscando cada 30 segundos.`);
    }
  }

  /** Una PC sin configurar (o de un servidor viejo) usa todas sus máquinas; ya configurada, solo las encendidas en el panel. */
  private rolHabilitado(rol: RolImpresora): boolean {
    const c = this.configEquipo;
    if (!c || !c.configurado) return true;
    return rol === 'TICKETERA' ? c.ticketera : c.etiquetera;
  }

  /** Aplica la configuración del latido y lo avisa en el registro solo cuando cambia. */
  private aplicarConfigEquipo(c: ConfigEquipoParaAgente): void {
    const antes = JSON.stringify(this.configEquipo ?? null);
    this.configEquipo = c;
    if (JSON.stringify(c) === antes) return;
    this.logger(
      'info',
      !c.configurado
        ? 'Esta PC aún no está configurada en Caprichos: no imprime pedidos hasta que la configures en el panel.'
        : `Configuración de esta PC actualizada: ticketera ${c.ticketera ? 'sí' : 'no'}, etiquetera ${c.etiquetera ? 'sí' : 'no'}${c.pausado ? ' (en pausa)' : ''}.`,
    );
    this.ultimoLatidoTs = 0; // que el panel vea la máquina nueva en el próximo ciclo
  }

  /** Sticker sin tamaño en el trabajo: el propio de esta PC o el de fábrica (el servidor ya lo manda normalmente). */
  private conTamanoLocal(trabajo: TrabajoImpresion): TrabajoImpresion {
    const p = trabajo.payload as any;
    const c = this.configEquipo;
    if (!c || p?.tamanoMm) return trabajo;
    if (trabajo.tipo === 'ETIQUETA_GENERAL') return { ...trabajo, payload: { ...p, tamanoMm: tamanoEfectivo(c.tamanoGeneral, TAMANO_GENERAL_DEFECTO) } };
    if (trabajo.tipo === 'ETIQUETA_BEBIDA') return { ...trabajo, payload: { ...p, tamanoMm: tamanoEfectivo(c.tamanoBebida, TAMANO_BEBIDA_DEFECTO) } };
    return trabajo;
  }

  /** Al conectarse sola a una impresora, imprime una hoja corta: así se ve que funciona (sin esperar un pedido). */
  private imprimirPruebaDeConexion(rol: RolImpresora, candidata: CandidataLocal): void {
    const dispositivo = this.impresoras[rol];
    if (!dispositivo) return;
    const marca = 'CONECTADA';
    const bytes =
      rol === 'TICKETERA'
        ? generarPruebaTicket(candidata.nombre, rol, this.config.ticketColumnas, undefined, marca)
        : generarPruebaEtiqueta(candidata.nombre, rol, this.config.etiqueta, undefined, marca);
    void dispositivo
      .escribir(bytes)
      .then(() => this.logger('info', `Imprimí una hoja de prueba en la ${NOMBRE_ROL_AUTO[rol]} ${candidata.nombre}.`))
      .catch((err: any) => this.logger('warn', `No pude imprimir la hoja de prueba en ${candidata.nombre}: ${err?.message ?? err}`));
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
    const faltaRol = !!this.equipo && !(this.impresoras.TICKETERA && this.impresoras.ETIQUETERA);
    const esperaLatido = this.algunaFalla
      ? Math.min(this.config.intervaloLatidoMs, REINTENTO_FALTANTE_MS)
      : faltaRol
        ? Math.min(this.config.intervaloLatidoMs, REESCANEO_SIN_IMPRESORA_MS)
        : this.config.intervaloLatidoMs;
    if (ahora - this.ultimoLatidoTs >= esperaLatido) {
      try {
        if (this.equipo) {
          this.candidatas = await this.equipo.listar().catch(() => []);
          this.autoConectar();
        }
        const reportadas: ImpresoraReportada[] = [];
        for (const rol of ['ETIQUETERA', 'TICKETERA'] as RolImpresora[]) {
          const dispositivo = this.impresoras[rol];
          if (!dispositivo) continue;
          const e = await dispositivo.verificarEstado().catch((err: any) => ({
            estado: 'error' as EstadoImpresora,
            detalle: err.message as string | undefined,
          }));
          const id = this.equipo?.idActual(rol);
          const nombre = id ? this.candidatas.find((c) => c.id === id)?.nombre ?? id : undefined;
          reportadas.push({ rol, estado: e.estado, detalle: e.detalle, ...(id ? { id, nombre } : {}) });
        }
        this.algunaFalla = !!this.equipo && reportadas.some((r) => r.estado !== 'lista');
        this.estadosRol = reportadas;
        this.rolesListos = reportadas.filter((r) => r.estado === 'lista' && this.rolHabilitado(r.rol)).map((r) => r.rol);
        const etiquetera = reportadas.find((r) => r.rol === 'ETIQUETERA') ?? reportadas[0];
        this.estadoImpresora = etiquetera ? etiquetera.estado : 'desconectada';
        this.detalleEstadoImpresora = etiquetera?.detalle;

        const args: Parameters<IClienteApiImpresion['enviarLatido']> = [this.config.version, this.estadoImpresora, this.detalleEstadoImpresora];
        if (this.modoPorRol || this.equipo) args[3] = reportadas;
        if (this.equipo) {
          args[4] = this.candidatas.map(paraServidor);
          args[5] = this.infoEquipo();
        }
        const respuesta = await this.clienteApi.enviarLatido(...args);
        if (this.equipo && respuesta?.equipo) this.aplicarConfigEquipo(respuesta.equipo);
        if (this.equipo && respuesta?.seleccion) this.aplicarSeleccion(respuesta.seleccion);
        this.ultimoLatidoTs = ahora;
        this.logger(
          'debug',
          `Latido enviado. Estado impresora: ${this.estadoImpresora}`
        );
      } catch (err: any) {
        if (err instanceof ErrorRespuestaApi && err.status === 401) {
          this.ultimoLatidoTs = ahora; // sin vínculo válido: no martillar, vuelve a probar en el próximo intervalo
        } else {
          this.logger('warn', `No se pudo enviar latido al servidor: ${err.message}`);
        }
      }
    }

    // 2. Confirmar lo impreso antes de tomar nada nuevo (si no, el servidor podría devolver a la cola un trabajo ya impreso)
    await this.vaciarReportes();
    if (this.reportesPendientes.length > 0) {
      this.factorEsperaRed = Math.min(10, this.factorEsperaRed * 1.5);
      return { trabajosProcesados: 0, errorRed: true };
    }

    // 3. Tomar trabajos pendientes
    let trabajos: TrabajoImpresion[] = [];
    try {
      // Una máquina que falla o no está lista no toma trabajos: los suyos esperan en la cola del servidor
      trabajos = this.modoPorRol
        ? this.rolesListos.length === 0 && !this.equipo
          ? []
          : this.equipo
            ? await this.clienteApi.tomarTrabajos(this.config.maxTrabajosPorLote, this.rolesListos, true)
            : await this.clienteApi.tomarTrabajos(this.config.maxTrabajosPorLote, this.rolesListos)
        : await this.clienteApi.tomarTrabajos(this.config.maxTrabajosPorLote);
      // Conexión exitosa: restablecemos el multiplicador de espera
      this.factorEsperaRed = 1;
    } catch (err: any) {
      // 401: el aviso claro ya salió una vez (revinculacion.ts); aquí solo se espera más
      if (!(err instanceof ErrorRespuestaApi && err.status === 401)) {
        this.logger('warn', `Fallo al tomar trabajos (reintentando con espera creciente): ${err.message}`);
      }
      // Incremento exponencial de backoff limitado a 30s
      this.factorEsperaRed = Math.min(10, this.factorEsperaRed * 1.5);
      return { trabajosProcesados: 0, errorRed: true };
    }

    if (trabajos.length === 0) {
      return { trabajosProcesados: 0, errorRed: false };
    }

    this.logger('info', `Tomados ${trabajos.length} trabajo(s) de impresión`);

    // 4. Procesar cada trabajo en serie
    for (const trabajo of trabajos) {
      await this.procesarTrabajo(trabajo);
    }
    this.ultimaActividadTs = Date.now();

    return { trabajosProcesados: trabajos.length, errorRed: false };
  }

  /**
   * Procesa un trabajo individual: genera TSPL, escribe al dispositivo y reporta resultado.
   */
  private async procesarTrabajo(trabajoRecibido: TrabajoImpresion): Promise<void> {
    const trabajo = this.conTamanoLocal(trabajoRecibido);
    this.logger(
      'info',
      `Imprimiendo trabajo ${trabajo.id} (tipo: ${trabajo.tipo}, copia: ${trabajo.copia})`
    );

    const rol: RolImpresora = rolDeTrabajo(trabajo.tipo);
    // Prueba dirigida a una impresora concreta del equipo: no toca el estado de la máquina configurada
    const dirigida = this.equipo ? (trabajo.payload as any)?.prueba?.impresoraId as string | undefined : undefined;
    try {
      if (dirigida) {
        const c = this.candidatas.find((x) => x.id === dirigida) ?? (await this.equipo!.listar().catch(() => [])).find((x) => x.id === dirigida);
        if (!c) {
          throw new ErrorImpresora(`Impresora no encontrada: ${(trabajo.payload as any)?.prueba?.nombre ?? dirigida}`, 'desconectada');
        }
        const marca = (trabajo.payload as any)?.prueba?.marca as string | undefined;
        const bytes =
          rol === 'TICKETERA'
            ? generarPruebaTicket(c.nombre, rol, this.config.ticketColumnas, undefined, marca)
            : generarPruebaEtiqueta(c.nombre, rol, this.config.etiqueta, undefined, marca);
        await this.equipo!.crear(c, rol).escribir(bytes);
        this.reportesPendientes.push(trabajo.id);
        await this.vaciarReportes();
        return;
      }
      const dispositivo = this.impresoras[rol];
      if (!dispositivo) {
        throw new ErrorImpresora(`La ${rol.toLowerCase()} no está configurada en este equipo`, 'desconectada');
      }
      const bytes =
        trabajo.tipo === 'TICKET_PAGO'
          ? generarTicketEscPos(trabajo.payload as any, this.config.ticketColumnas)
          : trabajo.tipo === 'TICKET_COMANDA_SALON' || trabajo.tipo === 'TICKET_COMANDA_AREA'
            ? generarComandaSalonEscPos(trabajo.payload as any, this.config.ticketColumnas)
            : generarBytesTrabajo(trabajo.tipo, trabajo.payload as any, trabajo.copia, this.config.etiqueta);
      await dispositivo.escribir(bytes);
    } catch (err: any) {
      const mensajeError = err.message || 'Error desconocido al imprimir';

      // Una máquina que falla deja de tomar trabajos hasta que el próximo latido la vea lista
      if (!dirigida) this.rolesListos = this.rolesListos.filter((r) => r !== rol);
      if (dirigida) {
        // no cambia el estado de la máquina configurada
      } else if (err instanceof ErrorImpresora) {
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

      // Reportar fallo al servidor para que contabilice el intento sin perder el trabajo.
      // Se reporta una sola vez: ok=false suma intentos en el servidor, no es idempotente.
      try {
        await this.clienteApi.reportarResultado(trabajo.id, false, mensajeError);
      } catch (errReporte: any) {
        this.logger(
          'warn',
          `No se pudo reportar el fallo del trabajo ${trabajo.id} al servidor: ${errReporte.message}`
        );
      }
      return;
    }

    // Ya salió de la impresora: nunca se vuelve a imprimir por un fallo al confirmarlo.
    if (rol === 'ETIQUETERA') {
      this.estadoImpresora = 'lista';
      this.detalleEstadoImpresora = undefined;
    }
    this.reportesPendientes.push(trabajo.id);
    await this.vaciarReportes();
  }

  /**
   * Confirma al servidor los trabajos impresos (ok=true, idempotente: reintentarlo es seguro).
   * Lo que no se confirma se reintenta antes de volver a tomar trabajos, así el servidor no puede
   * devolver a la cola un trabajo que ya salió. Un 4xx (p. ej. trabajo borrado) se descarta.
   */
  private async vaciarReportes(): Promise<void> {
    while (this.reportesPendientes.length > 0) {
      const id = this.reportesPendientes[0];
      try {
        await this.clienteApi.reportarResultado(id, true);
        this.reportesPendientes.shift();
        this.logger('info', `Trabajo ${id} impreso y confirmado con éxito`);
      } catch (err: any) {
        if (err instanceof ErrorRespuestaApi && err.status >= 400 && err.status < 500) {
          this.reportesPendientes.shift();
          this.logger('warn', `El servidor rechazó la confirmación del trabajo ${id} (${err.status}): se descarta`);
          continue;
        }
        this.logger('warn', `No se pudo confirmar el trabajo ${id}; se reintenta en el próximo ciclo: ${err.message}`);
        return;
      }
    }
  }

  /**
   * Aplica lo elegido en el panel: solo si esa impresora está en el equipo; si no aparece, se queda con
   * la guardada (nunca cambia a otra distinta por su cuenta) y lo avisa en el registro.
   */
  private aplicarSeleccion(seleccion: Partial<Record<RolImpresora, string>>): void {
    for (const rol of ['ETIQUETERA', 'TICKETERA'] as RolImpresora[]) {
      const id = seleccion[rol];
      if (!id || id === this.equipo!.idActual(rol)) continue;
      const c = this.candidatas.find((x) => x.id === id);
      if (!c) {
        this.logger('warn', `Impresora elegida para la ${rol.toLowerCase()} no encontrada: ${id}. Se sigue con la guardada.`);
        continue;
      }
      this.equipo!.guardar(rol, c);
      this.impresoras[rol] = this.equipo!.crear(c, rol);
      this.ultimoLatidoTs = 0; // que el panel vea el cambio en el próximo ciclo
      this.logger('info', `La ${rol.toLowerCase()} ahora es: ${c.nombre}`);
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
