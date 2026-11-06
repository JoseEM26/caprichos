/**
 * Especificación de cada tabla migrable: clave natural, referencias (ids -> claves naturales),
 * columnas que no salen y filtro de "solo activo". El motor (motor.ts) la usa en exportar e importar.
 *
 *  - clave: propiedades que identifican la fila en CUALQUIER base (nombre de producto, código de
 *    zona, clave de parámetro, DNI...). Una propiedad puede ser un escalar o una referencia.
 *  - refs: propiedad -> FK (columna) a otra tabla. En el paquete se escribe la clave natural
 *    de la fila referida, anidada (p. ej. producto.categoria = { nombre: "Bebidas" }).
 *  - listas: propiedad -> columna BigInt[] con ids de otra tabla (combo_parte.productos).
 *  - opcional: si la fila referida no sale del paquete, la referencia queda en null (aviso en el
 *    reporte); sin opcional, la fila que la usa tampoco sale.
 *  - activo: solo se exportan filas que pasan el filtro. Las filas de hook se gestionan en otra tabla.
 */
import type { Contexto, Fila } from './motor';
import { parametroMigrable } from './clasificacion';

/** Campos JSON que pueden enlazar archivos públicos por ruta (se reescriben a archivo://<sha>). */
export const JSON_FIELDS: Record<string, string[]> = { parametro: ['valor'], version_carta: ['contenido'] };

export interface Ref { col: string; tabla: string; opcional?: boolean }

export interface Espec {
  clave: string[];
  refs?: Record<string, Ref>;
  listas?: Record<string, Ref>;
  omitir?: string[];
  activo?: (r: Fila, ctx: Contexto) => boolean;
  /** Tabla gestionada por otra (p. ej. party_identifier se crea junto con party). */
  hook?: 'party' | 'archivo';
}

const ref = (col: string, tabla: string, opcional = false): Ref => ({ col, tabla, opcional });
const vigente = (r: Fila, ctx: Contexto) => !r.hasta || r.hasta >= ctx.inicioHoy;
const hoyEnAdelante = (campo: string) => (r: Fila, ctx: Contexto) => r[campo] >= ctx.inicioHoy;
const activoCampo = (r: Fila) => r.activo === true;

