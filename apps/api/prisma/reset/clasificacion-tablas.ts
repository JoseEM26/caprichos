/**
 * Clasificación de TODAS las tablas del esquema para el SANEAMIENTO DE CLIENTES / DNI.
 * No es un borrado general: solo se quitan las cuentas de clientes y se anonimizan los DNI
 * que quedan en tablas que se conservan (fuga de datos de clientes).
 *
 *  - BORRAR_CUENTAS: filas que cuelgan de parties CLIENTE (sin cuenta de sistema). Se borran
 *    filtradas por SQL_CLIENTES; el personal nunca entra.
 *  - ANONIMIZAR: la fila se conserva; se vacían columnas con DNI de cliente o se desvincula
 *    (NULL) la FK al cliente borrado. El pedido queda como venta histórica de un invitado.
 *  - CONSERVAR: todo lo demás (recetas, almacén, carta, bot y su historial, caja, personal...).
 *
 * Cada tabla del esquema debe estar en exactamente un grupo (lo verifica la prueba jest).
 * Limitación: auditoria es inmutable por trigger (no se puede UPDATE); si su JSON guarda un
 * DNI, no se toca. Los RUC de 11 dígitos (empresas) no se anonimizan.
 */

/** Orden de borrado (hijas antes que party). */
export const BORRAR_CUENTAS: string[] = [
  // Marca por celular (bienvenida a los puntos): dato personal, se borra con las cuentas de cliente
  'aviso_cliente_unico',
  'movimiento_puntos', 'cliente_direccion', 'data_request', 'customer_detail', 'party_role',
  'party_identifier', 'person', 'contact_mechanism', 'consent', 'customer_account', 'sesion',
  'party',
];

/**
 * Parties que son CLIENTES: sin user_account (el personal sí lo tiene) y, por prudencia, sin ser
 * organización/proveedor/trabajador ni figurar en horarios del personal.
 */
export const SQL_CLIENTES = `SELECT p."id" FROM "party" p
  WHERE NOT EXISTS (SELECT 1 FROM "user_account" u WHERE u."party_id" = p."id")
    AND NOT EXISTS (SELECT 1 FROM "organization" o WHERE o."party_id" = p."id")
    AND NOT EXISTS (SELECT 1 FROM "party_role" r WHERE r."party_id" = p."id" AND r."rol" IN ('TRABAJADOR', 'PROVEEDOR'))
    AND NOT EXISTS (SELECT 1 FROM "horario_trabajo" h WHERE h."party_id" = p."id")
    AND NOT EXISTS (SELECT 1 FROM "cobertura_turno" c WHERE c."cubre_party_id" = p."id" OR c."reemplaza_party_id" = p."id")`;

export function sqlDonde(tabla: string): string {
  if (tabla === 'customer_detail') {
    return `"party_role_id" IN (SELECT "id" FROM "party_role" WHERE "party_id" IN (${SQL_CLIENTES}))`;
  }
  if (tabla === 'party') return `"id" IN (${SQL_CLIENTES})`;
  return `"party_id" IN (${SQL_CLIENTES})`;
}

export interface ReglaAnonimizar {
  /** columna -> valor SQL con que se reemplaza ('NULL' o `''` si la columna es NOT NULL) */
  columnas: Record<string, string>;
  /** condición SQL sobre la fila actual */
  donde: string;
  motivo: string;
}

const DNI = "'^[0-9]{8}$'";
const EN_CLIENTES = (col: string) => `"${col}" IN (${SQL_CLIENTES})`;

export const ANONIMIZAR: Record<string, ReglaAnonimizar[]> = {
  pedido: [
    { columnas: { comprobante_doc: 'NULL', comprobante_razon: 'NULL' }, donde: `"comprobante_doc" ~ ${DNI}`, motivo: 'DNI en el comprobante (el RUC de 11 dígitos se conserva)' },
    { columnas: { party_id: 'NULL' }, donde: EN_CLIENTES('party_id'), motivo: 'cliente borrado -> invitado' },
    { columnas: { cliente_party_id: 'NULL' }, donde: EN_CLIENTES('cliente_party_id'), motivo: 'cliente borrado -> invitado' },
  ],
  comprobante: [
    { columnas: { documento: 'NULL', razon_social: 'NULL' }, donde: `"documento" ~ ${DNI}`, motivo: 'DNI del receptor' },
  ],
  reclamo: [
    { columnas: { documento: "''" }, donde: `"documento" <> '' AND "documento" !~ '^[0-9]{11}$'`, motivo: 'documento del consumidor (columna obligatoria: se vacía)' },
  ],
  conversacion: [
    { columnas: { party_id: 'NULL' }, donde: EN_CLIENTES('party_id'), motivo: 'desvincular cliente; el teléfono y el historial se conservan' },
  ],
  notificacion: [
    { columnas: { party_destino: 'NULL' }, donde: EN_CLIENTES('party_destino'), motivo: 'desvincular cliente' },
  ],
  cupon_canje_compartido: [
    { columnas: { party_id: 'NULL' }, donde: EN_CLIENTES('party_id'), motivo: 'desvincular cliente' },
  ],
};

