/** Roles que el servidor acepta (sin BARRA, que no existe en el catálogo del servidor). */
export const ROLES_ASIGNABLES: string[] = [
  'ADMIN',
  'CAJERO',
  'MOZO',
  'COCINA',
  'ALMACEN',
  'REPARTIDOR',
  'SUPERVISOR',
  'APOYO_DELIVERY',
];

/** Qué podrá hacer quien reciba el rol (espejo en lenguaje llano de MATRIZ del servidor). */
export const VISTA_PREVIA_ROL: Record<string, string[]> = {
  APOYO_DELIVERY: [
    'Ver el módulo Delivery y seguir qué entrega cada repartidor',
    'Tomar pedidos y rutas de reparto',
    'Salir, llegar y entregar los pedidos que tomó',
    'Reportar incidencias, chatear con el cliente y proponer ubicación o cambio de cobro',
    'No liquida efectivo ni reasigna repartidores (eso sigue en Caja y Administración)',
  ],
  CAJERO: ['Ventas y cobros en caja', 'Pedidos, comprobantes y mesas', 'Mensajes de WhatsApp'],
  MOZO: ['Mesas y pedidos del salón', 'Reservas', 'Mensajes de WhatsApp'],
  COCINA: ['Comandas y preparación', 'Stock y recetas de cocina'],
  ALMACEN: ['Almacén, stock y compras'],
  SUPERVISOR: ['Todo lo de Cajero y Mozo', 'Ve el código de supervisor', 'Escritorio operativo sin montos'],
};

/** Estos roles no se combinan con ningún otro (espejo de las reglas del servidor). */
export const ROLES_EXCLUSIVOS = ['ADMIN', 'REPARTIDOR'];

export const TIPOS_DOCUMENTO: Array<{ valor: string; etiqueta: string }> = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'CE', etiqueta: 'Carné de extranjería (CE)' },
  { valor: 'CEDULA', etiqueta: 'Cédula' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
];

/** DNI: 8 dígitos. Resto: de 7 a 12 letras o números. */
export function documentoValido(tipo: string, numero: string): boolean {
  if (tipo === 'DNI') return /^\d{8}$/.test(numero);
  return /^[A-Za-z0-9]{7,12}$/.test(numero);
}

export function mensajeDocumento(tipo: string): string {
  return tipo === 'DNI'
    ? 'El DNI debe tener exactamente 8 dígitos numéricos'
    : 'El documento debe tener de 7 a 12 letras o números';
}

/** Mensaje si la combinación no es válida; null si lo es. Principal y extra juntos. */
export function errorCombinacionRoles(principal: string, extras: string[]): string | null {
  const todos = [principal, ...extras].filter(Boolean);
  if (new Set(todos).size !== todos.length) return 'Un rol no puede repetirse.';
  if (todos.length > 1) {
    const exclusivo = ROLES_EXCLUSIVOS.find((r) => todos.includes(r));
    if (exclusivo) return `${exclusivo} no se combina con otros roles. Quita los otros roles o deja solo ${exclusivo}.`;
  }
  return null;
}

/** Nombre que se muestra por rol. */
export const ETIQUETAS_ROLES: Record<string, string> = {
  ADMIN: 'Administrador (Control total)',
  CAJERO: 'Cajero/a (Ventas y cobros)',
  MOZO: 'Mozo (Mesas y pedidos salón)',
  COCINA: 'Cocina (Comandas y preparación)',
  BARRA: 'Barra (Bebidas y postres)',
  REPARTIDOR: 'Repartidor (Delivery)',
  // Rol eliminado: solo para mostrar el nombre en historiales antiguos
  CALLCENTER: 'Call Center (rol eliminado)',
  ALMACEN: 'Almacén (Stock y compras)',
  SUPERVISOR: 'Supervisor (Caja y salón, sin administración)',
  APOYO_DELIVERY: 'Apoyo en delivery (Toma y entrega pedidos)',
};
