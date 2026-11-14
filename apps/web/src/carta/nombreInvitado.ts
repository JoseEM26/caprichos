// Nombre del cliente invitado: se pide al primer vaso y se recuerda en la sesión del navegador (llega al checkout)
const CLAVE = 'caprichos.nombreInvitado';
export const leerNombreInvitado = (): string => {
  try { return window.sessionStorage.getItem(CLAVE) ?? ''; } catch { return ''; }
};
export const guardarNombreInvitado = (n: string) => {
  try { window.sessionStorage.setItem(CLAVE, n.trim()); } catch { /* sin almacenamiento: queda solo en memoria */ }
};
