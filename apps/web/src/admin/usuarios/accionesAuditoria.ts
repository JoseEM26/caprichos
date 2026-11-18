/** Etiquetas en español de los códigos de acción de auditoría (el código queda solo como valor). */
const ETIQUETAS: Record<string, string> = {
  CREAR_PRODUCTO: 'Crear producto',
  EDITAR_PRODUCTO: 'Editar producto',
  OCULTAR_PRODUCTO: 'Desactivar producto',
  MOSTRAR_PRODUCTO: 'Activar producto',
  AGOTAR_PRODUCTO: 'Agotar producto',
  DISPONIBILIZAR_PRODUCTO: 'Quitar agotado de producto',
  REACTIVADO_AUTOMATICO: 'Reactivado automáticamente',
  ORDENAR_PREGUNTAS_PRODUCTO: 'Ordenar preguntas de producto',
  ASOCIAR_FOTO_PRODUCTO: 'Cambiar foto de producto',
  CAMBIAR_STOCK_OPCION: 'Cambiar stock de opción',
  AGOTAR_OPCION: 'Agotar opción',
  DISPONIBILIZAR_OPCION: 'Quitar agotado de opción',
  OCULTAR_OPCION: 'Desactivar opción',
  MOSTRAR_OPCION: 'Activar opción',
  CREAR_CATEGORIA: 'Crear categoría',
  ABRIR_CAJA: 'Abrir caja',
  CERRAR_CAJA: 'Cerrar caja',
  REGISTRAR_APERTURA: 'Apertura del día',
  EDITAR_CATEGORIA: 'Editar categoría',
  OCULTAR_CATEGORIA: 'Desactivar categoría',
  MOSTRAR_CATEGORIA: 'Activar categoría',
};

/** Nombre amigable de una acción; si no está en la tabla, el código en minúsculas sin guiones bajos. */
export function etiquetaAccion(codigo: string): string {
  if (ETIQUETAS[codigo]) return ETIQUETAS[codigo];
  const texto = codigo.toLowerCase().replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Atajos de catálogo: cada uno aplica modulo=catalogo y accion=(códigos separados por coma). */
export const ATAJOS_CATALOGO: Array<{ id: string; etiqueta: string; acciones: string[] }> = [
  { id: 'desactivar', etiqueta: 'Desactivaron un producto', acciones: ['OCULTAR_PRODUCTO'] },
  { id: 'agotar', etiqueta: 'Agotaron un producto', acciones: ['AGOTAR_PRODUCTO'] },
  { id: 'activar', etiqueta: 'Activaron un producto', acciones: ['MOSTRAR_PRODUCTO', 'DISPONIBILIZAR_PRODUCTO'] },
  { id: 'editar', etiqueta: 'Cambios de precio/edición', acciones: ['EDITAR_PRODUCTO'] },
  { id: 'crear', etiqueta: 'Creaciones', acciones: ['CREAR_PRODUCTO'] },
];

/** «lun 16 nov, 14:32» en la hora de Lima. */
export function fechaLegible(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}
