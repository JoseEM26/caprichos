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
/** Vigencia de la autorización que deja un código válido: el mismo operador no vuelve a pedirlo. */
export const SEGUNDOS_AUTORIZACION = 5 * 60;
const claveAutorizacion = (operador: bigint | string) => `supervisor:autorizacion:${operador}`;
const claveIntentosOperador = (operador: bigint | string) => `pin:supervisor:intentos:${operador}`;
/** Último ADMIN o SUPERVISOR que mostró el código en pantalla: a su nombre queda la autorización que use el código. */
const claveVisorCodigo = (localCodigo: string) => `supervisor:visor:${localCodigo}`;
/** Ventana en la que se atribuye la autorización al último que vio el código (el código cambia cada 30 s). */
export const SEGUNDOS_VISOR = 120;

/** Roles que se autorizan solos: no escriben el código (serían ellos mismos aprobándose) y queda auditado a su nombre. */
const ROLES_SIN_CODIGO = ['ADMIN', 'SUPERVISOR'];

/**
 * Regla única: el ADMIN y el SUPERVISOR activos no necesitan código de supervisor.
 * Audita la acción como AUTORIZACION_SUPERVISOR y devuelve su identidad; null si no es uno de ellos.
 * La usan verificarYConsumirCodigo y los servicios que verifican el PIN por su cuenta.
 */
export async function esOperadorSinCodigo(
  prisma: PrismaService,
  operadorPartyId: bigint | string | undefined,
  /** Solo el ADMIN queda exento (acciones que el SUPERVISOR debe autorizar con su código, p. ej. cortesías). */
  soloAdmin = false,
): Promise<{ party_id: bigint; id: bigint; rol: string } | null> {
  if (operadorPartyId === undefined) return null;
  // ADMIN solo como principal (no se combina); SUPERVISOR como principal o como rol extra
  return prisma.userAccount.findFirst({
    where: {
      party_id: BigInt(operadorPartyId),
      activo: true,
      OR: soloAdmin
        ? [{ rol: 'ADMIN' }]
        : [{ rol: { in: ROLES_SIN_CODIGO } }, { rolesExtra: { some: { rol: 'SUPERVISOR' } } }],
    },
    select: { party_id: true, id: true, rol: true },
  });
}