export const ESPECIFICACION: Record<string, Espec> = {
  parametro: { clave: ['clave'], activo: (r) => parametroMigrable(r.clave) },
  regla_acumulacion: { clave: [] }, // singleton: una sola fila
  rol: { clave: ['codigo'] },
  permiso: { clave: ['modulo', 'accion'] },
  rol_permiso: { clave: ['rol', 'permiso'], refs: { permiso: ref('permiso_id', 'permiso') } },

  lista: { clave: ['codigo'] },
  lista_valor: { clave: ['lista', 'nombre'], refs: { lista: ref('lista_id', 'lista') }, activo: activoCampo },
  horario_dia: { clave: ['dia_semana'] },
  fecha_especial: { clave: ['fecha'], activo: hoyEnAdelante('fecha') },
  area_cocina: { clave: ['nombre'], activo: activoCampo },
  categoria: { clave: ['nombre'], refs: { area: ref('area_id', 'area_cocina') }, activo: (r) => !r.oculta },

  archivo: { clave: ['sha256'], hook: 'archivo' },
  foto_local: { clave: ['archivo'], refs: { archivo: ref('archivo_id', 'archivo') }, activo: activoCampo },
  lugar_stock: { clave: ['nombre'], refs: { area: ref('area_id', 'area_cocina') } },

  party: { clave: ['documento'], activo: (r, ctx) => ctx.vigentes.has(String(r.id)) },
  party_identifier: { clave: [], hook: 'party' },
  person: {
    clave: ['party'],
    refs: { party: ref('party_id', 'party') },
    omitir: ['cumple_dia', 'cumple_mes', 'correo', 'foto_archivo_id'],
  },
  user_account: {
    clave: ['party'],
    refs: { party: ref('party_id', 'party') },
    omitir: ['hash', 'pin_hash', 'alertas_whatsapp_confirmado_en', 'debe_cambiar'],
    activo: activoCampo,
  },
  party_role: {
    clave: ['party', 'rol'],
    refs: { party: ref('party_id', 'party') },
    activo: (r, ctx) => (r.rol === 'TRABAJADOR' && vigente(r, ctx)) || r.rol === 'PROVEEDOR',
  },
  employee_detail: { clave: ['party_role'], refs: { party_role: ref('party_role_id', 'party_role') } },
  organization: { clave: ['party'], refs: { party: ref('party_id', 'party') } },
  supplier_detail: { clave: ['party_role'], refs: { party_role: ref('party_role_id', 'party_role') }, activo: activoCampo },
  horario_trabajo: { clave: ['party', 'dia_semana'], refs: { party: ref('party_id', 'party') }, activo: activoCampo },
  reemplazo_dia: {
    clave: ['party', 'dia_semana'],
    refs: { party: ref('party_id', 'party'), reemplaza: ref('reemplaza_party_id', 'party') },
    activo: activoCampo,
  },
  cobertura_turno: {
    clave: ['fecha', 'cubre', 'desde'],
    refs: { cubre: ref('cubre_party_id', 'party'), reemplaza: ref('reemplaza_party_id', 'party') },
    activo: hoyEnAdelante('fecha'),
  },

  producto: {
    clave: ['nombre'],
    refs: { categoria: ref('categoria_id', 'categoria'), foto: ref('foto_archivo_id', 'archivo', true) },
    omitir: ['agotado_hasta'],
    activo: (r) => !r.oculto,
  },
  producto_tamano: {
    clave: ['producto', 'tamano_valor'],
    refs: { producto: ref('producto_id', 'producto'), tamano_valor: ref('tamano_valor_id', 'lista_valor') },
    activo: activoCampo,
  },
  grupo_opciones: { clave: ['nombre'], refs: { lista: ref('lista_id', 'lista') }, activo: activoCampo },
  opcion: {
    clave: ['grupo', 'valor'],
    refs: { grupo: ref('grupo_id', 'grupo_opciones'), valor: ref('valor_id', 'lista_valor') },
    omitir: ['agotado_hasta'],
    activo: activoCampo,
  },
  producto_grupo: {
    clave: ['producto', 'grupo'],
    refs: { producto: ref('producto_id', 'producto'), grupo: ref('grupo_id', 'grupo_opciones') },
  },
  sabor: {
    clave: ['producto', 'nombre'],
    refs: { producto: ref('producto_id', 'producto') },
    omitir: ['agotado_hasta'],
    activo: activoCampo,
  },

  zona_reparto: { clave: ['codigo'], activo: (r) => r.activa === true },
  piso: { clave: ['nombre'], activo: activoCampo },
  elemento_plano: {
    clave: ['piso', 'tipo', 'nombre', 'x', 'y'],
    refs: { piso: ref('piso_id', 'piso') },
    activo: activoCampo,
  },

  oferta: {
    clave: ['nombre'],
    refs: {
      categoria: ref('alcance_categoria_id', 'categoria'),
      producto: ref('alcance_producto_id', 'producto'),
      imagen: ref('imagen_archivo_id', 'archivo', true),
    },
    omitir: ['usos_actuales'],
    activo: (r, ctx) => r.activo === true && (!r.fecha_hasta || r.fecha_hasta >= ctx.ahora),
  },
  combo_precio: {
    clave: ['oferta', 'tamano_valor'],
    refs: { oferta: ref('oferta_id', 'oferta'), tamano_valor: ref('tamano_valor_id', 'lista_valor') },
  },
  combo_parte: {
    clave: ['oferta', 'tipo', 'cantidad', 'categorias', 'productos'],
    refs: { oferta: ref('oferta_id', 'oferta') },
    listas: { categorias: ref('categorias', 'categoria'), productos: ref('productos', 'producto') },
  },
  combo_parte_reemplazo: {
    clave: ['combo_parte', 'producto'],
    refs: { combo_parte: ref('combo_parte_id', 'combo_parte'), producto: ref('producto_id', 'producto') },
  },
  opcion_requiere: {
    clave: ['opcion', 'producto', 'sabor'],
    refs: {
      opcion: ref('opcion_id', 'opcion'),
      producto: ref('producto_id', 'producto'),
      sabor: ref('sabor_id', 'sabor', true),
    },
  },
  cupon: {
    clave: ['codigo_base'],
    refs: { categoria: ref('categoria_id', 'categoria', true), producto: ref('producto_id', 'producto', true) },
    omitir: ['usos_actuales'],
    activo: activoCampo,
  },

  insumo: {
    clave: ['nombre'],
    refs: {
      lugar_consumo: ref('lugar_consumo_id', 'lugar_stock', true),
      proveedor_a: ref('proveedor_a', 'party', true),
      proveedor_b: ref('proveedor_b', 'party', true),
      proveedor_c: ref('proveedor_c', 'party', true),
    },
    activo: activoCampo,
  },
  receta: {
    clave: ['producto', 'tamano_valor', 'es_produccion'],
    refs: { producto: ref('producto_id', 'producto'), tamano_valor: ref('tamano_valor_id', 'lista_valor', true) },
  },
  receta_linea: {
    clave: ['receta', 'insumo'],
    refs: {
      receta: ref('receta_id', 'receta'),
      insumo: ref('insumo_id', 'insumo'),
      producto_tamano: ref('producto_tamano_id', 'producto_tamano', true),
    },
  },
  ajuste_opcion: {
    clave: ['opcion', 'insumo'],
    refs: {
      opcion: ref('opcion_id', 'opcion'),
      insumo: ref('insumo_id', 'insumo'),
      reemplaza_insumo: ref('reemplaza_insumo_id', 'insumo', true),
    },
  },

  novedad: {
    clave: ['titulo', 'tipo', 'creado_en'],
    activo: (r, ctx) => r.activo === true && (!r.hasta || r.hasta >= ctx.inicioHoy),
  },
  novedad_foto: {
    clave: ['novedad', 'archivo'],
    refs: { novedad: ref('novedad_id', 'novedad'), archivo: ref('archivo_id', 'archivo') },
  },
  destacada: {
    clave: ['titulo', 'creado_en'],
    refs: { portada_archivo: ref('portada_archivo_id', 'archivo', true) },
    activo: (r) => r.archivada === false,
  },
  destacada_foto: {
    clave: ['destacada', 'archivo'],
    refs: { destacada: ref('destacada_id', 'destacada'), archivo: ref('archivo_id', 'archivo') },
  },
  respuesta_rapida: { clave: ['titulo'], activo: activoCampo },
  // Sin activo: sale toda la tabla, también las ocultas (visible viaja y el upsert lo conserva)
  resena_google: { clave: ['google_review_id'] },
  version_carta: {
    clave: ['estado', 'publicada_en'],
    omitir: ['publicada_por'],
    activo: (r, ctx) => r.estado === 'PUBLICADA' && String(r.id) === ctx.ultimaPublicada,
  },
};
