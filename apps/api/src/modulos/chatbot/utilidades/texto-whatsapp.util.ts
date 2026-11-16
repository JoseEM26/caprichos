/** WhatsApp no entiende los enlaces Markdown: «[texto](https://x)» pasa a la URL plana (y «[https://x](https://x)» a una sola URL). */
export function aplanarEnlacesMarkdown(texto: string): string {
  return String(texto ?? '').replace(/\[([^\]\n]*)\]\((https?:\/\/[^)\s]+)\)/gi, (_m, etiqueta: string, url: string) => {
    const e = etiqueta.trim();
    return !e || e === url || /^https?:\/\//i.test(e) ? url : `${e}: ${url}`;
  });
}

/** Quita la oración que manda a tocar «Pedir este» (en texto numerado no hay botón) y la cambia por la invitación a elegir un número. */
export function textoSinBotonPedirEste(texto: string): string {
  const original = String(texto ?? '').trim();
  const limpio = original.replace(/[^.\n]*«Pedir este»[^.\n]*\.?/g, '').replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim();
  return limpio === original ? limpio : `${limpio} Elige el número del que quieras pedir 🛍️`.trim();
}
