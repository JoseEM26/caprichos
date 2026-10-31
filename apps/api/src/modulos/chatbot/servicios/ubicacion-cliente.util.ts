/** Ubicación que el cliente comparte por WhatsApp, tal como queda en mensaje_chat.contenido.ubicacion. */
export type UbicacionCliente = {
  lat: number;
  lng: number;
  nombre?: string;
  direccion?: string;
  direccionAprox?: string;
};

/** Coordenadas válidas: números finitos dentro de rango (lat -90..90, lng -180..180). */
export function ubicacionValida(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
