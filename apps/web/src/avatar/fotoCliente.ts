/**
 * Foto que se muestra del cliente (cabecera de la carta, panel de la cuenta…). Una sola regla, igual que la de la API
 * (`fotoMostrada`): si eligió usar su avatar → el retrato; si no eligió pero no tiene foto → el retrato por defecto;
 * si tiene foto y no eligió el avatar → su foto. Sin ninguna de las dos → null (iniciales o icono).
 */
export interface FotosCliente {
  fotoUrl: string | null;
  avatarUrl?: string | null;
  avatarComoFoto?: boolean;
}

export function fotoDelCliente(c: FotosCliente | null | undefined): { url: string; esAvatar: boolean } | null {
  if (!c) return null;
  if (c.avatarUrl && (c.avatarComoFoto || !c.fotoUrl)) return { url: c.avatarUrl, esAvatar: true };
  return c.fotoUrl ? { url: c.fotoUrl, esAvatar: false } : null;
}
