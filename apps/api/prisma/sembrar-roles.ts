import { PrismaClient } from '@prisma/client';
import { ROLES, PERMISOS, MATRIZ } from '../src/modulos/acceso/permisos';

/** Roles, permisos y matriz rol-permiso. Idempotente: lo usan seed.ts y crear-admin-demo.ts. */
export async function sembrarRolesYPermisos(prisma: PrismaClient): Promise<void> {
  for (const rol of ROLES) {
    await prisma.rol.upsert({
      where: { codigo: rol.codigo },
      update: { nombre: rol.nombre },
      create: { codigo: rol.codigo, nombre: rol.nombre },
    });
  }

  // Permisos
  const mapaPermisos = new Map<string, bigint>();
  for (const perm of PERMISOS) {
    const p = await prisma.permiso.upsert({
      where: {
        modulo_accion: {
          modulo: perm.modulo,
          accion: perm.accion,
        },
      },
      update: {},
      create: {
        modulo: perm.modulo,
        accion: perm.accion,
      },
    });
    mapaPermisos.set(`${perm.modulo}/${perm.accion}`, p.id);
  }

  // Matriz rol-permiso
  for (const [rolCodigo, listaPermisos] of Object.entries(MATRIZ)) {
    for (const permClave of listaPermisos) {
      const permisoId = mapaPermisos.get(permClave);
      if (!permisoId) continue;
      await prisma.rolPermiso.upsert({
        where: {
          rol_permiso_id: {
            rol: rolCodigo,
            permiso_id: permisoId,
          },
        },
        update: {},
        create: {
          rol: rolCodigo,
          permiso_id: permisoId,
        },
      });
    }
  }
}
