import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';
import { DatosAvisoAlmacen, DatosAvisoNuevoPedido } from './avisos-internos.tipos';

export const BOTONES_AVISO_PEDIDO = (pedidoId: bigint | string): BotonAccion[] => [
  { id: `ped_apr_${pedidoId}`, titulo: '✅ Aprobar' },
  { id: `ped_rec_${pedidoId}`, titulo: '❌ Rechazar' },
];

export const BOTONES_AVISO_ALMACEN = (insumoId: bigint | string): BotonAccion[] => [
  { id: `alm_ok_${insumoId}`, titulo: '👍 Entendido' },
  { id: `alm_ver_${insumoId}`, titulo: '📦 Ver stock' },
];

export const FILAS_ACCIONES_EQUIPO = (pedidoId: bigint | string): FilaLista[] => [
  {
    id: `ped_apr_${pedidoId}`,
    titulo: 'Aprobar comanda',
    descripcion: 'Pasa a cola de preparacion y notifica al cliente',
  },
  {
    id: `ped_rec_${pedidoId}`,
    titulo: 'Rechazar comanda',
    descripcion: 'Notifica al cliente para coordinar correccion',
  },
];

export const TEXTOS_AVISOS = {
  /**
   * Genera el texto enriquecido para avisar al equipo de un nuevo pedido.
   * Garantiza estrictamente que el cuerpo no supere 1024 caracteres.
   */
  nuevoPedido(datos: DatosAvisoNuevoPedido): string {
    const canalIcono =
      datos.canal === 'WHATSAPP' || datos.canal === 'BOT'
        ? '💬 WhatsApp'
        : datos.canal === 'MOZO'
          ? '🤵 Mozo'
          : datos.canal === 'CAJA'
            ? '🏧 Caja'
            : '🌐 Web';

    const iconoModalidad =
      datos.modalidad === 'DELIVERY'
        ? '🛵 Delivery'
        : datos.modalidad === 'RECOJO'
          ? '🛍️ Para recoger'
          : '🍽️ En salón';

    const lineasTexto = (datos.lineas || [])
      .map((l) => {
        const tam = l.tamano ? ` (${l.tamano})` : '';
        const not = l.nota ? ` [Nota: ${l.nota}]` : '';
        return `• ${l.cantidad}x ${l.nombre}${tam}${not}`;
      })
      .join('\n');

    const entregaInfo =
      datos.modalidad === 'DELIVERY' && datos.direccion
        ? `📍 *Dirección:* ${datos.direccion}${datos.referencia ? `\n🏠 *Ref:* ${datos.referencia}` : ''}\n`
        : '';

    const encabezado = `🚨 *[NUEVO PEDIDO REGISTRADO]* 🚨\n\n`;
    const datosPrincipales =
      `📦 *Pedido:* ${datos.codigo} (${canalIcono})\n` +
      `👤 *Cliente:* ${datos.clienteNombre}\n` +
      `📱 *Contacto:* ${datos.clienteTelefonoMask}\n` +
      `🛵 *Modalidad:* ${iconoModalidad}\n` +
      `${entregaInfo}` +
      `💵 *Total:* S/ ${Number(datos.total).toFixed(2)}\n\n`;

    const seccionLineasTitulo = `📋 *Detalle del pedido:*\n`;

    let cuerpo = encabezado + datosPrincipales + seccionLineasTitulo + (lineasTexto || '• Sin productos detallados');

    // Salvaguarda estricta de límite de WhatsApp (máx 1024 caracteres)
    if (cuerpo.length > 1020) {
      const maxLineasLength = 1020 - (encabezado + datosPrincipales + seccionLineasTitulo).length - 25;
      const lineasRecortadas = lineasTexto.slice(0, Math.max(0, maxLineasLength)) + '\n... y más items';
      cuerpo = encabezado + datosPrincipales + seccionLineasTitulo + lineasRecortadas;
      if (cuerpo.length > 1024) {
        cuerpo = cuerpo.slice(0, 1021) + '...';
      }
    }

    return cuerpo;
  },

  /**
   * Genera el texto de alerta para insumo agotado en Almacén.
   */
  almacenInsumoAgotado(datos: DatosAvisoAlmacen): string {
    const unidad = datos.unidadMedida ? ` ${datos.unidadMedida}` : '';
    const lugar = datos.lugarNombre ? `\n📍 *Ubicación:* ${datos.lugarNombre}` : '';

    return (
      `🚨 *[ALERTA DE ALMACÉN]* ⚠️\n\n` +
      `🔴 *Insumo Agotado:* ${datos.nombreInsumo}\n` +
      `📦 *Stock actual:* ${Number(datos.stockActual).toFixed(2)}${unidad}\n` +
      `📉 *Stock mínimo:* ${Number(datos.stockMinimo).toFixed(2)}${unidad}` +
      `${lugar}\n\n` +
      `Se requiere reposición urgente para no afectar la carta.`
    );
  },

  /**
   * Genera el texto de alerta para insumo por pedir (bajo stock) en Almacén.
   */
  almacenInsumoPorPedir(datos: DatosAvisoAlmacen): string {
    const unidad = datos.unidadMedida ? ` ${datos.unidadMedida}` : '';
    const lugar = datos.lugarNombre ? `\n📍 *Ubicación:* ${datos.lugarNombre}` : '';

    return (
      `📦 *[ALERTA DE ALMACÉN]* ⚠️\n\n` +
      `🟡 *Insumo por pedir:* ${datos.nombreInsumo}\n` +
      `📊 *Stock actual:* ${Number(datos.stockActual).toFixed(2)}${unidad}\n` +
      `📉 *Stock mínimo:* ${Number(datos.stockMinimo).toFixed(2)}${unidad}` +
      `${lugar}\n\n` +
      `El stock se encuentra en o por debajo del mínimo. Coordinar pedido al proveedor.`
    );
  },

  /**
   * Mensaje de confirmación cuando un miembro del equipo pulsa un botón desde WhatsApp.
   */
  confirmacionAccionAdmin(accion: 'APROBADO' | 'RECHAZADO', codigo: string): string {
    if (accion === 'APROBADO') {
      return `✅ *Comanda confirmada*\n\nEl pedido ${codigo} ha sido aprobado para preparación. Se notificó al cliente y a cocina.`;
    }
    return `❌ *Comanda rechazada*\n\nEl pedido ${codigo} ha sido rechazado. Se notificó al cliente para coordinar.`;
  },
};
