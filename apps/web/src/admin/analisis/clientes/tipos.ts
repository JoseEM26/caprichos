/** Respuesta de GET /admin/analisis/clientes (solo agregados: sin nombres ni celulares). */
export interface RespuestaClientes {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  truncado: boolean;
  limite: number;
  clientes: { total: number; nuevos: number; recurrentes: number; pctRecurrentes: number | null; pedidosSinIdentificar: number };
  semanas: Array<{ semana: string; nuevos: number; recurrentes: number }>;
  regreso: { n: number; medianaDias: number | null; p90Dias: number | null; tramos: Array<{ nombre: string; n: number }> };
  embudo: {
    pasos: Array<{ id: string; nombre: string; n: number; pctDelAnterior: number | null; pctDeCreados: number | null }>;
    anulados: number;
    noSeGuarda: string[];
  };
  puntos: {
    emitidos: number;
    canjeados: number;
    pctCanjeado: number | null;
    saldoVivo: number;
    cuentasConSaldo: number;
    costoCanjeadoPen: number;
    costoPendientePen: number;
    semanas: Array<{ semana: string; emitidos: number; canjeados: number }>;
  };
  calificaciones: {
    encuestas: {
      enviadas: number;
      respondidas: number;
      pctRespuesta: number | null;
      promedio: number | null;
      semanas: Array<{ semana: string; respuestas: number; promedio: number }>;
      distribucion: Array<{ puntaje: number; n: number }>;
    };
    demora: { conDemora: { n: number; promedio: number | null }; sinDemora: { n: number; promedio: number | null } };
    google: { n: number; promedio: number | null };
  };
}
