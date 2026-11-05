export type PeligroConfig = 'bajo' | 'medio' | 'alto';

/** Un ajuste buscable de Configuración. Ver LEEME.md para las reglas de redacción. */
export interface EntradaConfig {
  /** Id estable, kebab-case y único. Es el mismo que va en data-cfg-id / ?campo=. No se renombra. */
  id: string;
  /** Id de la pestaña (categoría) donde vive: 'chatbot', 'local', 'parametros'... */
  tab: string;
  /** Sección interna de la pestaña, si tiene varias (Impresión: 'mapa' | 'equipos' | 'cola'). Va en ?seccion=. */
  apartado?: string;
  /** Título de la tarjeta o sección donde está. */
  seccion: string;
  /** Nombre del ajuste, como lo diría el dueño. */
  titulo: string;
  /** Qué cambia y a quién afecta, 1-2 frases en lenguaje de negocio. */
  descripcion: string;
  /** Valor típico o efecto: «Si pones 10, el bot calla al cliente que mande más de 10 mensajes en un minuto». */
  ejemplo?: string;
  /** Clave técnica del parámetro, si existe. */
  clave?: string;
  /** Sinónimos y términos que la gente usaría al buscar. */
  palabras: string[];
  /** Permiso requerido para verlo/editarlo (si falta, basta con entrar a Configuración). */
  permiso?: string;
  /** Riesgo si se cambia mal: dinero o clientes afectados. */
  peligro?: PeligroConfig;
  /** Ayuda visible del campo (CampoAyuda): qué pasa si se cambia, unidad, rango y valor por defecto. */
  efecto?: string;
  unidad?: string;
  rango?: string;
  porDefecto?: string;
}
