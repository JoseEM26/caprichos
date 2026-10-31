import { BotonAccion, FilaLista } from './tipos-conversacion';

export const BOTONES_RESERVA_PERSONAS: BotonAccion[] = [
  { id: 'res_p_1_2', titulo: '1 a 2' },
  { id: 'res_p_3_4', titulo: '3 a 4' },
  { id: 'res_p_5_6', titulo: '5 a 6' },
];

export const BOTONES_RESERVA_FECHA: BotonAccion[] = [
  { id: 'res_f_hoy', titulo: 'Hoy' },
  { id: 'res_f_manana', titulo: 'Mañana' },
  { id: 'res_f_otra', titulo: 'Otra fecha' },
];

export const BOTONES_RESERVA_NOMBRE_CONFIRMAR: BotonAccion[] = [
  { id: 'res_nom_si', titulo: 'Sí, es correcto' },
  { id: 'res_nom_no', titulo: 'Escribir otro' },
];

export const BOTONES_RESERVA_NOTA: BotonAccion[] = [
  { id: 'res_nota_sin', titulo: 'Sin nota' },
];

export const BOTONES_RESERVA_CONFIRMAR_FINAL: BotonAccion[] = [
  { id: 'res_conf_si', titulo: 'Confirmar solicitud' },
  { id: 'res_conf_cambiar', titulo: 'Cambiar algo' },
];

export const BOTONES_RESERVA_CANCELAR_CONFIRMAR: BotonAccion[] = [
  { id: 'res_canc_si', titulo: 'Sí, cancelar' },
  { id: 'res_canc_no', titulo: 'No, mantener' },
];

export const BOTON_VOLVER_MENU_RESERVA: BotonAccion = {
  id: 'menu',
  titulo: 'Volver al menú',
};

export const BOTON_HABLAR_PERSONA_RESERVA: BotonAccion = {
  id: 'persona',
  titulo: 'Hablar con persona',
};

export const BOTONES_RESERVA_ACCIONES_EXISTENTE: BotonAccion[] = [
  { id: 'res_act_cancelar', titulo: 'Cancelar reserva' },
  { id: 'res_act_cambiar', titulo: 'Cambiar reserva' },
  BOTON_VOLVER_MENU_RESERVA,
];

export const BOTON_LISTA_HORAS = 'Ver horas';
export const TITULO_SECCION_HORAS = 'Horarios disponibles';

