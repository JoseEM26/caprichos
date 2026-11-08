/*
 * Estado de verificación de una cuenta de cliente (solo lectura; no cambia ninguna regla de canje).
 *
 * VERIFICADO = tiene contraseña (customer_account.hash) Y hay evidencia guardada de que confirmó su celular por WhatsApp:
 *   - se registró en la carta (consent canal CARTA: el registro exige la marca de verificación del celular), o
 *   - recuperó/creó su contraseña con el código (customer_account.clave_cambiada_en).
 *   verificadoEn = la más antigua de esas dos fechas.
 * ANTIGUA = tiene contraseña pero no hay evidencia, o la cuenta se registró antes de que el registro exigiera el código
 *   (02/11/2026). No se puede saber si verificó: se muestra «no registrada».
 * SIN_VERIFICAR = sin contraseña (mostrador o bot).
 *
 * Puede gastar puntos = lo que hoy exige el canje (PedidosService): cuenta activa + ingresar con contraseña + saldo > 0.
 */

/** Desde esta fecha (UTC) crear cuenta en la carta exige el código por WhatsApp. Antes no hay garantía. */
export const INICIO_VERIFICACION_REGISTRO = new Date('2026-11-02T05:00:00.000Z');

export type EstadoVerificacion = 'VERIFICADO' | 'SIN_VERIFICAR' | 'ANTIGUA';
export type RazonSinVerificar = 'MOSTRADOR' | 'SIN_CONTRASENA';

export interface EntradaVerificacion {
  tieneContrasena: boolean;
  cuentaActiva: boolean;
  saldo: number;
  /** Fechas de consentimiento canal CARTA (registro en la carta con código) */
  consentimientosCarta: Date[];
  /** Hay consentimiento canal CAJA (creado en mostrador) */
  creadoEnMostrador: boolean;
  claveCambiadaEn: Date | null;
}

export interface EstadoVerificacionCliente {
  estado: EstadoVerificacion;
  verificado: boolean;
  verificadoEn: Date | null;
  tieneContrasena: boolean;
  razon: RazonSinVerificar | null;
  puedeGastarPuntos: boolean;
}

export function estadoVerificacionCliente(e: EntradaVerificacion): EstadoVerificacionCliente {
  const salida = (estado: EstadoVerificacion, verificadoEn: Date | null, razon: RazonSinVerificar | null) => ({
    estado,
    verificado: estado === 'VERIFICADO',
    verificadoEn,
    tieneContrasena: e.tieneContrasena,
    razon,
    puedeGastarPuntos: e.tieneContrasena && e.cuentaActiva && e.saldo > 0,
  });
  if (!e.tieneContrasena) return salida('SIN_VERIFICAR', null, e.creadoEnMostrador ? 'MOSTRADOR' : 'SIN_CONTRASENA');

  const fechas = [
    ...e.consentimientosCarta.filter((f) => f >= INICIO_VERIFICACION_REGISTRO),
    ...(e.claveCambiadaEn ? [e.claveCambiadaEn] : []),
  ].sort((a, b) => a.getTime() - b.getTime());
  return fechas.length ? salida('VERIFICADO', fechas[0], null) : salida('ANTIGUA', null, null);
}
