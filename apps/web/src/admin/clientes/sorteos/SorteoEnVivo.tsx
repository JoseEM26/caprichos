// Marcador: otro agente construye la pantalla real del sorteo y este archivo se sobrescribe al unir las ramas.
// El contrato (nombres y tipos) no cambia.
export interface ParticipanteSorteo {
  id: string;
  nombre: string;
  detalle: string;
}

export function SorteoEnVivo(_props: { participantes: ParticipanteSorteo[]; filtrosTexto: string; alCerrar: () => void }) {
  return null;
}
