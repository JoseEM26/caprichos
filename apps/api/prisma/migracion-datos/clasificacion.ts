/**
 * Clasificación de TODAS las tablas del esquema para la MIGRACIÓN DE DATOS DE LA EMPRESA
 * (demo -> producción). Lo que está en MIGRAR es configuración y contenido de la empresa, y
 * solo se exporta lo activo. Lo que está en NO_MIGRAR nunca sale de la base de origen.
 *
 * Cada tabla del esquema debe estar en exactamente un grupo (lo verifica la prueba jest).
 * El orden de MIGRAR es de dependencias: padres antes que hijos (así importa el paquete).
 * Detalle de claves naturales y filtros: especificacion.ts.
 */

/** Tablas que se migran, en orden de dependencias. */
export const MIGRAR: string[] = [
  // Parámetros y catálogos base
  'parametro', 'regla_acumulacion', 'rol', 'permiso', 'rol_permiso',
  'lista', 'lista_valor', 'horario_dia', 'fecha_especial', 'area_cocina', 'categoria',
  // Archivos públicos (fotos) y local
  'archivo', 'foto_local', 'lugar_stock',
  // Personal y proveedores (solo cuentas de sistema activas, horarios, reemplazos, proveedores activos)
  'party', 'party_identifier', 'person', 'user_account', 'party_role', 'employee_detail',
  'organization', 'supplier_detail', 'horario_trabajo', 'reemplazo_dia', 'cobertura_turno',
  // Carta
  'producto', 'producto_tamano', 'grupo_opciones', 'opcion', 'producto_grupo', 'sabor',
  // Reparto y plano de mesas
  'zona_reparto', 'piso', 'elemento_plano',
  // Ofertas, combos y cupones fijos
  'oferta', 'combo_precio', 'combo_parte', 'combo_parte_reemplazo', 'cupon',
  // Recetas e insumos (catálogo, sin stock ni movimientos)
  'insumo', 'receta', 'receta_linea', 'ajuste_opcion',
  // Contenido de la carta y de la web
  'novedad', 'novedad_foto', 'destacada', 'destacada_foto', 'respuesta_rapida', 'version_carta',
];

/** Tablas que NO se migran, agrupadas por motivo. */
const NO_MIGRAR_POR_MOTIVO: Array<[string, string[]]> = [
  ['transacciones de venta: pedidos, cobros, comprobantes y reclamos', [
    'pedido', 'pedido_linea', 'pedido_linea_opcion', 'pedido_estado_historial', 'secuencia_pedido',
    'pedido_mesa', 'comprobante', 'secuencia_comprobante', 'reclamo', 'comanda_area', 'mensaje_reparto',
    'incidente_entrega', 'pedido_pago_plan', 'voucher_pago',
  ]],
  ['caja y cierres: dinero real del día', [
    'caja', 'cobro', 'cobro_pago', 'movimiento_caja', 'liquidacion', 'cierre_caja', 'conteo_cierre',
    'cierre_medio', 'cierre_dia', 'consumo_personal',
  ]],
  ['clientes: cuentas, puntos, direcciones y consentimientos', [
    'customer_account', 'customer_detail', 'consent', 'contact_mechanism', 'cliente_direccion',
    'movimiento_puntos', 'cupon_emitido', 'cupon_canje_compartido', 'cliente_whatsapp_consentimiento',
    'data_request', 'encuesta', 'encuesta_posventa', 'ranking_mes',
  ]],
  ['reservas y solicitudes operativas', [
    'reserva', 'reserva_mesa', 'solicitud_reserva', 'solicitud_cambio', 'agotado', 'alta_demanda',
  ]],
  ['bot, WhatsApp y mensajes: conversaciones, historial y salientes', [
    'conversacion', 'mensaje_chat', 'whatsapp_mensaje', 'saliente_whatsapp', 'queja_whatsapp',
    'notificacion', 'mensaje_carta', 'ia_consumo', 'uso_externo',
  ]],
  ['stock y compras: saldos, movimientos y pedidos a proveedores', [
    'stock', 'movimiento_stock', 'pedido_proveedor', 'pedido_proveedor_linea', 'compra', 'compra_linea',
    'traslado', 'pedido_interno', 'produccion',
  ]],
  ['seguridad y llaves: secretos, llaves de dispositivos y colas de impresión', [
    'supervisor_secreto', 'device_key', 'print_job', 'sesion',
  ]],
  ['reseñas de Google: se vuelven a traer de la API en cada ambiente (con su propio negocio y cupo)', [
    'resena_google',
  ]],
  ['lectura de notificaciones por persona: cada usuario tiene su propio estado, no se migra', [
    'notificacion_lectura',
  ]],
  ['trazas y control técnico', [
    'auditoria', 'sys_control', 'iniciativa', 'iniciativa_comentario',
  ]],
];

export const NO_MIGRAR: Record<string, string> = Object.fromEntries(
  NO_MIGRAR_POR_MOTIVO.flatMap(([motivo, tablas]) => tablas.map((t) => [t, motivo] as const)),
);

/** Tablas que jamás pueden estar en MIGRAR (la prueba jest lo verifica). */
export const TABLAS_SENSIBLES: string[] = [
  'sesion', 'supervisor_secreto', 'device_key', 'print_job', 'auditoria', 'voucher_pago',
  'comprobante', 'secuencia_comprobante', 'customer_account', 'customer_detail', 'consent',
  'contact_mechanism', 'cliente_direccion', 'conversacion', 'mensaje_chat', 'whatsapp_mensaje',
  'saliente_whatsapp', 'notificacion', 'cobro', 'caja', 'cierre_caja', 'pedido', 'reserva',
  'reclamo', 'encuesta', 'stock', 'movimiento_stock', 'ia_consumo', 'data_request',
];

/** Columnas que NUNCA se exportan, en ninguna tabla (contraseñas, hashes, PIN). */
export const COLUMNAS_SECRETAS: string[] = ['hash', 'pin_hash', 'secreto_cifrado', 'iv', 'tag', 'device_key'];

/**
 * Filas de `parametro` que no se migran: cachés y contadores de la operación, avisos de consumo,
 * borradores sin publicar y el marcador de entorno (cada base lleva el suyo).
 */
export function parametroMigrable(clave: string): boolean {
  if (clave === 'entorno') return false;
  if (/^resenas_/.test(clave)) return false; // negocio, cupo y fechas de las reseñas: cada ambiente los suyos
  if (/^wa_media:/.test(clave)) return false;
  if (/^wa_aviso_consumo:/.test(clave)) return false;
  if (/_borrador$/.test(clave)) return false;
  if (/contador|_cache$|^cache_/.test(clave)) return false;
  return true;
}
