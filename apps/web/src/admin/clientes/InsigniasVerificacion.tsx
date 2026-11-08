import type { CSSProperties } from 'react';
import type { VerificacionCliente } from './tipos';

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 9999,
  padding: '2px 10px',
  lineHeight: '18px',
  whiteSpace: 'nowrap',
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' });

/** Texto de ayuda de la insignia de verificación (también para lectores de pantalla). */
export function detalleVerificacion(c: VerificacionCliente): string {
  if (c.verificado) {
    return `Creó su contraseña y confirmó su celular con el código de WhatsApp${c.verificadoEn ? ` el ${fechaCorta(c.verificadoEn)}` : ''}`;
  }
  if (c.estadoVerificacion === 'ANTIGUA') return 'Tiene contraseña, pero no hay registro de que confirmara su celular con el código (cuenta antigua)';
  return c.razonSinVerificar === 'MOSTRADOR' ? 'Creado en mostrador: aún no crea su contraseña' : 'No creó contraseña';
}

export function InsigniaVerificacion({ cliente }: { cliente: VerificacionCliente }) {
  // Clientes de una API anterior (sin el dato): no se muestra nada en vez de adivinar
  if (cliente.verificado === undefined) return null;
  const detalle = detalleVerificacion(cliente);
  let estilo: CSSProperties;
  let texto: string;
  if (cliente.verificado) {
    estilo = { background: 'var(--cp-green-bg, #e3f4e6)', color: 'var(--cp-green, #1b6b33)' };
    texto = '✓ Verificado';
  } else if (cliente.estadoVerificacion === 'ANTIGUA') {
    estilo = { background: 'var(--cp-line)', color: 'var(--cp-soft)' };
    texto = 'Verificación no registrada (cuenta antigua)';
  } else {
    estilo = { background: 'var(--cp-amber-bg, #fff1d6)', color: 'var(--cp-amber, #8a5a00)' };
    texto = `⚠ Sin verificar · ${cliente.razonSinVerificar === 'MOSTRADOR' ? 'Creado en mostrador' : 'No creó contraseña'}`;
  }
  return (
    <span data-testid="insignia-verificacion" title={detalle} aria-label={`${texto}. ${detalle}`} style={{ ...base, ...estilo }}>
      {texto}
    </span>
  );
}

export function InsigniaGasta({ cliente, saldo }: { cliente: VerificacionCliente; saldo: number }) {
  if (!cliente.puedeGastarPuntos) return null;
  return (
    <span
      data-testid="insignia-gasta"
      title="Cuenta activa con contraseña: puede usar sus puntos en la carta"
      style={{ ...base, background: 'var(--cp-green-bg, #e3f4e6)', color: 'var(--cp-green, #1b6b33)' }}
    >
      ★ Puede gastar sus puntos ({saldo.toFixed(2)})
    </span>
  );
}
