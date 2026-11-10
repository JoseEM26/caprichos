/**
 * Validación de RUC peruano: 11 dígitos, prefijo 10/15/17/20 y dígito verificador SUNAT (módulo 11).
 * Función pura: se usa ANTES de llamar a la API externa para no gastar cuota con basura.
 */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function rucValido(ruc: unknown): ruc is string {
  if (typeof ruc !== 'string' || !/^(10|15|17|20)\d{9}$/.test(ruc)) return false;
  const suma = PESOS.reduce((acc, p, i) => acc + p * Number(ruc[i]), 0);
  return (11 - (suma % 11)) % 10 === Number(ruc[10]);
}
