export function formatearUnidad(u: string): string {
  if (!u) return '';
  const s = u.trim().toLowerCase();
  if (s === 'l' || s === 'lt' || s === 'litro' || s === 'litros') return 'L';
  if (s === 'kg' || s === 'kilo' || s === 'kilos' || s === 'kilogramo' || s === 'kilogramos') return 'kg';
  if (s === 'g' || s === 'gr' || s === 'gramo' || s === 'gramos') return 'g';
  if (s === 'ml' || s === 'mililitro' || s === 'mililitros') return 'ml';
  if (s === 'paquete' || s === 'paquetes' || s === 'paq') return 'paquetes';
  if (s === 'bolsa' || s === 'bolsas') return 'bolsas';
  if (s === 'unidad' || s === 'unidades') return 'unidades';
  if (s === 'und') return 'und';
  if (s === 'saco' || s === 'sacos') return 'sacos';
  if (s === 'caja' || s === 'cajas') return 'cajas';
  if (s === 'porcion' || s === 'porción' || s === 'porciones') return 'porción';
  if (s === 'filete' || s === 'filetes') return 'filetes';
  return s.toLowerCase();
}

export function qty1(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

export function formatearCantidadUnidad(cant: number | null | undefined, unidad: string): string {
  return `${qty1(cant)} ${formatearUnidad(unidad)}`;
}
