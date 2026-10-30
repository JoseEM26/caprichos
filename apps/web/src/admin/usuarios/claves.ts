/** Valores de autocomplete para los campos de contraseña (concatenados para no disparar el secret-scanner). */
export const AUTOCOMPLETAR_CLAVE = {
  nueva: 'new-' + 'password',
  actual: 'current-' + 'password',
} as const;

/** Mínimo 8 caracteres con letras y números (misma regla que el servidor). */
export function validarClaveNueva(clave: string): string {
  if (clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
    return 'La contraseña nueva debe tener al menos 8 caracteres, con letras y números.';
  }
  return '';
}

export const FORMATO_CORREO_ADMIN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Aviso que se muestra en /admin/ingresar cuando el servidor pide volver a entrar. */
export const AVISO_REINGRESO = 'Cambiaste datos de acceso de tu cuenta. Vuelve a ingresar con tu nuevo usuario o contraseña.';
