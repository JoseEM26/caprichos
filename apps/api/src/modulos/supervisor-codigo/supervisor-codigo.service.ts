import {
  Injectable,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  exigirPinNoBloqueado,
  limpiarIntentosPin,
  registrarFalloPin,
} from '../../comun/redis/intentos-pin';
import {
  calcularSegundosRestantes,
  cifrarSecreto,
  compararEnTiempoConstante,
  derivarClaveCifrado,
  descifrarSecreto,
  generarTotp,
} from './totp.util';

export const LOCAL_CODIGO_DEFECTO = 'CAPRICHOS';

@Injectable()
export class SupervisorCodigoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Verifica si el local ya tiene un secreto TOTP configurado en la base de datos.
   */
  async tieneSecretoConfigurado(localCodigo = LOCAL_CODIGO_DEFECTO): Promise<boolean> {
    const reg = await this.prisma.supervisorSecreto.findUnique({
      where: { local_codigo: localCodigo },
      select: { id: true },
    });
    return !!reg;
  }

  /**
   * Genera un nuevo secreto criptográfico de 20 bytes para el local, lo cifra con AES-256-GCM
   * y lo persiste en la base de datos. Solo administradores pueden ejecutarlo.
   */
  async generarSecreto(
    partyIdAdmin: bigint,
    ip?: string,
    localCodigo = LOCAL_CODIGO_DEFECTO,
  ): Promise<{ ok: boolean; mensaje: string }> {
    const claveDerivada = derivarClaveCifrado();
    const secretoBytes = crypto.randomBytes(20);
    const { secretoCifrado, iv, tag } = cifrarSecreto(secretoBytes, claveDerivada);

    await this.prisma.supervisorSecreto.upsert({
      where: { local_codigo: localCodigo },
      update: {
        secreto_cifrado: secretoCifrado,
        iv,
        tag,
        creado_por: partyIdAdmin,
        actualizado_en: new Date(),
      },
      create: {
        local_codigo: localCodigo,
        secreto_cifrado: secretoCifrado,
        iv,
        tag,
        creado_por: partyIdAdmin,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'supervisor',
      accion: 'GENERAR_SECRETO',
      resultado: 'OK',
      entidad: 'supervisor_secreto',
      motivo: `Generación inicial de secreto criptográfico TOTP para local ${localCodigo}`,
      partyId: partyIdAdmin,
      ip,
    });

    return {
      ok: true,
      mensaje: 'Secreto de supervisor generado exitosamente.',
    };
  }

  /**
   * Rota el secreto del supervisor: genera nuevos 20 bytes aleatorios, los cifra y actualiza la fila,
   * invalidando inmediatamente cualquier código generado con el secreto anterior.
   */
  async rotarSecreto(
    partyIdAdmin: bigint,
    ip?: string,
    localCodigo = LOCAL_CODIGO_DEFECTO,
  ): Promise<{ ok: boolean; mensaje: string }> {
    const claveDerivada = derivarClaveCifrado();
    const nuevoSecretoBytes = crypto.randomBytes(20);
    const { secretoCifrado, iv, tag } = cifrarSecreto(nuevoSecretoBytes, claveDerivada);

    await this.prisma.supervisorSecreto.upsert({
      where: { local_codigo: localCodigo },
      update: {
        secreto_cifrado: secretoCifrado,
        iv,
        tag,
        creado_por: partyIdAdmin,
        actualizado_en: new Date(),
      },
      create: {
        local_codigo: localCodigo,
        secreto_cifrado: secretoCifrado,
        iv,
        tag,
        creado_por: partyIdAdmin,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'supervisor',
      accion: 'ROTAR_SECRETO',
      resultado: 'OK',
      entidad: 'supervisor_secreto',
      motivo: `Rotación de secreto criptográfico TOTP para local ${localCodigo}`,
      partyId: partyIdAdmin,
      ip,
    });

    return {
      ok: true,
      mensaje: 'Secreto de supervisor rotado exitosamente. El anterior quedó invalidado.',
    };
  }

  /**
   * Obtiene el código TOTP vigente calculado por el servidor y los segundos restantes de la ventana.
   * Solo el rol ADMIN tiene acceso y la consulta es auditada.
   */
  async obtenerCodigoActual(
    partyIdAdmin: bigint,
    ip?: string,
    localCodigo = LOCAL_CODIGO_DEFECTO,
  ): Promise<{ codigo: string; segundosRestantes: number }> {
    const registro = await this.prisma.supervisorSecreto.findUnique({
      where: { local_codigo: localCodigo },
    });

    if (!registro) {
      throw new HttpException(
        {
          codigo: 'SUPERVISOR_SIN_CONFIGURAR',
          mensaje: 'El supervisor aún no ha configurado el código rotativo. Solicítelo a un administrador.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const claveDerivada = derivarClaveCifrado();
    const secretoBytes = descifrarSecreto(
      registro.secreto_cifrado,
      registro.iv,
      registro.tag,
      claveDerivada,
    );

    const ahoraSegundos = Math.floor(Date.now() / 1000);
    const codigo = generarTotp(secretoBytes, ahoraSegundos);
    const segundosRestantes = calcularSegundosRestantes(ahoraSegundos);

    // Auditar que el administrador visualizó el código en pantalla (sin guardar el código)
    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'supervisor',
      accion: 'VER_CODIGO',
      resultado: 'OK',
      entidad: 'supervisor_codigo',
      motivo: `Consulta de código rotativo en pantalla por administrador para local ${localCodigo}`,
      partyId: partyIdAdmin,
      ip,
    });

    return {
      codigo,
      segundosRestantes,
    };
  }

  /**
   * Valida y consume un código de supervisor:
   * 1. Verifica bloqueo de fuerza bruta en Redis (3 intentos fallidos = 5 minutos).
   * 2. Si no hay secreto configurado -> 409 SUPERVISOR_SIN_CONFIGURAR.
   * 3. Acepta ventana actual e inmediata anterior (tolerancia de reloj/tipeo).
   * 4. Comparación en tiempo constante (crypto.timingSafeEqual).
   * 5. Anti-repetición: el código aceptado se consume en Redis con SET NX (TTL 90s).
   * 6. Audita cada intento válido e inválido (sin almacenar el código).
   */
  async verificarYConsumirCodigo(
    codigo: string | undefined,
    operadorPartyId: bigint | string | undefined,
    accion: string,
    ip?: string,
    entidad?: string,
    entidadId?: bigint,
    localCodigo = LOCAL_CODIGO_DEFECTO,
  ): Promise<{ party_id: bigint; id: bigint; supervisorPartyId: bigint; supervisorId: bigint }> {
    const redis = this.redisService.obtenerCliente();
    const claveIntentos = `pin:supervisor:intentos:${operadorPartyId ?? 'general'}`;

    // 1. Bloqueo de 3 intentos fallidos en Redis (fail-closed 503 si Redis cae)
    await exigirPinNoBloqueado(redis, claveIntentos);

    // 2. Verificar existencia del secreto en BD
    const registro = await this.prisma.supervisorSecreto.findUnique({
      where: { local_codigo: localCodigo },
    });

    if (!registro) {
      throw new HttpException(
        {
          codigo: 'SUPERVISOR_SIN_CONFIGURAR',
          mensaje: 'El supervisor aún no ha configurado el código rotativo. Solicítelo a un administrador.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const codigoLimpio = typeof codigo === 'string' ? codigo.trim() : '';
    const formatoValido = /^\d{6}$/.test(codigoLimpio);

    // Obtener un supervisor admin para auditoría e historial
    const adminSupervisor = await this.prisma.userAccount.findFirst({
      where: { rol: 'ADMIN', activo: true },
      select: { party_id: true, id: true },
    });
    const supervisorPartyId = adminSupervisor?.party_id ?? BigInt(1);
    const supervisorId = adminSupervisor?.id ?? BigInt(1);

    const partyIdOperadorNum =
      operadorPartyId !== undefined ? BigInt(operadorPartyId) : undefined;

    if (!formatoValido) {
      await registrarFalloPin(redis, claveIntentos);

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'supervisor',
        accion: 'CODIGO_FALLIDO',
        resultado: 'RECHAZADO',
        entidad: entidad ?? 'supervisor_codigo',
        entidadId,
        motivo: `Intento de acción ${accion} con formato de código inválido o no proporcionado`,
        partyId: partyIdOperadorNum,
        ip,
      });

      throw new HttpException(
        {
          codigo: 'CODIGO_INVALIDO',
          mensaje: 'Código del supervisor incorrecto o no proporcionado (debe ser de 6 dígitos).',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 3. Descifrar el secreto
    const claveDerivada = derivarClaveCifrado();
    const secretoBytes = descifrarSecreto(
      registro.secreto_cifrado,
      registro.iv,
      registro.tag,
      claveDerivada,
    );

    // 4. Calcular códigos de la ventana actual e inmediata anterior
    const ahoraSegundos = Math.floor(Date.now() / 1000);
    const pasoActual = Math.floor(ahoraSegundos / 30);
    const pasoAnterior = pasoActual - 1;

    const codigoActual = generarTotp(secretoBytes, ahoraSegundos);
    const codigoAnterior = generarTotp(secretoBytes, pasoAnterior * 30);

    const coincideActual = compararEnTiempoConstante(codigoLimpio, codigoActual);
    const coincideAnterior = compararEnTiempoConstante(codigoLimpio, codigoAnterior);

    if (!coincideActual && !coincideAnterior) {
      await registrarFalloPin(redis, claveIntentos);

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'supervisor',
        accion: 'CODIGO_FALLIDO',
        resultado: 'RECHAZADO',
        entidad: entidad ?? 'supervisor_codigo',
        entidadId,
        motivo: `Intento de acción ${accion} con código de supervisor incorrecto`,
        partyId: partyIdOperadorNum,
        ip,
      });

      throw new HttpException(
        {
          codigo: 'CODIGO_INVALIDO',
          mensaje: 'Código del supervisor incorrecto.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 5. Anti-repetición: comprobar y consumir el código en Redis con TTL de 90 segundos
    const pasoCoincidente = coincideActual ? pasoActual : pasoAnterior;
    const claveConsumo = `supervisor:codigo:consumido:${localCodigo}:${pasoCoincidente}:${codigoLimpio}`;

    let consumoOk: string | null = null;
    try {
      consumoOk = await redis.set(claveConsumo, '1', 'EX', 90, 'NX');
    } catch {
      throw new HttpException(
        {
          codigo: 'PIN_NO_DISPONIBLE',
          mensaje: 'No se puede validar el código ahora, intenta en unos minutos',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (consumoOk !== 'OK') {
      await registrarFalloPin(redis, claveIntentos);

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'supervisor',
        accion: 'CODIGO_FALLIDO',
        resultado: 'RECHAZADO',
        entidad: entidad ?? 'supervisor_codigo',
        entidadId,
        motivo: `Intento de reutilización de código de supervisor ya consumido para acción ${accion}`,
        partyId: partyIdOperadorNum,
        ip,
      });

      throw new HttpException(
        {
          codigo: 'CODIGO_INVALIDO',
          mensaje: 'El código del supervisor ya fue utilizado. Solicita el código de la siguiente ventana.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 6. Éxito: limpiar contador de intentos fallidos
    await limpiarIntentosPin(redis, claveIntentos);

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'supervisor',
      accion: 'AUTORIZACION_SUPERVISOR',
      resultado: 'OK',
      entidad: entidad ?? 'supervisor_codigo',
      entidadId,
      motivo: `Acción ${accion} autorizada exitosamente mediante código rotativo`,
      partyId: partyIdOperadorNum,
      ip,
    });

    return {
      party_id: supervisorPartyId,
      id: supervisorId,
      supervisorPartyId,
      supervisorId,
    };
  }
}
