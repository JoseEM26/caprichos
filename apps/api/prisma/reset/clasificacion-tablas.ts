/**
 * Clasificación de TODAS las tablas del esquema para el reinicio de datos de PRUEBA.
 *
 * Cada tabla de schema.prisma está en exactamente un grupo (lo verifica la prueba
 * reset/__tests__/reiniciar-datos-prueba.spec.ts: si alguien agrega una tabla y no decide, falla).
 *
 *  - BORRAR: operación + clientes + auditoría + archivos privados. El valor dice CÓMO:
 *      TODO                  -> TRUNCATE de la tabla completa (reinicia sus identidades).
 *      SOLO_CLIENTES         -> DELETE solo de filas de parties CLIENTE (sin cuenta de sistema).
 *      SOLO_ARCHIVOS_NO_CATALOGO -> DELETE de archivos de pedidos/vouchers/chat/compras.
 *  - CONSERVAR: carta, configuración, almacén (catálogo), personal y permisos. No se toca.
 *  - REINICIAR_SECUENCIAS: correlativos que vuelven a 0/1 (ver nota tributaria abajo).
 *
 * DECISIÓN SOBRE CORRELATIVOS TRIBUTARIOS: en un entorno real los correlativos de comprobantes
 * (secuencia_comprobante) NO se reinician jamás. Aquí se reinician porque este script solo corre
 * en LOCAL y DEMO (la guarda de entorno lo impide en cualquier otro sitio).
 *
 * SIN CASCADE: el TRUNCATE de los BORRAR/TODO se hace en una sola sentencia y SIN CASCADE; la prueba
 * recorre las FK del esquema y demuestra que ninguna tabla CONSERVAR apunta a un BORRAR/TODO
 * (si alguna lo hiciera, Postgres abortaría y la transacción se revertiría).
 */

export type ModoBorrado = 'TODO' | 'SOLO_CLIENTES' | 'SOLO_ARCHIVOS_NO_CATALOGO';

const todo = (...tablas: string[]): Record<string, ModoBorrado> =>
  Object.fromEntries(tablas.map((t) => [t, 'TODO' as const]));

export const BORRAR: Record<string, ModoBorrado> = {
  // Pedidos y su ciclo
  ...todo(
    'pedido', 'pedido_linea', 'pedido_linea_opcion', 'pedido_estado_historial', 'pedido_mesa',
    'pedido_pago_plan', 'voucher_pago', 'comprobante', 'reclamo', 'comanda_area',
    'incidente_entrega', 'mensaje_reparto', 'consumo_personal', 'print_job',
  ),
  // Caja y cierres
  ...todo(
    'caja', 'cobro', 'cobro_pago', 'movimiento_caja', 'liquidacion', 'cierre_caja',
    'conteo_cierre', 'cierre_medio',
  ),
  // Estado operativo del día
  ...todo('agotado', 'alta_demanda', 'reserva', 'reserva_mesa', 'notificacion', 'ranking_mes'),
  // Chat, WhatsApp, encuestas, IA
  ...todo(
    'conversacion', 'mensaje_chat', 'whatsapp_mensaje', 'saliente_whatsapp',
    'cliente_whatsapp_consentimiento', 'solicitud_reserva', 'solicitud_cambio', 'encuesta',
    'encuesta_posventa', 'queja_whatsapp', 'ia_consumo', 'uso_externo',
  ),
  // Cupones emitidos, puntos y datos de clientes que cuelgan de ellos
  ...todo(
    'cupon_emitido', 'cupon_canje_compartido', 'movimiento_puntos', 'cliente_direccion',
    'data_request',
  ),
  // Almacén operativo (movimientos y existencias; el catálogo de insumos/recetas se conserva)
  ...todo(
    'movimiento_stock', 'stock', 'compra', 'compra_linea', 'pedido_proveedor',
    'pedido_proveedor_linea', 'traslado', 'pedido_interno', 'produccion', 'cierre_dia',
  ),
  // Auditoría (se vuelve a abrir con la fila REINICIO_DATOS_PRUEBA)
  ...todo('auditoria'),
  // Clientes: solo parties sin cuenta de sistema (el personal queda intacto)
  party: 'SOLO_CLIENTES',
  person: 'SOLO_CLIENTES',
  party_identifier: 'SOLO_CLIENTES',
  party_role: 'SOLO_CLIENTES',
  customer_detail: 'SOLO_CLIENTES',
  customer_account: 'SOLO_CLIENTES',
  consent: 'SOLO_CLIENTES',
  contact_mechanism: 'SOLO_CLIENTES',
  sesion: 'SOLO_CLIENTES',
  // Archivos subidos (vouchers, chat, incidentes, compras); catálogo/carta/banners se quedan
  archivo: 'SOLO_ARCHIVOS_NO_CATALOGO',
};