export async function autorizarAdminSinCodigo(
  prisma: PrismaService,
  auditoria: AuditoriaService,
  operadorPartyId: bigint | string | undefined,
  accion: string,
  ip?: string,
  entidad?: string,
  entidadId?: bigint,
  soloAdmin = false,
): Promise<{ party_id: bigint; id: bigint } | null> {
  const admin = await esOperadorSinCodigo(prisma, operadorPartyId, soloAdmin);
  if (!admin) return null;
  await auditoria.registrar({
    categoria: 'ACCESO',
    modulo: 'supervisor',
    accion: 'AUTORIZACION_SUPERVISOR',
    resultado: 'OK',
    entidad: entidad ?? 'supervisor_codigo',
    entidadId,
    motivo: `Acción ${accion}: autorizado por rol ${admin.rol} (sin código)`,
    partyId: admin.party_id,
    ip,
  });
  return { party_id: admin.party_id, id: admin.id };
}

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
   * Lo ven el ADMIN y el SUPERVISOR (permiso supervisor/ver_codigo); la consulta es auditada.
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

    // Recordar quién lo tiene en pantalla, para atribuir la próxima autorización (sin Redis, queda el respaldo)
    try {
      await this.redisService.obtenerCliente().set(claveVisorCodigo(localCodigo), String(partyIdAdmin), 'EX', SEGUNDOS_VISOR);
    } catch {
      // sin Redis no se puede atribuir por visor; verificarYConsumirCodigo usa el respaldo
    }

    // Auditar que el ADMIN o el SUPERVISOR visualizó el código en pantalla (sin guardar el código)
    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'supervisor',
      accion: 'VER_CODIGO',
      resultado: 'OK',
      entidad: 'supervisor_codigo',
      motivo: `Consulta de código rotativo en pantalla por ${partyIdAdmin} para local ${localCodigo}`,
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
    exigirCodigoSupervisor = false,
  ): Promise<{ party_id: bigint; id: bigint; supervisorPartyId: bigint; supervisorId: bigint }> {
    // 0. El ADMIN nunca da código (sería él mismo aprobándose): queda auditado y no cuenta intentos.
    //    Con exigirCodigoSupervisor, el SUPERVISOR tampoco queda exento y debe presentar su código.
    const admin = await autorizarAdminSinCodigo(
      this.prisma,
      this.auditoria,
      operadorPartyId,
      accion,
      ip,
      entidad,
      entidadId,
      exigirCodigoSupervisor,
    );
    if (admin) {
      return { ...admin, supervisorPartyId: admin.party_id, supervisorId: admin.id };
    }

    const redis = this.redisService.obtenerCliente();
    const claveIntentos = `pin:supervisor:intentos:${operadorPartyId ?? 'general'}`;

    // 1. Bloqueo de 3 intentos fallidos en Redis (fail-closed 503 si Redis cae)
    await exigirPinNoBloqueado(redis, claveIntentos);

    // 1b. Autorización vigente de este operador (un código válido previo, 5 min): no consume otro código
    if (operadorPartyId !== undefined) {
      let vigente: string | null = null;
      try {
        vigente = await redis.get(claveAutorizacion(operadorPartyId));
      } catch {
        throw new HttpException(
          { codigo: 'PIN_NO_DISPONIBLE', mensaje: 'No se puede validar el código ahora, intenta en unos minutos' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (vigente) {
        await this.auditoria.registrar({
          categoria: 'ACCESO',
          modulo: 'supervisor',
          accion: 'AUTORIZACION_SUPERVISOR',
          resultado: 'OK',
          entidad: entidad ?? 'supervisor_codigo',
          entidadId,
          motivo: `Acción ${accion} autorizada con la autorización vigente del código del supervisor`,
          partyId: BigInt(operadorPartyId),
          ip,
        });
        const [pp, ii] = vigente.split(':');
        const sup = BigInt(pp);
        const supId = BigInt(ii ?? pp);
        return { party_id: sup, id: supId, supervisorPartyId: sup, supervisorId: supId };
      }
    }

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

    // Normaliza lo pegado: dígitos de ancho completo -> ASCII; quita espacios, guiones y puntos
    const codigoLimpio =
      typeof codigo === 'string' || typeof codigo === 'number'
        ? String(codigo).normalize('NFKC').replace(/[\s\-._]/g, '')
        : '';
    const formatoValido = /^\d{6}$/.test(codigoLimpio);

    // Quien autoriza es quien mostró el código por última vez (ADMIN o SUPERVISOR). Si nadie lo mostró en la
    // ventana reciente, se usa el respaldo de siempre: un ADMIN activo (queda visible en auditoría).
    const visor = await this.leerVisorCodigo(redis, localCodigo);
    const adminSupervisor = visor
      ? await this.prisma.userAccount.findUnique({
          where: { party_id: visor },
          select: { party_id: true, id: true },
        })
      : await this.prisma.userAccount.findFirst({
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

    // 4. Ventana actual ±1 paso (RFC 6238): tolera relojes adelantados/atrasados o el cambio justo al teclear
    const ahoraSegundos = Math.floor(Date.now() / 1000);
    const pasoActual = Math.floor(ahoraSegundos / 30);
    let desfase: number | null = null;
    for (const d of [0, -1, 1]) {
      if (compararEnTiempoConstante(codigoLimpio, generarTotp(secretoBytes, (pasoActual + d) * 30))) {
        desfase = d;
        break;
      }
    }

    if (desfase === null) {
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
          mensaje: 'Código del supervisor incorrecto. Revísalo y vuelve a escribirlo.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 5. Anti-repetición: comprobar y consumir el código en Redis con TTL de 90 segundos
    const pasoCoincidente = pasoActual + desfase;
    const claveConsumo = `supervisor:codigo:consumido:${localCodigo}:${pasoCoincidente}:${codigoLimpio}`;

    let consumoOk: string | null = null;
    try {
      consumoOk = await redis.set(claveConsumo, String(operadorPartyId ?? ''), 'EX', 90, 'NX');
      // Mismo código reenviado por el mismo operador dentro de su ventana: no es un fallo
      if (consumoOk !== 'OK' && operadorPartyId !== undefined) {
        if ((await redis.get(claveConsumo)) === String(operadorPartyId)) consumoOk = 'OK';
      }
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
          mensaje: 'Ese código ya fue usado por otra persona o acción. Espera a que cambie (hasta 30 s) y escribe el siguiente.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 6. Éxito: limpiar contador de intentos fallidos y dejar la autorización temporal del operador
    await limpiarIntentosPin(redis, claveIntentos);
    if (operadorPartyId !== undefined) {
      try {
        await redis.set(claveAutorizacion(operadorPartyId), `${supervisorPartyId}:${supervisorId}`, 'EX', SEGUNDOS_AUTORIZACION);
      } catch {
        // sin autorización guardada, la próxima acción pedirá código de nuevo
      }
    }

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'supervisor',
      accion: 'AUTORIZACION_SUPERVISOR',
      resultado: 'OK',
      entidad: entidad ?? 'supervisor_codigo',
      entidadId,
      motivo: `Acción ${accion} autorizada exitosamente mediante código rotativo (desfase de reloj: ${desfase > 0 ? '+' : ''}${desfase} paso). Autoriza el supervisor ${supervisorPartyId}`,
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

  /** Party del ADMIN o SUPERVISOR que mostró el código en la ventana reciente; null si no hay o Redis falla. */
  private async leerVisorCodigo(redis: any, localCodigo: string): Promise<bigint | null> {
    try {
      const valor = await redis.get(claveVisorCodigo(localCodigo));
      return valor && /^\d+$/.test(String(valor)) ? BigInt(valor) : null;
    } catch {
      return null;
    }
  }

  /** Operadores bloqueados por intentos fallidos (para que el ADMIN los desbloquee). */
  async listarBloqueados(): Promise<Array<{ partyId: string; nombre: string; segundosRestantes: number }>> {
    const redis = this.redisService.obtenerCliente();
    const [, claves] = await redis.scan('0', 'MATCH', 'pin:supervisor:intentos:*', 'COUNT', 1000);
    const res: Array<{ partyId: string; nombre: string; segundosRestantes: number }> = [];
    for (const c of claves) {
      const n = parseInt((await redis.get(c)) ?? '0', 10);
      if (n < 3) continue;
      const partyId = c.split(':').pop() as string;
      if (!/^\d+$/.test(partyId)) continue;
      const p = await this.prisma.person.findUnique({
        where: { party_id: BigInt(partyId) },
        select: { nombres: true, apellidos: true },
      });
      res.push({
        partyId,
        nombre: p ? `${p.nombres} ${p.apellidos ?? ''}`.trim() : `Usuario ${partyId}`,
        segundosRestantes: Math.max(0, await redis.ttl(c)),
      });
    }
    return res;
  }

  /** El ADMIN borra el contador de fallos de un operador (queda auditado). Lo exige el permiso supervisor/gestionar_codigo. */
  async desbloquearOperador(operadorPartyId: bigint | string, partyIdAdmin: bigint, ip?: string): Promise<{ ok: boolean }> {
    if (!/^\d+$/.test(String(operadorPartyId))) {
      throw new HttpException({ codigo: 'OPERADOR_INVALIDO', mensaje: 'Operador inválido' }, HttpStatus.BAD_REQUEST);
    }
    await this.redisService.obtenerCliente().del(claveIntentosOperador(operadorPartyId));
    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'supervisor',
      accion: 'CODIGO_DESBLOQUEADO',
      resultado: 'OK',
      entidad: 'supervisor_codigo',
      motivo: `El administrador desbloqueó el código del supervisor del operador ${operadorPartyId}`,
      partyId: partyIdAdmin,
      ip,
    });
    return { ok: true };
  }
}
