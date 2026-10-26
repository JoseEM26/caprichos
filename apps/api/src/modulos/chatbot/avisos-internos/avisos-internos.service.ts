import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ConfiguracionService } from '../../configuracion/configuracion.service';
import {
  ResultadoEnvioWhatsApp,
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { enmascararTelefono, hashTelefono, normalizarTelefono } from '../utilidades/enmascarar.util';
import {
  DatosAvisoAlmacen,
  DatosAvisoNuevoPedido,
  ResultadoEnvioEquipo,
  ResultadoNotificacionEquipo,
} from './avisos-internos.tipos';
import {
  BOTONES_AVISO_ALMACEN,
  BOTONES_AVISO_PEDIDO,
  TEXTOS_AVISOS,
} from './avisos-internos.textos';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

@Injectable()
export class AvisosInternosService {
  private readonly logger = new Logger(AvisosInternosService.name);
  private readonly memoriaIdempotencia = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly configuracionService: ConfiguracionService,
    private readonly auditoriaService: AuditoriaService,
    private readonly ventana24hService: Ventana24hService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /**
   * Obtiene la lista de números del equipo configurados en ADMIN_WHATSAPP_NUMBERS.
   * Por seguridad (Ley 29733 / RNF), nunca se expone el valor crudo en logs.
   */
  public obtenerNumerosEquipo(): string[] {
    const configVal = this.configService.get<string>('ADMIN_WHATSAPP_NUMBERS');
    const raw = configVal !== undefined ? configVal : (process.env.ADMIN_WHATSAPP_NUMBERS || '');

    if (!raw || !raw.trim()) {
      return [];
    }

    return raw
      .split(',')
      .map((n) => normalizarTelefono(n.trim()))
      .filter((n) => n.length >= 8);
  }

  /**
   * Verifica si los avisos internos al equipo están habilitados en la configuración.
   * Parámetro: chatbot_avisos_equipo_activo (por defecto apagado en tests/entornos sin activar).
   */
  async estanAvisosActivos(): Promise<boolean> {
    try {
      const valor = await this.configuracionService.obtener('chatbot_avisos_equipo_activo');
      return valor === true || String(valor).toLowerCase() === 'si';
    } catch (err: any) {
      this.logger.warn(`Error al leer chatbot_avisos_equipo_activo: ${err.message}`);
      return false;
    }
  }

  /**
   * Verifica y adquiere la clave de idempotencia en Redis (con fallback en memoria).
   * Devuelve true si es el primer envío (procede), o false si ya se envió antes.
   */
  private async adquirirIdempotencia(clave: string, ttlSegundos = 86400): Promise<boolean> {
    try {
      const redis = this.redisService.obtenerCliente();
      if (redis && typeof redis.set === 'function') {
        const res = await redis.set(clave, '1', 'EX', ttlSegundos, 'NX');
        return res === 'OK';
      }
    } catch (err: any) {
      this.logger.warn(`Fallo al consultar Redis para idempotencia (${clave}): ${err.message}. Usando memoria.`);
    }

    if (this.memoriaIdempotencia.has(clave)) {
      return false;
    }
    this.memoriaIdempotencia.add(clave);
    return true;
  }

  /**
   * Ejecuta un envío con reintentos acotados (máx 2 reintentos) para garantizar best-effort
   * sin bloquear flujos transaccionales ni colgar procesos.
   */
  private async enviarConReintentos(
    fn: () => Promise<ResultadoEnvioWhatsApp>,
    maxReintentos = 2,
  ): Promise<ResultadoEnvioWhatsApp> {
    let ultimoResultado: ResultadoEnvioWhatsApp = {
      exito: false,
      estado: 'FALLIDO',
      errorCodigo: 'NO_INTENTADO',
      errorDetalle: 'Envío no iniciado',
    };

    for (let intento = 0; intento <= maxReintentos; intento++) {
      try {
        ultimoResultado = await fn();
        if (ultimoResultado.exito) {
          return ultimoResultado;
        }
      } catch (err: any) {
        ultimoResultado = {
          exito: false,
          estado: 'FALLIDO',
          errorCodigo: 'ERROR_CONEXION',
          errorDetalle: err.message,
        };
      }

      if (intento < maxReintentos) {
        // Pausa breve no bloqueante (200ms) entre reintentos
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return ultimoResultado;
  }

  /**
   * Notifica al equipo por WhatsApp al crearse un pedido nuevo (cualquier canal).
   * No bloquea ni retrasa el pedido.
   */
  async notificarNuevoPedido(pedidoId: bigint | string): Promise<ResultadoNotificacionEquipo> {
    const activo = await this.estanAvisosActivos();
    if (!activo) {
      this.logger.log('Avisos internos al equipo desactivados en configuración (chatbot_avisos_equipo_activo).');
      return {
        omitido: true,
        motivo: 'DESACTIVADO',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const numerosEquipo = this.obtenerNumerosEquipo();
    if (numerosEquipo.length === 0) {
      this.logger.log('No se enviaron avisos: variable ADMIN_WHATSAPP_NUMBERS no configurada o vacía.');
      return {
        omitido: true,
        motivo: 'SIN_NUMEROS',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: BigInt(pedidoId) },
      include: {
        lineas: {
          select: {
            nombre: true,
            cantidad: true,
            tamano: true,
            nota: true,
          },
        },
      },
    });

    if (!pedido) {
      this.logger.warn(`No se encontró el pedido ${pedidoId} para aviso al equipo.`);
      return {
        omitido: true,
        motivo: 'PROCESADO',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const clienteMask = pedido.cliente_telefono
      ? enmascararTelefono(pedido.cliente_telefono)
      : 'No registrado';

    const datosPedido: DatosAvisoNuevoPedido = {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
      canal: pedido.canal,
      modalidad: pedido.modalidad,
      clienteNombre: pedido.cliente_nombre || 'Cliente',
      clienteTelefonoMask: clienteMask,
      total: Number(pedido.total),
      direccion: pedido.entrega_direccion,
      referencia: pedido.entrega_referencia,
      lineas: pedido.lineas,
      creadoEn: pedido.creado_en,
    };

    const textoCuerpo = TEXTOS_AVISOS.nuevoPedido(datosPedido);
    const botones = BOTONES_AVISO_PEDIDO(pedido.id);

    const detalles: ResultadoEnvioEquipo[] = [];
    let exitosos = 0;

    for (const telefono of numerosEquipo) {
      const telMask = enmascararTelefono(telefono);
      const telHash = hashTelefono(telefono);
      const claveIdemp = `idemp:aviso:pedido:${pedido.id}:${telHash}`;

      const esPrimerEnvio = await this.adquirirIdempotencia(claveIdemp);
      if (!esPrimerEnvio) {
        this.logger.log(`Aviso de pedido ${pedido.codigo} a ${telMask} omitido por idempotencia.`);
        detalles.push({
          telefonoEnmascarado: telMask,
          exito: true,
          modo: 'OMITIDO_IDEMPOTENTE',
        });
        continue;
      }

      // Evaluar si el número del equipo se encuentra dentro de la ventana de 24 horas
      const ventanaAbierta = await this.ventana24hService.esVentanaAbierta(telefono);
      let resultado: ResultadoEnvioWhatsApp;
      let modoEnvio: 'VENTANA_24H' | 'PLANTILLA';

      if (ventanaAbierta) {
        modoEnvio = 'VENTANA_24H';
        resultado = await this.enviarConReintentos(() =>
          this.mensajeria.enviarBotones(telefono, textoCuerpo, botones, {
            pedidoId: pedido.id,
          }),
        );
      } else {
        modoEnvio = 'PLANTILLA';
        const definicion = CATALOGO_PLANTILLAS.EQUIPO_NUEVO_PEDIDO;
        const modalidadCliente = `${pedido.modalidad} - ${pedido.cliente_nombre || 'Cliente'}`;
        resultado = await this.enviarConReintentos(() =>
          this.mensajeria.enviarPlantilla(
            telefono,
            definicion.nombre,
            definicion.idioma,
            [pedido.codigo, modalidadCliente, Number(pedido.total).toFixed(2)],
            { pedidoId: pedido.id },
          ),
        );
      }

      if (resultado.exito) {
        exitosos++;
        this.logger.log(`Aviso interno de pedido ${pedido.codigo} enviado a ${telMask} (${modoEnvio}).`);
      } else {
        this.logger.warn(
          `Fallo al enviar aviso interno de pedido ${pedido.codigo} a ${telMask}: ${resultado.errorDetalle}`,
        );
      }

      detalles.push({
        telefonoEnmascarado: telMask,
        exito: resultado.exito,
        modo: resultado.exito ? modoEnvio : 'ERROR',
        waMessageId: resultado.waMessageId,
        error: resultado.errorDetalle,
      });

      // Registro en tabla whatsapp_mensaje para trazabilidad
      await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: resultado.waMessageId || null,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: modoEnvio === 'PLANTILLA' ? 'PLANTILLA' : 'BOTON',
          plantilla: modoEnvio === 'PLANTILLA' ? 'caprichos_equipo_nuevo_pedido' : null,
          estado: resultado.exito ? (resultado.estado || 'ENVIADO') : 'FALLIDO',
          error_codigo: resultado.errorCodigo || null,
          error_detalle: resultado.errorDetalle || null,
          pedido_id: pedido.id,
        },
      }).catch((e) => {
        this.logger.warn(`No se pudo persistir registro de whatsapp_mensaje: ${e.message}`);
      });

      // Auditoría de envío
      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'chatbot',
        accion: 'WHATSAPP_AVISO_EQUIPO_PEDIDO',
        resultado: resultado.exito ? 'OK' : 'RECHAZADO',
        entidad: 'pedido',
        entidadId: pedido.id,
        despues: {
          pedidoCodigo: pedido.codigo,
          canal: pedido.canal,
          destino: telMask,
          modoEnvio,
          exito: resultado.exito,
        },
      }).catch(() => {});
    }

    return {
      omitido: false,
      motivo: 'PROCESADO',
      destinatariosTotal: numerosEquipo.length,
      enviosExitosos: exitosos,
      detalles,
    };
  }

  /**
   * Notifica al equipo cuando Almacén debe saber algo (insumo agotado o por pedir).
   */
  async notificarAlmacen(datos: DatosAvisoAlmacen): Promise<ResultadoNotificacionEquipo> {
    const activo = await this.estanAvisosActivos();
    if (!activo) {
      return {
        omitido: true,
        motivo: 'DESACTIVADO',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const numerosEquipo = this.obtenerNumerosEquipo();
    if (numerosEquipo.length === 0) {
      return {
        omitido: true,
        motivo: 'SIN_NUMEROS',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const esAgotado = datos.tipoAlerta === 'AGOTADO';
    const textoCuerpo = esAgotado
      ? TEXTOS_AVISOS.almacenInsumoAgotado(datos)
      : TEXTOS_AVISOS.almacenInsumoPorPedir(datos);

    const botones = BOTONES_AVISO_ALMACEN(datos.insumoId);
    const fechaHoy = new Date().toISOString().slice(0, 10);

    const detalles: ResultadoEnvioEquipo[] = [];
    let exitosos = 0;

    for (const telefono of numerosEquipo) {
      const telMask = enmascararTelefono(telefono);
      const telHash = hashTelefono(telefono);
      const claveIdemp = `idemp:aviso:almacen:${datos.insumoId}:${datos.tipoAlerta}:${fechaHoy}:${telHash}`;

      const esPrimerEnvio = await this.adquirirIdempotencia(claveIdemp);
      if (!esPrimerEnvio) {
        this.logger.log(`Aviso de almacén (${datos.nombreInsumo}) a ${telMask} omitido por idempotencia diaria.`);
        detalles.push({
          telefonoEnmascarado: telMask,
          exito: true,
          modo: 'OMITIDO_IDEMPOTENTE',
        });
        continue;
      }

      const ventanaAbierta = await this.ventana24hService.esVentanaAbierta(telefono);
      let resultado: ResultadoEnvioWhatsApp;
      let modoEnvio: 'VENTANA_24H' | 'PLANTILLA';

      if (ventanaAbierta) {
        modoEnvio = 'VENTANA_24H';
        resultado = await this.enviarConReintentos(() =>
          this.mensajeria.enviarBotones(telefono, textoCuerpo, botones),
        );
      } else {
        modoEnvio = 'PLANTILLA';
        const definicion = CATALOGO_PLANTILLAS.EQUIPO_ALERTA_ALMACEN;
        const estadoEtiqueta = esAgotado ? 'Agotado' : 'Por pedir';
        const stockStr = `${Number(datos.stockActual).toFixed(2)} ${datos.unidadMedida || 'UND'}`;
        resultado = await this.enviarConReintentos(() =>
          this.mensajeria.enviarPlantilla(
            telefono,
            definicion.nombre,
            definicion.idioma,
            [datos.nombreInsumo, estadoEtiqueta, stockStr],
          ),
        );
      }

      if (resultado.exito) {
        exitosos++;
        this.logger.log(`Aviso de almacén (${datos.nombreInsumo}) enviado a ${telMask} (${modoEnvio}).`);
      } else {
        this.logger.warn(`Fallo al enviar aviso de almacén a ${telMask}: ${resultado.errorDetalle}`);
      }

      detalles.push({
        telefonoEnmascarado: telMask,
        exito: resultado.exito,
        modo: resultado.exito ? modoEnvio : 'ERROR',
        waMessageId: resultado.waMessageId,
        error: resultado.errorDetalle,
      });

      // Registro en auditoría
      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'chatbot',
        accion: 'WHATSAPP_AVISO_EQUIPO_ALMACEN',
        resultado: resultado.exito ? 'OK' : 'RECHAZADO',
        entidad: 'insumo',
        entidadId: BigInt(datos.insumoId),
        despues: {
          insumo: datos.nombreInsumo,
          tipoAlerta: datos.tipoAlerta,
          stockActual: datos.stockActual,
          destino: telMask,
          modoEnvio,
          exito: resultado.exito,
        },
      }).catch(() => {});
    }

    return {
      omitido: false,
      motivo: 'PROCESADO',
      destinatariosTotal: numerosEquipo.length,
      enviosExitosos: exitosos,
      detalles,
    };
  }

  /**
   * Helper conveniente para notificar cuando un insumo ha llegado a stock 0 o negativo.
   */
  async notificarInsumoAgotado(insumoId: bigint | string): Promise<ResultadoNotificacionEquipo> {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: BigInt(insumoId) },
      include: {
        lugarConsumo: true,
        stocks: true,
      },
    });

    if (!insumo) {
      return {
        omitido: true,
        motivo: 'PROCESADO',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const stockActual = insumo.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);

    return this.notificarAlmacen({
      insumoId: insumo.id,
      nombreInsumo: insumo.nombre,
      tipoAlerta: 'AGOTADO',
      stockActual,
      stockMinimo: Number(insumo.minimo),
      unidadMedida: insumo.unidad_almacen,
      lugarNombre: insumo.lugarConsumo?.nombre ?? null,
    });
  }

  /**
   * Helper conveniente para notificar cuando un insumo se encuentra por debajo de su stock mínimo.
   */
  async notificarInsumoBajoStock(insumoId: bigint | string): Promise<ResultadoNotificacionEquipo> {
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: BigInt(insumoId) },
      include: {
        lugarConsumo: true,
        stocks: true,
      },
    });

    if (!insumo) {
      return {
        omitido: true,
        motivo: 'PROCESADO',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const stockActual = insumo.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);

    return this.notificarAlmacen({
      insumoId: insumo.id,
      nombreInsumo: insumo.nombre,
      tipoAlerta: 'POR_PEDIR',
      stockActual,
      stockMinimo: Number(insumo.minimo),
      unidadMedida: insumo.unidad_almacen,
      lugarNombre: insumo.lugarConsumo?.nombre ?? null,
    });
  }

  /**
   * Helper para notificar cuando un elemento de carta se agota manualmente.
   */
  async notificarElementoAgotado(
    tipo: 'PRODUCTO' | 'SABOR' | 'OPCION',
    id: bigint | string,
  ): Promise<ResultadoNotificacionEquipo> {
    let nombre = `${tipo} #${id}`;
    if (tipo === 'PRODUCTO') {
      const prod = await this.prisma.producto.findUnique({ where: { id: BigInt(id) } });
      if (prod) nombre = prod.nombre;
    } else if (tipo === 'SABOR') {
      const sab = await this.prisma.sabor.findUnique({ where: { id: BigInt(id) } });
      if (sab) nombre = sab.nombre;
    } else if (tipo === 'OPCION') {
      const opc = await this.prisma.opcion.findUnique({
        where: { id: BigInt(id) },
        include: { valor: true },
      });
      if (opc?.valor?.nombre) nombre = opc.valor.nombre;
    }

    return this.notificarAlmacen({
      insumoId: id,
      nombreInsumo: `${tipo}: ${nombre}`,
      tipoAlerta: 'AGOTADO',
      stockActual: 0,
      stockMinimo: 0,
      unidadMedida: 'UND',
    });
  }

  /**
   * Procesa la pulsación de los botones ✅ Aprobar / ❌ Rechazar desde el WhatsApp de Cocina/Admin
   * (conforme a las reglas de negocio: la decisión la ejecuta la persona humana desde su celular).
   */
  async procesarAccionEquipo(
    telefono: string,
    payload: string,
  ): Promise<{ procesado: boolean; mensaje?: string }> {
    const telefonoNorm = normalizarTelefono(telefono);
    const numerosEquipo = this.obtenerNumerosEquipo();

    // Solo los números autorizados en ADMIN_WHATSAPP_NUMBERS pueden ejecutar acciones
    if (!numerosEquipo.includes(telefonoNorm)) {
      return { procesado: false };
    }

    if (payload.startsWith('ped_apr_') || payload.startsWith('ped_rec_')) {
      const esAprobacion = payload.startsWith('ped_apr_');
      const pedidoIdStr = payload.replace(esAprobacion ? 'ped_apr_' : 'ped_rec_', '').trim();

      const pedido = await this.prisma.pedido.findUnique({
        where: { id: BigInt(pedidoIdStr) },
      });

      if (!pedido) {
        return { procesado: true, mensaje: 'Pedido no encontrado' };
      }

      const telMask = enmascararTelefono(telefonoNorm);
      const accion = esAprobacion ? 'APROBADO' : 'RECHAZADO';

      this.logger.log(`Comanda ${pedido.codigo} marcada como ${accion} por miembro del equipo (${telMask}).`);

      // Notificar por WebSocket a la consola administrativa
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: pedido.id.toString(),
        codigo: pedido.codigo,
        accion,
        porEquipoWa: true,
      });

      const respuestaTexto = TEXTOS_AVISOS.confirmacionAccionAdmin(accion, pedido.codigo);
      await this.mensajeria.enviarTexto(telefonoNorm, respuestaTexto).catch(() => {});

      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'chatbot',
        accion: `PEDIDO_${accion}_DESDE_WHATSAPP`,
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        motivo: `Acción ejecutada desde WhatsApp por ${telMask}`,
        despues: { codigo: pedido.codigo, remitente: telMask },
      }).catch(() => {});

      return { procesado: true, mensaje: respuestaTexto };
    }

    if (payload.startsWith('alm_ok_')) {
      const insumoId = payload.replace('alm_ok_', '').trim();
      const respuestaTexto = '👍 Alerta de almacén confirmada como leída.';
      await this.mensajeria.enviarTexto(telefonoNorm, respuestaTexto).catch(() => {});
      return { procesado: true, mensaje: respuestaTexto };
    }

    return { procesado: false };
  }
}
