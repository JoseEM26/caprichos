import { ETIQUETAS_ROLES, ROLES_ASIGNABLES, ROLES_EXCLUSIVOS } from './roles';

export interface SelectorOtrosRolesProps {
  /** Rol principal: aparece marcado y bloqueado. */
  principal: string;
  valor: string[];
  alCambiar: (roles: string[]) => void;
  error?: string;
  deshabilitado?: boolean;
  /** Por qué todo está bloqueado (p. ej. no es administrador). */
  motivoDeshabilitado?: string;
}

const nota = { fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 400 } as const;

/** Casillas de roles extra. ADMIN y REPARTIDOR no se combinan: al marcar uno, los demás quedan apagados y se dice por qué. */
export function SelectorOtrosRoles({ principal, valor, alCambiar, error, deshabilitado = false, motivoDeshabilitado }: SelectorOtrosRolesProps) {
  const principalExclusivo = ROLES_EXCLUSIVOS.includes(principal);
  const exclusivoMarcado = valor.find((v) => ROLES_EXCLUSIVOS.includes(v));

  /** Razón por la que un rol no se puede marcar; null si se puede. */
  const razon = (rol: string, marcado: boolean): string | null => {
    if (deshabilitado) return motivoDeshabilitado ?? null;
    if (marcado) return null;
    if (principalExclusivo) return `No se combina con ${ETIQUETAS_ROLES[principal]?.split(' (')[0] ?? principal}`;
    if (exclusivoMarcado) return `No se combina con ${ETIQUETAS_ROLES[exclusivoMarcado]?.split(' (')[0] ?? exclusivoMarcado}`;
    if (ROLES_EXCLUSIVOS.includes(rol) && valor.length > 0) return `${ETIQUETAS_ROLES[rol]?.split(' (')[0] ?? rol} no se combina con otros roles`;
    return null;
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <legend style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)', padding: 0 }}>Otros roles (opcional)</legend>
      <div style={nota}>
        Si la persona también hace otro puesto. Administrador y Repartidor no se combinan con otros.
      </div>
      <div style={nota} role="note">
        ¿Solo necesita entrar a UN módulo (Créditos, Mensajes, Reportes…)? No le des un rol completo: usa «Permisos por módulo (extra)» más abajo.
      </div>
      {ROLES_ASIGNABLES.map((rol) => {
        const esPrincipal = rol === principal;
        const marcado = esPrincipal || valor.includes(rol);
        const porque = esPrincipal ? 'Es su rol principal' : razon(rol, marcado);
        const bloqueado = esPrincipal || deshabilitado || porque !== null;
        return (
          <label
            key={rol}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)', opacity: bloqueado ? 0.75 : 1 }}
          >
            <input
              type="checkbox"
              checked={marcado}
              disabled={bloqueado}
              onChange={(e) => alCambiar(e.target.checked ? [...valor, rol] : valor.filter((r) => r !== rol))}
            />
            <span>
              {ETIQUETAS_ROLES[rol] || rol}
              {porque && <small style={nota}> · {porque}</small>}
            </span>
          </label>
        );
      })}
      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>
          {error}
        </div>
      )}
    </fieldset>
  );
}
