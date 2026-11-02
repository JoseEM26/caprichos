import { ETIQUETAS_ROLES, ROLES_ASIGNABLES, ROLES_EXCLUSIVOS } from './roles';

export interface SelectorOtrosRolesProps {
  /** Rol principal: no aparece entre los otros. */
  principal: string;
  valor: string[];
  alCambiar: (roles: string[]) => void;
  error?: string;
  deshabilitado?: boolean;
}

/** Casillas de roles extra. ADMIN y REPARTIDOR no se combinan: al marcar uno, los demás quedan apagados. */
export function SelectorOtrosRoles({ principal, valor, alCambiar, error, deshabilitado = false }: SelectorOtrosRolesProps) {
  const principalExclusivo = ROLES_EXCLUSIVOS.includes(principal);
  const hayExclusivoMarcado = valor.some((v) => ROLES_EXCLUSIVOS.includes(v));

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <legend style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)', padding: 0 }}>Otros roles (opcional)</legend>
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        Si la persona también hace otro puesto. Administrador y Repartidor no se combinan con otros.
      </div>
      {ROLES_ASIGNABLES.filter((rol) => rol !== principal).map((rol) => {
        const marcado = valor.includes(rol);
        const bloqueado =
          deshabilitado ||
          principalExclusivo ||
          (!marcado && (ROLES_EXCLUSIVOS.includes(rol) ? valor.length > 0 : hayExclusivoMarcado));
        return (
          <label
            key={rol}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)' }}
          >
            <input
              type="checkbox"
              checked={marcado}
              disabled={bloqueado}
              onChange={(e) => alCambiar(e.target.checked ? [...valor, rol] : valor.filter((r) => r !== rol))}
            />
            {ETIQUETAS_ROLES[rol] || rol}
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
