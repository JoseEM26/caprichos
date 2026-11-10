import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';

/**
 * Cuadro «qué módulos ve cada usuario»: roles (principal + extra vigentes) y permisos efectivos por cuenta.
 * Misma regla que permisosDeCuenta (unión de rol_permiso de sus roles + permisos extra vigentes), pero en lote:
 * una consulta por tabla y se agrupa en memoria. Solo lectura, sin datos sensibles (sin documentos ni teléfonos).
 * user_account es solo personal: los clientes no tienen cuenta aquí.
 */
@Injectable()
export class UsuariosAccesosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(incluirInactivos = false, ahora: Date = new Date()) {
    const vigente = [{ vence_en: null }, { vence_en: { gt: ahora } }];
    const [cuentas, rolPermisos] = await Promise.all([
      this.prisma.userAccount.findMany({
        where: incluirInactivos ? {} : { activo: true },
        select: {
          id: true,
          rol: true,
          activo: true,
          party: { select: { persona: { select: { nombres: true, apellidos: true } } } },
          rolesExtra: { where: { OR: vigente }, select: { rol: true, vence_en: true } },
          permisosExtra: { where: { OR: vigente }, select: { modulo: true, accion: true, vence_en: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.rolPermiso.findMany({ select: { rol: true, permiso: { select: { modulo: true, accion: true } } } }),
    ]);
    const porRol = new Map<string, Set<string>>();
    for (const f of rolPermisos) {
      const s = porRol.get(f.rol) ?? new Set<string>();
      s.add(`${f.permiso.modulo}/${f.permiso.accion}`);
      porRol.set(f.rol, s);
    }
    const usuarios = cuentas.map((c) => {
      const roles = [
        { rol: c.rol, vence_en: null as Date | null },
        ...c.rolesExtra.filter((r) => r.rol !== c.rol).map((r) => ({ rol: r.rol, vence_en: r.vence_en })),
      ];
      const todos = roles.some((r) => r.rol === 'ADMIN'); // control total: no se recorren permisos
      const deRoles = new Set<string>();
      for (const r of roles) for (const p of porRol.get(r.rol) ?? []) deRoles.add(p);
      const propios = c.permisosExtra.map((p) => ({ permiso: `${p.modulo}/${p.accion}`, vence_en: p.vence_en }));
      return {
        id: c.id.toString(),
        nombre: `${c.party.persona?.nombres ?? ''} ${c.party.persona?.apellidos ?? ''}`.trim(),
        activo: c.activo,
        todos,
        roles,
        permisos: todos ? [] : [...new Set([...deRoles, ...propios.map((p) => p.permiso)])].sort(),
        // permisos que vienen SOLO de un permiso extra propio (excepciones respecto de sus roles)
        permisosExtra: todos ? [] : propios.filter((p) => !deRoles.has(p.permiso)),
      };
    });
    return { usuarios };
  }
}
