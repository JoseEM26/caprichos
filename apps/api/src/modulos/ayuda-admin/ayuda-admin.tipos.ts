import { SeccionComoSeHace } from './ayuda-grafo.tipos';

export interface EnlaceAyuda {
  texto: string;
  ruta: string;
}

export interface ContextoAyudaRespuesta {
  activo: boolean;
  modulo?: string | null;
  titulo?: string | null;
  /** Sección de la pantalla (p. ej. la pestaña de Configuración) deducida de la URL, si hay un manual para ella. */
  seccion?: string | null;
  tituloSeccion?: string | null;
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
  /** Manual de SECCIÓN: id de la sección dentro del módulo (p. ej. `horario`). Sin él, es el manual general del módulo. */
  seccion?: string;
  /** Consultas de URL que activan la sección, `param=valor` (p. ej. `tab=horario`). Sin ellas, es un manual temático. */
  activaCon?: string[];
}

export interface ManualAyuda extends FrontmatterManual {
  archivo: string;
  contenido: string; // Markdown body
  paraQueSirve?: string;
  erroresYDudas?: string;
  quienPuedeHacerlo?: string;
  /** Líneas «- …» de las secciones «Ajustes…» y «Donde se configura…»: cada una lleva su enlace profundo. */
  ajustes: string[];
  seccionesComoSeHace: SeccionComoSeHace[];
  mencionesDoblesCorchetes: string[];
}
