import {
  EntradaNormalizada,
  FlujoConversacion,
  ContextoConversacion,
  ResultadoTransicion,
  AccionMensaje,
  BotonAccion,
  FilaLista,
} from '../../tipos-conversacion';
import { SubFlujoConversacion, RegistroSubFlujos } from '../registro-flujos';
import {
  EstadoReservaFlujo,
  EstadoFlujoReserva,
  DatosReservaBot,
} from './tipos-reserva';
import {
  BOTONES_RESERVA_PERSONAS,
  BOTONES_RESERVA_FECHA,
  BOTONES_RESERVA_NOMBRE_CONFIRMAR,
  BOTONES_RESERVA_NOTA,
  BOTONES_RESERVA_CONFIRMAR_FINAL,
  BOTONES_RESERVA_CANCELAR_CONFIRMAR,
  BOTON_VOLVER_MENU_RESERVA,
  BOTON_HABLAR_PERSONA_RESERVA,
  BOTONES_RESERVA_ACCIONES_EXISTENTE,
  BOTON_LISTA_HORAS,
  TITULO_SECCION_HORAS,
  TEXTOS_RESERVA,
} from '../../textos-reserva';

const PALABRAS_RESERVA = [
  'reservar',
  'reservar mesa',
  'reserva',
  'reservacion',
  'mesa',
  'separar mesa',
  'hacer reserva',
];

const PALABRAS_CANCELAR_RESERVA = [
  'cancelar reserva',
  'cancelar mi reserva',
  'cancela mi reserva',
  'anular reserva',
  'ya no voy',
  'no voy a ir',
];

const PALABRAS_CAMBIAR_RESERVA = [
  'cambiar reserva',
  'cambiar mi reserva',
  'modificar reserva',
  'cambio de reserva',
  'mover reserva',
  'cambiar hora reserva',
  'cambiar fecha reserva',
];

/**
 * Normaliza y obtiene la fecha actual en zona horaria America/Lima (YYYY-MM-DD)
 */
export function obtenerFechaLimaActual(offsetDias = 0): { fechaIso: string; fechaTexto: string } {
  const d = new Date();
  if (offsetDias !== 0) {
    d.setDate(d.getDate() + offsetDias);
  }
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  let texto = iso;
  if (offsetDias === 0) texto = 'Hoy';
  else if (offsetDias === 1) texto = 'Mañana';

  return { fechaIso: iso, fechaTexto: texto };
}

/**
 * Parsea una fecha escrita por el usuario (ej: "28/10", "28-10", "2026-10-28")
 */
export function parsearFechaUsuario(texto: string): { fechaIso: string; fechaTexto: string } | null {
  const limpio = texto.trim();
  // Formato YYYY-MM-DD
  const mIso = limpio.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mIso) {
    const y = parseInt(mIso[1], 10);
    const m = parseInt(mIso[2], 10);
    const d = parseInt(mIso[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { fechaIso: iso, fechaTexto: iso };
    }
  }

  // Formato DD/MM o DD-MM o DD/MM/YYYY
  const mSlash = limpio.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (mSlash) {
    const d = parseInt(mSlash[1], 10);
    const m = parseInt(mSlash[2], 10);
    const y = mSlash[3] ? parseInt(mSlash[3], 10) : new Date().getFullYear();
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { fechaIso: iso, fechaTexto: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
    }
  }

  return null;
}

/**
 * Normaliza una hora escrita por el usuario a formato HH:mm
 */
