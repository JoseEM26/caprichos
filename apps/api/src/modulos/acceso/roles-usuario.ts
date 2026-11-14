import { PrismaService } from '../../comun/prisma/prisma.service';

/** Roles que no se combinan con ningún otro (ADMIN por control total; REPARTIDOR por aislamiento). */
export const ROLES_SIN_COMBINAR = ['ADMIN', 'REPARTIDOR'] as const;

/** Tipos de documento del personal (party_identifier.tipo). DNI = 8 dígitos; el resto, 7 a 12 alfanuméricos. */
export const TIPOS_DOCUMENTO = ['DNI', 'CE', 'CEDULA', 'PASAPORTE'] as const;

export function documentoValido(tipo: string, numero: string): boolean {
  if (tipo === 'DNI') return /^\d{8}$/.test(numero);
  return /^[A-Za-z0-9]{7,12}$/.test(numero);
}

/** Mensaje si la combinación de roles no es válida; null si lo es. */
export function errorCombinacionRoles(principal: string, extras: string[]): string | null {
  const todos = [principal, ...extras];
  if (new Set(todos).size !== todos.length) return 'Un rol no puede repetirse';
  if (todos.length > 1) {
    const exclusivo = ROLES_SIN_COMBINAR.find((r) => todos.includes(r));
    if (exclusivo) return `El rol ${exclusivo} no se combina con otros roles`;
  }
  return null;
}

/** Un rol extra vale si no tiene fecha de vencimiento o si todavía no llega. */
export function vigenciaRolExtra(ahora: Date = new Date()) {
  return [{ vence_en: null }, { vence_en: { gt: ahora } }];
}

/** Roles de la cuenta: principal primero, luego los extra vigentes (un rol vencido no cuenta). */
export async function rolesDeCuenta(prisma: PrismaService, userAccountId: bigint, rolPrincipal: string): Promise<string[]> {
  const extras = await prisma.userAccountRol.findMany({
    where: { user_account_id: userAccountId, OR: vigenciaRolExtra() },
    select: { rol: true },
    orderBy: { rol: 'asc' },
  });
  return [rolPrincipal, ...extras.map((e) => e.rol).filter((r) => r !== rolPrincipal)];
}

/** Pertenencia: el usuario tiene el rol como principal o como extra. Sin lista de roles, cuenta solo el principal. */
export function tieneRol(usuario: { rol: string; roles?: string[] }, rol: string): boolean {
  return (usuario.roles ?? [usuario.rol]).includes(rol);
}

/** Unión de permisos (modulo/accion) de varios roles. */
export async function permisosDeRoles(prisma: PrismaService, roles: string[]): Promise<string[]> {
  const filas = await prisma.rolPermiso.findMany({
    where: { rol: { in: roles } },
    include: { permiso: true },
  });
  return [...new Set(filas.map((f) => `${f.permiso.modulo}/${f.permiso.accion}`))].sort();
}

/** Permisos extra vigentes de la cuenta (modulo/accion): los vencidos no cuentan. */
export async function permisosExtraVigentes(prisma: PrismaService, userAccountId: bigint): Promise<string[]> {
  const filas = await prisma.userAccountPermiso.findMany({
    where: { user_account_id: userAccountId, OR: vigenciaRolExtra() },
    select: { modulo: true, accion: true },
  });
  return filas.map((f) => `${f.modulo}/${f.accion}`);
}

/** Permisos efectivos de una cuenta = unión(permisos de sus roles) ∪ permisos extra vigentes. Única fuente de `usuario.permisos`. */
export async function permisosDeCuenta(prisma: PrismaService, userAccountId: bigint, roles: string[]): Promise<string[]> {
  const [deRoles, extras] = await Promise.all([permisosDeRoles(prisma, roles), permisosExtraVigentes(prisma, userAccountId)]);
  return [...new Set([...deRoles, ...extras])].sort();
}

