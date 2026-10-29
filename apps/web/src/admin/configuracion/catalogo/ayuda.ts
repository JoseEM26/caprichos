import type { EntradaConfig } from './tipos';

// Pestaña «Ayuda» (asistente Capri). Verificado contra apps/api/src/modulos/ayuda-admin y chatbot/ia.
const S = 'Asistente de ayuda con IA';

export const AYUDA: EntradaConfig[] = [
  { id: 'ayuda-capri-interruptor', tab: 'ayuda', seccion: S, titulo: 'Activar el asistente Capri con IA', descripcion: 'Con IA encendida, Capri responde las dudas del personal usando los manuales del sistema y un modelo de OpenAI (consume tokens). Apagada, responde solo con los manuales, sin costo de IA. Capri solo explica: nunca anula pedidos ni registra cobros.', ejemplo: 'Un mozo nuevo pregunta «¿cómo cobro una mesa?» y Capri le explica los pasos.', clave: 'ayuda_ia_activo', palabras: ['capri', 'asistente', 'ia', 'ayuda', 'inteligencia artificial', 'chat de ayuda', 'manuales', 'openai', 'tokens'], permiso: 'ADMIN', peligro: 'medio' },
  { id: 'ayuda-capri-consumo', tab: 'ayuda', seccion: S, titulo: 'Consumo mensual de IA frente al tope', descripcion: 'Consultas, tokens y costo estimado de IA del mes frente al tope mensual en dólares. Con el tope alcanzado Capri responde solo con los manuales, sin IA; el tope se cambia en Parámetros (chatbot_ia_tope_mensual_usd).', ejemplo: '31 200 tokens y $4.12 de $20.00 es el 20 % del tope.', clave: 'chatbot_ia_tope_mensual_usd', palabras: ['consumo', 'tokens', 'presupuesto', 'gasto', 'tope mensual', 'costo'], peligro: 'bajo' },
];
