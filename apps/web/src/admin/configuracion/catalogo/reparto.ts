import type { EntradaConfig, PeligroConfig } from './tipos';

/**
 * Pestaña «Reparto» (SeccionRepartoConfig). La tarjeta de espera/intentos/recargo de entregas fallidas
 * (id fallas-falla-espera-min) la referencia operacion.ts. Textos verificados contra repartos.service.ts.
 */
export interface AyudaReparto {
  titulo: string;
  descripcion: string;
  ejemplo: string;
  efecto: string;
  porDefecto: string;
  unidad: string;
  rango: string;
  clave: string;
  palabras: string[];
  peligro: PeligroConfig;
}

const SEC = 'Umbrales de espera y operación del mapa';

/** Ayuda visible de cada campo de SeccionRepartoConfig, por nombre del campo. */
export const AYUDA_REPARTO: Record<string, AyudaReparto & { id: string }> = {
  retrasadoMin: {
    id: 'reparto-retrasado-min', clave: 'reparto_retrasado_min',
    titulo: 'Minutos para alerta amarilla (Retrasado)',
    descripcion: 'Minutos de espera del pedido para pintar su punto en amarillo (Retrasado) en el mapa y la lista de reparto. Lo ven Caja y quien coordina el reparto.',
    ejemplo: 'Con 20: un pedido que lleva 20 minutos esperando pasa de verde a amarillo.',
    efecto: 'Bajarlo hace que la alerta amarilla salte antes. Debe ser menor que Tarde; si no, el sistema no deja guardar.',
    porDefecto: '20', unidad: 'minutos', rango: '1 a 180',
    palabras: ['amarillo', 'retrasado', 'mapa', 'alerta', 'color', 'tarde', 'reparto'], peligro: 'medio',
  },
  tardeMin: {
    id: 'reparto-tarde-min', clave: 'reparto_tarde_min',
    titulo: 'Minutos para alerta naranja (Tarde)',
    descripcion: 'Minutos de espera para pintar el pedido en naranja (Tarde) en el mapa de reparto.',
    ejemplo: 'Con 30: a los 30 minutos el punto se ve naranja.',
    efecto: 'Debe quedar entre Retrasado y Muy tarde. Cambia solo el color y las alertas, no cancela pedidos.',
    porDefecto: '30', unidad: 'minutos', rango: '2 a 240',
    palabras: ['naranja', 'tarde', 'retraso', 'mapa', 'color', 'alerta'], peligro: 'medio',
  },
  muyTardeMin: {
    id: 'reparto-muy-tarde-min', clave: 'reparto_muy_tarde_min',
    titulo: 'Minutos para alerta roja palpitando (Muy tarde)',
    descripcion: 'Minutos de espera para marcar el pedido en rojo palpitando (crítico) en el mapa de reparto.',
    ejemplo: 'Con 45: a los 45 minutos el punto palpita en rojo y exige atención.',
    efecto: 'Debe ser mayor que Tarde. Bajarlo vuelve críticos más pedidos.',
    porDefecto: '45', unidad: 'minutos', rango: '3 a 360',
    palabras: ['rojo', 'muy tarde', 'critico', 'palpitando', 'urgente', 'mapa'], peligro: 'medio',
  },
  velocidadKmh: {
    id: 'reparto-velocidad-kmh', clave: 'reparto_velocidad_kmh',
    titulo: 'Velocidad media de viaje',
    descripcion: 'Velocidad promedio del repartidor en moto. Con ella se estima el tiempo de viaje por distancia, el orden de la ruta y el tiempo estimado que ve el cliente.',
    ejemplo: 'Con 25 km/h: 5 km de camino se estiman en unos 12 minutos.',
    efecto: 'Subirla acorta los tiempos estimados que se le dicen al cliente; bajarla los alarga.',
    porDefecto: '25', unidad: 'km/h', rango: '5 a 100',
    palabras: ['velocidad', 'moto', 'km por hora', 'tiempo de viaje', 'ruta', 'estimado'], peligro: 'medio',
  },
  maxPedidos: {
    id: 'reparto-max-pedidos', clave: 'reparto_max_pedidos',
    titulo: 'Máximo de pedidos por repartidor',
    descripcion: 'Cuántos pedidos puede llevar a la vez un repartidor. Con el tope lleno no puede tomar otro ni se le puede asignar otro hasta que entregue alguno.',
    ejemplo: 'Con 5: el repartidor con 5 pedidos activos recibe «entrega alguno antes de tomar otro».',
    efecto: 'Subirlo acelera el reparto pero enfría los pedidos de la ruta; bajarlo reparte la carga entre más repartidores.',
    porDefecto: '5', unidad: 'pedidos', rango: '1 a 20',
    palabras: ['repartidor', 'capacidad', 'pedidos por moto', 'maximo de pedidos', 'motorizado', 'ruta'], peligro: 'medio',
  },
};

export const REPARTO: EntradaConfig[] = [
  { id: 'reparto-alertas-color', tab: 'reparto', seccion: SEC, titulo: 'Colores de espera del mapa de reparto (amarillo, naranja, rojo)', descripcion: 'Agrupa los minutos para las alertas Retrasado, Tarde y Muy tarde del mapa y la lista de reparto. Deben ir en orden ascendente.', ejemplo: 'Con 20 / 30 / 45: amarillo a los 20 min, naranja a los 30, rojo palpitando a los 45.', palabras: ['naranja', 'rojo', 'amarillo', 'retraso', 'tarde', 'alerta', 'color', 'semaforo', 'mapa de reparto'], peligro: 'medio' },
  ...Object.values(AYUDA_REPARTO).map((a): EntradaConfig => ({
    id: a.id, tab: 'reparto', seccion: SEC, titulo: a.titulo, descripcion: a.descripcion, ejemplo: a.ejemplo,
    clave: a.clave, palabras: [...a.palabras, a.clave.replace(/_/g, ' ')], peligro: a.peligro,
  })),
  { id: 'reparto-mensajes-whatsapp', tab: 'reparto', seccion: 'Reparto y avisos al cliente', titulo: 'Dónde se cambian los mensajes de WhatsApp al salir y llegar', descripcion: 'Los avisos «En camino», «He llegado» y espera agotada se encienden o apagan en Parámetros (Avisos automáticos por WhatsApp) y sus tiempos en Parámetros (entrega fallida). Aquí no se editan.', ejemplo: 'Para apagar el aviso «Repartidor en la puerta» ve a Parámetros.', palabras: ['en camino', 'he llegado', 'aviso', 'mensaje', 'whatsapp', 'plantilla'] },
  { id: 'fallas-falla-espera-min', tab: 'fallas', seccion: 'Entregas fallidas', titulo: 'Espera, intentos y recargo de entregas fallidas', descripcion: 'Cuánto espera el repartidor, cuántos intentos hace y cuánto se cobra por reprogramar si el cliente no recibe.', palabras: ['fallida', 'no recibe', 'reprogramar', 'recargo', 'devolver', 'intentos'], peligro: 'alto' },
];