/** Roles de alcance amplio: si la cuenta tiene uno, manda sobre la restricción de «solo mis pedidos» del mozo. */
export const ROLES_ALCANCE_AMPLIO = ['ADMIN', 'CAJERO', 'SUPERVISOR'] as const;

/** Mozo que solo es mozo: tiene MOZO y ningún rol de alcance amplio. El rol más amplio manda. */
export function esSoloMozo(usuario: { rol: string; roles?: string[] }): boolean {
  const roles = usuario.roles ?? [usuario.rol];
  return roles.includes('MOZO') && !roles.some((r) => (ROLES_ALCANCE_AMPLIO as readonly string[]).includes(r));
}

/** Volver atrás un pedido entregado (reabrir) sigue siendo solo de CAJERO y ADMIN; con varios roles basta uno. */
export function puedeVolverAtrasPedidos(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => r === 'ADMIN' || r === 'CAJERO');
}

/** Revertir una anulación y asignar/cerrar un reparto por el repartidor: solo ADMIN y SUPERVISOR (con varios roles basta uno). */
export function esAdminOSupervisor(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => r === 'ADMIN' || r === 'SUPERVISOR');
}

/** Roles que anulan cualquier pedido que ven (el REPARTIDOR queda acotado a los suyos antes, en el servicio). */
const ROLES_ANULAN_CUALQUIER_PEDIDO = ['ADMIN', 'CAJERO', 'SUPERVISOR', 'MOZO', 'COCINA', 'APOYO_DELIVERY', 'REPARTIDOR'];

/**
 * Alcance de anular un pedido completo: todos los roles con acceso a pedidos, incluido el MOZO (decisión del dueño el
 * 09/11: el mozo anula cualquier pedido, no solo los suyos); ALMACEN y cuentas sin rol operativo no anulan.
 */
export function puedeAnularPedido(
  usuario: { rol: string; roles?: string[]; partyId?: bigint | string | number } | undefined,
  pedido: { party_id?: bigint | string | number | null },
): boolean {
  const roles = rolesDelUsuario(usuario);
  if (roles.some((r) => ROLES_ANULAN_CUALQUIER_PEDIDO.includes(r))) return true;
  if (usuario && esSoloMozo(usuario)) {
    return pedido.party_id != null && usuario.partyId != null && BigInt(pedido.party_id) === BigInt(usuario.partyId);
  }
  return false;
}

/** Rol con el que se aplican las reglas por rol: MOZO si es solo mozo; si no, el de alcance amplio que tenga (o el principal). */
export function rolEfectivoMozo(usuario: { rol: string; roles?: string[] }): string {
  if (esSoloMozo(usuario)) return 'MOZO';
  const roles = usuario.roles ?? [usuario.rol];
  return roles.find((r) => (ROLES_ALCANCE_AMPLIO as readonly string[]).includes(r)) ?? usuario.rol;
}

/** Roles del usuario (principal y extra). */
export function rolesDelUsuario(usuario: { rol: string; roles?: string[] } | undefined): string[] {
  return usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
}

/**
 * Áreas de cocina que ve un usuario en las pantallas de cocina. null = todas (sin restricción).
 * Solo afecta a quien tiene rol COCINA: sin áreas marcadas ve todas (como hoy); con áreas marcadas, la unión.
 * El resto de roles no se restringe. Única función de esta regla: cocina y comandas la usan.
 */
export async function areasPermitidasDeUsuario(
  prisma: PrismaService,
  usuario: { partyId?: bigint; rol: string; roles?: string[] } | undefined,
): Promise<bigint[] | null> {
  if (!rolesDelUsuario(usuario).includes('COCINA') || usuario?.partyId === undefined) return null;
  const cuenta = await prisma.userAccount.findUnique({
    where: { party_id: usuario.partyId },
    select: { id: true, areasCocina: { select: { area_id: true } } },
  });
  const areas = (cuenta?.areasCocina ?? []).map((a) => a.area_id);
  return areas.length > 0 ? [...new Set(areas)] : null;
}
