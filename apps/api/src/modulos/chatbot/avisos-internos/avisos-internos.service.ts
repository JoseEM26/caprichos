import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ConfiguracionService } from '../../configuracion/configuracion.service';
import {
  BotonAccion,
  ResultadoEnvioWhatsApp,
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { enmascararTelefono, hashTelefono, normalizarTelefono, tieneTelefonoReal } from '../utilidades/enmascarar.util';
import {
  DatosAvisoAlmacen,
  DatosAvisoCalificacionBaja,
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
import {
  ROLES_ALERTAS_WHATSAPP,
  normalizarCelularPeru,
} from '../../usuarios/alertas-whatsapp.util';

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
    private readonly outbox: OutboxWhatsappService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /**
   * Obtiene la lista de números del equipo configurados en ADMIN_WHATSAPP_NUMBERS.
   * Por seguridad (Ley 29733 / RNF), nunca se expone el valor crudo en logs.
   * Se mantiene para compatibilidad con llamadas síncronas de pruebas.
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
   * Obtiene la lista de teléfonos de administradores autorizados para recibir alertas por WhatsApp.
   * Regla de contrato:
   * - Solo usuarios con rol ADMIN, activos, casilla alertas_whatsapp activa y confirmados.
   * - El número se lee del contacto principal de tipo WHATSAPP de su Party.
   * - Compatibilidad: si NINGÚN usuario cumple las condiciones, se usa ADMIN_WHATSAPP_NUMBERS como respaldo
   *   y se emite una advertencia en los logs del sistema.
   */
  public async obtenerDestinatariosAlertas(): Promise<string[]> {
    try {
      const usuarios = await this.prisma.userAccount.findMany({
        where: {
          activo: true,
          rol: { in: [...ROLES_ALERTAS_WHATSAPP] },
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: { not: null },
        },
        include: {
          party: {
            include: {
              contactos: {
                where: { tipo: 'WHATSAPP', activo: true },
                orderBy: { principal: 'desc' },
              },
            },
          },
        },
      });

      const telefonos: string[] = [];
      for (const u of usuarios) {
        const contacto = u.party?.contactos?.find((c) => c.principal) || u.party?.contactos?.[0];
        if (contacto?.valor) {
          const norm = normalizarCelularPeru(contacto.valor);
          if (norm.valido && norm.celularE164) {
            telefonos.push(norm.celularE164);
          }
        }
      }

      if (telefonos.length > 0) {
        return Array.from(new Set(telefonos));
      }

      this.logger.warn(
        'Ningún usuario administrador cumple las condiciones (activo, rol ADMIN, alertas activas y confirmadas). Usando ADMIN_WHATSAPP_NUMBERS como respaldo.',
      );
      return this.obtenerNumerosEquipo();
    } catch (err: any) {
      this.logger.error(`Error al obtener destinatarios de alertas WhatsApp: ${err.message}. Usando respaldo.`);
      return this.obtenerNumerosEquipo();
    }
  }

  /**
   * Verifica dinámicamente si un número pertenece a un usuario autorizado para actuar con los botones del bot.
   * Regla de contrato:
   * - "Solo recibe y puede actuar con los botones del bot el usuario ACTIVO, con rol ADMIN, casilla activa y confirmado."
   * - "Si se desactiva o se le quita la casilla, deja de recibir y de poder aprobar/rechazar desde WhatsApp al instante (se valida en cada envio y en cada accion, no solo al guardar)."
   * - Si ningún usuario está configurado, usa ADMIN_WHATSAPP_NUMBERS como respaldo.
   */
  public async esTelefonoAutorizado(telefono: string): Promise<boolean> {
    const norm = normalizarTelefono(telefono);
    const soloDigitos = norm.replace(/\D/g, '');
    const ultimos9 = soloDigitos.slice(-9);

    try {
      const usuarios = await this.prisma.userAccount.findMany({
        where: {
          activo: true,
          rol: { in: [...ROLES_ALERTAS_WHATSAPP] },
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: { not: null },
        },
        include: {
          party: {
            include: {
              contactos: {
                where: { tipo: 'WHATSAPP', activo: true },
              },
            },
          },
        },
      });

      if (usuarios.length > 0) {
        return usuarios.some((u) =>
          u.party?.contactos?.some((c) => {
            const cDigitos = c.valor.replace(/\D/g, '');
            return cDigitos.endsWith(ultimos9);
          }),
        );
      }

      const respaldo = this.obtenerNumerosEquipo();
      return respaldo.some((r) => r.replace(/\D/g, '').endsWith(ultimos9));
    } catch (err: any) {
      this.logger.error(`Error verificando autorización de teléfono: ${err.message}`);
      const respaldo = this.obtenerNumerosEquipo();
      return respaldo.some((r) => r.replace(/\D/g, '').endsWith(ultimos9));
    }
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
  /** Despierta el envío del outbox tras un commit que encoló avisos con `tx`. */
  despertarOutbox(): void {
    this.outbox.despertar();
  }

  /**
   * Avisa al equipo del pedido nuevo: un mensaje por número, encolado en el outbox.
   * Con `tx` (creación del pedido) el encolado va en esa transacción; sin `tx`, cada número se encola sola.
   */
  async notificarNuevoPedido(pedidoId: bigint | string, tx?: Prisma.TransactionClient): Promise<ResultadoNotificacionEquipo> {
    const db = tx ?? this.prisma;
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

    const numerosEquipo = await this.obtenerDestinatariosAlertas();
    if (numerosEquipo.length === 0) {
      this.logger.log('No se enviaron avisos: no hay destinatarios de alertas ni variable de respaldo configurada.');
      return {
        omitido: true,
        motivo: 'SIN_NUMEROS',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const pedido = await db.pedido.findUnique({
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

    const clienteMask = tieneTelefonoReal(pedido.cliente_telefono)
      ? enmascararTelefono(pedido.cliente_telefono!)
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
      // Un aviso por pedido y número: la clave del outbox evita el duplicado (sin Redis)
      const nuevo = await this.outbox.encolar(
        {
          telefono,
          tipo: 'TEXTO',
          clave: `equipo-nuevo-pedido:${pedido.id}:${telHash}`,
          origen: 'EQUIPO_NUEVO_PEDIDO',
          pedidoId: pedido.id,
          carga: {
            textoLibre: textoCuerpo,
            botones,
            plantillaClave: 'EQUIPO_NUEVO_PEDIDO',
            variablesPlantilla: [
              pedido.codigo,
              `${pedido.modalidad} - ${pedido.cliente_nombre || 'Cliente'}`,
              Number(pedido.total).toFixed(2),
            ],
            autor: 'BOT',
            etapa: 'EQUIPO_NUEVO_PEDIDO',
          },
        },
        tx,
      );
      if (nuevo) exitosos++;
      detalles.push({
        telefonoEnmascarado: telMask,
        exito: true,
        modo: nuevo ? 'ENCOLADO' : 'OMITIDO_IDEMPOTENTE',
      });
      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'chatbot',
        accion: 'WHATSAPP_AVISO_EQUIPO_PEDIDO',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        despues: { pedidoCodigo: pedido.codigo, canal: pedido.canal, destino: telMask, encolado: nuevo },
      }).catch(() => {});
    }
    if (!tx) this.outbox.despertar();

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
  async notificarAlmacen(datos: DatosAvisoAlmacen, tx?: Prisma.TransactionClient): Promise<ResultadoNotificacionEquipo> {
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

    const numerosEquipo = await this.obtenerDestinatariosAlertas();
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
      // Una alerta por insumo, tipo y día por número: la clave del outbox lo garantiza (sin Redis)
      const nuevo = await this.outbox.encolar(
        {
          telefono,
          tipo: 'TEXTO',
          clave: `almacen:${datos.insumoId}:${datos.tipoAlerta}:${fechaHoy}:${telHash}`,
          origen: 'EQUIPO_ALERTA_ALMACEN',
          carga: {
            textoLibre: textoCuerpo,
            botones,
            plantillaClave: 'EQUIPO_ALERTA_ALMACEN',
            variablesPlantilla: [
              datos.nombreInsumo,
              esAgotado ? 'Agotado' : 'Por pedir',
              `${Number(datos.stockActual).toFixed(2)} ${datos.unidadMedida || 'UND'}`,
            ],
            autor: 'BOT',
            etapa: 'ALMACEN',
          },
        },
        tx,
      );
      if (nuevo) exitosos++;
      detalles.push({
        telefonoEnmascarado: telMask,
        exito: true,
        modo: nuevo ? 'ENCOLADO' : 'OMITIDO_IDEMPOTENTE',
      });
      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'chatbot',
        accion: 'WHATSAPP_AVISO_EQUIPO_ALMACEN',
        resultado: 'OK',
        entidad: 'insumo',
        entidadId: BigInt(datos.insumoId),
        despues: { insumo: datos.nombreInsumo, tipoAlerta: datos.tipoAlerta, destino: telMask, encolado: nuevo },
      }).catch(() => {});
    }
    if (!tx) this.outbox.despertar();

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
  async notificarInsumoAgotado(insumoId: bigint | string, tx?: Prisma.TransactionClient): Promise<ResultadoNotificacionEquipo> {
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
    }, tx);
  }

  /**
   * Helper conveniente para notificar cuando un insumo se encuentra por debajo de su stock mínimo.
   */
  async notificarInsumoBajoStock(insumoId: bigint | string, tx?: Prisma.TransactionClient): Promise<ResultadoNotificacionEquipo> {
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
    }, tx);
  }

  /**
   * Helper para notificar cuando un elemento de carta se agota manualmente.
   */
  async notificarElementoAgotado(
    tipo: 'PRODUCTO' | 'SABOR' | 'OPCION',
    id: bigint | string,
    tx?: Prisma.TransactionClient,
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
    }, tx);
  }

  /**
   * Procesa la pulsación de botones desde WhatsApp por parte del personal o administradores:
   * - Confirmación de alertas WhatsApp (botón 'Sí, soy yo' con payload alr_conf_X)
   * - Acciones sobre comanda (✅ Aprobar / ❌ Rechazar con ped_apr_X / ped_rec_X)
   * - Confirmación de lectura de almacén (alm_ok_X)
   *
   * Regla de contrato:
   * "Solo recibe y puede actuar con los botones del bot el usuario ACTIVO, con rol ADMIN, casilla activa y confirmado."
   * Se valida dinámicamente en cada acción.
   */
  async procesarAccionEquipo(
    telefono: string,
    payload: string,
  ): Promise<{ procesado: boolean; mensaje?: string }> {
    const telefonoNorm = normalizarTelefono(telefono);

    // 1. Botón de confirmación de alertas WhatsApp: "Sí, soy yo" (payload: alr_conf_${usuarioId})
    if (payload.startsWith('alr_conf_')) {
      const usuarioIdStr = payload.replace('alr_conf_', '').trim();
      let userAccount: any = null;
      try {
        userAccount = await this.prisma.userAccount.findUnique({
          where: { id: BigInt(usuarioIdStr) },
          include: {
            party: {
              include: {
                persona: true,
                contactos: { where: { tipo: 'WHATSAPP', activo: true } },
              },
            },
          },
        });
      } catch (err: any) {
        this.logger.error(`Error buscando usuario para confirmación de alertas: ${err.message}`);
      }

      if (
        !userAccount ||
        !userAccount.activo ||
        !ROLES_ALERTAS_WHATSAPP.includes(userAccount.rol as any)
      ) {
        this.logger.warn(
          `Intento de confirmación de alertas fallido para usuario ${usuarioIdStr}: inexistente, inactivo o rol no permitido.`,
        );
        return { procesado: true, mensaje: 'Usuario no encontrado o no autorizado' };
      }

      const ahora = new Date();
      await this.prisma.userAccount.update({
        where: { id: userAccount.id },
        data: {
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: ahora,
        },
      });

      const nombreUsuario = userAccount.party?.persona?.nombres || 'Administrador';
      const respuestaTexto = `✅ ¡Listo, ${nombreUsuario}! Alertas de WhatsApp confirmadas. Recibirás las alertas del sistema en este número.`;
      await this.mensajeria.enviarTexto(telefonoNorm, respuestaTexto).catch(() => {});

      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'usuarios',
        accion: 'CONFIRMAR_ALERTAS_WHATSAPP_BOT',
        resultado: 'OK',
        entidad: 'user_account',
        entidadId: userAccount.id,
        despues: { confirmadoEn: ahora, remitente: enmascararTelefono(telefonoNorm) },
      }).catch(() => {});

      return { procesado: true, mensaje: respuestaTexto };
    }

    // 2. Para el resto de acciones de equipo, validar rigurosamente la autorización dinámica
    const autorizado = await this.esTelefonoAutorizado(telefonoNorm);
    if (!autorizado) {
      this.logger.warn(
        `Acción ${payload} rechazada: teléfono ${enmascararTelefono(telefonoNorm)} no autorizado o usuario inactivo/sin casilla activa.`,
      );
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

  /**
   * Emite una notificación a la campana del panel administrativo (tabla notificacion + WebSocket).
   * Regla de contrato: "Siempre ademas el aviso va a la campana del panel (respaldo y registro)."
   */
  async emitirAvisoCampana(
    titulo: string,
    mensaje: string,
    enlace = '/admin/mensajes',
    partyDestino?: bigint,
  ): Promise<void> {
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'ALERTA_INTERNA',
          rol_destino: 'ADMIN',
          party_destino: partyDestino || null,
          titulo,
          mensaje,
          enlace,
        },
      });

      this.eventosGateway?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo,
        mensaje,
        enlace,
      });
    } catch (err: any) {
      this.logger.warn(`Error al emitir aviso a la campana del panel: ${err.message}`);
    }
  }

  /**
   * Envía una alerta operativa a todos los administradores autorizados.
   * - Siempre emite a la campana del panel.
   * - Respeta la ventana de 24 horas: si abierta, texto interactivo; si cerrada, plantilla 'aviso_interno'.
   * - 24 horas al día (sin filtro de horario).
   */
  async enviarAvisoAdmin(
    titulo: string,
    detalle: string,
    enlace: string,
    botones?: BotonAccion[],
    claveIdempotencia?: string,
    opciones?: { sinCampana?: boolean },
  ): Promise<ResultadoNotificacionEquipo> {
    // Alerta va SIEMPRE a la campana del panel (respaldo y registro), salvo que quien avisa ya la haya puesto
    if (!opciones?.sinCampana) {
      await this.emitirAvisoCampana(titulo, detalle, enlace);
    }

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

    const destinatarios = await this.obtenerDestinatariosAlertas();
    if (destinatarios.length === 0) {
      return {
        omitido: true,
        motivo: 'SIN_NUMEROS',
        destinatariosTotal: 0,
        enviosExitosos: 0,
        detalles: [],
      };
    }

    const textoCuerpo = `🔔 *[ALERTA CAPRICHOS]*\n\n*${titulo}*\n\n${detalle}\n\n👉 Ver en panel: ${enlace}`;
    const detalles: ResultadoEnvioEquipo[] = [];
    let encolados = 0;

    // Cada destinatario se encola en el outbox: el envío sale del lote (con reintentos) y no bloquea el emisor.
    // Con clave de idempotencia, un mismo evento no crea dos filas por número.
    for (const telefono of destinatarios) {
      const telMask = enmascararTelefono(telefono);
      const telHash = hashTelefono(telefono);
      const clave = claveIdempotencia ? `${claveIdempotencia}:${telHash}` : `alerta:${randomUUID()}`;

      const nuevo = await this.outbox.encolar({
        telefono,
        tipo: 'TEXTO',
        clave,
        origen: 'ALERTA_ADMIN',
        carga: {
          textoLibre: textoCuerpo,
          plantillaClave: 'AVISO_INTERNO',
          variablesPlantilla: [titulo, `${detalle}\n${enlace}`],
          botones: botones && botones.length > 0 ? botones : undefined,
          autor: 'BOT',
          etapa: 'ALERTA_ADMIN',
        },
      });
      if (nuevo) encolados++;
      detalles.push({
        telefonoEnmascarado: telMask,
        exito: true,
        modo: nuevo ? 'ENCOLADO' : 'OMITIDO_IDEMPOTENTE',
      });
    }
    this.outbox.despertar();

    return {
      omitido: false,
      motivo: 'PROCESADO',
      destinatariosTotal: destinatarios.length,
      enviosExitosos: encolados,
      detalles,
    };
  }

  /**
   * Calificación baja de la encuesta posventa: un WhatsApp individual a cada administrador con alertas activas.
   * La API oficial de WhatsApp no envía a grupos, por eso no hay un solo mensaje para todo el equipo.
   * Una sola vez por encuesta (la clave es la encuesta). La campana la pone quien llama: sale con rol CAJERO.
   */
  async avisarCalificacionBaja(datos: DatosAvisoCalificacionBaja): Promise<ResultadoNotificacionEquipo> {
    const titulo = `Calificación baja: ${datos.puntaje}/5 · ${datos.codigo} · ${datos.cliente}`;
    const enlace = datos.telefono ? `/admin/mensajes?telefono=${datos.telefono.slice(-9)}` : '/admin/reclamos';
    const comentario = datos.comentario?.trim()
      ? `Comentario: ${datos.comentario.trim()}`
      : 'Comentario: ninguno todavía; el cliente solo envió la calificación.';
    const detalle =
      `${datos.cliente} calificó con ${datos.puntaje}/5 su pedido ${datos.codigo}. ` +
      `${comentario} Ya se le avisó que una persona le escribirá por el chat. ` +
      'Abre Mensajes y responde desde ahí.';
    return this.enviarAvisoAdmin(
      titulo,
      detalle,
      enlace,
      undefined,
      `calificacion-baja-${datos.encuestaId.toString()}`,
      { sinCampana: true },
    );
  }

  /**
   * Envía mensaje de prueba por WhatsApp con botón interactivo "Sí, soy yo" para confirmar alertas.
   */
  async enviarPruebaAlertas(
    usuarioId: bigint | string,
    telefono: string,
    nombres = 'Administrador',
  ): Promise<ResultadoEnvioWhatsApp> {
    const norm = normalizarCelularPeru(telefono);
    const telE164 = norm.valido && norm.celularE164 ? norm.celularE164 : normalizarTelefono(telefono);
    const textoLibre = `Hola ${nombres}, este es un mensaje de prueba de Caprichos para confirmar la recepción de alertas del sistema. Por favor confirma pulsando el botón:`;
    const botones: BotonAccion[] = [
      {
        id: `alr_conf_${usuarioId}`,
        titulo: 'Sí, soy yo',
      },
    ];

    const ventanaAbierta = await this.ventana24hService.esVentanaAbierta(telE164);
    if (ventanaAbierta) {
      return this.mensajeria.enviarBotones(telE164, textoLibre, botones);
    } else {
      const def = CATALOGO_PLANTILLAS.AVISO_INTERNO;
      return this.mensajeria.enviarPlantilla(
        telE164,
        def.nombre,
        def.idioma,
        ['Prueba de Alertas WhatsApp', `Hola ${nombres}, confirma tu WhatsApp pulsando Sí, soy yo o respondiendo a este chat.`],
      );
    }
  }
}
