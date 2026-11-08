/** Lista local y compacta de emojis comunes (sin dependencias). Cada uno: [emoji, palabras para buscar]. */
export type EmojiItem = [string, string];

export const CATEGORIAS_EMOJI: { id: string; titulo: string; icono: string; items: EmojiItem[] }[] = [
  {
    id: 'caras',
    titulo: 'Caras',
    icono: '😀',
    items: [
      ['😀', 'sonrisa feliz'], ['😃', 'alegre contento'], ['😄', 'risa feliz'], ['😁', 'sonriente dientes'], ['😆', 'risa carcajada'],
      ['😅', 'sudor nervioso risa'], ['😂', 'llorar de risa jaja'], ['🤣', 'carcajada suelo'], ['🙂', 'sonrisa leve'], ['😉', 'guino'],
      ['😊', 'sonrojado gracias amable'], ['😇', 'angel bueno'], ['🥰', 'enamorado amor cariño'], ['😍', 'ojos corazon encanta'], ['🤩', 'estrellas wow'],
      ['😘', 'beso'], ['😋', 'rico delicioso sabroso'], ['😛', 'lengua'], ['😜', 'lengua guino broma'], ['🤪', 'loco'],
      ['🤗', 'abrazo'], ['🤔', 'pensando duda'], ['🤭', 'ups secreto'], ['😎', 'lentes genial'], ['🤓', 'nerd'],
      ['😏', 'picaro'], ['😌', 'alivio tranquilo'], ['😴', 'dormir sueño'], ['🥱', 'bostezo cansado'], ['😷', 'mascarilla enfermo'],
      ['🤒', 'fiebre enfermo'], ['🥵', 'calor'], ['🥶', 'frio'], ['😳', 'sonrojo verguenza'], ['🥺', 'por favor ruego tierno'],
      ['😢', 'triste llorar'], ['😭', 'llanto'], ['😤', 'molesto'], ['😠', 'enojado'], ['😡', 'furioso rabia'],
      ['😱', 'miedo grito'], ['😨', 'susto'], ['😰', 'ansiedad'], ['😓', 'sudor cansancio'], ['😔', 'pensativo triste'],
      ['😞', 'decepcion'], ['😕', 'confundido'], ['🙄', 'ojos arriba fastidio'], ['😐', 'neutral'], ['😶', 'sin palabras'],
      ['🫡', 'saludo'], ['🫠', 'derritiendo'], ['🙃', 'al reves'], ['😬', 'incomodo'],
    ],
  },
  {
    id: 'gestos',
    titulo: 'Gestos',
    icono: '👍',
    items: [
      ['👍', 'bien ok de acuerdo listo'], ['👎', 'mal no'], ['👌', 'perfecto ok'], ['✌️', 'paz victoria'], ['🤞', 'suerte dedos cruzados'],
      ['🤟', 'te quiero'], ['🤘', 'rock'], ['👏', 'aplauso bravo'], ['🙌', 'celebrar manos arriba'], ['👐', 'manos abiertas'],
      ['🙏', 'gracias por favor rezar'], ['🤝', 'trato acuerdo'], ['💪', 'fuerza biceps'], ['👋', 'hola chau saludo'], ['🤙', 'llamame'],
      ['👉', 'derecha señalar'], ['👈', 'izquierda señalar'], ['👆', 'arriba señalar'], ['👇', 'abajo señalar'], ['☝️', 'uno atencion'],
      ['✋', 'alto mano'], ['🖐️', 'mano abierta'], ['🫶', 'corazon manos cariño'], ['✍️', 'escribir'], ['🤳', 'selfie'],
      ['👀', 'ojos mirar'], ['🧠', 'cerebro'], ['🗣️', 'hablar'], ['🙋', 'levantar mano pregunta'], ['🤷', 'no se'],
    ],
  },
  {
    id: 'corazones',
    titulo: 'Corazones y símbolos',
    icono: '❤️',
    items: [
      ['❤️', 'corazon rojo amor'], ['🧡', 'corazon naranja'], ['💛', 'corazon amarillo'], ['💚', 'corazon verde'], ['💙', 'corazon azul'],
      ['💜', 'corazon morado'], ['🖤', 'corazon negro'], ['🤍', 'corazon blanco'], ['🤎', 'corazon cafe'], ['💕', 'corazones'],
      ['💖', 'corazon brillante'], ['💗', 'corazon creciendo'], ['💘', 'flecha corazon'], ['💝', 'corazon regalo'], ['💔', 'corazon roto'],
      ['✨', 'brillo estrellas magia'], ['⭐', 'estrella'], ['🌟', 'estrella brillante'], ['💫', 'mareo estrella'], ['🔥', 'fuego caliente'],
      ['💯', 'cien perfecto'], ['✅', 'listo correcto check'], ['❌', 'no error equis'], ['❗', 'importante atencion'], ['❓', 'pregunta'],
      ['⚠️', 'aviso cuidado'], ['⏰', 'reloj hora'], ['⌛', 'espera tiempo'], ['📍', 'ubicacion direccion lugar'], ['🔔', 'campana aviso'],
    ],
  },
  {
    id: 'comida',
    titulo: 'Comida y bebida',
    icono: '🍩',
    items: [
      ['🍩', 'dona donut'], ['🍪', 'galleta'], ['🍰', 'pastel torta'], ['🎂', 'cumpleaños torta'], ['🧁', 'cupcake'],
      ['🍫', 'chocolate'], ['🍬', 'caramelo dulce'], ['🍭', 'paleta'], ['🍦', 'helado'], ['🍨', 'helado copa'],
      ['🥐', 'croissant'], ['🍞', 'pan'], ['🥪', 'sandwich'], ['🍔', 'hamburguesa'], ['🍟', 'papas fritas'],
      ['🍕', 'pizza'], ['🌭', 'hot dog'], ['🌮', 'taco'], ['🥗', 'ensalada'], ['🍳', 'huevo desayuno'],
      ['🥞', 'panqueques'], ['🧇', 'waffle'], ['🥓', 'tocino'], ['🍗', 'pollo'], ['🍝', 'pasta fideos'],
      ['🍓', 'fresa'], ['🍌', 'platano'], ['🍎', 'manzana'], ['🍇', 'uvas'], ['🥭', 'mango'],
      ['☕', 'cafe'], ['🍵', 'te'], ['🥤', 'bebida vaso frappe'], ['🧋', 'te burbujas'], ['🍹', 'tropical jugo'],
      ['🥛', 'leche'], ['🍷', 'vino'], ['🍺', 'cerveza'], ['🧊', 'hielo'], ['🍽️', 'plato cubiertos'],
    ],
  },
  {
    id: 'cosas',
    titulo: 'Objetos y celebración',
    icono: '🎉',
    items: [
      ['🎉', 'fiesta celebrar'], ['🎊', 'confeti'], ['🎁', 'regalo'], ['🎈', 'globo'], ['🥳', 'fiesta cumple'],
      ['📦', 'paquete caja pedido'], ['🛵', 'moto delivery reparto'], ['🚗', 'auto'], ['🏠', 'casa'], ['🏪', 'tienda local'],
      ['📱', 'celular'], ['📞', 'telefono llamada'], ['💬', 'mensaje chat'], ['📷', 'camara foto'], ['🧾', 'recibo boleta comprobante'],
      ['💳', 'tarjeta pago'], ['💵', 'dinero efectivo billete'], ['💰', 'plata dinero'], ['🛒', 'carrito compras'], ['🛍️', 'bolsas compras'],
      ['📅', 'calendario fecha'], ['🕐', 'hora'], ['📝', 'nota anotar'], ['📌', 'chincheta fijar'], ['🔑', 'llave'],
      ['🌞', 'sol'], ['🌙', 'luna noche'], ['⛅', 'nube'], ['🌧️', 'lluvia'], ['🌈', 'arcoiris'],
      ['🌸', 'flor'], ['🌹', 'rosa'], ['🌻', 'girasol'], ['🌿', 'planta hoja'], ['🐶', 'perro'],
      ['🐱', 'gato'], ['🦄', 'unicornio'], ['🐻', 'oso'], ['🐰', 'conejo'], ['🦋', 'mariposa'],
    ],
  },
];

/** Busca por palabra en todas las categorías (sin tildes ni mayúsculas). */
export function buscarEmojis(texto: string): EmojiItem[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(texto.trim());
  if (!q) return [];
  return CATEGORIAS_EMOJI.flatMap((c) => c.items).filter(([, palabras]) => norm(palabras).includes(q));
}

/** Inserta `emoji` en la posición del cursor (o reemplaza la selección). Devuelve el texto nuevo y dónde queda el cursor. */
export function insertarEnCursor(
  texto: string,
  emoji: string,
  inicio: number | null,
  fin: number | null,
): { texto: string; cursor: number } {
  const a = inicio ?? texto.length;
  const b = fin ?? a;
  return { texto: texto.slice(0, a) + emoji + texto.slice(b), cursor: a + emoji.length };
}
