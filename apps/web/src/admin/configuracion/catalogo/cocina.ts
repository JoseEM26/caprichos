import type { EntradaConfig } from './tipos';

/** Pestaña «Cocina» (TarjetaConfirmarDespejarConfiguracion). Verificado contra cocina/comandas.service.ts y configuracion.service.ts. */
const SEC = 'Confirmar al despejar';

export const COCINA: EntradaConfig[] = [
  { id: 'cocina-confirmar-despejar', tab: 'cocina', seccion: SEC, titulo: 'Confirmar al despejar comandas', descripcion: 'Encendido, despejar un pedido en cocina pide confirmar con Sí o No. Apagado, un toque despeja la comanda directo. Solo el administrador lo cambia y queda auditado.', ejemplo: 'Apagado: el cocinero toca Despejar y la comanda sale de la pantalla sin preguntar.', clave: 'cocina_confirmar_despejar', palabras: ['cocina', 'despejar', 'confirmar', 'comanda', 'si no', 'toque directo', 'deshacer', 'sin preguntar'], permiso: 'ADMIN', peligro: 'bajo', efecto: 'Cambia solo la pantalla de cocina: el pedido sigue el mismo flujo y «Deshacer» sigue disponible.', rango: 'Sí o No', porDefecto: 'Sí (encendido si no existe)' },
];
