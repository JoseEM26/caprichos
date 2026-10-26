import { enmascararTelefono } from '../../chatbot/utilidades/enmascarar.util';

export interface DatosConversacionContacto {
  nombre_contacto?: string | null;
  nombre_editado?: boolean | null;
  identificador_tipo?: string | null;
  telefono?: string | null;
  party?: {
    persona?: {
      nombres?: string | null;
      apellidos?: string | null;
    } | null;
  } | null;
  flujo?: any;
}

/**
 * Determina si el remitente es un usuario sin número telefónico utilizable.
 */
export function esRemitenteSinTelefono(c: {
  identificador_tipo?: string | null;
  telefono?: string | null;
}): boolean {
  if (c.identificador_tipo === 'USUARIO_WA') return true;
  if (typeof c.telefono === 'string' && c.telefono.startsWith('wa-user:')) return true;
  return false;
}

/**
 * Limpia el nombre de perfil recibido de WhatsApp (contacts[].profile.name):
 * - Reemplaza saltos de línea y tabuladores por espacios.
 * - Limita la longitud a un máximo de 80 caracteres.
 * - Devuelve null si la cadena queda vacía.
 */
export function limpiarNombrePerfil(nombreRaw?: string | null): string | null {
  if (!nombreRaw) return null;
  const sinSaltos = String(nombreRaw).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const recortado = sinSaltos.slice(0, 80).trim();
  return recortado.length > 0 ? recortado : null;
}

/**
 * Obtiene el nombre a mostrar para una conversación según la jerarquía estricta:
 * 1. Nombre editado a mano (si nombre_editado = true y no está vacío)
 * 2. Persona vinculada (party)
 * 3. Nombre de perfil de WhatsApp (contacts[].profile.name)
 * 4. Teléfono enmascarado (+51 9*** ***61 o equivalente)
 * 5. 'Contacto sin nombre'
 */
export function obtenerNombreMostrar(c: DatosConversacionContacto): string {
  // 1. Nombre editado a mano
  if (c.nombre_editado && c.nombre_contacto && c.nombre_contacto.trim().length > 0) {
    return c.nombre_contacto.trim();
  }

  // 2. Persona vinculada (party)
  if (c.party?.persona) {
    const nombres = (c.party.persona.nombres || '').trim();
    const apellidos = (c.party.persona.apellidos || '').trim();
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    if (nombreCompleto.length > 0) {
      return nombreCompleto;
    }
  }

  const sinTelefono = esRemitenteSinTelefono(c);

  // 3. Nombre de perfil de WhatsApp
  const perfilWa = (
    c.nombre_contacto?.trim() ||
    (c.flujo as any)?.nombre_perfil_wa?.trim() ||
    ''
  ).trim();

  if (sinTelefono) {
    if (perfilWa.length > 0) {
      if (perfilWa.toLowerCase().startsWith('usuario de whatsapp')) {
        return perfilWa;
      }
      return `Usuario de WhatsApp (${perfilWa})`;
    }
    return 'Usuario de WhatsApp';
  }

  if (perfilWa.length > 0) {
    return perfilWa;
  }

  // 4. Teléfono enmascarado (solo si tiene número de teléfono)
  if (c.telefono && c.telefono.trim().length > 0) {
    const mask = enmascararTelefono(c.telefono);
    if (mask && mask !== '***') {
      return mask;
    }
  }

  // 5. Contacto sin nombre
  return 'Contacto sin nombre';
}
