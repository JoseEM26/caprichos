/**
 * Interruptor «Pedir como invitado» (parámetro `carta_invitado_activo`, «si»/«no»).
 * Sin parámetro o «no»: NO permitido (quien pide desde la carta debe poner su celular para sumar puntos).
 * Se lee directo del parámetro, igual que controlAlmacenActivo.
 */
export async function invitadoCartaPermitido(db: any): Promise<boolean> {
  try {
    const p = await db?.parametro?.findUnique?.({ where: { clave: 'carta_invitado_activo' } });
    return String(p?.valor ?? '').toLowerCase().trim() === 'si';
  } catch {
    return false;
  }
}
