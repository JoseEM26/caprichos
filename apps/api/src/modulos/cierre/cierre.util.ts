export const DENOMINACIONES: number[] = [
  200, 100, 50, 20, 10,
  5, 2, 1, 0.5, 0.2, 0.1,
];

/**
 * Calcula la suma total en efectivo a partir del conteo por denominación.
 * Maneja claves numéricas y en texto (e.g. '0.5', '0.50', 0.5).
 */
export function calcularTotalConteo(conteo: Record<string, number> | undefined | null): number {
  if (!conteo || typeof conteo !== 'object') {
    return 0;
  }

  let total = 0;
  for (const denom of DENOMINACIONES) {
    const k1 = denom.toString();
    const k2 = denom === 0.5 ? '0.50' : denom === 0.2 ? '0.20' : denom === 0.1 ? '0.10' : k1;
    const cant = Number(
      (conteo as any)[k1] ?? (conteo as any)[k2] ?? (conteo as any)[denom] ?? 0,
    );
    if (!isNaN(cant) && cant > 0) {
      total += cant * denom;
    }
  }

  return Math.round(total * 100) / 100;
}
