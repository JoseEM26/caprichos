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

export type NivelUso = 'ok' | 'atencion' | 'critico';
interface UsoTope {
  max: number;
  fecha: string | null;
  tope: number;
  pct: number | null;
  nivel: NivelUso;
}

/** Respuesta de GET /admin/analisis/whatsapp/salud (solo agregados; sin celulares). */
export interface RespuestaSalud {
  generadoEn: string;
  rango: { desde: string; hasta: string; dias: number };
  proveedor: 'META' | 'EVOLUTION';
  topes: { minuto: number; hora: number; dia: number };
  uso: { dia: UsoTope; hora: UsoTope; minuto: UsoTope };
  porDia: Array<{ fecha: string; enviados: number; pct: number | null; nivel: NivelUso }>;
  porHoraDelDia: Array<{ hora: number; total: number; pico: number; pctPico: number | null; nivel: NivelUso }>;
  cola: {
    enviados: number;
    fallidos: number;
    descartados: number;
    pendientes: number;
    pctFallidos: number | null;
    motivosDescartados: Array<{ codigo: string; n: number }>;
    motivosFallidos: Array<{ codigo: string; n: number }>;
  };
  proporcion: {
    totalEnviados: number;
    respuestas: number;
    pedidosPorElCliente: number;
    alEquipo: number;
    iniciados: number;
    pctIniciados: number | null;
    entrantes: number;
    salientesPorEntrante: number | null;
    sinContactoPrevio: { numeros: number; mensajes: number; numerosRevisados: number; truncado: boolean };
    porOrigen: Array<{ origen: string; n: number }>;
  };
  bot: {
    total: number;
    cerrado: number;
    bienvenida: number;
    encuesta: number;
    avisoPedido: number;
    ia: number;
    menu: number;
    turnosPorConversacion: { conversaciones: number; promedio: number | null; maximo: number };
    derivadasAPersona: number;
    iaDerivo: number;
    iaErrores: number;
  };
  conexion: {
    pausasAutomaticas: number;
    pausasManuales: number;
    desconexiones: number;
    reconexiones: number;
    reanudaciones: number;
    ultimos: Array<{ accion: string; en: string; motivo: string | null }>;
  };
  encuestas: { enviadas: number; respondidas: number; tasaRespuesta: number | null; promedio: number | null };
  recomendaciones: Array<{ nivel: 'alta' | 'media' | 'info'; texto: string }>;
}

export interface RespuestaSinRespuesta {
  generadoEn: string;
  total: number;
  hayMas: boolean;
  limite: number;
  items: Array<{ id: string; celular: string; minutos: number; motivo: string; enlace: string }>;
}