export const TEXTOS_RESERVA = {
  pedirPersonas: () =>
    '¿Para cuántas personas es la reserva?\n\nElige una opción o si son 7 o más, escribe la cantidad (máximo 20 personas por WhatsApp):',

  personasExcesivas: () =>
    'Para grupos de más de 20 personas, la reserva se coordina directamente con nuestro equipo para acondicionar las mesas. Te comunico con un asesor.',

  limiteSolicitudesExcedido: () =>
    'Ya tienes 3 solicitudes de reserva pendientes de revisión. Por favor espera a que nuestro equipo las confirme o comunícate con un asesor.',

  pedirFecha: () =>
    '¿Para qué fecha deseas tu reserva?',

  pedirFechaOtra: () =>
    'Por favor escribe la fecha para tu reserva (ejemplo: 28/10 o 2026-10-28):',

  fechaPasada: () =>
    'La fecha indicada ya pasó. Por favor escribe hoy, mañana o una fecha futura válida:',

  fechaFormatoInvalido: () =>
    'No pude reconocer esa fecha. Por favor escribe una fecha válida en formato día/mes (ejemplo: 28/10 o 2026-10-28):',

  localCerradoFecha: (fechaTexto: string, motivo?: string) =>
    `Nuestro local se encuentra cerrado el ${fechaTexto}${motivo ? ` (${motivo})` : ''}. Por favor escribe otra fecha:`,

  anticipacionExcedida: (diasMax: number) =>
    `Las reservas se toman con un máximo de ${diasMax} días de anticipación. Por favor elige una fecha más cercana:`,

  pedirHoraPrompt: (horaAbre: string) =>
    `¿A qué hora quieres venir? Atendemos reservas desde las ${horaAbre}.`,

  sinDisponibilidadFecha: (personas: number, fechaTexto: string) =>
    `No encontramos mesas disponibles para ${personas} personas el ${fechaTexto}. Puedes elegir otra fecha o escribirle a nuestro equipo.`,

  horaInvalida: () =>
    'Por favor selecciona una hora válida de la lista de horarios disponibles.',

  confirmarNombre: (nombre: string) =>
    `¿Confirmas tu nombre para la reserva: *${nombre}*?`,

  pedirNombre: () =>
    'Por favor escribe el nombre completo de la persona para la reserva:',

  pedirTelefono: () =>
    'Por favor escribe tu número de celular (9 dígitos) para coordinar tu reserva:',

  telefonoInvalido: () =>
    'El número debe tener 9 dígitos y empezar con 9 (ejemplo: 987654321). Por favor escríbelo nuevamente:',

  preguntarNota: () =>
    '¿Deseas agregar alguna indicación o nota especial para tu reserva? (ejemplo: cumpleaños 🎂, silla de bebé 👶, etc.)',

  resumenSolicitud: (datos: {
    personas: number;
    fechaTexto: string;
    hora: string;
    nombre: string;
    telefono: string;
    nota?: string;
  }) => {
    const notaTexto = datos.nota && datos.nota.trim() ? `\n• *Nota:* ${datos.nota.trim()}` : '';
    return (
      `📋 *Resumen de tu solicitud de reserva:*\n\n` +
      `• *Personas:* ${datos.personas}\n` +
      `• *Fecha:* ${datos.fechaTexto}\n` +
      `• *Hora:* ${datos.hora}\n` +
      `• *Nombre:* ${datos.nombre}\n` +
      `• *Teléfono:* ${datos.telefono}${notaTexto}\n\n` +
      `¿Deseas enviar esta solicitud a nuestro equipo?`
    );
  },

  solicitudEnviadaExito: (datos: {
    personas: number;
    fechaTexto: string;
    hora: string;
    toleranciaMin: number;
  }) =>
    `Recibí tu solicitud de reserva para ${datos.personas} personas el ${datos.fechaTexto} a las ${datos.hora}. Todavía no está confirmada: una persona del equipo la revisa y te responde por aquí. Si se confirma, guardamos la mesa ${datos.toleranciaMin} minutos de tolerancia.`,

  reservaConfirmadaCliente: (datos: {
    personas: number;
    fechaTexto: string;
    hora: string;
    toleranciaMin: number;
  }) =>
    `Tu reserva para ${datos.personas} personas el ${datos.fechaTexto} a las ${datos.hora} está confirmada. Te esperamos con ${datos.toleranciaMin} minutos de tolerancia.`,

  reservaRechazadaCliente: (datos: {
    nombre: string;
    fechaTexto: string;
    hora: string;
    motivo: string;
    alternativas?: string;
  }) => {
    const alt = datos.alternativas ? ` Horarios disponibles alternativos: ${datos.alternativas}.` : '';
    return `Hola ${datos.nombre}, no pudimos confirmar tu solicitud de reserva para el ${datos.fechaTexto} a las ${datos.hora}. Motivo: ${datos.motivo}.${alt}`;
  },

  recordatorioReservaCliente: (datos: {
    nombre: string;
    personas: number;
    hora: string;
    toleranciaMin: number;
  }) =>
    `Hola ${datos.nombre}, te recordamos tu reserva para ${datos.personas} personas hoy a las ${datos.hora}. Te esperamos con ${datos.toleranciaMin} minutos de tolerancia.`,

  toleranciaVencidaCliente: (datos: {
    nombre: string;
    hora: string;
  }) =>
    `Hola ${datos.nombre}, el tiempo de tolerancia para tu reserva de las ${datos.hora} ha vencido y la mesa ha sido liberada. Si tienes algún inconveniente, puedes escribirnos por aquí.`,

  listarReservasFuturas: (reservas: Array<{ id: string; fecha: string; hora: string; personas: number }>) => {
    const filas = reservas
      .map(
        (r, i) =>
          `*${i + 1}.* Reserva #${r.id}: ${r.fecha} a las ${r.hora} (${r.personas} personas)`,
      )
      .join('\n');
    return `📅 *Tus reservas activas:*\n\n${filas}\n\n¿Qué deseas hacer con tu reserva?`;
  },

  sinReservasActivas: () =>
    'No encuentro reservas activas registradas con tu número de teléfono.',

  confirmarCancelar: (datos: { fecha: string; hora: string; personas: number }) =>
    `¿Estás seguro de que deseas cancelar tu reserva del ${datos.fecha} a las ${datos.hora} para ${datos.personas} personas?`,

  cancelacionExitosa: () =>
    'Tu reserva ha sido cancelada. Si necesitas reservar en otro momento, aquí estamos.',

  pedirDetalleCambio: (datos: { fecha: string; hora: string }) =>
    `Por favor escribe qué cambio necesitas para tu reserva del ${datos.fecha} a las ${datos.hora} (ejemplo: cambiar la hora, más personas, o cambiar de fecha):`,

  cambioRegistradoExito: () =>
    'Anotado tu pedido de cambio. Una persona de nuestro equipo te responderá por este chat para coordinar el nuevo horario o fecha.',
};
