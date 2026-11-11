import { useSesion } from '../../comun/sesion';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { EscritorioAdminView } from './EscritorioAdminView';
import { EscritorioPersonalView } from './EscritorioPersonalView';

/** El ADMIN ve el escritorio con ventas y gráficos; todo el demás personal, el suyo sin dinero (el servidor tampoco lo manda). */
export function EscritorioView() {
  const { usuario } = useSesion();
  return tieneRolUsuario(usuario, 'ADMIN') ? <EscritorioAdminView /> : <EscritorioPersonalView />;
}