export const CONSERVAR: string[] = [
  'agotado', 'ajuste_opcion', 'alta_demanda', 'archivo', 'area_cocina', 'auditoria', 'caja',
  'categoria', 'cierre_ajuste_medio', 'cierre_caja', 'cortesia', 'devolucion_pedido', 'pedido_cambio_ubicacion', 'solicitud_cambio_cobro', 'cierre_dia', 'cierre_medio', 'cliente_whatsapp_consentimiento',
  'asistencia_marca', 'asistencia_selfie', 'asistencia_dispositivo', 'asistencia_consentimiento',
  'propina_reparto', 'propina_reparto_detalle',
  'cobertura_turno', 'cobro', 'cobro_pago', 'comanda_area', 'combo_parte', 'combo_parte_reemplazo', 'combo_precio', 'opcion_requiere',
  'compra', 'compra_linea', 'consumo_personal', 'contador_diario', 'conteo_apertura', 'conteo_cierre', 'cupon', 'cupon_emitido',
  'destacada', 'destacada_foto', 'device_key', 'elemento_plano', 'employee_detail', 'encuesta', 'equipo_impresion_config',
  'encuesta_posventa', 'fecha_especial', 'foto_local', 'grupo_opciones', 'horario_dia',
  'horario_trabajo', 'ia_consumo', 'incidente_entrega', 'incidente_entrega_foto', 'iniciativa', 'iniciativa_comentario',
  'insumo', 'liquidacion', 'lista', 'lista_valor', 'lugar_stock', 'mensaje_carta', 'mensaje_chat',
  'mensaje_reparto', 'movimiento_caja', 'movimiento_stock', 'notificacion_lectura', 'novedad', 'novedad_foto', 'oferta',
  'opcion', 'organization', 'parametro', 'pedido_estado_historial', 'pedido_interno',
  'pedido_linea', 'pedido_linea_opcion', 'pedido_linea_sabor', 'pedido_mesa', 'pedido_pago_plan', 'pedido_proveedor',
  'pedido_proveedor_linea', 'permiso', 'piso', 'print_job', 'produccion', 'producto',
  'producto_grupo', 'producto_tamano', 'queja_whatsapp', 'ranking_mes', 'receta', 'receta_linea',
  'regla_acumulacion', 'reemplazo_dia', 'resena_google', 'reserva', 'reserva_mesa', 'ruta_reparto', 'ubicacion_repartidor', 'respuesta_rapida', 'rol', 'rol_permiso',
  'sabor', 'saliente_whatsapp', 'secuencia_comprobante', 'secuencia_pedido', 'solicitud_cambio', 'comprobante_archivo', 'sunat_resumen',
  'solicitud_reserva', 'stock', 'stock_sabor', 'supervisor_secreto', 'supplier_detail', 'sys_control', 'traslado',
  'user_account', 'user_account_rol', 'user_account_rol_historial', 'user_account_area', 'user_account_permiso', 'preferencia_usuario', 'uso_externo', 'version_carta', 'voucher_pago', 'whatsapp_mensaje', 'correo_envio',
  'zona_reparto',
];

/** FK hacia party que se desvinculan (están en ANONIMIZAR) -> "tabla.columna" */
export const FK_PARTY_DESVINCULADAS = [
  'pedido.party_id', 'pedido.cliente_party_id', 'conversacion.party_id',
  'notificacion.party_destino', 'cupon_canje_compartido.party_id',
];

/** FK hacia party que apuntan solo a personal/organizaciones (excluidos por SQL_CLIENTES). */
export const FK_PARTY_PERSONAL = [
  'user_account.party_id', 'organization.party_id', 'horario_trabajo.party_id', 'preferencia_usuario.party_id',
  'cobertura_turno.cubre_party_id', 'cobertura_turno.reemplaza_party_id',
  'pedido.repartidor_party_id', 'ruta_reparto.repartidor_party_id', 'liquidacion.repartidor_party_id', 'comprobante.emitido_por',
  'reclamo.respondido_por', 'voucher_pago.reemplazado_por', 'pedido_proveedor.proveedor_party_id',
  'compra.proveedor_party_id', 'pedido_interno.avisado_party_id', 'consumo_personal.party_id',
  'reemplazo_dia.party_id', 'reemplazo_dia.reemplaza_party_id',
  'cierre_ajuste_medio.por_party_id', 'cierre_ajuste_medio.autorizado_por_party_id',
  'devolucion_pedido.por_party_id', 'devolucion_pedido.autorizado_por_party_id',
  'pedido_cambio_ubicacion.propuesto_por_party_id', 'pedido_cambio_ubicacion.resuelto_por_party_id',
  'pedido_cambio_ubicacion.ajuste_por_party_id',
  'solicitud_cambio_cobro.solicitado_por_party_id', 'solicitud_cambio_cobro.resuelto_por_party_id',
  'cortesia.dada_por_party_id', 'cortesia.autorizada_por_party_id',
  'asistencia_marca.party_id', 'asistencia_marca.por_party_id', 'asistencia_dispositivo.party_id', 'asistencia_consentimiento.party_id',
  'propina_reparto.calculado_por', 'propina_reparto.aprobado_por', 'propina_reparto.pagado_por', 'propina_reparto.anulado_por',
  'propina_reparto_detalle.party_id',
];

/**
 * Claves de Redis de cuentas de cliente. Hoy NO hay: la sesión del cliente es una cookie JWT
 * (cp_cliente) más la tabla sesion; no existe cache de sesiones ni de recuperación en Redis.
 * Si algún día se agregan, listarlas aquí (nunca prefijos generales como chatbot:*).
 */
export const PREFIJOS_REDIS: string[] = [];
