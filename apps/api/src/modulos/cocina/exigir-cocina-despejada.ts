import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { tieneRol } from '../acceso/roles-usuario';

/** Largo del motivo con el que el administrador fuerza el cambio sin esperar a Cocina. */
export const MOTIVO_FORZAR_MIN = 10;
export const MOTIVO_FORZAR_MAX = 300;

export interface AreaPendiente {
  areaId: bigint;
  nombre: string;
}

/** Áreas con comanda sin despejar (EN_COCINA) de un pedido: una sola consulta, con el nombre del área. */
export async function areasPendientesDeCocina(prisma: PrismaService, pedidoId: bigint): Promise<AreaPendiente[]> {
  const filas = await prisma.comandaArea.findMany({
    where: { pedido_id: pedidoId, estado: 'EN_COCINA' },
    select: { area_id: true, area: { select: { nombre: true } } },
    orderBy: { area_id: 'asc' },
  });
  return filas.map((f) => ({ areaId: f.area_id, nombre: f.area.nombre }));
}

function listaEnEspanol(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Regla única: un pedido no pasa a LISTO ni a ENTREGADO a mano mientras Cocina tenga comandas sin despejar.
 * Sin pendientes (o sin comandas) no hace nada y devuelve []. Con pendientes:
 *  - sin `forzar`: 409 COCINA_PENDIENTE con `mensaje` claro y `areasPendientes`;
 *  - con `forzar`: solo el ADMIN (403 si no), con motivo de MOTIVO_FORZAR_MIN a MOTIVO_FORZAR_MAX (400 si no),
 *    y devuelve las áreas pendientes para que quien llama las despeje y deje auditoría.
 * La autorización va aquí, en el servidor: la pantalla solo muestra el botón.
 */
export async function exigirCocinaDespejada(
  prisma: PrismaService,
  pedidoId: bigint,
  usuario: { rol: string; roles?: string[] },
  opciones: { forzar?: boolean; motivo?: string } = {},
): Promise<AreaPendiente[]> {
  const pendientes = await areasPendientesDeCocina(prisma, pedidoId);
  if (pendientes.length === 0) return [];

  const nombres = pendientes.map((p) => p.nombre);
  const esAdmin = tieneRol(usuario, 'ADMIN');

  if (!opciones.forzar) {
    const faltan = nombres.length === 1 ? `falta ${nombres[0]}` : `faltan ${listaEnEspanol(nombres)}`;
    throw new ConflictException({
      codigo: 'COCINA_PENDIENTE',
      mensaje:
        `Cocina aún no marcó como listo este pedido: ${faltan}. Pídele a Cocina que pulse “Listo”.` +
        (esAdmin ? ' Como administrador puedes forzarlo indicando un motivo.' : ''),
      areasPendientes: nombres,
      puedeForzar: esAdmin,
    });
  }

  if (!esAdmin) {
    throw new ForbiddenException({
      codigo: 'FORZAR_SOLO_ADMIN',
      mensaje: 'Solo el administrador puede saltarse a Cocina. Pídele a Cocina que pulse “Listo”.',
    });
  }
  const motivo = (opciones.motivo ?? '').trim();
  if (motivo.length < MOTIVO_FORZAR_MIN || motivo.length > MOTIVO_FORZAR_MAX) {
    throw new BadRequestException({
      codigo: 'MOTIVO_REQUERIDO',
      mensaje: `Escribe el motivo (entre ${MOTIVO_FORZAR_MIN} y ${MOTIVO_FORZAR_MAX} caracteres) para forzar el cambio sin Cocina.`,
    });
  }
  return pendientes;
}
