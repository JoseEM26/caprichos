import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { normalizarTelefono } from '../chatbot/utilidades/enmascarar.util';
import { PuntosService } from './puntos.service';

export interface EntregaDireccion {
  direccion?: string | null;
  referencia?: string | null;
  lat?: number | null;
  lng?: number | null;
  zonaId?: bigint | null;
}

export interface DireccionClienteDto {
  id: string;
  direccion: string;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  alias: string | null;
  usos: number;
  ultimoUsoEn: string;
  origen: string;
}

/** Búsquedas por teléfono permitidas por usuario y minuto (anti-enumeración). */
const MAX_BUSQUEDAS_TEL_POR_MINUTO = 20;

/** Clave de deduplicación: texto en minúsculas y con espacios simples. */
function claveDireccion(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** ¿El texto es solo coordenadas («-12.01, -76.95», «Punto en el mapa …», «Ubicación compartida: …»)? */
export function textoParecePunto(texto: string | null | undefined): boolean {
  return /^\s*(punto en el mapa|ubicaci[oó]n compartida)?\s*:?\s*-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?\s*$/i.test(texto ?? '');
}

/** Texto legible para una dirección que solo tiene coordenadas. */
export function textoAlternativo(origen: string, zona?: string | null): string {
  if (origen === 'WHATSAPP') return 'Ubicación compartida por WhatsApp';
  return zona ? `Punto marcado en el mapa (zona ${zona})` : 'Punto marcado en el mapa';
}

function aDto(fila: {
  id: bigint;
  direccion: string;
  referencia: string | null;
  lat: Prisma.Decimal | null;
  lng: Prisma.Decimal | null;
  alias: string | null;
  usos: number;
  ultimo_uso_en: Date;
  origen: string;
  zona?: { codigo: string } | null;
}): DireccionClienteDto {
  return {
    id: fila.id.toString(),
    direccion: textoParecePunto(fila.direccion) ? textoAlternativo(fila.origen, fila.zona?.codigo) : fila.direccion,
    referencia: fila.referencia,
    lat: fila.lat != null ? Number(fila.lat) : null,
    lng: fila.lng != null ? Number(fila.lng) : null,
    alias: fila.alias,
    usos: fila.usos,
    ultimoUsoEn: fila.ultimo_uso_en.toISOString(),
    origen: fila.origen,
  };
}

/**
 * Direcciones de delivery de los clientes con cuenta. Nada se borra: desactivar() marca activo = false.
 * Un cliente es "con cuenta" si tiene customer_account activa.
 */
@Injectable()
export class DireccionesClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly puntosService: PuntosService,
    private readonly redisService: RedisService,
  ) {}

  /** Direcciones activas, de la más reciente a la más antigua. */
  async listar(partyId: bigint | string, opciones: { limite?: number } = {}): Promise<DireccionClienteDto[]> {
    const filas = await this.prisma.clienteDireccion.findMany({
      where: { party_id: BigInt(partyId), activo: true },
      orderBy: [{ ultimo_uso_en: 'desc' }, { id: 'desc' }],
      take: opciones.limite ?? 5,
      include: { zona: { select: { codigo: true } } },
    });
    return filas.map(aDto);
  }

  /**
   * Registra el uso de una dirección del pedido. Si ya existe (mismo texto normalizado, o mismo punto
   * redondeado a 5 decimales), suma un uso y actualiza ultimo_uso_en y referencia.
   * Sin texto ni coordenadas no registra nada.
   */
  async registrarUso(
    partyId: bigint | string,
    entrega: EntregaDireccion,
    origen: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DireccionClienteDto | null> {
    const db = tx ?? this.prisma;
    const id = BigInt(partyId);
    const lat = typeof entrega.lat === 'number' && Number.isFinite(entrega.lat) ? entrega.lat : null;
    const lng = typeof entrega.lng === 'number' && Number.isFinite(entrega.lng) ? entrega.lng : null;
    const coordenadas = lat !== null && lng !== null;
    const escrito = entrega.direccion?.trim() || '';
    const sinTexto = !escrito || textoParecePunto(escrito);
    if (sinTexto && !coordenadas) return null;
    const texto = sinTexto ? textoAlternativo(origen) : escrito;

    const referencia = entrega.referencia?.trim() || null;
    const ahora = new Date();
    const candidatas = await db.clienteDireccion.findMany({
      where: { party_id: id, activo: true },
    });
    const existente = candidatas.find(
      (c) =>
        (!sinTexto && claveDireccion(c.direccion) === claveDireccion(texto)) ||
        (coordenadas &&
          c.lat != null &&
          c.lng != null &&
          Number(c.lat).toFixed(5) === lat!.toFixed(5) &&
          Number(c.lng).toFixed(5) === lng!.toFixed(5)),
    );

    if (existente) {
      const actualizada = await db.clienteDireccion.update({
        where: { id: existente.id },
        data: {
          usos: { increment: 1 },
          ultimo_uso_en: ahora,
          referencia: referencia ?? existente.referencia,
        },
      });
      return aDto(actualizada);
    }

    const nueva = await db.clienteDireccion.create({
      data: {
        party_id: id,
        direccion: texto,
        referencia,
        lat: lat,
        lng: lng,
        zona_id: entrega.zonaId ?? null,
        origen,
        usos: 1,
        ultimo_uso_en: ahora,
        activo: true,
      },
    });
    return aDto(nueva);
  }

  /** Desactiva una dirección de la cuenta (solo si es suya y sigue activa). */
  async desactivar(partyId: bigint | string, id: string): Promise<{ ok: true }> {
    const noEncontrada = new NotFoundException({
      codigo: 'DIRECCION_NO_ENCONTRADA',
      mensaje: 'Esa dirección ya no está en tu cuenta.',
    });
    if (!/^\d+$/.test(String(id))) throw noEncontrada;
    const r = await this.prisma.clienteDireccion.updateMany({
      where: { id: BigInt(id), party_id: BigInt(partyId), activo: true },
      data: { activo: false },
    });
    if (r.count === 0) throw noEncontrada;
    return { ok: true };
  }

  /** Nombre y teléfono de la cuenta de cliente activa de ese party, o null si no tiene cuenta activa. */
  async datosCuentaActiva(partyId: bigint): Promise<{ nombre: string; telefono: string | null } | null> {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, cuentaCliente: { is: { activo: true } } },
      select: {
        persona: { select: { nombres: true } },
        contactos: { select: { tipo: true, valor: true } },
      },
    });
    if (!party) return null;
    const telefono =
      party.contactos.find((c) => c.tipo === 'TELEFONO')?.valor ??
      party.contactos.find((c) => c.tipo === 'WHATSAPP')?.valor ??
      null;
    return { nombre: party.persona?.nombres || 'Cliente', telefono };
  }

  /** Party del cliente con cuenta activa cuyo celular es ese teléfono (WhatsApp), o null. */
  async resolverPartyPorTelefono(telefono: string | null | undefined): Promise<bigint | null> {
    const norm = normalizarTelefono(telefono ?? '');
    const nacional = norm.length === 11 && norm.startsWith('51') ? norm.slice(2) : norm;
    if (!/^9\d{8}$/.test(nacional)) return null;
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { telefono: nacional, activo: true }, select: { party_id: true } });
    if (cuenta) return cuenta.party_id;
    const contacto = await this.prisma.contactMechanism.findFirst({
      where: {
        tipo: { in: ['TELEFONO', 'WHATSAPP'] },
        valor: { in: [nacional, `51${nacional}`] },
        activo: true,
        party: { cuentaCliente: { is: { activo: true } } },
      },
      select: { party_id: true },
    });
    return contacto?.party_id ?? null;
  }

  /**
   * Cuenta de cliente (con rol CLIENTE activo) cuyo celular es ese teléfono, con solo lo que puede decir el bot:
   * primer nombre y últimos 3 dígitos del número. Sin DNI ni nombre completo.
   */
  async cuentaPorTelefono(telefono: string | null | undefined): Promise<{ partyId: bigint; primerNombre: string; terminacion: string } | null> {
    const partyId = await this.resolverPartyPorTelefono(telefono);
    if (!partyId) return null;
    const rol = await this.prisma.partyRole.findFirst({ where: { party_id: partyId, rol: 'CLIENTE', hasta: null }, select: { id: true } });
    if (!rol) return null;
    const datos = await this.datosCuentaActiva(partyId);
    if (!datos) return null;
    const dig = normalizarTelefono(telefono ?? '').replace(/\D/g, '');
    return { partyId, primerNombre: datos.nombre.trim().split(/\s+/)[0] || 'Cliente', terminacion: dig.slice(-3) };
  }

  /**
   * Búsqueda de cliente por celular exacto (9 dígitos) para el mozo (GET /admin/clientes/por-telefono/:telefono).
   * Sin datos sensibles: nombre, teléfono, puntos y direcciones.
   */
  async buscarPorTelefono(celular: string, usuarioPartyId?: string | number | bigint): Promise<
    | { encontrado: false }
    | {
        encontrado: true;
        party: string;
        nombre: string;
        telefono: string | null;
        puntos: number;
        direcciones: DireccionClienteDto[];
      }
  > {
    await this.limitarBusqueda(usuarioPartyId);
    const partyId = await this.resolverPartyPorTelefono(celular);
    if (!partyId) return { encontrado: false };

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      select: {
        persona: { select: { nombres: true } },
        contactos: { select: { tipo: true, valor: true } },
      },
    });
    const telefono =
      party?.contactos.find((c) => c.tipo === 'TELEFONO')?.valor ??
      party?.contactos.find((c) => c.tipo === 'WHATSAPP')?.valor ??
      null;

    return {
      encontrado: true,
      party: partyId.toString(),
      nombre: party?.persona?.nombres || 'Cliente',
      telefono,
      puntos: await this.puntosService.obtenerSaldo(partyId),
      direcciones: await this.listar(partyId),
    };
  }

  /** Ventana fija de 1 minuto por usuario. Si Redis no responde, no bloquea. */
  private async limitarBusqueda(usuarioPartyId?: string | number | bigint): Promise<void> {
    try {
      const redis = this.redisService.obtenerCliente();
      const clave = `busqueda-tel:${usuarioPartyId ?? 'anon'}`;
      const n = await redis.incr(clave);
      if (n === 1) await redis.expire(clave, 60);
      if (n > MAX_BUSQUEDAS_TEL_POR_MINUTO) {
        throw new HttpException(
          { codigo: 'DEMASIADAS_BUSQUEDAS', mensaje: 'Espera un minuto antes de buscar otro celular.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
    }
  }
}
