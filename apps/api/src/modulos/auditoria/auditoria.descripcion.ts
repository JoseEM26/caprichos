/**
 * Frase en español que resume un registro de auditoría: qué se hizo y sobre qué.
 * Función pura (sin base de datos): el servicio le pasa el nombre ya resuelto.
 */

export interface DatosDescripcion {
  accion: string;
  entidad: string | null;
  antes?: unknown;
  despues?: unknown;
  motivo?: string | null;
  /** Nombre real de la entidad (resuelto por el servicio o tomado del snapshot). */
  entidadNombre?: string | null;
  /** Momento del registro: decide si el agotado dice «las 18:00» o «el 16 nov, 18:00». */
  en?: Date | string | null;
}

interface InfoEntidad {
  tipo: string;
  femenino: boolean;
}

/** Entidades que tienen nombre legible. Las demás no se describen por nombre. */
export const TIPO_ENTIDAD: Record<string, InfoEntidad> = {
  producto: { tipo: 'producto', femenino: false },
  categoria: { tipo: 'categoría', femenino: true },
  opcion: { tipo: 'opción', femenino: true },
  grupo_opciones: { tipo: 'grupo de opciones', femenino: false },
  lista: { tipo: 'lista', femenino: true },
  lista_valor: { tipo: 'valor de lista', femenino: false },
  sabor: { tipo: 'sabor', femenino: false },
};

const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: 'nombre',
  precio: 'precio',
  precioExtra: 'precio extra',
  oculto: 'oculto',
  porciones: 'porciones',
  alergenos: 'alérgenos',
  alergenosConfirmados: 'alérgenos confirmados',
  activo: 'activo',
  resaltarSiempre: 'resaltar siempre',
  obligatorio: 'obligatorio',
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const money = (v: unknown) => `S/ ${Number(v).toFixed(2)}`;

/** Nombre que ya trae el registro en antes/después (el que tenía al momento del cambio). */
export function nombreSnapshot(antes: unknown, despues: unknown): string | null {
  return texto(obj(despues).nombre) ?? texto(obj(antes).nombre);
}

const fechaLima = (d: Date, opciones: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    ...opciones,
  }).format(d);
const diaLima = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

/** «hasta las 18:00» (mismo día) o «hasta el 17 nov, 09:00»; vacío si no tiene hora de regreso (9999). */
function cuandoAgotado(hasta: unknown, en: Date | null): string {
  if (typeof hasta !== 'string') return '';
  const d = new Date(hasta);
  if (isNaN(d.getTime()) || d.getUTCFullYear() >= 9999) return '';
  const hora = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
  if (en && diaLima(en) === diaLima(d)) return `hasta las ${fechaLima(d, hora)}`;
  return `hasta el ${fechaLima(d, { day: 'numeric', month: 'short', ...hora })}`;
}

/** «el producto «X»», «la opción «X»», «un producto» (sin nombre). Vacío si la entidad no se describe. */
function sujeto(d: DatosDescripcion): string {
  const info = d.entidad ? TIPO_ENTIDAD[d.entidad] : undefined;
  if (!info) return '';
  const nombre = d.entidadNombre || nombreSnapshot(d.antes, d.despues);
  if (nombre) return `${info.femenino ? 'la' : 'el'} ${info.tipo} «${nombre}»`;
  return `${info.femenino ? 'una' : 'un'} ${info.tipo}`;
}

/** Para frases con «de»: ««X»» si hay nombre, o «un producto» si no. */
function deRef(d: DatosDescripcion): string {
  const nombre = d.entidadNombre || nombreSnapshot(d.antes, d.despues);
  return nombre ? `«${nombre}»` : sujeto(d);
}

const con = (verbo: string, d: DatosDescripcion, extra = '') => [verbo, sujeto(d)].filter(Boolean).join(' ') + extra;

const fmtCampo = (campo: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'vacío';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'ninguno';
  if (/precio/i.test(campo) && typeof v === 'number') return money(v);
  return String(v);
};

