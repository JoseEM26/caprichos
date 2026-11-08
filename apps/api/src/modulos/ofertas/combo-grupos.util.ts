// Sin dependencias: lo usan el pedido y el bot sin arrastrar el catálogo.

/**
 * Grupo de opciones del producto anfitrión que repite el rol de la parte de bebidas («Bebida 1 · Sabor», «Bebida 1 · Bebida»,
 * «Bebida 2»). Las demás preguntas («Bebida 1 · Leche», tamaño, nota) no entran. No se borran: solo se ocultan.
 */
export function esGrupoBebidaDuplicado(nombre: string): boolean {
  const n = nombre.trim();
  if (!/^bebida/i.test(n)) return false;
  const corto = n.includes(' · ') ? n.split(' · ').slice(1).join(' · ').trim() : '';
  return corto === '' || /^(sabor|bebida)/i.test(corto);
}
