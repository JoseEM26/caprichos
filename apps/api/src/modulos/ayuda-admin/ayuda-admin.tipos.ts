import { SeccionComoSeHace } from './ayuda-grafo.tipos';

export interface EnlaceAyuda {
  texto: string;
  ruta: string;
}

export interface ContextoAyudaRespuesta {
  activo: boolean;
  modulo?: string | null;
  titulo?: string | null;
  rolUsuario: string;
  sugerencias: string[];
  enlaces: EnlaceAyuda[];
}

export type RolMensaje = 'usuario' | 'capri';

export interface MensajeHistorial {
  rol: RolMensaje;
  texto: string;
}

export type EstadoRespuestaAyuda = 'ok' | 'rechazada' | 'sin_ia' | 'tope' | 'limite';

export interface PreguntarAyudaRespuesta {
  respuesta: string;
  enlaces: EnlaceAyuda[];
  estado: EstadoRespuestaAyuda;
  mensaje?: string;
}

export interface FrontmatterManual {
  modulo: string;
  titulo: string;
  ruta: string;
  permiso?: string;
  roles: string[];
  sugerencias: string[];
  relacionados?: string[];
}

export interface ManualAyuda extends FrontmatterManual {
  archivo: string;
  contenido: string; // Markdown body
  paraQueSirve?: string;
  erroresYDudas?: string;
  quienPuedeHacerlo?: string;
  seccionesComoSeHace: SeccionComoSeHace[];
  mencionesDoblesCorchetes: string[];
}