export const CONSERVAR: string[] = [
  // Acceso y personal
  'user_account', 'rol', 'permiso', 'rol_permiso', 'supervisor_secreto',
  'organization', 'supplier_detail', 'employee_detail', 'horario_trabajo', 'cobertura_turno',
  // Configuración y local
  'sys_control', 'parametro', 'lista', 'lista_valor', 'horario_dia', 'fecha_especial',
  'foto_local', 'piso', 'elemento_plano', 'zona_reparto', 'area_cocina', 'device_key',
  'respuesta_rapida',
  // Carta
  'categoria', 'producto', 'producto_tamano', 'grupo_opciones', 'opcion', 'producto_grupo',
  'sabor', 'version_carta', 'novedad', 'novedad_foto', 'destacada', 'destacada_foto',
  'mensaje_carta',
  // Ofertas plantilla
  'oferta', 'combo_precio', 'combo_parte', 'regla_acumulacion', 'cupon',
  // Almacén (catálogo)
  'lugar_stock', 'insumo', 'receta', 'receta_linea', 'ajuste_opcion',
  // Mejoras internas del equipo
  'iniciativa', 'iniciativa_comentario',
];

/** tabla -> cómo vuelve a cero (ver SQL en reiniciar-datos-prueba.ts) */
export const REINICIAR_SECUENCIAS: Record<string, string> = {
  secuencia_pedido: 'UPDATE "secuencia_pedido" SET "ultimo" = 0',
  secuencia_comprobante: 'UPDATE "secuencia_comprobante" SET "ultimo_numero" = 0',
};

/** Secuencias nativas de Postgres que vuelven a 1 (código de pedido). */
export const SECUENCIAS_PG = ['sec_pedido_codigo'];

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

/** Orden de borrado de las tablas SOLO_CLIENTES (hijas antes que party). */
export const ORDEN_CLIENTES = [
  'customer_detail', 'party_role', 'party_identifier', 'person', 'contact_mechanism', 'consent',
  'customer_account', 'sesion', 'party',
];

export function sqlBorradoClientes(tabla: string): string {
  if (tabla === 'customer_detail') {
    return `DELETE FROM "customer_detail" WHERE "party_role_id" IN (SELECT "id" FROM "party_role" WHERE "party_id" IN (${SQL_CLIENTES}))`;
  }
  if (tabla === 'party') return `DELETE FROM "party" WHERE "id" IN (${SQL_CLIENTES})`;
  return `DELETE FROM "${tabla}" WHERE "party_id" IN (${SQL_CLIENTES})`;
}

export function sqlConteoClientes(tabla: string): string {
  return sqlBorradoClientes(tabla).replace(/^DELETE FROM/, 'SELECT count(*)::int AS n FROM');
}

/** Tablas (tabla, columna) CONSERVAR que apuntan a archivo: esos archivos no se borran. */
export const ARCHIVO_REFS_CONSERVAR: Array<[string, string]> = [
  ['foto_local', 'archivo_id'],
  ['producto', 'foto_archivo_id'],
  ['iniciativa', 'archivo_id'],
  ['novedad_foto', 'archivo_id'],
  ['destacada', 'portada_archivo_id'],
  ['destacada_foto', 'archivo_id'],
  ['oferta', 'imagen_archivo_id'],
];

/** Tablas BORRAR cuyos archivos sí se borran (si ningún CONSERVAR los usa). */
export const ARCHIVO_REFS_OPERACION: Array<[string, string]> = [
  ['voucher_pago', 'archivo_id'],
  ['incidente_entrega', 'foto_archivo_id'],
  ['compra', 'archivo_id'],
];

/**
 * Archivos a borrar: privados (vouchers, chat, documentos) o usados por tablas de operación,
 * salvo los que use cualquier tabla CONSERVAR (incluida la foto de personal, sin FK).
 */
export const SQL_ARCHIVOS_A_BORRAR = `SELECT a."id", a."ruta" FROM "archivo" a
  WHERE (a."privado" = true OR ${ARCHIVO_REFS_OPERACION.map(([t, c]) => `a."id" IN (SELECT "${c}" FROM "${t}" WHERE "${c}" IS NOT NULL)`).join(' OR ')})
    ${ARCHIVO_REFS_CONSERVAR.map(([t, c]) => `AND NOT EXISTS (SELECT 1 FROM "${t}" x WHERE x."${c}" = a."id")`).join('\n    ')}
    AND NOT EXISTS (SELECT 1 FROM "person" x WHERE x."foto_archivo_id" = a."id" AND x."party_id" NOT IN (${SQL_CLIENTES}))`;

/** Tablas CONSERVAR que apuntan a party: justifican la guarda de SQL_CLIENTES. */
export const CONSERVAR_APUNTAN_A_PARTY = [
  'user_account', 'organization', 'horario_trabajo', 'cobertura_turno',
];

/** Prefijos de Redis de operación (no se tocan lock:*, auth:intentos:* ni claves ajenas). */
export const PREFIJOS_REDIS = ['bull:*', 'idemp:*', 'idempotente:*', 'idempotencia:*', 'chatbot:*'];