/** Edición: lista los campos que cambiaron y, si son cortos, el valor anterior → nuevo. */
function editar(d: DatosDescripcion): string {
  const a = obj(d.antes);
  const b = obj(d.despues);
  const campos = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (!campos.length) return [con('Guardó', d), 'sin cambios'].filter(Boolean).join(' ');
  if (campos.length === 1 && campos[0] === 'precio') {
    return `Cambió el precio de ${deRef(d)} de ${fmtCampo('precio', a.precio)} a ${fmtCampo('precio', b.precio)}`;
  }
  const partes = campos.map((c) => {
    const etiqueta = ETIQUETA_CAMPO[c] ?? c.replace(/([A-Z])/g, ' $1').toLowerCase();
    const antes = fmtCampo(c, a[c]);
    const despues = fmtCampo(c, b[c]);
    return antes.length + despues.length <= 60 ? `${etiqueta} (${antes} → ${despues})` : etiqueta;
  });
  return `${con('Editó', d)}: ${partes.join(', ')}`;
}

/** Nombre en español de cada módulo de auditoría; el que no está en la tabla se muestra con su código capitalizado. */
export const NOMBRE_MODULO: Record<string, string> = {
  acceso: 'Acceso',
  almacen: 'Almacén',
  asistencia: 'Asistencia',
  auditoria: 'Auditoría',
  auth: 'Ingreso',
  caja: 'Caja',
  catalogo: 'Catálogo',
  cierre: 'Cierre',
  clientes: 'Clientes',
  cocina: 'Cocina',
  comprobantes: 'Comprobantes',
  compras: 'Compras',
  configuracion: 'Configuración',
  cortesias: 'Cortesías',
  cupones: 'Cupones',
  creditos: 'Créditos',
  impresion: 'Impresión',
  iniciativas: 'Iniciativas',
  local: 'Local',
  mensajes: 'Mensajes',
  mesas: 'Mesas',
  ofertas: 'Ofertas',
  pagos_online: 'Pagos en línea',
  pedidos: 'Pedidos',
  planilla: 'Planilla',
  reclamos: 'Reclamos',
  repartos: 'Repartos',
  reservas: 'Reservas',
  salon: 'Salón',
  stock: 'Stock',
  usuarios: 'Usuarios',
  vouchers: 'Vouchers',
  zonas: 'Zonas',
};

