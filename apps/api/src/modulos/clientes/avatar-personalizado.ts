/**
 * ¿El cliente personalizó su avatar? Compara con el avatar de partida del editor (apps/web/src/avatar/config.ts
 * `porDefecto`): si solo abrió el editor y guardó sin cambiar nada, NO cuenta. El apodo, «mostrar al entrar» y
 * «usar como foto» no cuentan (no cambian cómo se ve el avatar). ponytail: si cambia `porDefecto` en la web,
 * actualizar esta tabla (avatar-personalizado.spec.ts fija el contrato).
 */
const BASE = { genero: 'mujer', piel: '#F8D2B0', ojos: '#5B3A29', expresion: 'feliz', colorPelo: '#4A2C1D' } as const;
const PIEZAS: Record<string, string> = {
  cabello: 'bob_cerquillo', arriba: 'polo_basico', abajo: 'jean', calzado: 'zapatilla_urbana',
  cabeza: 'ninguno', cara: 'ninguno', accesorio: 'ninguno', mascota: 'ninguno',
};

const igual = (a: unknown, b: string) => String(a ?? '').toUpperCase() === b.toUpperCase();

export function esAvatarPersonalizado(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const c = config as Record<string, any>;
  if (c.disfraz || c.disfrazId) return true;
  for (const [k, v] of Object.entries(BASE)) if (!igual(c[k] ?? v, v)) return true;
  for (const [k, def] of Object.entries(PIEZAS)) {
    const p = c[k];
    if (!p) continue; // pieza ausente = la de partida
    if (p.id !== def) return true;
    // El color del cabello viaja aparte (colorPelo); en el resto, cualquier color propio cuenta
    const colores = Object.entries(p.colores ?? {}).filter(([slot, val]) => !(k === 'cabello' && slot === 'principal' && igual(val, c.colorPelo ?? BASE.colorPelo)));
    if (colores.length) return true;
  }
  return false;
}
