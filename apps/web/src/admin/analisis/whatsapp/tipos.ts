export interface ResumenEspera {
  n: number;
  promedio: number | null;
  mediana: number | null;
  p90: number | null;
  maximo: number | null;
}

/** Respuesta de GET /admin/analisis/whatsapp. `respuesta.personas` solo viene para el ADMIN (null para el supervisor). */
export interface RespuestaWhatsapp {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  respuesta: {
    truncado: boolean;
    limite: number;
    rachas: number;
    atendidasPorPersona: number;
    atendidasPorBot: number;
    sinRespuesta: number;
    equipo: ResumenEspera;
    porHora: Array<ResumenEspera & { hora: number }>;
    personas: Array<ResumenEspera & { id: string; nombre: string }> | null;
  };
  bot: { chats: number; soloBot: number; conPersona: number; sinRespuesta: number; pctSoloBot: number | null; pctConPersona: number | null; pctSinRespuesta: number | null };
  derivaciones: { total: number; motivos: Array<{ motivo: string; n: number; chats: number }> };
  volumen: Array<{ hora: number; cliente: number; bot: number; persona: number }>;
  salientes: { total: number; tipos: Array<{ tipo: string; n: number }>; plantillas: Array<{ plantilla: string; n: number }> };
  consumoMes: { mes: string; total: number; gratisMes: number; porcentaje: number; proyeccionFinDeMes: number; costoEstimadoPen: number };
}

export interface RespuestaSinRespuesta {
  generadoEn: string;
  total: number;
  hayMas: boolean;
  limite: number;
  items: Array<{ id: string; celular: string; minutos: number; motivo: string; enlace: string }>;
}