/** «Caja», «Almacén»… o, si no está en la tabla, el código técnico en minúsculas con la primera letra en mayúscula. */
export function nombreModulo(codigo: string): string {
  if (NOMBRE_MODULO[codigo]) return NOMBRE_MODULO[codigo];
  const texto = codigo.replace(/_/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const FRASES: Record<string, (d: DatosDescripcion) => string> = {
  CREAR_PRODUCTO: (d) => con('Creó', d, d.despues && obj(d.despues).precio != null ? ` (${money(obj(d.despues).precio)})` : ''),
  EDITAR_PRODUCTO: editar,
  EDITAR_CATEGORIA: editar,
  EDITAR_OPCION: editar,
  EDITAR_GRUPO_OPCIONES: editar,
  EDITAR_LISTA: editar,
  EDITAR_VALOR_LISTA: editar,
  AGOTAR_PRODUCTO: (d) => {
    const motivo = texto(obj(d.despues).motivo) ?? texto(d.motivo);
    const cuando = cuandoAgotado(obj(d.despues).agotado_hasta, d.en ? new Date(d.en) : null);
    return con('Marcó agotado', d, (cuando ? ` ${cuando}` : '') + (motivo ? ` (motivo: ${motivo})` : ''));
  },
  AGOTAR_OPCION: (d) => {
    const cuando = cuandoAgotado(obj(d.despues).agotado_hasta, d.en ? new Date(d.en) : null);
    return con('Marcó agotado', d, cuando ? ` ${cuando}` : '');
  },
  DISPONIBILIZAR_PRODUCTO: (d) => con('Marcó disponible', d),
  DISPONIBILIZAR_OPCION: (d) => con('Marcó disponible', d),
  REACTIVADO_AUTOMATICO: (d) => con('Se marcó disponible solo', d, ' (venció el agotado)'),
  OCULTAR_PRODUCTO: (d) => con('Desactivó (ocultó)', d),
  MOSTRAR_PRODUCTO: (d) => con('Volvió a activar', d),
  OCULTAR_OPCION: (d) => con('Desactivó (ocultó)', d),
  MOSTRAR_OPCION: (d) => con('Volvió a activar', d),
  OCULTAR_CATEGORIA: (d) => con('Desactivó (ocultó)', d),
  MOSTRAR_CATEGORIA: (d) => con('Volvió a activar', d),
  ORDENAR_PREGUNTAS_PRODUCTO: (d) => `Reordenó las preguntas de ${deRef(d)}`,
  ASOCIAR_FOTO_PRODUCTO: (d) => (obj(d.despues).foto_archivo_id ? `Cambió la foto de ${deRef(d)}` : `Quitó la foto de ${deRef(d)}`),
  CAMBIAR_STOCK_OPCION: (d) => `Cambió el stock de ${deRef(d)}`,
  CREAR_CATEGORIA: (d) => con('Creó', d),
  CREAR_LISTA: (d) => con('Creó', d),
  CREAR_OPCION: (d) => con('Creó', d),
  CREAR_GRUPO_OPCIONES: (d) => con('Creó', d),
  AGREGAR_VALOR_LISTA: (d) => con('Agregó', d),
  ACTIVAR_VALOR_LISTA: (d) => con('Volvió a activar', d),
  DESACTIVAR_VALOR_LISTA: (d) => con('Desactivó', d),
  ASIGNAR_GRUPO_CATEGORIAS: (d) => `Asignó categorías a ${deRef(d)}`,
  ABRIR_CAJA: (d) => {
    const o = obj(d.despues);
    const monto = o.apertura != null ? ` con ${money(o.apertura)}` : '';
    return `Abrió la caja${monto}` + (o.distintoDelOficial ? ' (distinto del monto oficial)' : '');
  },
  REGISTRAR_APERTURA: (d) => {
    const o = obj(d.despues);
    const productos = Number(o.productos) || 0;
    const mermas = Array.isArray(o.mermas) ? o.mermas.length : 0;
    const separadas = unidadesSeparadas(o.separadosProgramados);
    return (
      `Hizo la apertura del día: ${productos} ${productos === 1 ? 'producto contado' : 'productos contados'}` +
      (mermas ? `, ${mermas} con merma` : '') +
      (separadas > 0 ? `; ${separadas} ${separadas === 1 ? 'unidad separada' : 'unidades separadas'} para pedidos programados` : '')
    );
  },
  SEPARAR_STOCK_PROGRAMADO: (d) => `Separó ${listaSeparada(obj(d.despues).productos)} para el pedido ${texto(obj(d.despues).pedido) ?? 'programado'}${cuandoProgramado(obj(d.despues).programadoPara)}`,
  DEVOLVER_STOCK_PROGRAMADO: (d) => `Devolvió el stock separado (${listaSeparada(obj(d.despues).productos)}) del pedido ${texto(obj(d.despues).pedido) ?? ''}${cuandoProgramado(obj(d.despues).programadoPara)}`,
};

/** Unidades separadas para pedidos programados que trae la apertura (`separadosProgramados`: [{ unidades }]). */
function unidadesSeparadas(v: unknown): number {
  return Array.isArray(v) ? v.reduce((a, x) => a + (Number(obj(x).unidades) || 0), 0) : 0;
}

/** «3 de Dona de chocolate, 2 de Galleta (Avena)» a partir de [{ producto, sabor, cantidad }]. */
function listaSeparada(v: unknown): string {
  const items = (Array.isArray(v) ? v : []).map((x) => {
    const o = obj(x);
    const nombre = texto(o.producto) ?? 'producto';
    const sabor = texto(o.sabor);
    return `${Number(o.cantidad) || 0} de ${sabor ? `${nombre} (${sabor})` : nombre}`;
  });
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : (items[0] ?? 'productos');
}

/** « (programado para el 20/11 10:00)» o vacío si no hay fecha. */
function cuandoProgramado(v: unknown): string {
  const f = typeof v === 'string' ? new Date(v) : null;
  if (!f || isNaN(f.getTime())) return '';
  return ` (programado para el ${fechaLima(f, { day: '2-digit', month: '2-digit' })} ${fechaLima(f, { hour: '2-digit', minute: '2-digit', hour12: false })})`;
}

/** Respaldo legible para acciones sin frase propia: «Anular venta (motivo: …)». */
function generica(d: DatosDescripcion): string {
  const t = d.accion.toLowerCase().replace(/_/g, ' ').trim();
  const frase = t.charAt(0).toUpperCase() + t.slice(1);
  const motivo = texto(d.motivo);
  return [frase, sujeto(d)].filter(Boolean).join(' ') + (motivo ? ` (motivo: ${motivo})` : '');
}

export function describirRegistro(d: DatosDescripcion): string {
  const frase = FRASES[d.accion];
  return frase ? frase(d) : generica(d);
}
