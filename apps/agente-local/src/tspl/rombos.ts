/**
 * Genera la línea separadora continua con 3 rombos en el centro para TSPL.
 * Reproduce el componente SeparadorRombos del frontend con exactitud geométrica.
 *
 * @param y Coordenada Y donde se sitúa el centro del separador
 * @param anchoTotal Ancho total del área en dots (508 dots para 63.5 mm)
 * @param margenX Margen izquierdo y derecho dentro del marco (36 dots)
 */
export function generarSeparadorRombos(
  y: number,
  anchoTotal: number = 508,
  margenX: number = 36
): string {
  const lineas: string[] = [];
  const cx = Math.floor(anchoTotal / 2); // 254

  // Línea izquierda: desde margenX hasta el primer rombo
  const xFinLineaIzq = cx - 48; // 206
  const anchoLineaIzq = xFinLineaIzq - margenX; // 170
  lineas.push(`BAR ${margenX},${y},${anchoLineaIzq},2\r\n`);

  // Línea derecha: desde después del último rombo hasta margenX derecho
  const xIniLineaDer = cx + 48; // 302
  const anchoLineaDer = (anchoTotal - margenX) - xIniLineaDer; // 170
  lineas.push(`BAR ${xIniLineaDer},${y},${anchoLineaDer},2\r\n`);

  // 3 rombos rellenos: izquierdo (cx - 24), centro (cx), derecho (cx + 24)
  const centrosRombos = [cx - 24, cx, cx + 24]; // 230, 254, 278
  const radio = 5; // Altura total de 11 dots (-5 a +5)

  for (const centro of centrosRombos) {
    for (let dy = -radio; dy <= radio; dy++) {
      const semiancho = radio - Math.abs(dy);
      const w = semiancho * 2 + 1;
      const x = centro - semiancho;
      lineas.push(`BAR ${x},${y + dy},${w},1\r\n`);
    }
  }

  return lineas.join('');
}
