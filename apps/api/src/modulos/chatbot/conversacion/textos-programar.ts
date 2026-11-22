import { BotonAccion } from './tipos-conversacion';

/**
 * Textos del bot cuando el local está cerrado y «Pedidos programados fuera de horario» está encendido:
 * solo se atiende para programar un pedido para llevar o delivery dentro del horario de atención.
 */

/** Filas que se muestran por página (WhatsApp admite 10 por lista: 8 + «Ver más»). */
export const FILAS_PROGRAMAR_POR_PAGINA = 8;

export const BOTON_PROGRAMAR_PEDIDO: BotonAccion = { id: 'pedir', titulo: 'Programar pedido' };
export const BOTON_VER_HORARIO: BotonAccion = { id: 'btn_horario', titulo: 'Ver horario' };
export const BOTON_PERSONA_CERRADO: BotonAccion = { id: 'persona', titulo: 'Hablar con persona' };
export const BOTONES_PEDIDO_CAMINO_PAGO: BotonAccion[] = [
  { id: 'ped_camino_pagado', titulo: 'Pagar ahora' },
  { id: 'ped_camino_recibir', titulo: 'Pagar al recibir' },
];

/** «lunes 3 de noviembre» (día de calendario de Lima). */
export function etiquetaDia(fechaIso: string): string {
  return diaLargo(new Date(`${fechaIso}T12:00:00.000-05:00`));
}

// Intl en es-PE escribe «lunes, 1 de marzo»: sin la coma suena más natural en un mensaje
const diaLargo = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(',', '');

/** «lunes 3 de noviembre a las 10:30» desde el instante ISO pactado. */
export function etiquetaDiaHora(iso: string): string {
  const d = new Date(iso);
  const dia = diaLargo(d);
  const hora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const tituloFilaDia = (fechaIso: string): string => cap(etiquetaDia(fechaIso)).slice(0, 24);

export const TEXTOS_PROGRAMAR = {
  /** Primer mensaje fuera de horario: explica que no se atiende para ahora y ofrece programar. `apertura`: «hoy a las 14:00». */
  bienvenida: (nombre?: string | null, apertura?: string | null): string =>
    `¡Hola${nombre ? ` ${nombre}` : ''}! 💛 Estamos fuera de horario${apertura ? ` (abrimos ${apertura})` : ''}, no podemos atender pedidos para ahora. Puedes dejar tu pedido programado para cuando estemos abiertos 👇`,

  /** Si vuelve a escribir sin pedir nada: corto, sin repetir el aviso completo. */
  recordatorio: (apertura?: string | null): string =>
    `Seguimos fuera de horario${apertura ? ` (abrimos ${apertura})` : ''} 🙏 Si quieres, te programo tu pedido para cuando estemos abiertos.`,

  /** «hoy a las 14:00» / «mañana a las 10:00» / «el lunes 3 de noviembre a las 10:00». */
  apertura: (fechaIso: string, hoyIso: string, hora: string): string => {
    const manana = new Date(`${hoyIso}T12:00:00.000-05:00`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const dia = fechaIso === hoyIso ? 'hoy' : fechaIso === manana.toISOString().slice(0, 10) ? 'mañana' : `el ${etiquetaDia(fechaIso)}`;
    return `${dia} a las ${hora}`;
  },

  /** Pidió una persona con el local cerrado. `apertura`: «hoy a las 14:00». */
  personaCuandoAbramos: (apertura: string): string => `Te escribiremos cuando abramos ${apertura} 💛`,

  sinHorarios: (): string =>
    'Por ahora no tengo horarios disponibles para programar. Escríbenos cuando abramos y con gusto te atendemos. 💛',

  preguntaDia: (): string => '📅 ¿Para qué día quieres tu pedido?',
  preguntaHora: (fechaIso: string): string => `⏰ ¿A qué hora el ${etiquetaDia(fechaIso)}? Solo ofrezco horas dentro de nuestro horario.`,
  diaNoValido: (): string => 'No encontré ese día. Elige uno de la lista, por favor. 🙏',
  horaNoValida: (): string => 'No encontré esa hora. Elige una de la lista, por favor. 🙏',
  programadoOk: (iso: string): string => `Listo, tu pedido será para el ${etiquetaDiaHora(iso)}. 😊 Ahora armemos tu pedido.`,

  preguntaCaminoPago: (): string =>
    '💳 ¿Cómo prefieres pagar?\n• *Pagar ahora* con Yape o Plin: nos envías tu voucher (captura) y lo dejas pagado.\n• *Pagar al recibir*: pagas cuando lo recojas o llegue (queda pendiente de pago).',
  sinMediosDigitales: (): string => 'Por ahora no tengo Yape, Plin ni transferencia disponibles, así que pagarás al recibir. 🙏',

  /** Línea del resumen final de un pedido programado. */
  lineaResumen: (iso: string): string => `📅 Programado para el ${etiquetaDiaHora(iso)}`,

  confirmacion: (codigo: string, iso: string, esPagoDigital: boolean, datosPago?: string): string =>
    `¡Listo! Tu pedido ${codigo} quedó programado para el ${etiquetaDiaHora(iso)}. 🎉 Te avisaremos por WhatsApp.` +
    (esPagoDigital
      ? `\n\n📸 Para dejarlo pagado, mándanos por aquí la captura de tu Yape, Plin o transferencia. Una persona del equipo la revisa cuando abramos.${datosPago ? `\n\n${datosPago}` : ''}`
      : '\n\nPagas al recibir. 💛'),

  noSePudoProgramar: (mensaje?: string): string =>
    `${mensaje ?? 'No pude programar ese día y hora'} 🙏 Tu pedido no se envió. Escríbenos «pedir» y lo programamos de nuevo.`,
};
