export type TipoNodoGrafo = 'modulo' | 'tarea' | 'rol' | 'permiso';

export interface RelacionTarea {
  tipo: 'requiere' | 'antes' | 'despues' | 'ver_tambien';
  destinoModulo: string;
}

export interface SeccionComoSeHace {
  slug: string;
  titulo: string;
  pasos: string;
  relaciones: RelacionTarea[];
}

export interface NodoModulo {
  id: string; // clave del módulo (e.g. 'caja')
  tipo: 'modulo';
  clave: string;
  titulo: string;
  ruta: string;
  permiso?: string;
  paraQueSirve?: string;
}

export interface NodoTarea {
  id: string; // e.g. 'caja#anular-un-pedido'
  tipo: 'tarea';
  modulo: string;
  titulo: string;
  pasos: string;
  texto: string;
}

export interface NodoRol {
  id: string; // 'rol:ADMIN', 'rol:CAJERO'
  tipo: 'rol';
  codigo: string;
}

export interface NodoPermiso {
  id: string; // 'permiso:caja/ver'
  tipo: 'permiso';
  codigo: string;
}

export type NodoGrafo = NodoModulo | NodoTarea | NodoRol | NodoPermiso;

export type TipoAristaGrafo =
  | 'pertenece_a'      // tarea -> modulo
  | 'puede_usar'       // rol -> modulo
  | 'requiere_permiso' // modulo -> permiso
  | 'relacionado_con'  // modulo <-> modulo
  | 'requiere'         // tarea o modulo -> modulo (e.g. supervisor-codigo)
  | 'antes'            // tarea o modulo -> modulo
  | 'despues'          // tarea o modulo -> modulo
  | 'ver_tambien';     // tarea o modulo -> modulo

export interface AristaGrafo {
  id: string;
  tipo: TipoAristaGrafo;
  origen: string;
  destino: string;
}

export interface ResumenNodoGrafo {
  id: string;
  tipo: TipoNodoGrafo;
  etiqueta: string;
  modulo?: string;
  ruta?: string;
}

export interface ResumenAristaGrafo {
  tipo: TipoAristaGrafo;
  origen: string;
  destino: string;
}

export interface ResumenGrafoRespuesta {
  nodos: ResumenNodoGrafo[];
  aristas: ResumenAristaGrafo[];
}

export interface ResultadoRecuperacionGrafo {
  contextoTexto: string;
  mejorTarea?: NodoTarea;
  moduloPrincipal?: NodoModulo;
  vecinos: NodoModulo[];
  relacionesFormateadas: string[];
  enlacesSugeridos: Array<{ texto: string; ruta: string }>;
}
