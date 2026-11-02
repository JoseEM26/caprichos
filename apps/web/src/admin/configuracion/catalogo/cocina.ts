import type { EntradaConfig } from './tipos';

/** Pestaña «Cocina» (TarjetaConfirmarDespejarConfiguracion). Verificado contra cocina/comandas.service.ts y configuracion.service.ts. */
const SEC = 'Confirmar al despejar';

export const COCINA: EntradaConfig[] = [
  { id: 'cocina-confirmar-despejar', tab: 'cocina', seccion: SEC, titulo: 'Confirmar al despejar comandas', descripcion: 'Encendido, despejar un pedido en cocina pide confirmar con Sí o No. Apagado, un toque despeja la comanda directo. Solo el administrador lo cambia y queda auditado.', ejemplo: 'Apagado: el cocinero toca Despejar y la comanda sale de la pantalla sin preguntar.', clave: 'cocina_confirmar_despejar', palabras: ['cocina', 'despejar', 'confirmar', 'comanda', 'si no', 'toque directo', 'deshacer', 'sin preguntar'], permiso: 'ADMIN', peligro: 'bajo', efecto: 'Cambia solo la pantalla de cocina: el pedido sigue el mismo flujo y «Deshacer» sigue disponible.', rango: 'Sí o No', porDefecto: 'Sí (encendido si no existe)' },
  { id: 'cocina-minutos-preparacion-defecto', tab: 'cocina', seccion: 'Tiempo estimado', titulo: 'Minutos de preparación por defecto', descripcion: 'Minutos que se usan para «Listo en ~N min» de un producto que no tiene datos de los últimos 30 días. Con datos, cada producto usa su promedio real.', ejemplo: 'Con 15: un producto nuevo sin pedidos previos dirá que está listo en unos 15 minutos.', clave: 'cocina_minutos_preparacion_defecto', palabras: ['cocina', 'tiempo', 'estimado', 'minutos', 'preparacion', 'listo en', 'defecto', 'demora'], permiso: 'ADMIN', peligro: 'bajo', efecto: 'Cambia solo el tiempo estimado que ve el mozo. No cambia el flujo de cocina.', unidad: 'minutos', rango: 'Entero de 1 a 120', porDefecto: '10 minutos' },
];
