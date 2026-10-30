/**
 * Palabras de la escala de la encuesta posventa y el puntaje que les corresponde.
 * Las opciones que se ofrecen en la lista son «1 Malo», «3 Regular» y «5 Excelente»; «bueno» y «muy bueno» son el 4.
 */
const PALABRAS_ESCALA = new Map<string, number>([
  ['malo', 1],
  ['regular', 3],
  ['bueno', 4],
  ['muy bueno', 4],
  ['excelente', 5],
]);

const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Lee una calificación explícita de la encuesta posventa: el id del botón «encuesta:N», un dígito 1-5 solo,
 * «N Palabra» (con la palabra de la escala que corresponde a ese mismo N) o la palabra de la escala sola.
 * Cualquier otro texto (un número de pedido, un teléfono, «tengo 1 pregunta») devuelve null.
 */
export function interpretarPuntajeEncuesta(entrada: string | null | undefined): number | null {
  if (!entrada) return null;
  const texto = sinAcentos(entrada.trim().toLowerCase()).replace(/\s+/g, ' ');

  const boton = /^encuesta:([1-5])$/.exec(texto);
  if (boton) return Number(boton[1]);

  if (/^[1-5]$/.test(texto)) return Number(texto);

  const conNumero = /^([1-5]) ([a-z ]+)$/.exec(texto);
  if (conNumero) {
    const puntaje = PALABRAS_ESCALA.get(conNumero[2]);
    return puntaje === Number(conNumero[1]) ? puntaje : null;
  }

  return PALABRAS_ESCALA.get(texto) ?? null;
}
