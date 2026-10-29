import type { EntradaConfig } from './tipos';

const H = 'Horario semanal';
const FIN = 'Cambia lo que ve el cliente en la carta (abierto o cerrado, «Abrimos hoy a las…»), lo que responde el bot y si se aceptan pedidos de la carta y del bot.';

// Verificado: local.service.obtenerEstadoCarta decide abierto/cerrado con la fecha especial del día o, si no hay, con este
// horario (hora de Lima); pedidos.service rechaza con CARTA_CERRADA los pedidos de carta/bot fuera de horario (mozo y caja no).
export const HORARIO: EntradaConfig[] = [
  { id: 'horario-semanal', tab: 'horario', seccion: H, titulo: 'Horario de atención de cada día', descripcion: 'Hora de apertura y cierre de cada día de la semana. Fuera de ese horario la carta no recibe pedidos y el bot avisa que estamos cerrados. Mozo y Caja pueden seguir registrando pedidos.', ejemplo: 'Martes de 14:00 a 22:00', clave: 'horario_dia', palabras: ['horario', 'abre', 'cierra', 'apertura', 'cierre', 'dias', 'atencion', 'cerrado', 'lunes', 'a que hora abren', 'hasta que hora'], peligro: 'alto', efecto: FIN },
  ...[['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo']].map(([k, n]): EntradaConfig => ({
    id: `horario-dia-${k}`, tab: 'horario', seccion: H, titulo: `${n}: hora de apertura y cierre`,
    descripcion: `Hora a la que se abre y se cierra el ${n.toLowerCase()}. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy».`,
    ejemplo: '14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no', clave: 'horario_dia',
    palabras: ['horario', n.toLowerCase(), 'abre', 'cierra', 'hora de apertura', 'hora de cierre', 'a que hora abren', 'a que hora cierran'],
    peligro: 'alto', rango: 'La apertura debe ser antes del cierre (no se puede cruzar la medianoche)', porDefecto: '14:00 a 22:00', efecto: FIN,
  })),
  { id: 'horario-dia-cerrado', tab: 'horario', seccion: H, titulo: 'Cerrar o abrir un día completo', descripcion: 'Botón «Cerrar este día» / «Abrir este día» de cada día. Un día cerrado no recibe pedidos de la carta ni del bot y la carta dice «Cerrado hoy».', ejemplo: 'Cerrar el domingo si no atienden', palabras: ['dia cerrado', 'no atendemos', 'descanso', 'cerrar domingo', 'dia libre', 'cerrar dia', 'abrir dia'], peligro: 'alto', efecto: 'Al abrir un día que estaba cerrado se propone 14:00 a 22:00; ajústalo antes de guardar.' },
  { id: 'horario-guardar', tab: 'horario', seccion: H, titulo: 'Guardar el horario semanal', descripcion: 'Aplica los horarios a la carta virtual y al bot. Pide confirmación Sí/No y, si está activo, el código de supervisor. Los pedidos ya creados no se tocan.', palabras: ['guardar horario', 'confirmar', 'codigo de supervisor', 'aplicar'], peligro: 'alto' },
];