export function parsearHoraUsuario(texto: string): string | null {
  const limpio = texto.toLowerCase().trim();
  // Formato 15:30 o 3:30pm o 1500
  const m1 = limpio.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (m1) {
    let h = parseInt(m1[1], 10);
    const min = parseInt(m1[2], 10);
    const meridiano = m1[3];
    if (meridiano === 'pm' && h < 12) h += 12;
    if (meridiano === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24 && (min === 0 || min === 30)) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  // Formato simple 8pm o 15h
  const m2 = limpio.match(/^(\d{1,2})\s*(am|pm)$/);
  if (m2) {
    let h = parseInt(m2[1], 10);
    if (m2[2] === 'pm' && h < 12) h += 12;
    if (m2[2] === 'am' && h === 12) h = 0;
    if (h >= 0 && h < 24) {
      return `${String(h).padStart(2, '0')}:00`;
    }
  }

  return null;
}

/**
 * Genera franjas de hora por defecto (pasos de 30 min desde 1 hora después de abrir hasta 1 hora antes de cerrar)
 */
export function generarFranjasPorDefecto(abre = '14:00', cierra = '23:00'): string[] {
  const [hAbre, mAbre] = abre.split(':').map((x) => parseInt(x, 10));
  const [hCierra, mCierra] = cierra.split(':').map((x) => parseInt(x, 10));

  let tInicio = (hAbre * 60 + (mAbre || 0)) + 60; // 1 hora después de abrir
  let tFin = (hCierra * 60 + (mCierra || 0)) - 60; // 1 hora antes de cerrar

  if (tFin <= tInicio) {
    tFin += 1440;
  }

  const franjas: string[] = [];
  for (let t = tInicio; t <= tFin; t += 30) {
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    franjas.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return franjas.length ? franjas : ['15:00', '15:30', '16:00', '16:30', '17:00'];
}

export class FlujoReservaSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'reserva';

  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    _contexto: ContextoConversacion,
  ): boolean {
    const estadoStr = String(flujo.estado || '');
    if (estadoStr === 'RESERVA' || estadoStr.startsWith('RESERVA_')) {
      return true;
    }

    if (flujo.reserva && flujo.reserva.estadoInterno) {
      return true;
    }

    // Botones directos de reserva
    if (
      entrada.id?.startsWith('res_') ||
      entrada.id === 'reservar' ||
      entrada.id === 'btn_reserva'
    ) {
      return true;
    }

    // Comandos de cancelar o cambiar reserva
    if (
      entrada.texto &&
      (PALABRAS_CANCELAR_RESERVA.some((p) => entrada.texto.includes(p)) ||
        PALABRAS_CAMBIAR_RESERVA.some((p) => entrada.texto.includes(p)))
    ) {
      return true;
    }

    // Intención de iniciar reserva por texto
    if (
      entrada.texto &&
      PALABRAS_RESERVA.some((p) => entrada.texto.includes(p)) &&
      !entrada.texto.includes('carta') &&
      !entrada.texto.includes('pedido')
    ) {
      return true;
    }

    return false;
  }

  transicionar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const estadoActual: EstadoReservaFlujo =
      flujo.reserva?.estadoInterno ||
      (flujo.estado.startsWith('RESERVA_') ? (flujo.estado as EstadoReservaFlujo) : 'RESERVA_PERSONAS');

    const datos: DatosReservaBot = { ...(flujo.reserva?.datos || {}) };

    // 1. Manejo global de "Volver al menú" o "Hablar con persona"
    if (entrada.id === 'menu' || entrada.texto === 'menu' || entrada.texto === 'volver al menu') {
      return {
        nuevoEstado: 'MENU',
        acciones: [],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
          reserva: null,
          repreguntasFallidas: 0,
        },
      };
    }

    if (entrada.id === 'persona' || entrada.texto === 'hablar con persona' || entrada.texto === 'asesor') {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: 'Solicitud de atención humana desde reservas',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarTexto',
            texto: 'Un asesor de nuestro equipo se comunicará contigo en breve por este chat para coordinar tu reserva. ¡Gracias por tu paciencia!',
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
          reserva: null,
          repreguntasFallidas: 0,
        },
      };
    }

    // 2. Manejo de intención "cancelar reserva" o "cambiar reserva"
    const esCancelarReserva =
      entrada.id === 'res_act_cancelar' ||
      PALABRAS_CANCELAR_RESERVA.some((p) => entrada.texto.includes(p)) ||
      /\bcancela(r)?\b.*\breserva\b/i.test(entrada.texto);
    const esCambiarReserva =
      entrada.id === 'res_act_cambiar' ||
      PALABRAS_CAMBIAR_RESERVA.some((p) => entrada.texto.includes(p)) ||
      /\b(cambia(r)?|modifica(r)?)\b.*\breserva\b/i.test(entrada.texto);

    if ((esCancelarReserva || esCambiarReserva) && estadoActual !== 'RESERVA_CANCELAR_CONFIRMAR' && estadoActual !== 'RESERVA_CAMBIAR_DETALLE') {
      const reservasCliente = contexto.reservasActivasCliente || [];
      if (reservasCliente.length === 0) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.sinReservasActivas(),
              botones: [
                { id: 'reservar', titulo: 'Reservar mesa' },
                BOTON_VOLVER_MENU_RESERVA,
              ],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            reserva: null,
          },
        };
      }

      if (reservasCliente.length === 1) {
        const r = reservasCliente[0];
        datos.reservaIdAccion = r.id;

        if (esCancelarReserva) {
          return {
            nuevoEstado: 'RESERVA_CANCELAR_CONFIRMAR',
            acciones: [
              {
                tipo: 'enviarBotones',
                texto: TEXTOS_RESERVA.confirmarCancelar({
                  fecha: r.fecha,
                  hora: r.hora,
                  personas: r.personas,
                }),
                botones: BOTONES_RESERVA_CANCELAR_CONFIRMAR,
              },
            ],
            nuevoFlujo: {
              ...flujo,
              estado: 'RESERVA_CANCELAR_CONFIRMAR',
              reserva: {
                estadoInterno: 'RESERVA_CANCELAR_CONFIRMAR',
                datos,
                timestampUltimaAccion: Date.now(),
              },
            },
          };
        } else {
          return {
            nuevoEstado: 'RESERVA_CAMBIAR_DETALLE',
            acciones: [
              {
                tipo: 'enviarTexto',
                texto: TEXTOS_RESERVA.pedirDetalleCambio({
                  fecha: r.fecha,
                  hora: r.hora,
                }),
              },
            ],
            nuevoFlujo: {
              ...flujo,
              estado: 'RESERVA_CAMBIAR_DETALLE',
              reserva: {
                estadoInterno: 'RESERVA_CAMBIAR_DETALLE',
                datos,
                timestampUltimaAccion: Date.now(),
              },
            },
          };
        }
      }

      // Si tiene más de una reserva activa, listarlas
      return {
        nuevoEstado: 'RESERVA_CANCELAR_ELEGIR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.listarReservasFuturas(reservasCliente),
            botones: BOTONES_RESERVA_ACCIONES_EXISTENTE,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_CANCELAR_ELEGIR',
          reserva: {
            estadoInterno: 'RESERVA_CANCELAR_ELEGIR',
            datos,
            reservasActivas: reservasCliente,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // 3. PASO A PASO DEL FLUJO PRINCIPAL DE RESERVA

    // -------------------------------------------------------------------------
    // PASO 1: PERSONAS
    // -------------------------------------------------------------------------
    if (
      estadoActual === 'RESERVA_PERSONAS' ||
      entrada.id === 'reservar' ||
      entrada.id === 'btn_reserva' ||
      (!flujo.reserva && PALABRAS_RESERVA.some((p) => entrada.texto.includes(p)))
    ) {
      // Si la entrada es el inicio del flujo, verificar límite de 3 solicitudes pendientes
      if (!flujo.reserva || entrada.id === 'reservar' || entrada.id === 'btn_reserva') {
        const pendientes = contexto.solicitudesPendientesTelefono ?? 0;
        if (pendientes >= 3) {
          return {
            nuevoEstado: 'MENU',
            acciones: [
              {
                tipo: 'enviarBotones',
                texto: TEXTOS_RESERVA.limiteSolicitudesExcedido(),
                botones: [BOTON_HABLAR_PERSONA_RESERVA, BOTON_VOLVER_MENU_RESERVA],
              },
            ],
            nuevoFlujo: {
              ...flujo,
              estado: 'MENU',
              reserva: null,
            },
          };
        }

        // Mostrar prompt de selección de personas
        return {
          nuevoEstado: 'RESERVA_PERSONAS',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.pedirPersonas(),
              botones: BOTONES_RESERVA_PERSONAS,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'RESERVA_PERSONAS',
            reserva: {
              estadoInterno: 'RESERVA_PERSONAS',
              datos: {},
              timestampUltimaAccion: Date.now(),
            },
          },
        };
      }

      // Procesar selección de personas
      let personasElegidas: number | null = null;
      if (entrada.id === 'res_p_1_2') personasElegidas = 2;
      else if (entrada.id === 'res_p_3_4') personasElegidas = 4;
      else if (entrada.id === 'res_p_5_6') personasElegidas = 6;
      else {
        // Parsear número escrito
        const matchNum = entrada.texto.match(/\b(\d+)\b/);
        if (matchNum) {
          personasElegidas = parseInt(matchNum[1], 10);
        }
      }

      if (personasElegidas === null || isNaN(personasElegidas) || personasElegidas < 1) {
        return {
          nuevoEstado: 'RESERVA_PERSONAS',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: 'Por favor elige una opción o escribe la cantidad de personas (ejemplo: 2, 4, 8):',
              botones: BOTONES_RESERVA_PERSONAS,
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      // Seguridad: máx 10 personas por WhatsApp. Más de 10 deriva a persona
      if (personasElegidas > 10) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.personasExcesivas(),
              botones: [BOTON_HABLAR_PERSONA_RESERVA, BOTON_VOLVER_MENU_RESERVA],
            },
            {
              tipo: 'pasarAPersona',
              motivo: `Reserva para grupo grande (${personasElegidas} personas)`,
              mensajeCliente: entrada.textoOriginal,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            reserva: null,
          },
        };
      }

      datos.personas = personasElegidas;

      // Avanzar al PASO 2: FECHA
      return {
        nuevoEstado: 'RESERVA_FECHA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.pedirFecha(),
            botones: BOTONES_RESERVA_FECHA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_FECHA',
          reserva: {
            estadoInterno: 'RESERVA_FECHA',
            datos,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PASO 2: FECHA
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_FECHA' || estadoActual === 'RESERVA_FECHA_OTRA') {
      let fechaResuelta: { fechaIso: string; fechaTexto: string } | null = null;

      if (entrada.id === 'res_f_hoy' || entrada.texto === 'hoy') {
        fechaResuelta = obtenerFechaLimaActual(0);
      } else if (entrada.id === 'res_f_manana' || entrada.texto === 'manana' || entrada.texto === 'mañana') {
        fechaResuelta = obtenerFechaLimaActual(1);
      } else if (entrada.id === 'res_f_otra') {
        return {
          nuevoEstado: 'RESERVA_FECHA_OTRA',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_RESERVA.pedirFechaOtra(),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'RESERVA_FECHA_OTRA',
            reserva: {
              estadoInterno: 'RESERVA_FECHA_OTRA',
              datos,
              timestampUltimaAccion: Date.now(),
            },
          },
        };
      } else {
        // Tratar de parsear fecha escrita
        fechaResuelta = parsearFechaUsuario(entrada.textoOriginal);
      }

      if (!fechaResuelta) {
        return {
          nuevoEstado: 'RESERVA_FECHA_OTRA',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_RESERVA.fechaFormatoInvalido(),
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      // Validar que no sea fecha pasada
      const hoyLima = obtenerFechaLimaActual(0).fechaIso;
      if (fechaResuelta.fechaIso < hoyLima) {
        return {
          nuevoEstado: 'RESERVA_FECHA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.fechaPasada(),
              botones: BOTONES_RESERVA_FECHA,
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      // Validar anticipación máxima (30 días por defecto)
      const maxDiasAnticipacion = 30;
      const dHoy = new Date(`${hoyLima}T00:00:00-05:00`);
      const dSel = new Date(`${fechaResuelta.fechaIso}T00:00:00-05:00`);
      const diffDias = Math.round((dSel.getTime() - dHoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias > maxDiasAnticipacion) {
        return {
          nuevoEstado: 'RESERVA_FECHA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.anticipacionExcedida(maxDiasAnticipacion),
              botones: BOTONES_RESERVA_FECHA,
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      datos.fechaIso = fechaResuelta.fechaIso;
      datos.fechaTexto = fechaResuelta.fechaTexto;

      // Calcular franjas de hora disponibles
      const franjasDisponibles =
        Array.isArray(contexto.franjasDisponiblesReserva)
          ? contexto.franjasDisponiblesReserva
          : generarFranjasPorDefecto(
              contexto.datosLocal?.abre || '14:00',
              contexto.datosLocal?.cierra || '23:00',
            );

      // Si no hay disponibilidad para esa fecha
      if (franjasDisponibles.length === 0) {
        return {
          nuevoEstado: 'RESERVA_FECHA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.sinDisponibilidadFecha(datos.personas || 2, datos.fechaTexto),
              botones: [
                { id: 'res_f_otra', titulo: 'Otra fecha' },
                BOTON_HABLAR_PERSONA_RESERVA,
                BOTON_VOLVER_MENU_RESERVA,
              ],
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      // Armar lista interactiva de WhatsApp (máx 10 filas)
      const filasHoras: FilaLista[] = franjasDisponibles.slice(0, 10).map((h) => ({
        id: `res_h_${h.replace(':', '')}`,
        titulo: h,
        descripcion: `Mesa para ${datos.personas || 2} personas`,
      }));

      const horaAbreTexto = contexto.datosLocal?.abre || '14:00';

      return {
        nuevoEstado: 'RESERVA_HORA',
        acciones: [
          {
            tipo: 'enviarLista',
            texto: TEXTOS_RESERVA.pedirHoraPrompt(horaAbreTexto),
            botonTexto: BOTON_LISTA_HORAS,
            tituloSeccion: TITULO_SECCION_HORAS,
            filas: filasHoras,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_HORA',
          reserva: {
            estadoInterno: 'RESERVA_HORA',
            datos,
            franjasDisponibles,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PASO 3: HORA
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_HORA') {
      let horaSeleccionada: string | null = null;

      if (entrada.id?.startsWith('res_h_')) {
        const raw = entrada.id.replace('res_h_', '');
        if (raw.length === 4) {
          horaSeleccionada = `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
        }
      } else {
        horaSeleccionada = parsearHoraUsuario(entrada.textoOriginal);
      }

      const franjasValidas = flujo.reserva?.franjasDisponibles || generarFranjasPorDefecto();
      if (!horaSeleccionada || !franjasValidas.includes(horaSeleccionada)) {
        return {
          nuevoEstado: 'RESERVA_HORA',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_RESERVA.horaInvalida(),
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      datos.hora = horaSeleccionada;

      // Verificar si tenemos nombre de contacto sugerido
      const nombreSugerido = contexto.nombreCliente || flujo.nombre_perfil_wa;
      if (nombreSugerido && nombreSugerido.trim().length > 1) {
        return {
          nuevoEstado: 'RESERVA_CONFIRMAR_NOMBRE',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.confirmarNombre(nombreSugerido.trim()),
              botones: BOTONES_RESERVA_NOMBRE_CONFIRMAR,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'RESERVA_CONFIRMAR_NOMBRE',
            reserva: {
              estadoInterno: 'RESERVA_CONFIRMAR_NOMBRE',
              datos,
              timestampUltimaAccion: Date.now(),
            },
          },
        };
      }

      // Si no hay nombre sugerido, pedir que lo escriba
      return {
        nuevoEstado: 'RESERVA_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_RESERVA.pedirNombre(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_INGRESAR_NOMBRE',
          reserva: {
            estadoInterno: 'RESERVA_INGRESAR_NOMBRE',
            datos,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PASO 4: NOMBRE Y TELÉFONO
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_CONFIRMAR_NOMBRE') {
      if (entrada.id === 'res_nom_si' || entrada.texto === 'si' || entrada.texto === 'si es correcto') {
        datos.nombre = (contexto.nombreCliente || flujo.nombre_perfil_wa || 'Cliente').trim();
      } else if (entrada.id === 'res_nom_no' || entrada.texto === 'escribir otro') {
        return {
          nuevoEstado: 'RESERVA_INGRESAR_NOMBRE',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_RESERVA.pedirNombre(),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'RESERVA_INGRESAR_NOMBRE',
            reserva: {
              estadoInterno: 'RESERVA_INGRESAR_NOMBRE',
              datos,
              timestampUltimaAccion: Date.now(),
            },
          },
        };
      } else {
        datos.nombre = entrada.textoOriginal.trim();
      }

      // Evaluar teléfono (BSUID vs teléfono válido)
      return this.evaluarTelefonoYPasarANota(flujo, datos, contexto);
    }

    if (estadoActual === 'RESERVA_INGRESAR_NOMBRE') {
      const nombreLimpio = entrada.textoOriginal.trim();
      if (!nombreLimpio || nombreLimpio.length < 2) {
        return {
          nuevoEstado: 'RESERVA_INGRESAR_NOMBRE',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: 'Por favor escribe un nombre válido (al menos 2 letras):',
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      datos.nombre = nombreLimpio;
      return this.evaluarTelefonoYPasarANota(flujo, datos, contexto);
    }

    if (estadoActual === 'RESERVA_INGRESAR_TELEFONO') {
      const telLimpio = entrada.texto.replace(/\D/g, '');
      const match9 = telLimpio.match(/^51?(9\d{8})$/) || telLimpio.match(/^(9\d{8})$/);

      if (!match9) {
        return {
          nuevoEstado: 'RESERVA_INGRESAR_TELEFONO',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_RESERVA.telefonoInvalido(),
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      datos.telefono = match9[1];

      // Avanzar al PASO 5: NOTA
      return {
        nuevoEstado: 'RESERVA_PREGUNTAR_NOTA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.preguntarNota(),
            botones: BOTONES_RESERVA_NOTA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_PREGUNTAR_NOTA',
          reserva: {
            estadoInterno: 'RESERVA_PREGUNTAR_NOTA',
            datos,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PASO 5: NOTA OPCIONAL
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_PREGUNTAR_NOTA') {
      if (
        entrada.id === 'res_nota_sin' ||
        entrada.texto === 'sin nota' ||
        entrada.texto === 'no' ||
        entrada.texto === 'ninguna'
      ) {
        datos.nota = undefined;
      } else {
        datos.nota = entrada.textoOriginal.trim().slice(0, 150);
      }

      // Avanzar al PASO 6: RESUMEN Y CONFIRMACIÓN
      return {
        nuevoEstado: 'RESERVA_RESUMEN_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.resumenSolicitud({
              personas: datos.personas || 2,
              fechaTexto: datos.fechaTexto || 'Hoy',
              hora: datos.hora || '15:00',
              nombre: datos.nombre || 'Cliente',
              telefono: datos.telefono || '',
              nota: datos.nota,
            }),
            botones: BOTONES_RESERVA_CONFIRMAR_FINAL,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_RESUMEN_CONFIRMAR',
          reserva: {
            estadoInterno: 'RESERVA_RESUMEN_CONFIRMAR',
            datos,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PASO 6: RESUMEN Y ENVÍO DE SOLICITUD
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_RESUMEN_CONFIRMAR') {
      if (entrada.id === 'res_conf_cambiar' || entrada.texto === 'cambiar algo') {
        // Reiniciar datos manteniendo personas
        return {
          nuevoEstado: 'RESERVA_PERSONAS',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: 'Entendido. ¿Para cuántas personas deseas la reserva?',
              botones: BOTONES_RESERVA_PERSONAS,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'RESERVA_PERSONAS',
            reserva: {
              estadoInterno: 'RESERVA_PERSONAS',
              datos: {},
              timestampUltimaAccion: Date.now(),
            },
          },
        };
      }

      if (
        entrada.id === 'res_conf_si' ||
        entrada.texto === 'confirmar solicitud' ||
        entrada.texto === 'confirmar' ||
        entrada.texto === 'si'
      ) {
        const toleranciaMin = 15;

        const accionCrear: AccionMensaje = {
          tipo: 'crearSolicitudReserva',
          personas: datos.personas || 2,
          fechaIso: datos.fechaIso || obtenerFechaLimaActual(0).fechaIso,
          fechaTexto: datos.fechaTexto || 'Hoy',
          hora: datos.hora || '15:00',
          nombre: datos.nombre || 'Cliente',
          telefono: datos.telefono || '',
          nota: datos.nota,
        };

        return {
          nuevoEstado: 'MENU',
          acciones: [
            accionCrear,
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.solicitudEnviadaExito({
                personas: datos.personas || 2,
                fechaTexto: datos.fechaTexto || 'Hoy',
                hora: datos.hora || '15:00',
                toleranciaMin,
              }),
              botones: [BOTON_VOLVER_MENU_RESERVA],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            reserva: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Respuesta no reconocida en confirmación
      return {
        nuevoEstado: 'RESERVA_RESUMEN_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Por favor confirma si deseas enviar la solicitud de reserva o cambiar algo:',
            botones: BOTONES_RESERVA_CONFIRMAR_FINAL,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // -------------------------------------------------------------------------
    // CANCELACIÓN CONFIRMAR
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_CANCELAR_CONFIRMAR') {
      if (entrada.id === 'res_canc_si' || entrada.texto === 'si' || entrada.texto === 'si cancelar') {
        const accionCancelar: AccionMensaje = {
          tipo: 'cancelarReservaCliente',
          reservaId: datos.reservaIdAccion || '',
          motivo: 'Cancelado por el cliente desde WhatsApp',
        };

        return {
          nuevoEstado: 'MENU',
          acciones: [
            accionCancelar,
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_RESERVA.cancelacionExitosa(),
              botones: [BOTON_VOLVER_MENU_RESERVA],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            reserva: null,
          },
        };
      }

      if (entrada.id === 'res_canc_no' || entrada.texto === 'no' || entrada.texto === 'no mantener') {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: 'De acuerdo, mantenemos tu reserva intacta.',
              botones: [BOTON_VOLVER_MENU_RESERVA],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            reserva: null,
          },
        };
      }
    }

    // -------------------------------------------------------------------------
    // CAMBIO DE RESERVA DETALLE
    // -------------------------------------------------------------------------
    if (estadoActual === 'RESERVA_CAMBIAR_DETALLE') {
      const detalleCambio = entrada.textoOriginal.trim();
      const accionCambiar: AccionMensaje = {
        tipo: 'cambiarReservaCliente',
        reservaId: datos.reservaIdAccion || '',
        detalle: detalleCambio,
      };

      return {
        nuevoEstado: 'MENU',
        acciones: [
          accionCambiar,
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.cambioRegistradoExito(),
            botones: [BOTON_VOLVER_MENU_RESERVA],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
          reserva: null,
        },
      };
    }

    return null;
  }

  /**
   * Helper para verificar si el contacto tiene teléfono válido o requiere pedir celular por BSUID
   */
  private evaluarTelefonoYPasarANota(
    flujo: FlujoConversacion,
    datos: DatosReservaBot,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const rawTel = (contexto.telefonoCliente || '').trim();
    const telLimpio = rawTel.replace(/\D/g, '');
    const match9 = telLimpio.match(/^51?(9\d{8})$/) || telLimpio.match(/^(9\d{8})$/);

    const esBsuid =
      rawTel.startsWith('bsuid:') ||
      rawTel.startsWith('user:') ||
      rawTel.startsWith('PE.') ||
      !match9;

    if (!esBsuid && match9) {
      datos.telefono = match9[1];
      return {
        nuevoEstado: 'RESERVA_PREGUNTAR_NOTA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_RESERVA.preguntarNota(),
            botones: BOTONES_RESERVA_NOTA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'RESERVA_PREGUNTAR_NOTA',
          reserva: {
            estadoInterno: 'RESERVA_PREGUNTAR_NOTA',
            datos,
            timestampUltimaAccion: Date.now(),
          },
        },
      };
    }

    // Requiere pedir teléfono (remitente BSUID o sin teléfono registrado)
    return {
      nuevoEstado: 'RESERVA_INGRESAR_TELEFONO',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_RESERVA.pedirTelefono(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'RESERVA_INGRESAR_TELEFONO',
        reserva: {
          estadoInterno: 'RESERVA_INGRESAR_TELEFONO',
          datos,
          timestampUltimaAccion: Date.now(),
        },
      },
    };
  }
}

export const flujoReserva = new FlujoReservaSubFlujo();
RegistroSubFlujos.registrar(flujoReserva);
